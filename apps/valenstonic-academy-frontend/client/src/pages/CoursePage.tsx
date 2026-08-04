import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@chiwire/ui/valenstonic";
import { PrefsBar } from "@/components/site/PrefsBar";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { fetchCourse, type CourseDetail } from "@/lib/api";
import { useInitialData } from "@/lib/InitialDataContext";
import { useSitePrefs } from "@/lib/useSitePrefs";

export function CoursePage() {
  const { slug = "" } = useParams();
  const initial = useInitialData();
  const { messages, href } = useSitePrefs();
  const ssrMatches = Boolean(initial.courseSlug && initial.courseSlug === slug);
  const [data, setData] = useState<CourseDetail | null>(ssrMatches ? (initial.course ?? null) : null);
  const [missing, setMissing] = useState(ssrMatches ? Boolean(initial.courseMissing) : false);

  useEffect(() => {
    if (!slug) return;
    if (ssrMatches) return;
    void fetchCourse(slug).then((result) => {
      if (!result) {
        setMissing(true);
        return;
      }
      setData(result);
    });
  }, [slug, ssrMatches]);

  return (
    <div className="theme-home theme-atelier">
      <div className="theme-grain" aria-hidden />
      <PrefsBar />
      <SiteHeader />
      <main className="relative z-[1] mx-auto w-full max-w-[1100px] px-[1.25rem] py-10">
        {missing ? (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="uppercase tracking-tight">{messages.courseNotFound}</CardTitle>
              <CardDescription>
                <a href={href("/")}>{messages.backHome}</a>
              </CardDescription>
            </CardHeader>
          </Card>
        ) : !data ? (
          <p className="text-muted-foreground">{messages.loading}</p>
        ) : (
          <>
            <p className="vt-eyebrow">{data.course.category}</p>
            <h1 className="mt-2 font-sans text-[clamp(1.75rem,3.5vw,2.6rem)] font-extrabold uppercase tracking-[-0.03em]">
              {data.course.name}
            </h1>
            <p className="font-editorial mt-3 max-w-2xl text-lg text-muted-foreground">
              {data.course.description}
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {data.lessons.map((lesson) =>
                lesson.kind === "interactive" && lesson.scene_slug ? (
                  <Card key={lesson.lesson_order} className="overflow-hidden border-border">
                    <div
                      aria-hidden
                      className="aspect-[16/10] border-b border-border bg-cover bg-center"
                      style={{ backgroundImage: "url(/themes/hero-atelier.jpg)" }}
                    />
                    <CardHeader>
                      <p className="vt-eyebrow">
                        Lesson {lesson.lesson_order} · {messages.lessonInteractive}
                      </p>
                      <CardTitle>{lesson.title}</CardTitle>
                      <CardDescription>{messages.lessonInteractiveDesc}</CardDescription>
                    </CardHeader>
                    <CardFooter className="flex flex-wrap gap-2">
                      <Button asChild className="uppercase tracking-[0.08em]">
                        <a href={href(`/practice/${lesson.scene_slug}?mode=procedural`)}>
                          {messages.startPractice}
                        </a>
                      </Button>
                      <Button asChild variant="secondary" className="uppercase tracking-[0.08em]">
                        <a href={href(`/practice/${lesson.scene_slug}?mode=glb`)}>{messages.glbMode}</a>
                      </Button>
                    </CardFooter>
                  </Card>
                ) : (
                  <Card key={lesson.lesson_order} className="border-border">
                    <CardHeader>
                      <p className="vt-eyebrow">
                        Lesson {lesson.lesson_order} · {messages.lessonReading}
                      </p>
                      <CardTitle className="text-base">{lesson.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{lesson.body}</p>
                    </CardContent>
                  </Card>
                )
              )}
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
