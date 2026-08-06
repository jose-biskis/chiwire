import type { IncomingMessage } from "node:http";

export function readAdminSecret(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const secret = env.GARITA_ADMIN_SECRET?.trim();
  return secret || undefined;
}

function readHeader(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (rawValue === undefined || rawValue.trim() === "") {
    return undefined;
  }
  return rawValue.trim();
}

export function isGaritaAuthorized(request: IncomingMessage): boolean {
  const secret = readAdminSecret();
  if (!secret) {
    // Local convenience: open when unset.
    return true;
  }

  const authorization = readHeader(request, "authorization");
  if (authorization?.startsWith("Bearer ") && authorization.slice("Bearer ".length) === secret) {
    return true;
  }

  return readHeader(request, "x-garita-auth") === secret;
}
