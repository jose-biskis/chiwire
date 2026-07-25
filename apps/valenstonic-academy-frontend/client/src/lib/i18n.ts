import type { LangId, StyleId } from "@/lib/site-prefs";

export type StyleCopy = {
  kicker: string;
  title: string;
  lead: string;
  primaryCta: string;
  secondaryCta: string;
  tagline: string;
  featuredLabel: string;
  featuredTitle: string;
  featuredSub: string;
  strip: [string, string, string, string] | [string, string, string, string, string];
  brandSub: string;
  /** Used by the original UpStudy-style home */
  enterBar?: string;
  features?: Array<{ title: string; body: string }>;
  categories?: string[];
  topicsEyebrow?: string;
  topicsTitle?: string;
  practiceEyebrow?: string;
  practiceTitle?: string;
  practiceBody?: string;
  openLab?: string;
  curriculumTitle?: string;
  curriculumDesc?: string;
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
  styleLabel: string;
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
  styles: Record<StyleId, StyleCopy>;
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
  styleLabel: "Style",
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
  styles: {
    original: {
      kicker: "Valen's Tonic",
      title: "Cocktail & Recipe Online Labs",
      lead: "Learn by making — interactive 3D stations where order, measure, and technique decide the pour.",
      primaryCta: "Start Negroni lab",
      secondaryCta: "Browse courses",
      tagline: "Enter the bar",
      featuredLabel: "Practice",
      featuredTitle: "Negroni",
      featuredSub: "Open the lab",
      strip: ["Interactive labs", "Technique first", "Measure & finish", "Bar craft"],
      brandSub: "Academy",
      enterBar: "Enter the bar",
      features: [
        {
          title: "Interactive labs",
          body: "Practice builds in 3D — ice, jigger, stir, and strain with real process rules."
        },
        {
          title: "Technique first",
          body: "Wrong order still runs, but the station tells you when the pour is compromised."
        },
        {
          title: "Measure & finish",
          body: "Two-sided jigger pours, overflow, and garnish — finish the drink cleanly."
        }
      ],
      categories: ["Stirred classics", "Measured pours", "Garnish & serve", "Bar tools"],
      topicsEyebrow: "Topics",
      topicsTitle: "Our top categories",
      practiceEyebrow: "Practice",
      practiceTitle: "Take your skills to the next level at the bar",
      practiceBody:
        "Whether you are learning your first Negroni or refining technique, the lab tracks process from ice to peel.",
      openLab: "Open the lab",
      curriculumTitle: "Our expert cocktail courses",
      curriculumDesc: "Start with Classic Cocktails Lab, then open the Negroni practice station."
    },
    noir: {
      kicker: "Valen's Tonic",
      title: "Cocktail and Recipe Online Labs",
      lead: "Master the craft of mixology through immersive online labs. From classic recipes to modern techniques — learn, practice, and perfect every pour.",
      primaryCta: "Explore the labs",
      secondaryCta: "Browse courses",
      tagline: "Learn. Shake. Master.",
      featuredLabel: "Featured lab",
      featuredTitle: "The Negroni",
      featuredSub: "Balance is everything",
      strip: ["Est. MMXXI", "Discipline in the pour", "Classic technique", "Bar craft"],
      brandSub: "Cocktail Academy"
    },
    atelier: {
      kicker: "— Mix. Learn. Create.",
      title: "Cocktails are our language.",
      lead: "A modern cocktail school for curious drinkers and aspiring bartenders — technique, flavor, and hospitality under one roof.",
      primaryCta: "Explore classes",
      secondaryCta: "View programs",
      tagline: "Handcrafted education",
      featuredLabel: "Seal",
      featuredTitle: "Technique · Flavor · Hospitality",
      featuredSub: "Book a class",
      strip: ["Expert instructors", "Hands-on learning", "Industry inspired", "Creative community"],
      brandSub: "Cocktail School"
    },
    brutalist: {
      kicker: "Hands-on cocktail education. No fluff. Just skills.",
      title: "Cocktail Labs",
      lead: "Cocktail labs for building better bartenders. Intensive sessions. Real-world techniques. Leave with skills — not just recipes.",
      primaryCta: "Book a lab",
      secondaryCta: "See courses",
      tagline: "Learn. Build. Elevate.",
      featuredLabel: "Next lab",
      featuredTitle: "Negroni station",
      featuredSub: "Open practice",
      strip: ["Learn. Build. Elevate.", "Bar school for the dedicated", "Process over fluff", "VT-LAB"],
      brandSub: "Cocktail Labs"
    },
    deco: {
      kicker: "Explore. Experiment. Elevate.",
      title: "Cocktail and Recipe Online Labs",
      lead: "Step into a digital salon of classic technique and luminous craft — recipes, labs, and the art of the pour.",
      primaryCta: "Visit the labs",
      secondaryCta: "Browse recipes",
      tagline: "Cocktail Salon",
      featuredLabel: "Salon",
      featuredTitle: "Curated recipes",
      featuredSub: "Online labs",
      strip: [
        "Curated recipes",
        "Online labs",
        "Articles & guides",
        "Cocktail salon",
        "Valen's Tonic"
      ],
      brandSub: "Cocktail Salon"
    },
    botanical: {
      kicker: "Botanical mixology",
      title: "Crafted from nature. Mixed with intention.",
      lead: "Learn garden-to-glass technique — herbs, citrus, and precise pours in interactive labs built for patient craft.",
      primaryCta: "Explore classes",
      secondaryCta: "Browse recipes",
      tagline: "Garden to glass",
      featuredLabel: "Academy",
      featuredTitle: "Join the academy",
      featuredSub: "Negroni lab",
      strip: ["Garden to glass", "Botanical education", "Measured pours", "Open recipes"],
      brandSub: "Botanical Mixology"
    }
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
  styleLabel: "Estilo",
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
  styles: {
    original: {
      kicker: "Valen's Tonic",
      title: "Labs online de cócteles y recetas",
      lead: "Aprende haciendo — estaciones 3D interactivas donde el orden, la medida y la técnica deciden el trago.",
      primaryCta: "Abrir lab Negroni",
      secondaryCta: "Ver cursos",
      tagline: "Entra al bar",
      featuredLabel: "Práctica",
      featuredTitle: "Negroni",
      featuredSub: "Abrir el lab",
      strip: ["Labs interactivos", "La técnica primero", "Medir y terminar", "Oficio de bar"],
      brandSub: "Academia",
      enterBar: "Entra al bar",
      features: [
        {
          title: "Labs interactivos",
          body: "Practica en 3D — hielo, jigger, remover y colar con reglas de proceso reales."
        },
        {
          title: "La técnica primero",
          body: "El orden incorrecto sigue animándose, pero la estación avisa si el trago se compromete."
        },
        {
          title: "Medir y terminar",
          body: "Jigger de dos lados, desborde y garnish — termina el cóctel con limpieza."
        }
      ],
      categories: ["Clásicos removidos", "Medidas precisas", "Garnish y servicio", "Herramientas de bar"],
      topicsEyebrow: "Temas",
      topicsTitle: "Nuestras categorías principales",
      practiceEyebrow: "Práctica",
      practiceTitle: "Lleva tu técnica al siguiente nivel en la barra",
      practiceBody:
        "Ya sea tu primer Negroni o un ajuste fino, el lab sigue el proceso del hielo a la cáscara.",
      openLab: "Abrir el lab",
      curriculumTitle: "Nuestros cursos de cócteles",
      curriculumDesc: "Empieza con Classic Cocktails Lab y abre la estación de práctica Negroni."
    },
    noir: {
      kicker: "Valen's Tonic",
      title: "Labs online de cócteles y recetas",
      lead: "Domina la coctelería con labs inmersivos. De clásicos a técnicas modernas — aprende, practica y perfecciona cada trago.",
      primaryCta: "Explorar los labs",
      secondaryCta: "Ver cursos",
      tagline: "Aprende. Agita. Domina.",
      featuredLabel: "Lab destacado",
      featuredTitle: "El Negroni",
      featuredSub: "El equilibrio lo es todo",
      strip: ["Est. MMXXI", "Disciplina en el trago", "Técnica clásica", "Oficio de bar"],
      brandSub: "Academia de cócteles"
    },
    atelier: {
      kicker: "— Mezcla. Aprende. Crea.",
      title: "Los cócteles son nuestro lenguaje.",
      lead: "Una escuela moderna para bebedores curiosos y bartenders en formación — técnica, sabor y hospitalidad.",
      primaryCta: "Explorar clases",
      secondaryCta: "Ver programas",
      tagline: "Educación artesanal",
      featuredLabel: "Sello",
      featuredTitle: "Técnica · Sabor · Hospitalidad",
      featuredSub: "Reservar clase",
      strip: ["Instructores expertos", "Aprendizaje práctico", "Inspiración industrial", "Comunidad creativa"],
      brandSub: "Escuela de cócteles"
    },
    brutalist: {
      kicker: "Educación práctica de cócteles. Sin relleno. Solo técnica.",
      title: "Cocktail Labs",
      lead: "Labs para formar mejores bartenders. Sesiones intensivas. Técnicas reales. Te vas con habilidad — no solo con recetas.",
      primaryCta: "Reservar un lab",
      secondaryCta: "Ver cursos",
      tagline: "Aprende. Construye. Eleva.",
      featuredLabel: "Próximo lab",
      featuredTitle: "Estación Negroni",
      featuredSub: "Abrir práctica",
      strip: ["Aprende. Construye. Eleva.", "Escuela para dedicados", "Proceso sobre relleno", "VT-LAB"],
      brandSub: "Cocktail Labs"
    },
    deco: {
      kicker: "Explora. Experimenta. Eleva.",
      title: "Labs online de cócteles y recetas",
      lead: "Entra a un salón digital de técnica clásica y oficio luminoso — recetas, labs y el arte del trago.",
      primaryCta: "Visitar los labs",
      secondaryCta: "Ver recetas",
      tagline: "Cocktail Salon",
      featuredLabel: "Salón",
      featuredTitle: "Recetas curadas",
      featuredSub: "Labs online",
      strip: [
        "Recetas curadas",
        "Labs online",
        "Artículos y guías",
        "Cocktail salon",
        "Valen's Tonic"
      ],
      brandSub: "Cocktail Salon"
    },
    botanical: {
      kicker: "Mixología botánica",
      title: "Creado desde la naturaleza. Mezclado con intención.",
      lead: "Aprende la técnica garden-to-glass — hierbas, cítricos y medidas precisas en labs interactivos.",
      primaryCta: "Explorar clases",
      secondaryCta: "Ver recetas",
      tagline: "Del jardín al vaso",
      featuredLabel: "Academia",
      featuredTitle: "Únete a la academia",
      featuredSub: "Lab Negroni",
      strip: ["Del jardín al vaso", "Educación botánica", "Medidas precisas", "Recetas abiertas"],
      brandSub: "Mixología botánica"
    }
  }
};

const catalogs: Record<LangId, Messages> = { en, es };

export function t(lang: LangId): Messages {
  return catalogs[lang];
}
