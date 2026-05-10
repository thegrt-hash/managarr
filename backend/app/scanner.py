import asyncio
import json
import os
import re
from datetime import datetime
from typing import Optional

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from .database import AsyncSessionLocal, MediaFile, MediaFolder, ScanJob, Setting, SonarrSeries, RadarrMovie
from .ffprobe import ALL_VIDEO, ISO_EXTENSIONS, VIDEO_EXTENSIONS, probe_file, parse_filename_quality
from .tmdb import (
    parse_movie_folder, parse_tv_season_folder,
    search_movie, get_movie_details, search_tv, runtime_match_label,
)

SUBTITLE_EXTENSIONS = {".srt", ".sub", ".ass", ".vtt", ".ssa", ".idx"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".tbn"}
SKIP_DIRS = {"@eaDir", ".DS_Store", "@Recycle", "#recycle", ".Trash"}

# Ordered quality tiers: (label, min_height)
QUALITY_TIERS = [
    ("480p",  480),
    ("720p",  720),
    ("1080p", 1080),
    ("4k",    2160),
    ("8k",    4320),
]
QUALITY_TIER_HEIGHTS: dict[str, int] = {name: h for name, h in QUALITY_TIERS}
_TIER_HEIGHT_LIST = [h for _, h in QUALITY_TIERS]  # sorted ascending

# Common language codes found in subtitle filenames: Movie.en.srt, Movie.eng.srt
_LANG_PATTERN = re.compile(
    r'\.([a-z]{2,3})(?:\.[a-z]+)?$',  # matches .en.srt, .eng.srt, .fr.forced.srt
    re.IGNORECASE,
)


def _detect_subtitle_files(folder_entries: list[str], video_basename: str) -> tuple[bool, list[str]]:
    """
    Check folder entries for subtitle files matching this video.
    Returns (has_subtitles, [language_codes]).
    Matches: Movie.srt, Movie.en.srt, Movie.English.srt, Movie.en.forced.srt
    """
    base = os.path.splitext(video_basename)[0].lower()
    found_langs: list[str] = []

    for fname in folder_entries:
        ext = os.path.splitext(fname)[1].lower()
        if ext not in SUBTITLE_EXTENSIONS:
            continue
        fname_lower = fname.lower()
        fname_noext = os.path.splitext(fname_lower)[0]

        if fname_noext == base:
            found_langs.append("und")  # undetermined language
            continue

        if fname_noext.startswith(base + "."):
            suffix = fname_noext[len(base) + 1:]
            # suffix is like "en", "eng", "en.forced", "english"
            lang = suffix.split(".")[0]
            found_langs.append(lang)

    return bool(found_langs), found_langs

_QUALITY_STRIP = re.compile(
    r'\b(19|20)\d{2}\b'
    r'|\b(2160p|1080p|720p|480p|4k|uhd|hdr|sdr|bluray|blu-ray|remux|webdl|web-dl|webrip|'
    r'hdtv|x264|x265|h264|h265|hevc|avc|aac|dts|atmos|truehd|xvid|divx)\b',
    re.IGNORECASE,
)


def _normalize_title(filename: str) -> str:
    name = os.path.splitext(filename)[0]
    name = _QUALITY_STRIP.sub('', name)
    name = re.sub(r'[-._\s]+', ' ', name).strip().lower()
    return name


def _detect_duplicates(filenames: list[str]) -> bool:
    """True only if two or more files share the same normalized title (same movie, different formats)."""
    if len(filenames) <= 1:
        return False
    titles = [_normalize_title(f) for f in filenames]
    seen: set[str] = set()
    for t in titles:
        if t in seen:
            return True
        seen.add(t)
    return False


# Global scan state (single scan at a time)
_scan_state: dict = {"job_id": None, "status": "idle", "progress": 0, "total": 0,
                     "current_path": "", "errors": []}
_scan_task: Optional[asyncio.Task] = None


def get_scan_state() -> dict:
    return dict(_scan_state)


def _extract_season_number(folder_name: str) -> Optional[int]:
    """Parse season number from folder names like 'Season 1', 'Season 01', 'S01'."""
    m = re.match(r'^[Ss]eason\s*(\d+)$', folder_name.strip())
    if m:
        return int(m.group(1))
    m = re.match(r'^[Ss](\d{1,2})$', folder_name.strip())
    if m:
        return int(m.group(1))
    return None


def _match_sonarr(folder_path: str, sonarr_map: dict) -> tuple[Optional[int], Optional[int], Optional[int]]:
    """Match a folder to a Sonarr series + season.
    Returns (series_id, season_number, expected_episode_count).
    """
    folder_name = os.path.basename(folder_path)
    season_num = _extract_season_number(folder_name)

    for series_path, series_data in sonarr_map.items():
        if not series_path:
            continue
        # Normalize paths for comparison
        if folder_path.rstrip('/').startswith(series_path.rstrip('/')):
            sid = series_data["id"]
            if season_num is not None:
                for season in series_data.get("seasons", []):
                    if season.get("seasonNumber") == season_num and season_num > 0:
                        return sid, season_num, season.get("episodeCount", 0)
                return sid, season_num, None
            return sid, None, None
    return None, None, None


def _detect_folder_type(path: str, files: list[str]) -> str:
    """Determine if folder is a movie, tv_season, or unknown."""
    name = os.path.basename(path)
    if re.match(r"^[Ss]eason\s*\d+$", name) or re.match(r"^[Ss]\d{2}$", name):
        return "tv_season"
    if re.match(r"^.+\(\d{4}\)$", name.strip()):
        return "movie"
    # Check file names for episode patterns
    for f in files:
        if re.search(r"[Ss]\d{2}[Ee]\d{2}", f):
            return "tv_season"
    return "unknown"


def _tier_index(height: int) -> int:
    """Return the quality tier index for a given resolution height (0=480p … 4=8K)."""
    return sum(1 for th in _TIER_HEIGHT_LIST if height >= th) - 1


def _compute_score(video_files: list[dict], iso_count: int, tmdb_runtime: Optional[int],
                   has_true_duplicates: bool = False,
                   expected_episodes: Optional[int] = None,
                   actual_episodes: Optional[int] = None,
                   quality_target: str = "1080p") -> tuple[float, str, list[str]]:
    score = 100.0
    reasons = []

    target_height = QUALITY_TIER_HEIGHTS.get(quality_target, 1080)
    target_tier = _tier_index(target_height)

    if iso_count > 0:
        score -= 40
        reasons.append(f"{iso_count} ISO file(s) present — should be removed")

    dup_count = len(video_files)
    if has_true_duplicates:
        penalty = min(25, 10 * (dup_count - 1))
        score -= penalty
        reasons.append(f"{dup_count} duplicate video files (same title, different formats)")
    elif dup_count > 1:
        score -= 5
        reasons.append(f"Flat folder: {dup_count} different movies in one directory")

    # Flag any file that exceeds the target quality tier
    has_above_target = any(
        (f.get("resolution_height") or 0) > target_height for f in video_files
    )
    if has_above_target:
        score -= 15
        reasons.append(f"Content above target quality (library targets {quality_target})")

    # Pick primary: largest file at-or-below target, fall back to largest overall
    at_or_below = [f for f in video_files if (f.get("resolution_height") or 0) <= target_height]
    primary = (
        max(at_or_below, key=lambda f: f.get("size_bytes", 0)) if at_or_below
        else (max(video_files, key=lambda f: f.get("size_bytes", 0)) if video_files else None)
    )

    if primary:
        h = primary.get("resolution_height") or 0
        if h and h < target_height:
            tiers_below = target_tier - _tier_index(h)
            if tiers_below >= 2:
                score -= 20
                reasons.append(
                    f"Primary file well below target quality "
                    f"({primary.get('quality_label', 'unknown')} vs target {quality_target})"
                )
            else:
                score -= 10
                reasons.append(
                    f"Primary file below target quality "
                    f"({primary.get('quality_label', 'unknown')} vs target {quality_target})"
                )

        match = runtime_match_label(primary.get("duration_seconds"), tmdb_runtime)
        if match == "mismatch":
            score -= 25
            actual = (primary["duration_seconds"] / 60) if primary.get("duration_seconds") else 0
            reasons.append(f"Runtime mismatch: {actual:.0f}min vs TMDB {tmdb_runtime}min")
        elif match == "acceptable":
            score -= 8
            actual = (primary["duration_seconds"] / 60) if primary.get("duration_seconds") else 0
            reasons.append(f"Runtime slightly off: {actual:.0f}min vs TMDB {tmdb_runtime}min")
        elif match == "unknown" and tmdb_runtime:
            score -= 5
            reasons.append("Could not read file duration for runtime check")

    # Episode count validation (TV seasons matched via Sonarr)
    if expected_episodes is not None and expected_episodes > 0 and actual_episodes is not None:
        missing = expected_episodes - actual_episodes
        extra = actual_episodes - expected_episodes
        if missing > 0:
            pct_missing = missing / expected_episodes
            if pct_missing >= 0.5:
                score -= 35
                reasons.append(
                    f"Many missing episodes: {actual_episodes}/{expected_episodes} present "
                    f"({missing} missing — {pct_missing:.0%} of season)"
                )
            elif pct_missing >= 0.2:
                score -= 20
                reasons.append(
                    f"Missing episodes: {actual_episodes}/{expected_episodes} present ({missing} missing)"
                )
            else:
                score -= 10
                reasons.append(
                    f"Possibly missing: {actual_episodes}/{expected_episodes} episodes present"
                )
        elif extra > 0 and has_true_duplicates:
            # Extra files already flagged by duplicate logic — no double penalty
            pass
        elif extra > 0:
            reasons.append(
                f"More files than expected: {actual_episodes} files vs {expected_episodes} expected episodes"
            )
        else:
            reasons.append(f"Episode count OK: {actual_episodes}/{expected_episodes} present ✓")

    if not video_files and iso_count == 0:
        score = 0
        reasons.append("No video files found")

    score = max(0.0, score)
    if score >= 80:
        label = "good"
    elif score >= 50:
        label = "questionable"
    else:
        label = "needs_review"

    return score, label, reasons


async def _get_setting(db: AsyncSession, key: str) -> Optional[str]:
    row = await db.get(Setting, key)
    return row.value if row else None


async def _scan_folder(db: AsyncSession, folder_path: str, tmdb_key: Optional[str],
                       radarr_map: dict, sonarr_map: dict,
                       quality_target: str = "1080p") -> None:
    entries = os.listdir(folder_path)
    video_files = [e for e in entries if os.path.splitext(e)[1].lower() in VIDEO_EXTENSIONS]
    iso_files = [e for e in entries if os.path.splitext(e)[1].lower() in ISO_EXTENSIONS]
    all_vid = video_files + iso_files

    if not all_vid:
        return

    folder_name = os.path.basename(folder_path)
    folder_type = _detect_folder_type(folder_path, all_vid)

    # ── Phase 1: DB reads only (no write lock) ────────────────────────────────
    result = await db.execute(select(MediaFolder).where(MediaFolder.path == folder_path))
    existing_folder = result.scalar_one_or_none()

    # Load existing file records keyed by path for mtime comparison
    existing_files: dict[str, MediaFile] = {}
    if existing_folder is not None:
        ef_res = await db.execute(
            select(MediaFile).where(MediaFile.folder_id == existing_folder.id)
        )
        for mf in ef_res.scalars():
            existing_files[mf.path] = mf

    # ── Phase 2: Radarr / Sonarr / TMDB lookups (HTTP, no DB writes) ─────────
    radarr_data = radarr_map.get(folder_path.rstrip('/')) or \
                  radarr_map.get(os.path.dirname(folder_path).rstrip('/'))

    tmdb_id = existing_folder.tmdb_id if existing_folder else None
    tmdb_title = existing_folder.tmdb_title if existing_folder else None
    tmdb_year = existing_folder.tmdb_year if existing_folder else None
    tmdb_runtime: Optional[int] = existing_folder.tmdb_runtime_minutes if existing_folder else None
    radarr_movie_id = existing_folder.radarr_movie_id if existing_folder else None
    radarr_has_file = existing_folder.radarr_has_file if existing_folder else None

    if radarr_data:
        radarr_movie_id = radarr_data["id"]
        radarr_has_file = radarr_data["has_file"]
        if not tmdb_id and radarr_data["tmdb_id"]:
            tmdb_id = radarr_data["tmdb_id"]
            tmdb_title = radarr_data["title"]
            tmdb_year = radarr_data["year"]
            tmdb_runtime = radarr_data["runtime"]
    elif folder_type in ("movie", "unknown") and tmdb_key and not tmdb_id:
        title, year = parse_movie_folder(folder_name)
        match = await search_movie(tmdb_key, title, year)
        if match:
            details = await get_movie_details(tmdb_key, match["tmdb_id"])
            if details:
                tmdb_id = details["tmdb_id"]
                tmdb_title = details["title"]
                tmdb_runtime = details["runtime_minutes"]
                tmdb_year = details["year"]

    sid, season_num, expected_eps = _match_sonarr(folder_path, sonarr_map)
    sonarr_series_id = existing_folder.sonarr_series_id if existing_folder else None
    sonarr_season_number = existing_folder.sonarr_season_number if existing_folder else None
    sonarr_expected_episodes = existing_folder.sonarr_expected_episodes if existing_folder else None
    if sid:
        sonarr_series_id = sid
    if season_num is not None:
        sonarr_season_number = season_num
    if expected_eps is not None:
        sonarr_expected_episodes = expected_eps

    # ── Phase 3: ffprobe all files (slow I/O — no DB connection held) ─────────
    total_size = 0
    probed: list[dict] = []

    for fname in all_vid:
        fpath = os.path.join(folder_path, fname)
        ext = os.path.splitext(fname)[1].lower()
        is_iso = ext in ISO_EXTENSIONS

        try:
            stat = os.stat(fpath)
            size = stat.st_size
            mtime = datetime.fromtimestamp(stat.st_mtime)
        except OSError:
            continue

        total_size += size
        existing_mf = existing_files.get(fpath)

        needs_probe = not is_iso and (
            existing_mf is None
            or existing_mf.last_scanned is None
            or (existing_mf.last_modified and mtime > existing_mf.last_modified)
        )

        probe: dict = {}
        if needs_probe:
            probe = await probe_file(fpath)

        # Subtitle detection (filesystem check — no DB)
        ext_has_subs, ext_langs = (
            _detect_subtitle_files(entries, fname) if not is_iso else (False, [])
        )
        emb_langs = probe.get("embedded_subtitle_languages", []) if needs_probe else (
            json.loads(existing_mf.subtitle_languages or "[]") if existing_mf else []
        )
        all_langs = list(dict.fromkeys(ext_langs + emb_langs))
        emb_count = probe.get("embedded_subtitle_count", 0) if needs_probe else (
            existing_mf.embedded_subtitle_count or 0 if existing_mf else 0
        )
        has_subtitles = ext_has_subs or emb_count > 0

        probed.append({
            "fname": fname, "fpath": fpath, "ext": ext, "is_iso": is_iso,
            "size": size, "mtime": mtime,
            "needs_probe": needs_probe, "probe": probe,
            "has_subtitles": has_subtitles, "all_langs": all_langs,
            "emb_count": emb_count,
            "existing_mf": existing_mf,
        })

    # ── Phase 4: DB writes (write lock held only during this short burst) ─────
    if existing_folder is None:
        folder = MediaFolder(path=folder_path, name=folder_name)
        db.add(folder)
        await db.flush()  # get folder.id — lock acquired here
    else:
        folder = existing_folder

    folder.name = folder_name
    folder.parent_path = os.path.dirname(folder_path)
    folder.folder_type = folder_type
    folder.last_scanned = datetime.utcnow()
    folder.radarr_movie_id = radarr_movie_id
    folder.radarr_has_file = radarr_has_file
    folder.tmdb_id = tmdb_id
    folder.tmdb_title = tmdb_title
    folder.tmdb_year = tmdb_year
    folder.tmdb_runtime_minutes = tmdb_runtime
    folder.sonarr_series_id = sonarr_series_id
    folder.sonarr_season_number = sonarr_season_number
    folder.sonarr_expected_episodes = sonarr_expected_episodes

    # Delete stale file records
    for existing_mf in existing_files.values():
        if not os.path.exists(existing_mf.path):
            await db.delete(existing_mf)

    file_dicts: list[dict] = []

    for p in probed:
        mf = p["existing_mf"]
        if mf is None:
            mf = MediaFile(path=p["fpath"], folder_id=folder.id)
            db.add(mf)

        if p["needs_probe"]:
            probe = p["probe"]
            mf.duration_seconds = probe.get("duration_seconds")
            mf.resolution_width = probe.get("resolution_width")
            mf.resolution_height = probe.get("resolution_height")
            mf.video_codec = probe.get("video_codec")
            mf.audio_codec = probe.get("audio_codec")
            mf.is_4k = probe.get("is_4k", False)
            mf.embedded_subtitle_count = probe.get("embedded_subtitle_count", 0)
            probe_quality = probe.get("quality_label")
            if probe_quality and probe_quality != "Unknown":
                mf.quality_label = probe_quality
            else:
                fn_hint = parse_filename_quality(p["fname"])
                mf.quality_label = fn_hint.get("quality_hint") or probe_quality
                if fn_hint.get("is_4k_hint"):
                    mf.is_4k = True
            mf.last_scanned = datetime.utcnow()

        if not p["is_iso"]:
            mf.has_subtitles = p["has_subtitles"]
            mf.subtitle_languages = json.dumps(p["all_langs"])
            mf.embedded_subtitle_count = p["emb_count"]

        mf.filename = p["fname"]
        mf.extension = p["ext"]
        mf.size_bytes = p["size"]
        mf.is_iso = p["is_iso"]
        mf.last_modified = p["mtime"]
        mf.runtime_match = runtime_match_label(mf.duration_seconds, tmdb_runtime)

        file_dicts.append({
            "size_bytes": p["size"],
            "is_4k": mf.is_4k,
            "is_iso": p["is_iso"],
            "duration_seconds": mf.duration_seconds,
            "resolution_height": mf.resolution_height,
            "quality_label": mf.quality_label,
            "has_subtitles": p["has_subtitles"] if not p["is_iso"] else True,
        })

    # Score
    video_dicts = [f for f in file_dicts if not f["is_iso"]]
    true_dupes = _detect_duplicates(video_files)
    actual_eps = len(video_files) if sonarr_expected_episodes else None
    folder.sonarr_actual_episodes = actual_eps
    score, label, reasons = _compute_score(
        video_dicts, len(iso_files), tmdb_runtime,
        has_true_duplicates=true_dupes,
        expected_episodes=sonarr_expected_episodes,
        actual_episodes=actual_eps,
        quality_target=quality_target,
    )

    video_file_count = len(video_dicts)
    missing_sub_count = sum(1 for f in video_dicts if not f.get("has_subtitles", False))
    if missing_sub_count > 0 and video_file_count > 0:
        pct = missing_sub_count / video_file_count
        if pct == 1.0:
            score -= 10
            reasons.append(f"No subtitles found on any video file ({missing_sub_count} file(s))")
        else:
            score -= 5
            reasons.append(f"{missing_sub_count}/{video_file_count} files missing subtitles")

    folder.score = max(0.0, score)
    folder.score_label = (
        "good" if folder.score >= 80 else
        "questionable" if folder.score >= 50 else
        "needs_review"
    )
    folder.score_reasons = json.dumps(reasons)
    folder.has_duplicates = true_dupes
    folder.has_iso = len(iso_files) > 0
    folder.has_4k = any(f["is_4k"] for f in video_dicts)
    folder.missing_subtitles = missing_sub_count > 0
    folder.video_count = len(video_files)
    folder.total_size_bytes = total_size

    if folder.baseline_state:
        try:
            baseline = json.loads(folder.baseline_state)
            current = {f: os.path.getsize(os.path.join(folder_path, f))
                       for f in all_vid if os.path.exists(os.path.join(folder_path, f))}
            folder.baseline_changed = (current != baseline)
        except Exception:
            folder.baseline_changed = False

    await db.commit()


async def run_scan(root_paths: list[str]) -> None:
    global _scan_state
    _scan_state["status"] = "running"
    _scan_state["errors"] = []
    _scan_state["progress"] = 0
    _scan_state["total"] = 0

    async with AsyncSessionLocal() as db:
        # Create scan job record
        job = ScanJob(started_at=datetime.utcnow(), status="running")
        db.add(job)
        await db.commit()
        await db.refresh(job)
        _scan_state["job_id"] = job.id

        tmdb_key = await _get_setting(db, "tmdb_api_key")
        quality_target = (await _get_setting(db, "quality_target")) or "1080p"

        # Build Radarr path map — include all metadata so we don't need TMDB API calls
        radarr_res = await db.execute(select(RadarrMovie))
        radarr_map = {}
        for movie in radarr_res.scalars():
            if movie.path:
                radarr_map[movie.path.rstrip('/')] = {
                    "id": movie.id,
                    "tmdb_id": str(movie.tmdb_id) if movie.tmdb_id else None,
                    "title": movie.title,
                    "year": movie.year,
                    "runtime": movie.runtime,
                    "has_file": movie.has_file,
                }

        # Build Sonarr path map — include seasons so we can do per-season episode validation
        sonarr_res = await db.execute(select(SonarrSeries))
        sonarr_map = {}
        for series in sonarr_res.scalars():
            if series.path:
                seasons = []
                if series.seasons:
                    try:
                        seasons = json.loads(series.seasons)
                    except Exception:
                        pass
                sonarr_map[series.path] = {"id": series.id, "seasons": seasons}

    # Collect all folders across all configured roots
    folders_to_scan = []
    for root_path in root_paths:
        try:
            for dirpath, dirnames, filenames in os.walk(root_path):
                dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
                exts = {os.path.splitext(f)[1].lower() for f in filenames}
                if exts & ALL_VIDEO:
                    folders_to_scan.append(dirpath)
        except PermissionError as e:
            _scan_state["errors"].append(str(e))

    _scan_state["total"] = len(folders_to_scan)

    # Each folder gets its own session so the write lock is released between folders,
    # allowing delete/edit requests to proceed during a long scan.
    for i, folder_path in enumerate(folders_to_scan):
        _scan_state["current_path"] = folder_path
        _scan_state["progress"] = i + 1
        try:
            async with AsyncSessionLocal() as db:
                await _scan_folder(db, folder_path, tmdb_key, radarr_map, sonarr_map, quality_target)
        except Exception as e:
            _scan_state["errors"].append(f"{folder_path}: {e}")

    # Update job in its own session
    async with AsyncSessionLocal() as db:
        job = await db.get(ScanJob, _scan_state["job_id"])
        if job:
            job.status = "completed"
            job.completed_at = datetime.utcnow()
            job.total_folders = len(folders_to_scan)
            job.scanned_folders = len(folders_to_scan)
            await db.commit()

    _scan_state["status"] = "completed"
    _scan_state["current_path"] = ""


async def start_scan(root_paths: list[str]) -> None:
    global _scan_task
    if _scan_task and not _scan_task.done():
        return
    _scan_task = asyncio.create_task(run_scan(root_paths))


def stop_scan() -> None:
    global _scan_task, _scan_state
    if _scan_task and not _scan_task.done():
        _scan_task.cancel()
        _scan_state["status"] = "stopped"
