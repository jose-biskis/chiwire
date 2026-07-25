import type { CourseSummary } from "@/lib/api";
import { CoursesRail } from "@/components/site/CoursesRail";
import { useSitePrefs } from "@/lib/useSitePrefs";

export function NoirHome(props: { courses: CourseSummary[] }) {
  const { messages, href } = useSitePrefs();
  const copy = messages.styles.noir;

  return (
    <div className="theme-home theme-noir">
      <div className="theme-grain" aria-hidden />

      <header className="noir-header">
        <a className="noir-mark" href={href("/")}>
          <span className="noir-crest">VT</span>
          <span>
            <strong>{messages.brand}</strong>
            <small>{copy.brandSub}</small>
          </span>
        </a>
        <nav>
          <a href={href("/")}>{messages.navHome}</a>
          <a href={href("/#courses")}>{messages.navCourses}</a>
          <a href="/practice/negroni?mode=procedural">{messages.navLabs}</a>
          <a href="/admin">{messages.navAdmin}</a>
        </nav>
        <p className="noir-tag">{copy.tagline}</p>
      </header>

      <section className="noir-hero">
        <div className="noir-copy">
          <p className="noir-script">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <div className="noir-rule" />
          <p className="noir-lead">{copy.lead}</p>
          <div className="noir-actions">
            <a className="noir-btn" href="/practice/negroni?mode=procedural">
              {copy.primaryCta}
            </a>
            <a className="noir-link" href={href("/#courses")}>
              {copy.secondaryCta}
            </a>
          </div>
        </div>

        <div className="noir-visual">
          <a className="noir-porthole" href="/practice/negroni?mode=procedural" aria-label={copy.primaryCta}>
            <span className="noir-rivets" aria-hidden>
              {Array.from({ length: 12 }, (_, i) => (
                <i key={i} style={{ ["--i" as string]: i }} />
              ))}
            </span>
            <span className="noir-porthole-inner">
              <img src="/themes/hero-noir.jpg" alt="" />
            </span>
          </a>
          <aside className="noir-badge">
            <span>{copy.featuredLabel}</span>
            <strong>{copy.featuredTitle}</strong>
            <em>{copy.featuredSub}</em>
          </aside>
        </div>
      </section>

      <div className="noir-strip">
        <span>{copy.strip[0]}</span>
        <span className="noir-glass" aria-hidden>
          ♢
        </span>
        <span>{copy.strip[1]}</span>
        <span className="noir-glass" aria-hidden>
          ♢
        </span>
        <span>{copy.strip[2]}</span>
        <span className="noir-glass" aria-hidden>
          ♢
        </span>
        <span>{copy.strip[3]}</span>
      </div>

      <CoursesRail courses={props.courses} />
    </div>
  );
}
