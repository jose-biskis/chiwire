/**
 * Semantic variant / size contracts. Archetypes should keep these names in
 * sync where possible; they may narrow (drop) or extend with exclusive variants.
 */

/** Core button variants every archetype should understand. */
export const BUTTON_CORE_VARIANTS = [
  "default",
  "secondary",
  "ghost",
  "link"
] as const;

/** Optional Internal-style extras (archetypes may omit). */
export const BUTTON_EXTENDED_VARIANTS = ["outline", "destructive"] as const;

export const BUTTON_SIZES = ["default", "sm", "lg", "icon"] as const;

export const BADGE_VARIANTS = [
  "default",
  "secondary",
  "outline",
  "destructive"
] as const;

export const ALERT_VARIANTS = ["default", "destructive", "success"] as const;

export type ButtonCoreVariant = (typeof BUTTON_CORE_VARIANTS)[number];
export type ButtonExtendedVariant = (typeof BUTTON_EXTENDED_VARIANTS)[number];
export type ButtonSize = (typeof BUTTON_SIZES)[number];
export type BadgeVariant = (typeof BADGE_VARIANTS)[number];
export type AlertVariant = (typeof ALERT_VARIANTS)[number];
