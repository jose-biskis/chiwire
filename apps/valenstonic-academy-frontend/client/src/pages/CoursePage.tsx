import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchCourse, type CourseDetail } from "@/lib/api";

export function CoursePage() {
  const { slug = "" } = useParams();
  const [data, setData] = useState<CourseDetail | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!slug) return;
    void fetchCourse(slug).then((result) => {
      if (!result) {
        setMissing(true);
        return;
      }
      setData(result);
    });
  }, [slug]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1100px] px-[1.25rem] py-10">
        {missing ? (
          <Card>
            <CardHeader>
              <CardTitle>Course not found</CardTitle>
              <CardDescription>
                <a href="/">Back to home</a>
              </CardDescription>
            </CardHeader>
          </Card>
        ) : !data ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {data.course.category}
            </p>
            <h1 className="mt-2 font-sans text-[clamp(1.6rem,3vw,2.2rem)] font-bold tracking-tight">
              {data.course.name}
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">{data.course.description}</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {data.lessons.map((lesson) =>
                lesson.kind === "interactive" && lesson.scene_slug ? (
                  <Card key={lesson.lesson_order} className="overflow-hidden">
                    <div
                      aria-hidden
                      className="aspect-[16/10] border-b border-border bg-gradient-to-br from-palette-3 to-palette-5"
                    />
                    <CardHeader>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Lesson {lesson.lesson_order} · Interactive
                      </p>
                      <CardTitle>{lesson.title}</CardTitle>
                      <CardDescription>Hands-on 3D practice for this recipe.</CardDescription>
                    </CardHeader>
                    <CardFooter className="flex flex-wrap gap-2">
                      <Button asChild>
                        <a href={`/practice/${lesson.scene_slug}?mode=procedural`}>Start practice</a>
                      </Button>
                      <Button asChild variant="secondary">
                        <a href={`/practice/${lesson.scene_slug}?mode=glb`}>GLB mode</a>
                      </Button>
                    </CardFooter>
                  </Card>
                ) : (
                  <Card key={lesson.lesson_order}>
                    <CardHeader>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Lesson {lesson.lesson_order} · Reading
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
    </>
  );
}
