"""Utilities for reading and writing db.json."""

import json
from typing import TypedDict
from .paths import DB_JSON_PATH


class Reciter(TypedDict):
    id: str
    name_en: str
    name_ar: str
    color_primary: str
    color_secondary: str


class Settings(TypedDict):
    cdn_base_url: str
    app_name: str
    support_email: str
    app_version: str
    min_app_version: str


class DbJson(TypedDict):
    version: str
    settings: Settings
    reciters: list[Reciter]


def read_db_json() -> DbJson:
    """Read and parse db.json."""
    with open(DB_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def write_db_json(data: DbJson) -> None:
    """Write db.json with proper formatting."""
    with open(DB_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def get_reciter(reciter_id: str) -> Reciter | None:
    """Get a reciter by ID."""
    data = read_db_json()
    for reciter in data["reciters"]:
        if reciter["id"] == reciter_id:
            return reciter
    return None


def add_reciter(reciter: Reciter) -> None:
    """Add a new reciter to db.json."""
    data = read_db_json()

    # Check if reciter already exists
    for existing in data["reciters"]:
        if existing["id"] == reciter["id"]:
            raise ValueError(f"Reciter with ID '{reciter['id']}' already exists")

    data["reciters"].append(reciter)

    # Increment version
    data["version"] = increment_version(data["version"])

    write_db_json(data)


def increment_version(version: str) -> str:
    """Increment the patch version (1.0.0 -> 1.0.1)."""
    parts = version.split(".")
    parts[-1] = str(int(parts[-1]) + 1)
    return ".".join(parts)


def list_reciters() -> list[Reciter]:
    """Get all reciters."""
    data = read_db_json()
    return data["reciters"]
