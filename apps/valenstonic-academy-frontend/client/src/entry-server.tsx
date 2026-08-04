import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import { App } from "@/App";
import { t } from "@/lib/i18n";
import { InitialDataProvider } from "@/lib/InitialDataContext";
import { parsePrefsFromSearch } from "@/lib/site-prefs";
import type { SsrData } from "@/lib/ssr-data";

export type RenderResult = {
  html: string;
  title: string;
  description: string;
  archetype: string;
  theme: string;
  lang: string;
};

export function render(url: string, data: SsrData = {}): RenderResult {
  const parsed = new URL(url, "http://localhost");
  const prefs = parsePrefsFromSearch(parsed.search);
  const archetype = data.archetype ?? prefs.archetype;
  const theme = data.theme ?? prefs.theme;
  const lang = data.lang ?? prefs.lang;
  const messages = t(lang);
  const ssrData: SsrData = { ...data, archetype, theme, lang };
  const location = `${parsed.pathname}${parsed.search}`;

  const html = renderToString(
    <InitialDataProvider value={ssrData}>
      <StaticRouter location={location}>
        <App />
      </StaticRouter>
    </InitialDataProvider>
  );

  let title = "Valen's Tonic";
  let description = messages.homeDescription;

  if (parsed.pathname === "/") {
    title = messages.homeTitle;
  } else if (ssrData.courseMissing) {
    title = messages.notFoundTitle;
    description = messages.notFoundDescription;
  } else if (ssrData.course) {
    title = `${ssrData.course.course.name} · Valen's Tonic`;
    description =
      ssrData.course.course.description?.trim() || messages.courseFallbackDesc;
  }

  return { html, title, description, archetype, theme, lang };
}
