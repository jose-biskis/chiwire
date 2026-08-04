import type { UiArchetype, UiColorMode } from "@chiwire/ui/base";

export type { UiArchetype, UiColorMode };

export type Appearance = {
  archetype: UiArchetype;
  colorMode: UiColorMode;
};

const STORAGE_KEY = "contimiti-appearance";
const LEGACY_COLOR_KEY = "contimiti-color-mode";

export const DEFAULT_APPEARANCE: Appearance = {
  archetype: "internal",
  colorMode: "light"
};

function parseArchetype(value: unknown): UiArchetype | null {
  return value === "internal" || value === "valenstonic" ? value : null;
}

function parseColorMode(value: unknown): UiColorMode | null {
  return value === "light" || value === "dark" ? value : null;
}

export function readStoredAppearance(): Appearance | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Appearance>;
      const archetype = parseArchetype(parsed.archetype);
      const colorMode = parseColorMode(parsed.colorMode);
      if (archetype && colorMode) {
        return { archetype, colorMode };
      }
      if (colorMode) {
        return { archetype: "internal", colorMode };
      }
    }

    const legacy = parseColorMode(localStorage.getItem(LEGACY_COLOR_KEY));
    if (legacy) {
      return { archetype: "internal", colorMode: legacy };
    }
  } catch {
    // ignore
  }
  return null;
}

export function preferredAppearance(): Appearance {
  return readStoredAppearance() ?? DEFAULT_APPEARANCE;
}

export function applyAppearance(appearance: Appearance): void {
  for (const el of [document.documentElement, document.body]) {
    el.dataset.archetype = appearance.archetype;
    el.dataset.theme = appearance.colorMode;
  }
}

export function storeAppearance(appearance: Appearance): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
    localStorage.removeItem(LEGACY_COLOR_KEY);
  } catch {
    // ignore
  }
}
