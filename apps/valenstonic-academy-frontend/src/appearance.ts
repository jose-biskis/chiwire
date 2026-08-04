export type ServerAppearance = {
  archetype: "valenstonic" | "internal";
  theme: "dark" | "light";
  lang: "en" | "es";
};

export const DEFAULT_APPEARANCE: ServerAppearance = {
  archetype: "valenstonic",
  theme: "dark",
  lang: "en"
};

const PREFS_COOKIE = "vt_site_prefs";

export function parseArchetype(value: string | null | undefined): ServerAppearance["archetype"] {
  return value === "internal" ? "internal" : "valenstonic";
}

export function parseTheme(value: string | null | undefined): ServerAppearance["theme"] {
  return value === "light" ? "light" : "dark";
}

export function parseLang(value: string | null | undefined): ServerAppearance["lang"] {
  return value === "es" ? "es" : "en";
}

export function readPrefsFromCookieHeader(cookieHeader: string | null | undefined): ServerAppearance | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${PREFS_COOKIE}=([^;]*)`));
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1])) as Partial<ServerAppearance>;
    return {
      archetype: parseArchetype(parsed.archetype),
      theme: parseTheme(parsed.theme),
      lang: parseLang(parsed.lang)
    };
  } catch {
    return null;
  }
}

export function resolveAppearance(
  search: string,
  cookieHeader?: string | null
): ServerAppearance {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const stored = readPrefsFromCookieHeader(cookieHeader);
  return {
    archetype: parseArchetype(params.get("archetype") ?? stored?.archetype),
    theme: parseTheme(params.get("theme") ?? stored?.theme),
    lang: parseLang(params.get("lang") ?? stored?.lang)
  };
}

/** Append appearance query params while keeping existing query (mode, etc.). */
export function withAppearance(path: string, appearance: ServerAppearance): string {
  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const [pathname, existing = ""] = withoutHash.split("?");
  const params = new URLSearchParams(existing);
  params.set("archetype", appearance.archetype);
  params.set("theme", appearance.theme);
  params.set("lang", appearance.lang);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}
