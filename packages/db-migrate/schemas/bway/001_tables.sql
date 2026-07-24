-- Desired state for experimental schema "bway".
-- Tables are synced via introspective diff (create missing / add columns).
-- Drops, type changes, and nullability changes fail closed (no force/repair).

CREATE TABLE IF NOT EXISTS bway.notes (
  id text PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bway.note_tags (
  note_id text NOT NULL REFERENCES bway.notes (id) ON DELETE CASCADE,
  tag text NOT NULL,
  PRIMARY KEY (note_id, tag)
);
