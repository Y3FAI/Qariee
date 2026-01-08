"""Path utilities for the CLI."""

from pathlib import Path

# CLI root directory
CLI_DIR = Path(__file__).parent.parent.parent

# Backend directory (parent of cli/)
BACKEND_DIR = CLI_DIR.parent

# R2 local mirror directory
R2_DIR = BACKEND_DIR / "r2"

# Metadata directory
METADATA_DIR = R2_DIR / "metadata"

# Images directory
IMAGES_DIR = R2_DIR / "images" / "reciters"

# db.json path
DB_JSON_PATH = METADATA_DIR / "db.json"

# App directory
APP_DIR = BACKEND_DIR.parent / "app"

# App assets directory
APP_ASSETS_DIR = APP_DIR / "assets" / "data"
