import { useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";
import type { MouseEvent } from "react";

interface FavoriteButtonProps {
  slug: string;
  className?: string;
  iconClassName?: string;
}

/**
 * Heart toggle. Safe to place inside links/clickable cards — it stops the
 * event so toggling never navigates.
 */
export function FavoriteButton({ slug, className, iconClassName }: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(slug);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    toggleFavorite(slug);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      aria-label={active ? "Remove from favorites" : "Add to favorites"}
      title={active ? "Remove from favorites" : "Add to favorites"}
      className={cn(
        "rounded-full p-2 transition-colors duration-200",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active
          ? "text-clay hover:text-clay/80"
          : "text-muted-foreground/60 hover:text-clay",
        className
      )}
    >
      <Heart
        className={cn(
          "h-5 w-5 transition-transform duration-200",
          active && "fill-current scale-110",
          iconClassName
        )}
      />
    </button>
  );
}
