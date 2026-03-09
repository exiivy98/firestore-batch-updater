/**
 * Firestore Batch Updater
 *
 * Easy batch updates for Firebase Firestore with query-based filtering and progress tracking
 * @packageDocumentation
 */

// Export main class
export { BatchUpdater } from "./core/batch-updater";

// Re-export FieldValue from firebase-admin for convenience
// Users can use FieldValue.increment(), FieldValue.arrayUnion(), etc.
export { FieldValue } from "firebase-admin/firestore";

// Export types
export type {
  ProgressInfo,
  UpdateOptions,
  UpdateResult,
  DocumentSnapshot,
  PreviewResult,
  WhereCondition,
  OrderByCondition,
  FieldValueResult,
  CreateDocumentInput,
  CreateOptions,
  CreateResult,
  UpsertOptions,
  UpsertResult,
  DeleteOptions,
  DeleteResult,
  CountResult,
  DryRunResult,
  LogOptions,
  LogEntry,
  OperationLog,
  CreateOneResult,
  AggregateSpec,
  AggregateResult,
  PaginateOptions,
  PaginateResult,
  BulkCreateInput,
  BulkCreateOptions,
  BulkCreateResult,
  BulkDeleteOptions,
  BulkDeleteResult,
  BulkUpdateInput,
  BulkUpdateOptions,
  BulkUpdateResult,
  TransformFn,
  TransformOptions,
  TransformResult,
  CopyToOptions,
  CopyToResult,
  ToJSONOptions,
  ToJSONResult,
  CountByResult,
  FromJSONOptions,
  FromJSONResult,
} from "./types";

// Export utility functions (optional, for advanced users)
export {
  calculateProgress,
  getAffectedFields,
  mergeUpdateData,
  isValidUpdateData,
  formatError,
  createLogCollector,
  formatOperationLog,
  writeOperationLog,
} from "./utils";
