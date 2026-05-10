import asyncio
import json
import os
from typing import Optional


VIDEO_EXTENSIONS = {".mp4", ".mkv", ".avi", ".m4v", ".mov", ".ts", ".m2ts",
                    ".wmv", ".flv", ".webm", ".mpg", ".mpeg", ".divx", ".xvid"}
ISO_EXTENSIONS = {".iso"}
ALL_VIDEO = VIDEO_EXTENSIONS | ISO_EXTENSIONS


def quality_label(width: Optional[int], height: Optional[int]) -> str:
    if not width or not height:
        return "Unknown"
    if width >= 3840 or height >= 2160:
        return "4K"
    if width >= 1920 or height >= 1080:
        return "1080p"
    if width >= 1280 or height >= 720:
        return "720p"
    if width >= 720 or height >= 480:
        return "480p"
    return "SD"


def is_4k(width: Optional[int], height: Optional[int]) -> bool:
    if not width or not height:
        return False
    return width >= 3840 or height >= 2160


async def probe_file(file_path: str) -> dict:
    """Run ffprobe on a file and return parsed metadata."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffprobe", "-v", "quiet",
            "-print_format", "json",
            "-show_streams", "-show_format",
            file_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=60)
        data = json.loads(stdout)
    except (asyncio.TimeoutError, Exception):
        return {}

    result = {
        "duration_seconds": None,
        "resolution_width": None,
        "resolution_height": None,
        "video_codec": None,
        "audio_codec": None,
        "is_4k": False,
        "quality_label": "Unknown",
        "embedded_subtitle_count": 0,
        "embedded_subtitle_languages": [],
    }

    fmt = data.get("format", {})
    duration = fmt.get("duration")
    if duration:
        try:
            result["duration_seconds"] = float(duration)
        except (ValueError, TypeError):
            pass

    for stream in data.get("streams", []):
        codec_type = stream.get("codec_type")
        if codec_type == "video" and result["video_codec"] is None:
            result["video_codec"] = stream.get("codec_name")
            w = stream.get("width")
            h = stream.get("height")
            if w and h:
                result["resolution_width"] = w
                result["resolution_height"] = h
                result["is_4k"] = is_4k(w, h)
                result["quality_label"] = quality_label(w, h)
        elif codec_type == "audio" and result["audio_codec"] is None:
            result["audio_codec"] = stream.get("codec_name")
        elif codec_type == "subtitle":
            result["embedded_subtitle_count"] += 1
            lang = stream.get("tags", {}).get("language")
            if lang:
                result["embedded_subtitle_languages"].append(lang)

    return result


def parse_filename_quality(filename: str) -> dict:
    """Extract quality hints from filename when ffprobe isn't available."""
    name = filename.upper()
    result = {"quality_hint": None, "is_4k_hint": False}
    if any(x in name for x in ["2160P", "4K", "UHD"]):
        result["quality_hint"] = "4K"
        result["is_4k_hint"] = True
    elif "1080P" in name or "1080I" in name:
        result["quality_hint"] = "1080p"
    elif "720P" in name or "720I" in name:
        result["quality_hint"] = "720p"
    elif "480P" in name:
        result["quality_hint"] = "480p"
    return result


def format_size(size_bytes: int) -> str:
    if size_bytes >= 1_000_000_000:
        return f"{size_bytes / 1_000_000_000:.2f} GB"
    if size_bytes >= 1_000_000:
        return f"{size_bytes / 1_000_000:.1f} MB"
    return f"{size_bytes / 1_000:.0f} KB"
