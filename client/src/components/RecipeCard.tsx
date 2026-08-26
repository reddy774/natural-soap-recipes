import { FavoriteButton } from "@/components/FavoriteButton";
import { RecipeArt } from "@/components/RecipeArt";
import { Card, CardContent, CardFooter, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getCategoryStyle } from "@/lib/categories";
import type { FlatRecipe } from "@/lib/recipes";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";

interface RecipeCardProps {
  recipe: FlatRecipe;
  /** Internal link target, e.g. /recipe/lavender-soap?tab=cold-process */
  href: string;
}

function ingredientPreview(recipe: FlatRecipe): string[] {
  if (Array.isArray(recipe.ingredients)) return recipe.ingredients;
  return recipe.ingredients
    .split(/,|\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function RecipeCard({ recipe, href }: RecipeCardProps) {
  const style = getCategoryStyle(recipe.category);
  const ingredients = ingredientPreview(recipe);

  return (
    <Link
      href={href}
      className="group block h-full rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      aria-label={`View recipe: ${recipe.name}`}
    >
      <Card className="card-lift relative flex h-full flex-col overflow-hidden rounded-lg border-border/60 bg-card shadow-sm">
        <RecipeArt recipe={recipe} variant="card" />

        <FavoriteButton
          slug={recipe.slug}
          className="absolute right-2.5 top-2.5 z-20"
        />

        {/* Label band — the paper band around a wrapped bar of soap */}
        <div className="relative z-10 -mt-7 mx-3 flex items-stretch overflow-hidden rounded-sm border border-border/70 bg-card shadow-sm">
          <div className={cn("w-1.5 shrink-0", style.bar)} aria-hidden="true" />
          <div className="min-w-0 px-3.5 py-2.5">
            <CardTitle className="font-serif text-lg leading-snug text-foreground transition-colors group-hover:text-primary">
              {recipe.name}
            </CardTitle>
            <p className="mt-1 font-mono text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {recipe.category}
            </p>
          </div>
        </div>

        <CardContent className="flex flex-grow flex-col gap-4 px-4 pb-4 pt-4">
          <div className="space-y-2">
            <h4 className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Ingredients
            </h4>
            <ul className="space-y-1 border-l-2 border-accent pl-3 text-sm text-foreground/80">
              {ingredients.slice(0, 5).map((ingredient, index) => (
                <li key={index} className="line-clamp-1">
                  {ingredient}
                </li>
              ))}
              {ingredients.length > 5 && (
                <li className="pt-1 font-hand text-xs text-muted-foreground">
                  +{ingredients.length - 5} more ingredients
                </li>
              )}
            </ul>
          </div>

          <Separator className="bg-border/50" />

          <div className="flex-grow space-y-2">
            <h4 className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Method
            </h4>
            <p className="line-clamp-3 text-sm leading-relaxed text-foreground/70">
              {recipe.instructions}
            </p>
          </div>
        </CardContent>

        <CardFooter className="px-4 pb-5 pt-0">
          <span className="flex w-full items-center justify-between text-sm text-primary">
            <span className="font-hand text-base">Read the recipe</span>
            <ArrowRight className="h-4 w-4 opacity-50 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100" />
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
