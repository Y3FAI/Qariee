"""Verify all reciter images and audio files on CDN."""

import concurrent.futures
from pathlib import Path

import requests
import typer
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn
from rich.table import Table

from ..utils.db_json import read_db_json
from ..utils.config import get_cdn_base_url

console = Console()


def check_url(url: str, timeout: int = 5) -> tuple[bool, int]:
    """Check if a URL exists. Returns (exists, status_code)."""
    try:
        response = requests.head(url, timeout=timeout, allow_redirects=True)
        return response.status_code == 200, response.status_code
    except requests.RequestException:
        return False, None


def verify(
    max_workers: int = typer.Option(10, "--concurrent", "-c", help="Number of concurrent requests"),
    timeout: int = typer.Option(5, "--timeout", "-t", help="Request timeout in seconds"),
):
    """
    Verify all reciter images and audio files on the CDN.

    Checks:
    - All reciter images exist
    - All 114 surah MP3s exist for each reciter
    """
    import typer

    db_data = read_db_json()
    reciters = db_data.get("reciters", [])

    if not reciters:
        console.print("[yellow]No reciters found in db.json[/yellow]")
        return

    cdn_url = get_cdn_base_url()
    console.print(f"\n[bold]Verifying {len(reciters)} reciters on CDN[/bold]")
    console.print(f"CDN: {cdn_url}\n")

    # Check images first
    console.print("[bold]Checking reciter images...[/bold]")

    image_results = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("Images", total=len(reciters))

        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_reciter = {
                executor.submit(
                    check_url,
                    f"{cdn_url}/images/reciters/{r['id']}.jpg",
                    timeout,
                ): r
                for r in reciters
            }

            for future in concurrent.futures.as_completed(future_to_reciter):
                reciter = future_to_reciter[future]
                reciter_id = reciter["id"]
                try:
                    exists, status_code = future.result()
                    image_results.append((reciter_id, exists, status_code))
                except Exception as e:
                    image_results.append((reciter_id, False, None))
                    console.print(f"  [red]Error checking {reciter_id}: {e}[/red]")

                progress.advance(task)

    # Print image results table
    console.print("\n[bold]Image Results:[/bold]")
    image_table = Table(show_header=True, header_style="bold")
    image_table.add_column("Reciter ID", style="cyan")
    image_table.add_column("Status")
    image_table.add_column("HTTP Code")

    missing_images = 0
    for reciter_id, exists, status_code in image_results:
        if exists:
            image_table.add_row(reciter_id, "[green]✅ OK[/green]", str(status_code))
        else:
            image_table.add_row(reciter_id, "[red]❌ Missing[/red]", str(status_code) if status_code else "N/A")
            missing_images += 1

    console.print(image_table)

    if missing_images > 0:
        console.print(f"\n[red]{missing_images} reciter images are missing![/red]")
        console.print("Run [cyan]qariee sync[/cyan] to upload missing images.")
    else:
        console.print(f"\n[green]All {len(reciters)} reciter images are present![/green]")

    # Check audio files
    console.print(f"\n[bold]Checking audio files (114 surahs × {len(reciters)} reciters = {114 * len(reciters)} files)...[/bold]")

    audio_results = {}  # reciter_id -> (present_count, missing_surahs)

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        console=console,
    ) as progress:
        total_surahs = len(reciters) * 114
        task = progress.add_task("Audio", total=total_surahs)

        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_surah = {}
            for reciter in reciters:
                reciter_id = reciter["id"]
                for surah_num in range(1, 115):
                    url = f"{cdn_url}/audio/{reciter_id}/{surah_num:03d}.mp3"
                    future = executor.submit(check_url, url, timeout)
                    future_to_surah[future] = (reciter_id, surah_num)

            for future in concurrent.futures.as_completed(future_to_surah):
                reciter_id, surah_num = future_to_surah[future]
                try:
                    exists, _ = future.result()
                    if reciter_id not in audio_results:
                        audio_results[reciter_id] = [0, []]
                    if exists:
                        audio_results[reciter_id][0] += 1
                    else:
                        audio_results[reciter_id][1].append(surah_num)
                except Exception:
                    if reciter_id not in audio_results:
                        audio_results[reciter_id] = [0, []]
                    audio_results[reciter_id][1].append(surah_num)

                progress.advance(task)

    # Print audio results table
    console.print("\n[bold]Audio Results:[/bold]")
    audio_table = Table(show_header=True, header_style="bold")
    audio_table.add_column("Reciter ID", style="cyan")
    audio_table.add_column("Surahs Present", style="green")
    audio_table.add_column("Missing", style="red")

    reciters_with_missing = 0
    total_missing = 0

    for reciter in reciters:
        reciter_id = reciter["id"]
        if reciter_id in audio_results:
            present, missing = audio_results[reciter_id]
        else:
            present, missing = 0, list(range(1, 115))

        if missing:
            reciters_with_missing += 1
            total_missing += len(missing)
            missing_str = f"{len(missing)} ({missing[0]}..." if len(missing) > 3 else str(missing)
            audio_table.add_row(reciter_id, f"{present}/114", f"[red]{missing_str}[/red]")
        else:
            audio_table.add_row(reciter_id, "[green]114/114[/green]", "[green]✅ Complete[/green]")

    console.print(audio_table)

    # Summary
    console.print(f"\n[bold]Summary:[/bold]")
    console.print(f"  Images: {len(reciters) - missing_images}/{len(reciters)} present")
    console.print(f"  Audio: {len(reciters) - reciters_with_missing}/{len(reciters)} reciters complete")

    if total_missing > 0:
        console.print(f"\n[red]Total missing audio files: {total_missing}[/red]")
        console.print("Use [cyan]qariee upload-audio <reciter-id> <url>[/cyan] to upload missing audio.")
        raise typer.Exit(1)
    else:
        console.print("\n[green]All reciters have complete audio sets![/green]")
