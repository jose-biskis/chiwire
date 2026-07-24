CREATE OR REPLACE FUNCTION bway.note_count()
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT count(*)::bigint FROM bway.notes;
$$;

CREATE OR REPLACE FUNCTION bway.notes_with_tag(p_tag text)
RETURNS TABLE (
  id text,
  title text,
  body text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT n.id, n.title, n.body, n.created_at
  FROM bway.notes AS n
  INNER JOIN bway.note_tags AS t ON t.note_id = n.id
  WHERE t.tag = p_tag
  ORDER BY n.created_at DESC;
$$;
