"""Merge recipes_extracted.json into recipes.json.

Dedupes by normalized name, validates required fields, and normalizes the
`type` field to the site's existing convention (singular for Lotion/Scrub/
Bath Bomb). Run from the repo root:

    python scripts/merge_recipes.py
"""

import io
import json
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

REPO = Path(__file__).resolve().parent.parent
DATA_DIR = REPO / "client" / "src" / "data"
LIVE = DATA_DIR / "recipes.json"
EXTRACTED = DATA_DIR / "recipes_extracted.json"

# Existing convention: category key -> type value stored on each recipe
TYPE_BY_CATEGORY = {
    "Hot Process": "Hot Process",
    "Cold Process": "Cold Process",
    "Lotions": "Lotion",
    "Scrubs": "Scrub",
    "Bath Bombs": "Bath Bomb",
    "Remedies": "Remedies",
    "Hair Care": "Hair Care",
}

CATEGORY_ORDER = list(TYPE_BY_CATEGORY)


def norm_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.lower())


def valid(recipe: dict) -> bool:
    name = (recipe.get("name") or "").strip()
    ingredients = recipe.get("ingredients") or []
    instructions = (recipe.get("instructions") or "").strip()
    return bool(name) and len(ingredients) >= 3 and len(instructions) >= 150


def main() -> None:
    live = json.loads(LIVE.read_text(encoding="utf-8"))
    extracted = json.loads(EXTRACTED.read_text(encoding="utf-8"))

    seen = {norm_name(r["name"]) for cat in live.values() for r in cat}
    merged = {cat: list(live.get(cat, [])) for cat in CATEGORY_ORDER}

    added: dict[str, int] = {}
    skipped_dupe = 0
    skipped_invalid = 0

    for category, recipes in extracted.items():
        if category not in TYPE_BY_CATEGORY:
            print(f"WARNING: unknown category {category!r} with {len(recipes)} recipes — skipped")
            continue
        for recipe in recipes:
            if not valid(recipe):
                skipped_invalid += 1
                continue
            key = norm_name(recipe["name"])
            if key in seen:
                skipped_dupe += 1
                continue
            seen.add(key)
            entry = dict(recipe)
            entry["type"] = TYPE_BY_CATEGORY[category]
            merged[category].append(entry)
            added[category] = added.get(category, 0) + 1

    LIVE.write_text(
        json.dumps(merged, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )

    print("Added per category:", added)
    print("Skipped duplicates:", skipped_dupe, "| skipped invalid:", skipped_invalid)
    print("New totals:", {cat: len(rs) for cat, rs in merged.items()})
    print("Grand total:", sum(len(rs) for rs in merged.values()))


if __name__ == "__main__":
    main()
