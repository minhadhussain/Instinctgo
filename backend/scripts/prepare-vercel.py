"""Bundle the reviewed noting library and its sources inside the backend service."""

import hashlib
import json
from pathlib import Path
from shutil import copyfile

BACKEND = Path(__file__).resolve().parents[1]


def prepare(source: Path, destination: Path) -> None:
    library = json.loads((source / "noting-library.json").read_text(encoding="utf-8"))
    manifest = json.loads((source / "noting-source-manifest.json").read_text(encoding="utf-8"))
    for record in manifest["ruleSources"]:
        digest = hashlib.sha256((source / record["path"]).read_bytes()).hexdigest()
        if digest != record["sha256"]:
            raise ValueError(
                f"Rule source changed: {record['path']}. Regenerate the source manifest."
            )
    paths = ["noting-library.json", "noting-source-manifest.json", library["formatSource"]]
    paths.extend(book["path"] for book in library["rulebooks"].values())
    for relative in paths:
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        copyfile(source / relative, target)
    print(f"Bundled {len(paths)} noting library/source files for the backend.")


if __name__ == "__main__":
    prepare(BACKEND.parent / "samples", BACKEND / "resources" / "noting")
