import { RecipeDetail } from "@/components/RecipeDetail";
import { SiteFooter } from "@/components/SiteFooter";
import NotFound from "@/pages/NotFound";
import { getRecipeBySlug } from "@/lib/recipes";
import { isValidTabId } from "@/lib/categories";
import { useEffect } from "react";
import { useParams, useSearch } from "wouter";

export default function RecipePage() {
  const params = useParams<{ slug: string }>();
  const searchString = useSearch();

  const recipe = params.slug ? getRecipeBySlug(params.slug) : undefined;

  useEffect(() => {
    window.scrollTo(0, 0);
    if (recipe) {
      document.title = `${recipe.name} — Natural Soap Recipes`;
    }
  }, [recipe]);

  if (!recipe) {
    return <NotFound />;
  }

  const tabParam = new URLSearchParams(searchString).get("tab");
  const backHref =
    isValidTabId(tabParam) && tabParam !== "all" ? `/?tab=${tabParam}` : "/";

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans selection:bg-primary/20">
      <main className="container relative flex-grow py-10 md:py-14">
        {/* Background Texture */}
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-[0.04] mix-blend-multiply"
          style={{
            backgroundImage: "url(/images/texture-paper.jpg)",
            backgroundRepeat: "repeat",
          }}
        />
        <div className="relative z-10">
          <RecipeDetail recipe={recipe} backHref={backHref} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
