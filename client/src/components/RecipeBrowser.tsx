import { SprigDivider } from "@/components/BotanicalAccents";
import { RecipeCard } from "@/components/RecipeCard";
import SoapCalcReplica from "@/components/SoapCalcReplica";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useFavorites } from "@/hooks/useFavorites";
import {
  ALL_TABS,
  CALCULATOR_TAB,
  FAVORITES_TAB,
  getCategoryStyle,
  getTabCategory,
} from "@/lib/categories";
import { ALL_RECIPES, CATEGORY_COUNTS, searchRecipes } from "@/lib/recipes";
import { cn } from "@/lib/utils";
import { Heart, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const CHUNK_SIZE = 24;

interface RecipeBrowserProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

function tabLabel(tab: { id: string; label: string; category: string | null }, favoritesCount: number): string {
  if (tab.category) return `${tab.label} (${CATEGORY_COUNTS[tab.category] ?? 0})`;
  if (tab.id === "all") return `${tab.label} (${ALL_RECIPES.length})`;
  if (tab.id === "favorites") return `${tab.label} (${favoritesCount})`;
  return tab.label;
}

function tabActiveClasses(tabId: string, category: string | null): string {
  if (tabId === "calculator") {
    return "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold";
  }
  const base = "data-[state=active]:bg-background data-[state=active]:shadow-sm";
  if (category) return cn(base, getCategoryStyle(category).activeTab);
  if (tabId === "favorites") return cn(base, "data-[state=active]:text-clay");
  return cn(base, "data-[state=active]:text-primary");
}

export function RecipeBrowser({ activeTab, onTabChange }: RecipeBrowserProps) {
  const { favorites } = useFavorites();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 200);
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);

  const baseRecipes = useMemo(() => {
    if (activeTab === FAVORITES_TAB.id) {
      const favoriteSet = new Set(favorites);
      return ALL_RECIPES.filter((recipe) => favoriteSet.has(recipe.slug));
    }
    const category = getTabCategory(activeTab);
    if (category) return ALL_RECIPES.filter((recipe) => recipe.category === category);
    return ALL_RECIPES;
  }, [activeTab, favorites]);

  const results = useMemo(
    () => searchRecipes(baseRecipes, debouncedQuery),
    [baseRecipes, debouncedQuery]
  );

  // Reset pagination whenever the result set fundamentally changes
  useEffect(() => {
    setVisibleCount(CHUNK_SIZE);
  }, [activeTab, debouncedQuery]);

  const visibleRecipes = results.slice(0, visibleCount);
  const hasQuery = debouncedQuery.trim().length > 0;
  const isCalculator = activeTab === CALCULATOR_TAB.id;
  const isFavoritesTab = activeTab === FAVORITES_TAB.id;

  const recipeHref = (slug: string) =>
    activeTab === "all" ? `/recipe/${slug}` : `/recipe/${slug}?tab=${activeTab}`;

  return (
    <div className="space-y-10">
      {/* Category Tabs */}
      <div className="flex flex-col items-center space-y-6">
        <div className="space-y-3 text-center">
          <h2 className="font-serif text-3xl font-bold text-foreground">Browse the Collection</h2>
          <p className="font-hand text-xl text-muted-foreground">
            handmade with time, patience &amp; good oils
          </p>
          <SprigDivider className="pt-1" />
        </div>

        <Tabs value={activeTab} onValueChange={onTabChange} className="w-full max-w-5xl">
          <TabsList className="flex h-auto w-full flex-wrap justify-center gap-2 rounded-2xl bg-muted/40 p-2 backdrop-blur-sm">
            {ALL_TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  "min-w-[100px] flex-1 rounded-xl py-3 font-serif transition-all duration-300",
                  tabActiveClasses(tab.id, tab.category)
                )}
              >
                {tabLabel(tab, favorites.length)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {isCalculator ? (
        <div className="mx-auto max-w-7xl">
          <SoapCalcReplica />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Search */}
          <div className="mx-auto w-full max-w-xl space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, ingredient, or benefit..."
                aria-label="Search recipes"
                className="h-12 rounded-full border-border/70 bg-card pl-11 pr-11 shadow-sm focus-visible:ring-primary/40 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {hasQuery && (
              <p role="status" className="text-center text-sm text-muted-foreground">
                {results.length} {results.length === 1 ? "recipe" : "recipes"} found
                {` for “${debouncedQuery.trim()}”`}
              </p>
            )}
          </div>

          {/* Grid */}
          {results.length > 0 && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {visibleRecipes.map((recipe, index) => (
                <div
                  key={recipe.slug}
                  className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both h-full duration-500"
                  style={{ animationDelay: `${Math.min(index % CHUNK_SIZE, 11) * 40}ms` }}
                >
                  <RecipeCard recipe={recipe} href={recipeHref(recipe.slug)} />
                </div>
              ))}
            </div>
          )}

          {/* Load more */}
          {results.length > visibleCount && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => setVisibleCount((count) => count + CHUNK_SIZE)}
                className="rounded-full border-primary/30 px-8 font-serif text-primary hover:bg-primary/5 hover:text-primary"
              >
                Load more recipes ({results.length - visibleCount} remaining)
              </Button>
            </div>
          )}

          {/* Empty states */}
          {results.length === 0 && (
            <div className="rounded-2xl border border-dashed border-muted-foreground/20 bg-muted/30 px-6 py-20 text-center">
              {isFavoritesTab && !hasQuery ? (
                <div className="space-y-3">
                  <Heart className="mx-auto h-8 w-8 text-clay/50" />
                  <p className="font-serif text-lg italic text-muted-foreground">
                    No favorites yet.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Tap the heart on any recipe to keep it here.
                  </p>
                </div>
              ) : hasQuery ? (
                <div className="space-y-4">
                  <p className="font-serif text-lg italic text-muted-foreground">
                    No recipes match {`“${debouncedQuery.trim()}”`}
                    {isFavoritesTab ? " in your favorites." : " in this category."}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setQuery("")}
                    className="rounded-full px-6"
                  >
                    Clear search
                  </Button>
                </div>
              ) : (
                <p className="font-serif text-lg italic text-muted-foreground">
                  No recipes found in this category.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
