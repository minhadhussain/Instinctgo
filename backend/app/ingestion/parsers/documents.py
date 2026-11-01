from pathlib import Path

from docx import Document
from pypdf import PdfReader


def extract_text(path: Path) -> str:
    """Extract text from a trusted local TXT, Markdown, PDF, or DOCX file.

    This synchronous helper belongs in a worker for large documents.
    Image-only/scanned PDFs require a separate OCR integration.
    """
    suffix = path.suffix.lower()
    if suffix in {".txt", ".md"}:
        return path.read_text(encoding="utf-8")
    if suffix == ".pdf":
        return "\n".join(page.extract_text() or "" for page in PdfReader(path).pages)
    if suffix == ".docx":
        document = Document(str(path))
        paragraphs = [paragraph.text for paragraph in document.paragraphs]
        rows = [
            "\t".join(cell.text for cell in row.cells)
            for table in document.tables
            for row in table.rows
        ]
        return "\n".join(paragraphs + rows)
    raise ValueError(f"Unsupported document format: {suffix}")
