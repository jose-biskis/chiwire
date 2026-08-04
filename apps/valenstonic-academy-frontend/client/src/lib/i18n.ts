import type { LangId } from "@/lib/site-prefs";

/** Shared atelier home copy (light + dark). */
export type HomeCopy = {
  kicker: string;
  title: string;
  lead: string;
  primaryCta: string;
  secondaryCta: string;
  tagline: string;
  featuredTitle: string;
  featuredSub: string;
  strip: [string, string, string, string];
  brandSub: string;
};

export type Messages = {
  brand: string;
  navHome: string;
  navCourses: string;
  navLabs: string;
  navAdmin: string;
  login: string;
  getStarted: string;
  curriculumEyebrow: string;
  curriculumTitle: string;
  curriculumDesc: string;
  comingSoon: string;
  courseFallbackDesc: string;
  exploreNow: string;
  archetypeLabel: string;
  themeLabel: string;
  themeDark: string;
  themeLight: string;
  langLabel: string;
  courseNotFound: string;
  backHome: string;
  loading: string;
  lessonInteractive: string;
  lessonReading: string;
  lessonInteractiveDesc: string;
  startPractice: string;
  glbMode: string;
  homeTitle: string;
  homeDescription: string;
  notFoundTitle: string;
  notFoundDescription: string;
  home: HomeCopy;
};

const en: Messages = {
  brand: "Valen's Tonic",
  navHome: "Home",
  navCourses: "Courses",
  navLabs: "Labs",
  navAdmin: "Admin",
  login: "Login",
  getStarted: "Get Started",
  curriculumEyebrow: "Curriculum",
  curriculumTitle: "Courses in this academy",
  curriculumDesc: "Open a course, then enter the Negroni practice station.",
  comingSoon: "Coming soon",
  courseFallbackDesc: "Interactive practice with process and technique.",
  exploreNow: "Explore now",
  archetypeLabel: "Archetype",
  themeLabel: "Theme",
  themeDark: "Dark",
  themeLight: "Light",
  langLabel: "Language",
  courseNotFound: "Course not found",
  backHome: "Back to home",
  loading: "Loading…",
  lessonInteractive: "Interactive",
  lessonReading: "Reading",
  lessonInteractiveDesc: "Hands-on 3D practice for this recipe.",
  startPractice: "Start practice",
  glbMode: "GLB mode",
  homeTitle: "Home · Valen's Tonic",
  homeDescription: "Interactive cocktail labs where order, measure, and technique decide the pour.",
  notFoundTitle: "Course not found · Valen's Tonic",
  notFoundDescription: "That course could not be found.",
  home: {
    kicker: "— Mix. Learn. Create.",
    title: "Cocktails are our language.",
    lead: "A modern cocktail school for curious drinkers and aspiring bartenders — technique, flavor, and hospitality under one roof.",
    primaryCta: "Explore classes",
    secondaryCta: "View programs",
    tagline: "Handcrafted education",
    featuredTitle: "Technique · Flavor · Hospitality",
    featuredSub: "Book a class",
    strip: ["Expert instructors", "Hands-on learning", "Industry inspired", "Creative community"],
    brandSub: "Cocktail School"
  }
};

const es: Messages = {
  brand: "Valen's Tonic",
  navHome: "Inicio",
  navCourses: "Cursos",
  navLabs: "Labs",
  navAdmin: "Admin",
  login: "Entrar",
  getStarted: "Empezar",
  curriculumEyebrow: "Currículo",
  curriculumTitle: "Cursos de la academia",
  curriculumDesc: "Abre un curso y entra a la estación de práctica Negroni.",
  comingSoon: "Próximamente",
  courseFallbackDesc: "Práctica interactiva con proceso y técnica.",
  exploreNow: "Explorar",
  archetypeLabel: "Arquetipo",
  themeLabel: "Tema",
  themeDark: "Oscuro",
  themeLight: "Claro",
  langLabel: "Idioma",
  courseNotFound: "Curso no encontrado",
  backHome: "Volver al inicio",
  loading: "Cargando…",
  lessonInteractive: "Interactiva",
  lessonReading: "Lectura",
  lessonInteractiveDesc: "Práctica 3D de esta receta.",
  startPractice: "Empezar práctica",
  glbMode: "Modo GLB",
  homeTitle: "Inicio · Valen's Tonic",
  homeDescription: "Labs interactivos de cócteles donde el orden, la medida y la técnica deciden el trago.",
  notFoundTitle: "Curso no encontrado · Valen's Tonic",
  notFoundDescription: "No se pudo encontrar ese curso.",
  home: {
    kicker: "— Mezcla. Aprende. Crea.",
    title: "Los cócteles son nuestro lenguaje.",
    lead: "Una escuela moderna para bebedores curiosos y bartenders en formación — técnica, sabor y hospitalidad.",
    primaryCta: "Explorar clases",
    secondaryCta: "Ver programas",
    tagline: "Educación artesanal",
    featuredTitle: "Técnica · Sabor · Hospitalidad",
    featuredSub: "Reservar clase",
    strip: ["Instructores expertos", "Aprendizaje práctico", "Inspiración industrial", "Comunidad creativa"],
    brandSub: "Escuela de cócteles"
  }
};

const catalogs: Record<LangId, Messages> = { en, es };

export function t(lang: LangId): Messages {
  return catalogs[lang];
}
