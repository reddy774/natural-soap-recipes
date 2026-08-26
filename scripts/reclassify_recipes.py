"""Reclassify non-soap recipes that the PDF import mis-filed as Cold Process.

Detection (name + ingredients + instructions text):
  - soap:      mentions lye/sodium hydroxide/caustic soda, or a melt-and-pour
               soap base -> stays where it is
  - beverage:  drinkable items (teas, milks, spritzers, juices) -> moved OUT of
               the site data into recipes_offtopic.json (quarantine, not deleted)
  - topical:   rollerball perfume blends, room/linen sprays, bath salts,
               diffuser blends, deodorizers -> moved to Remedies
  - other non-soap stays put and is listed for manual review.

Run from repo root:
    python scripts/reclassify_recipes.py --dry-run   # report only
    python scripts/reclassify_recipes.py             # apply
"""

import io
import json
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

DATA = Path(__file__).resolve().parent.parent / "client" / "src" / "data"
LIVE = DATA / "recipes.json"
OFFTOPIC = DATA / "recipes_offtopic.json"

SOAP = re.compile(r"\b(lye|sodium hydroxide|caustic soda|naoh|soap base|melt[- ]and[- ]pour|rebatch)\b", re.I)
BEVERAGE = re.compile(
    r"\b(iced tea|herbal tea|tea blend|steep|spritzer|smoothie|drink|beverage|"
    r"warm milk|spiced milk|golden milk|latte|juice|sip|mug|serve (chilled|warm|hot)|drinking glass|"
    r"ice cubes|pitcher|garnish|molasses|frothy)\b", re.I)
TOPICAL = re.compile(
    r"\b(roller[- ]?ball|rollerball|roll[- ]on|room spray|linen spray|pillow spray|"
    r"bath salt|diffuser|deodoriz|air freshen|perfume blend|fragrance blend|carrier oil.*roller|inhaler|"
    r"spray bottle|epsom salt|scented (salt|baking soda|powder))\b", re.I)


def text_of(recipe: dict) -> str:
    return " ".join([recipe.get("name", ""), " ".join(recipe.get("ingredients", []) or []),
                     recipe.get("instructions", ""), recipe.get("benefits", "")])


# hand-reviewed items the signal regexes cannot catch
FORCE_BEVERAGE = {"Cedarwood Comfort"}  # warm spiced almond-milk drink


def classify(recipe: dict) -> str:
    if recipe.get("name") in FORCE_BEVERAGE:
        return "beverage"
    text = text_of(recipe)
    if SOAP.search(text):
        return "soap"
    if BEVERAGE.search(text):
        return "beverage"
    if TOPICAL.search(text):
        return "topical"
    return "other"


def main() -> None:
    dry = "--dry-run" in sys.argv
    data = json.loads(LIVE.read_text(encoding="utf-8"))

    moved_remedies, quarantined, review = [], [], []
    new_data = {cat: [] for cat in data}

    for category, recipes in data.items():
        for recipe in recipes:
            if category not in ("Hot Process", "Cold Process"):
                new_data[category].append(recipe)
                continue
            kind = classify(recipe)
            if kind == "soap":
                new_data[category].append(recipe)
            elif kind == "beverage":
                quarantined.append(recipe)
            elif kind == "topical":
                entry = dict(recipe)
                entry["type"] = "Remedies"
                new_data["Remedies"].append(entry)
                moved_remedies.append(recipe["name"])
            else:
                review.append(recipe["name"])
                new_data[category].append(recipe)

    print(f"moved to Remedies ({len(moved_remedies)}):", *[f"  {n}" for n in moved_remedies[:10]], sep="\n")
    print(f"quarantined beverages ({len(quarantined)}):", *[f"  {r['name']}" for r in quarantined[:10]], sep="\n")
    print(f"kept but flagged 'other' — no soap/beverage/topical signal ({len(review)}):",
          *[f"  {n}" for n in review[:20]], sep="\n")
    print("new totals:", {c: len(r) for c, r in new_data.items()},
          "| grand:", sum(len(r) for r in new_data.values()))

    if dry:
        print("(dry run — nothing written)")
        return
    LIVE.write_text(json.dumps(new_data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    OFFTOPIC.write_text(json.dumps({"quarantined_beverages": quarantined}, ensure_ascii=False, indent=1) + "\n",
                        encoding="utf-8")
    print(f"wrote {LIVE.name} and {OFFTOPIC.name}")


if __name__ == "__main__":
    main()
