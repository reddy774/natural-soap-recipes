# Build scripts/research/repo_sources.json from:
#   1. client/src/data/recipes_enhanced.json  (detailed recipe inventory)
#   2. reddy774/natural-soap-recipes-v2 recipes.json (entries with instructions > 500 chars)
#   3. Soap-academy PDFs (general "how to make soap" method chapters)
# Run: python extract_sources.py   (from anywhere; absolute paths inside)
import sys
import io
import json
import re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
import fitz

RESEARCH = r"C:\Users\Daya\natural-soap-recipes\scripts\research"
ENHANCED = r"C:\Users\Daya\natural-soap-recipes\client\src\data\recipes_enhanced.json"
V2_RAW = RESEARCH + r"\_v2_recipes_raw.json"
ACADEMY = r"C:\Users\Daya\Downloads\soap academy"

# ---------------- text cleaning helpers ----------------
BULLET_RE = re.compile(r"^\s*(?:[-–—•·*]|\d{1,2}[\.\)])\s+")
GLYPHS = {"\uf0b7": "-", "\u2022": "-", "\u00b7": "-", "\ufb01": "fi", "\ufb02": "fl",
          "\u2019": "'", "\u2018": "'", "\u201c": '"', "\u201d": '"', "\u00a0": " "}


def clean_markdown(s):
    """Strip markdown artifacts left by a bad LLM export (e.g. 'Recipe Name:** X')."""
    if not isinstance(s, str):
        return s
    s = s.strip()
    s = re.sub(r"^(?:recipe name|name)\s*:?\s*\*{1,3}\s*", "", s, flags=re.I)
    s = re.sub(r"^\*{1,3}\s*", "", s)
    s = re.sub(r"\*{2,3}", "", s)  # leftover bold markers mid-text
    return s.strip()


def rejoin_pdf_lines(raw_lines):
    """Drop page numbers / decoration, then rejoin hard-wrapped lines into paragraphs."""
    lines = []
    for l in raw_lines:
        l = l.strip()
        for k, v in GLYPHS.items():
            l = l.replace(k, v)
        if not l:
            continue
        if re.fullmatch(r"\d{1,3}", l):        # bare page number
            continue
        if re.fullmatch(r"[_\-\s.]{5,}", l):   # separator rules like "_ _ _ _"
            continue
        lines.append(l)
    out = []
    for l in lines:
        starts_block = bool(BULLET_RE.match(l)) or l.endswith(":") and len(l) < 80
        if out and not BULLET_RE.match(l):
            prev = out[-1]
            prev_open = not re.search(r"[.:!?]$", prev)
            if prev_open and not starts_block:
                out[-1] = prev + " " + l
                continue
        out.append(l)
    return "\n".join(out)


def pdf_pages_text(path, pages):
    """pages: list of 1-based page numbers."""
    d = fitz.open(path)
    chunks = []
    for p in pages:
        chunks.append(rejoin_pdf_lines(d[p - 1].get_text().splitlines()))
    d.close()
    return "\n".join(c for c in chunks if c)


# ---------------- 1. recipes_enhanced.json ----------------
with open(ENHANCED, encoding="utf-8") as f:
    enh = json.load(f)

enhanced_recipes = []
enh_skipped = 0
for cat, lst in enh.items():
    for e in lst:
        name = clean_markdown(e.get("name") or "")
        instructions = clean_markdown(e.get("instructions") or "").replace("\\n", "\n")
        ingredients = [i for i in (e.get("ingredients") or []) if i and i.strip()]
        if name.startswith("---") or (not instructions and not ingredients):
            enh_skipped += 1
            continue
        rec = {
            "name": name,
            "type": e.get("type") or cat.replace("_", " ").title(),
            "ingredients": ingredients,
            "instructions": instructions,
            "source": "recipes_enhanced.json",
        }
        if e.get("source_url"):
            rec["source_url"] = e["source_url"]
        if e.get("benefits"):
            rec["benefits"] = clean_markdown(e["benefits"])
        enhanced_recipes.append(rec)

# ---------------- 2. v2 repo recipes.json ----------------
with open(V2_RAW, encoding="utf-8") as f:
    v2 = json.load(f)

v2_recipes = []
for cat, lst in v2.items():
    for e in lst:
        ins = e.get("instructions") or ""
        if isinstance(ins, list):
            ins = "\n".join(str(x) for x in ins)
        ins = clean_markdown(str(ins)).replace("\\n", "\n")
        if len(ins) <= 500:
            continue
        name = clean_markdown(e.get("name") or "")
        if name.startswith("---"):
            continue
        ingredients = [i for i in (e.get("ingredients") or []) if i and str(i).strip()]
        rec = {
            "name": name,
            "type": e.get("type") or cat,
            "ingredients": ingredients,
            "instructions": ins,
            "source": "v2-repo",
        }
        if e.get("source_url"):
            rec["source_url"] = e["source_url"]
        if e.get("benefits"):
            rec["benefits"] = clean_markdown(e["benefits"])
        v2_recipes.append(rec)

# ---------------- 3. PDF general methods ----------------
cp_pdf = ACADEMY + r"\NEW!!! Cold Process Soap Recipes (1).pdf"
easy_pdf = ACADEMY + r"\easy soap academy - 32 Recipes.pdf"
jp_pdf = ACADEMY + r"\Japanese Technique for handmade soap making.pdf"
sh_pdf = ACADEMY + r"\shampoo and conditioner bar\Shampoo and conditioner bar recipe pdf.pdf"
howto_pdf = ACADEMY + r"\New Version!!! 430 Soap Recipes\New Version - HowToMakeSoap_compressed.pdf"

# Cold process = intro/method chapter of the CP book (p3-10)
#   + easy soap academy welcome/equipment/basic-steps (p1-2, 4-6) + mold-scaling appendix (p134-135)
cold_process = (
    "== From 'Cold Process Soap Recipes' (intro & method chapter) ==\n"
    + pdf_pages_text(cp_pdf, [3, 4, 5, 6, 7, 8, 9, 10])
    + "\n\n== From 'Easy Soap Academy - 32 Recipes' (welcome, equipment, basic steps) ==\n"
    + pdf_pages_text(easy_pdf, [1, 2, 4, 5, 6])
    + "\n\n== From 'Easy Soap Academy - 32 Recipes' (appendix: mold capacity & recipe scaling) ==\n"
    + pdf_pages_text(easy_pdf, [134, 135])
)

# Japanese technique = whole booklet body (p3-32): 7 recipes, each with a detailed
# Note + step-by-step Method section (the booklet has no separate intro chapter).
japanese_technique = pdf_pages_text(jp_pdf, list(range(3, 33)))

# Shampoo bars = whole 8-page PDF (syndet shampoo bar + conditioner bar:
# ingredient roles, directions, essential-oil blends, INCI lists).
shampoo_bars = pdf_pages_text(sh_pdf, list(range(1, 9)))

# The 430-recipes 'HowToMakeSoap' book is 50 Ingredients/Instructions spreads,
# every one repeating the same basic method skeleton; capture the canonical
# method paragraph once (from p3), minus the recipe-specific benefits part.
howto_p3 = pdf_pages_text(howto_pdf, [3])
basic = howto_p3.split("Health Benefits:")[0]
basic = re.sub(r"^Instructions\s*", "", basic).strip()
basic_method = (
    "Standard method repeated for every recipe in 'New Version - HowToMakeSoap' "
    "(430 Soap Recipes book), generic skeleton:\n" + basic
)

general_methods = {
    "cold_process": cold_process,
    "hot_process": "",   # not covered by any of the 5 soap-academy PDFs (0 mentions)
    "melt_and_pour": "",  # not covered by any of the 5 soap-academy PDFs (0 mentions)
    "shampoo_bars": shampoo_bars,
    "japanese_technique": japanese_technique,
    "basic_method_430_book": basic_method,
    "notes": (
        "hot_process and melt_and_pour: none of the soap-academy PDFs contain hot-process or "
        "melt-and-pour method text (verified by full-text search). Most detailed hot-process "
        "instructions available are the per-recipe entries in enhanced_recipes (hot_process, "
        "780-1315 chars each). basic_method_430_book is the generic lye-soap skeleton the "
        "430-recipes book repeats on every instruction page."
    ),
}

out = {
    "enhanced_recipes": enhanced_recipes,
    "v2_recipes": v2_recipes,
    "general_methods": general_methods,
}
dest = RESEARCH + r"\repo_sources.json"
with open(dest, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print("wrote", dest)
print("enhanced_recipes:", len(enhanced_recipes), f"(skipped {enh_skipped} separator/empty entries)")
print("v2_recipes (>500 char instructions):", len(v2_recipes))
for k in ("cold_process", "shampoo_bars", "japanese_technique", "basic_method_430_book"):
    print(f"general_methods.{k}: {len(general_methods[k])} chars")
print("v2 by type:", {})
from collections import Counter
print("v2 types:", dict(Counter(r["type"] for r in v2_recipes)))
print("enhanced types:", dict(Counter(r["type"] for r in enhanced_recipes)))
