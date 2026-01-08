"""List all reciters."""

import typer
from rich.console import Console
from rich.table import Table

from ..utils.db_json import list_reciters, read_db_json

console = Console()


def list_cmd(
    json_output: bool = typer.Option(False, "--json", "-j", help="Output as JSON"),
):
    """
    List all reciters in db.json.
    """
    reciters = list_reciters()
    db_data = read_db_json()

    if json_output:
        import json
        console.print(json.dumps(reciters, indent=2, ensure_ascii=False))
        return

    console.print(f"\n[bold]Qariee Reciters[/bold] (v{db_data['version']})")
    console.print(f"Total: {len(reciters)}\n")

    table = Table(show_header=True, header_style="bold")
    table.add_column("#", style="dim", width=3)
    table.add_column("ID", style="cyan")
    table.add_column("English Name")
    table.add_column("Arabic Name")
    table.add_column("Colors", width=20)

    for i, reciter in enumerate(reciters, 1):
        colors = f"{reciter['color_primary']} / {reciter['color_secondary']}"
        table.add_row(
            str(i),
            reciter["id"],
            reciter["name_en"],
            reciter["name_ar"],
            colors,
        )

    console.print(table)
