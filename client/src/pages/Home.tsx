import { RecipeBrowser } from "@/components/RecipeBrowser";
import { RecipeSearchBox } from "@/components/RecipeSearchBox";
import { SiteFooter } from "@/components/SiteFooter";
import { Badge } from "@/components/ui/badge";
import { getTabHero, isValidTabId } from "@/lib/categories";
import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";

export default function Home() {
  const searchString = useSearch();
  const [, navigate] = useLocation();

  const tabParam = new URLSearchParams(searchString).get("tab");
  const activeTab = isValidTabId(tabParam) ? tabParam : "all";
  const hero = getTabHero(activeTab);

  const handleTabChange = (tabId: string) => {
    // Keep the selected tab in the URL so back-navigation restores it
    navigate(tabId === "all" ? "/" : `/?tab=${tabId}`, { replace: true });
  };

  useEffect(() => {
    document.title = "Natural Soap Recipes Collection";
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans selection:bg-primary/20">
      {/* Dynamic Hero Section */}
      <div className="relative h-[400px] w-full overflow-hidden transition-all duration-700 md:h-[500px]">
        <div className="absolute inset-0 z-10 bg-black/35" />
        <img
          key={activeTab} // Force re-render on tab change for animation
          src={hero.image}
          alt={hero.title}
          className="h-full w-full scale-105 object-cover animate-in fade-in duration-700"
        />
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-4 text-center">
          <Badge
            variant="outline"
            className="mb-4 border-white/50 bg-white/10 px-4 py-1 text-xs uppercase tracking-widest text-white backdrop-blur-sm"
          >
            Handcrafted Collection
          </Badge>
          <h1 className="mb-4 font-serif text-4xl font-bold tracking-tight text-white drop-shadow-lg animate-in slide-in-from-bottom-4 duration-700 delay-100 md:text-6xl">
            {hero.title}
          </h1>
          <p className="max-w-2xl text-lg font-light leading-relaxed text-white/90 drop-shadow-md animate-in slide-in-from-bottom-4 duration-700 delay-200 md:text-xl">
            {hero.description}
          </p>

          {/* Quick recipe search */}
          <RecipeSearchBox className="mt-8 max-w-md animate-in zoom-in-95 duration-700 delay-300" />
        </div>
      </div>

      <main className="container relative py-12 md:py-20">
        {/* Background Texture */}
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-[0.04] mix-blend-multiply"
          style={{
            backgroundImage: "url(/images/texture-paper.jpg)",
            backgroundRepeat: "repeat",
          }}
        />

        <div className="relative z-10">
          <RecipeBrowser activeTab={activeTab} onTabChange={handleTabChange} />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
