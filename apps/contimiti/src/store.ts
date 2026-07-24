import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createId, DAY_MS, expiresAt, isExpired } from "@chiwire/core";

export type TextShare = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export type FileShareMeta = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  createdAt: string;
  expiresAt: string;
};

export class ShareStore {
  readonly textsDir: string;
  readonly filesDir: string;

  constructor(readonly dataDir: string) {
    this.textsDir = path.join(dataDir, "texts");
    this.filesDir = path.join(dataDir, "files");
  }

  async init(): Promise<void> {
    await mkdir(this.textsDir, { recursive: true });
    await mkdir(this.filesDir, { recursive: true });
  }

  async createText(content: string): Promise<TextShare> {
    const now = new Date();
    const share: TextShare = {
      id: createId(),
      content,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: expiresAt(now.getTime(), DAY_MS).toISOString()
    };
    await writeFile(this.textPath(share.id), JSON.stringify(share), "utf8");
    return share;
  }

  async getText(id: string): Promise<TextShare | undefined> {
    const share = await this.readJson<TextShare>(this.textPath(id));
    if (!share) {
      return undefined;
    }
    if (isExpired(share.expiresAt)) {
      await this.deleteText(id);
      return undefined;
    }
    return share;
  }

  async updateText(id: string, content: string): Promise<TextShare | undefined> {
    const existing = await this.getText(id);
    if (!existing) {
      return undefined;
    }

    const updated: TextShare = {
      ...existing,
      content,
      updatedAt: new Date().toISOString()
    };
    await writeFile(this.textPath(id), JSON.stringify(updated), "utf8");
    return updated;
  }

  async deleteText(id: string): Promise<boolean> {
    try {
      await rm(this.textPath(id), { force: true });
      return true;
    } catch {
      return false;
    }
  }

  async createFile(
    filename: string,
    contentType: string,
    body: Buffer
  ): Promise<FileShareMeta> {
    const now = new Date();
    const id = createId();
    const meta: FileShareMeta = {
      id,
      filename: sanitizeFilename(filename),
      contentType: contentType || "application/octet-stream",
      size: body.byteLength,
      createdAt: now.toISOString(),
      expiresAt: expiresAt(now.getTime(), DAY_MS).toISOString()
    };

    await writeFile(this.fileMetaPath(id), JSON.stringify(meta), "utf8");
    await writeFile(this.fileBlobPath(id), body);
    return meta;
  }

  async getFileMeta(id: string): Promise<FileShareMeta | undefined> {
    const meta = await this.readJson<FileShareMeta>(this.fileMetaPath(id));
    if (!meta) {
      return undefined;
    }
    if (isExpired(meta.expiresAt)) {
      await this.deleteFile(id);
      return undefined;
    }
    return meta;
  }

  async readFileBlob(id: string): Promise<Buffer | undefined> {
    const meta = await this.getFileMeta(id);
    if (!meta) {
      return undefined;
    }

    try {
      return await readFile(this.fileBlobPath(id));
    } catch {
      return undefined;
    }
  }

  async deleteFile(id: string): Promise<boolean> {
    try {
      await rm(this.fileMetaPath(id), { force: true });
      await rm(this.fileBlobPath(id), { force: true });
      return true;
    } catch {
      return false;
    }
  }

  async purgeExpired(): Promise<{ texts: number; files: number }> {
    let texts = 0;
    let files = 0;

    for (const name of await safeReaddir(this.textsDir)) {
      if (!name.endsWith(".json")) {
        continue;
      }
      const id = name.slice(0, -".json".length);
      const share = await this.readJson<TextShare>(this.textPath(id));
      if (!share || isExpired(share.expiresAt)) {
        await this.deleteText(id);
        texts += 1;
      }
    }

    for (const name of await safeReaddir(this.filesDir)) {
      if (!name.endsWith(".meta.json")) {
        continue;
      }
      const id = name.slice(0, -".meta.json".length);
      const meta = await this.readJson<FileShareMeta>(this.fileMetaPath(id));
      if (!meta || isExpired(meta.expiresAt)) {
        await this.deleteFile(id);
        files += 1;
      }
    }

    return { texts, files };
  }

  private textPath(id: string): string {
    return path.join(this.textsDir, `${id}.json`);
  }

  private fileMetaPath(id: string): string {
    return path.join(this.filesDir, `${id}.meta.json`);
  }

  private fileBlobPath(id: string): string {
    return path.join(this.filesDir, `${id}.bin`);
  }

  private async readJson<T>(filePath: string): Promise<T | undefined> {
    try {
      const raw = await readFile(filePath, "utf8");
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }
}

function sanitizeFilename(filename: string): string {
  const base = path.basename(filename).replace(/[\u0000-\u001f<>:"|?*\\/]/g, "_").trim();
  return base.length > 0 ? base.slice(0, 200) : "file";
}

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}
