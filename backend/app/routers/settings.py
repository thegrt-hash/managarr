from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from ..database import get_db, Setting

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsPayload(BaseModel):
    # Legacy single root (kept for backwards-compat)
    media_root: Optional[str] = None
    # Per-type media paths
    movies_path: Optional[str] = None
    tv_path: Optional[str] = None
    music_path: Optional[str] = None
    audiobooks_path: Optional[str] = None
    # Integrations
    tmdb_api_key: Optional[str] = None
    sonarr_url: Optional[str] = None
    sonarr_api_key: Optional[str] = None
    radarr_url: Optional[str] = None
    radarr_api_key: Optional[str] = None
    bazarr_url: Optional[str] = None
    bazarr_api_key: Optional[str] = None
    subtitle_languages: Optional[str] = None
    quality_target: Optional[str] = None
    wizard_complete: Optional[str] = None


@router.get("")
async def get_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Setting))
    rows = result.scalars().all()
    return {row.key: row.value for row in rows}


@router.post("")
async def save_settings(payload: SettingsPayload, db: AsyncSession = Depends(get_db)):
    data = payload.model_dump(exclude_none=True)
    for key, value in data.items():
        row = await db.get(Setting, key)
        if row:
            row.value = value
        else:
            db.add(Setting(key=key, value=value))
    await db.commit()
    return {"status": "saved"}
