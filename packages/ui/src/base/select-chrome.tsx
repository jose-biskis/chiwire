import * as React from "react";
import { cn } from "../lib/utils";

export type SelectChromeVariant = "pills" | "menu";

type OptionRenderProps = {
  selected: boolean;
  label: string;
  className: string;
};

type SelectChromeProps<T extends string> = {
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  variant?: SelectChromeVariant;
  /** Prefix for menu labels, e.g. "Theme: " → "Theme: Dark". */
  menuPrefix?: string;
  onValueChange?: ((value: T) => void) | undefined;
  /** When set, options render as links (SSR / query-param prefs). */
  getHref?: ((value: T) => string) | undefined;
  className?: string | undefined;
  "aria-label"?: string | undefined;
};

export function SelectChrome<T extends string>({
  value,
  options,
  labels,
  variant = "pills",
  menuPrefix = "",
  onValueChange,
  getHref,
  className,
  "aria-label": ariaLabel
}: SelectChromeProps<T>) {
  const isMenu = variant === "menu";

  function optionLabel(option: T): string {
    const base = labels[option] ?? option;
    return isMenu && menuPrefix ? `${menuPrefix}${base}` : base;
  }

  function optionClass(selected: boolean): string {
    if (isMenu) {
      return cn(
        "flex h-8 w-full items-center gap-2 px-3 text-left text-sm hover:bg-accent hover:text-accent-foreground"
      );
    }
    return cn(
      "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors",
      selected
        ? "border-border bg-secondary text-foreground"
        : "border-border bg-transparent text-muted-foreground hover:border-accent hover:text-foreground"
    );
  }

  function renderOption(option: T, content: (props: OptionRenderProps) => React.ReactNode) {
    const selected = option === value;
    const label = optionLabel(option);
    const className = optionClass(selected);
    return content({ selected, label, className });
  }

  return (
    <div
      role={isMenu ? "group" : "radiogroup"}
      aria-label={ariaLabel}
      className={cn(
        isMenu ? "flex flex-col" : "flex flex-wrap items-center gap-1.5",
        className
      )}
    >
      {options.map((option) =>
        renderOption(option, ({ selected, label, className: itemClass }) => {
          const href = getHref?.(option);
          const body = (
            <>
              {isMenu ? (
                <span className="inline-flex w-3 shrink-0 justify-center text-[11px]">
                  {selected ? "✓" : ""}
                </span>
              ) : null}
              <span>{label}</span>
            </>
          );

          if (href) {
            return (
              <a
                key={option}
                href={href}
                role={isMenu ? "menuitemradio" : "radio"}
                aria-checked={selected}
                aria-current={selected ? "true" : undefined}
                className={itemClass}
              >
                {body}
              </a>
            );
          }

          return (
            <button
              key={option}
              type="button"
              role={isMenu ? "menuitemradio" : "radio"}
              aria-checked={selected}
              className={itemClass}
              onClick={() => onValueChange?.(option)}
            >
              {body}
            </button>
          );
        })
      )}
    </div>
  );
}
