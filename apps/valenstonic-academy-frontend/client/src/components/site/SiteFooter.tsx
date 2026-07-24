export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-border bg-palette-4 px-[clamp(1rem,4vw,2.5rem)] pb-6 pt-9">
      <div className="mx-auto grid w-full max-w-[1100px] gap-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <a href="/" className="font-script text-[1.65rem] leading-none text-primary">
            Valen's Tonic
          </a>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Interactive cocktail labs where process, measure, and technique matter.
          </p>
        </div>
        <div>
          <h3 className="mb-3 font-sans text-[0.95rem] font-semibold text-foreground">Academy</h3>
          <a href="/" className="mb-1.5 block text-sm text-muted-foreground hover:text-foreground">
            Courses
          </a>
          <a
            href="/practice/negroni?mode=procedural"
            className="mb-1.5 block text-sm text-muted-foreground hover:text-foreground"
          >
            Negroni lab
          </a>
          <a href="/admin" className="mb-1.5 block text-sm text-muted-foreground hover:text-foreground">
            Admin
          </a>
        </div>
        <div>
          <h3 className="mb-3 font-sans text-[0.95rem] font-semibold text-foreground">Practice</h3>
          <a
            href="/practice/negroni?mode=procedural"
            className="mb-1.5 block text-sm text-muted-foreground hover:text-foreground"
          >
            Procedural mode
          </a>
          <a
            href="/practice/negroni?mode=glb"
            className="mb-1.5 block text-sm text-muted-foreground hover:text-foreground"
          >
            GLB mode
          </a>
          <a
            href="/practice/negroni?debug=1"
            className="mb-1.5 block text-sm text-muted-foreground hover:text-foreground"
          >
            Debug collisions
          </a>
        </div>
      </div>
      <p className="mx-auto mt-6 w-full max-w-[1100px] border-t border-border pt-4 text-[0.82rem] text-muted-foreground">
        Valenstonic Academy · Valen's Tonic
      </p>
    </footer>
  );
}
