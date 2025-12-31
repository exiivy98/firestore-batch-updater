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
 * Field value result
 */
export interface FieldValue {
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
  operation: "update" | "create" | "upsert";
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
