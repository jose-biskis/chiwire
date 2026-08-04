import {
  DEFAULT_ARCHETYPE_LABELS,
  UI_ARCHETYPES,
  type UiArchetype
} from "./appearance";
import { SelectChrome, type SelectChromeVariant } from "./select-chrome";

export type ArchetypeSelectProps = {
  value: UiArchetype;
  onValueChange?: ((value: UiArchetype) => void) | undefined;
  getHref?: ((value: UiArchetype) => string) | undefined;
  variant?: SelectChromeVariant;
  labels?: Partial<Record<UiArchetype, string>>;
  className?: string | undefined;
  "aria-label"?: string | undefined;
};

export function ArchetypeSelect({
  value,
  onValueChange,
  getHref,
  variant = "pills",
  labels,
  className,
  "aria-label": ariaLabel = "Archetype"
}: ArchetypeSelectProps) {
  const merged = { ...DEFAULT_ARCHETYPE_LABELS, ...labels };

  return (
    <SelectChrome
      value={value}
      options={UI_ARCHETYPES}
      labels={merged}
      variant={variant}
      menuPrefix={variant === "menu" ? "Archetype: " : ""}
      onValueChange={onValueChange}
      getHref={getHref}
      className={className}
      aria-label={ariaLabel}
    />
  );
}
