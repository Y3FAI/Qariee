"""Sync local r2/ directory to Cloudflare R2."""

import typer
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

from ..utils.r2 import upload_to_r2, check_wrangler_installed
from ..utils.paths import R2_DIR

console = Console()


def sync(
    dry_run: bool = typer.Option(False, "--dry-run", "-n", help="Preview without uploading"),
):
    """
    Sync local r2/ directory to Cloudflare R2.

    This uploads metadata (db.json) and reciter images to the CDN.
    """
    if not check_wrangler_installed():
        console.print("[red]Error: wrangler CLI is not installed[/red]")
        console.print("Install with: npm install -g wrangler")
        raise typer.Exit(1)

    if not R2_DIR.exists():
        console.print(f"[red]Error: R2 directory not found: {R2_DIR}[/red]")
        raise typer.Exit(1)

    # Collect files to upload
    files_to_upload = []
    for file_path in R2_DIR.rglob("*"):
        if file_path.is_file() and file_path.name != ".DS_Store":
            relative = file_path.relative_to(R2_DIR)
            files_to_upload.append((file_path, str(relative)))

    if not files_to_upload:
        console.print("[yellow]No files to upload[/yellow]")
        return

    console.print(f"\n[bold]Files to sync ({len(files_to_upload)}):[/bold]")
    for local, remote in files_to_upload:
        console.print(f"  {remote}")

    if dry_run:
        console.print("\n[yellow]DRY RUN - No files uploaded[/yellow]")
        return

    console.print()

    if not typer.confirm("Proceed with upload?"):
        raise typer.Exit(0)

    success_count = 0
    fail_count = 0

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task("Uploading...", total=len(files_to_upload))

        for local_path, remote_path in files_to_upload:
            progress.update(task, description=f"Uploading {remote_path}")

            if upload_to_r2(local_path, remote_path):
                success_count += 1
            else:
                console.print(f"  [red]Failed: {remote_path}[/red]")
                fail_count += 1

            progress.advance(task)

    console.print(f"\n[bold]Summary:[/bold]")
    console.print(f"  [green]Success: {success_count}[/green]")
    if fail_count:
        console.print(f"  [red]Failed: {fail_count}[/red]")

    if fail_count > 0:
        raise typer.Exit(1)

    console.print("\n[green]CDN sync complete![/green]")
    console.print("Files available at: https://qariee-storage.y3f.me/")
