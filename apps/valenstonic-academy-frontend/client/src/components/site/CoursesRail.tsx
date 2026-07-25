import type { CourseSummary } from "@/lib/api";
import { useSitePrefs } from "@/lib/useSitePrefs";

const HERO: Record<string, string> = {
  original: "/themes/hero-noir.jpg",
  noir: "/themes/hero-noir.jpg",
  atelier: "/themes/hero-atelier.jpg",
  brutalist: "/themes/hero-brutalist.jpg",
  deco: "/themes/hero-deco.jpg",
  botanical: "/themes/hero-botanical.jpg"
};

export function CoursesRail(props: { courses: CourseSummary[] }) {
  const { messages, href, style } = useSitePrefs();
  const media = HERO[style] ?? HERO.original;
  const copy = messages.styles[style];
  const curriculumTitle = copy.curriculumTitle ?? messages.curriculumTitle;
  const curriculumDesc = copy.curriculumDesc ?? messages.curriculumDesc;

  return (
    <section id="courses" className="vt-courses">
      <div className="vt-courses-inner">
        <p className="vt-eyebrow">{messages.curriculumEyebrow}</p>
        <h2 className="vt-section-title">{curriculumTitle}</h2>
        <p className="vt-section-lead">{curriculumDesc}</p>
        <div className="vt-course-grid">
          {props.courses.length === 0 ? (
            <article className="vt-course-card">
              <div className="vt-course-media" style={{ backgroundImage: `url(${media})` }} />
              <div className="vt-course-body">
                <p className="vt-eyebrow">{messages.comingSoon}</p>
                <h3>Classic Cocktails Lab</h3>
                <p>{messages.courseFallbackDesc}</p>
              </div>
            </article>
          ) : (
            props.courses.map((course) => (
              <article key={course.slug} className="vt-course-card">
                <div
                  className="vt-course-media"
                  style={{ backgroundImage: `url(${media})` }}
                  aria-hidden
                />
                <div className="vt-course-body">
                  <p className="vt-eyebrow">{course.category}</p>
                  <h3>{course.name}</h3>
                  <p>{course.description ?? messages.courseFallbackDesc}</p>
                  <a className="vt-course-cta" href={href(`/courses/${course.slug}`)}>
                    {messages.exploreNow}
                  </a>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
