import httpx


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


async def fetch_movies(url: str, api_key: str) -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(
                f"{url.rstrip('/')}/api/v3/movie",
                headers={"X-Api-Key": api_key},
            )
            r.raise_for_status()
            movies = r.json()
            return [
                {
                    "id": m["id"],
                    "title": m.get("title", ""),
                    "tmdb_id": m.get("tmdbId"),
                    "path": m.get("path"),
                    "status": m.get("status"),
                    "has_file": m.get("hasFile", False),
                    "runtime": m.get("runtime"),
                    "year": m.get("year"),
                }
                for m in movies
            ]
    except Exception:
        return []
