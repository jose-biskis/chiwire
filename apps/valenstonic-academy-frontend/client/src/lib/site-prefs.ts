export const STYLE_IDS = [
  "original",
  "noir",
  "atelier",
  "brutalist",
  "deco",
  "botanical"
] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export const LANG_IDS = ["en", "es"] as const;
export type LangId = (typeof LANG_IDS)[number];

export const STYLE_META: Record<
  StyleId,
  { labelEn: string; labelEs: string }
> = {
  original: { labelEn: "Original", labelEs: "Original" },
  noir: { labelEn: "Speakeasy noir", labelEs: "Speakeasy noir" },
  atelier: { labelEn: "Daylight atelier", labelEs: "Atelier diurno" },
  brutalist: { labelEn: "Brutalist industrial", labelEs: "Brutalista industrial" },
  deco: { labelEn: "Art deco salon", labelEs: "Salón art déco" },
  botanical: { labelEn: "Botanical garden", labelEs: "Jardín botánico" }
};

export function parseStyle(value: string | null | undefined): StyleId {
  if (value && (STYLE_IDS as readonly string[]).includes(value)) {
    return value as StyleId;
  }
  return "noir";
}

export function parseLang(value: string | null | undefined): LangId {
  if (value && (LANG_IDS as readonly string[]).includes(value)) {
    return value as LangId;
  }
  return "en";
}

export function parsePrefsFromSearch(search: string): { style: StyleId; lang: LangId } {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return {
    style: parseStyle(params.get("style")),
    lang: parseLang(params.get("lang"))
  };
}

/** Build a path that keeps style + lang query params. */
export function withPrefs(
  path: string,
  prefs: { style: StyleId; lang: LangId },
  extra?: Record<string, string>
): string {
  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const [pathname, existing = ""] = withoutHash.split("?");
  const params = new URLSearchParams(existing);
  params.set("style", prefs.style);
  params.set("lang", prefs.lang);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}
