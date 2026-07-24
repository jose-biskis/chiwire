import { createHash } from "node:crypto";

export type SchemaFile = {
  /** Path relative to the schema directory. */
  relativePath: string;
  contents: string;
};

export type FileChecksum = {
  path: string;
  checksum: string;
};

export function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Stable checksum for a set of schema files (order-independent by path sort). */
export function checksumSchemaFiles(files: SchemaFile[]): {
  checksum: string;
  files: FileChecksum[];
} {
  const sorted = [...files].sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath)
  );

  const fileChecksums: FileChecksum[] = sorted.map((file) => ({
    path: file.relativePath,
    checksum: hashText(file.contents)
  }));

  const manifest = fileChecksums
    .map((file) => `${file.path}\0${file.checksum}`)
    .join("\n");

  return {
    checksum: hashText(manifest),
    files: fileChecksums
  };
}
