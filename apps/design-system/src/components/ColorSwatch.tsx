import { cn } from "@/lib/utils";

export type Swatch = {
  name: string;
  token: string;
  className: string;
};

type ColorSwatchGridProps = {
  swatches: Swatch[];
};

export function ColorSwatchGrid({ swatches }: ColorSwatchGridProps) {
  return (
    <div className="grid w-[min(40rem,90vw)] grid-cols-2 gap-3 sm:grid-cols-3">
      {swatches.map((swatch) => (
        <div
          key={swatch.name}
          className="overflow-hidden rounded-md border border-border bg-card shadow-sm"
        >
          <div className={cn("h-16", swatch.className)} />
          <div className="space-y-0.5 p-3">
            <p className="font-display text-sm font-semibold text-card-foreground">
              {swatch.name}
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">{swatch.token}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
