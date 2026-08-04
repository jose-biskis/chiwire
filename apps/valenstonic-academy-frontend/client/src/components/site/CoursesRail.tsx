import { Button, Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@chiwire/ui/valenstonic";
import type { CourseSummary } from "@/lib/api";
import { useSitePrefs } from "@/lib/useSitePrefs";

const HERO = "/themes/hero-atelier.jpg";

export function CoursesRail(props: { courses: CourseSummary[] }) {
  const { messages, href } = useSitePrefs();

  return (
    <section id="courses" className="vt-courses">
      <div className="vt-courses-inner">
        <p className="vt-eyebrow">{messages.curriculumEyebrow}</p>
        <h2 className="vt-section-title">{messages.curriculumTitle}</h2>
        <p className="vt-section-lead">{messages.curriculumDesc}</p>
        <div className="vt-course-grid">
          {props.courses.length === 0 ? (
            <Card className="overflow-hidden border-border bg-card">
              <div
                className="aspect-[16/10] border-b border-border bg-cover bg-center"
                style={{ backgroundImage: `url(${HERO})` }}
                aria-hidden
              />
              <CardHeader>
                <p className="vt-eyebrow">{messages.comingSoon}</p>
                <CardTitle>Classic Cocktails Lab</CardTitle>
                <CardDescription>{messages.courseFallbackDesc}</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            props.courses.map((course) => (
              <Card key={course.slug} className="overflow-hidden border-border bg-card">
                <div
                  className="aspect-[16/10] border-b border-border bg-cover bg-center saturate-[0.85]"
                  style={{ backgroundImage: `url(${HERO})` }}
                  aria-hidden
                />
                <CardHeader>
                  <p className="vt-eyebrow">{course.category}</p>
                  <CardTitle>{course.name}</CardTitle>
                  <CardDescription>{course.description ?? messages.courseFallbackDesc}</CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button asChild variant="secondary" size="sm" className="uppercase tracking-[0.08em]">
                    <a href={href(`/courses/${course.slug}`)}>{messages.exploreNow}</a>
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
