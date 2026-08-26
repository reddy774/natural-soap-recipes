import { loadDetailedPrep, type DetailedGuide } from "@/lib/detailedPrep";
import { useEffect, useState } from "react";

/**
 * Detailed guide for a recipe slug.
 * `undefined` while loading, `null` when no guide exists for this recipe.
 */
export function useDetailedPrep(slug: string): DetailedGuide | null | undefined {
  const [guide, setGuide] = useState<DetailedGuide | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    loadDetailedPrep()
      .then((map) => {
        if (alive) setGuide(map[slug] ?? null);
      })
      .catch(() => {
        if (alive) setGuide(null);
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  return guide;
}
