import json
import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import List

from ..database import get_db, MediaFile, MediaFolder, Setting
from ..ffprobe import format_size
from ..scanner import _compute_score, _detect_duplicates
from ..tmdb import runtime_match_label

router = APIRouter(prefix="/api/files", tags=["files"])


class BulkDeletePayload(BaseModel):
    file_ids: List[int]


class BulkMovePayload(BaseModel):
    file_ids: List[int]
    destination: str


@router.delete("/bulk")
async def bulk_delete(payload: BulkDeletePayload, db: AsyncSession = Depends(get_db)):
    deleted = []
    errors = []
    affected_folders: set[int] = set()

    for fid in payload.file_ids:
        mf = await db.get(MediaFile, fid)
        if not mf:
            errors.append({"id": fid, "error": "Not found"})
            continue
        try:
            os.remove(mf.path)
            affected_folders.add(mf.folder_id)
            deleted.append({"id": fid, "path": mf.path})
            await db.delete(mf)
        except OSError as e:
            errors.append({"id": fid, "error": str(e)})

    await db.commit()

    # Recalculate scores for affected folders
    for folder_id in affected_folders:
        await _rescore_folder(db, folder_id)

    return {"deleted": deleted, "errors": errors}


@router.post("/move")
async def bulk_move(payload: BulkMovePayload, db: AsyncSession = Depends(get_db)):
    if not os.path.isdir(payload.destination):
        raise HTTPException(400, f"Destination does not exist: {payload.destination}")

    moved = []
    errors = []
    affected_folders: set[int] = set()

    for fid in payload.file_ids:
        mf = await db.get(MediaFile, fid)
        if not mf:
            errors.append({"id": fid, "error": "Not found"})
            continue
        dest_path = os.path.join(payload.destination, mf.filename)
        try:
            os.rename(mf.path, dest_path)
            affected_folders.add(mf.folder_id)
            moved.append({"id": fid, "old_path": mf.path, "new_path": dest_path})
            mf.path = dest_path
        except OSError as e:
            errors.append({"id": fid, "error": str(e)})

    await db.commit()
    for folder_id in affected_folders:
        await _rescore_folder(db, folder_id)

    return {"moved": moved, "errors": errors}


async def _rescore_folder(db: AsyncSession, folder_id: int) -> None:
    qt_row = await db.get(Setting, "quality_target")
    quality_target = qt_row.value if qt_row else "1080p"

    result = await db.execute(
        select(MediaFolder).options(selectinload(MediaFolder.files)).where(MediaFolder.id == folder_id)
    )
    folder = result.scalar_one_or_none()
    if not folder:
        return

    video_files = [f for f in folder.files if not f.is_iso]
    iso_files = [f for f in folder.files if f.is_iso]

    file_dicts = [
        {
            "size_bytes": f.size_bytes,
            "is_4k": f.is_4k,
            "is_iso": f.is_iso,
            "duration_seconds": f.duration_seconds,
            "resolution_height": f.resolution_height,
            "quality_label": f.quality_label,
        }
        for f in video_files
    ]

    true_dupes = _detect_duplicates([f.filename for f in video_files])
    score, label, reasons = _compute_score(file_dicts, len(iso_files), folder.tmdb_runtime_minutes,
                                           has_true_duplicates=true_dupes,
                                           quality_target=quality_target)
    folder.score = score
    folder.score_label = label
    folder.score_reasons = json.dumps(reasons)
    folder.has_duplicates = true_dupes
    folder.has_iso = len(iso_files) > 0
    folder.has_4k = any(f.is_4k for f in video_files)
    folder.video_count = len(video_files)
    folder.total_size_bytes = sum(f.size_bytes or 0 for f in folder.files)

    await db.commit()
