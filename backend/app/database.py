from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text,
    ForeignKey, BigInteger, event
)
from datetime import datetime
import os

DATABASE_URL = f"sqlite+aiosqlite:///{os.environ.get('DATA_DIR', '/data')}/managarr.db"

# timeout=30: wait up to 30s for a lock instead of failing immediately
engine = create_async_engine(DATABASE_URL, echo=False, connect_args={"timeout": 30})
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@event.listens_for(engine.sync_engine, "connect")
def _set_sqlite_pragmas(dbapi_conn, _):
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL")   # concurrent reads + single writer
    cur.execute("PRAGMA synchronous=NORMAL")  # safe but faster than FULL
    cur.close()


class Base(DeclarativeBase):
    pass


class Setting(Base):
    __tablename__ = "settings"
    key = Column(String, primary_key=True)
    value = Column(Text, nullable=True)


class ScanJob(Base):
    __tablename__ = "scan_jobs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String, default="running")  # running, completed, failed, stopped
    total_folders = Column(Integer, default=0)
    scanned_folders = Column(Integer, default=0)
    current_path = Column(Text, nullable=True)
    errors = Column(Text, nullable=True)


class MediaFolder(Base):
    __tablename__ = "media_folders"
    id = Column(Integer, primary_key=True, autoincrement=True)
    path = Column(Text, unique=True, nullable=False)
    name = Column(String, nullable=False)
    parent_path = Column(Text, nullable=True)
    folder_type = Column(String, default="unknown")  # movie, tv_season, unknown
    score = Column(Float, default=0.0)
    score_label = Column(String, default="needs_review")  # good, questionable, needs_review
    score_reasons = Column(Text, nullable=True)  # JSON list
    has_duplicates = Column(Boolean, default=False)
    has_iso = Column(Boolean, default=False)
    has_4k = Column(Boolean, default=False)
    missing_subtitles = Column(Boolean, default=False)
    video_count = Column(Integer, default=0)
    total_size_bytes = Column(BigInteger, default=0)
    tmdb_id = Column(String, nullable=True)
    tmdb_title = Column(String, nullable=True)
    tmdb_runtime_minutes = Column(Integer, nullable=True)
    tmdb_year = Column(Integer, nullable=True)
    last_scanned = Column(DateTime, nullable=True)
    baseline_state = Column(Text, nullable=True)  # JSON of {filename: size} snapshot
    baseline_set_at = Column(DateTime, nullable=True)
    baseline_changed = Column(Boolean, default=False)
    sonarr_series_id = Column(Integer, nullable=True)
    sonarr_season_number = Column(Integer, nullable=True)
    sonarr_expected_episodes = Column(Integer, nullable=True)
    sonarr_actual_episodes = Column(Integer, nullable=True)
    radarr_movie_id = Column(Integer, nullable=True)
    radarr_has_file = Column(Boolean, nullable=True)  # None = not tracked, True/False = Radarr's has_file
    files = relationship("MediaFile", back_populates="folder", cascade="all, delete-orphan")


class MediaFile(Base):
    __tablename__ = "media_files"
    id = Column(Integer, primary_key=True, autoincrement=True)
    folder_id = Column(Integer, ForeignKey("media_folders.id", ondelete="CASCADE"))
    path = Column(Text, unique=True, nullable=False)
    filename = Column(String, nullable=False)
    extension = Column(String, nullable=False)
    size_bytes = Column(BigInteger, default=0)
    duration_seconds = Column(Float, nullable=True)
    resolution_width = Column(Integer, nullable=True)
    resolution_height = Column(Integer, nullable=True)
    video_codec = Column(String, nullable=True)
    audio_codec = Column(String, nullable=True)
    is_4k = Column(Boolean, default=False)
    is_iso = Column(Boolean, default=False)
    quality_label = Column(String, nullable=True)  # 4K, 1080p, 720p, 480p, SD
    runtime_match = Column(String, nullable=True)  # good, acceptable, mismatch, unknown
    has_subtitles = Column(Boolean, nullable=True)
    subtitle_languages = Column(Text, nullable=True)   # JSON list e.g. ["en", "fr"]
    embedded_subtitle_count = Column(Integer, default=0)
    last_modified = Column(DateTime, nullable=True)
    last_scanned = Column(DateTime, nullable=True)
    folder = relationship("MediaFolder", back_populates="files")


class SonarrSeries(Base):
    __tablename__ = "sonarr_series"
    id = Column(Integer, primary_key=True)
    title = Column(String)
    tvdb_id = Column(Integer, nullable=True)
    tmdb_id = Column(Integer, nullable=True)
    path = Column(Text, nullable=True)
    status = Column(String, nullable=True)
    episode_count = Column(Integer, default=0)
    episode_file_count = Column(Integer, default=0)
    seasons = Column(Text, nullable=True)  # JSON [{seasonNumber, episodeCount, episodeFileCount}]


class RadarrMovie(Base):
    __tablename__ = "radarr_movies"
    id = Column(Integer, primary_key=True)
    title = Column(String)
    tmdb_id = Column(Integer, nullable=True)
    path = Column(Text, nullable=True)
    status = Column(String, nullable=True)
    has_file = Column(Boolean, default=False)
    runtime = Column(Integer, nullable=True)  # minutes from Radarr
    year = Column(Integer, nullable=True)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
