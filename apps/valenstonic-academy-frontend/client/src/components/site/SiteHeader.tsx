import { Button } from "@/components/ui/button";
import { useSitePrefs } from "@/lib/useSitePrefs";

export function SiteHeader() {
  const { messages, href } = useSitePrefs();

  const links = [
    { href: href("/"), label: messages.navHome },
    { href: href("/#courses"), label: messages.navCourses },
    { href: "/practice/negroni?mode=procedural", label: messages.navLabs },
    { href: "/admin", label: messages.navAdmin }
  ];

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-border bg-background/90 px-[clamp(1rem,4vw,2.5rem)] py-3.5 backdrop-blur-md">
      <a href={href("/")} className="font-script text-[1.65rem] leading-none text-primary">
        {messages.brand}
      </a>
      <nav className="hidden items-center justify-center gap-5 md:flex" aria-label="Primary">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="text-[0.92rem] font-medium text-muted-foreground hover:text-foreground"
          >
            {link.label}
          </a>
        ))}
      </nav>
      <div className="flex items-center gap-3">
        <a
          href="/admin/login"
          className="text-[0.9rem] font-medium text-muted-foreground hover:text-foreground"
        >
          {messages.login}
        </a>
        <Button asChild size="sm">
          <a href="/practice/negroni?mode=procedural">{messages.getStarted}</a>
        </Button>
      </div>
    </header>
  );
}
