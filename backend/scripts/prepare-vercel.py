"""Bundle the reviewed noting library and its sources inside the backend service."""

import hashlib
import json
from pathlib import Path
from shutil import copyfile

from pypdf import PdfReader

BACKEND = Path(__file__).resolve().parents[1]


def prepare(source: Path, destination: Path) -> None:
    library = json.loads((source / "noting-library.json").read_text(encoding="utf-8"))
    manifest = json.loads((source / "noting-source-manifest.json").read_text(encoding="utf-8"))
    records = manifest["ruleSources"]
    if len({record["id"] for record in records}) != len(records) or {
        record["id"] for record in records
    } != set(library["rulebooks"]):
        raise ValueError("The source manifest must cover every registered rulebook exactly once.")
    for record in manifest["ruleSources"]:
        book = library["rulebooks"][record["id"]]
        if record["path"] != book["path"] or record["url"] != book["url"]:
            raise ValueError("Rulebook source metadata does not match the source manifest.")
        digest = hashlib.sha256((source / record["path"]).read_bytes()).hexdigest()
        if digest != record["sha256"]:
            raise ValueError(
                f"Rule source changed: {record['path']}. Regenerate the source manifest."
            )
        if (
            book.get("pageCount")
            and len(PdfReader(source / book["path"]).pages) != book["pageCount"]
        ):
            raise ValueError(f"Rule source page count changed: {record['path']}")
    paths = ["noting-library.json", "noting-source-manifest.json", library["formatSource"]]
    paths.extend(book["path"] for book in library["rulebooks"].values())
    for relative in paths:
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        copyfile(source / relative, target)
    print(f"Bundled {len(paths)} noting library/source files for the backend.")


if __name__ == "__main__":
    prepare(BACKEND.parent / "samples", BACKEND / "resources" / "noting")
