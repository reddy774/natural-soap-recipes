import recipesData from "@/data/recipes.json";

export interface StructuredIngredient {
  amount?: number;
  unit?: string;
  name?: string;
  original?: string;
  percentage?: number;
  is_percentage?: boolean;
}

export interface Recipe {
  name: string;
  type: string;
  ingredients: string[] | string;
  instructions: string;
  source_url: string;
  benefits?: string;
  /** Collection name shown when no source_url exists */
  source?: string;
  structured_ingredients?: StructuredIngredient[];
  /** Set when the published NaOH amount exceeds saponification sanity checks */
  lye_warning?: boolean;
}

/** A recipe tagged with the category it lives under plus a stable URL slug */
export interface FlatRecipe extends Recipe {
  category: string;
  slug: string;
}

// Boundary cast: the JSON is a dict keyed by category. Fields are validated
// loosely here on purpose — the file is regenerated externally and will grow.
const data = recipesData as unknown as Record<string, Recipe[]>;

/** Category names derived from the JSON dict keys (order preserved) */
export const CATEGORIES: readonly string[] = Object.keys(data);

export function slugifyName(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "recipe";
}

function buildFlatRecipes(): FlatRecipe[] {
  const used = new Set<string>();
  const flat: FlatRecipe[] = [];
  for (const category of CATEGORIES) {
    for (const recipe of data[category] ?? []) {
      const base = slugifyName(recipe.name);
      let slug = base;
      let suffix = 2;
      while (used.has(slug)) {
        slug = `${base}-${suffix}`;
        suffix += 1;
      }
      used.add(slug);
      flat.push({ ...recipe, category, slug });
    }
  }
  return flat;
}

/** Every recipe, flattened and tagged with category + slug. Built once. */
export const ALL_RECIPES: readonly FlatRecipe[] = buildFlatRecipes();

const recipesBySlug = new Map(ALL_RECIPES.map((recipe) => [recipe.slug, recipe]));

export function getRecipeBySlug(slug: string): FlatRecipe | undefined {
  return recipesBySlug.get(slug);
}

/** Recipe count per category, computed once for tab labels */
export const CATEGORY_COUNTS: Readonly<Record<string, number>> = Object.fromEntries(
  CATEGORIES.map((category) => [category, (data[category] ?? []).length])
);

// --- Search -----------------------------------------------------------------

function ingredientsText(recipe: Recipe): string {
  return Array.isArray(recipe.ingredients)
    ? recipe.ingredients.join("\n")
    : recipe.ingredients;
}

// Memoized lowercase corpus: slug -> searchable text (built lazily, kept forever)
const haystacks = new Map<string, string>();

function getHaystack(recipe: FlatRecipe): string {
  const cached = haystacks.get(recipe.slug);
  if (cached !== undefined) return cached;
  const haystack = [recipe.name, ingredientsText(recipe), recipe.benefits ?? ""]
    .join("\n")
    .toLowerCase();
  haystacks.set(recipe.slug, haystack);
  return haystack;
}

/**
 * Case-insensitive match on name + ingredients + benefits.
 * Every whitespace-separated token must appear somewhere in the recipe.
 */
export function searchRecipes(
  recipes: readonly FlatRecipe[],
  query: string
): FlatRecipe[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [...recipes];
  return recipes.filter((recipe) => {
    const haystack = getHaystack(recipe);
    return tokens.every((token) => haystack.includes(token));
  });
}
