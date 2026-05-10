import httpx
from typing import Optional


async def test_connection(url: str, api_key: str) -> tuple[bool, str]:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{url.rstrip('/')}/api/v3/system/status",
                headers={"X-Api-Key": api_key},
            )
            r.raise_for_status()
            return True, r.json().get("version", "unknown")
    except httpx.HTTPStatusError as e:
        return False, f"HTTP {e.response.status_code}"
    except Exception as e:
        return False, str(e)


async def fetch_series(url: str, api_key: str) -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(
                f"{url.rstrip('/')}/api/v3/series",
                headers={"X-Api-Key": api_key},
            )
            r.raise_for_status()
            series_list = r.json()
            result = []
            for s in series_list:
                seasons = [
                    {
                        "seasonNumber": season.get("seasonNumber"),
                        "episodeCount": season.get("statistics", {}).get("totalEpisodeCount", 0),
                        "episodeFileCount": season.get("statistics", {}).get("episodeFileCount", 0),
                    }
                    for season in s.get("seasons", [])
                ]
                result.append({
                    "id": s["id"],
                    "title": s.get("title", ""),
                    "tvdb_id": s.get("tvdbId"),
                    "tmdb_id": s.get("tmdbId"),
                    "path": s.get("path"),
                    "status": s.get("status"),
                    "episode_count": s.get("statistics", {}).get("totalEpisodeCount", 0),
                    "episode_file_count": s.get("statistics", {}).get("episodeFileCount", 0),
                    "seasons": seasons,
                })
            return result
    except Exception:
        return []
