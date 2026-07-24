import process from "node:process";
import knex, { type Knex } from "knex";

export type PgConnectionConfig = {
  connectionString?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: boolean | Knex.PgConnectionConfig["ssl"];
  pool?: Knex.PoolConfig;
};

/**
 * Create a Knex client for Postgres. Apps can call this when they need DB access;
 * Contimiti v1 stores shares on the filesystem and does not use it yet.
 */
export function createKnex(config: PgConnectionConfig = {}): Knex {
  let connection: string | Knex.PgConnectionConfig;

  if (config.connectionString !== undefined) {
    connection = config.connectionString;
  } else {
    connection = {
      host: config.host ?? process.env.PGHOST ?? "127.0.0.1",
      port: config.port ?? Number(process.env.PGPORT ?? 5432),
      user: config.user ?? process.env.PGUSER ?? "postgres",
      password: config.password ?? process.env.PGPASSWORD ?? "",
      database: config.database ?? process.env.PGDATABASE ?? "postgres"
    };

    if (config.ssl !== undefined) {
      connection.ssl = config.ssl;
    }
  }

  return knex({
    client: "pg",
    connection,
    pool: config.pool ?? { min: 0, max: 10 }
  });
}
