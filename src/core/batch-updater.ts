/**
 * BatchUpdater - Core class for batch operations on Firestore
 */

import type {
  Firestore,
  Query,
  DocumentData,
  WhereFilterOp,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";

import type {
  UpdateOptions,
  UpdateResult,
  PreviewResult,
  DocumentSnapshot,
  WhereCondition,
  FieldValue,
  CreateDocumentInput,
  CreateOptions,
  CreateResult,
  UpsertOptions,
  UpsertResult,
} from "../types";

import {
  calculateProgress,
  getAffectedFields,
  mergeUpdateData,
  isValidUpdateData,
  createLogCollector,
} from "../utils";

/**
 * BatchUpdater class for efficient batch operations
 */
export class BatchUpdater {
  private firestore: Firestore;
  private collectionPath?: string;
  private conditions: WhereCondition[] = [];

  /**
   * Create a new BatchUpdater instance
   * @param firestore - Initialized Firestore instance from firebase-admin
   */
  constructor(firestore: Firestore) {
    this.firestore = firestore;
  }

  /**
   * Select a collection to operate on
   * @param path - Collection path
   * @returns This instance for chaining
   */
  collection(path: string): this {
    this.collectionPath = path;
    this.conditions = []; // Reset conditions for new collection
    return this;
  }

  /**
   * Add a where condition to filter documents
   * @param field - Field path
   * @param operator - Comparison operator
   * @param value - Value to compare
   * @returns This instance for chaining
   */
  where(field: string, operator: WhereFilterOp, value: any): this {
    this.conditions.push({ field, operator, value });
    return this;
  }

  /**
   * Preview changes before executing update
   * @param updateData - Data to update
   * @returns Preview result with affected count and samples
   */
  async preview(updateData: Record<string, any>): Promise<PreviewResult> {
    this.validateSetup();

    if (!isValidUpdateData(updateData)) {
      throw new Error("Update data must be a non-empty object");
    }

    const query = this.buildQuery();
    const snapshot = await query.get();

    const affectedCount = snapshot.size;
    const affectedFields = getAffectedFields(updateData);

    // Get up to 10 sample documents
    const samples: DocumentSnapshot[] = [];
    const sampleDocs = snapshot.docs.slice(0, 10);

    for (const doc of sampleDocs) {
      const before = doc.data();
      const after = mergeUpdateData(before, updateData);

      samples.push({
        id: doc.id,
        before,
        after,
      });
    }

    return {
      affectedCount,
      samples,
      affectedFields,
    };
  }

  /**
   * Execute batch update operation
   * @param updateData - Data to update
   * @param options - Update options (e.g., progress callback, log options, batchSize for pagination)
   * @returns Update result with success/failure counts and optional log file path
   */
  async update(
    updateData: Record<string, any>,
    options: UpdateOptions = {}
  ): Promise<UpdateResult & { logFilePath?: string }> {
    this.validateSetup();

    if (!isValidUpdateData(updateData)) {
      throw new Error("Update data must be a non-empty object");
    }

    // Initialize log collector if logging is enabled
    const logCollector = options.log?.enabled
      ? createLogCollector("update", this.collectionPath!, this.conditions, updateData)
      : null;

    let successCount = 0;
    let failureCount = 0;
    let totalCount = 0;
    const failedDocIds: string[] = [];

    // Use pagination if batchSize is set
    if (options.batchSize && options.batchSize > 0) {
      // First, get total count for progress tracking
      const countQuery = this.buildQuery();
      const countSnapshot = await countQuery.count().get();
      totalCount = countSnapshot.data().count;

      if (totalCount === 0) {
        const result: UpdateResult & { logFilePath?: string } = {
          successCount: 0,
          failureCount: 0,
          totalCount: 0,
        };

        if (logCollector && options.log) {
          result.logFilePath = logCollector.finalize(options.log);
        }

        return result;
      }

      let processedCount = 0;
      let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;

      while (true) {
        // Build paginated query
        let paginatedQuery = this.buildQuery().limit(options.batchSize);
        if (lastDoc) {
          paginatedQuery = paginatedQuery.startAfter(lastDoc);
        }

        const snapshot = await paginatedQuery.get();

        if (snapshot.empty) {
          break;
        }

        // Process this batch
        const bulkWriter = this.firestore.bulkWriter();
        const docIdMap = new Map<string, string>();

        for (const doc of snapshot.docs) {
          docIdMap.set(doc.ref.path, doc.id);
        }

        bulkWriter.onWriteResult((ref) => {
          successCount++;
          processedCount++;

          const docId = docIdMap.get(ref.path) || ref.id;
          logCollector?.addEntry(docId, "success");

          if (options.onProgress) {
            const progress = calculateProgress(processedCount, totalCount);
            options.onProgress(progress);
          }
        });

        bulkWriter.onWriteError((error) => {
          failureCount++;
          processedCount++;

          const docId = error.documentRef?.id || "unknown";
          failedDocIds.push(docId);
          logCollector?.addEntry(docId, "failure", error.message);

          if (options.onProgress) {
            const progress = calculateProgress(processedCount, totalCount);
            options.onProgress(progress);
          }

          return false;
        });

        for (const doc of snapshot.docs) {
          bulkWriter.update(doc.ref, updateData);
        }

        await bulkWriter.close();

        // Update cursor for next batch
        lastDoc = snapshot.docs[snapshot.docs.length - 1];

        // If we got fewer docs than batchSize, we're done
        if (snapshot.docs.length < options.batchSize) {
          break;
        }
      }
    } else {
      // Original behavior: load all documents at once
      const query = this.buildQuery();
      const snapshot = await query.get();

      totalCount = snapshot.size;

      if (totalCount === 0) {
        const result: UpdateResult & { logFilePath?: string } = {
          successCount: 0,
          failureCount: 0,
          totalCount: 0,
        };

        if (logCollector && options.log) {
          result.logFilePath = logCollector.finalize(options.log);
        }

        return result;
      }

      // Use BulkWriter for efficient batch operations (no 500 limit)
      const bulkWriter = this.firestore.bulkWriter();

      // Track progress
      let processedCount = 0;

      // Map to track document IDs for logging
      const docIdMap = new Map<string, string>();
      for (const doc of snapshot.docs) {
        docIdMap.set(doc.ref.path, doc.id);
      }

      // Set up success/failure callbacks
      bulkWriter.onWriteResult((ref) => {
        successCount++;
        processedCount++;

        const docId = docIdMap.get(ref.path) || ref.id;
        logCollector?.addEntry(docId, "success");

        if (options.onProgress) {
          const progress = calculateProgress(processedCount, totalCount);
          options.onProgress(progress);
        }
      });

      bulkWriter.onWriteError((error) => {
        failureCount++;
        processedCount++;

        // Extract document ID from error if available
        const docId = error.documentRef?.id || "unknown";
        failedDocIds.push(docId);
        logCollector?.addEntry(docId, "failure", error.message);

        if (options.onProgress) {
          const progress = calculateProgress(processedCount, totalCount);
          options.onProgress(progress);
        }

        // Return false to not retry (we'll collect all errors)
        return false;
      });

      // Queue all updates
      for (const doc of snapshot.docs) {
        bulkWriter.update(doc.ref, updateData);
      }

      // Execute all updates
      await bulkWriter.close();
    }

    const result: UpdateResult & { logFilePath?: string } = {
      successCount,
      failureCount,
      totalCount,
      failedDocIds: failedDocIds.length > 0 ? failedDocIds : undefined,
    };

    // Write log file if enabled
    if (logCollector && options.log) {
      result.logFilePath = logCollector.finalize(options.log);
    }

    return result;
  }

  /**
   * Get specific field values from matching documents
   * @param fieldPath - Field path to retrieve
   * @returns Array of field values with document IDs
   */
  async getFields(fieldPath: string): Promise<FieldValue[]> {
    this.validateSetup();

    const query = this.buildQuery();
    const snapshot = await query.get();

    const results: FieldValue[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const value = this.getNestedValue(data, fieldPath);

      results.push({
        id: doc.id,
        value,
      });
    }

    return results;
  }

  /**
   * Create multiple documents in batch
   * @param documents - Array of documents to create
   * @param options - Create options (e.g., progress callback, log options)
   * @returns Create result with success/failure counts, created IDs, and optional log file path
   */
  async create(
    documents: CreateDocumentInput[],
    options: CreateOptions = {}
  ): Promise<CreateResult & { logFilePath?: string }> {
    this.validateSetup();

    if (!Array.isArray(documents) || documents.length === 0) {
      throw new Error("Documents array must be non-empty");
    }

    for (const doc of documents) {
      if (!isValidUpdateData(doc.data)) {
        throw new Error("Each document must have valid data");
      }
    }

    const totalCount = documents.length;
    let successCount = 0;
    let failureCount = 0;
    const createdIds: string[] = [];
    const failedDocIds: string[] = [];

    // Initialize log collector if logging is enabled
    const logCollector = options.log?.enabled
      ? createLogCollector("create", this.collectionPath!)
      : null;

    const bulkWriter = this.firestore.bulkWriter();
    const collection = this.firestore.collection(this.collectionPath!);

    let processedCount = 0;

    bulkWriter.onWriteResult((ref) => {
      successCount++;
      processedCount++;
      createdIds.push(ref.id);
      logCollector?.addEntry(ref.id, "success");

      if (options.onProgress) {
        const progress = calculateProgress(processedCount, totalCount);
        options.onProgress(progress);
      }
    });

    bulkWriter.onWriteError((error) => {
      failureCount++;
      processedCount++;

      const docId = error.documentRef?.id || "unknown";
      failedDocIds.push(docId);
      logCollector?.addEntry(docId, "failure", error.message);

      if (options.onProgress) {
        const progress = calculateProgress(processedCount, totalCount);
        options.onProgress(progress);
      }

      return false;
    });

    for (const doc of documents) {
      const docRef = doc.id ? collection.doc(doc.id) : collection.doc();
      bulkWriter.create(docRef, doc.data);
    }

    await bulkWriter.close();

    const result: CreateResult & { logFilePath?: string } = {
      successCount,
      failureCount,
      totalCount,
      createdIds,
      failedDocIds: failedDocIds.length > 0 ? failedDocIds : undefined,
    };

    // Write log file if enabled
    if (logCollector && options.log) {
      result.logFilePath = logCollector.finalize(options.log);
    }

    return result;
  }

  /**
   * Upsert documents matching query conditions
   * Updates existing documents or creates them if they don't exist
   * @param updateData - Data to set/merge
   * @param options - Upsert options (e.g., progress callback, log options, batchSize for pagination)
   * @returns Upsert result with success/failure counts and optional log file path
   */
  async upsert(
    updateData: Record<string, any>,
    options: UpsertOptions = {}
  ): Promise<UpsertResult & { logFilePath?: string }> {
    this.validateSetup();

    if (!isValidUpdateData(updateData)) {
      throw new Error("Update data must be a non-empty object");
    }

    // Initialize log collector if logging is enabled
    const logCollector = options.log?.enabled
      ? createLogCollector("upsert", this.collectionPath!, this.conditions, updateData)
      : null;

    let successCount = 0;
    let failureCount = 0;
    let totalCount = 0;
    const failedDocIds: string[] = [];

    // Use pagination if batchSize is set
    if (options.batchSize && options.batchSize > 0) {
      // First, get total count for progress tracking
      const countQuery = this.buildQuery();
      const countSnapshot = await countQuery.count().get();
      totalCount = countSnapshot.data().count;

      if (totalCount === 0) {
        const result: UpsertResult & { logFilePath?: string } = {
          successCount: 0,
          failureCount: 0,
          totalCount: 0,
        };

        if (logCollector && options.log) {
          result.logFilePath = logCollector.finalize(options.log);
        }

        return result;
      }

      let processedCount = 0;
      let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;

      while (true) {
        // Build paginated query
        let paginatedQuery = this.buildQuery().limit(options.batchSize);
        if (lastDoc) {
          paginatedQuery = paginatedQuery.startAfter(lastDoc);
        }

        const snapshot = await paginatedQuery.get();

        if (snapshot.empty) {
          break;
        }

        // Process this batch
        const bulkWriter = this.firestore.bulkWriter();
        const docIdMap = new Map<string, string>();

        for (const doc of snapshot.docs) {
          docIdMap.set(doc.ref.path, doc.id);
        }

        bulkWriter.onWriteResult((ref) => {
          successCount++;
          processedCount++;

          const docId = docIdMap.get(ref.path) || ref.id;
          logCollector?.addEntry(docId, "success");

          if (options.onProgress) {
            const progress = calculateProgress(processedCount, totalCount);
            options.onProgress(progress);
          }
        });

        bulkWriter.onWriteError((error) => {
          failureCount++;
          processedCount++;

          const docId = error.documentRef?.id || "unknown";
          failedDocIds.push(docId);
          logCollector?.addEntry(docId, "failure", error.message);

          if (options.onProgress) {
            const progress = calculateProgress(processedCount, totalCount);
            options.onProgress(progress);
          }

          return false;
        });

        for (const doc of snapshot.docs) {
          bulkWriter.set(doc.ref, updateData, { merge: true });
        }

        await bulkWriter.close();

        // Update cursor for next batch
        lastDoc = snapshot.docs[snapshot.docs.length - 1];

        // If we got fewer docs than batchSize, we're done
        if (snapshot.docs.length < options.batchSize) {
          break;
        }
      }
    } else {
      // Original behavior: load all documents at once
      const query = this.buildQuery();
      const snapshot = await query.get();

      totalCount = snapshot.size;

      if (totalCount === 0) {
        const result: UpsertResult & { logFilePath?: string } = {
          successCount: 0,
          failureCount: 0,
          totalCount: 0,
        };

        if (logCollector && options.log) {
          result.logFilePath = logCollector.finalize(options.log);
        }

        return result;
      }

      const bulkWriter = this.firestore.bulkWriter();

      let processedCount = 0;

      // Map to track document IDs for logging
      const docIdMap = new Map<string, string>();
      for (const doc of snapshot.docs) {
        docIdMap.set(doc.ref.path, doc.id);
      }

      bulkWriter.onWriteResult((ref) => {
        successCount++;
        processedCount++;

        const docId = docIdMap.get(ref.path) || ref.id;
        logCollector?.addEntry(docId, "success");

        if (options.onProgress) {
          const progress = calculateProgress(processedCount, totalCount);
          options.onProgress(progress);
        }
      });

      bulkWriter.onWriteError((error) => {
        failureCount++;
        processedCount++;

        const docId = error.documentRef?.id || "unknown";
        failedDocIds.push(docId);
        logCollector?.addEntry(docId, "failure", error.message);

        if (options.onProgress) {
          const progress = calculateProgress(processedCount, totalCount);
          options.onProgress(progress);
        }

        return false;
      });

      for (const doc of snapshot.docs) {
        bulkWriter.set(doc.ref, updateData, { merge: true });
      }

      await bulkWriter.close();
    }

    const result: UpsertResult & { logFilePath?: string } = {
      successCount,
      failureCount,
      totalCount,
      failedDocIds: failedDocIds.length > 0 ? failedDocIds : undefined,
    };

    // Write log file if enabled
    if (logCollector && options.log) {
      result.logFilePath = logCollector.finalize(options.log);
    }

    return result;
  }

  /**
   * Validate that collection is set
   * @private
   */
  private validateSetup(): void {
    if (!this.collectionPath) {
      throw new Error("Collection path is required. Call .collection() first.");
    }
  }

  /**
   * Build Firestore query with all conditions
   * @private
   */
  private buildQuery(): Query<DocumentData> {
    let query: Query<DocumentData> = this.firestore.collection(
      this.collectionPath!
    );

    for (const condition of this.conditions) {
      query = query.where(condition.field, condition.operator, condition.value);
    }

    return query;
  }

  /**
   * Get nested value from object using dot notation
   * @private
   */
  private getNestedValue(obj: any, path: string): any {
    const keys = path.split(".");
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }
}
