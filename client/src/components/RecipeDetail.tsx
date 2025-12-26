import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Calculator, ExternalLink, Leaf, Scale, Sun, Thermometer } from "lucide-react";
import { useState } from "react";

// Helper to map instruction text to images
const getInstructionImage = (text: string) => {
  const lower = text.toLowerCase();
  if (lower.includes("mix") && (lower.includes("oil") || lower.includes("butter"))) return "/images/step-mixing-oils.jpg";
  if (lower.includes("stick blend") || lower.includes("trace") || lower.includes("emulsify")) return "/images/step-stick-blending.jpg";
  if (lower.includes("pour") && lower.includes("mold")) return "/images/step-pouring-mold.jpg";
  if (lower.includes("cut") || lower.includes("slice") || lower.includes("bar")) return "/images/step-cutting-bars.jpg";
  if (lower.includes("lye") || lower.includes("sodium hydroxide") || lower.includes("safety")) return "/images/step-measuring-lye.jpg";
  return null;
};

interface Ingredient {
  amount?: number;
  unit?: string;
  name?: string;
  original?: string;
  percentage?: number;
  is_percentage?: boolean;
}

interface Recipe {
  name: string;
  type: string;
  ingredients: string[] | string;
  structured_ingredients?: Ingredient[];
  instructions: string;
  source_url: string;
  benefits?: string;
}

interface RecipeDetailProps {
  recipe: Recipe;
  onBack: () => void;
}

export function RecipeDetail({ recipe, onBack }: RecipeDetailProps) {
  const isHotProcess = recipe.type === "Hot Process";
  const [batchScale, setBatchScale] = useState(1); // 1 = 100% (original size)

  // Helper to get recipe image based on name keywords
  const getRecipeImage = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes("coffee")) return "/images/recipe-coffee.jpg";
    if (lowerName.includes("oat") || lowerName.includes("honey")) return "/images/recipe-oatmeal.jpg";
    if (lowerName.includes("aloe")) return "/images/recipe-aloe.jpg";
    if (lowerName.includes("lavender")) return "/images/recipe-lavender.jpg";
    if (lowerName.includes("charcoal") || lowerName.includes("black")) return "/images/recipe-charcoal.jpg";
    return null; // Fallback to no specific image
  };

  const recipeImage = getRecipeImage(recipe.name);

  // Helper to format amount based on scale
  const formatAmount = (ing: Ingredient) => {
    if (ing.is_percentage) {
      return `${ing.percentage}%`;
    }
    if (ing.amount) {
      const scaled = ing.amount * batchScale;
      // Round to 2 decimal places
      const rounded = Math.round(scaled * 100) / 100;
      return `${rounded} ${ing.unit || ''}`;
    }
    return null;
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
      <div className="mb-6 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="pl-0 hover:bg-transparent hover:text-primary">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Collection
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-grow">
        {/* Left Column: Ingredients & Calculator (Sticky on desktop) */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-lg bg-card/80 backdrop-blur-md overflow-hidden sticky top-6">
            <div className={`h-3 w-full ${isHotProcess ? "bg-orange-400" : "bg-primary"}`} />
            
            {recipeImage && (
              <div className="w-full h-48 overflow-hidden relative">
                <img 
                  src={recipeImage} 
                  alt={recipe.name} 
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
            )}

            <CardContent className="p-6 space-y-6">
              <div>
                <Badge 
                  variant="outline" 
                  className={`mb-4 ${isHotProcess ? "text-orange-600 border-orange-200 bg-orange-50" : "text-primary border-primary/20 bg-primary/5"}`}
                >
                  {isHotProcess ? <Sun className="w-3 h-3 mr-2" /> : <Thermometer className="w-3 h-3 mr-2" />}
                  {recipe.type}
                </Badge>
                <h1 className="text-3xl font-serif font-bold text-foreground leading-tight mb-2">
                  {recipe.name}
                </h1>
                {recipe.benefits && (
                  <p className="text-sm text-muted-foreground italic mt-2">
                    {recipe.benefits}
                  </p>
                )}
              </div>

              <Separator />

              {/* Batch Calculator */}
              <div className="bg-muted/30 p-4 rounded-lg border border-muted space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider flex items-center text-primary">
                    <Calculator className="w-4 h-4 mr-2" />
                    Batch Calculator
                  </h3>
                  <Badge variant="secondary" className="font-mono">
                    {Math.round(batchScale * 100)}%
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0.5x</span>
                    <span>Original (1x)</span>
                    <span>3x</span>
                  </div>
                  <Slider 
                    defaultValue={[1]} 
                    min={0.5} 
                    max={3} 
                    step={0.1} 
                    value={[batchScale]}
                    onValueChange={(vals) => setBatchScale(vals[0])}
                    className="py-2"
                  />
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    Adjust slider to scale ingredient amounts
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center">
                  <Scale className="w-4 h-4 mr-2" />
                  Ingredients
                </h3>
                <ul className="space-y-3">
                  {recipe.structured_ingredients ? (
                    recipe.structured_ingredients.map((ing, idx) => (
                      <li key={idx} className="text-sm text-foreground/90 flex items-start group justify-between border-b border-border/40 pb-2 last:border-0">
                        <span className="font-medium text-foreground/70">{ing.name}</span>
                        <span className="font-bold font-mono text-primary">
                          {formatAmount(ing) || ing.original}
                        </span>
                      </li>
                    ))
                  ) : (
                    Array.isArray(recipe.ingredients) ? (
                      recipe.ingredients.map((ingredient, idx) => (
                        <li key={idx} className="text-sm text-foreground/90 flex items-start group">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/40 mt-1.5 mr-3 group-hover:bg-primary transition-colors" />
                          <span className="leading-relaxed">{ingredient}</span>
                        </li>
                      ))
                    ) : (
                      typeof recipe.ingredients === 'string' && recipe.ingredients.split(/,|\n/).map((ingredient, idx) => (
                        <li key={idx} className="text-sm text-foreground/90 flex items-start group">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/40 mt-1.5 mr-3 group-hover:bg-primary transition-colors" />
                          <span className="leading-relaxed">{ingredient.trim()}</span>
                        </li>
                      ))
                    )
                  )}
                </ul>
              </div>

              <div className="pt-4">
                <Button className="w-full font-serif italic" asChild>
                  <a href={recipe.source_url} target="_blank" rel="noopener noreferrer">
                    Visit Original Source <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Instructions & Visual Steps */}
        <div className="lg:col-span-2 space-y-8">
          {/* Visual Process Guide */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { title: "Safety First", img: "/images/step-safety.jpg" },
              { title: "Trace", img: "/images/step-trace.jpg" },
              { title: "Gel Phase", img: "/images/step-gel-phase.jpg" },
              { title: "Curing", img: "/images/step-curing.jpg" },
            ].map((step, idx) => (
              <div key={idx} className="group relative overflow-hidden rounded-lg aspect-video shadow-sm hover:shadow-md transition-all">
                <img src={step.img} alt={step.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/40 flex items-end p-3">
                  <span className="text-white font-bold text-sm">{step.title}</span>
                </div>
              </div>
            ))}
          </div>

          <Card className="border-none shadow-none bg-transparent">
            <CardContent className="p-0">
              <div className="prose prose-stone dark:prose-invert max-w-none">
                <h3 className="text-2xl font-serif font-bold text-foreground mb-6 flex items-center">
                  <span className="bg-secondary text-secondary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3 font-sans font-bold">
                    M
                  </span>
                  Method & Instructions
                </h3>
                
                <div className="bg-card/50 backdrop-blur-sm rounded-xl p-8 shadow-sm border border-border/50">
                  <div className="space-y-6 text-lg leading-relaxed text-foreground/80 font-light">
                    {recipe.instructions.split('\n').map((paragraph, idx) => {
                      if (!paragraph.trim()) return null;
                      
                      // Check if it's a numbered step
                      const isStep = /^\d+\./.test(paragraph);
                      
                      const image = getInstructionImage(paragraph);
                      return (
                        <div key={idx} className={`relative ${isStep ? 'pl-4' : ''}`}>
                          {isStep ? (
                            <p className="mb-4">
                              <span className="font-bold text-primary mr-2">{paragraph.split('.')[0]}.</span>
                              {paragraph.substring(paragraph.indexOf('.') + 1).trim()}
                            </p>
                          ) : (
                            <p className="mb-4">{paragraph}</p>
                          )}
                          {image && (
                            <div className="my-6 rounded-lg overflow-hidden shadow-md max-w-md">
                              <img src={image} alt="Instruction step" className="w-full h-auto object-cover" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
