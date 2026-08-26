"""Targeted repairs for three data quirks flagged during guide generation.

1. Tropical Paradise (Cold Process): the source scrape appended ~15 unrelated
   melt-and-pour recipes after its own "Useful tips" — truncate at the next
   book recipe heading ("35. Fairy Tale").
2. Grapefruit and Bergamot Soap: the ENTIRE ingredient block of the book's
   Lavender & Shea Butter soap (Oils:/Lye Solution:/Additives: with lavender
   EO/buds/purple colorant) was appended after its 6 real ingredients — drop
   items 6+ (boundary = the "Oils:" header).
3. Cedarwood and Rose Soap: step 5 says "patchouli and lavender essential
   oils" (copy-paste from another recipe); its actual ingredients are
   cedarwood EO + rose fragrance oil.

Run from repo root:  python scripts/fix_data_quirks.py
"""

import io
import json
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

LIVE = Path(__file__).resolve().parent.parent / "client" / "src" / "data" / "recipes.json"


def main() -> None:
    data = json.loads(LIVE.read_text(encoding="utf-8"))
    fixed = []

    for recipe in data["Cold Process"]:
        name = recipe["name"]
        if name == "Tropical Paradise":
            marker = "\n35. Fairy Tale"
            index = recipe["instructions"].find(marker)
            if index > 0:
                recipe["instructions"] = recipe["instructions"][:index].rstrip()
                fixed.append(f"{name}: instructions truncated to {len(recipe['instructions'])} chars")
        elif name == "Grapefruit and Bergamot Soap":
            if "Oils:" in recipe["ingredients"]:
                boundary = recipe["ingredients"].index("Oils:")
                recipe["ingredients"] = recipe["ingredients"][:boundary]
                fixed.append(f"{name}: ingredients trimmed to {boundary} items")
        elif name == "Cedarwood and Rose Soap":
            wrong = "Add patchouli and lavender essential oils"
            right = "Add the cedarwood essential oil and rose fragrance oil"
            if wrong in recipe["instructions"]:
                recipe["instructions"] = recipe["instructions"].replace(wrong, right)
                fixed.append(f"{name}: step 5 essential oils corrected")

    for line in fixed:
        print(" ", line)
    if len(fixed) != 3:
        print(f"WARNING: expected 3 fixes, applied {len(fixed)} — check markers")
    LIVE.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("recipes.json rewritten")


if __name__ == "__main__":
    main()
