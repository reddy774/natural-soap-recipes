# Probe 3: locate method chapters in easy32 + japanese + shampoo; sample howto instruction pages.
import sys
import io
import re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
import fitz

def lines(page):
    return [l.strip() for l in page.get_text().splitlines() if l.strip()]

# easy32: print first non-pagenumber line + flag method keywords
d = fitz.open(r"C:\Users\Daya\Downloads\soap academy\easy soap academy - 32 Recipes.pdf")
kw = re.compile(r"(appendix|contents|safety|equipment|trace|saponif|general|process(?!or)|calculat|mold volume|scale your|lye solution|step[s ]|gel phase|cure|insulat|superfat|water discount)", re.I)
print("=== easy32 headings + keyword pages ===")
for i in range(d.page_count):
    ls = lines(d[i])
    head = ls[1] if len(ls) > 1 else ""
    txt = " ".join(ls)
    hits = sorted(set(m.group(1).lower() for m in kw.finditer(txt)))
    if i < 10 or i > 128 or len(hits) >= 3:
        print(f"p{i+1}: {head[:70]!r} hits={hits[:8]}")
d.close()

print("\n=== easy32 pages 1-9 full-ish text (first 700 chars each) ===")
d = fitz.open(r"C:\Users\Daya\Downloads\soap academy\easy soap academy - 32 Recipes.pdf")
for i in range(9):
    t = " | ".join(lines(d[i]))
    print(f"\n-- p{i+1}:\n{t[:700]}")
print("\n-- p133-135:")
for i in (132, 133, 134):
    t = " | ".join(lines(d[i]))
    print(f"\n-- p{i+1}:\n{t[:700]}")
d.close()

print("\n=== japanese full outline ===")
d = fitz.open(r"C:\Users\Daya\Downloads\soap academy\Japanese Technique for handmade soap making.pdf")
for i in range(d.page_count):
    ls = lines(d[i])
    head = " / ".join(ls[:2])
    print(f"p{i+1}: [{len(' '.join(ls))}ch] {head[:90]}")
d.close()

print("\n=== shampoo full text (8p) first lines ===")
d = fitz.open(r"C:\Users\Daya\Downloads\soap academy\shampoo and conditioner bar\Shampoo and conditioner bar recipe pdf.pdf")
for i in range(d.page_count):
    ls = lines(d[i])
    print(f"p{i+1}: [{len(' '.join(ls))}ch] {' / '.join(ls[:3])[:100]}")
d.close()

print("\n=== howto sample instruction pages (p3, p51, p99) ===")
d = fitz.open(r"C:\Users\Daya\Downloads\soap academy\New Version!!! 430 Soap Recipes\New Version - HowToMakeSoap_compressed.pdf")
for i in (2, 50, 98):
    print(f"\n-- p{i+1}:\n{d[i].get_text().strip()[:900]}")
d.close()
