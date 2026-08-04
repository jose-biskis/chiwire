/** Known design-system archetypes. New projects default to Internal. */
export const ARCHETYPES = ["internal", "valenstonic"] as const;

export type Archetype = (typeof ARCHETYPES)[number];

export const DEFAULT_ARCHETYPE: Archetype = "internal";

export type ColorMode = "light" | "dark";

export const DEFAULT_COLOR_MODE: ColorMode = "light";

/** Per-archetype default when Storybook color mode is unset. */
export function defaultColorModeFor(archetype: Archetype): ColorMode {
  return archetype === "valenstonic" ? "dark" : "light";
}

const TITLE_MAP: Record<string, Archetype> = {
  internal: "internal",
  valenstonic: "valenstonic"
};

/** Resolve archetype from a Storybook title like `Archetypes/Internal/Button`. */
export function archetypeFromStoryTitle(title: string): Archetype | null {
  const parts = title.split("/").map((part) => part.trim().toLowerCase());
  for (const part of parts) {
    const match = TITLE_MAP[part];
    if (match) {
      return match;
    }
  }
  return null;
}
