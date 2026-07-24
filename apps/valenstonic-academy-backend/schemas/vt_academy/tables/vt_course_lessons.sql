CREATE TABLE IF NOT EXISTS vt_academy.vt_course_lessons (
  id text PRIMARY KEY,
  course_id text NOT NULL REFERENCES vt_academy.vt_courses (id) ON DELETE CASCADE,
  lesson_order integer NOT NULL,
  title text NOT NULL,
  kind text NOT NULL,
  body text,
  interactive_scene_id text REFERENCES vt_academy.vt_interactive_scenes (id) ON DELETE SET NULL,
  UNIQUE (course_id, lesson_order)
);
