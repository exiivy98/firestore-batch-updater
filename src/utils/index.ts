/**
 * Utility functions for Firestore Batch Updater
 */

import type { ProgressInfo } from "../types";

// Re-export logger utilities
export {
  getTimestamp,
  generateLogFilename,
  ensureLogDirectory,
  formatOperationLog,
  writeOperationLog,
  createLogCollector,
} from "./logger";

/**
 * Calculate progress information
 * @param current - Number of documents processed so far
 * @param total - Total number of documents to process
 * @returns Progress information with percentage
 */
export function calculateProgress(
  current: number,
  total: number
): ProgressInfo {
  const percentage = total === 0 ? 0 : Math.round((current / total) * 100);

  return {
    current,
    total,
    percentage,
  };
}

/**
 * Extract field names from update data
 * @param updateData - Data to be updated
 * @returns Array of field names that will be affected
 */
export function getAffectedFields(updateData: Record<string, any>): string[] {
  return Object.keys(updateData);
}

/**
 * Merge update data with existing document data
 * @param existingData - Current document data
 * @param updateData - Data to update
 * @returns Merged data (shallow merge)
 */
export function mergeUpdateData(
  existingData: Record<string, any>,
  updateData: Record<string, any>
): Record<string, any> {
  return {
    ...existingData,
    ...updateData,
  };
}

/**
 * Check if a value is a valid update data object
 * @param value - Value to check
 * @returns True if value is a valid update data object
 */
export function isValidUpdateData(value: any): value is Record<string, any> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}

/**
 * Format error message for failed operations
 * @param error - Error object
 * @param context - Additional context (e.g., document ID)
 * @returns Formatted error message
 */
export function formatError(error: unknown, context?: string): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return context ? `Error at ${context}: ${errorMessage}` : errorMessage;
}
