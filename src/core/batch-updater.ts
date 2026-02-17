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

import { AggregateField } from "firebase-admin/firestore";

import type {
  UpdateOptions,
  UpdateResult,
  PreviewResult,
  DocumentSnapshot,
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
  private isCollectionGroup: boolean = false;
  private conditions: WhereCondition[] = [];
  private orderByConditions: OrderByCondition[] = [];
  private limitCount?: number;
  private selectedFields?: string[];

  /**
   * Create a new BatchUpdater instance
   * @param firestore - Initialized Firestore instance from firebase-admin
   */
  constructor(firestore: Firestore) {
    this.firestore = firestore;
  }

  /**
   * Select a collection to operate on
   * Supports subcollection paths like "users/userId/orders"
   * @param path - Collection path
   * @returns This instance for chaining
   */
  collection(path: string): this {
    this.collectionPath = path;
    this.isCollectionGroup = false;
    this.conditions = [];
    this.orderByConditions = [];
    this.limitCount = undefined;
    this.selectedFields = undefined;
    return this;
  }

  /**
   * Select a collection group to operate on (queries across all subcollections with the same name)
   * @param collectionId - Collection ID (not a path, just the collection name)
   * @returns This instance for chaining
   */
  collectionGroup(collectionId: string): this {
    this.collectionPath = collectionId;
    this.isCollectionGroup = true;
    this.conditions = [];
    this.orderByConditions = [];
    this.limitCount = undefined;
    this.selectedFields = undefined;
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
   * Add an orderBy clause to sort documents
   * @param field - Field path to sort by
   * @param direction - Sort direction ('asc' or 'desc'), defaults to 'asc'
   * @returns This instance for chaining
   */
  orderBy(field: string, direction: "asc" | "desc" = "asc"): this {
    this.orderByConditions.push({ field, direction });
    return this;
  }

  /**
   * Limit the number of documents to process
   * @param count - Maximum number of documents
   * @returns This instance for chaining
   */
  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  /**
   * Select specific fields to retrieve (reduces memory usage and read costs)
   * @param fields - Field paths to retrieve
   * @returns This instance for chaining
   */
  select(...fields: string[]): this {
    this.selectedFields = fields;
    return this;
  }

  /**
   * Count documents matching the query conditions
   * @returns Count result with number of matching documents
   */
  async count(): Promise<CountResult> {
    this.validateSetup();

    const query = this.buildQuery();
    const snapshot = await query.count().get();

    return {
      count: snapshot.data().count,
    };
  }

  /**
   * Find the first document matching the query conditions
   * @returns First matching document with id and data, or null if not found
   */
  async findOne(): Promise<{ id: string; data: Record<string, any> } | null> {
    this.validateSetup();

    const query = this.buildQuery().limit(1);
    const snapshot = await query.get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      data: doc.data(),
    };
  }

  /**
   * Check if any documents match the query conditions
   * @returns True if at least one document exists, false otherwise
   */
  async exists(): Promise<boolean> {
    this.validateSetup();

    const query = this.buildQuery().limit(1);
    const snapshot = await query.count().get();

    return snapshot.data().count > 0;
  }

  /**
   * Get all documents matching the query conditions
   * @returns Array of documents with id and data
   */
  async getAll(): Promise<{ id: string; data: Record<string, any> }[]> {
    this.validateSetup();

    const query = this.buildQuery();
    const snapshot = await query.get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      data: doc.data(),
    }));
  }

  /**
   * Get a document by its ID directly (faster than findOne with where)
   * @param id - Document ID
   * @returns Document with id and data, or null if not found
   */
  async getOne(id: string): Promise<{ id: string; data: Record<string, any> } | null> {
    this.validateSetup();

    if (this.isCollectionGroup) {
      throw new Error(
        "getOne() cannot be used with collectionGroup(). Use findOne() with where conditions instead."
      );
    }

    const docRef = this.firestore.collection(this.collectionPath!).doc(id);

    // Apply select if specified
    let docSnapshot;
    if (this.selectedFields && this.selectedFields.length > 0) {
      // For select with getOne, we need to use a query with documentId
      const query = this.firestore
        .collection(this.collectionPath!)
        .where("__name__", "==", docRef)
        .select(...this.selectedFields);
      const snapshot = await query.get();
      if (snapshot.empty) {
        return null;
      }
      docSnapshot = snapshot.docs[0];
    } else {
      docSnapshot = await docRef.get();
      if (!docSnapshot.exists) {
        return null;
      }
    }

    return {
      id: docSnapshot.id,
      data: docSnapshot.data() as Record<string, any>,
    };
  }

  /**
   * Update the first document matching the query conditions
   * @param updateData - Data to update
   * @returns Result with success status and document id
   */
  async updateOne(
    updateData: Record<string, any>
  ): Promise<{ success: boolean; id: string | null }> {
    this.validateSetup();

    if (!isValidUpdateData(updateData)) {
      throw new Error("Update data must be a non-empty object");
    }

    const query = this.buildQuery().limit(1);
    const snapshot = await query.get();

    if (snapshot.empty) {
      return { success: false, id: null };
    }

    const doc = snapshot.docs[0];
    await doc.ref.update(updateData);

    return { success: true, id: doc.id };
  }

  /**
   * Delete the first document matching the query conditions
   * @returns Result with success status and document id
   */
  async deleteOne(): Promise<{ success: boolean; id: string | null }> {
    this.validateSetup();

    const query = this.buildQuery().limit(1);
    const snapshot = await query.get();

    if (snapshot.empty) {
      return { success: false, id: null };
    }

    const doc = snapshot.docs[0];
    await doc.ref.delete();

    return { success: true, id: doc.id };
  }

  /**
   * Create a single document in the collection
   * @param data - Document data
   * @param id - Optional document ID (auto-generated if not provided)
   * @returns Result with success status and document id
   */
  async createOne(
    data: Record<string, any>,
    id?: string
  ): Promise<{ success: boolean; id: string }> {
    this.validateSetup();

    if (this.isCollectionGroup) {
      throw new Error(
        "createOne() cannot be used with collectionGroup(). Use collection() with a specific path instead."
      );
    }

    if (!isValidUpdateData(data)) {
      throw new Error("Document data must be a non-empty object");
    }

    const collection = this.firestore.collection(this.collectionPath!);
    const docRef = id ? collection.doc(id) : collection.doc();
    await docRef.set(data);

    return { success: true, id: docRef.id };
  }

  /**
   * Run aggregate queries (sum, average, count) on matching documents
   * @param spec - Aggregate specification defining operations and fields
   * @returns Object with alias keys and numeric results
   */
  async aggregate(spec: AggregateSpec): Promise<AggregateResult> {
    this.validateSetup();

    if (!spec || Object.keys(spec).length === 0) {
      throw new Error("Aggregate spec must be a non-empty object");
    }

    const query = this.buildQuery();

    // Build aggregate fields
    const aggregateFields: Record<string, ReturnType<typeof AggregateField.sum>> = {};

    for (const [alias, definition] of Object.entries(spec)) {
      switch (definition.op) {
        case "sum":
          if (!definition.field) {
            throw new Error(`Field is required for sum operation (alias: ${alias})`);
          }
          aggregateFields[alias] = AggregateField.sum(definition.field);
          break;
        case "average":
          if (!definition.field) {
            throw new Error(`Field is required for average operation (alias: ${alias})`);
          }
          aggregateFields[alias] = AggregateField.average(definition.field);
          break;
        case "count":
          aggregateFields[alias] = AggregateField.count();
          break;
        default:
          throw new Error(`Unknown aggregate operation: ${(definition as any).op}`);
      }
    }

    const snapshot = await query.aggregate(aggregateFields).get();
    const data = snapshot.data();

    const result: AggregateResult = {};
    for (const alias of Object.keys(spec)) {
      result[alias] = (data as any)[alias] ?? null;
    }

    return result;
  }

  /**
   * Get documents with cursor-based pagination
   * @param options - Pagination options (pageSize, startAfter cursor)
   * @returns Page of documents with cursor for next page
   */
  async paginate(options: PaginateOptions): Promise<PaginateResult> {
    this.validateSetup();

    if (!options.pageSize || options.pageSize <= 0) {
      throw new Error("pageSize must be a positive number");
    }

    // Fetch one extra document to determine if there are more pages
    let query = this.buildQuery().limit(options.pageSize + 1);

    if (options.startAfter) {
      query = query.startAfter(options.startAfter);
    }

    const snapshot = await query.get();
    const hasMore = snapshot.docs.length > options.pageSize;

    // Only return pageSize documents
    const docs = snapshot.docs.slice(0, options.pageSize).map((doc) => ({
      id: doc.id,
      data: doc.data(),
    }));

    // The cursor is the last document snapshot for startAfter
    const lastDoc = snapshot.docs.length > 0
      ? snapshot.docs[Math.min(snapshot.docs.length - 1, options.pageSize - 1)]
      : null;

    return {
      docs,
      nextCursor: hasMore ? lastDoc : null,
      hasMore,
    };
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
   * @param options - Update options (e.g., progress callback, log options, batchSize for pagination, dryRun)
   * @returns Update result with success/failure counts and optional log file path, or DryRunResult if dryRun is true
   */
  async update(
    updateData: Record<string, any>,
    options: UpdateOptions = {}
  ): Promise<(UpdateResult & { logFilePath?: string }) | DryRunResult> {
    this.validateSetup();

    if (!isValidUpdateData(updateData)) {
      throw new Error("Update data must be a non-empty object");
    }

    // Handle dry run mode
    if (options.dryRun) {
      const query = this.buildQuery();
      const snapshot = await query.limit(10).get();
      const countSnapshot = await this.buildQuery().count().get();

      return {
        wouldAffect: countSnapshot.data().count,
        sampleIds: snapshot.docs.map((doc) => doc.id),
        operation: "update",
      } as DryRunResult;
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
  async getFields(fieldPath: string): Promise<FieldValueResult[]> {
    this.validateSetup();

    const query = this.buildQuery();
    const snapshot = await query.get();

    const results: FieldValueResult[] = [];

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
   * Note: This method does not work with collectionGroup()
   * @param documents - Array of documents to create
   * @param options - Create options (e.g., progress callback, log options)
   * @returns Create result with success/failure counts, created IDs, and optional log file path
   */
  async create(
    documents: CreateDocumentInput[],
    options: CreateOptions = {}
  ): Promise<CreateResult & { logFilePath?: string }> {
    this.validateSetup();

    if (this.isCollectionGroup) {
      throw new Error("create() cannot be used with collectionGroup(). Use collection() with a specific path instead.");
    }

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
   * Update multiple documents with different data for each
   * @param updates - Array of { id, data } objects specifying updates for each document
   * @param options - Bulk update options (e.g., progress callback, log options)
   * @returns Bulk update result with success/failure counts and optional log file path
   */
  async bulkUpdate(
    updates: BulkUpdateInput[],
    options: BulkUpdateOptions = {}
  ): Promise<BulkUpdateResult & { logFilePath?: string }> {
    this.validateSetup();

    if (this.isCollectionGroup) {
      throw new Error(
        "bulkUpdate() cannot be used with collectionGroup(). Use collection() with a specific path instead."
      );
    }

    if (!Array.isArray(updates) || updates.length === 0) {
      throw new Error("Updates array must be non-empty");
    }

    for (const update of updates) {
      if (!update.id || typeof update.id !== "string") {
        throw new Error("Each update must have a valid id");
      }
      if (!isValidUpdateData(update.data)) {
        throw new Error("Each update must have valid data");
      }
    }

    const totalCount = updates.length;
    let successCount = 0;
    let failureCount = 0;
    const failedDocIds: string[] = [];

    // Initialize log collector if logging is enabled
    const logCollector = options.log?.enabled
      ? createLogCollector("update", this.collectionPath!)
      : null;

    const bulkWriter = this.firestore.bulkWriter();
    const collection = this.firestore.collection(this.collectionPath!);

    let processedCount = 0;

    // Map to track document IDs for logging
    const docIdMap = new Map<string, string>();
    for (const update of updates) {
      const docRef = collection.doc(update.id);
      docIdMap.set(docRef.path, update.id);
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

    for (const update of updates) {
      const docRef = collection.doc(update.id);
      bulkWriter.update(docRef, update.data);
    }

    await bulkWriter.close();

    const result: BulkUpdateResult & { logFilePath?: string } = {
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
   * Create multiple documents in bulk with different data for each
   * @param documents - Array of { id?, data } objects specifying documents to create
   * @param options - Bulk create options (e.g., progress callback, log options)
   * @returns Bulk create result with success/failure counts, created IDs, and optional log file path
   */
  async bulkCreate(
    documents: BulkCreateInput[],
    options: BulkCreateOptions = {}
  ): Promise<BulkCreateResult & { logFilePath?: string }> {
    this.validateSetup();

    if (this.isCollectionGroup) {
      throw new Error(
        "bulkCreate() cannot be used with collectionGroup(). Use collection() with a specific path instead."
      );
    }

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

    const result: BulkCreateResult & { logFilePath?: string } = {
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
   * Delete multiple documents by their IDs
   * @param ids - Array of document IDs to delete
   * @param options - Bulk delete options (e.g., progress callback, log options)
   * @returns Bulk delete result with success/failure counts, deleted IDs, and optional log file path
   */
  async bulkDelete(
    ids: string[],
    options: BulkDeleteOptions = {}
  ): Promise<BulkDeleteResult & { logFilePath?: string }> {
    this.validateSetup();

    if (this.isCollectionGroup) {
      throw new Error(
        "bulkDelete() cannot be used with collectionGroup(). Use collection() with a specific path instead."
      );
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error("IDs array must be non-empty");
    }

    for (const id of ids) {
      if (!id || typeof id !== "string") {
        throw new Error("Each ID must be a valid non-empty string");
      }
    }

    const totalCount = ids.length;
    let successCount = 0;
    let failureCount = 0;
    const deletedIds: string[] = [];
    const failedDocIds: string[] = [];

    // Initialize log collector if logging is enabled
    const logCollector = options.log?.enabled
      ? createLogCollector("delete", this.collectionPath!)
      : null;

    const bulkWriter = this.firestore.bulkWriter();
    const collection = this.firestore.collection(this.collectionPath!);

    let processedCount = 0;

    // Map to track document IDs for logging
    const docIdMap = new Map<string, string>();
    for (const id of ids) {
      const docRef = collection.doc(id);
      docIdMap.set(docRef.path, id);
    }

    bulkWriter.onWriteResult((ref) => {
      successCount++;
      processedCount++;

      const docId = docIdMap.get(ref.path) || ref.id;
      deletedIds.push(docId);
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

    for (const id of ids) {
      const docRef = collection.doc(id);
      bulkWriter.delete(docRef);
    }

    await bulkWriter.close();

    const result: BulkDeleteResult & { logFilePath?: string } = {
      successCount,
      failureCount,
      totalCount,
      deletedIds,
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
   * @param options - Upsert options (e.g., progress callback, log options, batchSize for pagination, dryRun)
   * @returns Upsert result with success/failure counts and optional log file path, or DryRunResult if dryRun is true
   */
  async upsert(
    updateData: Record<string, any>,
    options: UpsertOptions = {}
  ): Promise<(UpsertResult & { logFilePath?: string }) | DryRunResult> {
    this.validateSetup();

    if (!isValidUpdateData(updateData)) {
      throw new Error("Update data must be a non-empty object");
    }

    // Handle dry run mode
    if (options.dryRun) {
      const query = this.buildQuery();
      const snapshot = await query.limit(10).get();
      const countSnapshot = await this.buildQuery().count().get();

      return {
        wouldAffect: countSnapshot.data().count,
        sampleIds: snapshot.docs.map((doc) => doc.id),
        operation: "upsert",
      } as DryRunResult;
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
   * Delete documents matching query conditions
   * @param options - Delete options (e.g., progress callback, log options, batchSize for pagination, dryRun)
   * @returns Delete result with success/failure counts, deleted IDs, and optional log file path, or DryRunResult if dryRun is true
   */
  async delete(
    options: DeleteOptions = {}
  ): Promise<(DeleteResult & { logFilePath?: string }) | DryRunResult> {
    this.validateSetup();

    // Handle dry run mode
    if (options.dryRun) {
      const query = this.buildQuery();
      const snapshot = await query.limit(10).get();
      const countSnapshot = await this.buildQuery().count().get();

      return {
        wouldAffect: countSnapshot.data().count,
        sampleIds: snapshot.docs.map((doc) => doc.id),
        operation: "delete",
      } as DryRunResult;
    }

    // Initialize log collector if logging is enabled
    const logCollector = options.log?.enabled
      ? createLogCollector("delete", this.collectionPath!, this.conditions)
      : null;

    let successCount = 0;
    let failureCount = 0;
    let totalCount = 0;
    const deletedIds: string[] = [];
    const failedDocIds: string[] = [];

    // Use pagination if batchSize is set
    if (options.batchSize && options.batchSize > 0) {
      // First, get total count for progress tracking
      const countQuery = this.buildQuery();
      const countSnapshot = await countQuery.count().get();
      totalCount = countSnapshot.data().count;

      if (totalCount === 0) {
        const result: DeleteResult & { logFilePath?: string } = {
          successCount: 0,
          failureCount: 0,
          totalCount: 0,
          deletedIds: [],
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
          deletedIds.push(docId);
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
          bulkWriter.delete(doc.ref);
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
        const result: DeleteResult & { logFilePath?: string } = {
          successCount: 0,
          failureCount: 0,
          totalCount: 0,
          deletedIds: [],
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
        deletedIds.push(docId);
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
        bulkWriter.delete(doc.ref);
      }

      await bulkWriter.close();
    }

    const result: DeleteResult & { logFilePath?: string } = {
      successCount,
      failureCount,
      totalCount,
      deletedIds,
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
    let query: Query<DocumentData> = this.isCollectionGroup
      ? this.firestore.collectionGroup(this.collectionPath!)
      : this.firestore.collection(this.collectionPath!);

    for (const condition of this.conditions) {
      query = query.where(condition.field, condition.operator, condition.value);
    }

    for (const orderBy of this.orderByConditions) {
      query = query.orderBy(orderBy.field, orderBy.direction);
    }

    if (this.limitCount !== undefined && this.limitCount > 0) {
      query = query.limit(this.limitCount);
    }

    if (this.selectedFields && this.selectedFields.length > 0) {
      query = query.select(...this.selectedFields);
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
