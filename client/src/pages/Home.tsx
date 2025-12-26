import { RecipeCard } from "@/components/RecipeCard";
import { RecipeDetail } from "@/components/RecipeDetail";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import recipesData from "@/data/recipes.json";
import { ArrowRight, Droplets, Flame, Snowflake, Sun, Sparkles, Beaker, Heart, Scissors, Calculator } from "lucide-react";
import SoapCalcReplica from "@/components/SoapCalcReplica";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

interface Recipe {
  name: string;
  type: string;
  ingredients: string[] | string;
  instructions: string;
  source_url: string;
  benefits?: string;
  structured_ingredients?: { amount: number; unit: string; name: string }[];
}

// Combine recipes into a single list with type property
const allRecipes: Recipe[] = [
  ...(recipesData["Hot Process"] || []),
  ...(recipesData["Cold Process"] || []),
  ...(recipesData["Lotions"] || []),
  ...(recipesData["Scrubs"] || []),
  ...(recipesData["Bath Bombs"] || []),
  ...(recipesData["Remedies"] || []),
  ...(recipesData["Hair Care"] || [])
];

export default function Home() {
  const [selectedRecipe, setSelectedRecipe] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  
  // Filter recipes based on active tab/filter
  const filteredRecipes = allRecipes.filter(recipe => {
    if (activeTab === "all") return true;
    if (activeTab === "hot") return recipe.type === "Hot Process";
    if (activeTab === "cold") return recipe.type === "Cold Process";
    if (activeTab === "lotions") return recipe.type === "Lotion";
    if (activeTab === "scrubs") return recipe.type === "Scrub";
    if (activeTab === "bath") return recipe.type === "Bath Bomb";
    if (activeTab === "remedies") return recipe.type === "Remedies";
    if (activeTab === "hair") return recipe.type === "Hair Care";
    return true;
  });

  // Get header image based on active tab
  const getHeaderImage = () => {
    switch(activeTab) {
      case "hot": return "/images/banner-hot-process.jpg";
      case "cold": return "/images/banner-cold-process.jpg";
      case "lotions": return "/images/header-lotions.jpg";
      case "scrubs": return "/images/header-scrubs.jpg";
      case "bath": return "/images/header-bath-bombs.jpg";
      case "remedies": return "/images/header-remedies.jpg";
      case "hair": return "/images/header-hair-care.jpg";
      default: return "/images/hero-soap-making.jpg";
    }
  };

  const getHeaderTitle = () => {
    switch(activeTab) {
      case "hot": return "Hot Process Soaps";
      case "cold": return "Cold Process Soaps";
      case "lotions": return "Natural Lotions & Creams";
      case "scrubs": return "Exfoliating Scrubs";
      case "bath": return "Bath Bombs & Fizzies";
      case "remedies": return "Herbal Remedies";
      case "hair": return "Natural Hair Care";
      default: return "Natural Soap Recipes";
    }
  };

  const getHeaderDescription = () => {
    switch(activeTab) {
      case "hot": return "Rustic, textured soaps ready to use sooner. The hot process method speeds up saponification for a faster cure.";
      case "cold": return "Smooth, creamy bars with endless design possibilities. The traditional method for creating long-lasting natural soaps.";
      case "lotions": return "Luxurious homemade moisturizers using shea butter, cocoa butter, and nourishing plant oils.";
      case "scrubs": return "Invigorating sugar and salt scrubs to exfoliate and soften skin, infused with essential oils.";
      case "bath": return "Fun and fizzy bath treats that add color, scent, and skin-loving oils to your soak.";
      case "remedies": return "Healing salves, balms, and ointments made with infused herbal oils for natural wellness.";
      case "hair": return "Gentle shampoo bars and conditioning oils free from harsh sulfates and synthetic chemicals.";
      default: return "A curated library of handcrafted recipes using only natural ingredients, oils, and botanicals.";
    }
  };

  const currentRecipe = allRecipes.find(r => r.name === selectedRecipe);

  // Handle recipe selection from dropdown
  const handleRecipeSelect = (value: string) => {
    if (value && value !== "none") {
      setSelectedRecipe(value);
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20">
      {/* Dynamic Hero Section */}
      <div className="relative h-[400px] md:h-[500px] w-full overflow-hidden transition-all duration-700">
        <div className="absolute inset-0 bg-black/30 z-10" />
        <img 
          key={activeTab} // Force re-render on tab change for animation
          src={getHeaderImage()} 
          alt={getHeaderTitle()} 
          className="w-full h-full object-cover animate-in fade-in duration-700 scale-105"
        />
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center px-4">
          <Badge variant="outline" className="mb-4 text-white border-white/50 bg-white/10 backdrop-blur-sm px-4 py-1 tracking-widest uppercase text-xs">
            Handcrafted Collection
          </Badge>
          <h1 className="text-4xl md:text-6xl font-serif font-bold text-white mb-4 drop-shadow-lg tracking-tight animate-in slide-in-from-bottom-4 duration-700 delay-100">
            {getHeaderTitle()}
          </h1>
          <p className="text-lg md:text-xl text-white/90 max-w-2xl font-light leading-relaxed drop-shadow-md animate-in slide-in-from-bottom-4 duration-700 delay-200">
            {getHeaderDescription()}
          </p>
          
          {/* Quick Jump Search */}
          <div className="mt-8 w-full max-w-md relative group animate-in zoom-in-95 duration-700 delay-300">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-secondary/50 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            <Select onValueChange={handleRecipeSelect}>
              <SelectTrigger className="w-full h-12 bg-white/90 backdrop-blur-md border-white/20 text-foreground shadow-xl rounded-lg relative">
                <SelectValue placeholder="Jump directly to a recipe..." />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {allRecipes.sort((a, b) => a.name.localeCompare(b.name)).map((recipe, idx) => (
                  <SelectItem key={idx} value={recipe.name} className="cursor-pointer">
                    {recipe.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <main className="container py-12 md:py-20 relative">
        {/* Background Texture */}
        <div 
          className="absolute inset-0 opacity-5 pointer-events-none z-0 mix-blend-multiply"
          style={{ backgroundImage: 'url(/images/texture-paper.jpg)', backgroundRepeat: 'repeat' }}
        />

        <div className="relative z-10">
          {selectedRecipe && currentRecipe ? (
            <RecipeDetail 
              recipe={currentRecipe} 
              onBack={() => setSelectedRecipe(null)} 
            />
          ) : (
            <div className="space-y-12">
              {/* Category Tabs */}
              <div className="flex flex-col items-center space-y-6">
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-serif font-bold text-foreground">Browse Collection</h2>
                  <p className="text-muted-foreground font-light">Choose your preferred soap making method</p>
                </div>
                
                <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full max-w-4xl">
                  <TabsList className="flex flex-wrap justify-center gap-2 h-auto p-2 bg-muted/30 backdrop-blur-sm rounded-xl mb-8 w-full">
                    <TabsTrigger value="all" className="flex-1 min-w-[100px] data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm py-3 rounded-lg transition-all duration-300 font-serif">All Recipes</TabsTrigger>
                    <TabsTrigger value="hot" className="flex-1 min-w-[100px] data-[state=active]:bg-background data-[state=active]:text-orange-600 data-[state=active]:shadow-sm py-3 rounded-lg transition-all duration-300 font-serif">Hot Process</TabsTrigger>
                    <TabsTrigger value="cold" className="flex-1 min-w-[100px] data-[state=active]:bg-background data-[state=active]:text-blue-600 data-[state=active]:shadow-sm py-3 rounded-lg transition-all duration-300 font-serif">Cold Process</TabsTrigger>
                    <TabsTrigger value="lotions" className="flex-1 min-w-[100px] data-[state=active]:bg-background data-[state=active]:text-pink-600 data-[state=active]:shadow-sm py-3 rounded-lg transition-all duration-300 font-serif">Lotions</TabsTrigger>
                    <TabsTrigger value="scrubs" className="flex-1 min-w-[100px] data-[state=active]:bg-background data-[state=active]:text-green-600 data-[state=active]:shadow-sm py-3 rounded-lg transition-all duration-300 font-serif">Scrubs</TabsTrigger>
                    <TabsTrigger value="bath" className="flex-1 min-w-[100px] data-[state=active]:bg-background data-[state=active]:text-purple-600 data-[state=active]:shadow-sm py-3 rounded-lg transition-all duration-300 font-serif">Bath Bombs</TabsTrigger>
                    <TabsTrigger value="remedies" className="flex-1 min-w-[100px] data-[state=active]:bg-background data-[state=active]:text-amber-600 data-[state=active]:shadow-sm py-3 rounded-lg transition-all duration-300 font-serif">Remedies</TabsTrigger>
                    <TabsTrigger value="hair" className="flex-1 min-w-[100px] data-[state=active]:bg-background data-[state=active]:text-teal-600 data-[state=active]:shadow-sm py-3 rounded-lg transition-all duration-300 font-serif">Hair Care</TabsTrigger>
                    <TabsTrigger value="calculator" className="flex-1 min-w-[100px] data-[state=active]:bg-orange-500 data-[state=active]:text-white py-3 rounded-lg transition-all duration-300 font-serif font-bold">Lye Calculator</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Calculator or Recipe Grid */}
              {activeTab === "calculator" ? (
                <div className="max-w-7xl mx-auto">
                  <SoapCalcReplica />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                  {filteredRecipes.map((recipe, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => setSelectedRecipe(recipe.name)}
                      className="cursor-pointer h-full"
                    >
                      <RecipeCard recipe={recipe} />
                    </div>
                  ))}
                </div>
              )}

              {filteredRecipes.length === 0 && (
                <div className="text-center py-20 bg-muted/30 rounded-2xl border border-dashed border-muted-foreground/20">
                  <p className="text-muted-foreground font-serif italic text-lg">No recipes found in this category.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-muted/30 border-t border-border py-12 mt-auto">
        <div className="container text-center space-y-4">
          <div className="flex justify-center items-center gap-2 mb-4">
            <img src="/images/icon-natural.jpg" alt="Natural Icon" className="w-8 h-8 rounded-full mix-blend-multiply" />
            <span className="font-serif font-bold text-xl text-primary">Natural Soap Recipes</span>
          </div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            A collection of natural soap making recipes curated from around the web. 
            Always follow safety guidelines when working with lye.
          </p>
          <div className="pt-4 text-xs text-muted-foreground/60">
            &copy; {new Date().getFullYear()} Natural Soap Recipes Collection
          </div>
        </div>
      </footer>
    </div>
  );
}
