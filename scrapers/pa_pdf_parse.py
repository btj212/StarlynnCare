#!/usr/bin/env python3
"""
PA PDF Parse — extract deficiencies from downloaded PA inspection PDFs.

For each pa_pdf_inventory row with parse_status='pending' and
download_status='done':
  1. If the cached PDF is gone, re-download it into .firecrawl/pa-pdfs.
  2. Read every page. Image-only cover pages in front of a text report are
     not a scanned document. OCR only when the report itself has no text
     layer (no "Description of Violation" and pages that are not just covers).
  3. Split the text on every "Description of Violation" block. That count is
     the source of truth — the model is not allowed to return a shorter list.
  4. Ask Claude Haiku for the plain-language fields, one chunk of whole
     blocks at a time. Write the JSON sidecar and set parse_status.

Usage:
  python3 -u scrapers/pa_pdf_parse.py            # all pending
  python3 -u scrapers/pa_pdf_parse.py --limit 10
  python3 -u scrapers/pa_pdf_parse.py --dry-run  # triage only, no LLM
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path
from typing import Any

import pdfplumber
import psycopg
import requests
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
PDF_CACHE_DIR = REPO_ROOT / ".firecrawl" / "pa-pdfs"

# A page of only a footer is not a text layer. Cover scans are often 0.
_PAGE_TEXT_MIN = 20
# Whole citation blocks per model call. Never cut a block to fit.
_MAX_BLOCKS_PER_CALL = 6
_MAX_CHARS_PER_CALL = 8_000
_MAX_OUTPUT_TOKENS = 4096
_HAIKU_MODEL = "claude-haiku-4-5"

# A new citation starts at a section heading such as "42s - Privacy" or
# "141a 1-10 Medical Evaluation Information". A "(continued)" line is the
# running header of the citation already open, not a new one.
_SECTION_HEADING = re.compile(
    r"^(?:"
    r"\d{2,4}[a-z]?\d{0,2}\s+-\s*\S"
    r"|\d{2,4}[a-z]?\d{0,2}\s+\d+\s*-\s*\d+\s+\S"
    r")",
    re.I,
)
_REQUIREMENTS_LINE = re.compile(r"^\d+\.\s*Requirements\s*$", re.I)
_VIOLATION_MARKER = "Description of Violation"

# PA-specific prompt — uses 55 Pa Code section vocabulary + DHS enforcement language
_SYSTEM_PROMPT = """You are a structured data extractor for Pennsylvania DHS Office of Long-Term Living inspection reports for Personal Care Homes (55 Pa Code Ch 2600) and Assisted Living Residences (55 Pa Code Ch 2800).

Given raw PDF text from a PA inspection report, extract each deficiency/violation cited and return a JSON array.

Each element must have:
- "date": YYYY-MM-DD or null (date of violation / inspection)
- "code": 55 Pa Code citation (e.g. "55 Pa Code § 2600.171" or "55 Pa Code § 2800.231") or null
- "description": 1–3 sentence plain-language description of the violation
- "severity": one of:
    "Citation"           (standard finding, no penalty)
    "Civil Money Penalty"  (monetary penalty assessed — note amount in description if present)
    "Provisional License"  (license downgraded to provisional)
    "Substantiated Abuse"  (abuse/neglect substantiated)
    "Immediate Jeopardy"   (resident life/safety threat)
    "Revocation"           (license refused or revoked)
    or null
- "poc_text": Plan of Correction text if present, otherwise null
- "corrected": true | false | null

The user message contains one or more complete citation blocks. Return one array element per "Description of Violation" block, in the same order. Do not drop a block, and do not merge two blocks that share a section number.

Return ONLY valid JSON. If there are no deficiencies (clean inspection), return [].
Do not include commentary outside the JSON array."""


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)
            return


def get_dsn() -> str:
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        raise RuntimeError("DATABASE_URL / POSTGRES_URL not set")
    return url


def get_conn() -> psycopg.Connection:
    return psycopg.connect(get_dsn())


def should_fail(errors: int, attempted: int) -> bool:
    """A systemic failure fails the job. A handful of bad rows stays a warning.

    Fail when more rows errored than max(2, 5% of the rows attempted).
    """
    if errors <= 0:
        return False
    return errors > max(2, attempted * 0.05)


def classify_error(exc: BaseException) -> str:
    """Group the same failure (missing binary, missing file) into one line."""
    message = str(exc).strip().splitlines()[0] if str(exc).strip() else type(exc).__name__
    message = re.sub(r"(?:[A-Za-z]:)?(?:\\|/)+[^\s:'\"]+", "<path>", message)
    message = re.sub(r"pages \[[^\]]*\]", "pages [...]", message)
    message = re.sub(r"\s+", " ", message).strip()
    if len(message) > 180:
        message = message[:180] + "…"
    return f"{type(exc).__name__}: {message}"


def report_error_summary(label: str, counts: dict[str, int]) -> None:
    if not counts:
        return
    ordered = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    print(f"  {label} error classes:", flush=True)
    for name, count in ordered:
        print(f"    {count}  {name}", flush=True)
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return
    with open(summary_path, "a", encoding="utf-8") as handle:
        handle.write(f"\n### {label} error classes\n\n")
        for name, count in ordered:
            handle.write(f"- {count} × {name}\n")


def violation_marker_count(text: str) -> int:
    return len(re.findall(re.escape(_VIOLATION_MARKER), text))


def _is_section_heading(line: str) -> bool:
    if re.search(r"\(continued\)", line, re.I):
        return False
    return _SECTION_HEADING.match(line.strip()) is not None


def split_violation_blocks(text: str) -> list[str]:
    """One string per citation: the section heading, the rule, the violation, and the plan.

    The split is on the "Description of Violation" marker. A second citation
    under the same section (no new heading) starts at its own "N. Requirements"
    line. Running headers marked "(continued)" stay inside the open citation.
    """
    if _VIOLATION_MARKER not in text:
        return []

    parts = text.splitlines(keepends=True)
    lines = [part.rstrip("\r\n") for part in parts]
    offsets: list[int] = []
    cursor = 0
    for part in parts:
        offsets.append(cursor)
        cursor += len(part)

    marker_idxs = [i for i, line in enumerate(lines) if _VIOLATION_MARKER in line]
    starts: list[int] = []
    for n, marker_i in enumerate(marker_idxs):
        region_from = 0 if n == 0 else marker_idxs[n - 1] + 1
        heading_i: int | None = None
        requirements_i: int | None = None
        for i in range(marker_i - 1, region_from - 1, -1):
            line = lines[i]
            if _is_section_heading(line):
                heading_i = i
                break
            if requirements_i is None and _REQUIREMENTS_LINE.match(line.strip()):
                requirements_i = i
        if heading_i is not None:
            starts.append(heading_i)
        elif requirements_i is not None:
            starts.append(requirements_i)
        else:
            starts.append(region_from)

    blocks: list[str] = []
    for n, start_i in enumerate(starts):
        end_i = starts[n + 1] if n + 1 < len(starts) else len(lines)
        start_c = offsets[start_i]
        end_c = offsets[end_i] if end_i < len(offsets) else len(text)
        blocks.append(text[start_c:end_c].strip())
    return blocks


def chunk_blocks(
    blocks: list[str],
    *,
    max_blocks: int = _MAX_BLOCKS_PER_CALL,
    max_chars: int = _MAX_CHARS_PER_CALL,
) -> list[list[str]]:
    """Group whole blocks. A block longer than max_chars is its own chunk."""
    chunks: list[list[str]] = []
    current: list[str] = []
    current_len = 0
    for block in blocks:
        if current and (len(current) >= max_blocks or current_len + len(block) > max_chars):
            chunks.append(current)
            current = []
            current_len = 0
        current.append(block)
        current_len += len(block)
    if current:
        chunks.append(current)
    return chunks


def page_texts(pdf_path: Path) -> list[str]:
    with pdfplumber.open(pdf_path) as pdf:
        return [(page.extract_text() or "") for page in pdf.pages]


def pages_without_text(pdf_path: Path) -> list[int]:
    """1-based page numbers whose text layer is missing or only a footer."""
    return [
        number
        for number, text in enumerate(page_texts(pdf_path), start=1)
        if len(text.strip()) < _PAGE_TEXT_MIN
    ]


def has_text_layer(pdf_path: Path) -> bool:
    """True when any page has a real text layer.

    2026 DHS bundles open with image-only cover letters. Those pages do not
    make the inspection summary a scanned document.
    """
    return any(len(text.strip()) >= _PAGE_TEXT_MIN for text in page_texts(pdf_path))


def _leading_covers_only(texts: list[str]) -> bool:
    """Image pages that sit strictly before the first text page are covers."""
    seen_text = False
    saw_leading_gap = False
    for text in texts:
        if len(text.strip()) < _PAGE_TEXT_MIN:
            if seen_text:
                return False
            saw_leading_gap = True
        else:
            seen_text = True
    return seen_text and saw_leading_gap


def needs_ocr(texts: list[str]) -> bool:
    """OCR a scanned report. Do not OCR image covers in front of text pages.

    Citations are already countable when any page contains the violation
    marker. A fully scanned report has textless pages and no marker, and the
    blank pages are not merely leading covers.
    """
    has_gap = any(len(text.strip()) < _PAGE_TEXT_MIN for text in texts)
    if not has_gap:
        return False
    if any(_VIOLATION_MARKER in text for text in texts):
        return False
    if _leading_covers_only(texts):
        return False
    return True


def extract_text(pdf_path: Path) -> str:
    return "\n".join(part for part in page_texts(pdf_path) if part)


def ocr_pdf(pdf_path: Path) -> Path:
    out = pdf_path.parent / f"{pdf_path.stem}_ocr.pdf"
    subprocess.run(
        ["ocrmypdf", "--skip-text", "--deskew", str(pdf_path), str(out)],
        check=True,
        capture_output=True,
    )
    return out


def _ocr_page_tesseract(pdf_path: Path, page_no: int) -> str:
    with tempfile.TemporaryDirectory() as tmp:
        prefix = str(Path(tmp) / "page")
        subprocess.run(
            [
                "pdftoppm",
                "-r",
                "200",
                "-f",
                str(page_no),
                "-l",
                str(page_no),
                "-png",
                str(pdf_path),
                prefix,
            ],
            check=True,
            capture_output=True,
        )
        pngs = sorted(Path(tmp).glob("*.png"))
        if not pngs:
            raise RuntimeError(f"pdftoppm produced no image for page {page_no}")
        result = subprocess.run(
            ["tesseract", str(pngs[0]), "stdout"],
            check=True,
            capture_output=True,
            text=True,
        )
        return result.stdout


def ocr_textless_pages(pdf_path: Path, texts: list[str]) -> str:
    """OCR only pages without a text layer, then return the report in page order.

    ocrmypdf --skip-text already leaves text pages alone. Without it, render
    just the blank pages and keep the pdfplumber text of the rest.
    """
    missing = [
        number
        for number, text in enumerate(texts, start=1)
        if len(text.strip()) < _PAGE_TEXT_MIN
    ]
    if shutil.which("ocrmypdf"):
        try:
            return extract_text(ocr_pdf(pdf_path))
        except subprocess.CalledProcessError as exc:
            detail = exc.stderr.decode(errors="replace")[:200] if exc.stderr else str(exc)
            raise RuntimeError(f"OCR failed: {detail}") from exc
    if shutil.which("pdftoppm") and shutil.which("tesseract"):
        merged = list(texts)
        for page_no in missing:
            merged[page_no - 1] = _ocr_page_tesseract(pdf_path, page_no)
        return "\n".join(part for part in merged if part)
    raise RuntimeError(f"no OCR tool available for pages {missing}")


def extract_report_text(pdf_path: Path) -> tuple[str, str]:
    """Return (text, parse_method). Raises when a scanned report cannot be read."""
    texts = page_texts(pdf_path)
    if not needs_ocr(texts):
        return "\n".join(part for part in texts if part), "pdfplumber"
    text = ocr_textless_pages(pdf_path, texts)
    # A one-page "no regulatory citations" letter has text and zero markers.
    # Empty text after OCR is a failed read, not that letter.
    if not text.strip():
        raise RuntimeError("no text extracted from PDF after OCR")
    if shutil.which("ocrmypdf"):
        return text, "ocrmypdf+pdfplumber"
    return text, "pdftoppm+tesseract"


def _strip_json_fence(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return text


def _call_claude_blocks(blocks: list[str]) -> list[dict[str, Any]]:
    try:
        import anthropic
    except ImportError as exc:
        raise RuntimeError("anthropic package not installed. Run: pip install anthropic") from exc

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")

    client = anthropic.Anthropic(api_key=api_key)
    msg = client.messages.create(
        model=_HAIKU_MODEL,
        max_tokens=_MAX_OUTPUT_TOKENS,
        messages=[{"role": "user", "content": "\n\n".join(blocks)}],
        system=_SYSTEM_PROMPT,
    )
    if getattr(msg, "stop_reason", None) == "max_tokens":
        if len(blocks) <= 1:
            raise RuntimeError(
                "Claude output hit max_tokens on a single citation block; refusing to parse a cut-off JSON reply"
            )
        mid = len(blocks) // 2
        return _call_claude_blocks(blocks[:mid]) + _call_claude_blocks(blocks[mid:])

    raw = msg.content[0].text if msg.content else "[]"
    try:
        parsed = json.loads(_strip_json_fence(raw))
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Claude returned truncated or invalid JSON: {exc}") from exc
    if not isinstance(parsed, list):
        raise RuntimeError("Claude response was not a JSON array")
    return parsed


def call_claude(text: str) -> list[dict[str, Any]]:
    """Plain-language fields for one chunk of whole citation blocks."""
    blocks = split_violation_blocks(text)
    if not blocks:
        blocks = [text] if text.strip() else []
    if not blocks:
        return []
    return _call_claude_blocks(blocks)


def parse_deficiencies_from_text(text: str) -> list[dict[str, Any]]:
    """Return one deficiency per violation marker, or [] when the letter cites nothing.

    A short model reply is an error. It is not stored.
    """
    expected = violation_marker_count(text)
    if expected == 0:
        return []

    blocks = split_violation_blocks(text)
    if len(blocks) != expected:
        raise RuntimeError(
            f"split {len(blocks)} citation blocks but found {expected} "
            "'Description of Violation' markers"
        )

    parsed: list[dict[str, Any]] = []
    for chunk in chunk_blocks(blocks):
        got = call_claude("\n\n".join(chunk))
        if len(got) != len(chunk):
            raise RuntimeError(
                f"parsed {len(got)} deficiencies from {len(chunk)} citation blocks "
                f"({expected} Description of Violation markers in the report)"
            )
        parsed.extend(got)
    if len(parsed) != expected:
        raise RuntimeError(
            f"parsed {len(parsed)} deficiencies but the report has {expected} "
            "Description of Violation markers"
        )
    return parsed


def _browser_session() -> requests.Session:
    session = requests.Session()
    session.headers["User-Agent"] = "StarlynnCare-bot/1.0 (+https://starlynn.care)"
    return session


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ensure_local_pdf(
    local_path: str | None,
    pdf_url: str | None,
    *,
    session: requests.Session | None = None,
    cache_dir: Path | None = None,
) -> Path:
    """Return the PDF on disk. A missing runner cache file is downloaded again.

    The cache layout matches pa_pdf_download: <cache>/<sha256[:2]>/<sha256>.pdf.
    """
    if local_path:
        path = Path(local_path)
        if path.is_file():
            return path
    if not pdf_url:
        raise FileNotFoundError(f"PDF not on disk: {local_path}")

    sess = session if session is not None else _browser_session()
    cache = cache_dir if cache_dir is not None else PDF_CACHE_DIR
    cache.mkdir(parents=True, exist_ok=True)
    resp = sess.get(pdf_url, timeout=60, stream=True)
    resp.raise_for_status()
    tmp = cache / f".partial-{uuid.uuid4().hex}.pdf"
    try:
        with tmp.open("wb") as handle:
            for chunk in resp.iter_content(65536):
                if chunk:
                    handle.write(chunk)
        digest = _sha256_file(tmp)
        dest = cache / digest[:2] / f"{digest}.pdf"
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.exists():
            tmp.unlink()
            return dest
        tmp.replace(dest)
        return dest
    except Exception:
        if tmp.exists():
            tmp.unlink()
        raise


def parse_pdf(
    _inv_id: str,
    local_path: str | None,
    dry_run: bool,
    pdf_url: str | None = None,
) -> tuple[str, list[dict[str, Any]] | None, Path]:
    """
    Returns (parse_method, deficiencies_list, pdf_path).
    deficiencies_list is None on a dry run.
    parse_method: 'pdfplumber' | 'ocrmypdf+pdfplumber' | 'pdftoppm+tesseract'
    """
    pdf_path = ensure_local_pdf(local_path, pdf_url)
    text, parse_method = extract_report_text(pdf_path)

    if dry_run:
        print(f"    text_len={len(text)} parse_method={parse_method}", flush=True)
        return parse_method, None, pdf_path

    deficiencies = parse_deficiencies_from_text(text)
    sidecar = pdf_path.parent / f"{pdf_path.stem}.deficiencies.json"
    sidecar.write_text(json.dumps(deficiencies, indent=2))
    return parse_method, deficiencies, pdf_path


def run(dry_run: bool, limit: int | None) -> None:
    dsn = get_dsn()
    limit_sql = f"LIMIT {int(limit)}" if limit else ""

    # Fetch work list with a short-lived connection
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT id, local_path, pdf_url
                FROM pa_pdf_inventory
                WHERE parse_status = 'pending'
                  AND download_status = 'done'
                  AND local_path IS NOT NULL
                ORDER BY created_at
                {limit_sql}
                """
            )
            rows = cur.fetchall()

    print(f"  {len(rows)} PDFs to parse", flush=True)

    ok = err = skipped = 0
    error_classes: dict[str, int] = {}
    for inv_id, local_path, pdf_url in rows:
        try:
            parse_method, deficiencies, pdf_path = parse_pdf(
                str(inv_id), local_path, dry_run, pdf_url
            )
            if dry_run:
                skipped += 1
                continue

            # Fresh connection per update — avoids session pooler idle-timeout disconnect.
            # local_path is rewritten when the runner cache had to be re-downloaded;
            # the download step stores the same column.
            with psycopg.connect(dsn) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE pa_pdf_inventory
                        SET parse_status = 'done',
                            parse_method = %s,
                            parsed_at = now(),
                            local_path = %s
                        WHERE id = %s
                        """,
                        (parse_method, str(pdf_path), inv_id),
                    )
            ok += 1
            print(
                f"  OK  {str(inv_id)[:8]}  {parse_method}  {len(deficiencies or [])} deficiencies",
                flush=True,
            )

        except Exception as exc:
            try:
                with psycopg.connect(dsn) as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            UPDATE pa_pdf_inventory
                            SET parse_status = 'error', parse_error = %s
                            WHERE id = %s
                            """,
                            (str(exc)[:500], inv_id),
                        )
            except Exception as db_exc:
                print(f"  DB ERR writing error status: {db_exc}", file=sys.stderr, flush=True)
            err += 1
            label = classify_error(exc)
            error_classes[label] = error_classes.get(label, 0) + 1
            print(f"  ERR {str(inv_id)[:8]}: {exc}", file=sys.stderr, flush=True)

    print(f"  Done — ok: {ok}, errors: {err}, dry-run skipped: {skipped}", flush=True)
    report_error_summary("PA PDF parse", error_classes)
    attempted = ok + err
    if not dry_run and should_fail(err, attempted):
        print(
            f"FAIL: {err} of {attempted} PDFs errored during parse",
            file=sys.stderr,
            flush=True,
        )
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Parse PA inspection PDFs with Claude Haiku.")
    parser.add_argument("--dry-run", action="store_true", help="Triage only, no LLM calls")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    load_env()
    run(args.dry_run, args.limit)


if __name__ == "__main__":
    main()
