import { Button } from "@chiwire/ui/valenstonic";
import { useSitePrefs } from "@/lib/useSitePrefs";

export function SiteHeader(props?: { bookLabel?: string }) {
  const { messages, href } = useSitePrefs();
  const book = props?.bookLabel ?? messages.home.featuredSub;

  const links = [
    { href: href("/"), label: messages.navHome },
    { href: href("/#courses"), label: messages.navCourses },
    { href: href("/practice/negroni?mode=procedural"), label: messages.navLabs },
    { href: href("/admin"), label: messages.navAdmin }
  ];

  return (
    <header className="atelier-header">
      <a className="atelier-mark" href={href("/")}>
        <span className="atelier-crest">VT</span>
        <span>
          <strong>VALEN&apos;S TONIC</strong>
          <small>{messages.home.brandSub}</small>
        </span>
      </a>
      <nav aria-label="Primary">
        {links.map((link) => (
          <a key={link.label} href={link.href}>
            {link.label}
          </a>
        ))}
      </nav>
      <Button asChild size="sm" className="uppercase tracking-[0.1em]">
        <a href={href("/practice/negroni?mode=procedural")}>
          {book} →
        </a>
      </Button>
    </header>
  );
}
