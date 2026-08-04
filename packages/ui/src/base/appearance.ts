/** Shared appearance ids for cross-app View / Prefs chrome. */

export const UI_ARCHETYPES = ["internal", "valenstonic"] as const;
export type UiArchetype = (typeof UI_ARCHETYPES)[number];

export const UI_COLOR_MODES = ["light", "dark"] as const;
export type UiColorMode = (typeof UI_COLOR_MODES)[number];

export const DEFAULT_ARCHETYPE_LABELS: Record<UiArchetype, string> = {
  internal: "Internal",
  valenstonic: "Valenstonic"
};

export const DEFAULT_COLOR_MODE_LABELS: Record<UiColorMode, string> = {
  light: "Light",
  dark: "Dark"
};
