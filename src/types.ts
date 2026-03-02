/**
 * Firestore Batch Updater Type Definitions
 */

import type { WhereFilterOp } from "firebase-admin/firestore";

/**
 * Progress information during batch operations
 */
export interface ProgressInfo {
  current: number; // Number of documents processed so far
  total: number; // Total number of documents to process
  percentage: number; // Progress percentage (0-100)
  elapsedTime: number; // Elapsed time in milliseconds
  docsPerSecond: number; // Processing speed (documents per second)
  eta: number; // Estimated time remaining in seconds (0 if cannot be calculated)
}

/**
 * Options for update operations
 */
export interface UpdateOptions {
  /**
   * Callback function for progress updates
   * @param progress - Current progress information
   */
  onProgress?: (progress: ProgressInfo) => void;
  /**
   * Log file generation options
   */
  log?: LogOptions;
  /**
   * Batch size for pagination (optional)
   * When set, documents are processed in batches to prevent memory issues with large collections
   * When not set, all documents are loaded at once
   */
  batchSize?: number;
  /**
   * Dry run mode - simulate the operation without actually writing
   * Returns what would happen without making any changes
   */
  dryRun?: boolean;
  /**
   * Maximum number of retry attempts for failed operations (default: 0)
   */
  retries?: number;
  /**
   * Delay between retry attempts in milliseconds (default: 1000)
   */
  retryDelay?: number;
}

/**
 * Result of batch update operation
 */
export interface UpdateResult {
  successCount: number; // Number of successfully updated documents
  failureCount: number; // Number of failed documents
  totalCount: number; // Total number of processed documents
  failedDocIds?: string[]; // Array of failed document IDs (if any)
}

/**
 * Document snapshot showing before/after state
 */
export interface DocumentSnapshot {
  id: string; // Document ID
  before: Record<string, any>; // Document data before update
  after: Record<string, any>; // Document data after update (expected)
}

/**
 * Preview result before executing update
 */
export interface PreviewResult {
  affectedCount: number; // Number of documents that will be affected
  samples: DocumentSnapshot[]; // Sample documents (up to 10)
  affectedFields: string[]; // List of fields that will be changed
}

/**
 * Where clause condition
 */
export interface WhereCondition {
  field: string; // Field path
  operator: WhereFilterOp; // Comparison operator
  value: any; // Value to compare
}

/**
 * OrderBy clause condition
 */
export interface OrderByCondition {
  field: string; // Field path
  direction: "asc" | "desc"; // Sort direction
}

/**
 * Field value result from getFields()
 */
export interface FieldValueResult {
  id: string; // Document ID
  value: any; // Field value
}

/**
 * Input for creating a single document
 */
export interface CreateDocumentInput {
  id?: string; // Optional document ID (auto-generated if not provided)
  data: Record<string, any>; // Document data
}

/**
 * Options for create operations
 */
export interface CreateOptions {
  /**
   * Callback function for progress updates
   * @param progress - Current progress information
   */
  onProgress?: (progress: ProgressInfo) => void;
  /**
   * Log file generation options
   */
  log?: LogOptions;
}

/**
 * Result of batch create operation
 */
export interface CreateResult {
  successCount: number; // Number of successfully created documents
  failureCount: number; // Number of failed documents
  totalCount: number; // Total number of processed documents
  createdIds: string[]; // Array of created document IDs
  failedDocIds?: string[]; // Array of failed document IDs (if any)
}

/**
 * Options for upsert operations
 */
export interface UpsertOptions {
  /**
   * Callback function for progress updates
   * @param progress - Current progress information
   */
  onProgress?: (progress: ProgressInfo) => void;
  /**
   * Log file generation options
   */
  log?: LogOptions;
  /**
   * Batch size for pagination (optional)
   * When set, documents are processed in batches to prevent memory issues with large collections
   * When not set, all documents are loaded at once
   */
  batchSize?: number;
  /**
   * Dry run mode - simulate the operation without actually writing
   * Returns what would happen without making any changes
   */
  dryRun?: boolean;
  /**
   * Maximum number of retry attempts for failed operations (default: 0)
   */
  retries?: number;
  /**
   * Delay between retry attempts in milliseconds (default: 1000)
   */
  retryDelay?: number;
}

/**
 * Result of batch upsert operation
 */
export interface UpsertResult {
  successCount: number; // Number of successfully upserted documents
  failureCount: number; // Number of failed documents
  totalCount: number; // Total number of processed documents
  failedDocIds?: string[]; // Array of failed document IDs (if any)
}

/**
 * Options for delete operations
 */
export interface DeleteOptions {
  /**
   * Callback function for progress updates
   * @param progress - Current progress information
   */
  onProgress?: (progress: ProgressInfo) => void;
  /**
   * Log file generation options
   */
  log?: LogOptions;
  /**
   * Batch size for pagination (optional)
   * When set, documents are processed in batches to prevent memory issues with large collections
   * When not set, all documents are loaded at once
   */
  batchSize?: number;
  /**
   * Dry run mode - simulate the operation without actually writing
   * Returns what would happen without making any changes
   */
  dryRun?: boolean;
  /**
   * Maximum number of retry attempts for failed operations (default: 0)
   */
  retries?: number;
  /**
   * Delay between retry attempts in milliseconds (default: 1000)
   */
  retryDelay?: number;
}

/**
 * Result of batch delete operation
 */
export interface DeleteResult {
  successCount: number; // Number of successfully deleted documents
  failureCount: number; // Number of failed documents
  totalCount: number; // Total number of processed documents
  deletedIds: string[]; // Array of deleted document IDs
  failedDocIds?: string[]; // Array of failed document IDs (if any)
}

/**
 * Result of count operation
 */
export interface CountResult {
  count: number; // Number of documents matching the query
}

/**
 * Result of dry run operation
 */
export interface DryRunResult {
  wouldAffect: number; // Number of documents that would be affected
  sampleIds: string[]; // Sample of document IDs that would be affected (up to 10)
  operation: "update" | "upsert" | "delete"; // Type of operation
}

/**
 * Log options for batch operations
 */
export interface LogOptions {
  enabled: boolean; // Whether to generate log file
  path?: string; // Custom log file path (default: ./logs)
  filename?: string; // Custom log filename (default: auto-generated with timestamp)
}

/**
 * Log entry for a single document operation
 */
export interface LogEntry {
  timestamp: string;
  documentId: string;
  status: "success" | "failure";
  error?: string;
}

/**
 * Complete log data for an operation
 */
export interface OperationLog {
  operation: "update" | "create" | "upsert" | "delete";
  collection: string;
  startedAt: string;
  completedAt: string;
  conditions?: WhereCondition[];
  updateData?: Record<string, any>;
  summary: {
    totalCount: number;
    successCount: number;
    failureCount: number;
  };
  entries: LogEntry[];
}

/**
 * Result of findOne operation
 */
export interface FindOneResult {
  id: string; // Document ID
  data: Record<string, any>; // Document data
}

/**
 * Result of createOne operation
 */
export interface CreateOneResult {
  success: boolean; // Whether the document was created
  id: string; // Created document ID
}

/**
 * Aggregate operation specification
 * Each key is the alias for the result, value defines the operation
 */
export interface AggregateSpec {
  [alias: string]: {
    op: "sum" | "average" | "count";
    field?: string; // Required for sum and average, not needed for count
  };
}

/**
 * Result of aggregate operation
 * Keys match the aliases from AggregateSpec
 */
export interface AggregateResult {
  [alias: string]: number | null;
}

/**
 * Options for paginate operation
 */
export interface PaginateOptions {
  pageSize: number; // Number of documents per page
  startAfter?: unknown; // Cursor from previous paginate() call (nextCursor)
}

/**
 * Result of paginate operation
 */
export interface PaginateResult {
  docs: { id: string; data: Record<string, any> }[]; // Documents in this page
  nextCursor: unknown | null; // Pass to next paginate() call, null if no more pages
  hasMore: boolean; // Whether there are more pages
}

/**
 * Input for bulk create operation
 */
export interface BulkCreateInput {
  id?: string; // Optional document ID (auto-generated if not provided)
  data: Record<string, any>; // Document data
}

/**
 * Options for bulk create operation
 */
export interface BulkCreateOptions {
  /**
   * Callback function for progress updates
   * @param progress - Current progress information
   */
  onProgress?: (progress: ProgressInfo) => void;
  /**
   * Log file generation options
   */
  log?: LogOptions;
}

/**
 * Result of bulk create operation
 */
export interface BulkCreateResult {
  successCount: number; // Number of successfully created documents
  failureCount: number; // Number of failed documents
  totalCount: number; // Total number of processed documents
  createdIds: string[]; // Array of created document IDs
  failedDocIds?: string[]; // Array of failed document IDs (if any)
}

/**
 * Options for bulk delete operation
 */
export interface BulkDeleteOptions {
  /**
   * Callback function for progress updates
   * @param progress - Current progress information
   */
  onProgress?: (progress: ProgressInfo) => void;
  /**
   * Log file generation options
   */
  log?: LogOptions;
}

/**
 * Result of bulk delete operation
 */
export interface BulkDeleteResult {
  successCount: number; // Number of successfully deleted documents
  failureCount: number; // Number of failed documents
  totalCount: number; // Total number of processed documents
  deletedIds: string[]; // Array of deleted document IDs
  failedDocIds?: string[]; // Array of failed document IDs (if any)
}

/**
 * Input for bulk update operation
 */
export interface BulkUpdateInput {
  id: string; // Document ID
  data: Record<string, any>; // Data to update for this document
}

/**
 * Options for bulk update operation
 */
export interface BulkUpdateOptions {
  /**
   * Callback function for progress updates
   * @param progress - Current progress information
   */
  onProgress?: (progress: ProgressInfo) => void;
  /**
   * Log file generation options
   */
  log?: LogOptions;
}

/**
 * Result of bulk update operation
 */
export interface BulkUpdateResult {
  successCount: number; // Number of successfully updated documents
  failureCount: number; // Number of failed documents
  totalCount: number; // Total number of processed documents
  failedDocIds?: string[]; // Array of failed document IDs (if any)
}

/**
 * Transform function that receives document data and returns the update data
 */
export type TransformFn = (doc: {
  id: string;
  data: Record<string, any>;
}) => Record<string, any> | null;

/**
 * Options for transform operation
 */
export interface TransformOptions {
  /**
   * Callback function for progress updates
   * @param progress - Current progress information
   */
  onProgress?: (progress: ProgressInfo) => void;
  /**
   * Log file generation options
   */
  log?: LogOptions;
  /**
   * Batch size for pagination (optional)
   */
  batchSize?: number;
}

/**
 * Result of transform operation
 */
export interface TransformResult {
  successCount: number; // Number of successfully transformed documents
  failureCount: number; // Number of failed documents
  skippedCount: number; // Number of documents skipped (transform returned null)
  totalCount: number; // Total number of processed documents
  failedDocIds?: string[]; // Array of failed document IDs (if any)
}

/**
 * Options for copyTo operation
 */
export interface CopyToOptions {
  /**
   * Callback function for progress updates
   * @param progress - Current progress information
   */
  onProgress?: (progress: ProgressInfo) => void;
  /**
   * Log file generation options
   */
  log?: LogOptions;
  /**
   * Optional transform function to modify data before copying
   */
  transform?: TransformFn;
  /**
   * Whether to delete source documents after copying (move operation)
   * @default false
   */
  deleteSource?: boolean;
}

/**
 * Result of copyTo operation
 */
export interface CopyToResult {
  successCount: number; // Number of successfully copied documents
  failureCount: number; // Number of failed documents
  totalCount: number; // Total number of processed documents
  copiedIds: string[]; // Array of copied document IDs
  failedDocIds?: string[]; // Array of failed document IDs (if any)
}

/**
 * Options for toJSON operation
 */
export interface ToJSONOptions {
  /**
   * Whether to pretty-print the JSON output (default: true)
   */
  pretty?: boolean;
}

/**
 * Result of toJSON operation
 */
export interface ToJSONResult {
  filePath: string; // Path to the generated JSON file
  documentCount: number; // Number of documents exported
}
