#!/usr/bin/env node
import { createKnex } from "@chiwire/core";
import { applySchema, planSchema } from "./apply.js";
import { getSchemaStatus } from "./status.js";
import { validateSchema } from "./validate.js";

function usage(): never {
  console.error(`Usage:
  chiwire-db-migrate apply --schema <name> [--dir <schemasRoot>]
  chiwire-db-migrate plan --schema <name> [--dir <schemasRoot>]
  chiwire-db-migrate status --schema <name> [--dir <schemasRoot>]
  chiwire-db-migrate validate --schema <name> [--dir <schemasRoot>]

Desired-state SQL lives under <schemasRoot>/<schema>/**/*.sql
(default schemasRoot: package schemas/ directory).

Connection uses PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE.`);
  process.exit(2);
}

function parseArgs(argv: string[]): {
  command: string;
  schema: string;
  schemasRoot?: string;
} {
  const [command, ...rest] = argv;
  if (!command || command === "-h" || command === "--help") {
    usage();
  }

  let schema: string | undefined;
  let schemasRoot: string | undefined;

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i]!;
    if (arg === "--schema") {
      schema = rest[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--dir") {
      schemasRoot = rest[i + 1];
      i += 1;
      continue;
    }
    console.error(`Unknown argument: ${arg}`);
    usage();
  }

  if (!schema) {
    console.error("Missing required --schema <name>");
    usage();
  }

  const result: { command: string; schema: string; schemasRoot?: string } = {
    command,
    schema
  };
  if (schemasRoot !== undefined) {
    result.schemasRoot = schemasRoot;
  }
  return result;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const db = createKnex();

  try {
    const options =
      args.schemasRoot !== undefined
        ? { targetSchema: args.schema, schemasRoot: args.schemasRoot }
        : { targetSchema: args.schema };

    if (args.command === "apply") {
      const result = await applySchema(db, options);
      if (result.status === "up_to_date") {
        console.log(`up to date  schema=${args.schema}  checksum=${result.checksum}`);
        return;
      }
      console.log(
        `applied  schema=${args.schema}  checksum=${result.checksum}  ` +
          `statements=${result.statementCount}  ` +
          `create_tables=${result.createdTables}  ` +
          `add_columns=${result.addedColumns}  ` +
          `drop_columns=${result.droppedColumns}  ` +
          `ms=${result.executionTimeMs}`
      );
      return;
    }

    if (args.command === "plan") {
      const plan = await planSchema(db, options);
      console.log(`schema=${args.schema}`);
      console.log(`checksum=${plan.checksum}`);
      console.log(`create_tables=${plan.tablePlan.createTables.length}`);
      for (const table of plan.tablePlan.createTables) {
        console.log(`  + table ${table.schema}.${table.name}`);
      }
      console.log(`add_columns=${plan.tablePlan.addColumns.length}`);
      for (const change of plan.tablePlan.addColumns) {
        console.log(
          `  + column ${change.schema}.${change.table}.${change.column.name} ${change.column.typeSql}`
        );
      }
      console.log(`drop_columns=${plan.tablePlan.dropColumns.length}`);
      for (const change of plan.tablePlan.dropColumns) {
        console.log(`  - column ${change.schema}.${change.table}.${change.column}`);
      }
      console.log(`other_statements=${plan.otherStatements.length}`);
      console.log(`conflicts=${plan.tablePlan.conflicts.length}`);
      for (const conflict of plan.tablePlan.conflicts) {
        const target = conflict.column
          ? `${conflict.schema}.${conflict.table}.${conflict.column}`
          : `${conflict.schema}.${conflict.table}`;
        console.log(`  ! ${target}: ${conflict.reason}`);
      }
      if (plan.tablePlan.conflicts.length > 0) {
        process.exitCode = 1;
      }
      return;
    }

    if (args.command === "status") {
      const status = await getSchemaStatus(db, options);
      console.log(`schema=${status.targetSchema}`);
      console.log(`dir=${status.schemaDir}`);
      console.log(`state=${status.state}`);
      console.log(`files=${status.fileCount}`);
      console.log(`current_checksum=${status.currentChecksum}`);
      if (status.latest) {
        console.log(`latest_id=${status.latest.id}`);
        console.log(`latest_checksum=${status.latest.checksum}`);
        console.log(`latest_success=${status.latest.success}`);
        console.log(`latest_applied_at=${status.latest.applied_at.toISOString()}`);
        if (status.latest.error) {
          console.log(`latest_error=${status.latest.error}`);
        }
      } else {
        console.log("latest=none");
      }
      return;
    }

    if (args.command === "validate") {
      const result = await validateSchema(db, options);
      console.log(
        `ok  schema=${args.schema}  state=${result.state}  checksum=${result.checksum}`
      );
      return;
    }

    console.error(`Unknown command: ${args.command}`);
    usage();
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
