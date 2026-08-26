import { FavoriteButton } from "@/components/FavoriteButton";
import { RecipeArt } from "@/components/RecipeArt";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getCategoryStyle } from "@/lib/categories";
import type { FlatRecipe } from "@/lib/recipes";
import { cn } from "@/lib/utils";
import { ArrowRight, Leaf } from "lucide-react";
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
      className="group block h-full rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      aria-label={`View recipe: ${recipe.name}`}
    >
      <Card className="card-lift relative flex h-full flex-col overflow-hidden rounded-2xl border-border/60 bg-card shadow-sm">
        <div className={cn("h-1.5 w-full", style.bar)} />

        <RecipeArt recipe={recipe} variant="card" />

        <FavoriteButton
          slug={recipe.slug}
          className="absolute right-2.5 top-4 z-10"
        />

        <CardHeader className="pb-2 pr-14">
          <CardTitle className="font-serif text-xl leading-tight text-foreground/90 transition-colors group-hover:text-primary">
            {recipe.name}
          </CardTitle>
          <Badge
            variant="outline"
            className={cn("mt-2 w-fit whitespace-nowrap", style.badge)}
          >
            <Leaf className="mr-1 h-3 w-3" />
            {recipe.category}
          </Badge>
        </CardHeader>

        <CardContent className="flex flex-grow flex-col gap-4 pb-4">
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Ingredients
            </h4>
            <ul className="space-y-1 border-l-2 border-accent pl-3 text-sm text-foreground/80">
              {ingredients.slice(0, 5).map((ingredient, index) => (
                <li key={index} className="line-clamp-1">
                  {ingredient}
                </li>
              ))}
              {ingredients.length > 5 && (
                <li className="pt-1 text-xs italic text-muted-foreground">
                  +{ingredients.length - 5} more ingredients...
                </li>
              )}
            </ul>
          </div>

          <Separator className="bg-border/50" />

          <div className="flex-grow space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Method
            </h4>
            <p className="line-clamp-3 text-sm leading-relaxed text-foreground/70">
              {recipe.instructions}
            </p>
          </div>
        </CardContent>

        <CardFooter className="pb-5 pt-0">
          <span className="flex w-full items-center justify-between text-sm text-primary">
            <span className="font-serif italic">Read the recipe</span>
            <ArrowRight className="h-4 w-4 opacity-50 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100" />
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
