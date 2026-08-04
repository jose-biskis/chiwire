import { useEffect, useRef, useState } from "react";
import { ArchetypeSelect, ThemeSelect } from "@chiwire/ui/base";
import { Button } from "@chiwire/ui/internal";
import { useAppearance } from "../hooks/useAppearance";

export function AppearanceMenu() {
  const { appearance, setArchetype, setColorMode } = useAppearance();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(event: MouseEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Appearance"
      >
        View
      </Button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 min-w-[220px] rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-md"
        >
          <ArchetypeSelect
            variant="menu"
            value={appearance.archetype}
            onValueChange={(value) => {
              setArchetype(value);
              setOpen(false);
            }}
          />
          <div className="my-1 h-px bg-border" role="separator" />
          <ThemeSelect
            variant="menu"
            value={appearance.colorMode}
            onValueChange={(value) => {
              setColorMode(value);
              setOpen(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
