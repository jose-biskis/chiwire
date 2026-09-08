export type InstallerPlatform = "win" | "linux" | "mac";

export type InstallerArtifact = {
  filename: string;
  label: string;
  platform: InstallerPlatform;
  kind: string;
  version: string;
  size: number;
  sha256: string;
  url: string;
};

export type InstallerManifest = {
  productName: string;
  version: string;
  publishedAt: string | null;
  artifacts: InstallerArtifact[];
};

export const EMPTY_MANIFEST: InstallerManifest = {
  productName: "Cachicamo Coding Agent Local",
  version: "0.1.0",
  publishedAt: null,
  artifacts: [],
};

export function isManifest(value: unknown): value is InstallerManifest {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return Array.isArray(record.artifacts) && typeof record.productName === "string";
}
