import { useEffect, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useInitialData } from "@/lib/InitialDataContext";
import { t } from "@/lib/i18n";
import {
  parseLang,
  parseStyle,
  withPrefs,
  type LangId,
  type StyleId
} from "@/lib/site-prefs";

export function useSitePrefs() {
  const initial = useInitialData();
  const [params] = useSearchParams();
  const location = useLocation();

  const style = parseStyle(params.get("style") ?? initial.style);
  const lang = parseLang(params.get("lang") ?? initial.lang);
  const messages = t(lang);

  useEffect(() => {
    document.documentElement.dataset.theme = style;
    document.documentElement.lang = lang;
    document.body.dataset.theme = style;
  }, [style, lang]);

  const href = useMemo(
    () => (path: string, extra?: Record<string, string>) => withPrefs(path, { style, lang }, extra),
    [style, lang]
  );

  const switchStyle = (next: StyleId) => withPrefs(location.pathname, { style: next, lang });
  const switchLang = (next: LangId) => withPrefs(location.pathname, { style, lang: next });

  return { style, lang, messages, href, switchStyle, switchLang };
}
