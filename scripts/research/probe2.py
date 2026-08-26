# Probe 2: v2 category shapes + per-page outline of PDFs to locate method chapters.
import sys
import io
import json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

with open(r"C:\Users\Daya\natural-soap-recipes\scripts\research\_v2_recipes_raw.json", encoding='utf-8') as f:
    v2 = json.load(f)
print("=== v2 categories ===")
for cat, lst in v2.items():
    if not isinstance(lst, list):
        print(cat, "-> not a list:", type(lst).__name__); continue
    def ilen(e):
        ins = e.get("instructions") or e.get("steps") or ""
        if isinstance(ins, list):
            ins = " ".join(str(x) for x in ins)
        return len(str(ins))
    lens = sorted(ilen(e) for e in lst) if lst else [0]
    print(f"{cat}: n={len(lst)} instr_len med={lens[len(lens)//2]} max={lens[-1]} >500:{sum(1 for L in lens if L>500)}")
    if lst:
        print("  keys:", list(lst[0].keys()))
# one long sample
longest = None
for cat, lst in v2.items():
    for e in lst:
        ins = e.get("instructions") or ""
        if isinstance(ins, list): ins = " ".join(str(x) for x in ins)
        if longest is None or len(str(ins)) > longest[0]:
            longest = (len(str(ins)), cat, e.get("name"), str(ins)[:400])
print("longest instr:", longest[0], "|", longest[1], "|", longest[2])
print(longest[3])

print("\n=== recipes_enhanced entries overview ===")
with open(r"C:\Users\Daya\natural-soap-recipes\client\src\data\recipes_enhanced.json", encoding='utf-8') as f:
    enh = json.load(f)
for cat, lst in enh.items():
    print(f"[{cat}] n={len(lst)}")
    for i, e in enumerate(lst):
        nm = (e.get("name") or "")[:60]
        print(f"  {i}: name={nm!r} instr_len={len(e.get('instructions') or '')} ings={len(e.get('ingredients') or [])}")

print("\n=== PDF page outlines ===")
import fitz
pdfs = {
    "howto": r"C:\Users\Daya\Downloads\soap academy\New Version!!! 430 Soap Recipes\New Version - HowToMakeSoap_compressed.pdf",
    "coldprocess": r"C:\Users\Daya\Downloads\soap academy\NEW!!! Cold Process Soap Recipes (1).pdf",
    "easy32": r"C:\Users\Daya\Downloads\soap academy\easy soap academy - 32 Recipes.pdf",
    "japanese": r"C:\Users\Daya\Downloads\soap academy\Japanese Technique for handmade soap making.pdf",
    "shampoo": r"C:\Users\Daya\Downloads\soap academy\shampoo and conditioner bar\Shampoo and conditioner bar recipe pdf.pdf",
}
for tag, pp in pdfs.items():
    d = fitz.open(pp)
    print(f"\n--- {tag} ({d.page_count}p) ---")
    for i in range(d.page_count):
        t = d[i].get_text().strip()
        first = " / ".join(l.strip() for l in t.splitlines()[:2] if l.strip())
        print(f"p{i+1}: [{len(t)}ch] {first[:100]}")
    d.close()
