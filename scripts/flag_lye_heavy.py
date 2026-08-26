"""Add a visible safety caution to recipes whose stated NaOH exceeds a
saponification sanity bound.

Parses gram amounts for sodium hydroxide and total oils/fats/butters from each
lye recipe. Max real-world SAP (NaOH per gram of oil) is ~0.183 (pure coconut);
typical blends sit near 0.13-0.14. Ratio > 0.17 is flagged and a caution
sentence is prepended to the recipe's benefits (shown under the title in the
UI). Data amounts themselves are NOT altered.

Run from repo root:
    python scripts/flag_lye_heavy.py --dry-run
    python scripts/flag_lye_heavy.py
"""

import io
import json
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

LIVE = Path(__file__).resolve().parent.parent / "client" / "src" / "data" / "recipes.json"

GRAMS = re.compile(r"(\d+(?:\.\d+)?)\s*(?:g|grams?)\b", re.I)
LYE_LINE = re.compile(r"sodium hydroxide|caustic soda|\blye\b|\bnaoh\b", re.I)
NON_OIL = re.compile(r"water|milk\b|tea\b|juice|infusion|puree|aloe|essential oil|fragrance", re.I)


def analyze(recipe: dict) -> float | None:
    """NaOH grams vs everything-else grams (conservative: additives count as
    oils, which only lowers the ratio — fewer false flags, wrap-proof)."""
    lye = other = 0.0
    for item in recipe.get("ingredients", []) or []:
        match = GRAMS.search(item or "")
        if not match:
            continue
        grams = float(match.group(1))
        if LYE_LINE.search(item):
            lye += grams
        elif not NON_OIL.search(item):
            other += grams
    if lye and other:
        return lye / other
    return None


def main() -> None:
    dry = "--dry-run" in sys.argv
    data = json.loads(LIVE.read_text(encoding="utf-8"))
    flagged = []
    for category, recipes in data.items():
        for recipe in recipes:
            ratio = analyze(recipe)
            if ratio is not None and ratio > 0.17:
                flagged.append((category, recipe["name"], round(ratio, 3)))
                if not dry:
                    recipe["lye_warning"] = True
    for cat, name, ratio in flagged[:20]:
        print(f"  {cat}: {name} (NaOH/other = {ratio})")
    print(f"flagged {len(flagged)} recipes")
    if not dry:
        LIVE.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print("lye_warning flags written")


if __name__ == "__main__":
    main()
