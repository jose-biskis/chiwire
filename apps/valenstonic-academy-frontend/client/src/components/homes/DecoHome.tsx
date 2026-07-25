import type { CourseSummary } from "@/lib/api";
import { CoursesRail } from "@/components/site/CoursesRail";
import { useSitePrefs } from "@/lib/useSitePrefs";

export function DecoHome(props: { courses: CourseSummary[] }) {
  const { messages, href } = useSitePrefs();
  const copy = messages.styles.deco;

  return (
    <div className="theme-home theme-deco">
      <div className="theme-grain" aria-hidden />
      <div className="deco-glow" aria-hidden />

      <header className="deco-header">
        <nav>
          <a href={href("/")}>{messages.navHome}</a>
          <a href={href("/#courses")}>{messages.navCourses}</a>
          <a href="/practice/negroni?mode=procedural">{messages.navLabs}</a>
        </nav>
        <a className="deco-brand" href={href("/")}>
          <span className="deco-script">{messages.brand}</span>
          <span className="deco-sub">{copy.brandSub}</span>
        </a>
        <nav>
          <a href="/admin">{messages.navAdmin}</a>
          <a href="/admin/login">{messages.login}</a>
          <span className="deco-mono">VT</span>
        </nav>
      </header>

      <section className="deco-hero">
        <div className="deco-copy">
          <div className="deco-ornament" aria-hidden>
            ◆
          </div>
          <h1>{copy.title}</h1>
          <p className="deco-kicker">{copy.kicker}</p>
          <p className="deco-lead">{copy.lead}</p>
          <div className="deco-actions">
            <a href="/practice/negroni?mode=procedural">◆ {copy.primaryCta}</a>
            <a href={href("/#courses")}>◆ {copy.secondaryCta}</a>
          </div>
        </div>

        <div className="deco-medallion">
          <div className="deco-burst" aria-hidden />
          <div className="deco-ring">
            <img src="/themes/hero-deco.jpg" alt="" />
          </div>
        </div>
      </section>

      <section className="deco-features">
        {copy.strip.map((item) => (
          <article key={item}>
            <span className="deco-feat-ico" aria-hidden>
              ❖
            </span>
            <h3>{item}</h3>
          </article>
        ))}
      </section>

      <CoursesRail courses={props.courses} />
    </div>
  );
}
