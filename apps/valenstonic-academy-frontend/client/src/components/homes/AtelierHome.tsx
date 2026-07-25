import type { CourseSummary } from "@/lib/api";
import { CoursesRail } from "@/components/site/CoursesRail";
import { useSitePrefs } from "@/lib/useSitePrefs";

export function AtelierHome(props: { courses: CourseSummary[] }) {
  const { messages, href } = useSitePrefs();
  const copy = messages.styles.atelier;

  return (
    <div className="theme-home theme-atelier">
      <div className="theme-grain" aria-hidden />

      <header className="atelier-header">
        <a className="atelier-mark" href={href("/")}>
          <span className="atelier-crest">VT</span>
          <span>
            <strong>VALEN'S TONIC</strong>
            <small>{copy.brandSub}</small>
          </span>
        </a>
        <nav>
          <a href={href("/")}>{messages.navHome}</a>
          <a href={href("/#courses")}>{messages.navCourses}</a>
          <a href="/practice/negroni?mode=procedural">{messages.navLabs}</a>
          <a href="/admin">{messages.navAdmin}</a>
        </nav>
        <a className="atelier-book" href="/practice/negroni?mode=procedural">
          {copy.featuredSub} →
        </a>
      </header>

      <section className="atelier-hero">
        <div className="atelier-copy">
          <p className="atelier-kicker">{copy.kicker}</p>
          <h1>
            {copy.title.replace(/\.$/, "")}
            <span className="atelier-dot">.</span>
          </h1>
          <p className="atelier-lead">{copy.lead}</p>
          <div className="atelier-actions">
            <a className="atelier-btn" href="/practice/negroni?mode=procedural">
              {copy.primaryCta} →
            </a>
            <a className="atelier-textlink" href={href("/#courses")}>
              {copy.secondaryCta}
            </a>
          </div>
        </div>

        <div className="atelier-visual">
          <svg className="atelier-arc" viewBox="0 0 200 200" aria-hidden>
            <defs>
              <path id="atelierCurve" d="M 20,100 A 80,80 0 0 1 180,100" fill="none" />
            </defs>
            <text>
              <textPath xlinkHref="#atelierCurve" href="#atelierCurve" startOffset="8%">
                {copy.tagline}
              </textPath>
            </text>
          </svg>
          <a className="atelier-circle" href="/practice/negroni?mode=procedural">
            <img src="/themes/hero-atelier.jpg" alt="" />
          </a>
          <div className="atelier-seal">
            <span className="atelier-seal-icon" aria-hidden>
              ⧉
            </span>
            {copy.featuredTitle}
          </div>
        </div>
      </section>

      <section className="atelier-features">
        <div className="atelier-torn" aria-hidden />
        {copy.strip.map((item, index) => (
          <article key={item}>
            <span className="atelier-feat-ico" aria-hidden>
              {["◎", "◌", "◍", "◐"][index] ?? "○"}
            </span>
            <h3>{item}</h3>
          </article>
        ))}
      </section>

      <CoursesRail courses={props.courses} />
    </div>
  );
}
