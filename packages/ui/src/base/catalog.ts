/**
 * Shared semantic catalog. Every product archetype should implement these
 * (or explicitly document an intentional omission). Brand-only UI lives under
 * each archetype's `exclusive/` folder — not here.
 *
 * Valenstonic exclusive today: ScriptMark (Great Vibes brand line).
 * Separator + ScrollArea implementations live in base/ (identical across archetypes).
 */
export const SHARED_COMPONENTS = [
  "Alert",
  "Badge",
  "Button",
  "Card",
  "Input",
  "Label",
  "ScrollArea",
  "Separator",
  "Switch",
  "Tabs",
  "Textarea"
] as const;

export type SharedComponentName = (typeof SHARED_COMPONENTS)[number];
