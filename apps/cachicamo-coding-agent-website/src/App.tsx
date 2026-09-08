import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@chiwire/ui/internal";
import { EMPTY_MANIFEST, isManifest, type InstallerArtifact, type InstallerManifest, type InstallerPlatform } from "./manifest";

const PLATFORM_LABEL: Record<string, string> = {
  win: "Windows",
  linux: "Linux",
  mac: "macOS",
};

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  const units = ["KB", "MB", "GB"];
  let value = size / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

function formatPublishedAt(value: string | null): string {
  if (!value) {
    return "Not published yet";
  }
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function shortHash(sha256: string): string {
  return `${sha256.slice(0, 12)}…${sha256.slice(-8)}`;
}

function ArtifactCard({ artifact }: { artifact: InstallerArtifact }) {
  return (
    <Card className="overflow-hidden border-border/80 bg-card/80 shadow-none">
      <div className="flex">
        <div
          aria-hidden="true"
          className="w-2 shrink-0 bg-[color-mix(in_srgb,var(--color-warning)_72%,var(--color-foreground))]"
        />
        <div className="min-w-0 flex-1">
          <CardHeader className="gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{PLATFORM_LABEL[artifact.platform] ?? artifact.platform}</Badge>
              <Badge variant="outline">{artifact.kind}</Badge>
            </div>
            <CardTitle className="text-lg leading-tight">{artifact.label}</CardTitle>
            <CardDescription className="font-mono text-xs break-all">
              {artifact.filename}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm text-muted-foreground">
            <p>
              {formatBytes(artifact.size)} · v{artifact.version}
            </p>
            <p className="font-mono text-xs" title={artifact.sha256}>
              sha256 {shortHash(artifact.sha256)}
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild>
              <a href={artifact.url} download={artifact.filename}>
                Download
              </a>
            </Button>
          </CardFooter>
        </div>
      </div>
    </Card>
  );
}

export function App() {
  const [manifest, setManifest] = useState<InstallerManifest>(EMPTY_MANIFEST);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/downloads/manifest.json", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`manifest ${response.status}`);
        }
        return response.json();
      })
      .then((data: unknown) => {
        if (cancelled) {
          return;
        }
        if (!isManifest(data)) {
          throw new Error("invalid manifest");
        }
        setManifest({
          ...EMPTY_MANIFEST,
          ...data,
          artifacts: data.artifacts,
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Failed to load manifest");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const platforms = useMemo(() => {
    const seen = new Set(manifest.artifacts.map((item) => item.platform));
    const order: InstallerPlatform[] = ["win", "linux", "mac"];
    return order.filter((platform) => seen.has(platform));
  }, [manifest.artifacts]);

  const defaultTab = "all";

  return (
    <div className="depot-grain relative min-h-screen bg-background text-foreground">
      <div className="depot-scutes" aria-hidden="true">
        <span className="left-[-4rem] top-16 h-40 w-72 rounded-[2rem]" />
        <span className="right-[-3rem] top-40 h-52 w-80 rounded-[2.5rem]" />
        <span className="bottom-8 left-1/3 h-28 w-64 rounded-[1.75rem]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10">
        <header className="depot-rise flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/icon.png"
              alt=""
              width={44}
              height={44}
              className="rounded-md border border-border"
            />
            <div>
              <p className="text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
                AvilaLabs
              </p>
              <p className="text-sm font-semibold">Cachicamo depot</p>
            </div>
          </div>
          <Badge>cachicamo.avilalabs.dev</Badge>
        </header>

        <section className="depot-rise grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-end" style={{ animationDelay: "0.08s" }}>
          <div className="space-y-5">
            <h1 className="depot-title text-[clamp(3.2rem,12vw,6.4rem)]">
              Cachicamo
              <span className="block text-[0.34em] tracking-[0.18em] text-muted-foreground">
                Coding Agent Local
              </span>
            </h1>
            <p className="max-w-md text-base leading-relaxed text-muted-foreground">
              Desktop builds of the coding agent. Publish from the monorepo, then
              download the installer for the machine in front of you.
            </p>
          </div>
          <Card className="bg-card/70 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Latest drop</CardTitle>
              <CardDescription>{manifest.productName}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 font-mono text-sm">
              <p>version {manifest.version}</p>
              <p>{formatPublishedAt(manifest.publishedAt)}</p>
              <p>
                {manifest.artifacts.length === 1
                  ? "1 artifact"
                  : `${manifest.artifacts.length} artifacts`}
              </p>
            </CardContent>
          </Card>
        </section>

        <Separator />

        <section className="depot-rise space-y-5" style={{ animationDelay: "0.16s" }}>
          {loadError ? (
            <Card>
              <CardHeader>
                <CardTitle>Manifest unavailable</CardTitle>
                <CardDescription>{loadError}</CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          {manifest.artifacts.length === 0 && !loadError ? (
            <Card className="border-dashed bg-card/60 shadow-none">
              <CardHeader>
                <CardTitle>No installers published</CardTitle>
                <CardDescription>
                  Build an installer, copy it into this site, then deploy.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded-md bg-muted px-4 py-3 font-mono text-xs leading-relaxed">
{`npm run build:cachicamo-coding-agent-local:linux
npm run publish:cachicamo-coding-agent-website
npm run deploy:cachicamo-coding-agent-website`}
                </pre>
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue={defaultTab}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                {platforms.map((platform) => (
                  <TabsTrigger key={platform} value={platform}>
                    {PLATFORM_LABEL[platform]}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="all" className="mt-5 grid gap-4 md:grid-cols-2">
                {manifest.artifacts.map((artifact) => (
                  <ArtifactCard key={artifact.filename} artifact={artifact} />
                ))}
              </TabsContent>
              {platforms.map((platform) => (
                <TabsContent key={platform} value={platform} className="mt-5 grid gap-4 md:grid-cols-2">
                  {manifest.artifacts
                    .filter((artifact) => artifact.platform === platform)
                    .map((artifact) => (
                      <ArtifactCard key={artifact.filename} artifact={artifact} />
                    ))}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </section>
      </div>
    </div>
  );
}
