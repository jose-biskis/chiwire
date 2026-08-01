import { generateKeyPairSync, createPrivateKey } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Load or create a persistent RSA host key for the embedded SSH server. */
export async function loadOrCreateHostKey(dataDir: string): Promise<Buffer> {
  const keyPath = path.join(dataDir, "ssh_host_rsa_key");

  try {
    const existing = await readFile(keyPath);
    createPrivateKey(existing);
    return existing;
  } catch {
    // create below
  }

  await mkdir(dataDir, { recursive: true });
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
    publicKeyEncoding: { type: "pkcs1", format: "pem" }
  });

  const buffer = Buffer.from(privateKey, "utf8");
  await writeFile(keyPath, buffer, { mode: 0o600 });
  return buffer;
}
