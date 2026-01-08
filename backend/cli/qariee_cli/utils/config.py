"""Configuration constants."""

from .db_json import read_db_json

# Default CDN URL (fallback if not in db.json)
CDN_BASE_URL = "https://qariee-storage.y3f.me"


def get_cdn_base_url() -> str:
    """Get CDN base URL from db.json settings."""
    try:
        data = read_db_json()
        return data.get("settings", {}).get("cdn_base_url", CDN_BASE_URL)
    except Exception:
        return CDN_BASE_URL
