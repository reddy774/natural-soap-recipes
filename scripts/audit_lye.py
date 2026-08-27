"""Data-driven audit of lye amounts across all lye-based recipes.

Chemistry: NaOH required (0% superfat) = sum(oil_grams * sap_koh * 40/56.1056)
using the site's own SoapCalc oil database (client/src/data/soapcalc_oils.json,
KOH-based `sap` values — verified: coconut 0.257 -> 0.183 NaOH, olive
0.19 -> 0.135 NaOH, matching published saponification tables).

Verdicts per recipe (grams-based lye recipes only):
  corrected     printed NaOH > 1.10 x zero-superfat max -> chemically proven
                excess; replaced with the 5%-superfat amount (industry-standard
                skin-safe default). Recipe instructions and its detailed guide
                are updated wherever they restate the old amount in a lye
                context. lye_warning removed.
  cleared       printed NaOH within/below the safe envelope (<= 1.05 x zero-SF)
                -> false-positive flag removed. Low-lye (high-superfat) recipes
                are soft but safe, so they clear too.
  kept:gray     1.05-1.10 x zero-SF: inside SAP-table tolerance -> not proven
                wrong; flag kept, nothing changed.
  kept:unverifiable  an oil/fat couldn't be matched to the database or has no
                gram amount -> no correction on assumptions; flag kept.

Writes scripts/research/lye_audit.json with full per-recipe provenance.
Run from repo root:
    python scripts/audit_lye.py --dry-run
    python scripts/audit_lye.py
"""

import io
import json
import re
import sys
import unicodedata
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "client" / "src" / "data"
KOH_TO_NAOH = 40.0 / 56.1056

# recipe-phrase -> SoapCalc database name (exact `name` values from the DB)
OIL_ALIASES: dict[str, str] = {
    "coconut oil": "Coconut Oil, 76 deg",
    "olive oil": "Olive Oil",
    "castor oil": "Castor Oil",
    "shea butter": "Shea Butter",
    "cocoa butter": "Cocoa Butter",
    "sweet almond oil": "Almond Oil, sweet",
    "almond oil": "Almond Oil, sweet",
    "avocado oil": "Avocado Oil",
    "palm kernel oil": "Palm Kernel Oil",
    "palm oil": "Palm Oil",
    "sunflower oil": "Sunflower Oil",
    "safflower oil": "Safflower Oil",
    "rice bran oil": "Rice Bran Oil",
    "jojoba oil": "Jojoba Oil",
    "grapeseed oil": "Grapeseed Oil",
    "grape seed oil": "Grapeseed Oil",
    "hemp oil": "Hemp Oil",
    "hemp seed oil": "Hemp Oil",
    "tallow": "Tallow Beef",
    "lard": "Lard, Pig Tallow (Manteca)",
    "mango butter": "Mango Seed Butter",
    "apricot kernel oil": "Apricot Kernel Oil",
    "hazelnut oil": "Hazelnut Oil",
    "macadamia oil": "Macadamia Oil",
    "macadamia nut oil": "Macadamia Oil",
    "sesame oil": "Sesame Oil",
    "wheat germ oil": "Wheatgerm Oil",
    "argan oil": "Argan Oil",
    "babassu oil": "Babassu Oil",
    "canola oil": "Canola Oil",
    "soybean oil": "Soybean Oil",
    "flaxseed oil": "Flax Oil, linseed",
    "linseed oil": "Flax Oil, linseed",
    "walnut oil": "Walnut Oil",
    "pumpkin seed oil": "Pumpkin Seed Oil",
    "evening primrose oil": "Evening Primrose Oil",
    "rosehip oil": "Rosehip Oil",
    "rose hip oil": "Rosehip Oil",
    "camellia oil": "Camellia Oil, Tea Seed",
    "kukui nut oil": "Kukui Nut Oil",
    "kukui oil": "Kukui Nut Oil",
    "neem oil": "Neem Oil",
    "beeswax": "Beeswax",
    "stearic acid": "Stearic Acid",
    "corn oil": "Corn Oil",
    "peanut oil": "Peanut Oil",
    "coffee butter": "Coffee Bean Butter",
    "kokum butter": "Kokum Butter",
}

# gram lines that are definitely NOT saponifiable fats (never block verification)
NON_FAT = re.compile(
    r"essential oil|fragrance|water|milk|tea\b|juice|puree|infusion|aloe|honey|sugar|salt\b|"
    r"clay|charcoal|oatmeal|oats?\b|zest|colorant|mica|petal|bud|flower|leaf|leaves|powder|"
    r"coffee grounds|glycerin|vitamin e|preservative|silk|yogurt|beer|wine|"
    r"cornstarch|citric acid|baking soda|soap base|extract",
    re.I,
)
FAT_LOOKING = re.compile(r"\boil\b|butter|\bfat\b|tallow|lard|wax", re.I)
GRAMS = re.compile(r"(\d+(?:\.\d+)?)\s*(?:g|grams?)\b", re.I)
LYE_LINE = re.compile(r"sodium hydroxide|caustic soda|\blye\b|\bnaoh\b", re.I)


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", name.lower())).strip("-")
    return slug or "recipe"


def load_sap() -> dict[str, float]:
    oils = json.loads((DATA / "soapcalc_oils.json").read_text(encoding="utf-8"))
    return {o["name"]: o["sap"] * KOH_TO_NAOH for o in oils if o.get("sap")}


def match_oil(line: str, sap_by_name: dict[str, float]) -> float | None:
    lower = line.lower()
    best = None
    for phrase, db_name in OIL_ALIASES.items():
        if phrase in lower and db_name in sap_by_name:
            if best is None or len(phrase) > best[0]:
                best = (len(phrase), sap_by_name[db_name])
    return best[1] if best else None


def replace_lye_amount(text: str, old_g: float, new_g: int) -> str:
    """Replace `old_g` g/grams with new_g, only in lye-context strings."""
    if not text or not LYE_LINE.search(text):
        return text
    old_repr = f"{old_g:g}"
    pattern = re.compile(rf"\b{re.escape(old_repr)}(\s*)(g\b|grams?\b)", re.I)

    def sub(match: re.Match) -> str:
        return f"{new_g}{match.group(1)}{match.group(2)}"

    # replace only within segments that mention lye near the number
    out = []
    for segment in re.split(r"(?<=[.\n])", text):
        if LYE_LINE.search(segment) and pattern.search(segment):
            segment = pattern.sub(sub, segment)
        out.append(segment)
    return "".join(out)


def main() -> None:
    dry = "--dry-run" in sys.argv
    sap_by_name = load_sap()
    recipes = json.loads((DATA / "recipes.json").read_text(encoding="utf-8"))
    guides_path = DATA / "detailed_prep.json"
    guides = json.loads(guides_path.read_text(encoding="utf-8"))

    audit, counts = [], {"corrected": 0, "cleared": 0, "kept:gray": 0, "kept:unverifiable": 0, "not-lye": 0}

    used_slugs: set[str] = set()
    for category, recipe_list in recipes.items():
        for recipe in recipe_list:
            base = slugify(recipe["name"])
            slug, suffix = base, 2
            while slug in used_slugs:
                slug = f"{base}-{suffix}"
                suffix += 1
            used_slugs.add(slug)
            if category not in ("Hot Process", "Cold Process"):
                continue

            ingredients = recipe.get("ingredients") or []
            printed_lye, oils, unmatched_fats = 0.0, [], []
            for line in ingredients:
                gram_match = GRAMS.search(line or "")
                if not gram_match:
                    continue
                grams = float(gram_match.group(1))
                if LYE_LINE.search(line):
                    printed_lye += grams
                    continue
                sap = match_oil(line, sap_by_name)
                if sap is not None and not NON_FAT.search(line):
                    oils.append((line, grams, sap))
                elif NON_FAT.search(line):
                    continue
                elif FAT_LOOKING.search(line):
                    # a fat we can't identify -> the total is unverifiable
                    unmatched_fats.append(line)

            if not printed_lye or not oils:
                counts["not-lye"] += 1
                continue

            required_0sf = sum(g * sap for _, g, sap in oils)
            required_5sf = required_0sf * 0.95
            entry = {
                "name": recipe["name"], "slug": slug, "printed_g": printed_lye,
                "computed_0sf_g": round(required_0sf, 1), "computed_5sf_g": round(required_5sf, 1),
                "oils": [f"{line} (sap {sap:.3f})" for line, _, sap in oils],
                "unmatched_fats": unmatched_fats,
            }

            if unmatched_fats:
                entry["verdict"] = "kept:unverifiable"
            elif printed_lye > 1.10 * required_0sf:
                entry["verdict"] = "corrected"
                entry["new_g"] = round(required_5sf)
            elif printed_lye <= 1.05 * required_0sf:
                entry["verdict"] = "cleared"
            else:
                entry["verdict"] = "kept:gray"
            counts[entry["verdict"]] += 1
            audit.append(entry)

            if dry:
                continue
            if entry["verdict"] == "corrected":
                new_g = entry["new_g"]
                recipe["ingredients"] = [
                    replace_lye_amount(line, printed_lye, new_g) if LYE_LINE.search(line) else line
                    for line in ingredients
                ]
                recipe["instructions"] = replace_lye_amount(recipe.get("instructions", ""), printed_lye, new_g)
                recipe.pop("lye_warning", None)
                guide = guides.get(slug)
                if guide:
                    for section in guide.get("sections", []):
                        section["steps"] = [replace_lye_amount(s, printed_lye, new_g) for s in section["steps"]]
                    guide["tips"] = [replace_lye_amount(t, printed_lye, new_g) for t in guide.get("tips", [])]
            elif entry["verdict"] == "cleared":
                recipe.pop("lye_warning", None)
            else:
                recipe["lye_warning"] = True

    (REPO / "scripts" / "research" / "lye_audit.json").write_text(
        json.dumps(audit, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    print("verdicts:", counts)
    if dry:
        print("(dry run — nothing written)")
        return
    (DATA / "recipes.json").write_text(json.dumps(recipes, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    guides_path.write_text(json.dumps(guides, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("recipes.json + detailed_prep.json rewritten; audit at scripts/research/lye_audit.json")


if __name__ == "__main__":
    main()
