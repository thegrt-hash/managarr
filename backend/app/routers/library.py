import json
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import Optional

from ..database import get_db, MediaFolder, MediaFile
from ..ffprobe import format_size

router = APIRouter(prefix="/api", tags=["library"])


def folder_to_dict(f: MediaFolder, include_files: bool = False) -> dict:
    reasons = []
    if f.score_reasons:
        try:
            reasons = json.loads(f.score_reasons)
        except Exception:
            pass

    d = {
        "id": f.id,
        "path": f.path,
        "name": f.name,
        "parent_path": f.parent_path,
        "folder_type": f.folder_type,
        "score": round(f.score, 1),
        "score_label": f.score_label,
        "score_reasons": reasons,
        "has_duplicates": f.has_duplicates,
        "has_iso": f.has_iso,
        "has_4k": f.has_4k,
        "missing_subtitles": f.missing_subtitles,
        "video_count": f.video_count,
        "total_size_bytes": f.total_size_bytes,
        "total_size": format_size(f.total_size_bytes or 0),
        "tmdb_id": f.tmdb_id,
        "tmdb_title": f.tmdb_title,
        "tmdb_runtime_minutes": f.tmdb_runtime_minutes,
        "tmdb_year": f.tmdb_year,
        "last_scanned": f.last_scanned.isoformat() if f.last_scanned else None,
        "baseline_set_at": f.baseline_set_at.isoformat() if f.baseline_set_at else None,
        "baseline_changed": f.baseline_changed,
        "sonarr_series_id": f.sonarr_series_id,
        "sonarr_season_number": f.sonarr_season_number,
        "sonarr_expected_episodes": f.sonarr_expected_episodes,
        "sonarr_actual_episodes": f.sonarr_actual_episodes,
        "radarr_movie_id": f.radarr_movie_id,
        "radarr_has_file": f.radarr_has_file,
    }
    if include_files:
        d["files"] = [file_to_dict(mf) for mf in (f.files or [])]
    return d


def file_to_dict(mf: MediaFile) -> dict:
    return {
        "id": mf.id,
        "folder_id": mf.folder_id,
        "path": mf.path,
        "filename": mf.filename,
        "extension": mf.extension,
        "size_bytes": mf.size_bytes,
        "size": format_size(mf.size_bytes or 0),
        "duration_seconds": mf.duration_seconds,
        "duration_label": _fmt_duration(mf.duration_seconds),
        "resolution_width": mf.resolution_width,
        "resolution_height": mf.resolution_height,
        "video_codec": mf.video_codec,
        "audio_codec": mf.audio_codec,
        "is_4k": mf.is_4k,
        "is_iso": mf.is_iso,
        "quality_label": mf.quality_label,
        "runtime_match": mf.runtime_match,
        "has_subtitles": mf.has_subtitles,
        "subtitle_languages": json.loads(mf.subtitle_languages) if mf.subtitle_languages else [],
        "embedded_subtitle_count": mf.embedded_subtitle_count or 0,
        "last_scanned": mf.last_scanned.isoformat() if mf.last_scanned else None,
    }


def _fmt_duration(seconds: Optional[float]) -> str:
    if not seconds:
        return "—"
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h:
        return f"{h}h {m}m"
    return f"{m}m {s}s"


@router.get("/dashboard")
async def dashboard(db: AsyncSession = Depends(get_db)):
    total = (await db.execute(select(func.count(MediaFolder.id)))).scalar_one()
    good = (await db.execute(select(func.count(MediaFolder.id)).where(MediaFolder.score_label == "good"))).scalar_one()
    questionable = (await db.execute(select(func.count(MediaFolder.id)).where(MediaFolder.score_label == "questionable"))).scalar_one()
    needs_review = (await db.execute(select(func.count(MediaFolder.id)).where(MediaFolder.score_label == "needs_review"))).scalar_one()
    total_files = (await db.execute(select(func.count(MediaFile.id)))).scalar_one()
    total_size = (await db.execute(select(func.sum(MediaFolder.total_size_bytes)))).scalar_one() or 0
    duplicates = (await db.execute(select(func.count(MediaFolder.id)).where(MediaFolder.has_duplicates == True))).scalar_one()
    iso_count = (await db.execute(select(func.count(MediaFolder.id)).where(MediaFolder.has_iso == True))).scalar_one()
    has_4k = (await db.execute(select(func.count(MediaFolder.id)).where(MediaFolder.has_4k == True))).scalar_one()
    baseline_changed = (await db.execute(select(func.count(MediaFolder.id)).where(MediaFolder.baseline_changed == True))).scalar_one()
    missing_subs = (await db.execute(select(func.count(MediaFolder.id)).where(MediaFolder.missing_subtitles == True))).scalar_one()

    return {
        "total_folders": total,
        "good": good,
        "questionable": questionable,
        "needs_review": needs_review,
        "total_files": total_files,
        "total_size_bytes": total_size,
        "total_size": format_size(total_size),
        "duplicates": duplicates,
        "iso_folders": iso_count,
        "has_4k": has_4k,
        "baseline_changed": baseline_changed,
        "missing_subtitles": missing_subs,
    }


@router.get("/folders")
async def list_folders(
    score_label: Optional[str] = None,
    folder_type: Optional[str] = None,
    has_duplicates: Optional[bool] = None,
    has_iso: Optional[bool] = None,
    has_4k: Optional[bool] = None,
    baseline_changed: Optional[bool] = None,
    missing_subtitles: Optional[bool] = None,
    search: Optional[str] = None,
    sort: str = "score",
    order: str = "asc",
    page: int = 1,
    per_page: int = 50,
    db: AsyncSession = Depends(get_db),
):
    q = select(MediaFolder)
    if score_label:
        q = q.where(MediaFolder.score_label == score_label)
    if folder_type:
        q = q.where(MediaFolder.folder_type == folder_type)
    if has_duplicates is not None:
        q = q.where(MediaFolder.has_duplicates == has_duplicates)
    if has_iso is not None:
        q = q.where(MediaFolder.has_iso == has_iso)
    if has_4k is not None:
        q = q.where(MediaFolder.has_4k == has_4k)
    if baseline_changed is not None:
        q = q.where(MediaFolder.baseline_changed == baseline_changed)
    if missing_subtitles is not None:
        q = q.where(MediaFolder.missing_subtitles == missing_subtitles)
    if search:
        q = q.where(or_(
            MediaFolder.name.ilike(f"%{search}%"),
            MediaFolder.path.ilike(f"%{search}%"),
        ))

    sort_col = getattr(MediaFolder, sort, MediaFolder.score)
    if order == "desc":
        q = q.order_by(sort_col.desc())
    else:
        q = q.order_by(sort_col.asc())

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar_one()

    q = q.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(q)
    folders = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "items": [folder_to_dict(f) for f in folders],
    }


@router.get("/folders/{folder_id}")
async def get_folder(folder_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MediaFolder).options(selectinload(MediaFolder.files)).where(MediaFolder.id == folder_id)
    )
    folder = result.scalar_one_or_none()
    if not folder:
        from fastapi import HTTPException
        raise HTTPException(404, "Folder not found")
    return folder_to_dict(folder, include_files=True)


@router.get("/duplicates")
async def list_duplicates(
    page: int = 1,
    per_page: int = 50,
    db: AsyncSession = Depends(get_db),
):
    q = select(MediaFolder).options(selectinload(MediaFolder.files)).where(
        MediaFolder.has_duplicates == True
    ).order_by(MediaFolder.score.asc())

    count_q = select(func.count()).select_from(
        select(MediaFolder).where(MediaFolder.has_duplicates == True).subquery()
    )
    total = (await db.execute(count_q)).scalar_one()
    q = q.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(q)
    folders = result.scalars().all()
    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "items": [folder_to_dict(f, include_files=True) for f in folders],
    }


@router.get("/iso-files")
async def list_iso_files(
    page: int = 1,
    per_page: int = 100,
    db: AsyncSession = Depends(get_db),
):
    q = select(MediaFile).options(selectinload(MediaFile.folder)).where(
        MediaFile.is_iso == True
    ).order_by(MediaFile.size_bytes.desc())

    count_q = select(func.count()).select_from(
        select(MediaFile).where(MediaFile.is_iso == True).subquery()
    )
    total = (await db.execute(count_q)).scalar_one()
    q = q.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(q)
    files = result.scalars().all()
    return {
        "total": total,
        "items": [file_to_dict(f) for f in files],
    }
