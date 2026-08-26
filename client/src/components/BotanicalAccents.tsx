import { cn } from "@/lib/utils";

/**
 * Hand-drawn-style botanical line art. All strokes use currentColor so the
 * accents inherit whatever muted tone the parent applies.
 */

interface AccentProps {
  className?: string;
}

/** A small upright sprig with paired leaves — the site's signature mark */
export function BotanicalSprig({ className }: AccentProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      {/* stem */}
      <path d="M24 44 C24 34 24 22 24 6" />
      {/* leaf pairs, drawn as gentle arcs from the stem */}
      <path d="M24 36 C18 35 13 31 12 25" />
      <path d="M24 36 C30 35 35 31 36 25" />
      <path d="M24 27 C19 26 15 23 14 18" />
      <path d="M24 27 C29 26 33 23 34 18" />
      <path d="M24 18 C20 17 17 15 16 11" />
      <path d="M24 18 C28 17 31 15 32 11" />
      {/* bud */}
      <path d="M24 6 C22.5 8 22.5 10 24 11.5 C25.5 10 25.5 8 24 6 Z" />
    </svg>
  );
}

/** A long arching branch with alternating leaves, for wide flourishes */
export function BotanicalBranch({ className }: AccentProps) {
  return (
    <svg
      viewBox="0 0 160 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      {/* main arc */}
      <path d="M4 26 C50 10 110 10 156 24" />
      {/* alternating leaves along the arc */}
      <path d="M30 19 C27 13 28 8 33 5" />
      <path d="M56 14 C55 8 58 4 63 3" />
      <path d="M84 12 C85 6 89 3 94 4" />
      <path d="M112 13 C114 8 118 6 123 7" />
      <path d="M44 16 C46 21 45 25 40 27" />
      <path d="M72 12.5 C75 17 75 21 71 24" />
      <path d="M100 12 C103 16 104 20 101 23" />
      <path d="M130 16 C133 19 134 23 132 26" />
    </svg>
  );
}

/** Horizontal section divider: line — sprig — line */
export function SprigDivider({ className }: AccentProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-4 text-primary/40",
        className
      )}
      aria-hidden="true"
    >
      <span className="h-px w-16 bg-current opacity-60 sm:w-24" />
      <BotanicalSprig className="h-6 w-6" />
      <span className="h-px w-16 bg-current opacity-60 sm:w-24" />
    </div>
  );
}
