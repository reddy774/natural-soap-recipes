"""Extract soap/cosmetic recipes from the 'soap academy' PDF collection into
recipes_extracted.json (same shape as the site's recipes.json).

Run:  python scripts/extract_pdf_recipes.py
"""
import io
import json
import os
import re
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import fitz  # pymupdf

BASE = r"C:\Users\Daya\Downloads\soap academy"
SITE_DATA = r"C:\Users\Daya\natural-soap-recipes\client\src\data\recipes.json"
OUT_PATH = r"C:\Users\Daya\natural-soap-recipes\client\src\data\recipes_extracted.json"

CATEGORIES = ["Hot Process", "Cold Process", "Lotions", "Scrubs", "Bath Bombs",
              "Remedies", "Hair Care"]

BULLET_CHARS = "\u25cf\u25a0\u25aa\u2022\u25cb\u00b7\u2023\u25e6\u25b8\uf0b7\u2043"
ZWS = "\u200b\ufeff\u2060"

SECTION_WORDS = {
    "ingredients", "steps", "benefits", "health benefits", "instructions",
    "method", "note", "notes", "directions", "optional ingredients",
    "preparation", "shaping and decoration", "procedure",
}


# ---------------------------------------------------------------- utilities
def strip_bullets(line):
    return line.strip().lstrip(BULLET_CHARS + ZWS + "- ").strip()


def clean_ws(text):
    text = "".join(ch for ch in text if ch not in ZWS)
    return re.sub(r"\s+", " ", text).strip()


def join_wrap(prev, nxt):
    """Join a wrapped continuation line, healing hyphenated breaks."""
    if prev.endswith("-") and nxt and nxt[0].islower():
        return prev + nxt
    return (prev + " " + nxt).strip()


def norm_key(name):
    return re.sub(r"[^a-z0-9]", "", name.lower())


def fingerprint(ingredients):
    return tuple(sorted(norm_key(i) for i in ingredients if norm_key(i)))


def number_steps(steps):
    steps = [clean_ws(re.sub(r"^\d+\.\s*", "", s)) for s in steps if clean_ws(s)]
    return "\n".join(f"{i}. {s}" for i, s in enumerate(steps, 1))


def split_sentences(paragraph):
    paragraph = clean_ws(paragraph)
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])", paragraph)
    return [p.strip() for p in parts if p.strip()]


def page_lines(page):
    return page.get_text().splitlines()


def is_pagenum(line):
    return bool(re.fullmatch(r"\d{1,3}\s*", line))


def merge_label_steps(items, maxlen=48):
    """Merge short 'Label:' items into the following step."""
    out = []
    pending = ""
    for it in items:
        it = clean_ws(it)
        if not it:
            continue
        if it.endswith(":") and len(it) <= maxlen:
            pending = pending + " " + it if pending else it
            continue
        out.append((pending + " " + it).strip() if pending else it)
        pending = ""
    if pending:
        out.append(pending)
    return out


def make_recipe(name, rtype, ingredients, instructions, source, benefits=""):
    return {
        "name": clean_ws(name),
        "type": rtype,
        "ingredients": [clean_ws(i) for i in ingredients if clean_ws(i)],
        "instructions": instructions.strip(),
        "source_url": "",
        "source": source,
        "benefits": clean_ws(benefits),
    }


# ------------------------------------------- family A: bulleted recipe books
# 150SoapMakingRecipies / 200ExoticSoap / 50MediterraneanSoap
def parse_bulleted(doc, source, expand_same_as=False):
    # tokenize: (kind, text)  kind: MARK (bullet-only line), ITEM (bullet+text), TEXT
    tokens = []
    for page in doc:
        for raw in page_lines(page):
            stripped = raw.strip()
            if not stripped or is_pagenum(stripped):
                continue
            core = "".join(ch for ch in stripped if ch not in ZWS).strip()
            if not core:
                tokens.append(("MARK", ""))
                continue
            if core[0] in BULLET_CHARS:
                body = strip_bullets(core)
                tokens.append(("MARK", "") if not body else ("ITEM", body))
            else:
                tokens.append(("TEXT", core))

    def sect_of(text):
        t = text.rstrip(":").strip().lower()
        if t in ("ingredients",):
            return "ing"
        if t in ("steps", "instructions", "method", "preparation"):
            return "steps"
        if t in ("benefits", "health benefits"):
            return "ben"
        return None

    # find titles: token ending with ':' whose next ITEM/TEXT token is Ingredients
    recipes = []
    cur = None
    section = None
    items = None
    new_item = False

    def flush_item():
        pass

    def close():
        nonlocal cur
        if cur and cur["ing"]:
            recipes.append(cur)
        cur = None

    n = len(tokens)
    for idx, (kind, text) in enumerate(tokens):
        if kind == "MARK":
            new_item = True
            continue
        s = sect_of(text)
        # title? ends with ':' and next non-MARK token is an Ingredients header
        if s is None and text.endswith(":"):
            j = idx + 1
            while j < n and tokens[j][0] == "MARK":
                j += 1
            if j < n and sect_of(tokens[j][1]) == "ing":
                title = text.rstrip(":").strip()
                if title.lower() not in SECTION_WORDS and len(title) > 3:
                    close()
                    cur = {"name": title, "ing": [], "steps": [], "ben": []}
                    section = None
                    new_item = False
                    continue
        if cur is None:
            continue
        if s:
            section = s
            new_item = True
            continue
        if section is None:
            continue
        bucket = cur[section]
        if kind == "ITEM" or new_item or not bucket:
            bucket.append(text)
        else:
            bucket[-1] = join_wrap(bucket[-1], text)
        new_item = kind == "ITEM"  # ITEM lines complete; TEXT may continue
        if kind == "ITEM":
            new_item = False  # next TEXT continues this item
        # after a TEXT continuation the next TEXT keeps appending unless a MARK came

    close()

    by_name = {norm_key(r["name"]): r for r in recipes}

    def base_key(name):
        name = re.sub(r"^the\s+", "", name.strip(), flags=re.I)
        name = re.sub(r"\s+recipe$", "", name, flags=re.I)
        return norm_key(name)

    def resolve_ing(r, depth=0):
        out = []
        for item in r["ing"]:
            m = re.match(r"^same as (.+?)\.?$", item.strip(), re.I)
            if m and expand_same_as and depth < 3:
                base = by_name.get(base_key(m.group(1)))
                if base:
                    out.extend(resolve_ing(base, depth + 1))
                    continue
            out.append(item)
        return out

    def resolve_steps(r, depth=0):
        out = []
        for st in r["steps"]:
            m = re.match(r"^follow the same steps as (.+?)(?:,\s*(adding .+))?$",
                         st.strip().rstrip("."), re.I)
            if m and expand_same_as and depth < 3:
                base = by_name.get(base_key(m.group(1)))
                if base:
                    out.extend(resolve_steps(base, depth + 1))
                    if m.group(2):
                        extra = m.group(2)
                        extra = "Add" + extra[len("adding"):]
                        out.append(extra.strip() + ".")
                    continue
            out.append(st)
        return out

    result = []
    for r in recipes:
        steps = merge_label_steps(resolve_steps(r))
        result.append(make_recipe(
            r["name"], "Cold Process", resolve_ing(r),
            number_steps(steps), source, " ".join(r["ben"])))
    return result


# ---------------------------- family B: image books (Ingredients/Instructions
# page pairs, no text titles) — 50SoapBar / 50Fruit / HowToMakeSoap
QTY_RE = re.compile(r"^\d")
CONNECT_ENDS = ("essential", "fragrance", "for", "and", "the", "of", ",", "(", "-",
                "sodium", "dried", "hydroxide")


def parse_ing_block(lines, qty_only=False):
    items = []
    for raw in lines:
        line = clean_ws(strip_bullets(raw))
        if not line or line.lower() in ("ingredients",):
            continue
        if not items:
            items.append(line)
            continue
        prev = items[-1]
        unbalanced = prev.count("(") > prev.count(")")
        if QTY_RE.match(line):
            items.append(line)
        elif qty_only:
            items[-1] = join_wrap(prev, line)
        elif line[0] in "()" or line[0].islower() or unbalanced or \
                line.startswith(("Oil", "Essential Oil", "Fragrance Oil")) or \
                prev.lower().endswith(CONNECT_ENDS) or prev.rstrip().endswith(("Essential", "Fragrance")):
            items[-1] = join_wrap(prev, line)
        else:
            items.append(line)
    return items


EO_NAME_RE = re.compile(r"\b\d+\s*(?:g|ml)?\s*(?:Organic\s+)?([A-Z][A-Za-z ]+?)\s+"
                        r"(?:Essential|Fragrance)\s+Oil", re.I)
BASE_OIL_WORDS = {"coconut", "olive", "shea", "cocoa", "castor", "palm", "sodium",
                  "distilled", "water", "lye"}


def derive_name(ingredients):
    oils = []
    for item in ingredients:
        m = EO_NAME_RE.search(item)
        if m:
            name = clean_ws(m.group(1)).title()
            if name.lower() not in oils and name.lower() not in BASE_OIL_WORDS:
                oils.append(name)
    oils = list(dict.fromkeys(oils))
    if oils:
        if len(oils) == 1:
            core = oils[0]
        else:
            core = ", ".join(oils[:-1]) + " & " + oils[-1]
        return f"{core} Soap"
    # fallback: distinctive non-base ingredients
    extras = []
    for item in ingredients:
        words = norm_key(item)
        if any(w in words for w in ("hydroxide", "water", "lye")):
            continue
        name = re.sub(r"^\d+\s*(?:g|ml|kg)?\s*", "", item)
        name = re.sub(r"\(.*?\)", "", name).strip()
        if name and not any(b in name.lower() for b in BASE_OIL_WORDS):
            extras.append(name.title())
    if extras:
        return " & ".join(extras[:2]) + " Soap"
    return ""


def parse_image_pairs(doc, source):
    recipes = []
    cur_ing = None
    idx = 0
    for page in doc:
        lines = [l for l in page_lines(page) if l.strip()]
        if not lines:
            continue
        head = clean_ws(lines[0]).lower()
        if head.startswith("ingredients"):
            cur_ing = parse_ing_block(lines[1:])
        elif head.startswith("instructions") and cur_ing:
            body = clean_ws(" ".join(lines[1:]))
            body = re.sub(r"^(?:Steps?|P?Preparation)\s*:\s*", "", body)
            benefits = ""
            m = re.search(r"Health Benefits\s*:?", body)
            if m:
                benefits = body[m.end():].strip()
                body = body[:m.start()].strip()
            idx += 1
            name = derive_name(cur_ing) or f"Soap Recipe {idx}"
            recipes.append(make_recipe(name, "Cold Process", cur_ing,
                                       number_steps(split_sentences(body)),
                                       source, benefits))
            cur_ing = None
    return recipes


# ------------------------------------------------- easy soap academy (32)
def parse_easy32(doc, source):
    all_lines = []
    for page in doc:
        first = True
        for raw in page_lines(page):
            line = raw.strip()
            if not line:
                continue
            if first and is_pagenum(line):
                first = False
                continue  # page number, not a grams value
            first = False
            all_lines.append(clean_ws(line))

    # TOC benefit phrases: "<Name> soap - <benefit>."
    toc_benefits = {}
    for line in all_lines[:120]:
        m = re.match(r"^(.+?[Ss]oap.*?)\s+-\s+(.+?)\.?$", line)
        if m and len(m.group(1)) < 60 and len(m.group(2)) < 90:
            toc_benefits[norm_key(re.sub(r"soap", "", m.group(1), flags=re.I))] = m.group(2)

    NUM_LINE = re.compile(r"^[\d,.]+%?$")
    SKIP_ING = re.compile(r"^(oils and butters|grams|ounces|percentage|percent|"
                          r"additives?|oils|butters)$", re.I)

    # every recipe (even those without a "How to Make" heading) is introduced by
    # a "This recipe produces ..." / "Produces ..." line before its table
    ANCHOR = re.compile(r"^(this recipe (produces|makes)|produces \d)", re.I)
    anchors = [i for i, l in enumerate(all_lines) if ANCHOR.match(l)]
    HOWTO = re.compile(r"^How to Make (?:Your )?(.+?)\s*$", re.I)
    FALLBACK_NAMES = [("beer soap", "Beer Soap"), ("pumpkin", "Pumpkin Spice Soap"),
                      ("strawberry", "Strawberry Soap")]

    recipes = []
    n = len(all_lines)
    last_emit = 0  # index of the anchor of the last successfully parsed recipe
    for ai, i in enumerate(anchors):
        end = anchors[ai + 1] if ai + 1 < len(anchors) else n
        # title: nearest "How to Make ..." heading above the anchor, searching
        # back no further than the previous successfully parsed recipe
        name = ""
        lo = max(last_emit, i - 160)
        for j in range(i - 1, lo - 1, -1):
            m = HOWTO.match(all_lines[j])
            if m:
                name = m.group(1).strip()
                break
        if not name:
            for j in range(i - 1, lo - 1, -1):
                low2 = all_lines[j].lower()
                for kw, nm in FALLBACK_NAMES:
                    if kw in low2:
                        name = nm
                        break
                if name:
                    break
        if not name or "citrus zest" in name.lower():
            continue
        block = all_lines[i + 1:end]

        # locate sections
        ing_items = []
        steps = []
        state = None
        noise = False
        pending_name = None
        pending_nums = []

        def flush_pending():
            nonlocal pending_name, pending_nums
            if pending_name:
                if pending_nums:
                    g, unit = pending_nums[0]
                    unit = unit if unit and unit.lower() != "g" else "g"
                    sep = "" if unit == "g" else " "
                    ing_items.append(f"{g}{sep}{unit} {pending_name}")
                elif (len(pending_name) <= 45 and not pending_name.startswith("(")
                      and not re.search(r"\b(recommend|consult|guideline|substitute|"
                                        r"available|prepare|advance|we will|you may|"
                                        r"replacement)\b", pending_name, re.I)):
                    # short, ingredient-looking line without a grams value
                    ing_items.append(pending_name)
            pending_name, pending_nums = None, []

        for bl in block:
            low = bl.lower().rstrip(": ")
            if bl.startswith("_ _") or HOWTO.match(bl):
                break  # separator or next recipe's heading -> end of this recipe
            if low.startswith("ingredients") and state != "steps":
                state = "ing"
                continue
            if low.startswith(("procedure", "instructions", "method")):
                flush_pending()
                state = "steps"
                continue
            if state == "ing":
                if "always add lye" in low or "ratio" in low or "lye solution" in low:
                    continue
                if SKIP_ING.match(low):
                    continue
                if re.fullmatch(r"(optional|or|and)", low) or "ifra" in low \
                        or "methods for" in low:
                    continue
                nm = re.match(r"^([\d,.]+)\s*(t|tsp|tbsp|g|oz|%|tablespoons?|teaspoons?)?\.?$",
                              bl, re.I)
                if nm:
                    pending_nums.append((nm.group(1), (nm.group(2) or "").rstrip("%")))
                    continue
                if bl.startswith("-") or re.match(r"^\d+\.\s", bl) or bl[0].islower():
                    continue  # stray step/prose fragment, not an ingredient row
                flush_pending()
                pending_name = bl.rstrip(":")
            elif state == "steps":
                if re.match(r"^\d+\.\s", bl):
                    steps.append(bl)
                    noise = False
                elif bl.startswith("-"):
                    if steps:
                        steps[-1] = join_wrap(steps[-1], strip_bullets(bl))
                    else:
                        steps.append(strip_bullets(bl))
                    noise = False
                elif steps:
                    # wrapped continuations start lowercase / mid-sentence; an
                    # uppercase start right after a finished sentence is side
                    # commentary or the next essay -> skip until the next
                    # numbered/dashed step line
                    if noise:
                        continue
                    if bl[0].isupper() and steps[-1].rstrip().endswith((".", "!")):
                        noise = True
                        continue
                    steps[-1] = join_wrap(steps[-1], bl)
        flush_pending()

        benefit = ""
        key = norm_key(re.sub(r"soap", "", name, flags=re.I))
        for k, v in toc_benefits.items():
            if k and (k in key or key in k):
                benefit = v
                break

        if ing_items and steps:
            recipes.append(make_recipe(name, "Cold Process", ing_items,
                                       number_steps(merge_label_steps(steps)),
                                       source, benefit))
            last_emit = i
    return recipes


# ------------------------------------------------- NEW!!! Cold Process book
def parse_newcp(doc, source):
    lines = []
    for page in doc:
        for raw in page_lines(page):
            l = raw.rstrip()
            if l.strip():
                lines.append(clean_ws(l))
    n = len(lines)
    recipes = []
    i = 0
    cur = None
    section = None

    def close():
        nonlocal cur
        if cur and cur["ing"] and cur["steps"]:
            steps = cur["steps"] + cur["shaping"]
            recipes.append(make_recipe(cur["name"], "Cold Process",
                                       cur["ing"] + cur["opt"],
                                       number_steps(steps), source))
        cur = None

    while i < n:
        line = lines[i]
        low = line.lower().rstrip(": ")
        if low == "ingredients" and i > 0:
            # title = preceding 1-2 short lines
            back = []
            k = i - 1
            while k >= 0 and len(back) < 3:
                prev = lines[k]
                if prev.lower().rstrip(": ") in SECTION_WORDS or prev.endswith((".", ":")):
                    break
                back.insert(0, prev)
                if len(" ".join(back)) > 60:
                    back.pop(0)
                    break
                k -= 1
            title = clean_ws(" ".join(back))
            if title and len(title) < 60:
                close()
                cur = {"name": title, "ing": [], "opt": [], "steps": [], "shaping": []}
                section = "ing"
            i += 1
            continue
        if cur is None:
            i += 1
            continue
        if low == "optional ingredients":
            section = "opt"
            i += 1
            continue
        if low in ("preparation", "instructions", "method"):
            section = "steps"
            i += 1
            continue
        if low == "shaping and decoration":
            section = "shaping"
            i += 1
            continue
        if section == "ing":
            if line.startswith("-"):
                cur["ing"].append(strip_bullets(line))
            elif cur["ing"] and not line.endswith(":"):
                cur["ing"][-1] = join_wrap(cur["ing"][-1], line)
        elif section == "opt":
            m = re.match(r"^\d+\.\s*(.+)$", line)
            if m:
                cur["opt"].append(m.group(1) + " (optional)")
            elif cur["opt"]:
                base = cur["opt"][-1][:-len(" (optional)")]
                cur["opt"][-1] = join_wrap(base, line) + " (optional)"
        elif section == "steps":
            if re.match(r"^\d+\.\s", line):
                cur["steps"].append(line)
            elif cur["steps"]:
                cur["steps"][-1] = join_wrap(cur["steps"][-1], line)
        elif section == "shaping":
            if line.startswith("-"):
                cur["shaping"].append(strip_bullets(line))
            elif cur["shaping"]:
                cur["shaping"][-1] = join_wrap(cur["shaping"][-1], line)
        i += 1
    close()
    return recipes


# ------------------------------------------------- Japanese technique book
JAPANESE_TITLES = [
    "Cherry Blossom (Sakura) Soap",
    "Sandalwood Soap",
    "Yuzu and Seaweed Soap",
    "Green Tea (Matcha) Soap",
    "Ginseng Soap",
    "Sea-Scented Soap",
    "Japanese Rose Garden Soap",
]
JP_BOILER = ("safety precaution", "sensitive scale", "measurements are provided",
             "basic soap-making", "basic method", "follow all steps",
             "requires basic", "customized approach")


def parse_japanese(doc, source):
    # split into recipe page-groups starting at pages whose first line is Ingredients:
    groups = []
    for pno, page in enumerate(doc):
        lines = [l.strip() for l in page_lines(page) if l.strip()]
        if lines and lines[0].lower().startswith("ingredients"):
            groups.append({"start": pno, "ing_lines": lines[1:], "note": [], "steps": []})
        elif groups:
            g = groups[-1]
            if lines and lines[0].lower().rstrip(":") in ("note", "notes"):
                g["note"].extend(lines[1:])
            elif lines and lines[0].lower().rstrip(":") == "method":
                g["steps"].extend(lines[1:])
            elif g["steps"]:
                g["steps"].extend(lines)

    recipes = []
    for gi, g in enumerate(groups):
        title = JAPANESE_TITLES[gi] if gi < len(JAPANESE_TITLES) else f"Japanese Soap {gi+1}"
        tkey = norm_key(title)
        # ingredients: bullets start with '·' or '-'; drop trailing caption lines
        items = []
        for raw in g["ing_lines"]:
            line = clean_ws(raw)
            if not line:
                continue
            if norm_key(line) and norm_key(line) in tkey:
                continue  # caption fragment of the title
            if line[0] in BULLET_CHARS or line.startswith("-"):
                items.append(strip_bullets(line))
            elif items:
                items[-1] = join_wrap(items[-1], line)
        # steps: renumber (numbering restarts in the PDF)
        steps = []
        for raw in g["steps"]:
            line = clean_ws(raw)
            if not line:
                continue
            if re.match(r"^\d+\s*[.,]", line):
                steps.append(re.sub(r"^\d+\s*[.,]\s*", "", line))
            elif steps:
                steps[-1] = join_wrap(steps[-1], line)
            else:
                steps.append(line)
        # benefits: non-boilerplate sentences from the note page
        ben = []
        for sent in split_sentences(" ".join(g["note"])):
            if not any(b in sent.lower() for b in JP_BOILER):
                ben.append(sent)
        recipes.append(make_recipe(title, "Cold Process", items,
                                   number_steps(steps), source, " ".join(ben)))
    return recipes


# ------------------------------------------------- 15 essential oil blends
EO_SHARED_STEPS = (
    "1. Add the carrier oil to a clean glass jar.\n"
    "2. Add the essential oil drops and stir or gently shake to blend - it takes "
    "just 2-3 minutes to create your oil blend.\n"
    "3. Keep the dilution rule of thumb in mind: about three drops of essential oil "
    "per teaspoon of carrier oil (a 2% dilution, i.e. 36 drops per 60 ml / 2 oz of "
    "carrier oil; up to 4% for acute problems or skin sensitivities).\n"
    "4. Only make a small batch at a time - the oil smells best when made fresh.\n"
    "5. Keep at room temperature in a closed glass jar.\n"
    "6. To warm the massage oil, place the closed glass jar in warm water and test "
    "the oil temperature for comfort on your wrist before using.\n"
    "7. Precautions: do a small patch test before use and discontinue immediately "
    "if redness or itching occurs. Do not use on children under two years old, or "
    "if you are pregnant (unless directed to by your doctor)."
)
EACH_RE = re.compile(r"^(.*?drops)\s+each(?:\s+of)?\s+(.+?)\s*(?:essential\s+)?oils?\.?$",
                     re.I)


def parse_15eo(doc, source):
    recipes = []
    cur = None
    for pno in range(4, len(doc)):
        for raw in page_lines(doc[pno]):
            line = clean_ws(raw)
            if not line:
                continue
            if re.match(r"^[A-Z][A-Za-z &]+:$", line) and "recipe" not in line.lower():
                if cur and cur["items"]:
                    recipes.append(cur)
                cur = {"name": line.rstrip(":"), "items": []}
                continue
            if cur is None:
                continue
            if re.match(r"^[\d¼½¾]|^1/\d", line):
                cur["items"].append(line)
            elif cur["items"]:
                cur["items"][-1] = join_wrap(cur["items"][-1], line)
    if cur and cur["items"]:
        recipes.append(cur)

    out = []
    for r in recipes:
        items = []
        for it in r["items"]:
            m = EACH_RE.match(it)
            if m:
                qty, names = m.group(1), m.group(2)
                parts = re.split(r",\s*|\s+and\s+", names)
                for p in parts:
                    p = p.strip().rstrip(",")
                    if p:
                        p = re.sub(r"\s+essential\s*$", "", p, flags=re.I)
                        p = re.sub(r"\s+oils?$", "", p, flags=re.I)
                        items.append(f"{qty} {p} essential oil")
            else:
                items.append(it)
        out.append(make_recipe(f"{r['name']} Massage Oil Blend", "Remedies", items,
                               EO_SHARED_STEPS, source,
                               "Aromatherapy blend for one full-body massage."))
    return out


# ------------------------------------------------- African soap recipes
def parse_african(doc, source):
    recipes = []
    for page in doc:
        lines = [clean_ws(l) for l in page_lines(page) if l.strip()]
        if not lines or not any(l.lower().startswith("ingredients") for l in lines):
            continue
        title = lines[0]
        state = None
        desc, items, ben = [], [], []
        for line in lines[1:]:
            low = line.lower().rstrip(": ")
            if low.startswith("description"):
                state = "desc"
                line = re.sub(r"^description\s*:\s*", "", line, flags=re.I)
                if line:
                    desc.append(line)
                continue
            if low == "ingredients":
                state = "ing"
                continue
            if low in ("health benefits", "benefits"):
                state = "ben"
                continue
            if state == "desc":
                desc.append(line)
            elif state == "ing":
                if re.match(r"^[A-Z(]", line) and items and items[-1].rstrip().endswith(("g", ")", "ml")):
                    items.append(line)
                elif items and (line[0].islower() or line[0].isdigit() or line[0] in "( )"):
                    items[-1] = join_wrap(items[-1], line)
                else:
                    items.append(line)
            elif state == "ben":
                ben.append(line)
        # ingredient lines are "Name: 150g" possibly wrapped mid-word
        fixed = []
        for it in items:
            it = re.sub(r"\s+", " ", it).strip()
            m = re.match(r"^(.+?):\s*(\d+\s*(?:g|ml).*)$", it)
            fixed.append(f"{m.group(2)} {m.group(1)}" if m else it)
        recipes.append(make_recipe(title, "Cold Process", fixed, "", source,
                                   " ".join(ben)))
    return recipes


# ------------------------------------------------- shampoo & conditioner bars
def parse_shampoo(doc, source):
    def ing_from_page(pno, stop_words):
        lines = []
        for raw in page_lines(doc[pno]):
            l = clean_ws(raw)
            if not l:
                continue
            if any(l.lower().startswith(s) for s in stop_words):
                break
            lines.append(l)
        return parse_ing_block(lines, qty_only=True)

    def steps_from_page(pno):
        steps = []
        fresh = set()
        for raw in page_lines(doc[pno]):
            line = clean_ws(raw.replace("\u26a0\ufe0f", "").replace("\u26a0", ""))
            if not line or line.upper() == "DIRECTIONS":
                continue
            m = re.match(r"^\d+\s*\.\s*(.+)$", line)
            if m:
                steps.append(m.group(1))
                fresh.add(len(steps) - 1)
            elif steps:
                i = len(steps) - 1
                if i in fresh and not steps[i].rstrip().endswith((".", ":", "!")):
                    steps[i] = steps[i].rstrip() + ": " + line
                else:
                    steps[i] = join_wrap(steps[i], line)
                fresh.discard(i)
        return steps

    sh_ing = ing_from_page(0, ("shampoo bar", "this recipe makes"))
    sh_steps = steps_from_page(2)
    co_ing = ing_from_page(3, ("conditioner", "this recipe makes"))
    co_steps = steps_from_page(5)
    return [
        make_recipe("Shampoo Bar", "Hair Care", sh_ing, number_steps(sh_steps),
                    source,
                    "Mild, creamy-lathering cleanse; kaolin clay absorbs excess "
                    "scalp oil; glycerin and panthenol attract moisture, "
                    "strengthen hair, and add shine."),
        make_recipe("Conditioner Bar", "Hair Care", co_ing, number_steps(co_steps),
                    source,
                    "Deeply conditioning; BTMS-50 detangles and softens; murumuru "
                    "butter seals in hydration, smooths frizz, and restores shine."),
    ]


# ------------------------------------------------- Korean face masks
# The text layer of this PDF is badly broken (words split mid-line), so the
# three recipes are transcribed here verbatim from the extracted text.
def parse_korean(_doc, source):
    return [
        make_recipe(
            "The Secret Korean Face Mask", "Remedies",
            ["1 egg white", "1 teaspoon of honey", "1 teaspoon of oatmeal",
             "1 teaspoon of rose water"],
            "1. Thoroughly cleanse and purify your face with warm water before "
            "applying the mask.\n"
            "2. Mix the egg white, honey, oatmeal, and rose water into a smooth mask.\n"
            "3. Apply the mask to the skin.\n"
            "4. Clean off after 20 minutes.\n"
            "5. Be cautious of allergenic substances.",
            source,
            "Removes dead skin cells, cleanses and addresses acne and blackheads. "
            "With regular use it prevents acne formation, imparts a brighter look, "
            "adds smoothness, regulates the skin's oil balance, and can lighten "
            "the skin and reduce wrinkles."),
        make_recipe(
            "Korean Rose Water Mask", "Remedies",
            ["Rose water", "A small amount of cold milk"],
            "1. Add a small amount of cold milk to the rose water.\n"
            "2. Place cotton pads soaked in the mixture on your eyelids and leave "
            "them on for 15-20 minutes.",
            source,
            "Rose water helps maintain the skin's pH balance, moisturizes, "
            "cleanses pores, reduces oiliness, and dries out acne and pimples; "
            "raw milk provides antioxidant and moisturizing effects."),
        make_recipe(
            "Aloe Vera Clay Mask", "Remedies",
            ["2 tablespoons clay", "2 tablespoons aloe vera gel", "Half a cucumber",
             "1 tablespoon honey", "2 tablespoons yogurt", "Juice of half a lemon"],
            "1. Blend all the ingredients, excluding the clay, in a food processor.\n"
            "2. Add the clay to the mixture and stir until it forms a paste.\n"
            "3. Apply the paste as a mask to your face.\n"
            "4. After waiting for 15 minutes, wash your face with cold water.",
            source,
            "Tightens the pores, helping eliminate blackheads and acne and "
            "preventing sagging skin; nourishes the skin and gives color to your "
            "face due to the minerals it contains."),
    ]


# ---------------------------------------------------------------- pipeline
PDFS = [
    ("150SoapMakingRecipies.pdf", "Soap Academy - 150 Soap Making Recipes",
     lambda d, s: parse_bulleted(d, s)),
    ("200ExoticSoap.pdf", "Soap Academy - 200 Exotic Soap Recipes",
     lambda d, s: parse_bulleted(d, s)),
    ("50MediterraneanSoap.pdf", "Soap Academy - 50 Mediterranean Soap Recipes",
     lambda d, s: parse_bulleted(d, s, expand_same_as=True)),
    ("easy soap academy - 32 Recipes.pdf", "Easy Soap Academy - 32 Cold Process Recipes",
     parse_easy32),
    ("NEW!!! Cold Process Soap Recipes (1).pdf", "Soap Academy - Cold Process Soap Recipes",
     parse_newcp),
    ("Japanese Technique for handmade soap making.pdf",
     "Soap Academy - Japanese Soap Making Techniques", parse_japanese),
    ("Korean Natural Face Mask Recipes for Skincare.pdf",
     "Soap Academy - Korean Natural Face Mask Recipes", parse_korean),
    (r"New Version!!! 430 Soap Recipes\15 Essential Oils Recipes.pdf",
     "Soap Academy - 15 Essential Oil Massage Blends", parse_15eo),
    (r"New Version!!! 430 Soap Recipes\African Soap Recipes - Part 1.pdf",
     "Soap Academy - African Soap Recipes Part 1", parse_african),
    (r"New Version!!! 430 Soap Recipes\New Version - 50FruitRecepies_compressed.pdf",
     "Soap Academy - 50 Fruit Soap Recipes", parse_image_pairs),
    (r"New Version!!! 430 Soap Recipes\New Version - 50SoapBar_compressed.pdf",
     "Soap Academy - 50 Soap Bar Recipes", parse_image_pairs),
    (r"New Version!!! 430 Soap Recipes\New Version - HowToMakeSoap_compressed.pdf",
     "Soap Academy - How to Make Soap (50 Recipes)", parse_image_pairs),
    (r"shampoo and conditioner bar\Shampoo and conditioner bar recipe pdf.pdf",
     "Soap Academy - Shampoo & Conditioner Bars", parse_shampoo),
]


def quality_gate(r):
    if not r["name"]:
        return "empty name"
    if len(r["ingredients"]) < 3:
        return "fewer than 3 ingredients"
    if len(r["instructions"]) < 150:
        return "instructions under 150 chars"
    return None


def main():
    show_samples = "--samples" in sys.argv

    with open(SITE_DATA, encoding="utf-8") as f:
        existing = json.load(f)
    existing_names = {norm_key(r["name"]) for recs in existing.values() for r in recs}

    out = {c: [] for c in CATEGORIES}
    seen_names = {}
    seen_fp = {}
    stats = []

    for rel, source, handler in PDFS:
        path = os.path.join(BASE, rel)
        doc = fitz.open(path)
        try:
            recipes = handler(doc, source)
        finally:
            doc.close()

        kept = dropped = deduped = 0
        drop_reasons = {}
        samples = 0
        for r in recipes:
            reason = quality_gate(r)
            if reason:
                dropped += 1
                drop_reasons[reason] = drop_reasons.get(reason, 0) + 1
                continue
            key = norm_key(r["name"])
            fp = fingerprint(r["ingredients"])
            if key in existing_names or fp in seen_fp:
                deduped += 1
                continue
            if key in seen_names:
                # same name, different recipe -> disambiguate
                n2 = 2
                while norm_key(f"{r['name']} (Variation {n2})") in seen_names:
                    n2 += 1
                r["name"] = f"{r['name']} (Variation {n2})"
                key = norm_key(r["name"])
            seen_names[key] = True
            seen_fp[fp] = True
            out[r["type"]].append(r)
            kept += 1
            if show_samples and samples < 2:
                samples += 1
                print(f"  SAMPLE [{source}] {r['name']}")
                print(f"    ING: {r['ingredients'][:3]}")
                print(f"    INSTR: {r['instructions'][:200]!r}")
                print(f"    BEN: {r['benefits'][:100]!r}")
        stats.append((rel, len(recipes), kept, dropped, drop_reasons, deduped))

    out = {c: v for c, v in out.items() if v}
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    print("\n=== PER-PDF STATS ===")
    total = 0
    for rel, parsed, kept, dropped, reasons, deduped in stats:
        print(f"{os.path.basename(rel)}: parsed={parsed} kept={kept} "
              f"dropped={dropped} {reasons if reasons else ''} deduped={deduped}")
        total += kept
    print("\n=== PER-CATEGORY ===")
    for c, v in out.items():
        print(f"{c}: {len(v)}")
    print(f"TOTAL: {total}")
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
