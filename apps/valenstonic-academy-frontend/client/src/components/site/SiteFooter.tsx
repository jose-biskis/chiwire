import { useSitePrefs } from "@/lib/useSitePrefs";

export function SiteFooter() {
  const { messages, href, style } = useSitePrefs();
  const copy = messages.styles[style];

  return (
    <footer className="mt-8 border-t border-border px-[clamp(1rem,4vw,2.5rem)] py-8">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <a href={href("/")} className="font-script text-[1.65rem] leading-none text-primary">
            {messages.brand}
          </a>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">{copy.lead}</p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <a href={href("/#courses")}>{messages.navCourses}</a>
          <a href="/practice/negroni?mode=procedural">{messages.navLabs}</a>
          <a href="/admin">{messages.navAdmin}</a>
        </div>
      </div>
    </footer>
  );
}