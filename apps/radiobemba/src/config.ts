import process from "node:process";

export type RadiobembaConfig = {
  port: number;
  sshPort: number;
  baseDomain: string;
  publicOrigin: string;
  /** Public host agents use for SSH (defaults to hostname of publicOrigin). */
  sshHost: string;
  authToken: string | null;
  dataDir: string;
  /** When true, permanent reservations use Postgres. */
  usePostgres: boolean;
};

function readPort(envName: string, fallback: number): number {
  const configured = process.env[envName] ?? String(fallback);
  const port = Number.parseInt(configured, 10);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid ${envName} value: ${configured}`);
  }

  return port;
}

export function loadConfig(): RadiobembaConfig {
  const port = readPort("PORT", 3000);
  const sshPort = readPort("RADIOBEMBA_SSH_PORT", 2222);
  const baseDomain = process.env.RADIOBEMBA_BASE_DOMAIN ?? "bemba.avilalabs.dev";
  const publicOrigin =
    process.env.RADIOBEMBA_PUBLIC_ORIGIN ?? `https://${baseDomain}`;
  const publicHost = new URL(publicOrigin).hostname;
  const sshHost = process.env.RADIOBEMBA_SSH_HOST?.trim() || publicHost;
  const authToken = process.env.RADIOBEMBA_AUTH_TOKEN?.trim() || null;
  const dataDir = process.env.RADIOBEMBA_DATA_DIR?.trim() || "./data";
  const persistence = (process.env.RADIOBEMBA_PERSISTENCE ?? "auto").toLowerCase();
  const usePostgres =
    persistence === "postgres" ||
    (persistence === "auto" && Boolean(process.env.PGHOST || process.env.PGDATABASE));

  return {
    port,
    sshPort,
    baseDomain,
    publicOrigin,
    sshHost,
    authToken,
    dataDir,
    usePostgres
  };
}
