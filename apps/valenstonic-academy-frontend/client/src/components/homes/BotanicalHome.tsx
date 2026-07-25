import type { CourseSummary } from "@/lib/api";
import { CoursesRail } from "@/components/site/CoursesRail";
import { useSitePrefs } from "@/lib/useSitePrefs";

export function BotanicalHome(props: { courses: CourseSummary[] }) {
  const { messages, href } = useSitePrefs();
  const copy = messages.styles.botanical;

  return (
    <div className="theme-home theme-botanical">
      <div className="theme-grain" aria-hidden />

      <header className="bot-header">
        <a className="bot-brand" href={href("/")}>
          <span className="bot-script">{messages.brand}</span>
          <small>{copy.brandSub}</small>
        </a>
        <nav>
          <a href={href("/")}>{messages.navHome}</a>
          <a href={href("/#courses")}>{messages.navCourses}</a>
          <a href="/practice/negroni?mode=procedural">{messages.navLabs}</a>
          <a href="/admin">{messages.navAdmin}</a>
        </nav>
        <a className="bot-join" href="/practice/negroni?mode=procedural">
          {copy.featuredTitle}
        </a>
      </header>

      <section className="bot-hero">
        <div className="bot-copy">
          <div className="bot-divider" aria-hidden>
            <i />
            <span>❧</span>
            <i />
          </div>
          <h1>{copy.title}</h1>
          <p>{copy.lead}</p>
          <div className="bot-actions">
            <a className="bot-btn" href="/practice/negroni?mode=procedural">
              {copy.primaryCta}
            </a>
            <a className="bot-ghost" href={href("/#courses")}>
              {copy.secondaryCta} →
            </a>
          </div>
        </div>

        <div className="bot-visual">
          <div className="bot-blob" aria-hidden />
          <svg className="bot-sprig bot-sprig-a" viewBox="0 0 40 80" aria-hidden>
            <path d="M20 75 C18 50, 10 35, 8 12" fill="none" stroke="#5c6b4a" strokeWidth="1.4" />
            <ellipse cx="14" cy="28" rx="7" ry="3.5" transform="rotate(-35 14 28)" fill="none" stroke="#5c6b4a" />
            <ellipse cx="22" cy="40" rx="7" ry="3.5" transform="rotate(30 22 40)" fill="none" stroke="#5c6b4a" />
            <ellipse cx="12" cy="52" rx="6" ry="3" transform="rotate(-25 12 52)" fill="none" stroke="#5c6b4a" />
          </svg>
          <svg className="bot-lemon" viewBox="0 0 140 100" aria-hidden>
            <ellipse cx="52" cy="52" rx="30" ry="24" fill="none" stroke="#5c6b4a" strokeWidth="1.6" />
            <path d="M78 42 C108 18, 128 58, 96 78" fill="none" stroke="#5c6b4a" strokeWidth="1.6" />
            <path d="M108 16 C116 30, 104 44, 94 38" fill="none" stroke="#5c6b4a" strokeWidth="1.3" />
            <circle cx="44" cy="48" r="1.2" fill="#5c6b4a" />
            <circle cx="58" cy="56" r="1.2" fill="#5c6b4a" />
          </svg>
          <a className="bot-circle" href="/practice/negroni?mode=procedural">
            <img src="/themes/hero-botanical.jpg" alt="" />
          </a>
        </div>
      </section>

      <section className="bot-band">
        {copy.strip.map((item, index) => (
          <article key={item}>
            <span aria-hidden>{["❀", "☘", "✦", "❧"][index] ?? "•"}</span>
            <h3>{item}</h3>
          </article>
        ))}
      </section>

      <CoursesRail courses={props.courses} />
    </div>
  );
}
