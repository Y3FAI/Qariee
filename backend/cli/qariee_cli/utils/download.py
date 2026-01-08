"""Download utilities with retry support."""

import tempfile
import time
from pathlib import Path

import httpx
from rich.console import Console

console = Console()

MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds


def download_file(url: str, dest: Path, timeout: float = 60.0) -> bool:
    """
    Download a file with retry support.

    Returns True if successful, False otherwise.
    """
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with httpx.stream("GET", url, timeout=timeout, follow_redirects=True) as response:
                if response.status_code == 404:
                    return False
                response.raise_for_status()

                dest.parent.mkdir(parents=True, exist_ok=True)
                with open(dest, "wb") as f:
                    for chunk in response.iter_bytes(chunk_size=8192):
                        f.write(chunk)
                return True

        except (httpx.HTTPError, httpx.TimeoutException) as e:
            if attempt < MAX_RETRIES:
                console.print(f"  [yellow]Retry {attempt}/{MAX_RETRIES}: {e}[/yellow]")
                time.sleep(RETRY_DELAY)
            else:
                console.print(f"  [red]Failed after {MAX_RETRIES} attempts: {e}[/red]")
                return False

    return False


def check_url_exists(url: str, timeout: float = 10.0) -> bool:
    """Check if a URL exists (returns 200)."""
    try:
        response = httpx.head(url, timeout=timeout, follow_redirects=True)
        return response.status_code == 200
    except (httpx.HTTPError, httpx.TimeoutException):
        return False


def create_temp_dir() -> Path:
    """Create a temporary directory for downloads."""
    return Path(tempfile.mkdtemp(prefix="qariee-"))
