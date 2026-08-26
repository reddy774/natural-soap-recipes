"""Generate per-recipe AI image prompts grounded in each recipe's actual ingredients.

Reads client/src/data/recipes.json (dict keyed by category), derives the same
slug the site uses (client/src/lib/recipes.ts slugifyName + dedupe), extracts
visual cues (colorants, botanicals, additives, product form), and writes
scripts/research/image-prompts.json mapping slug -> prompt spec.

The prompts share one photographic style so the site stays coherent, while the
subject of every image is distinct to its recipe. Consumed by the image
generation step; regenerating this file is idempotent.
"""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RECIPES = ROOT / "client" / "src" / "data" / "recipes.json"
OUT = ROOT / "scripts" / "research" / "image-prompts.json"

STYLE = (
    "warm natural window light, rustic wooden surface with linen cloth, shallow depth of field, "
    "artisan handmade cosmetics photography, muted earthy palette, photorealistic, no text, no hands, no people"
)

# keyword -> (bar color/pattern phrase, priority). Higher priority wins.
COLORANTS: list[tuple[str, str, int]] = [
    ("activated charcoal", "deep matte black bars", 90),
    ("charcoal", "deep matte black bars", 90),
    ("coffee", "rich coffee-brown bars flecked with grounds", 80),
    ("cocoa powder", "chocolate-brown bars", 80),
    ("chocolate", "chocolate-brown bars", 78),
    ("matcha", "soft matcha-green bars", 76),
    ("spirulina", "deep blue-green bars", 76),
    ("turmeric", "warm golden-yellow bars", 74),
    ("rose clay", "dusty rose-pink bars", 72),
    ("pink clay", "dusty rose-pink bars", 72),
    ("green clay", "sage-green bars", 72),
    ("bentonite", "soft grey-green bars", 70),
    ("kaolin", "porcelain-white bars", 70),
    ("annatto", "sunset-orange bars", 68),
    ("alkanet", "dusky purple bars", 68),
    ("madder", "soft brick-pink bars", 68),
    ("indigo", "denim-blue bars", 68),
    ("hibiscus", "rosy mauve-tinted bars", 40),
    ("beet", "blush-pink bars", 40),
    ("carrot", "apricot-tinted bars", 40),
    ("pumpkin", "warm amber bars", 40),
    ("honey", "translucent honey-gold bars", 36),
    ("goat milk", "creamy ivory bars", 30),
    ("coconut milk", "creamy off-white bars", 30),
    ("oat milk", "oatmeal-cream bars", 30),
    ("vanilla", "caramel-tan bars", 24),
]

MICA_COLORS = [
    "red", "pink", "purple", "violet", "blue", "green", "yellow",
    "orange", "white", "brown", "gold", "black", "teal",
]

# topping keyword -> phrase for the bar top
TOPPINGS: list[tuple[str, str]] = [
    ("lavender bud", "sprinkled with dried lavender buds"),
    ("dried lavender", "sprinkled with dried lavender buds"),
    ("rose petal", "scattered with dried rose petals"),
    ("jasmine flower", "dotted with small dried jasmine blossoms"),
    ("chamomile flower", "dotted with dried chamomile flowers"),
    ("calendula", "strewn with golden calendula petals"),
    ("cornflower", "sprinkled with blue cornflower petals"),
    ("citrus zest", "dusted with dried citrus zest curls"),
    ("lemon zest", "dusted with dried lemon zest"),
    ("lime zest", "dusted with dried lime zest"),
    ("orange peel", "decorated with dried orange peel slivers"),
    ("grapefruit peel", "decorated with dried grapefruit peel"),
    ("bergamot peel", "decorated with dried bergamot peel"),
    ("bergamot zest", "dusted with dried bergamot zest"),
    ("cinnamon stick", "topped with small cinnamon sticks"),
    ("clove bud", "studded with whole clove buds"),
    ("star anise", "topped with star anise pods"),
    ("coffee bean", "topped with whole coffee beans"),
    ("oatmeal", "sprinkled with rolled oats"),
    ("oat", "sprinkled with rolled oats"),
    ("coconut flake", "sprinkled with toasted coconut flakes"),
    ("poppy seed", "speckled with poppy seeds"),
    ("papaya seed", "speckled with dark papaya seeds"),
    ("sea salt", "crusted with coarse sea salt crystals"),
    ("himalayan", "crusted with pink Himalayan salt"),
    ("eucalyptus leaves", "laid with a small dried eucalyptus sprig"),
    ("rosemary leaves", "laid with dried rosemary sprigs"),
    ("rosemary", "laid with dried rosemary sprigs"),
    ("thyme leaves", "sprinkled with dried thyme leaves"),
    ("thyme", "sprinkled with dried thyme leaves"),
    ("sage leaves", "pressed with whole dried sage leaves"),
    ("sage", "pressed with whole dried sage leaves"),
    ("basil leaves", "sprinkled with dried basil leaves"),
    ("peppermint leaves", "sprinkled with dried peppermint leaves"),
    ("mint leaves", "sprinkled with dried mint leaves"),
    ("lemongrass", "topped with snipped dried lemongrass"),
    ("verbena leaves", "sprinkled with dried lemon verbena leaves"),
    ("sandalwood chip", "dotted with sandalwood chips"),
    ("cedarwood shaving", "dotted with fine cedarwood shavings"),
    ("patchouli lea", "sprinkled with dried patchouli leaves"),
    ("vanilla bean", "flecked with vanilla bean specks"),
    ("ginger", "dusted with ground ginger"),
    ("nutmeg", "dusted with ground nutmeg"),
    ("cardamom", "dusted with ground cardamom"),
    ("ground cinnamon", "dusted with ground cinnamon"),
    ("ground clove", "dusted with ground cloves"),
    ("dried flower", "scattered with mixed dried flowers"),
]

# scent/ingredient keyword -> styling prop beside the bars
PROPS: list[tuple[str, str]] = [
    ("lavender", "fresh lavender sprigs"),
    ("rose", "a single garden rose"),
    ("jasmine", "fresh jasmine blossoms"),
    ("chamomile", "loose chamomile flowers"),
    ("calendula", "fresh calendula petals"),
    ("gardenia", "a white gardenia bloom"),
    ("plumeria", "frangipani flowers"),
    ("hibiscus", "a red hibiscus flower"),
    ("honeysuckle", "honeysuckle vine"),
    ("orchid", "a purple orchid stem"),
    ("lotus", "a pink lotus flower"),
    ("ylang", "yellow ylang ylang petals"),
    ("neroli", "orange blossoms"),
    ("orange blossom", "orange blossoms"),
    ("grapefruit", "halved fresh grapefruit"),
    ("lemon verbena", "fresh verbena leaves"),
    ("lemongrass", "fresh lemongrass stalks"),
    ("lemon", "sliced fresh lemon"),
    ("lime", "sliced fresh lime"),
    ("bergamot", "a whole bergamot orange"),
    ("orange", "orange slices"),
    ("mandarin", "mandarin segments"),
    ("citronella", "citronella grass blades"),
    ("mango", "fresh mango cubes"),
    ("papaya", "a halved papaya"),
    ("pineapple", "fresh pineapple wedges"),
    ("passionfruit", "a halved passionfruit"),
    ("passion", "a halved passionfruit"),
    ("guava", "a halved pink guava"),
    ("kiwi", "sliced kiwi"),
    ("coconut", "a cracked coconut half"),
    ("banana", "banana slices"),
    ("strawberry", "fresh strawberries"),
    ("blueberry", "scattered blueberries"),
    ("cucumber", "cucumber ribbons"),
    ("aloe", "a cut aloe vera leaf"),
    ("avocado", "a halved avocado"),
    ("oatmeal", "a small bowl of oats"),
    ("oat", "a small bowl of oats"),
    ("honey", "a honey dipper with dripping honey"),
    ("goat milk", "a small pitcher of milk"),
    ("coffee", "scattered coffee beans"),
    ("cocoa", "cocoa powder and cacao nibs"),
    ("chocolate", "dark chocolate shards"),
    ("vanilla", "vanilla pods"),
    ("cinnamon", "cinnamon sticks"),
    ("clove", "whole cloves"),
    ("nutmeg", "whole nutmegs"),
    ("cardamom", "green cardamom pods"),
    ("ginger", "fresh ginger root"),
    ("peppermint", "fresh mint leaves"),
    ("spearmint", "fresh spearmint leaves"),
    ("mint", "fresh mint leaves"),
    ("eucalyptus", "a eucalyptus branch"),
    ("tea tree", "tea tree leaves"),
    ("rosemary", "fresh rosemary sprigs"),
    ("thyme", "fresh thyme sprigs"),
    ("sage", "fresh sage leaves"),
    ("basil", "fresh basil leaves"),
    ("cedarwood", "a small cedar bough"),
    ("sandalwood", "sandalwood sticks"),
    ("patchouli", "patchouli leaves"),
    ("vetiver", "a knot of vetiver roots"),
    ("frankincense", "frankincense resin tears"),
    ("myrrh", "myrrh resin pieces"),
    ("charcoal", "charcoal pieces"),
    ("turmeric", "turmeric roots"),
    ("matcha", "a bowl of matcha powder"),
    ("green tea", "loose green tea leaves"),
    ("seaweed", "dried seaweed"),
    ("sea salt", "coarse sea salt"),
    ("shea", "raw shea butter chunks"),
]

# Ingredient lines that are base oils/butters/lye/water — excluded from prop
# matching so "coconut oil" does not put a coconut beside every bar.
BASE_LINE = re.compile(
    r"^\s*[\d./\s]*(?:g|kg|ml|oz|grams?|ounces?|cups?|tbsp|tsp)?\s*"
    r"(?:organic\s+)?(?:extra\s+virgin\s+)?"
    r"(?:olive|coconut|palm|castor|sunflower|canola|grapeseed|sweet almond|almond|avocado|"
    r"jojoba|rice bran|sesame|argan|apricot|safflower|hemp(?:seed)?|kiwi seed|papaya seed|"
    r"guava seed|passion fruit|pineapple)\s*oil\b(?!.*(?:essential|fragrance))"
    r"|^\s*[\d./\s]*(?:g|kg|oz)?\s*(?:shea|cocoa|mango|kokum)\s*butter\b"
    r"|sodium hydroxide|lye\b|distilled water",
    re.IGNORECASE,
)

# Deterministic staging variation so sister recipes with identical ingredients
# still get visually distinct photos.
COUNTS = ["three", "two stacked", "a row of four", "a cluster of"]
SURFACES = [
    "rustic wooden surface with linen cloth",
    "cool grey slate slab with a linen runner",
    "pale marble counter with a wooden board",
    "weathered whitewashed wood with burlap",
]
LIGHTS = [
    "warm natural window light",
    "soft diffused morning light",
    "golden late-afternoon side light",
    "bright airy daylight",
]

FORM_BY_CATEGORY = {
    "Cold Process": "handmade cold-process soap bars with a rustic hand-cut edge",
    "Hot Process": "handmade hot-process soap bars with a rustic textured top",
    "Melt and Pour": "glossy melt-and-pour soap bars",
    "Lotions": "an open jar of whipped body lotion with a soft swirled peak",
    "Scrubs": "a glass jar of body scrub with a small wooden scoop",
    "Bath Bombs": "round handmade bath bombs",
    "Remedies": "a small amber tin of herbal salve",
    "Hair Care": "a solid shampoo bar on a wooden soap dish",
}


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).lower()
    slug = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return slug or "recipe"


def _key_re(key: str) -> re.Pattern[str]:
    """Whole-word match with optional plural, so 'rose' never matches 'rosemary'."""
    pattern = r"\b" + re.escape(key).replace(r"\ ", r"\s+") + r"(?:s|es)?\b"
    return re.compile(pattern)


def find_first(text: str, table: list[tuple[str, str]]) -> str | None:
    for key, phrase in table:
        if _key_re(key).search(text):
            return phrase
    return None


def find_props(text: str, limit: int = 2) -> list[str]:
    found: list[str] = []
    for key, phrase in PROPS:
        if _key_re(key).search(text) and phrase not in found:
            found.append(phrase)
        if len(found) >= limit:
            break
    return found


def bar_color(text: str, instructions: str) -> str:
    best: tuple[int, str] | None = None
    for key, phrase, prio in COLORANTS:
        if _key_re(key).search(text) and (best is None or prio > best[0]):
            best = (prio, phrase)
    micas = [c for c in MICA_COLORS if re.search(rf"\b{c}\b(?:\s+and\s+\w+)?\s+mica", text)]
    if micas and (best is None or best[0] < 60):
        if len(micas) >= 2:
            pattern = "layered" if "layer" in instructions else "marbled"
            return f"bars {pattern} in {micas[0]} and {micas[1]}"
        return f"soft {micas[0]}-tinted bars"
    if best:
        return best[1]
    return "natural cream-colored bars"


def build_prompt(slug: str, name: str, category: str, ingredients: list[str], instructions: str) -> dict:
    text = " | ".join(ingredients).lower()
    instr = (instructions or "").lower()
    lower_name = name.lower()
    if "massage oil" in lower_name or "oil blend" in lower_name:
        form = "a small glass bottle of golden body oil with a cork stopper"
    elif "face mask" in lower_name or "mask" in lower_name:
        form = "a small ceramic bowl of creamy face mask with a wooden applicator"
    elif "shampoo" in lower_name:
        form = "a solid shampoo bar on a wooden soap dish"
    elif "bath salt" in lower_name or "soak" in lower_name:
        form = "a glass jar of bath salts with a wooden scoop"
    elif "lip balm" in lower_name or "balm" in lower_name:
        form = "small open tins of herbal lip balm"
    else:
        form = FORM_BY_CATEGORY.get(category, "handmade soap bars")
    color = bar_color(text, instr)
    topping = find_first(text, TOPPINGS)
    # Props come from the name plus scent/additive lines only — never base oils.
    scent_lines = [line for line in ingredients if not BASE_LINE.search(line)]
    props = find_props((name + " | " + " | ".join(scent_lines)).lower())

    seed = sum(ord(c) for c in slug)
    count = COUNTS[seed % len(COUNTS)]
    surface = SURFACES[(seed // 4) % len(SURFACES)]
    light = LIGHTS[(seed // 16) % len(LIGHTS)]
    style = STYLE.replace("warm natural window light", light).replace(
        "rustic wooden surface with linen cloth", surface
    )

    subject = f"{count} {form}" if "bars" in form else form
    parts = [f"Overhead 45-degree product photograph of {subject}"]
    if "bars" in form:
        parts.append(color)
    if topping:
        parts.append(topping)
    if props:
        parts.append("styled beside " + " and ".join(props))
    prompt = ", ".join(parts) + ", " + style
    return {
        "name": name,
        "category": category,
        "prompt": prompt,
        "aspect_ratio": "4:3",
    }


def main() -> None:
    data = json.loads(RECIPES.read_text(encoding="utf-8"))
    used: set[str] = set()
    out: dict[str, dict] = {}
    for category, recipes in data.items():
        for recipe in recipes:
            base = slugify(recipe.get("name", "recipe"))
            slug = base
            suffix = 2
            while slug in used:
                slug = f"{base}-{suffix}"
                suffix += 1
            used.add(slug)
            ingredients = recipe.get("ingredients") or []
            if isinstance(ingredients, str):
                ingredients = [ingredients]
            out[slug] = build_prompt(
                slug,
                recipe.get("name", slug),
                category,
                ingredients,
                recipe.get("instructions", ""),
            )
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    distinct = len({v["prompt"] for v in out.values()})
    print(f"wrote {len(out)} prompts to {OUT}")
    print(f"distinct prompts: {distinct}")


if __name__ == "__main__":
    main()
