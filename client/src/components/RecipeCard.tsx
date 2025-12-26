import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, Thermometer, Sun } from "lucide-react";

interface Recipe {
  name: string;
  type: string;
  ingredients: string[] | string;
  instructions: string;
  source_url: string;
}

interface RecipeCardProps {
  recipe: Recipe;
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const isHotProcess = recipe.type === "Hot Process";

  return (
    <Card className="h-full flex flex-col overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-300 bg-card/50 backdrop-blur-sm group">
      <div className={`h-2 w-full ${isHotProcess ? "bg-orange-400/70" : "bg-primary/70"}`} />
      
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-4">
          <CardTitle className="text-xl font-serif leading-tight text-foreground/90 group-hover:text-primary transition-colors">
            {recipe.name}
          </CardTitle>
          <Badge 
            variant="outline" 
            className={`${isHotProcess ? "text-orange-600 border-orange-200 bg-orange-50" : "text-primary border-primary/20 bg-primary/5"} whitespace-nowrap`}
          >
            {isHotProcess ? <Sun className="w-3 h-3 mr-1" /> : <Thermometer className="w-3 h-3 mr-1" />}
            {recipe.type}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="flex-grow flex flex-col gap-4 pb-4">
        <div className="space-y-2">
          <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground text-xs">Ingredients</h4>
          <ul className="text-sm space-y-1 text-foreground/80 pl-2 border-l-2 border-muted">
            {Array.isArray(recipe.ingredients) ? (
              <>
                {recipe.ingredients.slice(0, 5).map((ing, i) => (
                  <li key={i} className="line-clamp-1">{ing}</li>
                ))}
                {recipe.ingredients.length > 5 && (
                  <li className="text-xs text-muted-foreground italic pt-1">
                    +{recipe.ingredients.length - 5} more ingredients...
                  </li>
                )}
              </>
            ) : (
              // Handle string ingredients (split by comma or newlines if possible, or just show)
              typeof recipe.ingredients === 'string' && recipe.ingredients.split(/,|\n/).slice(0, 5).map((ing, i) => (
                 <li key={i} className="line-clamp-1">{ing.trim()}</li>
              ))
            )}
          </ul>
        </div>
        
        <Separator className="bg-border/50" />
        
        <div className="space-y-2 flex-grow">
          <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground text-xs">Method</h4>
          <p className="text-sm text-foreground/70 line-clamp-4 leading-relaxed">
            {recipe.instructions}
          </p>
        </div>
      </CardContent>
      
      <CardFooter className="pt-0 pb-4">
        <Button 
          variant="ghost" 
          className="w-full justify-between text-primary hover:text-primary hover:bg-primary/5 group/btn"
          asChild
        >
          <a href={recipe.source_url} target="_blank" rel="noopener noreferrer">
            <span className="font-serif italic">View Full Recipe</span>
            <ExternalLink className="w-4 h-4 opacity-50 group-hover/btn:opacity-100 transition-opacity" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}
