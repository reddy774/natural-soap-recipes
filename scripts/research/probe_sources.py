# Probe structure of recipes_enhanced.json, v2 recipes.json, and soap PDFs.
import sys
import io
import json
import subprocess
import base64
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# --- 1. recipes_enhanced.json ---
p = r"C:\Users\Daya\natural-soap-recipes\client\src\data\recipes_enhanced.json"
with open(p, encoding='utf-8') as f:
    enh = json.load(f)
print("=== recipes_enhanced.json ===")
print("top type:", type(enh).__name__)
if isinstance(enh, dict):
    for k, v in enh.items():
        print(f"key={k!r} type={type(v).__name__} len={len(v) if hasattr(v,'__len__') else '?'}")
        if isinstance(v, list) and v:
            e0 = v[0]
            print("  entry0 keys:", list(e0.keys()) if isinstance(e0, dict) else type(e0).__name__)
            if isinstance(e0, dict):
                for fk, fv in e0.items():
                    s = json.dumps(fv, ensure_ascii=False)
                    print(f"    {fk}: {s[:200]}")
        elif isinstance(v, dict):
            print("  subkeys:", list(v.keys())[:20])
            sk = next(iter(v))
            sv = v[sk]
            print(f"  sample subkey {sk!r} type={type(sv).__name__}")
            s = json.dumps(sv, ensure_ascii=False)
            print("  sample:", s[:500])

# --- 2. v2 repo recipes.json (via gh api) ---
print("\n=== v2 recipes.json ===")
try:
    out = subprocess.run(
        ["gh", "api", "repos/reddy774/natural-soap-recipes-v2/contents/recipes.json"],
        capture_output=True, text=True, timeout=120)
    obj = json.loads(out.stdout)
    if obj.get("content"):
        raw = base64.b64decode(obj["content"]).decode("utf-8")
    else:
        # too large -> use download_url via gh api raw
        out2 = subprocess.run(
            ["gh", "api", "-H", "Accept: application/vnd.github.raw",
             "repos/reddy774/natural-soap-recipes-v2/contents/recipes.json"],
            capture_output=True, text=True, timeout=120)
        raw = out2.stdout
    with open(r"C:\Users\Daya\natural-soap-recipes\scripts\research\_v2_recipes_raw.json", "w", encoding='utf-8') as f:
        f.write(raw)
    v2 = json.loads(raw)
    print("top type:", type(v2).__name__, "len:", len(v2))
    if isinstance(v2, list) and v2:
        e0 = v2[0]
        print("entry0 keys:", list(e0.keys()))
        for fk, fv in e0.items():
            s = json.dumps(fv, ensure_ascii=False)
            print(f"  {fk}: {s[:200]}")
        # instruction length distribution
        def ilen(e):
            ins = e.get("instructions") or e.get("steps") or ""
            if isinstance(ins, list):
                ins = " ".join(str(x) for x in ins)
            return len(str(ins))
        lens = sorted(ilen(e) for e in v2)
        print("instr len min/med/max:", lens[0], lens[len(lens)//2], lens[-1])
        print("count >500 chars:", sum(1 for L in lens if L > 500))
    elif isinstance(v2, dict):
        print("keys:", list(v2.keys())[:20])
except Exception as ex:
    print("v2 fetch error:", ex)

# --- 3. DOCUMENTATION.md ---
print("\n=== v2 DOCUMENTATION.md ===")
try:
    out = subprocess.run(
        ["gh", "api", "-H", "Accept: application/vnd.github.raw",
         "repos/reddy774/natural-soap-recipes-v2/contents/DOCUMENTATION.md"],
        capture_output=True, text=True, timeout=120)
    doc = out.stdout
    with open(r"C:\Users\Daya\natural-soap-recipes\scripts\research\_v2_documentation.md", "w", encoding='utf-8') as f:
        f.write(doc)
    print("len:", len(doc))
    heads = [l for l in doc.splitlines() if l.startswith("#")]
    print("headings:", heads[:30])
except Exception as ex:
    print("doc fetch error:", ex)

# --- 4. PDFs ---
print("\n=== PDFs ===")
import fitz
pdfs = [
    r"C:\Users\Daya\Downloads\soap academy\New Version!!! 430 Soap Recipes\New Version - HowToMakeSoap_compressed.pdf",
    r"C:\Users\Daya\Downloads\soap academy\NEW!!! Cold Process Soap Recipes (1).pdf",
    r"C:\Users\Daya\Downloads\soap academy\easy soap academy - 32 Recipes.pdf",
    r"C:\Users\Daya\Downloads\soap academy\Japanese Technique for handmade soap making.pdf",
    r"C:\Users\Daya\Downloads\soap academy\shampoo and conditioner bar\Shampoo and conditioner bar recipe pdf.pdf",
]
for pp in pdfs:
    try:
        d = fitz.open(pp)
        print(f"\n-- {pp.split(chr(92))[-1]} : {d.page_count} pages")
        toc = d.get_toc()
        if toc:
            for lvl, title, page in toc[:25]:
                print(f"   toc L{lvl} p{page}: {title[:70]}")
        else:
            print("   (no TOC)")
        # first pages snippet
        for i in range(min(3, d.page_count)):
            t = d[i].get_text().strip().replace("\n", " | ")
            print(f"   p{i+1}: {t[:180]}")
        d.close()
    except Exception as ex:
        print("   pdf error:", ex)
