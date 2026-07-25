import type { CourseSummary } from "@/lib/api";
import { CoursesRail } from "@/components/site/CoursesRail";
import { useSitePrefs } from "@/lib/useSitePrefs";

export function BrutalistHome(props: { courses: CourseSummary[] }) {
  const { messages, href } = useSitePrefs();
  const copy = messages.styles.brutalist;

  return (
    <div className="theme-home theme-brutalist">
      <div className="theme-grain" aria-hidden />
      <div className="brut-shell">
        <header className="brut-header">
          <strong>VALEN'S TONIC</strong>
          <nav>
            <a href={href("/")}>{messages.navHome}</a>
            <a href={href("/#courses")}>{messages.navCourses}</a>
            <a href="/practice/negroni?mode=procedural">{messages.navLabs}</a>
            <a href="/admin">{messages.navAdmin}</a>
          </nav>
          <a className="brut-cta" href="/practice/negroni?mode=procedural">
            {copy.primaryCta} →
          </a>
        </header>

        <section className="brut-hero">
          <div className="brut-title-cell">
            <h1>
              COCKTAIL
              <br />
              LABS
            </h1>
            <span className="brut-stamp">VALEN'S TONIC</span>
          </div>
          <div className="brut-mid">
            <div className="brut-crosshair" aria-hidden>
              +
            </div>
            <p className="brut-kicker">{copy.kicker}</p>
            <svg className="brut-schematic" viewBox="0 0 160 200" aria-hidden>
              <rect x="55" y="16" width="50" height="36" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <path
                d="M55 52 L38 168 H122 L105 52"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              />
              <line x1="16" y1="88" x2="144" y2="88" stroke="#d01059" strokeWidth="2" />
              <line x1="16" y1="128" x2="144" y2="128" stroke="#d01059" strokeWidth="2" />
              <text x="4" y="92" fontSize="11" fill="currentColor">
                45
              </text>
              <text x="4" y="132" fontSize="11" fill="currentColor">
                30
              </text>
              <text x="4" y="172" fontSize="11" fill="currentColor">
                110
              </text>
            </svg>
          </div>
          <a className="brut-photo" href="/practice/negroni?mode=procedural">
            <img src="/themes/hero-brutalist.jpg" alt="" />
            <span className="brut-star">✱</span>
          </a>
        </section>

        <section className="brut-band">
          <p>{copy.lead}</p>
          <a href="/practice/negroni?mode=procedural">
            {copy.featuredLabel}: {copy.featuredTitle} →
          </a>
        </section>

        <section className="brut-footer-grid">
          {copy.strip.map((item) => (
            <div key={item}>{item}</div>
          ))}
        </section>
      </div>

      <CoursesRail courses={props.courses} />
    </div>
  );
}
