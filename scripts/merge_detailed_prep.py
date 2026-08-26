"""Validate and merge generated guide shards into detailed_prep.json.

Reads scripts/research/shards/output-*.json (each: {slug: DetailedGuide}) and
merges into client/src/data/detailed_prep.json. Validates each guide against
the DetailedGuide shape used by client/src/lib/detailedPrep.ts and checks the
slug exists in the live recipe set.

Run from repo root:
    python scripts/merge_detailed_prep.py
"""

import io
import json
import re
import sys
import unicodedata
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

REPO = Path(__file__).resolve().parent.parent
SHARDS_DIR = REPO / "scripts" / "research" / "shards"
TARGET = REPO / "client" / "src" / "data" / "detailed_prep.json"


def slugify(name: str) -> str:
    # Mirrors slugifyName() in client/src/lib/recipes.ts exactly
    slug = re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", name.lower())).strip("-")
    return slug or "recipe"


def live_slugs() -> set[str]:
    recipes = json.loads((REPO / "client" / "src" / "data" / "recipes.json").read_text(encoding="utf-8"))
    slugs: set[str] = set()
    for lst in recipes.values():
        for r in lst:
            base = slugify(r["name"])
            slug, suffix = base, 2
            while slug in slugs:
                slug = f"{base}-{suffix}"
                suffix += 1
            slugs.add(slug)
    return slugs


def valid_guide(guide: dict) -> str | None:
    """Return an error string, or None if the guide is well-formed."""
    sections = guide.get("sections")
    if not isinstance(sections, list) or not sections:
        return "missing sections"
    for s in sections:
        if not isinstance(s.get("title"), str) or not s["title"].strip():
            return "section without title"
        steps = s.get("steps")
        if not isinstance(steps, list) or not steps or not all(isinstance(x, str) and x.strip() for x in steps):
            return f"bad steps in section {s.get('title')!r}"
    for key in ("tips", "sources"):
        if key in guide and not (isinstance(guide[key], list) and all(isinstance(x, str) for x in guide[key])):
            return f"bad {key}"
    if "cure_and_storage" in guide and not isinstance(guide["cure_and_storage"], str):
        return "bad cure_and_storage"
    total_steps = sum(len(s["steps"]) for s in sections)
    if total_steps < 5:
        return f"too thin ({total_steps} steps)"
    return None


def main() -> None:
    slugs = live_slugs()
    merged = json.loads(TARGET.read_text(encoding="utf-8")) if TARGET.exists() else {}

    added, replaced, rejected, unknown = 0, 0, [], []
    for shard_file in sorted(SHARDS_DIR.glob("output-*.json")):
        data = json.loads(shard_file.read_text(encoding="utf-8"))
        for slug, guide in data.items():
            if slug not in slugs:
                unknown.append(f"{shard_file.name}:{slug}")
                continue
            err = valid_guide(guide)
            if err:
                rejected.append(f"{shard_file.name}:{slug} ({err})")
                continue
            if slug in merged:
                replaced += 1
            else:
                added += 1
            merged[slug] = {k: guide[k] for k in ("sections", "tips", "cure_and_storage", "sources") if k in guide}

    TARGET.write_text(json.dumps(merged, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"added {added}, replaced {replaced}, total guides {len(merged)} / {len(slugs)} recipes")
    print(f"file size: {TARGET.stat().st_size // 1024}KB")
    if unknown:
        print(f"UNKNOWN SLUGS ({len(unknown)}):", *unknown[:10], sep="\n  ")
    if rejected:
        print(f"REJECTED ({len(rejected)}):", *rejected[:15], sep="\n  ")


if __name__ == "__main__":
    main()
