import { useEffect, useState } from "react";
import { AtelierHome } from "@/components/homes/AtelierHome";
import { PrefsBar } from "@/components/site/PrefsBar";
import { fetchCourses, type CourseSummary } from "@/lib/api";
import { useInitialData } from "@/lib/InitialDataContext";

export function HomePage() {
  const initial = useInitialData();
  const hasSsrCourses = Array.isArray(initial.courses);
  const [courses, setCourses] = useState<CourseSummary[]>(initial.courses ?? []);

  useEffect(() => {
    if (hasSsrCourses) return;
    void fetchCourses().then(setCourses);
  }, [hasSsrCourses]);

  return (
    <>
      <PrefsBar />
      <AtelierHome courses={courses} />
    </>
  );
}
