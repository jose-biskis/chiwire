import { useEffect, useState } from "react";
import { AtelierHome } from "@/components/homes/AtelierHome";
import { BotanicalHome } from "@/components/homes/BotanicalHome";
import { BrutalistHome } from "@/components/homes/BrutalistHome";
import { DecoHome } from "@/components/homes/DecoHome";
import { NoirHome } from "@/components/homes/NoirHome";
import { OriginalHome } from "@/components/homes/OriginalHome";
import { PrefsBar } from "@/components/site/PrefsBar";
import { fetchCourses, type CourseSummary } from "@/lib/api";
import { useInitialData } from "@/lib/InitialDataContext";
import { useSitePrefs } from "@/lib/useSitePrefs";

export function HomePage() {
  const initial = useInitialData();
  const { style } = useSitePrefs();
  const hasSsrCourses = Array.isArray(initial.courses);
  const [courses, setCourses] = useState<CourseSummary[]>(initial.courses ?? []);

  useEffect(() => {
    if (hasSsrCourses) return;
    void fetchCourses().then(setCourses);
  }, [hasSsrCourses]);

  const home =
    style === "original" ? (
      <OriginalHome courses={courses} />
    ) : style === "atelier" ? (
      <AtelierHome courses={courses} />
    ) : style === "brutalist" ? (
      <BrutalistHome courses={courses} />
    ) : style === "deco" ? (
      <DecoHome courses={courses} />
    ) : style === "botanical" ? (
      <BotanicalHome courses={courses} />
    ) : (
      <NoirHome courses={courses} />
    );

  return (
    <>
      <PrefsBar />
      {home}
    </>
  );
}
