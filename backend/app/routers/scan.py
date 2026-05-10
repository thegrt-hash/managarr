from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db, Setting
from ..scanner import start_scan, stop_scan, get_scan_state

router = APIRouter(prefix="/api/scan", tags=["scan"])


@router.post("/start")
async def start_scan_endpoint(db: AsyncSession = Depends(get_db)):
    state = get_scan_state()
    if state["status"] == "running":
        raise HTTPException(400, "Scan already running")

    # Collect all configured media paths (per-type paths take precedence; media_root is legacy fallback)
    path_keys = ["movies_path", "tv_path", "music_path", "audiobooks_path", "media_root"]
    paths: list[str] = []
    for key in path_keys:
        row = await db.get(Setting, key)
        if row and row.value and row.value.strip():
            paths.append(row.value.strip())

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique_paths = [p for p in paths if not (p in seen or seen.add(p))]  # type: ignore[func-returns-value]

    if not unique_paths:
        raise HTTPException(400, "No media paths configured — add at least one in Settings")

    await start_scan(unique_paths)
    return {"status": "started"}


@router.get("/status")
async def scan_status():
    return get_scan_state()


@router.post("/stop")
async def stop_scan_endpoint():
    stop_scan()
    return {"status": "stopped"}
