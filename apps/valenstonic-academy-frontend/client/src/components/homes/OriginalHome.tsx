import { Award, FlaskConical, GraduationCap, Play } from "lucide-react";
import type { CourseSummary } from "@/lib/api";
import { CoursesRail } from "@/components/site/CoursesRail";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSitePrefs } from "@/lib/useSitePrefs";

const featureIcons = [FlaskConical, GraduationCap, Award];

export function OriginalHome(props: { courses: CourseSummary[] }) {
  const { messages, href } = useSitePrefs();
  const copy = messages.styles.original;
  const features = copy.features ?? [];
  const categories = copy.categories ?? [];

  return (
    <div className="theme-home theme-original">
      <SiteHeader />
      <main>
        <section className="original-hero">
          <div className="original-blob" aria-hidden />
          <div className="original-hero-inner">
            <div>
              <p className="original-script">{copy.kicker}</p>
              <h1>{copy.title}</h1>
              <p className="original-lead">{copy.lead}</p>
              <div className="original-actions">
                <Button asChild size="lg">
                  <a href="/practice/negroni?mode=procedural">{copy.primaryCta}</a>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <a href={href("/#courses")}>{copy.secondaryCta}</a>
                </Button>
              </div>
            </div>
            <div className="original-visual">
              <a
                className="original-circle"
                href="/practice/negroni?mode=procedural"
                aria-label={copy.primaryCta}
              >
                <span>{copy.enterBar ?? copy.tagline}</span>
                <div className="original-play">
                  <Play className="ml-0.5 size-5 fill-current" />
                </div>
              </a>
            </div>
          </div>
        </section>

        <section className="original-section">
          <div className="original-features">
            {features.map((feature, index) => {
              const Icon = featureIcons[index] ?? FlaskConical;
              return (
                <Card key={feature.title} className="border-border bg-card text-center">
                  <CardHeader>
                    <div className="original-feat-icon">
                      <Icon className="size-5" />
                    </div>
                    <CardTitle>{feature.title}</CardTitle>
                    <CardDescription className="text-[0.92rem] leading-relaxed">
                      {feature.body}
                    </CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </section>

        <CoursesRail courses={props.courses} />

        <section className="original-section">
          <div className="original-section-head">
            <p className="vt-eyebrow">{copy.topicsEyebrow}</p>
            <h2 className="vt-section-title">{copy.topicsTitle}</h2>
          </div>
          <div className="original-categories">
            {categories.map((category) => (
              <div key={category} className="original-category">
                <strong>{category}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="original-section">
          <div className="original-promo">
            <div>
              <p className="vt-eyebrow">{copy.practiceEyebrow}</p>
              <h2 className="vt-section-title">{copy.practiceTitle}</h2>
              <p className="original-promo-lead">{copy.practiceBody}</p>
              <div className="mt-4">
                <Button asChild>
                  <a href="/practice/negroni?mode=procedural">{copy.openLab}</a>
                </Button>
              </div>
            </div>
            <div className="original-promo-circle" aria-hidden>
              <span>{copy.featuredTitle}</span>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
