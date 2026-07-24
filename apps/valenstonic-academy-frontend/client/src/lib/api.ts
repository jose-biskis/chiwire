export type CourseSummary = {
  slug: string;
  name: string;
  description: string | null;
  category: string;
};

export type CourseDetail = {
  course: { name: string; description: string | null; category: string };
  lessons: Array<{
    lesson_order: number;
    title: string;
    kind: string;
    body: string | null;
    scene_slug: string | null;
  }>;
};

export async function fetchCourses(): Promise<CourseSummary[]> {
  const res = await fetch("/api/courses");
  if (!res.ok) return [];
  return (await res.json()) as CourseSummary[];
}

export async function fetchCourse(slug: string): Promise<CourseDetail | null> {
  const res = await fetch(`/api/courses/${encodeURIComponent(slug)}`);
  if (!res.ok) return null;
  return (await res.json()) as CourseDetail;
}
