import json
import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db, MediaFolder
from ..ffprobe import format_size, ALL_VIDEO

router = APIRouter(prefix="/api/baselines", tags=["baselines"])


@router.get("")
async def list_baselines(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MediaFolder).where(MediaFolder.baseline_set_at != None).order_by(MediaFolder.name)
    )
    folders = result.scalars().all()
    return [
        {
            "id": f.id,
            "name": f.name,
            "path": f.path,
            "baseline_set_at": f.baseline_set_at.isoformat() if f.baseline_set_at else None,
            "baseline_changed": f.baseline_changed,
            "score_label": f.score_label,
            "total_size": format_size(f.total_size_bytes or 0),
        }
        for f in folders
    ]


@router.post("/{folder_id}")
async def set_baseline(folder_id: int, db: AsyncSession = Depends(get_db)):
    folder = await db.get(MediaFolder, folder_id)
    if not folder:
        raise HTTPException(404, "Folder not found")
    if not os.path.isdir(folder.path):
        raise HTTPException(400, "Folder path does not exist on disk")

    snapshot = {}
    for fname in os.listdir(folder.path):
        ext = os.path.splitext(fname)[1].lower()
        if ext in ALL_VIDEO:
            fpath = os.path.join(folder.path, fname)
            try:
                snapshot[fname] = os.path.getsize(fpath)
            except OSError:
                pass

    folder.baseline_state = json.dumps(snapshot)
    folder.baseline_set_at = datetime.utcnow()
    folder.baseline_changed = False
    await db.commit()
    return {"status": "baseline_set", "files": len(snapshot)}


@router.delete("/{folder_id}")
async def remove_baseline(folder_id: int, db: AsyncSession = Depends(get_db)):
    folder = await db.get(MediaFolder, folder_id)
    if not folder:
        raise HTTPException(404, "Folder not found")
    folder.baseline_state = None
    folder.baseline_set_at = None
    folder.baseline_changed = False
    await db.commit()
    return {"status": "removed"}


@router.post("/bulk/set")
async def bulk_set_baselines(folder_ids: list[int], db: AsyncSession = Depends(get_db)):
    count = 0
    for fid in folder_ids:
        folder = await db.get(MediaFolder, fid)
        if not folder or not os.path.isdir(folder.path):
            continue
        snapshot = {}
        for fname in os.listdir(folder.path):
            ext = os.path.splitext(fname)[1].lower()
            if ext in ALL_VIDEO:
                fpath = os.path.join(folder.path, fname)
                try:
                    snapshot[fname] = os.path.getsize(fpath)
                except OSError:
                    pass
        folder.baseline_state = json.dumps(snapshot)
        folder.baseline_set_at = datetime.utcnow()
        folder.baseline_changed = False
        count += 1
    await db.commit()
    return {"status": "done", "count": count}
