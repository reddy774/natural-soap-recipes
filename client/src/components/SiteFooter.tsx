import { BotanicalBranch } from "@/components/BotanicalAccents";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-muted/30 py-12">
      <div className="container space-y-4 text-center">
        <BotanicalBranch className="mx-auto h-8 w-40 text-primary/30" />
        <div className="flex items-center justify-center gap-2">
          <img
            src="/images/icon-natural.jpg"
            alt=""
            aria-hidden="true"
            className="h-8 w-8 rounded-full mix-blend-multiply"
          />
          <span className="font-serif text-xl font-bold text-primary">
            Natural Soap Recipes
          </span>
        </div>
        <p className="font-hand text-xl text-muted-foreground">
          stirred slowly, cured patiently
        </p>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          A collection of natural soap making recipes curated from around the web.
          Always follow safety guidelines when working with lye.
        </p>
        <div className="pt-4 text-xs text-muted-foreground/60">
          &copy; {new Date().getFullYear()} Natural Soap Recipes Collection
        </div>
      </div>
    </footer>
  );
}
