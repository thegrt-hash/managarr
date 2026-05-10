import re
import httpx
from typing import Optional


TMDB_BASE = "https://api.themoviedb.org/3"


def parse_movie_folder(name: str) -> tuple[str, Optional[int]]:
    """Extract title and year from folder like 'Movie Title (2023)'."""
    m = re.match(r"^(.+?)\s*\((\d{4})\)\s*$", name.strip())
    if m:
        return m.group(1).strip(), int(m.group(2))
    return name.strip(), None


def parse_tv_season_folder(path: str) -> tuple[Optional[str], Optional[int]]:
    """Extract show title from a path like '.../Show Name/Season 2'."""
    parts = path.rstrip("/").split("/")
    for i, part in enumerate(parts):
        if re.match(r"^[Ss]eason\s*\d+$", part) or re.match(r"^[Ss]\d{2}$", part):
            if i > 0:
                return parts[i - 1], None
    return None, None


async def search_movie(api_key: str, title: str, year: Optional[int] = None) -> Optional[dict]:
    params = {"api_key": api_key, "query": title, "include_adult": "false"}
    if year:
        params["year"] = str(year)
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{TMDB_BASE}/search/movie", params=params)
            r.raise_for_status()
            results = r.json().get("results", [])
            if not results:
                return None
            best = results[0]
            return {
                "tmdb_id": str(best["id"]),
                "title": best.get("title"),
                "year": int(best.get("release_date", "0")[:4]) if best.get("release_date") else None,
                "runtime_minutes": None,
            }
    except Exception:
        return None


async def get_movie_details(api_key: str, tmdb_id: str) -> Optional[dict]:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{TMDB_BASE}/movie/{tmdb_id}", params={"api_key": api_key})
            r.raise_for_status()
            d = r.json()
            return {
                "tmdb_id": str(d["id"]),
                "title": d.get("title"),
                "year": int(d.get("release_date", "0")[:4]) if d.get("release_date") else None,
                "runtime_minutes": d.get("runtime"),
            }
    except Exception:
        return None


async def search_tv(api_key: str, title: str) -> Optional[dict]:
    params = {"api_key": api_key, "query": title}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{TMDB_BASE}/search/tv", params=params)
            r.raise_for_status()
            results = r.json().get("results", [])
            if not results:
                return None
            best = results[0]
            return {
                "tmdb_id": str(best["id"]),
                "title": best.get("name"),
                "year": None,
                "runtime_minutes": None,
            }
    except Exception:
        return None


def runtime_match_label(actual_seconds: Optional[float], expected_minutes: Optional[int]) -> str:
    if actual_seconds is None or expected_minutes is None or expected_minutes == 0:
        return "unknown"
    actual_minutes = actual_seconds / 60
    diff_pct = abs(actual_minutes - expected_minutes) / expected_minutes
    if diff_pct <= 0.05:
        return "good"
    if diff_pct <= 0.15:
        return "acceptable"
    return "mismatch"
