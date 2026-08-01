import { randomBytes } from "node:crypto";

const WORDS = [
  "bemba",
  "chisme",
  "onda",
  "senal",
  "rumor",
  "eco",
  "voz",
  "nota",
  "tip",
  "aire",
  "viva",
  "clara",
  "suelta",
  "fina",
  "breve",
  "nueva",
  "rara",
  "dulce",
  "alta",
  "cerca"
] as const;

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

/** Validate a user-requested subdomain label. */
export function isValidSlug(slug: string): boolean {
  if (slug.length < 2 || slug.length > 48) {
    return false;
  }

  if (!SLUG_PATTERN.test(slug)) {
    return false;
  }

  if (slug.includes("--")) {
    return false;
  }

  return true;
}

/** Generate a memorable random slug like `chisme-a3f9`. */
export function createSlug(): string {
  const word = WORDS[randomBytes(1)[0]! % WORDS.length]!;
  const suffix = randomBytes(2).toString("hex");
  return `${word}-${suffix}`;
}

/** Extract tunnel slug from a Host header against the base domain. */
export function slugFromHost(host: string, baseDomain: string): string | null {
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  const base = baseDomain.toLowerCase();

  if (hostname === base || hostname === `www.${base}`) {
    return null;
  }

  const suffix = `.${base}`;
  if (!hostname.endsWith(suffix)) {
    return null;
  }

  const slug = hostname.slice(0, -suffix.length);
  if (!slug || slug.includes(".")) {
    return null;
  }

  return isValidSlug(slug) ? slug : null;
}
