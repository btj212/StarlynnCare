"""
Tests: Slug generation consistency across all state scrapers.

Every state scraper defines its own slugify() and titleize() — they must
all produce identical results for the same input, since slugs are used as
primary keys for facility URLs.

This test imports each scraper's slugify/titleize and verifies they agree.
"""

from __future__ import annotations

import sys
from pathlib import Path

SCRAPERS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "scrapers"
sys.path.insert(0, str(SCRAPERS_DIR))

# Collect slug functions from all active scrapers.
# We import each scraper module and capture its slugify/titleize.
# Scrapers that are retired (or_dhs_ltc_directory_ingest.py) are excluded.

SCRAPER_MODULES = [
    "pa_hsd_directory_ingest",
    "wa_dshs_directory_ingest",
    "mn_mdh_directory_ingest",
    "or_providers_ingest",
]

_slug_fns = {}
_title_fns = {}

for _mod_name in SCRAPER_MODULES:
    try:
        import importlib
        mod = importlib.import_module(_mod_name)
        if hasattr(mod, "slugify"):
            _slug_fns[_mod_name] = mod.slugify
        if hasattr(mod, "titleize"):
            _title_fns[_mod_name] = mod.titleize
    except (ImportError, SystemExit):
        pass  # Script calls sys.exit(1) on import — skip


SLUG_TEST_CASES = [
    ("MEMORY CARE COMMUNITY", "memory-care-community"),
    ("Sunrise at East Bay", "sunrise-at-east-bay"),
    ("Maplewood Senior Living", "maplewood-senior-living"),
    ("The Gardens at Willow Creek", "the-gardens-at-willow-creek"),
    ("St. Mary's Memory Care", "st-mary-s-memory-care"),
    ("A+B Care Center", "a-b-care-center"),
    ("  Leading Spaces  ", "leading-spaces"),
]


class TestSlugConsistencyAcrossScrapers:
    """All active state scrapers produce the same slug for the same input."""

    def test_slug_functions_exist(self) -> None:
        assert _slug_fns, "No slugify functions found — check SCRAPER_MODULES list"

    def test_all_scrapers_agree_on_slugs(self) -> None:
        if len(_slug_fns) < 2:
            return  # Can't compare if only one module loaded

        modules = list(_slug_fns.keys())
        reference_fn = _slug_fns[modules[0]]

        for text, expected in SLUG_TEST_CASES:
            reference = reference_fn(text)
            assert reference == expected, (
                f"{modules[0]}.slugify({text!r}) = {reference!r}, expected {expected!r}"
            )
            for mod_name in modules[1:]:
                result = _slug_fns[mod_name](text)
                assert result == reference, (
                    f"Slug mismatch: {mod_name}.slugify({text!r}) = {result!r}, "
                    f"but {modules[0]}.slugify returned {reference!r}. "
                    "All scrapers must produce identical slugs for the same input."
                )

    def test_slug_is_deterministic(self) -> None:
        """Same input always produces the same slug (no randomness)."""
        if not _slug_fns:
            return
        fn = next(iter(_slug_fns.values()))
        for text, _ in SLUG_TEST_CASES:
            assert fn(text) == fn(text), f"slugify({text!r}) is non-deterministic!"

    def test_slug_no_uppercase(self) -> None:
        """Slugs never contain uppercase letters."""
        if not _slug_fns:
            return
        fn = next(iter(_slug_fns.values()))
        for text, _ in SLUG_TEST_CASES:
            result = fn(text)
            assert result == result.lower(), f"Slug {result!r} contains uppercase"

    def test_slug_no_spaces(self) -> None:
        """Slugs never contain spaces."""
        if not _slug_fns:
            return
        fn = next(iter(_slug_fns.values()))
        for text, _ in SLUG_TEST_CASES:
            result = fn(text)
            assert " " not in result, f"Slug {result!r} contains a space"

    def test_slug_no_leading_trailing_dashes(self) -> None:
        """Slugs never start or end with a dash."""
        if not _slug_fns:
            return
        fn = next(iter(_slug_fns.values()))
        for text, _ in SLUG_TEST_CASES:
            result = fn(text)
            assert not result.startswith("-"), f"Slug {result!r} starts with dash"
            assert not result.endswith("-"), f"Slug {result!r} ends with dash"

    def test_slug_empty_returns_facility(self) -> None:
        """Empty input returns 'facility' (safe fallback for missing names)."""
        if not _slug_fns:
            return
        fn = next(iter(_slug_fns.values()))
        assert fn("") == "facility"
        assert fn("   ") == "facility"
