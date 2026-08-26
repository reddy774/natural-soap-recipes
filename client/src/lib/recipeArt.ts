/**
 * Deterministic, ingredient-driven art specs for recipe illustrations.
 *
 * Pure logic only (no React): motif detection from a recipe's name +
 * ingredients, a per-motif palette tuned to the site's sage/cream theme,
 * and a seeded PRNG so the same slug always yields identical art.
 */

export type MotifId =
  | "lavender"
  | "rose"
  | "chamomile"
  | "jasmine"
  | "citrus"
  | "coffee"
  | "cocoa"
  | "oat"
  | "honey"
  | "coconut"
  | "charcoal"
  | "clay"
  | "seaSalt"
  | "mint"
  | "eucalyptus"
  | "teaTree"
  | "aloe"
  | "vanilla"
  | "spice"
  | "berry"
  | "wood"
  | "olive"
  | "milk"
  | "butter"
  | "seed"
  | "herb"
  | "flower"
  | "sprig";

export interface MotifPalette {
  /** Stroke / line-art tone (muted, harmonizes with sage) */
  ink: string;
  /** Soft fill tone for petals, fruit, washes */
  fill: string;
}

export interface RecipeArtInput {
  name: string;
  slug: string;
  ingredients: string[] | string;
  category: string;
}

export interface RecipeArtSpec {
  primary: MotifId;
  secondary: MotifId | null;
  palette: MotifPalette;
  secondaryPalette: MotifPalette;
  seed: number;
}

interface MotifRule {
  id: MotifId;
  /** Matched against the lowercase recipe name (strong signal) */
  name: RegExp;
  /**
   * Matched against the lowercase ingredients text (weak signal).
   * Omitted for base oils/butters that appear in nearly every recipe —
   * those only count when featured in the name.
   */
  ingredient?: RegExp;
}

const NAME_WEIGHT = 10;
const INGREDIENT_WEIGHT = 3;

/**
 * Detection rules in tie-break priority order (earlier wins on equal score).
 * More distinctive additives come first; broad catch-alls last.
 */
const MOTIF_RULES: readonly MotifRule[] = [
  { id: "lavender", name: /lavender/, ingredient: /lavender/ },
  { id: "charcoal", name: /charcoal|black soap/, ingredient: /charcoal/ },
  { id: "coffee", name: /coffee|espresso|mocha/, ingredient: /coffee|espresso/ },
  {
    id: "clay",
    name: /clay|kaolin|bentonite|rhassoul/,
    ingredient: /clay|kaolin|bentonite|rhassoul/,
  },
  { id: "aloe", name: /aloe/, ingredient: /aloe/ },
  { id: "teaTree", name: /tea tree/, ingredient: /tea tree/ },
  { id: "eucalyptus", name: /eucalyptus/, ingredient: /eucalyptus/ },
  {
    id: "mint",
    name: /peppermint|spearmint|\bmint\b|menthol/,
    ingredient: /peppermint|spearmint|\bmint\b|menthol/,
  },
  { id: "rose", name: /rose(?!mary)/, ingredient: /rose(?!mary)/ },
  { id: "jasmine", name: /jasmine/, ingredient: /jasmine/ },
  {
    id: "chamomile",
    name: /chamomile|calendula|marigold|daisy/,
    ingredient: /chamomile|calendula|marigold/,
  },
  {
    id: "citrus",
    name: /\borange|lemon(?!grass)|\blime\b|grapefruit|bergamot|citrus|tangerine|mandarin|yuzu|neroli/,
    ingredient: /\borange|lemon(?!grass)|\blime\b|grapefruit|bergamot|tangerine|mandarin|yuzu/,
  },
  { id: "oat", name: /\boat/, ingredient: /\boat(?!\s*milk)/ },
  { id: "honey", name: /honey(?!suckle)|beeswax/, ingredient: /honey(?!suckle)|beeswax/ },
  {
    id: "cocoa",
    name: /cocoa(?!\s*butter)|chocolate|cacao(?!\s*butter)/,
    ingredient: /cocoa(?!\s*butter)|chocolate|cacao(?!\s*butter)/,
  },
  {
    id: "seaSalt",
    name: /sea salt|salt bar|himalayan|brine|\bsalt\b/,
    ingredient: /sea salt|himalayan\s+(?:pink\s+)?salt|dead sea/,
  },
  { id: "vanilla", name: /vanilla/, ingredient: /vanilla/ },
  {
    id: "spice",
    name: /cinnamon|ginger|clove|nutmeg|allspice|cardamom|spice|pumpkin|turmeric|anise/,
    ingredient: /cinnamon|ginger|clove|nutmeg|allspice|cardamom|pumpkin|turmeric|anise/,
  },
  {
    id: "berry",
    name: /berry|berries|strawberr|blueberr|raspberr|cranberr|\bapple\b|peach|banana|papaya|pomegranate|apricot|cherr|melon|cucumber|kiwi|\bpear\b|\bplum\b|\bfig\b/,
    ingredient: /strawberr|blueberr|raspberr|cranberr|pomegranate|papaya|cucumber/,
  },
  {
    id: "wood",
    name: /sandalwood|cedarwood|\bcedar\b|\bpine\b|frankincense|patchouli|vetiver|oakmoss|\boak\b/,
    ingredient: /sandalwood|cedarwood|patchouli|vetiver|oakmoss/,
  },
  {
    id: "seed",
    name: /\bhemp\b|poppy|\bflax\b|\bchia\b/,
    ingredient: /poppy seed|\bchia\b|flax seed|flaxseed/,
  },
  {
    id: "herb",
    name: /rosemary|\bsage\b|thyme|basil|nettle|comfrey|plantain|lemongrass|dandelion|green tea|matcha|moringa|spirulina|kelp|seaweed|neem|tulsi|parsley/,
    ingredient: /rosemary|nettle|comfrey|plantain|lemongrass|dandelion|green tea|matcha|moringa|spirulina|kelp|seaweed|neem/,
  },
  {
    id: "flower",
    name: /flower|floral|petal|hibiscus|geranium|ylang|plumeria|blossom|lilac|\blily\b|peony|violet|\biris\b|magnolia|honeysuckle|gardenia|freesia|elderflower|wildflower/,
    ingredient: /hibiscus|geranium|ylang|petal/,
  },
  // Base oils / dairy / butters: name (or a distinctive ingredient form) only.
  {
    id: "coconut",
    name: /coconut/,
    ingredient: /coconut (?:milk|cream|water|shred|flake)/,
  },
  {
    id: "milk",
    name: /\bmilk\b|yogurt|buttermilk|kefir/,
    ingredient: /goat'?s? milk|donkey milk|camel milk|buttermilk|milk powder|yogurt|kefir/,
  },
  { id: "butter", name: /\bshea\b|cocoa butter|mango butter|\bbutter\b/ },
  { id: "olive", name: /olive|castile/ },
] as const;

export const MOTIF_IDS: readonly MotifId[] = [
  ...MOTIF_RULES.map((rule) => rule.id),
  "sprig",
];

/** Muted tones tuned to sit beside the site's sage/cream palette */
const MOTIF_PALETTES: Record<MotifId, MotifPalette> = {
  lavender: { ink: "#7c6a9c", fill: "#b9a8d4" },
  rose: { ink: "#a8626e", fill: "#dfaab4" },
  chamomile: { ink: "#a08434", fill: "#f2e3b3" },
  jasmine: { ink: "#7a8577", fill: "#f4f0e4" },
  citrus: { ink: "#c07f3a", fill: "#eec27a" },
  coffee: { ink: "#6b4f3a", fill: "#a98868" },
  cocoa: { ink: "#5d4037", fill: "#8d6e5c" },
  oat: { ink: "#a08c62", fill: "#dcc9a3" },
  honey: { ink: "#b3822e", fill: "#e7bc66" },
  coconut: { ink: "#8a7d6a", fill: "#f0ebe0" },
  charcoal: { ink: "#4a4a4a", fill: "#8a8a86" },
  clay: { ink: "#b0736a", fill: "#d9a99e" },
  seaSalt: { ink: "#6c8598", fill: "#b3c6d2" },
  mint: { ink: "#4f7d62", fill: "#a4c9ae" },
  eucalyptus: { ink: "#5f7d70", fill: "#a9c2b2" },
  teaTree: { ink: "#5a7a5e", fill: "#a8c4a0" },
  aloe: { ink: "#55805a", fill: "#9cc49a" },
  vanilla: { ink: "#9c8a5a", fill: "#efe2c0" },
  spice: { ink: "#96562f", fill: "#cf9a63" },
  berry: { ink: "#8a4a62", fill: "#c98aa2" },
  wood: { ink: "#7a5c44", fill: "#b39478" },
  olive: { ink: "#6d7a3f", fill: "#aab86a" },
  milk: { ink: "#8f857a", fill: "#f2ede2" },
  butter: { ink: "#a3894f", fill: "#eeda9e" },
  seed: { ink: "#6f7d54", fill: "#b4bd8a" },
  herb: { ink: "#5c7350", fill: "#a3bd8e" },
  flower: { ink: "#9a7086", fill: "#d4a8c4" },
  sprig: { ink: "#647a52", fill: "#b9c9a4" },
};

export function getMotifPalette(motif: MotifId): MotifPalette {
  return MOTIF_PALETTES[motif];
}

function ingredientsToText(ingredients: string[] | string): string {
  return Array.isArray(ingredients) ? ingredients.join("\n") : ingredients;
}

/**
 * Detect up to two motifs from a recipe's name + ingredients.
 * Returns [] when nothing matches (caller falls back to the sprig motif).
 */
export function detectMotifs(
  name: string,
  ingredients: string[] | string
): MotifId[] {
  const lowerName = name.toLowerCase();
  const lowerIngredients = ingredientsToText(ingredients).toLowerCase();

  const scored: Array<{ id: MotifId; score: number; priority: number }> = [];
  MOTIF_RULES.forEach((rule, priority) => {
    let score = 0;
    if (rule.name.test(lowerName)) score += NAME_WEIGHT;
    if (rule.ingredient && rule.ingredient.test(lowerIngredients)) {
      score += INGREDIENT_WEIGHT;
    }
    if (score > 0) scored.push({ id: rule.id, score, priority });
  });

  const ranked = [...scored].sort(
    (a, b) => b.score - a.score || a.priority - b.priority
  );
  return ranked.slice(0, 2).map((entry) => entry.id);
}

// --- Seeded PRNG ------------------------------------------------------------

/** FNV-1a 32-bit hash of a string → stable numeric seed */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: tiny deterministic PRNG returning floats in [0, 1) */
export function createPrng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Full art spec for a recipe: motifs, palettes, and the layout seed */
export function buildArtSpec(input: RecipeArtInput): RecipeArtSpec {
  const motifs = detectMotifs(input.name, input.ingredients);
  const primary: MotifId = motifs[0] ?? "sprig";
  const secondary: MotifId | null = motifs[1] ?? null;
  return {
    primary,
    secondary,
    palette: MOTIF_PALETTES[primary],
    secondaryPalette: MOTIF_PALETTES[secondary ?? primary],
    seed: hashString(input.slug),
  };
}
