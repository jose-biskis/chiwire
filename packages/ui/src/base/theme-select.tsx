import {
  DEFAULT_COLOR_MODE_LABELS,
  UI_COLOR_MODES,
  type UiColorMode
} from "./appearance";
import { SelectChrome, type SelectChromeVariant } from "./select-chrome";

export type ThemeSelectProps = {
  value: UiColorMode;
  onValueChange?: ((value: UiColorMode) => void) | undefined;
  getHref?: ((value: UiColorMode) => string) | undefined;
  variant?: SelectChromeVariant;
  labels?: Partial<Record<UiColorMode, string>>;
  /** Order of modes. Default light then dark; pass `["dark","light"]` for dark-first. */
  options?: readonly UiColorMode[];
  className?: string | undefined;
  "aria-label"?: string | undefined;
};

export function ThemeSelect({
  value,
  onValueChange,
  getHref,
  variant = "pills",
  labels,
  options = UI_COLOR_MODES,
  className,
  "aria-label": ariaLabel = "Theme"
}: ThemeSelectProps) {
  const merged = { ...DEFAULT_COLOR_MODE_LABELS, ...labels };

  return (
    <SelectChrome
      value={value}
      options={options}
      labels={merged}
      variant={variant}
      menuPrefix={variant === "menu" ? "Theme: " : ""}
      onValueChange={onValueChange}
      getHref={getHref}
      className={className}
      aria-label={ariaLabel}
    />
  );
}
