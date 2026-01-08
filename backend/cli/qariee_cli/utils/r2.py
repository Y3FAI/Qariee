"""Cloudflare R2 utilities using wrangler CLI."""

import subprocess
import shutil
from pathlib import Path

from rich.console import Console

console = Console()

BUCKET_NAME = "qariee"


def check_wrangler_installed() -> bool:
    """Check if wrangler CLI is installed."""
    return shutil.which("wrangler") is not None


def upload_to_r2(local_path: Path, remote_path: str) -> bool:
    """
    Upload a file to R2 bucket.

    Args:
        local_path: Local file path
        remote_path: Remote path in bucket (e.g., "audio/hussary/001.mp3")

    Returns True if successful.
    """
    if not check_wrangler_installed():
        console.print("[red]Error: wrangler CLI is not installed[/red]")
        console.print("Install with: npm install -g wrangler")
        return False

    try:
        result = subprocess.run(
            ["wrangler", "r2", "object", "put", f"{BUCKET_NAME}/{remote_path}", "--file", str(local_path)],
            capture_output=True,
            text=True,
        )
        return result.returncode == 0
    except subprocess.SubprocessError as e:
        console.print(f"[red]Upload error: {e}[/red]")
        return False


def upload_directory(local_dir: Path, remote_prefix: str = "") -> tuple[int, int]:
    """
    Upload all files in a directory to R2.

    Returns (success_count, failure_count).
    """
    success = 0
    failure = 0

    for file_path in local_dir.rglob("*"):
        if file_path.is_file() and file_path.name != ".DS_Store":
            relative = file_path.relative_to(local_dir)
            remote_path = f"{remote_prefix}/{relative}" if remote_prefix else str(relative)

            if upload_to_r2(file_path, remote_path):
                success += 1
            else:
                failure += 1

    return success, failure


def list_r2_objects(prefix: str = "") -> list[str]:
    """List objects in R2 bucket with given prefix."""
    if not check_wrangler_installed():
        return []

    try:
        result = subprocess.run(
            ["wrangler", "r2", "object", "list", BUCKET_NAME, "--prefix", prefix],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            # Parse output - wrangler returns JSON-like output
            return result.stdout.strip().split("\n")
        return []
    except subprocess.SubprocessError:
        return []
