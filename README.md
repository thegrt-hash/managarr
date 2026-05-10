# Managarr

A self-hosted media library manager for Unraid (and any Docker host). Scans your Movies, TV Shows, Music, and Audiobooks for quality issues, duplicates, 4K files, missing subtitles, and more — with deep integrations for Sonarr, Radarr, Bazarr, and TMDB.

![Dashboard](https://img.shields.io/badge/stack-FastAPI%20%2B%20React-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **Library scanning** — recursively scans configured media pools using ffprobe for duration, resolution, codec, and embedded subtitle tracks
- **Composite scoring** — every folder gets a Good / Questionable / Needs Review score with a breakdown of reasons
- **Duplicate detection** — flags folders where two files share the same normalized title (same movie, different formats), not just any folder with multiple files
- **4K detection** — identifies 4K content in a library targeting 1080p
- **ISO detection** — surfaces `.iso` files for removal
- **Missing subtitles** — detects missing `.srt`/`.ass`/`.vtt` files and embedded subtitle tracks per file
- **Baseline snapshots** — take a snapshot of a folder's file state; get alerted when it changes
- **Bulk delete** — select and delete files directly from the UI (manually triggered, never automatic)
- **Sonarr integration** — validates episode counts per season against Sonarr's expected count
- **Radarr integration** — pulls movie runtime and TMDB ID directly from Radarr (no guessing from folder names)
- **Bazarr integration** — trigger subtitle searches for individual folders or all wanted titles
- **TMDB integration** — runtime validation for movies not matched by Radarr
- **First-run wizard** — step-by-step setup for each media pool and all integrations
- **Incremental scans** — files with unchanged modification times are skipped on re-scan
- **Dark theme UI** — React + Tailwind, designed for always-on dashboard use

---

## Screenshots

> Dashboard, Library, and Folder Detail views with scoring, flags, and file-level subtitle status.

---

## Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI + SQLAlchemy 2.0 async + aiosqlite (SQLite) |
| Frontend | React 18 + Vite + Tailwind CSS 3 + TanStack Query v5 |
| Media probing | ffprobe (bundled in Docker image) |
| Container | Multi-stage Docker build (Node 20 → Python 3.12 slim) |

---

## Quick Start (Docker)

```bash
docker run -d \
  --name managarr \
  --restart unless-stopped \
  -p 8765:8000 \
  -v /your/appdata/managarr:/data \
  -v /your/media:/media \
  -e DATA_DIR=/data \
  managarr:latest
```

Then open `http://<your-ip>:8765` and complete the setup wizard.

---

## Unraid Deployment

### 1. Clone the repo onto your Unraid server

```bash
ssh root@<unraid-ip>
cd /mnt/user/appdata
git clone https://github.com/TheGrt/managarr.git
```

### 2. Build the image

```bash
cd /mnt/user/appdata/managarr
docker build -t managarr:latest .
```

### 3. Start the container

```bash
docker run -d \
  --name managarr \
  --restart unless-stopped \
  -p 8765:8000 \
  -v /mnt/user/appdata/managarr/data:/data \
  -v /mnt/user/MainShare:/media \
  -e DATA_DIR=/data \
  managarr:latest
```

### 4. First-run wizard

Open `http://<unraid-ip>:8765` and configure your media pools:

| Pool | Container path | Example host path |
|---|---|---|
| Movies | `/media/Movie` | `/mnt/user/MainShare/Movie` |
| TV Shows | `/media/Shows` | `/mnt/user/MainShare/Shows` |
| Music | `/media/Music` | `/mnt/user/MainShare/Music` |
| Audiobooks | `/media/Audiobooks` | `/mnt/user/MainShare/Audiobooks` |

> **Note:** Use the container path (`/media/...`) in the wizard, not the host path.

### Updating

```bash
cd /mnt/user/appdata/managarr
git pull
docker build -t managarr:latest .
docker stop managarr && docker rm managarr
docker run -d --name managarr --restart unless-stopped \
  -p 8765:8000 \
  -v /mnt/user/appdata/managarr/data:/data \
  -v /mnt/user/MainShare:/media \
  -e DATA_DIR=/data \
  managarr:latest
```

Your database persists in `/mnt/user/appdata/managarr/data/`.

---

## Integrations

All configured in the Settings page or first-run wizard.

### Sonarr
Cross-references your TV library. Managarr matches season folders to Sonarr series by path, then validates episode file counts against Sonarr's expected count per season.

### Radarr
Pulls TMDB ID and runtime for every matched movie — no folder-name guessing needed. Also surfaces `has_file=false` warnings for movies Radarr expects but can't find on disk.

### Bazarr
Triggers subtitle searches from within Managarr:
- Per-folder search button on any folder with missing subtitles
- "Search All Wanted" button on the Integrations page

### TMDB
Used for runtime validation on movies not matched by Radarr. Free API key at [themoviedb.org](https://www.themoviedb.org/settings/api).

---

## Scoring

Each folder is scored 0–100 and labeled Good (≥80), Questionable (≥50), or Needs Review (<50).

| Condition | Penalty |
|---|---|
| ISO file present | −40 |
| Runtime mismatch vs TMDB | −25 |
| True duplicate files (same title) | −10 to −25 |
| Missing 50%+ of Sonarr episodes | −35 |
| Missing 20–49% of episodes | −20 |
| Missing <20% of episodes | −10 |
| 4K content (library targets 1080p) | −15 |
| Primary file below 1080p | −10 |
| Primary file SD | −20 |
| No subtitles on any file | −10 |
| Some files missing subtitles | −5 |
| Flat folder (multiple unrelated movies) | −5 |

---

## Folder Structure

Works best with standard Plex/Jellyfin layouts:

```
/media
├── Movie/
│   ├── The Matrix (1999)/
│   │   └── The.Matrix.1999.1080p.mkv
│   └── Inception (2010)/
│       └── Inception.2010.1080p.mkv
└── Shows/
    └── Breaking Bad/
        ├── Season 1/
        │   ├── S01E01.mkv
        │   └── S01E02.mkv
        └── Season 2/
```

Flat libraries (all movies in one folder) are supported — Managarr won't false-positive duplicate detection across different titles.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATA_DIR` | `/data` | Path inside the container where the SQLite database is stored |

---

## Ports

| Port | Service |
|---|---|
| 8765 (host) → 8000 (container) | Managarr web UI |

---

## License

MIT
