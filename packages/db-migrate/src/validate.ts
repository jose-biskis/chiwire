import type { Knex } from "knex";
import { getSchemaStatus, type StatusOptions } from "./status.js";

export type ValidateResult = {
  ok: true;
  state: "up_to_date" | "pending" | "never_applied";
  checksum: string;
};

/**
 * Validate desired-state checksums against history.
 * Fails hard on a failed prior apply (no repair in v1).
 */
export async function validateSchema(
  db: Knex,
  options: StatusOptions
): Promise<ValidateResult> {
  const status = await getSchemaStatus(db, options);

  if (status.state === "failed") {
    const latest = status.latest!;
    throw new Error(
      `Schema "${options.targetSchema}" is in a failed apply state ` +
        `(history id ${latest.id}, checksum ${latest.checksum}` +
        (latest.error ? `: ${latest.error}` : "") +
        `). Retry apply with the same desired-state files after fixing the database.`
    );
  }

  return {
    ok: true,
    state: status.state,
    checksum: status.currentChecksum
  };
}
