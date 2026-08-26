"""Generate recipe photos (fal.ai FLUX or Gemini) from scripts/research/image-prompts.json.

Provider/key discovery (first match wins; override with --provider):
  1. FAL_KEY env var, else %USERPROFILE%\\.fal\\api_key.txt      -> fal.ai (FLUX dev)
  2. GEMINI_API_KEY env var, else %USERPROFILE%\\.gemini\\api_key.txt -> Gemini

For each recipe slug the script generates an image, optimizes it to an
800px-wide JPEG at client/public/images/recipes/<slug>.jpg, and rewrites
client/src/data/recipe_photos.json to list every slug that has a photo on
disk. Resumable: existing photos are skipped unless --force.

Usage (from repo root):
    python scripts/generate_recipe_images.py --limit 3      # pilot batch
    python scripts/generate_recipe_images.py                # everything missing
    python scripts/generate_recipe_images.py --only <slug>  # one recipe
    python scripts/generate_recipe_images.py --delay 5      # slower

Cost note: fal.ai FLUX dev ~ $0.02/image (~$13 for all 627); Gemini
~ $0.04/image on the paid tier.
"""

import argparse
import base64
import io
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

REPO = Path(__file__).resolve().parent.parent
PROMPTS = REPO / "scripts" / "research" / "image-prompts.json"
OUT_DIR = REPO / "client" / "public" / "images" / "recipes"
MANIFEST = REPO / "client" / "src" / "data" / "recipe_photos.json"

GEMINI_MODEL = "gemini-2.5-flash-image"
GEMINI_ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
FAL_MODEL = "fal-ai/flux/dev"
FAL_ENDPOINT = f"https://fal.run/{FAL_MODEL}"
MAX_RETRIES = 5


def read_key_file(path: Path) -> str:
    if not path.exists():
        return ""
    content = path.read_text(encoding="utf-8").strip()
    return content.splitlines()[0].strip() if content else ""


def find_provider(preferred: str | None) -> tuple[str, str]:
    """Return (provider, key). Provider preference: fal, then gemini."""
    fal_key = os.environ.get("FAL_KEY", "").strip() or read_key_file(Path.home() / ".fal" / "api_key.txt")
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip() or read_key_file(
        Path.home() / ".gemini" / "api_key.txt"
    )
    candidates = {"fal": fal_key, "gemini": gemini_key}
    if preferred:
        if candidates.get(preferred):
            return preferred, candidates[preferred]
        sys.exit(f"--provider {preferred} requested but no key found for it")
    for provider in ("fal", "gemini"):
        if candidates[provider]:
            return provider, candidates[provider]
    sys.exit(
        "No image API key found. Provide one of:\n"
        "  fal.ai:  setx FAL_KEY \"<key>\"        or paste into %USERPROFILE%\\.fal\\api_key.txt\n"
        "  Gemini:  setx GEMINI_API_KEY \"<key>\" or paste into %USERPROFILE%\\.gemini\\api_key.txt"
    )


def post_json_with_retry(url: str, headers: dict, body: dict) -> dict:
    data = json.dumps(body).encode("utf-8")
    for attempt in range(MAX_RETRIES):
        request = urllib.request.Request(
            url, data=data, headers={"Content-Type": "application/json", **headers}, method="POST"
        )
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")[:200]
            if error.code in (429, 500, 503) and attempt < MAX_RETRIES - 1:
                wait = min(90, 10 * (2 ** attempt))
                print(f"    HTTP {error.code}, retrying in {wait}s... ({detail})")
                time.sleep(wait)
                continue
            raise RuntimeError(f"HTTP {error.code}: {detail}") from error
    raise RuntimeError("retries exhausted")  # only reachable on repeated retryable errors


def generate_gemini(api_key: str, prompt: str, aspect_ratio: str) -> bytes:
    payload = post_json_with_retry(
        GEMINI_ENDPOINT,
        {"x-goog-api-key": api_key},
        {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseModalities": ["IMAGE"],
                "imageConfig": {"aspectRatio": aspect_ratio},
            },
        },
    )
    parts = payload["candidates"][0]["content"]["parts"]
    for part in parts:
        data = part.get("inlineData") or part.get("inline_data")
        if data and data.get("data"):
            return base64.b64decode(data["data"])
    raise RuntimeError(f"no image in response: {json.dumps(payload)[:300]}")


FAL_SIZES = {"4:3": "landscape_4_3", "3:4": "portrait_4_3", "16:9": "landscape_16_9", "1:1": "square"}


def generate_fal(api_key: str, prompt: str, aspect_ratio: str) -> bytes:
    payload = post_json_with_retry(
        FAL_ENDPOINT,
        {"Authorization": f"Key {api_key}"},
        {
            "prompt": prompt,
            "image_size": FAL_SIZES.get(aspect_ratio, "landscape_4_3"),
            "num_images": 1,
            "output_format": "jpeg",
            "enable_safety_checker": True,
        },
    )
    images = payload.get("images") or []
    if not images or not images[0].get("url"):
        raise RuntimeError(f"no image in response: {json.dumps(payload)[:300]}")
    with urllib.request.urlopen(images[0]["url"], timeout=120) as response:
        return response.read()


def generate_image(provider: str, api_key: str, prompt: str, aspect_ratio: str) -> bytes:
    if provider == "fal":
        return generate_fal(api_key, prompt, aspect_ratio)
    return generate_gemini(api_key, prompt, aspect_ratio)


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
    parser.add_argument("--delay", type=float, default=2.0, help="seconds between request submissions")
    parser.add_argument("--provider", choices=["fal", "gemini"], help="force a provider")
    parser.add_argument("--workers", type=int, default=1, help="concurrent generations")
    args = parser.parse_args()

    provider, api_key = find_provider(args.provider)
    print(f"provider: {provider} | workers: {args.workers}", flush=True)
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

    print(f"{len(todo)} images to generate ({len(prompts)} prompts total)", flush=True)
    generated, failed = 0, []
    progress_lock = threading.Lock()

    def worker(job: tuple) -> tuple[str, str | None]:
        slug, spec, out_path = job
        try:
            raw = generate_image(provider, api_key, spec["prompt"], spec.get("aspect_ratio", "4:3"))
            optimize_and_save(raw, out_path)
            return slug, None
        except Exception as error:  # keep going; report at the end
            return slug, str(error)[:150]

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futures = []
        for job in todo:
            futures.append(pool.submit(worker, job))
            time.sleep(args.delay)  # stagger submissions
        done_count = 0
        for future in as_completed(futures):
            slug, error = future.result()
            with progress_lock:
                done_count += 1
                if error:
                    failed.append((slug, error))
                    print(f"[{done_count}/{len(todo)}] FAILED {slug}: {error}", flush=True)
                else:
                    generated += 1
                    if done_count % 10 == 0 or done_count == len(todo):
                        print(f"[{done_count}/{len(todo)}] ok (latest: {slug})", flush=True)

    total = rewrite_manifest()
    print(f"\ngenerated {generated}, failed {len(failed)}, manifest now lists {total} photos")
    for slug, reason in failed[:10]:
        print(f"  failed: {slug} — {reason}")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
