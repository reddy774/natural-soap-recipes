import {
  buildArtSpec,
  createPrng,
  type MotifId,
  type MotifPalette,
} from "@/lib/recipeArt";
import type { FlatRecipe } from "@/lib/recipes";
import { cn } from "@/lib/utils";
import { memo, useMemo } from "react";

/**
 * Deterministic inline-SVG recipe art: a soft soap-bar composition decorated
 * with hand-drawn-style motifs derived from the recipe's own ingredients.
 * Same slug always renders identical art. Static shapes only (no filters)
 * so hundreds of cards scroll smoothly.
 */

interface RecipeArtProps {
  recipe: Pick<FlatRecipe, "name" | "slug" | "ingredients" | "category">;
  className?: string;
  variant?: "card" | "hero";
}

interface GlyphPlacement {
  motif: MotifId;
  palette: MotifPalette;
  x: number;
  y: number;
  scale: number;
  rotate: number;
  opacity: number;
}

interface Dot {
  x: number;
  y: number;
  r: number;
  opacity: number;
}

interface Layout {
  width: number;
  height: number;
  bar: { x: number; y: number; w: number; h: number; rx: number; tilt: number };
  glyphs: GlyphPlacement[];
  dots: Dot[];
  washOpacity: number;
}

// --- Motif glyphs -----------------------------------------------------------
// Each glyph is drawn in a local box roughly spanning -40..40 on both axes,
// centered at the origin, in the delicate line-art style of BotanicalAccents.

function Glyph({ motif, palette }: { motif: MotifId; palette: MotifPalette }) {
  const { ink, fill } = palette;
  const stroke = {
    stroke: ink,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    fill: "none",
  };
  const soft = { fill, stroke: ink, strokeWidth: 1 };

  switch (motif) {
    case "lavender":
      return (
        <g>
          <path d="M0 38 C0 20 0 0 0 -26" {...stroke} />
          <path d="M0 30 C-8 28 -13 23 -14 16" {...stroke} />
          <path d="M0 30 C8 28 13 23 14 16" {...stroke} />
          {[-24, -18, -12, -6].map((y, i) => (
            <g key={y}>
              <ellipse cx={i % 2 === 0 ? -4.5 : -5} cy={y} rx={4} ry={2.8} {...soft} transform={`rotate(-24 ${-4.5} ${y})`} />
              <ellipse cx={i % 2 === 0 ? 4.5 : 5} cy={y - 3} rx={4} ry={2.8} {...soft} transform={`rotate(24 ${4.5} ${y - 3})`} />
            </g>
          ))}
          <ellipse cx={0} cy={-31} rx={3.2} ry={4.5} {...soft} />
        </g>
      );
    case "rose":
      return (
        <g>
          <circle cx={0} cy={-6} r={17} {...soft} fillOpacity={0.45} />
          <path d="M0 -6 C6 -10 6 -1 0 1 C-7 3 -9 -8 -1 -13 C10 -19 15 -4 7 4" {...stroke} strokeWidth={1.6} />
          <path d="M-14 -16 C-8 -23 8 -23 14 -16" {...stroke} strokeWidth={1.6} />
          <path d="M0 11 C0 22 0 30 0 36" {...stroke} />
          <path d="M0 22 C-7 21 -12 17 -13 11" {...stroke} strokeWidth={1.6} />
          <path d="M0 28 C7 27 12 23 13 17" {...stroke} strokeWidth={1.6} />
        </g>
      );
    case "chamomile":
      return (
        <g>
          <path d="M0 12 C0 22 0 30 0 36" {...stroke} />
          <path d="M0 26 C-6 25 -10 21 -11 16" {...stroke} strokeWidth={1.6} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <ellipse key={deg} cx={0} cy={-18} rx={4.5} ry={11} {...soft} fillOpacity={0.85} transform={`rotate(${deg} 0 -6)`} />
          ))}
          <circle cx={0} cy={-6} r={6} fill={ink} fillOpacity={0.8} />
        </g>
      );
    case "jasmine":
      return (
        <g>
          {[0, 72, 144, 216, 288].map((deg) => (
            <ellipse key={deg} cx={0} cy={-16} rx={6} ry={10} {...soft} fillOpacity={0.9} transform={`rotate(${deg} 0 -6)`} />
          ))}
          <circle cx={0} cy={-6} r={3.5} fill={ink} fillOpacity={0.65} />
          <path d="M0 6 C-2 18 -6 26 -12 32" {...stroke} />
          <path d="M-12 32 C-16 26 -14 20 -8 18" {...stroke} strokeWidth={1.6} />
          <ellipse cx={14} cy={16} rx={3} ry={5} {...soft} transform="rotate(30 14 16)" />
        </g>
      );
    case "citrus":
      return (
        <g>
          <circle cx={0} cy={2} r={22} {...soft} fillOpacity={0.35} />
          <circle cx={0} cy={2} r={17.5} {...stroke} strokeWidth={1.4} />
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <path key={deg} d="M0 2 L0 -13.5" {...stroke} strokeWidth={1.4} transform={`rotate(${deg} 0 2)`} />
          ))}
          <circle cx={0} cy={2} r={2.2} fill={ink} fillOpacity={0.7} />
          <path d="M14 -18 C20 -26 30 -26 34 -20 C28 -14 19 -14 14 -18 Z" {...soft} fillOpacity={0.7} />
        </g>
      );
    case "coffee":
      return (
        <g>
          <ellipse cx={-8} cy={-4} rx={13} ry={19} {...soft} fillOpacity={0.75} transform="rotate(-22 -8 -4)" />
          <path d="M-16 -19 C-8 -10 -8 2 -16 11" {...stroke} strokeWidth={1.6} transform="rotate(0)" />
          <ellipse cx={14} cy={16} rx={9} ry={13.5} {...soft} fillOpacity={0.75} transform="rotate(28 14 16)" />
          <path d="M9 6 C15 12 16 20 12 27" {...stroke} strokeWidth={1.4} />
          <path d="M-4 -34 C-1 -31 -1 -28 -4 -25" {...stroke} strokeWidth={1.4} />
          <path d="M4 -36 C7 -33 7 -30 4 -27" {...stroke} strokeWidth={1.4} />
        </g>
      );
    case "cocoa":
      return (
        <g>
          <path d="M0 -26 C13 -21 16 -2 9 18 C5 26 -5 26 -9 18 C-16 -2 -13 -21 0 -26 Z" {...soft} fillOpacity={0.7} />
          <path d="M-4 -24 C-9 -12 -9 6 -4 20" {...stroke} strokeWidth={1.4} />
          <path d="M4 -24 C9 -12 9 6 4 20" {...stroke} strokeWidth={1.4} />
          <path d="M0 -26 C0 -31 2 -34 6 -35" {...stroke} />
        </g>
      );
    case "oat":
      return (
        <g>
          <path d="M-4 38 C-2 18 0 -6 4 -32" {...stroke} />
          {[-24, -14, -4, 6].map((y, i) => (
            <g key={y}>
              <ellipse cx={-7} cy={y} rx={3.6} ry={8} {...soft} fillOpacity={0.85} transform={`rotate(-28 -7 ${y})`} />
              <ellipse cx={9} cy={y - 4} rx={3.6} ry={8} {...soft} fillOpacity={0.85} transform={`rotate(26 9 ${y - 4})`} />
              {i === 0 && <ellipse cx={2} cy={-33} rx={3.4} ry={7.5} {...soft} transform="rotate(-4 2 -33)" />}
            </g>
          ))}
        </g>
      );
    case "honey": {
      const hex = "M0 -9 L8 -4.5 L8 4.5 L0 9 L-8 4.5 L-8 -4.5 Z";
      return (
        <g>
          <path d={hex} {...soft} fillOpacity={0.8} transform="translate(-9 -14)" />
          <path d={hex} {...stroke} strokeWidth={1.6} transform="translate(9 -14)" />
          <path d={hex} {...stroke} strokeWidth={1.6} transform="translate(0 1)" />
          <path d="M0 14 C-4 22 -4 28 0 32 C4 28 4 22 0 14 Z" {...soft} fillOpacity={0.9} />
        </g>
      );
    }
    case "coconut":
      return (
        <g>
          <circle cx={0} cy={6} r={19} {...soft} fillOpacity={0.55} />
          <circle cx={0} cy={6} r={13} {...stroke} strokeWidth={1.4} />
          <circle cx={-4} cy={2} r={1.8} fill={ink} fillOpacity={0.7} />
          <circle cx={4} cy={2} r={1.8} fill={ink} fillOpacity={0.7} />
          <circle cx={0} cy={9} r={1.8} fill={ink} fillOpacity={0.7} />
          <path d="M-2 -14 C-14 -24 -26 -26 -34 -22" {...stroke} strokeWidth={1.6} />
          <path d="M0 -15 C-4 -28 -2 -36 4 -40" {...stroke} strokeWidth={1.6} />
          <path d="M2 -14 C12 -24 24 -27 32 -24" {...stroke} strokeWidth={1.6} />
        </g>
      );
    case "charcoal":
      return (
        <g>
          <path d="M-20 8 L-8 -16 L10 -12 L16 8 L2 18 Z" {...soft} fillOpacity={0.75} />
          <path d="M14 -20 L26 -16 L28 -4 L18 -8 Z" {...stroke} strokeWidth={1.6} />
          <path d="M-26 18 L-18 24 L-26 28 Z" {...stroke} strokeWidth={1.4} />
          <path d="M-4 -10 L4 4" {...stroke} strokeWidth={1.2} />
        </g>
      );
    case "clay":
      return (
        <g>
          <ellipse cx={0} cy={14} rx={22} ry={9} {...soft} fillOpacity={0.75} />
          <ellipse cx={-3} cy={0} rx={15} ry={7.5} {...soft} fillOpacity={0.6} />
          <ellipse cx={2} cy={-11} rx={9.5} ry={5.5} {...soft} fillOpacity={0.85} />
          <path d="M-28 28 C-16 24 16 24 28 28" {...stroke} strokeWidth={1.4} />
        </g>
      );
    case "seaSalt":
      return (
        <g>
          <path d="M0 -22 L11 -8 L0 4 L-11 -8 Z" {...soft} fillOpacity={0.7} />
          <path d="M18 4 L26 12 L18 21 L10 12 Z" {...stroke} strokeWidth={1.6} />
          <path d="M-18 8 L-11 16 L-18 24 L-25 16 Z" {...stroke} strokeWidth={1.6} />
          <circle cx={22} cy={-14} r={1.6} fill={ink} fillOpacity={0.6} />
          <circle cx={-24} cy={-6} r={1.6} fill={ink} fillOpacity={0.6} />
          <circle cx={2} cy={28} r={1.6} fill={ink} fillOpacity={0.6} />
        </g>
      );
    case "mint":
      return (
        <g>
          <path d="M0 36 C0 24 0 14 0 6" {...stroke} />
          <path d="M0 10 C-16 8 -24 -4 -22 -20 C-8 -22 0 -12 0 4 Z" {...soft} fillOpacity={0.7} />
          <path d="M0 10 C16 8 24 -4 22 -20 C8 -22 0 -12 0 4 Z" {...soft} fillOpacity={0.5} />
          <path d="M-4 4 C-10 0 -14 -8 -15 -14" {...stroke} strokeWidth={1.2} />
          <path d="M4 4 C10 0 14 -8 15 -14" {...stroke} strokeWidth={1.2} />
        </g>
      );
    case "eucalyptus":
      return (
        <g>
          <path d="M-6 38 C-2 16 2 -8 10 -34" {...stroke} />
          {[
            { x: -13, y: 24 },
            { x: 8, y: 14 },
            { x: -9, y: 4 },
            { x: 12, y: -6 },
            { x: -4, y: -16 },
            { x: 16, y: -24 },
            { x: 2, y: -32 },
          ].map((p) => (
            <circle key={`${p.x}-${p.y}`} cx={p.x} cy={p.y} r={6} {...soft} fillOpacity={0.7} />
          ))}
        </g>
      );
    case "teaTree":
      return (
        <g>
          <path d="M0 38 C1 16 2 -8 4 -34" {...stroke} />
          {[30, 22, 14, 6, -2, -10, -18, -26].map((y, i) => (
            <g key={y}>
              <path d={`M${1 + i * 0.3} ${y} L${-11 + i * 0.3} ${y - 7}`} {...stroke} strokeWidth={1.3} />
              <path d={`M${1 + i * 0.3} ${y - 3} L${13 + i * 0.3} ${y - 9}`} {...stroke} strokeWidth={1.3} />
            </g>
          ))}
        </g>
      );
    case "aloe":
      return (
        <g>
          <path d="M0 30 C-3 8 -3 -14 0 -34 C3 -14 3 8 0 30 Z" {...soft} fillOpacity={0.75} />
          <path d="M-4 30 C-14 16 -19 -2 -17 -20 C-8 -8 -4 8 -3 26 Z" {...soft} fillOpacity={0.6} />
          <path d="M4 30 C14 16 19 -2 17 -20 C8 -8 4 8 3 26 Z" {...soft} fillOpacity={0.6} />
          <path d="M-8 30 C-20 22 -27 10 -28 -2 C-19 4 -12 16 -8 28 Z" {...soft} fillOpacity={0.45} />
          <path d="M8 30 C20 22 27 10 28 -2 C19 4 12 16 8 28 Z" {...soft} fillOpacity={0.45} />
        </g>
      );
    case "vanilla":
      return (
        <g>
          {[0, 72, 144, 216, 288].map((deg) => (
            <ellipse key={deg} cx={-10} cy={-18} rx={5.5} ry={9} {...soft} fillOpacity={0.85} transform={`rotate(${deg} -10 -9)`} />
          ))}
          <circle cx={-10} cy={-9} r={3.2} fill={ink} fillOpacity={0.6} />
          <path d="M14 -30 C22 -12 22 10 12 32" {...stroke} />
          <path d="M18 -30 C26 -12 26 10 16 32" {...stroke} strokeWidth={1.4} />
        </g>
      );
    case "spice":
      return (
        <g>
          <rect x={-26} y={-7} width={50} height={11} rx={5} {...soft} fillOpacity={0.7} transform="rotate(-18 0 0)" />
          <path d="M-24 -14 C-27 -10 -27 -6 -24 -2" {...stroke} strokeWidth={1.4} transform="rotate(-18 0 0)" />
          <path d="M22 -1 C19 3 19 7 22 11" {...stroke} strokeWidth={1.4} transform="rotate(-18 0 0)" />
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <path key={deg} d="M14 22 L14 14.5" {...stroke} strokeWidth={1.4} transform={`rotate(${deg} 14 22)`} />
          ))}
          <circle cx={14} cy={22} r={2} fill={ink} fillOpacity={0.7} />
        </g>
      );
    case "berry":
      return (
        <g>
          <circle cx={-8} cy={8} r={9} {...soft} fillOpacity={0.8} />
          <circle cx={8} cy={12} r={7.5} {...soft} fillOpacity={0.65} />
          <circle cx={3} cy={-4} r={8} {...stroke} strokeWidth={1.6} />
          <path d="M-2 -12 C-2 -20 2 -26 8 -30" {...stroke} />
          <path d="M8 -30 C2 -32 -4 -30 -7 -25 C-2 -22 4 -24 8 -30 Z" {...soft} fillOpacity={0.7} />
        </g>
      );
    case "wood":
      return (
        <g>
          <circle cx={0} cy={0} r={21} {...soft} fillOpacity={0.4} />
          <path d="M-14 -6 C-12 -14 -4 -18 4 -16" {...stroke} strokeWidth={1.4} />
          <path d="M10 12 C14 6 15 -2 12 -9" {...stroke} strokeWidth={1.4} />
          <circle cx={0} cy={0} r={8} {...stroke} strokeWidth={1.4} />
          <circle cx={0} cy={0} r={2} fill={ink} fillOpacity={0.7} />
          <path d="M-24 16 L-19 21" {...stroke} strokeWidth={1.4} />
        </g>
      );
    case "olive":
      return (
        <g>
          <path d="M-32 22 C-10 6 12 -6 34 -14" {...stroke} />
          <ellipse cx={-8} cy={6} rx={5} ry={7} {...soft} fillOpacity={0.85} transform="rotate(-14 -8 6)" />
          <ellipse cx={4} cy={0} rx={5} ry={7} {...soft} fillOpacity={0.7} transform="rotate(-14 4 0)" />
          <path d="M-20 12 C-24 4 -22 -3 -15 -6 C-12 2 -14 8 -20 12 Z" {...soft} fillOpacity={0.5} />
          <path d="M16 -6 C13 -14 15 -21 22 -24 C25 -16 22 -10 16 -6 Z" {...soft} fillOpacity={0.5} />
        </g>
      );
    case "milk":
      return (
        <g>
          <path d="M0 -30 C-9 -14 -14 -4 -14 4 C-14 13 -8 19 0 19 C8 19 14 13 14 4 C14 -4 9 -14 0 -30 Z" {...soft} fillOpacity={0.8} />
          <path d="M-6 4 C-6 9 -4 12 0 13" {...stroke} strokeWidth={1.4} />
          <path d="M-26 30 C-16 26 -8 26 0 30 C8 34 16 34 26 30" {...stroke} strokeWidth={1.6} />
        </g>
      );
    case "butter":
      return (
        <g>
          <path d="M-20 22 C-26 12 -22 2 -12 0 C-16 -10 -8 -18 2 -16 C4 -26 16 -28 22 -20 C30 -14 28 -2 20 2 C26 10 22 20 14 22 Z" {...soft} fillOpacity={0.75} />
          <path d="M-8 6 C-2 0 8 -2 14 2" {...stroke} strokeWidth={1.4} />
          <path d="M-24 30 C-8 26 8 26 24 30" {...stroke} strokeWidth={1.4} />
        </g>
      );
    case "seed":
      return (
        <g>
          {[
            { x: -16, y: -14, r: -30, f: 0.8 },
            { x: 6, y: -20, r: 20, f: 0.55 },
            { x: 20, y: -2, r: -12, f: 0.8 },
            { x: -4, y: 0, r: 40, f: 0.65 },
            { x: -22, y: 12, r: 10, f: 0.55 },
            { x: 10, y: 16, r: -35, f: 0.8 },
            { x: -2, y: 28, r: 15, f: 0.6 },
          ].map((p) => (
            <ellipse key={`${p.x}-${p.y}`} cx={p.x} cy={p.y} rx={4} ry={6.5} {...soft} fillOpacity={p.f} transform={`rotate(${p.r} ${p.x} ${p.y})`} />
          ))}
        </g>
      );
    case "herb":
      return (
        <g>
          <path d="M0 38 C0 18 0 -6 0 -32" {...stroke} />
          {[28, 18, 8, -2, -12, -22].map((y) => (
            <g key={y}>
              <path d={`M0 ${y} C-7 ${y - 2} -12 ${y - 6} -13 ${y - 12}`} {...stroke} strokeWidth={1.4} />
              <path d={`M0 ${y - 4} C7 ${y - 6} 12 ${y - 10} 13 ${y - 16}`} {...stroke} strokeWidth={1.4} />
            </g>
          ))}
          <ellipse cx={0} cy={-34} rx={2.6} ry={4} {...soft} />
        </g>
      );
    case "flower":
      return (
        <g>
          {[0, 72, 144, 216, 288].map((deg) => (
            <ellipse key={deg} cx={0} cy={-19} rx={7} ry={12} {...soft} fillOpacity={0.8} transform={`rotate(${deg} 0 -8)`} />
          ))}
          <circle cx={0} cy={-8} r={4.5} fill={ink} fillOpacity={0.7} />
          <path d="M0 8 C0 20 0 28 0 36" {...stroke} />
          <path d="M0 24 C-7 23 -12 19 -13 13" {...stroke} strokeWidth={1.6} />
        </g>
      );
    case "sprig":
      return (
        <g>
          <path d="M0 38 C0 20 0 0 0 -32" {...stroke} />
          <path d="M0 24 C-10 22 -18 15 -20 4" {...stroke} strokeWidth={1.6} />
          <path d="M0 24 C10 22 18 15 20 4" {...stroke} strokeWidth={1.6} />
          <path d="M0 8 C-8 6 -14 1 -16 -7" {...stroke} strokeWidth={1.6} />
          <path d="M0 8 C8 6 14 1 16 -7" {...stroke} strokeWidth={1.6} />
          <path d="M0 -8 C-6 -10 -11 -14 -12 -21" {...stroke} strokeWidth={1.6} />
          <path d="M0 -8 C6 -10 11 -14 12 -21" {...stroke} strokeWidth={1.6} />
          <path d="M0 -32 C-2.5 -29 -2.5 -25.5 0 -23 C2.5 -25.5 2.5 -29 0 -32 Z" {...soft} />
        </g>
      );
  }
}

// --- Layout -----------------------------------------------------------------

function jitter(rng: () => number, amount: number): number {
  return (rng() - 0.5) * 2 * amount;
}

function buildLayout(
  spec: ReturnType<typeof buildArtSpec>,
  variant: "card" | "hero"
): Layout {
  const rng = createPrng(spec.seed);
  const { primary, secondary, palette, secondaryPalette } = spec;
  const second = secondary ?? primary;
  const glyphs: GlyphPlacement[] = [];
  const dots: Dot[] = [];

  if (variant === "card") {
    const width = 400;
    const height = 160;
    const bar = {
      x: 70 + jitter(rng, 6),
      y: 28 + jitter(rng, 3),
      w: 260,
      h: 104,
      rx: 26,
      tilt: jitter(rng, 2.2),
    };
    glyphs.push({
      motif: primary,
      palette,
      x: bar.x + 78 + jitter(rng, 10),
      y: bar.y + 52 + jitter(rng, 5),
      scale: 0.95 + rng() * 0.18,
      rotate: jitter(rng, 9),
      opacity: 1,
    });
    glyphs.push({
      motif: second,
      palette: secondaryPalette,
      x: bar.x + 190 + jitter(rng, 12),
      y: bar.y + 54 + jitter(rng, 8),
      scale: 0.55 + rng() * 0.14,
      rotate: jitter(rng, 14),
      opacity: 0.85,
    });
    const corners = [
      { x: 32, y: 44 },
      { x: 368, y: 116 },
      { x: 36, y: 126 },
      { x: 366, y: 40 },
    ];
    const miniCount = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < miniCount; i += 1) {
      const corner = corners[i % corners.length];
      glyphs.push({
        motif: i % 2 === 0 ? primary : second,
        palette: i % 2 === 0 ? palette : secondaryPalette,
        x: corner.x + jitter(rng, 8),
        y: corner.y + jitter(rng, 8),
        scale: 0.3 + rng() * 0.14,
        rotate: jitter(rng, 24),
        opacity: 0.45,
      });
    }
    const dotCount = 5 + Math.floor(rng() * 4);
    for (let i = 0; i < dotCount; i += 1) {
      dots.push({
        x: 14 + rng() * (width - 28),
        y: 12 + rng() * (height - 24),
        r: 1 + rng() * 1.6,
        opacity: 0.2 + rng() * 0.25,
      });
    }
    return { width, height, bar, glyphs, dots, washOpacity: 0.14 + rng() * 0.08 };
  }

  const width = 800;
  const height = 260;
  const bar = {
    x: 64 + jitter(rng, 8),
    y: 42 + jitter(rng, 5),
    w: 400,
    h: 176,
    rx: 34,
    tilt: jitter(rng, 1.6),
  };
  glyphs.push({
    motif: primary,
    palette,
    x: bar.x + 122 + jitter(rng, 14),
    y: bar.y + 88 + jitter(rng, 8),
    scale: 1.55 + rng() * 0.3,
    rotate: jitter(rng, 7),
    opacity: 1,
  });
  glyphs.push({
    motif: second,
    palette: secondaryPalette,
    x: bar.x + 296 + jitter(rng, 16),
    y: bar.y + 92 + jitter(rng, 12),
    scale: 0.85 + rng() * 0.2,
    rotate: jitter(rng, 12),
    opacity: 0.9,
  });
  const fieldSpots = [
    { x: 545, y: 66 },
    { x: 690, y: 108 },
    { x: 580, y: 196 },
    { x: 720, y: 210 },
    { x: 640, y: 44 },
  ];
  const fieldCount = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < fieldCount; i += 1) {
    const spot = fieldSpots[i % fieldSpots.length];
    glyphs.push({
      motif: i % 2 === 0 ? primary : second,
      palette: i % 2 === 0 ? palette : secondaryPalette,
      x: spot.x + jitter(rng, 14),
      y: spot.y + jitter(rng, 12),
      scale: 0.4 + rng() * 0.24,
      rotate: jitter(rng, 26),
      opacity: 0.5,
    });
  }
  const dotCount = 8 + Math.floor(rng() * 5);
  for (let i = 0; i < dotCount; i += 1) {
    dots.push({
      x: 18 + rng() * (width - 36),
      y: 16 + rng() * (height - 32),
      r: 1.2 + rng() * 2,
      opacity: 0.18 + rng() * 0.24,
    });
  }
  return { width, height, bar, glyphs, dots, washOpacity: 0.16 + rng() * 0.08 };
}

// --- Component --------------------------------------------------------------

function RecipeArtInner({ recipe, className, variant = "card" }: RecipeArtProps) {
  const { spec, layout } = useMemo(() => {
    const built = buildArtSpec(recipe);
    return { spec: built, layout: buildLayout(built, variant) };
    // Art is fully determined by the slug + variant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe.slug, variant]);

  const { bar } = layout;
  const barCx = bar.x + bar.w / 2;
  const barCy = bar.y + bar.h / 2;

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="img"
      aria-label={recipe.name}
      className={cn("block h-auto w-full", className)}
    >
      {/* background wash in the motif tint over the site's muted tone */}
      <rect width={layout.width} height={layout.height} fill="var(--muted)" fillOpacity={0.5} />
      <rect
        width={layout.width}
        height={layout.height}
        fill={spec.palette.fill}
        fillOpacity={layout.washOpacity}
      />

      {/* ambient speckles */}
      {layout.dots.map((dot, index) => (
        <circle
          key={index}
          cx={dot.x}
          cy={dot.y}
          r={dot.r}
          fill={spec.palette.ink}
          fillOpacity={dot.opacity}
        />
      ))}

      {/* soap bar with apothecary label frame */}
      <g transform={`rotate(${bar.tilt} ${barCx} ${barCy})`}>
        <rect
          x={bar.x + 5}
          y={bar.y + 7}
          width={bar.w}
          height={bar.h}
          rx={bar.rx}
          fill={spec.palette.ink}
          fillOpacity={0.12}
        />
        <rect
          x={bar.x}
          y={bar.y}
          width={bar.w}
          height={bar.h}
          rx={bar.rx}
          fill="var(--card)"
          stroke={spec.palette.ink}
          strokeOpacity={0.35}
          strokeWidth={1.5}
        />
        <rect
          x={bar.x + 10}
          y={bar.y + 10}
          width={bar.w - 20}
          height={bar.h - 20}
          rx={bar.rx - 8}
          fill="none"
          stroke={spec.palette.ink}
          strokeOpacity={0.22}
          strokeWidth={1}
          strokeDasharray="1 5"
          strokeLinecap="round"
        />
      </g>

      {/* motif glyphs */}
      {layout.glyphs.map((glyph, index) => (
        <g
          key={index}
          opacity={glyph.opacity}
          transform={`translate(${glyph.x} ${glyph.y}) rotate(${glyph.rotate}) scale(${glyph.scale})`}
        >
          <Glyph motif={glyph.motif} palette={glyph.palette} />
        </g>
      ))}
    </svg>
  );
}

export const RecipeArt = memo(
  RecipeArtInner,
  (prev, next) =>
    prev.recipe.slug === next.recipe.slug &&
    prev.variant === next.variant &&
    prev.className === next.className
);
