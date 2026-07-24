import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import { App } from "@/App";
import { InitialDataProvider } from "@/lib/InitialDataContext";
import type { SsrData } from "@/lib/ssr-data";

export type RenderResult = {
  html: string;
  title: string;
  description: string;
};

export function render(url: string, data: SsrData = {}): RenderResult {
  const html = renderToString(
    <InitialDataProvider value={data}>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </InitialDataProvider>
  );

  let title = "Valen's Tonic";
  let description =
    "Interactive cocktail labs where order, measure, and technique decide the pour.";

  if (url === "/" || url.startsWith("/?")) {
    title = "Home · Valen's Tonic";
  } else if (data.courseMissing) {
    title = "Course not found · Valen's Tonic";
    description = "That course could not be found.";
  } else if (data.course) {
    title = `${data.course.course.name} · Valen's Tonic`;
    description =
      data.course.course.description?.trim() ||
      "Interactive practice with process and technique.";
  }

  return { html, title, description };
}
