"""Data-cleanup pass over the ORIGINAL entries in recipes.json.

Repairs (all reviewed by hand against the raw data, 2026-08-26):
  - names: strip leading "NN. " numbering, surrounding quotes, trailing ".:"
  - ingredients stored as a JSON-encoded STRING (6 Cold Process recipes) -> parsed
  - the "mash-up" scrape artifact (41 Scrubs): the ingredients array embeds
    "Ingredients:" / "Steps:" / "Benefits:" sections + page numbers + wrapped
    lines -> split into real ingredients, numbered instructions, and benefits
  - benefits: truncate embedded "Ingredients" dumps
  - structured_ingredients: keep only well-formed {amount, unit, name} entries
  - bespoke repairs/merges/drops for individually broken recipes (see BESPOKE)

Run from repo root:
    python scripts/clean_recipes.py --dry-run   # report only
    python scripts/clean_recipes.py             # apply
"""

import io
import json
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

LIVE = Path(__file__).resolve().parent.parent / "client" / "src" / "data" / "recipes.json"

BULLETS = "●○■▪•"
HEADER_LINE = re.compile(r"^(ingredients?( list)?|method|instructions?|directions?|procedure)\s*:?\s*$", re.I)
SECTION = re.compile(r"^(ingredients?|steps?|benefits?)\s*:\s*$", re.I)
LEADING_NUM = re.compile(r"^\s*\d{1,3}\.\s*")
PAGE_NUM = re.compile(r"^\d{1,3}$")

DROP = {
    # fragment of a scrub recipe, wrong category, no header/steps 1-2
    "Zest of 1 lime",
    # mangled blob: own ingredients missing; contains a different complete
    # recipe which is salvaged below as Orange Vanilla Dream Body Butter
    "Lavender Bliss Body Lotion:",
    # page-2 continuation of Jasmine Vanilla Tranquility (merged below)
    "Jasmine Vanilla Dream Bath Bomb",
}

SALVAGED_LOTION = {
    "name": "Orange Vanilla Dream Body Butter",
    "type": "Lotion",
    "ingredients": [
        "1/4 cup cocoa butter",
        "1/4 cup coconut oil",
        "2 tablespoons sweet almond oil",
        "10 drops orange essential oil",
        "5 drops vanilla essential oil",
    ],
    "instructions": (
        "1. In a heat-safe bowl, combine cocoa butter, coconut oil, and sweet almond oil.\n"
        "2. Place the bowl over a pot of simmering water to create a double boiler.\n"
        "3. Stir the mixture until all ingredients are melted and well combined.\n"
        "4. Remove from heat and allow the mixture to cool slightly before adding orange and vanilla essential oils.\n"
        "5. Mix well and transfer the body butter to a clean jar or container.\n"
        "6. Let the body butter cool and set at room temperature."
    ),
    "source_url": "",
    "benefits": "Rich cocoa and coconut butters deeply moisturize while orange and vanilla give a warm, dessert-like scent.",
}


def strip_bullet(text: str) -> str:
    return text.strip().lstrip(BULLETS + "- ").strip()


def clean_name(name: str) -> str:
    name = LEADING_NUM.sub("", name.strip())
    name = name.strip(" \"'“”")
    return name.rstrip(".:").strip()


def join_wrapped(lines: list[str]) -> list[str]:
    """Re-join lines that were wrapped mid-sentence by the PDF layout.

    Only a lowercase-starting line is treated as a continuation — anything
    stronger falsely merges adjacent short ingredient lines.
    """
    out: list[str] = []
    for line in lines:
        if out and line[:1].islower():
            out[-1] = f"{out[-1]} {line}"
        else:
            out.append(line)
    return out


def ingredients_from_benefits(benefits: str) -> list[str]:
    """Recover an ingredient list embedded in a benefits dump."""
    parts = re.split(r"\n\s*ingredients?( list)?\s*:?\s*\n", benefits, maxsplit=1, flags=re.I)
    if len(parts) < 3:
        return []
    out = []
    for raw in parts[-1].split("\n"):
        line = strip_bullet(raw)
        if not line or len(line) > 100:
            continue
        if re.match(r"^(instructions?|method|directions?|steps?)\s*:?\s*$", line, re.I):
            break
        out.append(line)
    return out


def parse_sections(lines: list[str], start: str) -> dict[str, list[str]]:
    """State machine over bulleted lines, split at Ingredients:/Steps:/Benefits: headers."""
    sections: dict[str, list[str]] = {"ingredients": [], "steps": [], "benefits": []}
    current = start
    for raw in lines:
        item = strip_bullet(raw or "")
        if not item or PAGE_NUM.match(item):
            continue
        match = SECTION.match(item)
        if match:
            word = match.group(1).lower()
            current = "steps" if word.startswith("step") else ("benefits" if word.startswith("benefit") else "ingredients")
            continue
        sections[current].append(item)
    return sections


def unmash(recipe: dict) -> bool:
    """Fix the embedded Ingredients:/Steps:/Benefits: scrape artifact in-place.

    Two shapes exist: (a) everything mashed into the ingredients array with the
    old instructions field holding trailing benefit lines, and (b) ingredients
    in the array but the bulleted "Steps:"/"Benefits:" text in the instructions
    field. Already well-formed numbered instructions are kept verbatim.
    """
    items = recipe.get("ingredients")
    if not isinstance(items, list) or not any(SECTION.match(strip_bullet(i or "")) for i in items):
        return False

    old_instr = recipe.get("instructions") or ""
    sections = parse_sections(items, "ingredients")
    recipe["ingredients"] = join_wrapped(sections["ingredients"])
    benefits = sections["benefits"]

    if sections["steps"]:
        # shape (a): steps were in the array; old instructions = benefit tail
        steps = join_wrapped(sections["steps"])
        recipe["instructions"] = "\n".join(f"{i}. {LEADING_NUM.sub('', s)}" for i, s in enumerate(steps, 1))
        benefits = benefits + [
            l for l in (strip_bullet(x) for x in old_instr.split("\n")) if l and not PAGE_NUM.match(l)
        ]
    elif re.match(r"^\s*1\.\s", old_instr):
        # instructions are already numbered prose — keep them untouched
        pass
    elif re.search(r"steps?\s*:", old_instr, re.I):
        # shape (b): bulleted Steps:/Benefits: text lives in the instructions field
        instr_sections = parse_sections(old_instr.split("\n"), "steps")
        steps = join_wrapped(instr_sections["steps"] + instr_sections["ingredients"])
        recipe["instructions"] = "\n".join(f"{i}. {LEADING_NUM.sub('', s)}" for i, s in enumerate(steps, 1))
        benefits = benefits + instr_sections["benefits"]

    joined = " ".join(join_wrapped(benefits)).strip()
    if joined:
        recipe["benefits"] = joined
    return True


def bespoke(recipe: dict) -> None:
    name = recipe["name"]
    if name == "Tropical Paradise Tropical colors and motifs":
        recipe["name"] = "Tropical Paradise"
        recipe["ingredients"] = [
            "Melt and pour soap base",
            "Soap colorants (tropical colors such as green, blue, yellow, pink, and orange)",
            "Fragrance oils (coconut, pineapple, or other tropical scents)",
        ]
        recipe["instructions"] = (
            "1. Prepare your workspace by setting out all materials and tools. "
            "Make sure the area is clean and free of clutter.\n" + recipe["instructions"]
        )
    elif name == "Jasmine Vanilla Tranquility Bath Bomb":
        recipe["instructions"] = (
            "1. Combine baking soda, citric acid, Epsom salt, and cornstarch in a mixing bowl.\n"
            "2. Add sweet almond oil, dried jasmine flowers, jasmine essential oil, and vanilla "
            "essential oil. Mix until well combined.\n"
            "3. Pack the mixture into molds and let them dry for 24 hours.\n"
            "4. Once dry, remove from molds and store in an airtight container."
        )
    elif name == "Air Purifying Diffuser Blend":
        recipe["ingredients"] = [
            "3 drops Lemon Essential Oil (Citrus limon)",
            "3 drops Tea Tree Essential Oil (Melaleuca alternifolia)",
            "3 drops Lavender Essential Oil (Lavandula angustifolia)",
        ]
        recipe["benefits"] = "A light, refreshing blend to freshen your space and lift your mood."
        recipe["instructions"] = (
            "1. Add all three essential oils to your diffuser with water to the fill line.\n"
            "2. For kids and pets: halve the drops.\n"
            "3. Alternative: add 3 drops of each oil to a personal inhaler."
        )


def clean_benefits(benefits: str) -> str:
    if not benefits:
        return ""
    cut = re.split(r"\n\s*ingredients?( list)?\s*:?\s*\n", benefits, maxsplit=1, flags=re.I)
    return cut[0].strip()


def main() -> None:
    dry = "--dry-run" in sys.argv
    data = json.loads(LIVE.read_text(encoding="utf-8"))

    stats = {"renamed": 0, "dropped": 0, "unmashed": 0, "parsed_string": 0,
             "structured_pruned": 0, "recovered_ingredients": 0, "deduped": 0}
    cleaned: dict[str, list[dict]] = {}
    seen_names: set[str] = set()

    for category, recipes in data.items():
        kept = []
        for recipe in recipes:
            if recipe["name"] in DROP:
                stats["dropped"] += 1
                continue
            entry = dict(recipe)
            original_benefits = entry.get("benefits") or ""

            # JSON-encoded string ingredients -> list
            if isinstance(entry.get("ingredients"), str):
                try:
                    parsed = json.loads(entry["ingredients"])
                    if isinstance(parsed, list):
                        entry["ingredients"] = parsed
                        stats["parsed_string"] += 1
                except ValueError:
                    entry["ingredients"] = [entry["ingredients"]]

            new_name = clean_name(entry["name"])
            if new_name != entry["name"]:
                stats["renamed"] += 1
            entry["name"] = new_name

            # the mash-up pattern consumes the old instructions tail as benefits
            entry["benefits_tail"] = entry.get("instructions", "") if any(
                SECTION.match(strip_bullet(i or ""))
                for i in (entry.get("ingredients") or [])
                if isinstance(i, str)
            ) else ""
            if unmash(entry):
                stats["unmashed"] += 1
            entry.pop("benefits_tail", None)

            entry["benefits"] = clean_benefits(entry.get("benefits") or "")
            entry["ingredients"] = [
                strip_bullet(i) for i in entry["ingredients"] if strip_bullet(i) and not HEADER_LINE.match(strip_bullet(i))
            ]
            benefit_head = entry["benefits"].split("\n")[0].strip()
            entry["ingredients"] = [i for i in entry["ingredients"] if i != benefit_head]
            if len(entry["ingredients"]) < 2:
                recovered = ingredients_from_benefits(original_benefits)
                if recovered:
                    entry["ingredients"] = recovered
                    stats["recovered_ingredients"] += 1

            if "structured_ingredients" in entry:
                good = [e for e in entry["structured_ingredients"] if e.get("name") and e.get("amount") is not None]
                if not good:
                    del entry["structured_ingredients"]
                    stats["structured_pruned"] += 1
                else:
                    entry["structured_ingredients"] = good

            bespoke(entry)
            norm = re.sub(r"[^a-z0-9]", "", entry["name"].lower())
            if norm in seen_names:
                stats["deduped"] += 1
                continue
            seen_names.add(norm)
            kept.append(entry)
        cleaned[category] = kept

    cleaned["Lotions"] = cleaned.get("Lotions", []) + [SALVAGED_LOTION]

    print("stats:", stats)
    print("totals:", {c: len(r) for c, r in cleaned.items()})
    if dry:
        print("(dry run — nothing written)")
        return
    LIVE.write_text(json.dumps(cleaned, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("recipes.json rewritten")


if __name__ == "__main__":
    main()
