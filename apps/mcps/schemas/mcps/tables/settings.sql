CREATE TABLE IF NOT EXISTS mcps.settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  auth_secret text,
  allowed_origin text,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
