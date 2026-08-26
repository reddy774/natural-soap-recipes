/**
 * Detailed "how to make" guides that live ALONGSIDE each recipe's original
 * instructions (never replacing them). Keyed by recipe slug and loaded
 * lazily so the main bundle doesn't grow with the guide corpus.
 */

export interface DetailedSection {
  title: string;
  steps: string[];
}

export interface DetailedGuide {
  sections: DetailedSection[];
  tips?: string[];
  cure_and_storage?: string;
  sources?: string[];
}

export type DetailedPrepMap = Record<string, DetailedGuide>;

let cache: DetailedPrepMap | null = null;

export async function loadDetailedPrep(): Promise<DetailedPrepMap> {
  if (!cache) {
    const mod = await import("@/data/detailed_prep.json");
    // Boundary cast: the JSON is regenerated externally (scripts/merge_detailed_prep.py
    // validates its shape); typing is asserted here on purpose, as in recipes.ts.
    cache = mod.default as unknown as DetailedPrepMap;
  }
  return cache;
}
