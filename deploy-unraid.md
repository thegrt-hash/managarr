# Managarr — Unraid Deployment Guide

## Option A: Docker Compose (Recommended)

### 1. Copy the project to your Unraid server

```bash
# On your local machine:
scp -r managarr/ root@<unraid-ip>:/mnt/user/appdata/managarr
```

### 2. Edit docker-compose.yml

Open `/mnt/user/appdata/managarr/docker-compose.yml` and update the media volume:

```yaml
volumes:
  - /mnt/user/appdata/managarr/data:/data
  - /mnt/user/media:/media:ro    # ← change to your actual share path
```

If you need Managarr to delete files (not just scan), remove `:ro`.

### 3. Build and start

```bash
cd /mnt/user/appdata/managarr
docker compose up -d --build
```

The app will be available at `http://<unraid-ip>:8765`.

---

## Option B: Unraid Community Applications (Manual Docker)

In Unraid → Docker → Add Container:

| Field | Value |
|---|---|
| Name | managarr |
| Repository | managarr:latest (after building below) |
| Network Type | Bridge |
| Port | 8765 → 8000 |
| Path `/data` | `/mnt/user/appdata/managarr/data` |
| Path `/media` | `/mnt/user/media` (your media share, Read Only) |
| Variable `DATA_DIR` | `/data` |

**Build the image first** (SSH into Unraid):
```bash
cd /mnt/user/appdata/managarr
docker build -t managarr:latest .
```

---

## Media Volume Mapping

| Your Unraid Path | Container Path | Notes |
|---|---|---|
| `/mnt/user/media` | `/media` | Top-level media folder |
| `/mnt/user/appdata/managarr/data` | `/data` | Database + config (persistent) |

When configuring the app's **Media Root Path** in Settings, use `/media` (the container path).

---

## Folder Structure Expected

Managarr works best with standard Plex/Jellyfin layouts:

```
/media
├── Movies/
│   ├── The Matrix (1999)/
│   │   └── The.Matrix.1999.1080p.mkv
│   └── Inception (2010)/
│       ├── Inception.2010.1080p.mkv        ← kept
│       └── Inception.2010.2160p.mkv        ← flagged as duplicate/4K
└── TV Shows/
    └── Breaking Bad/
        ├── Season 1/
        │   ├── S01E01.mkv
        │   └── S01E02.mkv
        └── Season 2/
```

---

## First-Run Setup

1. Open `http://<unraid-ip>:8765`
2. Complete the 5-step wizard:
   - **Media Root**: `/media` (container path, not host path)
   - **TMDB API Key**: free at themoviedb.org → Settings → API
   - **Sonarr**: `http://<unraid-ip>:8989` + your API key from Sonarr → Settings → General
   - **Radarr**: `http://<unraid-ip>:7878` + your API key from Radarr → Settings → General
3. Click **Scan Library** on the Dashboard

> **Note on Sonarr/Radarr URLs**: Use your actual host IP (not `localhost`) since Managarr runs in its own container. If they're on the same Docker bridge network, you can use `http://sonarr:8989` instead.

---

## Scanning a Large Library

- FFprobe probes every video file for duration/resolution/codec
- Expect ~1-5 seconds per file depending on disk speed
- A 10,000 file library = ~8-14 hours on spinning HDD, ~2-4 hours on SSD
- Scanning is incremental — files with unchanged modification time are skipped on re-scans
- You can stop and resume a scan at any time

---

## Updating

```bash
cd /mnt/user/appdata/managarr
git pull   # if cloned from git
docker compose up -d --build
```

---

## Ports

| Port | Service |
|---|---|
| 8765 | Managarr web UI |

---

## Troubleshooting

**Can't delete files** — If the media volume was mounted read-only (`:ro`), remove that flag and recreate the container.

**TMDB not finding movies** — Folder names must include the year: `Movie Name (2023)`. TMDB search works best with the exact title.

**Sonarr/Radarr connection refused** — Use the host machine IP address, not `localhost` or `127.0.0.1`, when calling from inside a container.

**Scan stuck** — Open the dashboard; if progress is frozen for >10 min, click Stop Scan and restart. The next scan will skip already-probed files.
