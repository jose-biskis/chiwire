export {
  applySchema,
  planSchema,
  type ApplyOptions,
  type ApplyResult,
  type PlanOptions
} from "./apply.js";
export {
  checksumSchemaFiles,
  hashText,
  type FileChecksum,
  type SchemaFile
} from "./checksum.js";
export {
  ensureHistoryTable,
  getLatestHistory,
  HISTORY_SCHEMA,
  HISTORY_TABLE,
  type HistoryRow
} from "./history.js";
export {
  introspectTable,
  listTablesInSchema,
  normalizeTypeSql,
  type LiveColumn,
  type LiveTable
} from "./introspect.js";
export {
  defaultSchemasRoot,
  loadSchemaFiles,
  resolveSchemaDir
} from "./loadSchema.js";
export {
  classifyStatements,
  isCreateTableStatement,
  parseColumnDefinition,
  parseCreateTableStatement,
  referencedTableKeys,
  sortTablesByForeignKeys,
  splitTopLevelCommas,
  type DesiredColumn,
  type DesiredTable
} from "./parseTables.js";
export { getSchemaStatus, type SchemaStatus, type StatusOptions } from "./status.js";
export { splitSqlStatements } from "./sqlSplit.js";
export {
  buildAddColumnSql,
  buildDropColumnSql,
  formatTableDiffConflicts,
  planTableDiff,
  type AddColumnChange,
  type DropColumnChange,
  type TableDiffConflict,
  type TableDiffPlan
} from "./tableDiff.js";
export { validateSchema, type ValidateResult } from "./validate.js";
