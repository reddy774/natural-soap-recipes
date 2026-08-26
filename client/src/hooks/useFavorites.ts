import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "soap-favorites";

function readStored(): readonly string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    // Storage unavailable or corrupted — favorites simply start empty
    return [];
  }
}

function persist(next: readonly string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode, quota) — keep working in-memory
  }
}

// Module-level store so every component shares one favorites state
let favorites: readonly string[] = typeof window === "undefined" ? [] : readStored();
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setFavorites(next: readonly string[]): void {
  favorites = next;
  persist(next);
  emit();
}

export function toggleFavorite(slug: string): void {
  setFavorites(
    favorites.includes(slug)
      ? favorites.filter((item) => item !== slug)
      : [...favorites, slug]
  );
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): readonly string[] {
  return favorites;
}

// Keep multiple tabs in sync
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      favorites = readStored();
      emit();
    }
  });
}

export interface UseFavoritesResult {
  favorites: readonly string[];
  isFavorite: (slug: string) => boolean;
  toggleFavorite: (slug: string) => void;
}

export function useFavorites(): UseFavoritesResult {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const isFavorite = useCallback(
    (slug: string) => current.includes(slug),
    [current]
  );
  return { favorites: current, isFavorite, toggleFavorite };
}
