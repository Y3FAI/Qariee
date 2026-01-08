"""Add a new reciter to db.json."""

import shutil
from pathlib import Path

import typer
from rich.console import Console
from rich.prompt import Prompt

from ..utils.db_json import add_reciter, get_reciter, Reciter
from ..utils.colors import get_random_colors
from ..utils.paths import IMAGES_DIR

console = Console()


def add_reciter_cmd(
    reciter_id: str = typer.Argument(None, help="Reciter ID (kebab-case, e.g., 'saad-alghamdi')"),
    name_en: str = typer.Option(None, "--name-en", "-e", help="English name"),
    name_ar: str = typer.Option(None, "--name-ar", "-a", help="Arabic name"),
    image: Path = typer.Option(None, "--image", "-i", help="Path to reciter image (JPG)"),
):
    """
    Add a new reciter to db.json.

    Example:
        qariee add-reciter saad-alghamdi --name-en "Saad Al-Ghamdi" --name-ar "سعد الغامدي" --image ./saad.jpg

    If arguments are not provided, you'll be prompted interactively.
    """
    # Interactive prompts if not provided
    if not reciter_id:
        reciter_id = Prompt.ask("Reciter ID (kebab-case)", default="")
        if not reciter_id:
            console.print("[red]Reciter ID is required[/red]")
            raise typer.Exit(1)

    # Validate ID format
    if not reciter_id.replace("-", "").isalnum():
        console.print("[red]Reciter ID must be kebab-case (lowercase letters, numbers, hyphens)[/red]")
        raise typer.Exit(1)

    reciter_id = reciter_id.lower()

    # Check if already exists
    if get_reciter(reciter_id):
        console.print(f"[red]Reciter '{reciter_id}' already exists[/red]")
        raise typer.Exit(1)

    if not name_en:
        name_en = Prompt.ask("English name")
        if not name_en:
            console.print("[red]English name is required[/red]")
            raise typer.Exit(1)

    if not name_ar:
        name_ar = Prompt.ask("Arabic name")
        if not name_ar:
            console.print("[red]Arabic name is required[/red]")
            raise typer.Exit(1)

    # Generate random colors
    color_primary, color_secondary = get_random_colors()
    console.print(f"[dim]Generated colors: {color_primary}, {color_secondary}[/dim]")

    # Handle image
    if not image:
        image_str = Prompt.ask("Image path (optional, press Enter to skip)", default="")
        if image_str:
            image = Path(image_str)

    if image:
        if not image.exists():
            console.print(f"[red]Image file not found: {image}[/red]")
            raise typer.Exit(1)

        # Copy image to reciters directory
        dest_image = IMAGES_DIR / f"{reciter_id}.jpg"
        IMAGES_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy(image, dest_image)
        console.print(f"[green]Image copied to: {dest_image}[/green]")

    # Create reciter
    reciter: Reciter = {
        "id": reciter_id,
        "name_en": name_en,
        "name_ar": name_ar,
        "color_primary": color_primary,
        "color_secondary": color_secondary,
    }

    try:
        add_reciter(reciter)
        console.print(f"\n[green]Reciter added successfully![/green]")
        console.print(f"\n[bold]Next steps:[/bold]")
        console.print(f"  1. Upload audio: qariee upload-audio {reciter_id} <base_url>")
        console.print(f"  2. Sync to CDN:  qariee sync")
        console.print(f"  3. Update app:   qariee generate-db")
    except ValueError as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(1)
