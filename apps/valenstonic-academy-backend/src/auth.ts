import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import process from "node:process";

export const ADMIN_TOKEN = "ok-v1";

function adminUser(): string {
  return process.env.ADMIN_USER?.trim() || "admin";
}

function adminPass(): string {
  return process.env.ADMIN_PASS?.trim() || "1234";
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function verifyCredentials(username: string, password: string): boolean {
  return safeEqual(username, adminUser()) && safeEqual(password, adminPass());
}

export function readBearerToken(request: IncomingMessage): string | undefined {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return undefined;
  }
  return header.slice("Bearer ".length).trim();
}

export function isAdmin(request: IncomingMessage): boolean {
  return readBearerToken(request) === ADMIN_TOKEN;
}
