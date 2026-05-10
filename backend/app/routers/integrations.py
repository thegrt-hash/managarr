import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from typing import List, Optional

from ..database import get_db, Setting, SonarrSeries, RadarrMovie, MediaFolder
from .. import sonarr as sonarr_client
from .. import radarr as radarr_client
from .. import bazarr as bazarr_client

router = APIRouter(prefix="/api", tags=["integrations"])


async def _get(db: AsyncSession, key: str) -> str:
    row = await db.get(Setting, key)
    if not row or not row.value:
        raise HTTPException(400, f"'{key}' not configured in settings")
    return row.value


# ── Sonarr ────────────────────────────────────────────────────────────────────

@router.get("/sonarr/test")
async def test_sonarr(db: AsyncSession = Depends(get_db)):
    url = await _get(db, "sonarr_url")
    key = await _get(db, "sonarr_api_key")
    ok, info = await sonarr_client.test_connection(url, key)
    return {"ok": ok, "info": info}


@router.post("/sonarr/sync")
async def sync_sonarr(db: AsyncSession = Depends(get_db)):
    url = await _get(db, "sonarr_url")
    key = await _get(db, "sonarr_api_key")
    series_list = await sonarr_client.fetch_series(url, key)
    if not series_list:
        raise HTTPException(502, "No data returned from Sonarr")

    await db.execute(delete(SonarrSeries))
    for s in series_list:
        db.add(SonarrSeries(
            id=s["id"],
            title=s["title"],
            tvdb_id=s.get("tvdb_id"),
            tmdb_id=s.get("tmdb_id"),
            path=s.get("path"),
            status=s.get("status"),
            episode_count=s.get("episode_count", 0),
            episode_file_count=s.get("episode_file_count", 0),
            seasons=json.dumps(s.get("seasons", [])),
        ))
    await db.commit()
    return {"synced": len(series_list)}


@router.get("/sonarr/series")
async def list_sonarr_series(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SonarrSeries).order_by(SonarrSeries.title))
    series = result.scalars().all()
    return [
        {
            "id": s.id,
            "title": s.title,
            "tvdb_id": s.tvdb_id,
            "path": s.path,
            "status": s.status,
            "episode_count": s.episode_count,
            "episode_file_count": s.episode_file_count,
            "seasons": json.loads(s.seasons) if s.seasons else [],
        }
        for s in series
    ]


# ── Radarr ────────────────────────────────────────────────────────────────────

@router.get("/radarr/test")
async def test_radarr(db: AsyncSession = Depends(get_db)):
    url = await _get(db, "radarr_url")
    key = await _get(db, "radarr_api_key")
    ok, info = await radarr_client.test_connection(url, key)
    return {"ok": ok, "info": info}


@router.post("/radarr/sync")
async def sync_radarr(db: AsyncSession = Depends(get_db)):
    url = await _get(db, "radarr_url")
    key = await _get(db, "radarr_api_key")
    movies = await radarr_client.fetch_movies(url, key)
    if not movies:
        raise HTTPException(502, "No data returned from Radarr")

    await db.execute(delete(RadarrMovie))
    for m in movies:
        db.add(RadarrMovie(
            id=m["id"],
            title=m["title"],
            tmdb_id=m.get("tmdb_id"),
            path=m.get("path"),
            status=m.get("status"),
            has_file=m.get("has_file", False),
            runtime=m.get("runtime"),
            year=m.get("year"),
        ))
    await db.commit()
    return {"synced": len(movies)}


# ── Bazarr ────────────────────────────────────────────────────────────────────

class SubtitleSearchPayload(BaseModel):
    folder_ids: List[int]
    languages: Optional[List[str]] = ["en"]


@router.get("/bazarr/test")
async def test_bazarr(db: AsyncSession = Depends(get_db)):
    url = await _get(db, "bazarr_url")
    key = await _get(db, "bazarr_api_key")
    ok, info = await bazarr_client.test_connection(url, key)
    return {"ok": ok, "info": info}


@router.post("/bazarr/search")
async def trigger_subtitle_search(
    payload: SubtitleSearchPayload,
    db: AsyncSession = Depends(get_db),
):
    """Trigger Bazarr subtitle search for a list of folders."""
    bazarr_url_row = await db.get(Setting, "bazarr_url")
    bazarr_key_row = await db.get(Setting, "bazarr_api_key")
    sonarr_url_row = await db.get(Setting, "sonarr_url")
    sonarr_key_row = await db.get(Setting, "sonarr_api_key")

    if not bazarr_url_row or not bazarr_key_row:
        raise HTTPException(400, "Bazarr not configured")

    burl = bazarr_url_row.value
    bkey = bazarr_key_row.value
    langs = payload.languages or ["en"]

    results = []
    for fid in payload.folder_ids:
        folder = await db.get(MediaFolder, fid)
        if not folder:
            results.append({"folder_id": fid, "ok": False, "msg": "Not found"})
            continue

        # Movie: use radarr_id
        if folder.radarr_movie_id:
            ok, msg = await bazarr_client.search_movie_subtitles(
                burl, bkey, folder.radarr_movie_id, langs
            )
            results.append({"folder_id": fid, "name": folder.name, "ok": ok, "msg": msg})

        # TV season: need per-episode IDs from Sonarr, then pass to Bazarr
        elif folder.sonarr_series_id:
            if sonarr_url_row and sonarr_key_row:
                episodes = await bazarr_client.get_episodes_for_series(
                    sonarr_url_row.value, sonarr_key_row.value, folder.sonarr_series_id
                )
                season = folder.sonarr_season_number
                season_eps = [
                    e for e in episodes
                    if (season is None or e["season"] == season) and e["has_file"]
                ]
                ep_results = []
                for ep in season_eps:
                    ok, msg = await bazarr_client.search_episode_subtitles(
                        burl, bkey, folder.sonarr_series_id, ep["episode_id"], langs
                    )
                    ep_results.append(ok)
                ok = any(ep_results)
                msg = f"Triggered {sum(ep_results)}/{len(season_eps)} episodes"
                results.append({"folder_id": fid, "name": folder.name, "ok": ok, "msg": msg})
            else:
                results.append({"folder_id": fid, "name": folder.name,
                                "ok": False, "msg": "Sonarr not configured — needed for TV episode IDs"})
        else:
            results.append({"folder_id": fid, "name": folder.name,
                            "ok": False, "msg": "No Radarr/Sonarr ID — sync integrations first"})

    return {"results": results}


@router.post("/bazarr/search-wanted")
async def search_wanted(db: AsyncSession = Depends(get_db)):
    """Tell Bazarr to process its full wanted queue (movies + episodes)."""
    url = await _get(db, "bazarr_url")
    key = await _get(db, "bazarr_api_key")
    m_ok, m_msg = await bazarr_client.search_wanted_movies(url, key)
    e_ok, e_msg = await bazarr_client.search_wanted_episodes(url, key)
    return {"movies": {"ok": m_ok, "msg": m_msg}, "episodes": {"ok": e_ok, "msg": e_msg}}


@router.get("/radarr/movies")
async def list_radarr_movies(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RadarrMovie).order_by(RadarrMovie.title))
    movies = result.scalars().all()
    return [
        {
            "id": m.id,
            "title": m.title,
            "tmdb_id": m.tmdb_id,
            "path": m.path,
            "status": m.status,
            "has_file": m.has_file,
            "runtime": m.runtime,
            "year": m.year,
        }
        for m in movies
    ]
