import { BotanicalSprig } from "@/components/BotanicalAccents";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Home } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
      <Card className="w-full max-w-lg rounded-2xl border-border/60 bg-card/80 shadow-lg backdrop-blur-sm">
        <CardContent className="pb-10 pt-10 text-center">
          <BotanicalSprig className="mx-auto mb-6 h-14 w-14 text-primary/40" />

          <h1 className="mb-2 font-serif text-5xl font-bold text-foreground">404</h1>

          <h2 className="mb-4 font-serif text-xl italic text-muted-foreground">
            This page has drifted away like soap bubbles
          </h2>

          <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
            The recipe or page you are looking for doesn't exist.
            <br />
            It may have been moved or renamed.
          </p>

          <Button asChild className="rounded-full px-8 font-serif">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Back to the Collection
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
