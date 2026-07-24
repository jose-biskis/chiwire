import { Button } from "@/components/ui/button";

const links = [
  { href: "/", label: "Home" },
  { href: "/#courses", label: "Courses" },
  { href: "/practice/negroni?mode=procedural", label: "Labs" },
  { href: "/admin", label: "Admin" }
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-border bg-background/90 px-[clamp(1rem,4vw,2.5rem)] py-3.5 backdrop-blur-md">
      <a href="/" className="font-script text-[1.65rem] leading-none text-primary hover:text-palette-2">
        Valen's Tonic
      </a>
      <nav className="hidden items-center justify-center gap-5 md:flex" aria-label="Primary">
        {links.map((link) => (
          <a
            key={link.href}
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
          Login
        </a>
        <Button asChild size="sm">
          <a href="/practice/negroni?mode=procedural">Get Started</a>
        </Button>
      </div>
    </header>
  );
}
