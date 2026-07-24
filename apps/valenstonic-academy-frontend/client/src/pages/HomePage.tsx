import { Award, FlaskConical, GraduationCap, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { SectionHead } from "@/components/site/SectionHead";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchCourses, type CourseSummary } from "@/lib/api";

const features = [
  {
    icon: FlaskConical,
    title: "Interactive labs",
    body: "Practice builds in 3D — ice, jigger, stir, and strain with real process rules."
  },
  {
    icon: GraduationCap,
    title: "Technique first",
    body: "Wrong order still runs, but the station tells you when the pour is compromised."
  },
  {
    icon: Award,
    title: "Measure & finish",
    body: "Two-sided jigger pours, overflow, and garnish — finish the drink cleanly."
  }
];

const categories = ["Stirred classics", "Measured pours", "Garnish & serve", "Bar tools"];

export function HomePage() {
  const [courses, setCourses] = useState<CourseSummary[]>([]);

  useEffect(() => {
    void fetchCourses().then(setCourses);
  }, []);

  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden px-[clamp(1rem,4vw,2.5rem)] py-[clamp(2rem,5vw,4rem)]">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-[8%] -top-[10%] z-0 aspect-square w-[min(58vw,640px)] rounded-[46%_54%_42%_58%/52%_38%_62%_48%] bg-palette-4 opacity-85"
          />
          <div className="relative z-10 mx-auto grid w-full max-w-[1100px] items-center gap-8 md:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="animate-rise font-script text-[clamp(2.4rem,5vw,3.4rem)] leading-none text-primary">
                Valen's Tonic
              </p>
              <h1 className="animate-rise-delay-1 mt-1 font-sans text-[clamp(2rem,4.5vw,3.35rem)] font-bold leading-[1.12] tracking-tight text-foreground">
                Cocktail &amp; Recipe Online Labs
              </h1>
              <p className="animate-rise-delay-2 mt-4 max-w-md text-[1.02rem] text-muted-foreground">
                Learn by making — interactive 3D stations where order, measure, and technique decide
                the pour.
              </p>
              <div className="animate-rise-delay-3 mt-6 flex flex-wrap gap-2.5">
                <Button asChild size="lg">
                  <a href="/practice/negroni?mode=procedural">Start Negroni lab</a>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <a href="#courses">Browse courses</a>
                </Button>
              </div>
            </div>
            <div className="animate-rise-delay-4 flex justify-center">
              <a
                href="/practice/negroni?mode=procedural"
                aria-label="Open Negroni practice lab"
                className="group relative grid aspect-square w-[min(100%,380px)] place-items-center overflow-hidden rounded-full border-8 border-primary bg-[radial-gradient(circle_at_35%_30%,var(--color-palette-3),var(--color-palette-5)_70%)] shadow-[0_0_0_14px_rgba(208,16,89,0.08)] transition-transform duration-300 hover:scale-[1.02]"
              >
                <span className="font-script px-4 text-center text-[clamp(2rem,4vw,2.8rem)] text-foreground">
                  Enter the bar
                </span>
                <span className="absolute bottom-[18%] grid size-16 place-items-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:scale-105">
                  <Play className="ml-0.5 size-5 fill-current" />
                </span>
              </a>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1100px] px-[1.25rem] py-[clamp(2rem,4vw,3.25rem)]">
          <div className="grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="border-border bg-card text-center">
                <CardHeader>
                  <div className="mx-auto mb-1 grid size-12 place-items-center rounded-full bg-primary/12 text-primary">
                    <feature.icon className="size-5" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription className="text-[0.92rem] leading-relaxed">
                    {feature.body}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section
          id="courses"
          className="mx-auto w-full max-w-[1100px] px-[1.25rem] py-[clamp(2rem,4vw,3.25rem)]"
        >
          <SectionHead
            eyebrow="Curriculum"
            title="Our expert cocktail courses"
            description="Start with Classic Cocktails Lab, then open the Negroni practice station."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.length === 0 ? (
              <Card>
                <CardHeader>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Coming soon
                  </p>
                  <CardTitle>Classic Cocktails Lab</CardTitle>
                  <CardDescription>Seed will create the first course on API boot.</CardDescription>
                </CardHeader>
              </Card>
            ) : (
              courses.map((course) => (
                <Card
                  key={course.slug}
                  className="overflow-hidden transition-colors hover:border-palette-3"
                >
                  <div
                    aria-hidden
                    className="aspect-[16/10] border-b border-border bg-gradient-to-br from-palette-3 to-palette-5"
                  />
                  <CardHeader>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {course.category}
                    </p>
                    <CardTitle>{course.name}</CardTitle>
                    <CardDescription>
                      {course.description ??
                        "Interactive practice with process and technique."}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <Button asChild variant="secondary">
                      <a href={`/courses/${course.slug}`}>Explore now</a>
                    </Button>
                  </CardFooter>
                </Card>
              ))
            )}
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1100px] px-[1.25rem] py-[clamp(2rem,4vw,3.25rem)]">
          <SectionHead eyebrow="Topics" title="Our top categories" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {categories.map((category) => (
              <div
                key={category}
                className="rounded-md border border-border bg-palette-4 px-3 py-4 text-center"
              >
                <strong className="font-sans text-[0.92rem] font-semibold text-foreground">
                  {category}
                </strong>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1100px] px-[1.25rem] py-[clamp(2rem,4vw,3.25rem)]">
          <div className="grid items-center gap-6 rounded-md border border-border bg-card p-6 md:grid-cols-2">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Practice
              </p>
              <h2 className="mt-1.5 font-sans text-[clamp(1.35rem,2.4vw,1.75rem)] font-bold tracking-tight">
                Take your skills to the next level at the bar
              </h2>
              <p className="mt-2.5 text-sm text-muted-foreground">
                Whether you are learning your first Negroni or refining technique, the lab tracks
                process from ice to peel.
              </p>
              <div className="mt-4">
                <Button asChild>
                  <a href="/practice/negroni?mode=procedural">Open the lab</a>
                </Button>
              </div>
            </div>
            <div
              aria-hidden
              className="mx-auto grid aspect-square w-[min(100%,320px)] place-items-center rounded-full border-[6px] border-primary bg-[radial-gradient(circle_at_35%_30%,var(--color-palette-3),var(--color-palette-5)_70%)]"
            >
              <span className="font-script text-[2rem] text-foreground">Negroni</span>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
