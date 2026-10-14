"""Render and locally OCR the private Power Up PDFs without modifying sources."""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image
from pypdf import PdfReader
from rapidocr_onnxruntime import RapidOCR

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "imports" / "materials"
PROCESSED = ROOT / "imports" / "processed"
PREVIEWS = ROOT / "public" / "textbook-pages"
MANIFEST = PROCESSED / "textbook-pages.json"
POPPLER = Path(r"C:\Users\shenkangni\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin\pdftoppm.exe")


def natural_key(path: Path) -> int:
    match = re.search(r"_(\d+)-", path.name)
    return int(match.group(1)) if match else 10_000


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def render_pdf(path: Path, asset_slug: str) -> list[Path]:
    prefix = PREVIEWS / asset_slug
    existing = sorted(PREVIEWS.glob(f"{asset_slug}-*.jpg"))
    page_count = len(PdfReader(str(path)).pages)
    if len(existing) != page_count:
        for old in existing:
            old.unlink()
        command = [str(POPPLER), "-jpeg", "-r", "150", "-scale-to-x", "1000", "-scale-to-y", "-1", str(path), str(prefix)]
        subprocess.run(command, check=True, capture_output=True)
    rendered = sorted(PREVIEWS.glob(f"{asset_slug}-*.jpg"), key=lambda item: int(item.stem.rsplit("-", 1)[1]))
    if len(rendered) != page_count:
        raise RuntimeError(f"Rendered {len(rendered)} of {page_count} pages for {path.name}")
    return rendered


def footer_candidates(lines: list[dict], height: int) -> list[dict]:
    candidates = []
    for line in lines:
        text = line["text"].strip()
        if not re.fullmatch(r"(?:p\.?\s*)?\d{1,3}", text, re.I):
            continue
        number = int(re.search(r"\d+", text).group())
        if not 1 <= number <= 200:
            continue
        y = max(point[1] for point in line["box"])
        if y >= height * 0.76:
            candidates.append({"number": number, "confidence": line["confidence"], "bottom_ratio": round(y / height, 4), "raw": text})
    return sorted(candidates, key=lambda item: (item["bottom_ratio"], item["confidence"]), reverse=True)


def main() -> None:
    if not POPPLER.exists():
        raise FileNotFoundError(f"pdftoppm unavailable: {POPPLER}")
    pdfs = sorted(SOURCE.glob("*.pdf"), key=natural_key)
    if not pdfs:
        raise FileNotFoundError(f"No PDFs found in {SOURCE}")
    PROCESSED.mkdir(parents=True, exist_ok=True)
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    previous = {}
    if MANIFEST.exists():
        try:
            previous = {page["id"]: page for page in json.loads(MANIFEST.read_text("utf-8"))["pages"]}
        except Exception:
            previous = {}
    ocr = RapidOCR()
    total_pages = sum(len(PdfReader(str(pdf)).pages) for pdf in pdfs)
    assets, pages = [], []
    global_index = 0
    for asset_index, pdf in enumerate(pdfs, 1):
        digest = sha256(pdf)
        asset_id = f"PU1-PDF-{asset_index:02d}-{digest[:12]}"
        slug = f"pu1-{asset_index:02d}-{digest[:12]}"
        reader = PdfReader(str(pdf))
        extracted = [(page.extract_text() or "").strip() for page in reader.pages]
        rendered = render_pdf(pdf, slug)
        assets.append({"id": asset_id, "filename": pdf.name, "file_hash": digest, "mime": "application/pdf", "storage_ref": f"private-file:{pdf.name}", "page_count": len(reader.pages), "extractable_text_pages": sum(bool(text) for text in extracted)})
        for pdf_page_index, image_path in enumerate(rendered, 1):
            global_index += 1
            page_id = f"{asset_id}-P{pdf_page_index:02d}"
            old = previous.get(page_id)
            if old and old.get("preview_sha256") == sha256(image_path) and old.get("ocr_text"):
                page = old
            else:
                with Image.open(image_path) as image:
                    width, height = image.size
                result, _ = ocr(str(image_path))
                lines = [] if not result else [{"box": [[round(float(x), 2), round(float(y), 2)] for x, y in box], "text": text, "confidence": round(float(score), 4)} for box, text, score in result]
                footer = footer_candidates(lines, height)
                ocr_text = "\n".join(line["text"] for line in lines)
                units = sorted({int(value) for value in re.findall(r"\bUnit\s*([1-7])\b", ocr_text, re.I)})
                page = {
                    "id": page_id, "asset_id": asset_id, "source_filename": pdf.name,
                    "pdf_page_index": pdf_page_index, "global_page_index": global_index,
                    "preview_ref": f"/textbook-pages/{image_path.name}", "preview_sha256": sha256(image_path),
                    "embedded_text": extracted[pdf_page_index - 1], "ocr_text": ocr_text, "ocr_lines": lines,
                    "ocr_mean_confidence": round(sum(line["confidence"] for line in lines) / len(lines), 4) if lines else 0,
                    "footer_candidates": footer, "observed_printed_page_number": footer[0]["number"] if footer and footer[0]["confidence"] >= 0.55 else None,
                    "printed_page_status": "observed_ocr" if footer and footer[0]["confidence"] >= 0.55 else "manual_review",
                    "unit_number_candidates": units, "review_status": "manual_review",
                }
            pages.append(page)
            print(f"[{global_index:02d}/{total_pages}] {pdf.name} page {pdf_page_index}: printed={page.get('observed_printed_page_number')} chars={len(page.get('ocr_text',''))}", flush=True)
    manifest = {"schema_version": "textbook-inspection-1", "generated_at": "2026-10-14T00:00:00.000Z", "offline_ocr_provider": "rapidocr-onnxruntime", "render_dpi": 150, "preview_width_px": 1000, "assets": assets, "pages": pages}
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(f"Wrote {MANIFEST} with {len(assets)} assets and {len(pages)} pages")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
