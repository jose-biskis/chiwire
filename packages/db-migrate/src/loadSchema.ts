import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SchemaFile } from "./checksum.js";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

export function defaultSchemasRoot(): string {
  return path.join(packageRoot, "schemas");
}

export function resolveSchemaDir(
  targetSchema: string,
  schemasRoot = defaultSchemasRoot()
): string {
  return path.join(schemasRoot, targetSchema);
}

async function collectSqlFiles(dir: string, baseDir: string): Promise<SchemaFile[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: SchemaFile[] = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSqlFiles(fullPath, baseDir)));
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".sql")) {
      continue;
    }
    const contents = await readFile(fullPath, "utf8");
    files.push({
      relativePath: path.relative(baseDir, fullPath).split(path.sep).join("/"),
      contents
    });
  }

  return files;
}

export async function loadSchemaFiles(schemaDir: string): Promise<SchemaFile[]> {
  const files = await collectSqlFiles(schemaDir, schemaDir);
  if (files.length === 0) {
    throw new Error(`No .sql files found under ${schemaDir}`);
  }
  return files;
}
