import { randomBytes } from "node:crypto";

/** Short, URL-safe id suitable for share links. */
export function createId(byteLength = 9): string {
  return randomBytes(byteLength).toString("base64url");
}
