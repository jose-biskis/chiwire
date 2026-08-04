import { Badge, Button, Separator } from "@chiwire/ui/internal";
import { Chibi } from "./chibi";
import { about, site, traits } from "./content";

export function App() {
  return (
    <div className="relative z-0 min-h-screen bg-background text-foreground">
      <header className="me-fade mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <a
          href="#top"
          className="text-sm font-semibold tracking-tight text-foreground no-underline"
        >
          {site.name}
        </a>
        <nav className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <a href="#about">About</a>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href="#contact">Contact</a>
          </Button>
        </nav>
      </header>

      <main id="top">
        <section className="relative mx-auto flex min-h-[calc(100vh-4.5rem)] w-full max-w-5xl flex-col items-center justify-center px-6 pb-16 pt-10 text-center">
          <div
            className="me-hero-title me-rise"
            style={{ animationDelay: "0.08s" }}
          >
            <h1>
              <span className="me-line me-line-jose">
                Jos
                <span className="me-letter-seat">
                  e
                  <span className="me-hero-chibi" aria-hidden="true">
                    <Chibi pose="sitting" className="w-full" />
                  </span>
                </span>
              </span>
              <span className="me-line">
                Biskis<span className="me-dot">.</span>
              </span>
            </h1>
          </div>

          <p
            className="me-rise mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
            style={{ animationDelay: "0.22s" }}
          >
            {site.tagline}
          </p>

          <div
            className="me-rise mt-9 flex flex-wrap items-center justify-center gap-3"
            style={{ animationDelay: "0.36s" }}
          >
            <Button asChild size="lg">
              <a href="#about">Who I am</a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="#contact">Say hello</a>
            </Button>
          </div>
        </section>

        <Separator className="mx-auto max-w-5xl" />

        <section
          id="about"
          className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-20 md:grid-cols-[0.9fr_1.1fr] md:items-center"
        >
          <div className="flex justify-center md:justify-start">
            <Chibi
              pose="standing"
              alt="Chibi illustration of Jose Biskis"
              className="w-[min(60vw,260px)]"
            />
          </div>
          <div className="space-y-5 text-left">
            <Badge variant="secondary">About</Badge>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              A person who makes things on purpose.
            </h2>
            <p className="text-lg leading-relaxed text-muted-foreground">
              {about.lead}
            </p>
            <p className="leading-relaxed text-muted-foreground">{about.body}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {traits.map((trait) => (
                <Badge key={trait} variant="outline">
                  {trait}
                </Badge>
              ))}
            </div>
          </div>
        </section>

        <section
          id="contact"
          className="mx-auto w-full max-w-5xl overflow-visible px-6 pb-24 pt-4"
        >
          <div className="me-contact rounded-xl bg-primary px-6 py-12 text-primary-foreground sm:px-10">
            <div className="me-contact-bite" aria-hidden="true">
              <Chibi pose="pointing" />
            </div>
            <div className="me-contact-copy space-y-4">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Say hello.
              </h2>
              <p className="text-base leading-relaxed text-primary-foreground/80">
                Want to talk, collaborate, or just wave at the chibi? Reach out
                anytime.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button asChild size="lg" variant="secondary">
                  <a href={`mailto:${site.email}`}>{site.email}</a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-5xl flex-col gap-2 border-t border-border px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {site.name}
        </p>
        <p className="text-foreground/70">{site.domain}</p>
      </footer>
    </div>
  );
}
