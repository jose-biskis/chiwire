import type { IncomingMessage } from "node:http";

function readHeader(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (rawValue === undefined || rawValue.trim() === "") {
    return undefined;
  }

  return rawValue.trim();
}

/**
 * When `authSecret` is set, callers must send
 * `Authorization: Bearer <secret>` or `x-mcp-auth: <secret>`.
 * When unset (typical local dev), auth is not required.
 */
export function isMcpAuthorized(
  request: IncomingMessage,
  authSecret: string | undefined,
): boolean {
  if (authSecret === undefined || authSecret.trim() === "") {
    return true;
  }

  const secret = authSecret.trim();
  const authorization = readHeader(request, "authorization");
  if (authorization?.startsWith("Bearer ") && authorization.slice("Bearer ".length) === secret) {
    return true;
  }

  const headerSecret = readHeader(request, "x-mcp-auth");
  return headerSecret === secret;
}
