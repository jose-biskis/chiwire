export type TextShare = {
  id: string;
  content: string;
  expiresAt: string;
  updatedAt: string;
};

export type FileShareMeta = {
  id: string;
  filename: string;
  size: number;
  contentType: string;
  expiresAt: string;
};

export type StatusKind = "ok" | "err" | null;

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? "Request failed";
  } catch {
    return "Request failed";
  }
}

export async function createTextShare(content: string): Promise<{ url: string }> {
  const response = await fetch("/api/texts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content })
  });
  const data = (await response.json()) as { url?: string; error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Failed");
  }
  if (!data.url) {
    throw new Error("Missing share URL");
  }
  return { url: data.url };
}

export async function createFileShare(file: File): Promise<{ url: string }> {
  const response = await fetch("/api/files", {
    method: "POST",
    headers: {
      "content-type": file.type || "application/octet-stream",
      "x-filename": file.name
    },
    body: file
  });
  const data = (await response.json()) as { url?: string; error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Failed");
  }
  if (!data.url) {
    throw new Error("Missing share URL");
  }
  return { url: data.url };
}

export async function getTextShare(id: string): Promise<TextShare> {
  const response = await fetch(`/api/texts/${encodeURIComponent(id)}`);
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as TextShare;
}

export async function updateTextShare(id: string, content: string): Promise<TextShare> {
  const response = await fetch(`/api/texts/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content })
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as TextShare;
}

export async function getFileMeta(id: string): Promise<FileShareMeta> {
  const response = await fetch(`/api/files/${encodeURIComponent(id)}/meta`);
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as FileShareMeta;
}

export async function deleteFileShare(id: string): Promise<void> {
  const response = await fetch(`/api/files/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
}

export function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
