"""Combine method research into the final method_templates.json.

Inputs (any subset may exist):
  - scripts/research/methods/<key>.json   (per-category files from parallel agents)
  - scripts/research/method_templates.json (combined file from the first agent)

For each category the entry with the most total phase steps wins. The result
is written back to scripts/research/method_templates.json for the shard
builder. Run from repo root:
    python scripts/merge_method_templates.py
"""

import io
import json
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

RESEARCH = Path(__file__).resolve().parent.parent / "scripts" / "research"
METHODS_DIR = RESEARCH / "methods"
COMBINED = RESEARCH / "method_templates.json"

EXPECTED = [
    "cold_process", "hot_process", "melt_and_pour", "bath_bombs", "scrubs",
    "lotions", "shampoo_bars_soap", "shampoo_bars_syndet", "conditioner_bars",
    "face_masks", "remedies",
]


def step_count(entry: dict) -> int:
    return sum(len(p.get("steps", [])) for p in entry.get("phases", []))


def main() -> None:
    combined: dict = {}
    if COMBINED.exists():
        combined = json.loads(COMBINED.read_text(encoding="utf-8"))

    result: dict = {}
    for key in EXPECTED:
        candidates: list[tuple[str, dict]] = []
        per_file = METHODS_DIR / f"{key}.json"
        if per_file.exists():
            candidates.append(("methods/", json.loads(per_file.read_text(encoding="utf-8"))))
        if key in combined:
            candidates.append(("combined", combined[key]))
        if not candidates:
            print(f"MISSING: {key}")
            continue
        origin, best = max(candidates, key=lambda c: step_count(c[1]))
        result[key] = best
        print(f"{key}: {step_count(best)} steps from {origin} "
              f"({len(best.get('sources', []))} sources)")

    COMBINED.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {COMBINED} with {len(result)}/{len(EXPECTED)} categories")


if __name__ == "__main__":
    main()
