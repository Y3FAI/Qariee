"""Qariee CLI - Manage Qariee CDN content."""

import typer
from rich.console import Console

from .commands.upload_audio import upload_audio
from .commands.add_reciter import add_reciter_cmd
from .commands.sync import sync
from .commands.list import list_cmd
from .commands.generate_db import generate_db

console = Console()

app = typer.Typer(
    name="qariee",
    help="CLI tool for managing Qariee CDN content",
    no_args_is_help=True,
    add_completion=False,
)


def upload_audio_cmd(reciter_id: str = typer.Argument(..., help="Reciter ID"),
                      base_url: str = typer.Argument(..., help="Base URL for MP3 files"),
                      start: int = typer.Option(1, "--start", "-s", help="Start surah number (1-114)"),
                      end: int = typer.Option(114, "--end", "-e", help="End surah number (1-114)"),
                      dry_run: bool = typer.Option(False, "--dry-run", "-n", help="Preview without uploading")):
    """Download and upload audio files for a reciter."""
    upload_audio(reciter_id, base_url, start=start, end=end, dry_run=dry_run)


app.command(name="upload-audio")(upload_audio_cmd)
app.command(name="add-reciter")(add_reciter_cmd)
app.command(name="sync")(sync)
app.command(name="list")(list_cmd)
app.command(name="generate-db")(generate_db)


@app.callback()
def main(version: bool = typer.Option(False, "--version", "-v", help="Show version")):
    """Qariee CLI - Manage Qariee CDN content."""
    if version:
        console.print("qariee-cli v1.0.0")
        raise typer.Exit()


if __name__ == "__main__":
    app()
