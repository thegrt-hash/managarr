import httpx
from typing import Optional


async def test_connection(url: str, api_key: str) -> tuple[bool, str]:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{url.rstrip('/')}/api/system/status",
                headers={"X-API-KEY": api_key},
            )
            r.raise_for_status()
            data = r.json()
            version = data.get("data", {}).get("bazarr_version", "unknown")
            return True, version
    except httpx.HTTPStatusError as e:
        return False, f"HTTP {e.response.status_code}"
    except Exception as e:
        return False, str(e)


async def search_movie_subtitles(
    url: str, api_key: str, radarr_id: int, languages: list[str]
) -> tuple[bool, str]:
    """Trigger Bazarr to search for subtitles for a specific movie."""
    base = url.rstrip("/")
    headers = {"X-API-KEY": api_key}
    errors = []
    ok_count = 0

    async with httpx.AsyncClient(timeout=30) as client:
        for lang in languages:
            try:
                r = await client.post(
                    f"{base}/api/providers/movies",
                    headers=headers,
                    json={"radarr_id": radarr_id, "hi": False, "forced": False, "language": lang},
                )
                r.raise_for_status()
                ok_count += 1
            except Exception as e:
                errors.append(f"{lang}: {e}")

    if ok_count:
        return True, f"Search triggered for {ok_count} language(s)"
    return False, "; ".join(errors)


async def search_episode_subtitles(
    url: str, api_key: str, sonarr_series_id: int, sonarr_episode_id: int, languages: list[str]
) -> tuple[bool, str]:
    """Trigger Bazarr to search subtitles for a specific episode."""
    base = url.rstrip("/")
    headers = {"X-API-KEY": api_key}
    errors = []
    ok_count = 0

    async with httpx.AsyncClient(timeout=30) as client:
        for lang in languages:
            try:
                r = await client.post(
                    f"{base}/api/providers/episodes",
                    headers=headers,
                    json={
                        "sonarr_series_id": sonarr_series_id,
                        "sonarr_episode_id": sonarr_episode_id,
                        "hi": False,
                        "forced": False,
                        "language": lang,
                    },
                )
                r.raise_for_status()
                ok_count += 1
            except Exception as e:
                errors.append(f"{lang}: {e}")

    if ok_count:
        return True, f"Search triggered for {ok_count} language(s)"
    return False, "; ".join(errors)


async def search_wanted_movies(url: str, api_key: str) -> tuple[bool, str]:
    """Tell Bazarr to search all movies that are flagged as wanting subtitles."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{url.rstrip('/')}/api/wanted/movies",
                headers={"X-API-KEY": api_key},
                params={"action": "search"},
            )
            r.raise_for_status()
            return True, "Wanted movies search queued"
    except Exception as e:
        return False, str(e)


async def search_wanted_episodes(url: str, api_key: str) -> tuple[bool, str]:
    """Tell Bazarr to search all episodes that are flagged as wanting subtitles."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{url.rstrip('/')}/api/wanted/episodes",
                headers={"X-API-KEY": api_key},
                params={"action": "search"},
            )
            r.raise_for_status()
            return True, "Wanted episodes search queued"
    except Exception as e:
        return False, str(e)


async def get_movie_subtitle_status(
    url: str, api_key: str, radarr_id: int
) -> Optional[dict]:
    """Get Bazarr's view of subtitle status for a movie."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{url.rstrip('/')}/api/movies",
                headers={"X-API-KEY": api_key},
                params={"radarr_id[]": radarr_id},
            )
            r.raise_for_status()
            data = r.json()
            items = data.get("data", [])
            return items[0] if items else None
    except Exception:
        return None


async def get_episodes_for_series(
    sonarr_url: str, sonarr_key: str, series_id: int
) -> list[dict]:
    """Fetch episode list + sonarr_episode_id from Sonarr for TV subtitle search."""
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(
                f"{sonarr_url.rstrip('/')}/api/v3/episode",
                headers={"X-Api-Key": sonarr_key},
                params={"seriesId": series_id},
            )
            r.raise_for_status()
            return [
                {"episode_id": ep["id"], "season": ep["seasonNumber"],
                 "episode": ep["episodeNumber"], "has_file": ep.get("hasFile", False)}
                for ep in r.json()
            ]
    except Exception:
        return []
