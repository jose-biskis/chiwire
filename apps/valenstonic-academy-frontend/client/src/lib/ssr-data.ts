import type { CourseDetail, CourseSummary } from "@/lib/api";
import type { ArchetypeId, ColorMode, LangId } from "@/lib/site-prefs";

export type SsrData = {
  archetype?: ArchetypeId;
  theme?: ColorMode;
  lang?: LangId;
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
