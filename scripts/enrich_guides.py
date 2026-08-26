"""Merge family-enrichment research into the detailed guides.

Reads scripts/research/family_enrichment/*.json (each: {family, detection:
{any_of: [...], category?}, tips: [...], sources: [...]}) and appends
matching families' tips/sources to each guide in
client/src/data/detailed_prep.json. Matching text = recipe name + ingredients
(lowercase substring match); an optional detection.category restricts to one
recipe category. Idempotent: existing identical tips/sources are not
duplicated. Caps: 7 tips, 6 sources per guide.

Run from repo root:
    python scripts/enrich_guides.py --dry-run
    python scripts/enrich_guides.py
"""

import io
import json
import re
import sys
import unicodedata
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

REPO = Path(__file__).resolve().parent.parent
RECIPES = REPO / "client" / "src" / "data" / "recipes.json"
GUIDES = REPO / "client" / "src" / "data" / "detailed_prep.json"
FAMILIES_DIR = REPO / "scripts" / "research" / "family_enrichment"

MAX_TIPS = 7
MAX_SOURCES = 6


def slugify(name: str) -> str:
    # Mirrors slugifyName() in client/src/lib/recipes.ts exactly
    slug = re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", name.lower())).strip("-")
    return slug or "recipe"


def flat_recipes() -> list[tuple[str, str, str]]:
    """(slug, category, match_text) in site order."""
    data = json.loads(RECIPES.read_text(encoding="utf-8"))
    used: set[str] = set()
    out = []
    for category, recipes in data.items():
        for recipe in recipes:
            base = slugify(recipe["name"])
            slug, suffix = base, 2
            while slug in used:
                slug = f"{base}-{suffix}"
                suffix += 1
            used.add(slug)
            ingredients = recipe.get("ingredients") or []
            if isinstance(ingredients, str):
                ingredients = [ingredients]
            text = " ".join([recipe.get("name", "")] + list(ingredients)).lower()
            out.append((slug, category, text))
    return out


def main() -> None:
    dry = "--dry-run" in sys.argv
    guides = json.loads(GUIDES.read_text(encoding="utf-8"))
    families = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(FAMILIES_DIR.glob("*.json"))]
    if not families:
        sys.exit(f"no family files in {FAMILIES_DIR}")

    touched_per_family = {f["family"]: 0 for f in families}
    guides_touched = 0

    for slug, category, text in flat_recipes():
        guide = guides.get(slug)
        if not guide:
            continue
        changed = False
        for family in families:
            detection = family.get("detection", {})
            required_category = detection.get("category")
            if required_category and required_category != category:
                continue
            if not any(keyword.lower() in text for keyword in detection.get("any_of", [])):
                continue
            tips = list(guide.get("tips") or [])
            sources = list(guide.get("sources") or [])
            for tip in family.get("tips", []):
                if tip not in tips and len(tips) < MAX_TIPS:
                    tips.append(tip)
                    changed = True
            for src in family.get("sources", []):
                if src not in sources and len(sources) < MAX_SOURCES:
                    sources.append(src)
                    changed = True
            if changed:
                guide["tips"] = tips
                guide["sources"] = sources
                touched_per_family[family["family"]] += 1
        if changed:
            guides_touched += 1

    print("guides touched per family:", touched_per_family)
    print("total guides enriched:", guides_touched, "/", len(guides))
    if dry:
        print("(dry run — nothing written)")
        return
    GUIDES.write_text(json.dumps(guides, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("detailed_prep.json rewritten")


if __name__ == "__main__":
    main()
