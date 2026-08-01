CREATE TABLE IF NOT EXISTS radiobemba.tunnel_reservations (
  slug text PRIMARY KEY,
  owner_token_hash text NOT NULL,
  kind text NOT NULL DEFAULT 'permanent',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  disabled_at timestamptz
);
