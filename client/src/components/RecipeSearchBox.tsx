import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ALL_RECIPES, searchRecipes } from "@/lib/recipes";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

const MAX_SUGGESTIONS = 8;

interface RecipeSearchBoxProps {
  className?: string;
}

/**
 * Compact search-driven suggestion box for the hero. Shows the top matches
 * across all recipes and navigates straight to the recipe page on select.
 */
export function RecipeSearchBox({ className }: RecipeSearchBoxProps) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 200);
  const [, navigate] = useLocation();

  const matches = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    return searchRecipes(ALL_RECIPES, debouncedQuery).slice(0, MAX_SUGGESTIONS);
  }, [debouncedQuery]);

  const showSuggestions = focused && debouncedQuery.trim().length > 0;

  return (
    <div className={cn("relative w-full text-left", className)}>
      <Command shouldFilter={false} className="overflow-visible bg-transparent">
        <div className="rounded-2xl border border-white/40 bg-background/95 shadow-xl backdrop-blur-md">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              // Delay so clicking a suggestion registers before the list closes
              setTimeout(() => setFocused(false), 150);
            }}
            placeholder="Search recipes by name or ingredient..."
            aria-label="Search recipes"
            className="h-12 text-base"
          />
        </div>
        {showSuggestions && (
          <CommandList className="absolute top-full z-50 mt-2 w-full rounded-2xl border border-border/60 bg-popover shadow-xl">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              No recipes match your search.
            </CommandEmpty>
            {matches.length > 0 && (
              <CommandGroup heading="Top matches">
                {matches.map((recipe) => (
                  <CommandItem
                    key={recipe.slug}
                    value={recipe.slug}
                    onSelect={() => {
                      setQuery("");
                      navigate(`/recipe/${recipe.slug}`);
                    }}
                    className="cursor-pointer gap-3 rounded-xl px-3 py-2.5"
                  >
                    <span className="truncate font-medium">{recipe.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {recipe.category}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        )}
      </Command>
    </div>
  );
}
