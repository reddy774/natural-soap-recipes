"""Generate recipe photos with the Gemini API from scripts/research/image-prompts.json.

Key discovery (first match wins):
  1. GEMINI_API_KEY environment variable
  2. %USERPROFILE%\\.gemini\\api_key.txt  (paste the key on the first line)

For each recipe slug the script calls Gemini image generation
(gemini-2.5-flash-image), optimizes the result to an 800px-wide JPEG at
client/public/images/recipes/<slug>.jpg, and rewrites
client/src/data/recipe_photos.json to list every slug that has a photo on
disk. Resumable: existing photos are skipped unless --force.

Usage (from repo root):
    python scripts/generate_recipe_images.py --limit 3      # pilot batch
    python scripts/generate_recipe_images.py                # everything missing
    python scripts/generate_recipe_images.py --only <slug>  # one recipe
    python scripts/generate_recipe_images.py --delay 5      # slower (free tier)

Cost note: roughly $0.04/image on the paid tier (~$25 for all 627). The free
tier rate-limits hard; use --delay 10 or run in small batches there.
"""

import argparse
import base64
import io
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

REPO = Path(__file__).resolve().parent.parent
PROMPTS = REPO / "scripts" / "research" / "image-prompts.json"
OUT_DIR = REPO / "client" / "public" / "images" / "recipes"
MANIFEST = REPO / "client" / "src" / "data" / "recipe_photos.json"

MODEL = "gemini-2.5-flash-image"
ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
MAX_RETRIES = 5


def find_api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if key:
        return key
    key_file = Path.home() / ".gemini" / "api_key.txt"
    if key_file.exists():
        key = key_file.read_text(encoding="utf-8").strip().splitlines()[0].strip()
        if key:
            return key
    sys.exit(
        "No Gemini API key found.\n"
        "Either set the environment variable:  setx GEMINI_API_KEY \"<your key>\"\n"
        f"or paste the key into:               {key_file}\n"
        "Get a key at https://aistudio.google.com/apikey"
    )


def generate_image(api_key: str, prompt: str, aspect_ratio: str) -> bytes:
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
            "imageConfig": {"aspectRatio": aspect_ratio},
        },
    }).encode("utf-8")
    request = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )
    for attempt in range(MAX_RETRIES):
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                payload = json.loads(response.read().decode("utf-8"))
            parts = payload["candidates"][0]["content"]["parts"]
            for part in parts:
                data = part.get("inlineData") or part.get("inline_data")
                if data and data.get("data"):
                    return base64.b64decode(data["data"])
            raise RuntimeError(f"no image in response: {json.dumps(payload)[:300]}")
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")[:200]
            if error.code in (429, 500, 503) and attempt < MAX_RETRIES - 1:
                wait = min(90, 10 * (2 ** attempt))
                print(f"    HTTP {error.code}, retrying in {wait}s... ({detail})")
                time.sleep(wait)
                continue
            raise RuntimeError(f"HTTP {error.code}: {detail}") from error
    raise RuntimeError("retries exhausted")


def optimize_and_save(raw: bytes, out_path: Path) -> None:
    from PIL import Image

    image = Image.open(io.BytesIO(raw)).convert("RGB")
    if image.width > 800:
        image = image.resize((800, round(image.height * 800 / image.width)), Image.LANCZOS)
    image.save(out_path, "JPEG", quality=82, optimize=True)


def rewrite_manifest() -> int:
    slugs = sorted(p.stem for p in OUT_DIR.glob("*.jpg"))
    MANIFEST.write_text(json.dumps(slugs, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return len(slugs)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="stop after N new images")
    parser.add_argument("--only", help="generate a single slug")
    parser.add_argument("--force", action="store_true", help="regenerate even if the photo exists")
    parser.add_argument("--delay", type=float, default=2.0, help="seconds between requests")
    args = parser.parse_args()

    api_key = find_api_key()
    prompts: dict = json.loads(PROMPTS.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    todo = []
    for slug, spec in prompts.items():
        if args.only and slug != args.only:
            continue
        out_path = OUT_DIR / f"{slug}.jpg"
        if out_path.exists() and not args.force:
            continue
        todo.append((slug, spec, out_path))
    if args.limit:
        todo = todo[: args.limit]

    print(f"{len(todo)} images to generate ({len(prompts)} prompts total)")
    generated, failed = 0, []
    for index, (slug, spec, out_path) in enumerate(todo, 1):
        print(f"[{index}/{len(todo)}] {slug}")
        try:
            raw = generate_image(api_key, spec["prompt"], spec.get("aspect_ratio", "4:3"))
            optimize_and_save(raw, out_path)
            generated += 1
        except Exception as error:  # keep going; report at the end
            failed.append((slug, str(error)[:150]))
            print(f"    FAILED: {error}")
        if index < len(todo):
            time.sleep(args.delay)

    total = rewrite_manifest()
    print(f"\ngenerated {generated}, failed {len(failed)}, manifest now lists {total} photos")
    for slug, reason in failed[:10]:
        print(f"  failed: {slug} — {reason}")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
