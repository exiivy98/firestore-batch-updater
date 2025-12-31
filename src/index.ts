/**
 * Firestore Batch Updater
 *
 * Easy batch updates for Firebase Firestore with query-based filtering and progress tracking
 * @packageDocumentation
 */

// Export main class
export { BatchUpdater } from "./core/batch-updater";

// Export types
export type {
  ProgressInfo,
  UpdateOptions,
  UpdateResult,
  DocumentSnapshot,
  PreviewResult,
  WhereCondition,
  FieldValue,
  CreateDocumentInput,
  CreateOptions,
  CreateResult,
  UpsertOptions,
  UpsertResult,
  LogOptions,
  LogEntry,
  OperationLog,
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
