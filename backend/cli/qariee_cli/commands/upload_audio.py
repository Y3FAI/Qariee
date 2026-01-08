"""Upload audio files for a reciter."""

import shutil
from pathlib import Path

import typer
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn

from ..utils.download import download_file, create_temp_dir
from ..utils.r2 import upload_to_r2, check_wrangler_installed
from ..utils.db_json import get_reciter

console = Console()

TOTAL_SURAHS = 114


def upload_audio(
    reciter_id: str = typer.Argument(..., help="Reciter ID (e.g., 'hussary')"),
    base_url: str = typer.Argument(..., help="Base URL for MP3 files (e.g., 'https://server13.mp3quran.net/husr')"),
    start: int = typer.Option(1, "--start", "-s", help="Start surah number (1-114)"),
    end: int = typer.Option(114, "--end", "-e", help="End surah number (1-114)"),
    dry_run: bool = typer.Option(False, "--dry-run", "-n", help="Preview without uploading"),
):
    """
    Download and upload audio files for a reciter.

    Example:
        qariee upload-audio hussary https://server13.mp3quran.net/husr
        qariee upload-audio hussary https://server13.mp3quran.net/husr --start 1 --end 10
    """
    # Validate reciter exists
    reciter = get_reciter(reciter_id)
    if not reciter:
        console.print(f"[yellow]Warning: Reciter '{reciter_id}' not found in db.json[/yellow]")
        console.print("Consider running 'qariee add-reciter' first")
        if not typer.confirm("Continue anyway?"):
            raise typer.Exit(1)

    # Validate surah range
    if not (1 <= start <= 114 and 1 <= end <= 114 and start <= end):
        console.print("[red]Error: Invalid surah range. Must be 1-114.[/red]")
        raise typer.Exit(1)

    # Check wrangler
    if not dry_run and not check_wrangler_installed():
        console.print("[red]Error: wrangler CLI is not installed[/red]")
        console.print("Install with: npm install -g wrangler")
        raise typer.Exit(1)

    console.print(f"\n[bold]Uploading audio for: {reciter_id}[/bold]")
    console.print(f"Source: {base_url}")
    console.print(f"Surahs: {start} to {end} ({end - start + 1} files)\n")

    if dry_run:
        console.print("[yellow]DRY RUN - No files will be uploaded[/yellow]\n")

    # Create temp directory
    temp_dir = create_temp_dir()
    console.print(f"Temp directory: {temp_dir}\n")

    success_count = 0
    fail_count = 0
    skipped_count = 0

    try:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            console=console,
        ) as progress:
            task = progress.add_task("Processing surahs...", total=end - start + 1)

            for surah_num in range(start, end + 1):
                surah_str = f"{surah_num:03d}"
                source_url = f"{base_url}/{surah_str}.mp3"
                remote_path = f"audio/{reciter_id}/{surah_str}.mp3"
                local_file = temp_dir / f"{surah_str}.mp3"

                progress.update(task, description=f"Surah {surah_str}")

                if dry_run:
                    console.print(f"  [dim]Would upload: {source_url} -> {remote_path}[/dim]")
                    success_count += 1
                else:
                    # Download
                    if download_file(source_url, local_file):
                        # Upload to R2
                        if upload_to_r2(local_file, remote_path):
                            console.print(f"  [green]Surah {surah_str}[/green]")
                            success_count += 1
                        else:
                            console.print(f"  [red]Surah {surah_str} - Upload failed[/red]")
                            fail_count += 1
                        # Clean up local file
                        local_file.unlink(missing_ok=True)
                    else:
                        console.print(f"  [red]Surah {surah_str} - Download failed (404?)[/red]")
                        fail_count += 1

                progress.advance(task)

    finally:
        # Clean up temp directory
        shutil.rmtree(temp_dir, ignore_errors=True)

    # Summary
    console.print(f"\n[bold]Summary:[/bold]")
    console.print(f"  [green]Success: {success_count}[/green]")
    if fail_count:
        console.print(f"  [red]Failed: {fail_count}[/red]")
    if skipped_count:
        console.print(f"  [yellow]Skipped: {skipped_count}[/yellow]")

    if fail_count > 0:
        raise typer.Exit(1)
