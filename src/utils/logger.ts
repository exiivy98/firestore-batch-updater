/**
 * Logger utility for Firestore Batch Updater
 */

import * as fs from "fs";
import * as path from "path";
import type { LogOptions, LogEntry, OperationLog, WhereCondition } from "../types";

/**
 * Get ISO timestamp string
 */
export function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Generate default log filename with timestamp
 */
export function generateLogFilename(operation: string): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  return `${operation}-${timestamp}.log`;
}

/**
 * Ensure log directory exists
 */
export function ensureLogDirectory(logPath: string): void {
  if (!fs.existsSync(logPath)) {
    fs.mkdirSync(logPath, { recursive: true });
  }
}

/**
 * Format operation log to string
 */
export function formatOperationLog(log: OperationLog): string {
  const lines: string[] = [];
  const separator = "=".repeat(60);

  lines.push(separator);
  lines.push(`FIRESTORE BATCH OPERATION LOG`);
  lines.push(separator);
  lines.push("");
  lines.push(`Operation: ${log.operation.toUpperCase()}`);
  lines.push(`Collection: ${log.collection}`);
  lines.push(`Started: ${log.startedAt}`);
  lines.push(`Completed: ${log.completedAt}`);
  lines.push("");

  if (log.conditions && log.conditions.length > 0) {
    lines.push("Conditions:");
    for (const condition of log.conditions) {
      lines.push(`  - ${condition.field} ${condition.operator} ${formatValue(condition.value)}`);
    }
    lines.push("");
  }

  if (log.updateData) {
    lines.push("Update Data:");
    lines.push(`  ${JSON.stringify(log.updateData, null, 2).replace(/\n/g, "\n  ")}`);
    lines.push("");
  }

  lines.push(separator);
  lines.push("SUMMARY");
  lines.push(separator);
  lines.push(`Total: ${log.summary.totalCount}`);
  lines.push(`Success: ${log.summary.successCount}`);
  lines.push(`Failure: ${log.summary.failureCount}`);
  lines.push("");

  if (log.entries.length > 0) {
    lines.push(separator);
    lines.push("DETAILS");
    lines.push(separator);
    lines.push("");

    for (const entry of log.entries) {
      const statusLabel = entry.status === "success" ? "[SUCCESS]" : "[FAILURE]";
      lines.push(`${entry.timestamp} ${statusLabel} ${entry.documentId}`);
      if (entry.error) {
        lines.push(`  Error: ${entry.error}`);
      }
    }
  }

  lines.push("");
  lines.push(separator);
  lines.push("END OF LOG");
  lines.push(separator);

  return lines.join("\n");
}

/**
 * Format value for display
 */
function formatValue(value: any): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return `"${value}"`;
  }
  return String(value);
}

/**
 * Write operation log to file
 */
export function writeOperationLog(
  log: OperationLog,
  options: LogOptions
): string {
  const logPath = options.path || "./logs";
  const filename = options.filename || generateLogFilename(log.operation);
  const fullPath = path.join(logPath, filename);

  ensureLogDirectory(logPath);

  const content = formatOperationLog(log);
  fs.writeFileSync(fullPath, content, "utf-8");

  return fullPath;
}

/**
 * Create a log collector for tracking operation entries
 */
export function createLogCollector(
  operation: "update" | "create" | "upsert" | "delete",
  collection: string,
  conditions?: WhereCondition[],
  updateData?: Record<string, any>
): {
  addEntry: (documentId: string, status: "success" | "failure", error?: string) => void;
  finalize: (options: LogOptions) => string;
  getLog: () => OperationLog;
} {
  const startedAt = getTimestamp();
  const entries: LogEntry[] = [];

  return {
    addEntry(documentId: string, status: "success" | "failure", error?: string) {
      entries.push({
        timestamp: getTimestamp(),
        documentId,
        status,
        error,
      });
    },

    getLog(): OperationLog {
      const successCount = entries.filter((e) => e.status === "success").length;
      const failureCount = entries.filter((e) => e.status === "failure").length;

      return {
        operation,
        collection,
        startedAt,
        completedAt: getTimestamp(),
        conditions,
        updateData,
        summary: {
          totalCount: entries.length,
          successCount,
          failureCount,
        },
        entries,
      };
    },

    finalize(options: LogOptions): string {
      const log = this.getLog();
      return writeOperationLog(log, options);
    },
  };
}
