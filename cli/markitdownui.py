#!/usr/bin/env python3
"""
markitdownui-cli  –  Convert documents to Markdown from the command line.

Usage examples
──────────────
  # Convert a single file (output to stdout)
  python markitdownui.py convert report.pdf

  # Convert and save to a specific output file
  python markitdownui.py convert report.pdf -o report.md

  # Bulk-convert multiple files into an output directory
  python markitdownui.py convert *.docx *.pdf -d ./output

  # Send file(s) to the running MarkItDown UI server
  python markitdownui.py convert report.pdf --server http://localhost:8000

  # Show conversion history stored in db.json
  python markitdownui.py history

  # Clear all history
  python markitdownui.py history --clear
"""

import json
import sys
import time
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.markup import escape
from rich.panel import Panel
from rich.progress import (
    BarColumn,
    MofNCompleteColumn,
    Progress,
    SpinnerColumn,
    TaskProgressColumn,
    TextColumn,
    TimeElapsedColumn,
)
from rich.table import Table
from rich.text import Text

console = Console()

# ── Helpers ───────────────────────────────────────────────────────────────────

def _format_bytes(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def _local_db_path() -> Path:
    """Best-effort lookup of db.json relative to the CLI file or CWD."""
    candidates = [
        Path(__file__).parents[1] / "backend" / "db.json",
        Path.cwd() / "backend" / "db.json",
        Path.cwd() / "db.json",
    ]
    for p in candidates:
        if p.exists():
            return p
    return candidates[0]  # will be created if needed


# ── CLI root ──────────────────────────────────────────────────────────────────

@click.group()
@click.version_option("1.0.0", prog_name="markitdownui-cli")
def cli():
    """MarkItDown UI – CLI companion for document-to-Markdown conversion."""


# ── convert ───────────────────────────────────────────────────────────────────

@cli.command("convert")
@click.argument("files", nargs=-1, required=True, type=click.Path(exists=True))
@click.option("-o", "--output", "output_file", default=None,
              help="Write output to this file (single-file mode only).")
@click.option("-d", "--dir", "output_dir", default=None,
              help="Write each converted .md file into this directory.")
@click.option("--server", default=None, metavar="URL",
              help="URL of a running MarkItDown UI backend, e.g. http://localhost:8000")
@click.option("--print/--no-print", "print_output", default=False,
              help="Print markdown to stdout (single-file mode, overridden by -o/-d).")
def convert(
    files: tuple[str, ...],
    output_file: Optional[str],
    output_dir: Optional[str],
    server: Optional[str],
    print_output: bool,
):
    """Convert one or more FILEs to Markdown.

    Without --server the conversion runs locally (requires markitdown installed).
    With --server the file(s) are uploaded to the running UI backend.
    """
    paths = [Path(f) for f in files]

    if server:
        _convert_via_server(paths, server)
    else:
        _convert_local(paths, output_file, output_dir, print_output)


# ── local conversion ──────────────────────────────────────────────────────────

def _convert_local(
    paths: list[Path],
    output_file: Optional[str],
    output_dir: Optional[str],
    print_output: bool,
):
    try:
        from markitdown import MarkItDown  # type: ignore
    except ImportError:
        console.print(
            "[red]markitdown is not installed.[/red]\n"
            "Run: [bold]pip install 'markitdown[all]'[/bold]"
        )
        sys.exit(1)

    md = MarkItDown()
    out_dir = Path(output_dir) if output_dir else None
    if out_dir:
        out_dir.mkdir(parents=True, exist_ok=True)

    results: list[dict] = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        MofNCompleteColumn(),
        TaskProgressColumn(),
        TimeElapsedColumn(),
        console=console,
        transient=True,
    ) as progress:
        task = progress.add_task("Converting…", total=len(paths))

        for path in paths:
            progress.update(task, description=f"[cyan]{path.name}[/cyan]")
            t0 = time.perf_counter()
            try:
                result = md.convert(str(path))
                duration = time.perf_counter() - t0
                markdown = result.text_content or ""

                if output_file and len(paths) == 1:
                    dest = Path(output_file)
                    dest.write_text(markdown, encoding="utf-8")
                    results.append({"file": path.name, "ok": True, "dest": str(dest), "duration": duration})
                elif out_dir:
                    dest = out_dir / (path.stem + ".md")
                    dest.write_text(markdown, encoding="utf-8")
                    results.append({"file": path.name, "ok": True, "dest": str(dest), "duration": duration})
                elif print_output or len(paths) == 1:
                    results.append({"file": path.name, "ok": True, "content": markdown, "duration": duration})
                else:
                    # Default: write alongside the source file
                    dest = path.with_suffix(".md")
                    dest.write_text(markdown, encoding="utf-8")
                    results.append({"file": path.name, "ok": True, "dest": str(dest), "duration": duration})

            except Exception as exc:  # noqa: BLE001
                duration = time.perf_counter() - t0
                results.append({"file": path.name, "ok": False, "error": str(exc), "duration": duration})

            progress.advance(task)

    _print_results(results)


# ── server conversion ─────────────────────────────────────────────────────────

def _convert_via_server(paths: list[Path], server: str):
    try:
        import requests  # type: ignore
    except ImportError:
        console.print("[red]requests is not installed.[/red]  pip install requests")
        sys.exit(1)

    server = server.rstrip("/")
    results: list[dict] = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        MofNCompleteColumn(),
        TimeElapsedColumn(),
        console=console,
        transient=True,
    ) as progress:
        task = progress.add_task("Uploading…", total=len(paths))

        for path in paths:
            progress.update(task, description=f"[cyan]{path.name}[/cyan]")
            t0 = time.perf_counter()
            try:
                with open(path, "rb") as fh:
                    resp = requests.post(
                        f"{server}/api/convert",
                        files={"file": (path.name, fh)},
                        timeout=120,
                    )
                resp.raise_for_status()
                record = resp.json()
                duration = time.perf_counter() - t0
                if record.get("status") == "success":
                    results.append({"file": path.name, "ok": True, "record_id": record["id"], "duration": duration})
                else:
                    results.append({"file": path.name, "ok": False, "error": record.get("error_message", "Unknown"), "duration": duration})
            except Exception as exc:
                duration = time.perf_counter() - t0
                results.append({"file": path.name, "ok": False, "error": str(exc), "duration": duration})

            progress.advance(task)

    _print_results(results, server=server)


# ── print helpers ─────────────────────────────────────────────────────────────

def _print_results(results: list[dict], server: Optional[str] = None):
    if len(results) == 1 and results[0].get("content"):
        console.print(results[0]["content"])
        return

    table = Table(title="Conversion Results", header_style="bold", show_lines=False)
    table.add_column("File", style="cyan", no_wrap=True, max_width=40)
    table.add_column("Status", justify="center")
    table.add_column("Output / Info", no_wrap=False)
    table.add_column("Time", justify="right", style="dim")

    ok = err = 0
    for r in results:
        status = "[green]✓ OK[/green]" if r["ok"] else "[red]✗ ERR[/red]"
        if r["ok"]:
            ok += 1
            if server and r.get("record_id"):
                info = f"[dim]{server}/api/download/{r['record_id']}[/dim]"
            else:
                info = escape(r.get("dest", "→ stdout"))
        else:
            err += 1
            info = f"[red]{escape(r.get('error', ''))}[/red]"
        table.add_row(escape(r["file"]), status, info, f"{r['duration']:.2f}s")

    console.print(table)
    summary = Text()
    summary.append(f"{ok} succeeded", style="green bold")
    if err:
        summary.append(f", {err} failed", style="red bold")
    console.print(Panel(summary, expand=False))


# ── history ───────────────────────────────────────────────────────────────────

@cli.command("history")
@click.option("--clear", is_flag=True, help="Delete all history records.")
@click.option("--db", "db_path", default=None, help="Path to db.json (auto-detected by default).")
@click.option("-n", "--limit", default=20, show_default=True, help="Max records to display.")
def history(clear: bool, db_path: Optional[str], limit: int):
    """Show (or clear) conversion history stored in db.json."""
    path = Path(db_path) if db_path else _local_db_path()

    if clear:
        if path.exists():
            path.write_text("[]", encoding="utf-8")
            console.print(f"[green]History cleared:[/green] {path}")
        else:
            console.print("[yellow]No history file found.[/yellow]")
        return

    if not path.exists():
        console.print("[yellow]No history found.[/yellow]  Convert some files first.")
        return

    records: list[dict] = json.loads(path.read_text(encoding="utf-8"))
    if not records:
        console.print("[dim]History is empty.[/dim]")
        return

    display = records[:limit]

    table = Table(
        title=f"Conversion History  ({len(records)} total, showing {len(display)})",
        header_style="bold",
        show_lines=False,
    )
    table.add_column("#", style="dim", justify="right", width=3)
    table.add_column("File", style="cyan", no_wrap=True, max_width=36)
    table.add_column("Status", justify="center")
    table.add_column("Size", justify="right")
    table.add_column("Date", style="dim")
    table.add_column("Preview", max_width=40, no_wrap=False)

    for i, rec in enumerate(display, 1):
        status = "[green]✓[/green]" if rec.get("status") == "success" else "[red]✗[/red]"
        preview = (rec.get("markdown_preview") or "").replace("\n", " ")[:60]
        table.add_row(
            str(i),
            escape(rec.get("original_filename", "")),
            status,
            _format_bytes(rec.get("file_size", 0)),
            rec.get("created_at", "")[:19].replace("T", " "),
            escape(preview) if preview else "[dim]—[/dim]",
        )

    console.print(table)


# ── entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    cli()
