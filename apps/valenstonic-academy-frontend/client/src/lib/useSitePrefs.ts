import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useInitialData } from "@/lib/InitialDataContext";
import { t } from "@/lib/i18n";
import {
  applyPrefsToDocument,
  prefsNeedUrlSync,
  readStoredPrefs,
  resolvePrefs,
  storePrefs,
  withPrefs,
  type ArchetypeId,
  type ColorMode,
  type LangId,
  type SitePrefs
} from "@/lib/site-prefs";

export function useSitePrefs() {
  const initial = useInitialData();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const storedRef = useRef<SitePrefs | null>(null);
  if (storedRef.current === null) {
    storedRef.current = readStoredPrefs();
  }

  const prefs = useMemo(
    () =>
      resolvePrefs({
        searchParams: params,
        stored: storedRef.current,
        initial: {
          archetype: initial.archetype,
          theme: initial.theme,
          lang: initial.lang
        }
      }),
    [params, initial.archetype, initial.theme, initial.lang]
  );

  const { archetype, theme, lang } = prefs;
  const messages = t(lang);

  useEffect(() => {
    storePrefs(prefs);
    storedRef.current = prefs;
    applyPrefsToDocument(prefs);
  }, [prefs]);

  useEffect(() => {
    if (!prefsNeedUrlSync(location.search, prefs)) return;
    const next = withPrefs(`${location.pathname}${location.search}`, prefs);
    navigate(`${next}${location.hash}`, { replace: true });
  }, [prefs, location.pathname, location.search, location.hash, navigate]);

  const href = useMemo(
    () => (path: string, extra?: Record<string, string>) => withPrefs(path, prefs, extra),
    [prefs]
  );

  const switchArchetype = (next: ArchetypeId) =>
    withPrefs(`${location.pathname}${location.search}`, { ...prefs, archetype: next });
  const switchTheme = (next: ColorMode) =>
    withPrefs(`${location.pathname}${location.search}`, { ...prefs, theme: next });
  const switchLang = (next: LangId) =>
    withPrefs(`${location.pathname}${location.search}`, { ...prefs, lang: next });

  return {
    archetype,
    theme,
    lang,
    prefs,
    messages,
    href,
    switchArchetype,
    switchTheme,
    switchLang
  };
}
