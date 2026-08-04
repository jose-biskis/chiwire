/**
 * Base layer — semantic contract, shared primitives, and cross-app chrome.
 *
 * Product UIs normally import `@chiwire/ui/internal` or `@chiwire/ui/valenstonic`.
 * Exception: `ArchetypeSelect` / `ThemeSelect` are meant for app chrome (View menus,
 * prefs bars) and may be imported from `@chiwire/ui/base`.
 */
export { SHARED_COMPONENTS } from "./catalog";
export type { SharedComponentName } from "./catalog";
export {
  ALERT_VARIANTS,
  BADGE_VARIANTS,
  BUTTON_CORE_VARIANTS,
  BUTTON_EXTENDED_VARIANTS,
  BUTTON_SIZES
} from "./variants";
export type {
  AlertVariant,
  BadgeVariant,
  ButtonCoreVariant,
  ButtonExtendedVariant,
  ButtonSize
} from "./variants";
export {
  DEFAULT_ARCHETYPE_LABELS,
  DEFAULT_COLOR_MODE_LABELS,
  UI_ARCHETYPES,
  UI_COLOR_MODES
} from "./appearance";
export type { UiArchetype, UiColorMode } from "./appearance";
export { ArchetypeSelect } from "./archetype-select";
export type { ArchetypeSelectProps } from "./archetype-select";
export { ThemeSelect } from "./theme-select";
export type { ThemeSelectProps } from "./theme-select";
export { ScrollArea, ScrollBar } from "./scroll-area";
export { Separator } from "./separator";
