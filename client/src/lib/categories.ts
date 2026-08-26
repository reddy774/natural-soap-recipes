import { CATEGORIES, slugifyName } from "@/lib/recipes";

/** Visual + copy treatment for one category (or virtual tab) */
export interface CategoryStyle {
  title: string;
  description: string;
  image: string;
  /** Accent text color, e.g. active tab + badge text */
  text: string;
  /** Card top bar background */
  bar: string;
  /** Badge outline treatment */
  badge: string;
  /** Active-state classes for the tab trigger */
  activeTab: string;
}

const DEFAULT_STYLE: CategoryStyle = {
  title: "Natural Soap Recipes",
  description:
    "A curated library of handcrafted recipes using only natural ingredients, oils, and botanicals.",
  image: "/images/hero-soap-making.jpg",
  text: "text-primary",
  bar: "bg-primary/70",
  badge: "text-primary border-primary/25 bg-primary/5",
  activeTab: "data-[state=active]:text-primary",
};

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  "Hot Process": {
    title: "Hot Process Soaps",
    description:
      "Rustic, textured soaps ready to use sooner. The hot process method speeds up saponification for a faster cure.",
    image: "/images/banner-hot-process.jpg",
    text: "text-calendula",
    bar: "bg-calendula/70",
    badge: "text-calendula border-calendula/30 bg-calendula/10",
    activeTab: "data-[state=active]:text-calendula",
  },
  "Cold Process": {
    title: "Cold Process Soaps",
    description:
      "Smooth, creamy bars with endless design possibilities. The traditional method for creating long-lasting natural soaps.",
    image: "/images/banner-cold-process.jpg",
    text: "text-sage",
    bar: "bg-sage/70",
    badge: "text-sage border-sage/30 bg-sage/10",
    activeTab: "data-[state=active]:text-sage",
  },
  Lotions: {
    title: "Natural Lotions & Creams",
    description:
      "Luxurious homemade moisturizers using shea butter, cocoa butter, and nourishing plant oils.",
    image: "/images/header-lotions.jpg",
    text: "text-clay",
    bar: "bg-clay/70",
    badge: "text-clay border-clay/30 bg-clay/10",
    activeTab: "data-[state=active]:text-clay",
  },
  Scrubs: {
    title: "Exfoliating Scrubs",
    description:
      "Invigorating sugar and salt scrubs to exfoliate and soften skin, infused with essential oils.",
    image: "/images/header-scrubs.jpg",
    text: "text-olive",
    bar: "bg-olive/70",
    badge: "text-olive border-olive/30 bg-olive/10",
    activeTab: "data-[state=active]:text-olive",
  },
  "Bath Bombs": {
    title: "Bath Bombs & Fizzies",
    description:
      "Fun and fizzy bath treats that add color, scent, and skin-loving oils to your soak.",
    image: "/images/header-bath-bombs.jpg",
    text: "text-lavender",
    bar: "bg-lavender/70",
    badge: "text-lavender border-lavender/30 bg-lavender/10",
    activeTab: "data-[state=active]:text-lavender",
  },
  Remedies: {
    title: "Herbal Remedies",
    description:
      "Healing salves, balms, and ointments made with infused herbal oils for natural wellness.",
    image: "/images/header-remedies.jpg",
    text: "text-honey",
    bar: "bg-honey/70",
    badge: "text-honey border-honey/30 bg-honey/10",
    activeTab: "data-[state=active]:text-honey",
  },
  "Hair Care": {
    title: "Natural Hair Care",
    description:
      "Gentle shampoo bars and conditioning oils free from harsh sulfates and synthetic chemicals.",
    image: "/images/header-hair-care.jpg",
    text: "text-herb",
    bar: "bg-herb/70",
    badge: "text-herb border-herb/30 bg-herb/10",
    activeTab: "data-[state=active]:text-herb",
  },
};

export function getCategoryStyle(category: string): CategoryStyle {
  return (
    CATEGORY_STYLES[category] ?? {
      ...DEFAULT_STYLE,
      title: category,
      description: DEFAULT_STYLE.description,
    }
  );
}

// --- Tabs -------------------------------------------------------------------

export interface TabDef {
  id: string;
  label: string;
  /** Matching category key in recipes.json; null for virtual tabs */
  category: string | null;
}

/** Category tabs derived from the JSON keys — new categories appear automatically */
export const CATEGORY_TABS: readonly TabDef[] = CATEGORIES.map((category) => ({
  id: slugifyName(category),
  label: category,
  category,
}));

export const ALL_TAB: TabDef = { id: "all", label: "All Recipes", category: null };
export const FAVORITES_TAB: TabDef = { id: "favorites", label: "Favorites", category: null };
export const CALCULATOR_TAB: TabDef = { id: "calculator", label: "Lye Calculator", category: null };

export const ALL_TABS: readonly TabDef[] = [
  ALL_TAB,
  ...CATEGORY_TABS,
  FAVORITES_TAB,
  CALCULATOR_TAB,
];

const tabsById = new Map(ALL_TABS.map((tab) => [tab.id, tab]));

export function isValidTabId(id: string | null): id is string {
  return id !== null && tabsById.has(id);
}

export function getTabCategory(tabId: string): string | null {
  return tabsById.get(tabId)?.category ?? null;
}

/** Hero copy + image for a given tab */
export function getTabHero(tabId: string): Pick<CategoryStyle, "title" | "description" | "image"> {
  const category = getTabCategory(tabId);
  if (category) return getCategoryStyle(category);
  if (tabId === "favorites") {
    return {
      title: "Your Favorites",
      description:
        "The recipes you have saved for later — your personal apothecary shelf.",
      image: "/images/hero-soap-making.jpg",
    };
  }
  if (tabId === "calculator") {
    return {
      title: "Lye Calculator",
      description:
        "Work out exact lye and water amounts for any blend of oils before you pour.",
      image: "/images/hero-soap-making.jpg",
    };
  }
  return DEFAULT_STYLE;
}
