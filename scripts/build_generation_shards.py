"""Package per-agent input shards for detailed-guide generation.

Reads recipes.json + the research outputs (method_templates.json,
repo_sources.json, source_pages.json) and writes N balanced shard files under
scripts/research/shards/input-N.json. Each shard contains everything one
generation agent needs: its recipes, the method templates for the categories
it covers, relevant general-method excerpts, and any per-recipe recovered
sources (matched by normalized name).

Run from repo root:
    python scripts/build_generation_shards.py [--shards 7]
"""

import io
import json
import re
import sys
import unicodedata
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

REPO = Path(__file__).resolve().parent.parent
RESEARCH = REPO / "scripts" / "research"
SHARDS_DIR = RESEARCH / "shards"

# category -> method template keys the generator should consult
TEMPLATE_KEYS = {
    "Hot Process": ["hot_process", "cold_process"],
    "Cold Process": ["cold_process", "melt_and_pour"],
    "Lotions": ["lotions"],
    "Scrubs": ["scrubs"],
    "Bath Bombs": ["bath_bombs"],
    "Remedies": ["remedies", "face_masks"],
    "Hair Care": ["shampoo_bars_soap", "shampoo_bars_syndet", "conditioner_bars"],
}

GENERAL_KEYS = {
    "Hot Process": ["cold_process"],
    "Cold Process": ["cold_process", "japanese_technique"],
    "Hair Care": ["shampoo_bars"],
}


def norm(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.lower())


def slugify(name: str) -> str:
    # Mirrors slugifyName() in client/src/lib/recipes.ts exactly:
    # lowercase -> NFKD -> non-alphanumeric runs to "-" -> trim -> "recipe" fallback
    slug = re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", name.lower())).strip("-")
    return slug or "recipe"


def main() -> None:
    n_shards = int(sys.argv[sys.argv.index("--shards") + 1]) if "--shards" in sys.argv else 7

    recipes = json.loads((REPO / "client" / "src" / "data" / "recipes.json").read_text(encoding="utf-8"))
    templates = json.loads((RESEARCH / "method_templates.json").read_text(encoding="utf-8"))
    repo_sources = json.loads((RESEARCH / "repo_sources.json").read_text(encoding="utf-8"))
    source_pages_path = RESEARCH / "source_pages.json"
    source_pages = json.loads(source_pages_path.read_text(encoding="utf-8")) if source_pages_path.exists() else {}

    # index recovered per-recipe sources by normalized name
    by_name: dict[str, dict] = {}
    for entry in repo_sources.get("enhanced_recipes", []) + repo_sources.get("v2_recipes", []):
        by_name.setdefault(norm(entry["name"]), entry)
    for name, page in source_pages.items():
        if page.get("status") == "ok":
            by_name.setdefault(norm(name), {"name": name, "instructions": page.get("detailed_instructions", ""),
                                            "source": page.get("url", ""), "extra_notes": page.get("extra_notes", "")})

    # flatten with slugs matching client/src/lib/recipes.ts (order + while-loop dedupe)
    flat: list[dict] = []
    used: set[str] = set()
    for category, lst in recipes.items():
        for r in lst:
            base = slugify(r["name"])
            slug, suffix = base, 2
            while slug in used:
                slug = f"{base}-{suffix}"
                suffix += 1
            used.add(slug)
            match = by_name.get(norm(r["name"]))
            flat.append({
                "slug": slug,
                "name": r["name"],
                "category": category,
                "ingredients": r.get("ingredients", []),
                "instructions": r.get("instructions", ""),
                "benefits": r.get("benefits", ""),
                "recovered_detail": (match or {}).get("instructions", ""),
                "recovered_notes": (match or {}).get("extra_notes", ""),
            })

    SHARDS_DIR.mkdir(parents=True, exist_ok=True)
    per = -(-len(flat) // n_shards)  # ceil
    for i in range(n_shards):
        chunk = flat[i * per:(i + 1) * per]
        if not chunk:
            continue
        cats = sorted({r["category"] for r in chunk})
        shard = {
            "shard": i + 1,
            "recipes": chunk,
            "method_templates": {k: templates[k] for c in cats for k in TEMPLATE_KEYS.get(c, []) if k in templates},
            "general_methods": {k: repo_sources.get("general_methods", {}).get(k, "")
                                for c in cats for k in GENERAL_KEYS.get(c, [])},
        }
        out = SHARDS_DIR / f"input-{i + 1}.json"
        out.write_text(json.dumps(shard, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"shard {i + 1}: {len(chunk)} recipes, categories {cats}, {out.stat().st_size // 1024}KB")

    matched = sum(1 for r in flat if r["recovered_detail"])
    print(f"total recipes: {len(flat)} | with recovered per-recipe detail: {matched}")


if __name__ == "__main__":
    main()
