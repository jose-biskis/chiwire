import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArchetypeSelect, ThemeSelect } from "@chiwire/ui/base";
import type { UiArchetype, UiColorMode } from "../../../shared/types";
import { cn } from "@/lib/utils";

type MenuKey = "file" | "edit" | "view" | "window" | "help" | null;

type MenuItem =
  | {
      type: "item";
      label: string;
      shortcut?: string;
      action?: () => void;
      disabled?: boolean;
      checked?: boolean;
    }
  | { type: "separator" };

type TitleBarProps = {
  onOpenFolder: () => void;
  onToggleSidebar: () => void;
  uiArchetype: UiArchetype;
  uiColorMode: UiColorMode;
  onUiArchetype: (archetype: UiArchetype) => void;
  onUiColorMode: (mode: UiColorMode) => void;
};

function MenuItems({
  items,
  onRun
}: {
  items: MenuItem[];
  onRun: (item: Extract<MenuItem, { type: "item" }>) => void;
}) {
  return (
    <>
      {items.map((item, index) =>
        item.type === "separator" ? (
          <div key={`sep-${index}`} className="my-1 h-px bg-border" />
        ) : (
          <button
            key={item.label}
            type="button"
            disabled={item.disabled}
            className="flex h-7 w-full items-center justify-between gap-3 px-3 text-left hover:bg-selection hover:text-white disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-foreground"
            onClick={() => onRun(item)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="inline-flex w-3 shrink-0 justify-center text-[11px]">
                {item.checked ? "✓" : ""}
              </span>
              <span>{item.label}</span>
            </span>
            {item.shortcut ? (
              <span className="shrink-0 text-[11px] text-muted-foreground">{item.shortcut}</span>
            ) : null}
          </button>
        )
      )}
    </>
  );
}

export function TitleBar({
  onOpenFolder,
  onToggleSidebar,
  uiArchetype,
  uiColorMode,
  onUiArchetype,
  onUiColorMode
}: TitleBarProps) {
  const [openMenu, setOpenMenu] = useState<MenuKey>(null);
  const [platform, setPlatform] = useState("linux");
  const rootRef = useRef<HTMLDivElement>(null);
  const useOverlayControls = platform === "win32";

  useEffect(() => {
    void window.cachicamoAgent.getPlatform().then(setPlatform);
  }, []);

  useEffect(() => {
    function onDocClick(event: MouseEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const menus: Record<Exclude<MenuKey, null>, MenuItem[]> = {
    file: [
      { type: "item", label: "Open Folder…", shortcut: "Ctrl+O", action: onOpenFolder },
      { type: "separator" },
      {
        type: "item",
        label: "Exit",
        shortcut: "Alt+F4",
        action: () => void window.cachicamoAgent.windowClose()
      }
    ],
    edit: [
      { type: "item", label: "Undo", shortcut: "Ctrl+Z", disabled: true },
      { type: "item", label: "Redo", shortcut: "Ctrl+Y", disabled: true },
      { type: "separator" },
      { type: "item", label: "Cut", shortcut: "Ctrl+X", disabled: true },
      { type: "item", label: "Copy", shortcut: "Ctrl+C", disabled: true },
      { type: "item", label: "Paste", shortcut: "Ctrl+V", disabled: true }
    ],
    view: [],
    window: [
      {
        type: "item",
        label: "Minimize",
        action: () => void window.cachicamoAgent.windowMinimize()
      },
      {
        type: "item",
        label: "Toggle Maximize",
        action: () => void window.cachicamoAgent.windowMaximize()
      },
      { type: "separator" },
      {
        type: "item",
        label: "Close Window",
        action: () => void window.cachicamoAgent.windowClose()
      }
    ],
    help: [
      {
        type: "item",
        label: "About Cachicamo",
        action: () => {
          window.alert(
            "Cachicamo Coding Agent Local\n\nCachicamo is the Venezuelan name for armadillo."
          );
        }
      }
    ]
  };

  const viewTop: MenuItem[] = [
    { type: "item", label: "Toggle Primary Side Bar", shortcut: "Ctrl+B", action: onToggleSidebar }
  ];

  const viewZoom: MenuItem[] = [
    {
      type: "item",
      label: "Zoom In",
      shortcut: "Ctrl+=",
      action: () => {
        document.body.style.zoom = String(Math.min(1.4, Number(document.body.style.zoom || 1) + 0.1));
      }
    },
    {
      type: "item",
      label: "Zoom Out",
      shortcut: "Ctrl+-",
      action: () => {
        document.body.style.zoom = String(Math.max(0.8, Number(document.body.style.zoom || 1) - 0.1));
      }
    },
    {
      type: "item",
      label: "Reset Zoom",
      action: () => {
        document.body.style.zoom = "1";
      }
    }
  ];

  function runItem(item: Extract<MenuItem, { type: "item" }>): void {
    if (item.disabled) return;
    item.action?.();
    setOpenMenu(null);
  }

  function renderMenuBody(key: Exclude<MenuKey, null>): ReactNode {
    if (key !== "view") {
      return <MenuItems items={menus[key]} onRun={runItem} />;
    }

    return (
      <>
        <MenuItems items={viewTop} onRun={runItem} />
        <div className="my-1 h-px bg-border" />
        <ArchetypeSelect
          variant="menu"
          value={uiArchetype}
          onValueChange={(value) => {
            onUiArchetype(value);
            setOpenMenu(null);
          }}
        />
        <div className="my-1 h-px bg-border" />
        <ThemeSelect
          variant="menu"
          value={uiColorMode}
          options={["dark", "light"]}
          onValueChange={(value) => {
            onUiColorMode(value);
            setOpenMenu(null);
          }}
        />
        <div className="my-1 h-px bg-border" />
        <MenuItems items={viewZoom} onRun={runItem} />
      </>
    );
  }

  return (
    <header
      ref={rootRef}
      className="titlebar-drag flex h-[35px] shrink-0 select-none items-center border-b border-border bg-card text-[12px] text-foreground"
    >
      <div className="flex h-full min-w-0 flex-1 items-center">
        <div className="titlebar-no-drag flex h-full items-center px-1">
          <img
            src="/icon.png"
            alt=""
            width={18}
            height={18}
            className="mr-1.5 ml-1 size-[18px] rounded-[4px]"
          />
          <span className="mr-1 px-0.5 text-[11px] font-semibold tracking-tight text-foreground">
            Cachicamo
          </span>
          {(
            [
              ["file", "File"],
              ["edit", "Edit"],
              ["view", "View"],
              ["window", "Window"],
              ["help", "Help"]
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="relative">
              <button
                type="button"
                className={cn(
                  "titlebar-no-drag h-[22px] rounded-[2px] px-2 text-foreground/90 hover:bg-accent",
                  openMenu === key && "bg-accent"
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setOpenMenu((current) => (current === key ? null : key))}
                onMouseEnter={() => {
                  if (openMenu) setOpenMenu(key);
                }}
              >
                {label}
              </button>
              {openMenu === key ? (
                <div className="titlebar-no-drag absolute top-full left-0 z-50 min-w-[240px] border border-border bg-popover py-1 shadow-xl">
                  {renderMenuBody(key)}
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <div className="pointer-events-none flex-1 text-center text-[12px] text-muted-foreground">
          Cachicamo Coding Agent Local
        </div>
        {useOverlayControls ? <div className="w-[138px] shrink-0" /> : null}
      </div>
    </header>
  );
}
