/** Default share lifetime: 1 day. */
export const DAY_MS = 24 * 60 * 60 * 1000;

export function expiresAt(fromMs = Date.now(), ttlMs = DAY_MS): Date {
  return new Date(fromMs + ttlMs);
}

export function isExpired(expiresAtValue: Date | string | number, nowMs = Date.now()): boolean {
  const expiresMs =
    expiresAtValue instanceof Date
      ? expiresAtValue.getTime()
      : typeof expiresAtValue === "number"
        ? expiresAtValue
        : Date.parse(expiresAtValue);

  if (!Number.isFinite(expiresMs)) {
    return true;
  }

  return expiresMs <= nowMs;
}
