import type { CourseDetail, CourseSummary } from "@/lib/api";

export type SsrData = {
  courses?: CourseSummary[];
  course?: CourseDetail | null;
  courseSlug?: string;
  courseMissing?: boolean;
};

declare global {
  interface Window {
    __VT_SSR__?: SsrData;
  }
}

export function readClientSsrData(): SsrData {
  return typeof window !== "undefined" && window.__VT_SSR__ ? window.__VT_SSR__ : {};
}
