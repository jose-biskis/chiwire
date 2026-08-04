import type { UiArchetype, UiColorMode } from "@chiwire/ui/base";

export const COLOR_MODES = ["dark", "light"] as const satisfies readonly UiColorMode[];
export type ColorMode = UiColorMode;

export const ARCHETYPES = ["valenstonic", "internal"] as const satisfies readonly UiArchetype[];
export type ArchetypeId = UiArchetype;

export const LANG_IDS = ["en", "es"] as const;
export type LangId = (typeof LANG_IDS)[number];

/** Product default — will lock to valenstonic later; selector stays for now. */
export const DEFAULT_ARCHETYPE: ArchetypeId = "valenstonic";
export const DEFAULT_COLOR_MODE: ColorMode = "dark";
export const DEFAULT_LANG: LangId = "en";

export const PREFS_STORAGE_KEY = "vt-site-prefs";
export const PREFS_COOKIE = "vt_site_prefs";

export type SitePrefs = {
  archetype: ArchetypeId;
  theme: ColorMode;
  lang: LangId;
};

export const DEFAULT_PREFS: SitePrefs = {
  archetype: DEFAULT_ARCHETYPE,
  theme: DEFAULT_COLOR_MODE,
  lang: DEFAULT_LANG
};

export function parseArchetype(value: string | null | undefined): ArchetypeId {
  if (value === "internal" || value === "valenstonic") {
    return value;
  }
  return DEFAULT_ARCHETYPE;
}

export function parseColorMode(value: string | null | undefined): ColorMode {
  if (value === "light" || value === "dark") {
    return value;
  }
  return DEFAULT_COLOR_MODE;
}

export function parseLang(value: string | null | undefined): LangId {
  if (value && (LANG_IDS as readonly string[]).includes(value)) {
    return value as LangId;
  }
  return DEFAULT_LANG;
}

export function parsePrefsFromSearch(search: string): SitePrefs {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return {
    archetype: parseArchetype(params.get("archetype")),
    theme: parseColorMode(params.get("theme")),
    lang: parseLang(params.get("lang"))
  };
}

/** Merge URL (when present) over stored/defaults. */
export function resolvePrefs(options: {
  searchParams?: URLSearchParams | null;
  stored?: SitePrefs | null;
  initial?: Partial<SitePrefs> | null;
}): SitePrefs {
  const params = options.searchParams;
  const stored = options.stored;
  const initial = options.initial;
  return {
    archetype: parseArchetype(
      params?.get("archetype") ?? initial?.archetype ?? stored?.archetype
    ),
    theme: parseColorMode(params?.get("theme") ?? initial?.theme ?? stored?.theme),
    lang: parseLang(params?.get("lang") ?? initial?.lang ?? stored?.lang)
  };
}

export function readStoredPrefs(): SitePrefs | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SitePrefs>;
    return {
      archetype: parseArchetype(parsed.archetype),
      theme: parseColorMode(parsed.theme),
      lang: parseLang(parsed.lang)
    };
  } catch {
    return null;
  }
}

export function readPrefsFromCookieHeader(cookieHeader: string | null | undefined): SitePrefs | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${PREFS_COOKIE}=([^;]*)`));
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1])) as Partial<SitePrefs>;
    return {
      archetype: parseArchetype(parsed.archetype),
      theme: parseColorMode(parsed.theme),
      lang: parseLang(parsed.lang)
    };
  } catch {
    return null;
  }
}

export function storePrefs(prefs: SitePrefs): void {
  if (typeof document === "undefined") return;
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota / private mode
  }
  const value = encodeURIComponent(JSON.stringify(prefs));
  document.cookie = `${PREFS_COOKIE}=${value}; path=/; max-age=31536000; SameSite=Lax`;
}

export function applyPrefsToDocument(prefs: SitePrefs): void {
  if (typeof document === "undefined") return;
  for (const el of [document.documentElement, document.body]) {
    el.dataset.archetype = prefs.archetype;
    el.dataset.theme = prefs.theme;
  }
  document.documentElement.lang = prefs.lang;
}

/** Build a path that keeps archetype + theme + lang query params. */
export function withPrefs(
  path: string,
  prefs: SitePrefs,
  extra?: Record<string, string>
): string {
  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const [pathname, existing = ""] = withoutHash.split("?");
  const params = new URLSearchParams(existing);
  params.set("archetype", prefs.archetype);
  params.set("theme", prefs.theme);
  params.set("lang", prefs.lang);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

export function prefsNeedUrlSync(search: string, prefs: SitePrefs): boolean {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return (
    params.get("archetype") !== prefs.archetype ||
    params.get("theme") !== prefs.theme ||
    params.get("lang") !== prefs.lang
  );
}
