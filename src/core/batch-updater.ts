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

import { AggregateField, FieldValue } from "firebase-admin/firestore";

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
  FieldStatsResult,
  GroupByResult,
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
   * Check if no documents match the query conditions
   * Opposite of exists() - returns true when the collection/query has no matching documents
   * @returns true if no documents match, false otherwise
   */
  async isEmpty(): Promise<boolean> {
    const result = await this.exists();
    return !result;
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
   * Check if a document with the given ID exists in the collection
   * @param id - Document ID to check
   * @returns true if the document exists, false otherwise
   */
  async has(id: string): Promise<boolean> {
    this.validateSetup();

    if (!id || typeof id !== "string") {
      throw new Error("Document ID is required");
    }

    if (this.isCollectionGroup) {
      throw new Error(
        "has() cannot be used with collectionGroup(). Use exists() with where conditions instead."
      );
    }

    const docRef = this.firestore.collection(this.collectionPath!).doc(id);
    const docSnapshot = await docRef.get();

    return docSnapshot.exists;
  }

  /**
   * Get multiple documents by their IDs in a single call
   * @param ids - Array of document IDs to retrieve
   * @returns Array of documents with id and data (skips non-existent documents)
   */
  async pick(ids: string[]): Promise<{ id: string; data: Record<string, any> }[]> {
    this.validateSetup();

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error("Document IDs array is required and must not be empty");
    }

    if (this.isCollectionGroup) {
      throw new Error(
        "pick() cannot be used with collectionGroup(). Use getAll() with where conditions instead."
      );
    }

    const docRefs = ids.map((id) =>
      this.firestore.collection(this.collectionPath!).doc(id)
    );

    const snapshots = await this.firestore.getAll(...docRefs);

    return snapshots
      .filter((snap) => snap.exists)
      .map((snap) => ({
        id: snap.id,
        data: snap.data() as Record<string, any>,
      }));
  }

  /**
   * Get the first document based on the current orderBy conditions
   * Requires at least one orderBy() to be set
   * @returns First document with id and data, or null if no documents match
   */
  async first(): Promise<{ id: string; data: Record<string, any> } | null> {
    this.validateSetup();

    if (this.orderByConditions.length === 0) {
      throw new Error("first() requires at least one orderBy() condition");
    }

    const query = this.buildQuery().limit(1);
    const snapshot = await query.get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return { id: doc.id, data: doc.data() };
  }

  /**
   * Get the last document based on the current orderBy conditions
   * Requires at least one orderBy() to be set
   * Reverses the orderBy direction internally to fetch the last document efficiently
   * @returns Last document with id and data, or null if no documents match
   */
  async last(): Promise<{ id: string; data: Record<string, any> } | null> {
    this.validateSetup();

    if (this.orderByConditions.length === 0) {
      throw new Error("last() requires at least one orderBy() condition");
    }

    let query: Query<DocumentData> = this.isCollectionGroup
      ? this.firestore.collectionGroup(this.collectionPath!)
      : this.firestore.collection(this.collectionPath!);

    for (const condition of this.conditions) {
      query = query.where(condition.field, condition.operator, condition.value);
    }

    for (const orderBy of this.orderByConditions) {
      query = query.orderBy(
        orderBy.field,
        orderBy.direction === "asc" ? "desc" : "asc"
      );
    }

    if (this.selectedFields && this.selectedFields.length > 0) {
      query = query.select(...this.selectedFields);
    }

    query = query.limit(1);
    const snapshot = await query.get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return { id: doc.id, data: doc.data() };
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
   * Get the sum of a numeric field from matching documents
   * Convenience wrapper around aggregate() for simple sum queries
   * @param field - Field path to sum
   * @returns Sum of the field values, or null if no documents match
   */
  async sum(field: string): Promise<number | null> {
    this.validateSetup();

    if (!field) {
      throw new Error("Field is required for sum operation");
    }

    const result = await this.aggregate({
      _sum: { op: "sum", field },
    });

    return result._sum;
  }

  /**
   * Get the average of a numeric field from matching documents
   * Convenience wrapper around aggregate() for simple average queries
   * @param field - Field path to average
   * @returns Average of the field values, or null if no documents match
   */
  async avg(field: string): Promise<number | null> {
    this.validateSetup();

    if (!field) {
      throw new Error("Field is required for average operation");
    }

    const result = await this.aggregate({
      _avg: { op: "average", field },
    });

    return result._avg;
  }

  /**
   * Get the minimum value of a numeric field from matching documents
   * Uses orderBy + limit(1) since Firestore doesn't support min/max aggregation natively
   * @param field - Field path to find the minimum value of
   * @returns Minimum field value, or null if no documents match
   */
  async min(field: string): Promise<any> {
    this.validateSetup();

    if (!field || typeof field !== "string") {
      throw new Error("Field is required for min operation");
    }

    let query: Query<DocumentData> = this.isCollectionGroup
      ? this.firestore.collectionGroup(this.collectionPath!)
      : this.firestore.collection(this.collectionPath!);

    for (const condition of this.conditions) {
      query = query.where(condition.field, condition.operator, condition.value);
    }

    query = query.orderBy(field, "asc").limit(1);

    const snapshot = await query.get();
    if (snapshot.empty) {
      return null;
    }

    const value = this.getNestedValue(snapshot.docs[0].data(), field);
    return value ?? null;
  }

  /**
   * Get the maximum value of a numeric field from matching documents
   * Uses orderBy + limit(1) since Firestore doesn't support min/max aggregation natively
   * @param field - Field path to find the maximum value of
   * @returns Maximum field value, or null if no documents match
   */
  async max(field: string): Promise<any> {
    this.validateSetup();

    if (!field || typeof field !== "string") {
      throw new Error("Field is required for max operation");
    }

    let query: Query<DocumentData> = this.isCollectionGroup
      ? this.firestore.collectionGroup(this.collectionPath!)
      : this.firestore.collection(this.collectionPath!);

    for (const condition of this.conditions) {
      query = query.where(condition.field, condition.operator, condition.value);
    }

    query = query.orderBy(field, "desc").limit(1);

    const snapshot = await query.get();
    if (snapshot.empty) {
      return null;
    }

    const value = this.getNestedValue(snapshot.docs[0].data(), field);
    return value ?? null;
  }

  /**
   * Get combined statistics (sum, avg, min, max, count) for a single field
   * Convenience method that runs aggregate + min + max in parallel
   * @param field - Field path to compute statistics for
   * @returns Object with sum, avg, min, max, count
   */
  async fieldStats(field: string): Promise<FieldStatsResult> {
    this.validateSetup();

    if (!field || typeof field !== "string") {
      throw new Error("Field is required for fieldStats operation");
    }

    const [aggResult, minVal, maxVal] = await Promise.all([
      this.aggregate({
        _sum: { op: "sum", field },
        _avg: { op: "average", field },
        _count: { op: "count" },
      }),
      this.min(field),
      this.max(field),
    ]);

    return {
      sum: aggResult._sum,
      avg: aggResult._avg,
      min: minVal,
      max: maxVal,
      count: (aggResult._count ?? 0) as number,
    };
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
   * Update a single field on all matching documents
   * Convenience wrapper around update() for single-field updates
   * @param field - Field path to update (supports dot notation for nested fields)
   * @param value - New value for the field
   * @param options - Update options
   * @returns Update result
   */
  async updateField(
    field: string,
    value: any,
    options: UpdateOptions = {}
  ): Promise<(UpdateResult & { logFilePath?: string }) | DryRunResult> {
    if (!field || typeof field !== "string") {
      throw new Error("Field path is required");
    }

    return this.update({ [field]: value }, options);
  }

  /**
   * Rename a field on all matching documents
   * Copies the value to the new field and deletes the old field in a single atomic update
   * Documents that don't have the old field are skipped
   * @param oldField - Current field path
   * @param newField - New field path
   * @param options - Transform options (batchSize, onProgress, log)
   * @returns Transform result with success/skipped/failure counts
   */
  async renameField(
    oldField: string,
    newField: string,
    options: TransformOptions = {}
  ): Promise<TransformResult & { logFilePath?: string }> {
    if (!oldField || typeof oldField !== "string") {
      throw new Error("Old field path is required");
    }
    if (!newField || typeof newField !== "string") {
      throw new Error("New field path is required");
    }
    if (oldField === newField) {
      throw new Error("Old and new field paths must be different");
    }

    return this.transform(
      (doc) => {
        const value = this.getNestedValue(doc.data, oldField);
        if (value === undefined || value === null) {
          return null;
        }
        return {
          [newField]: value,
          [oldField]: FieldValue.delete(),
        };
      },
      options
    );
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
   * Get an array of values for a specific field from matching documents
   * Convenience wrapper around getFields() that returns only values (no IDs)
   * @param field - Field path to extract values from
   * @returns Array of field values (null/undefined values are excluded)
   */
  async pluck(field: string): Promise<any[]> {
    this.validateSetup();

    if (!field || typeof field !== "string") {
      throw new Error("Field path is required");
    }

    const query = this.buildQuery();
    const snapshot = await query.get();

    const values: any[] = [];

    for (const doc of snapshot.docs) {
      const value = this.getNestedValue(doc.data(), field);
      if (value !== undefined && value !== null) {
        values.push(value);
      }
    }

    return values;
  }

  /**
   * Get an array of document IDs from matching documents
   * Useful for passing IDs directly to bulkUpdate(), bulkDelete(), etc.
   * @returns Array of document IDs
   */
  async pluckIds(): Promise<string[]> {
    this.validateSetup();

    const query = this.buildQuery();
    const snapshot = await query.get();

    return snapshot.docs.map((doc) => doc.id);
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
   * Transform matching documents using a custom function
   * Reads each document, applies the transform function, and updates with the result
   * @param transformFn - Function that receives { id, data } and returns update data, or null to skip
   * @param options - Transform options (e.g., progress callback, log options, batchSize)
   * @returns Transform result with success/failure/skipped counts and optional log file path
   */
  async transform(
    transformFn: TransformFn,
    options: TransformOptions = {}
  ): Promise<TransformResult & { logFilePath?: string }> {
    this.validateSetup();

    if (typeof transformFn !== "function") {
      throw new Error("Transform function is required");
    }

    // Initialize log collector if logging is enabled
    const logCollector = options.log?.enabled
      ? createLogCollector("update", this.collectionPath!, this.conditions)
      : null;

    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;
    let totalCount = 0;
    const failedDocIds: string[] = [];

    const processDocuments = async (
      docs: QueryDocumentSnapshot<DocumentData>[],
      processedSoFar: number,
      grandTotal: number
    ) => {
      const bulkWriter = this.firestore.bulkWriter();
      let processedCount = processedSoFar;

      const docIdMap = new Map<string, string>();

      bulkWriter.onWriteResult((ref) => {
        successCount++;
        processedCount++;

        const docId = docIdMap.get(ref.path) || ref.id;
        logCollector?.addEntry(docId, "success");

        if (options.onProgress) {
          const progress = calculateProgress(processedCount, grandTotal);
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
          const progress = calculateProgress(processedCount, grandTotal);
          options.onProgress(progress);
        }

        return false;
      });

      for (const doc of docs) {
        const updateData = transformFn({ id: doc.id, data: doc.data() });

        if (updateData === null) {
          skippedCount++;
          processedCount++;

          if (options.onProgress) {
            const progress = calculateProgress(processedCount, grandTotal);
            options.onProgress(progress);
          }
          continue;
        }

        docIdMap.set(doc.ref.path, doc.id);
        bulkWriter.update(doc.ref, updateData);
      }

      await bulkWriter.close();
      return processedCount;
    };

    if (options.batchSize && options.batchSize > 0) {
      const countSnapshot = await this.buildQuery().count().get();
      totalCount = countSnapshot.data().count;

      if (totalCount === 0) {
        const result: TransformResult & { logFilePath?: string } = {
          successCount: 0,
          failureCount: 0,
          skippedCount: 0,
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
        let paginatedQuery = this.buildQuery().limit(options.batchSize);
        if (lastDoc) {
          paginatedQuery = paginatedQuery.startAfter(lastDoc);
        }

        const snapshot = await paginatedQuery.get();
        if (snapshot.empty) break;

        processedCount = await processDocuments(
          snapshot.docs,
          processedCount,
          totalCount
        );

        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.docs.length < options.batchSize) break;
      }
    } else {
      const query = this.buildQuery();
      const snapshot = await query.get();
      totalCount = snapshot.size;

      if (totalCount === 0) {
        const result: TransformResult & { logFilePath?: string } = {
          successCount: 0,
          failureCount: 0,
          skippedCount: 0,
          totalCount: 0,
        };
        if (logCollector && options.log) {
          result.logFilePath = logCollector.finalize(options.log);
        }
        return result;
      }

      await processDocuments(snapshot.docs, 0, totalCount);
    }

    const result: TransformResult & { logFilePath?: string } = {
      successCount,
      failureCount,
      skippedCount,
      totalCount,
      failedDocIds: failedDocIds.length > 0 ? failedDocIds : undefined,
    };

    if (logCollector && options.log) {
      result.logFilePath = logCollector.finalize(options.log);
    }

    return result;
  }

  /**
   * Copy matching documents to another collection
   * @param targetCollection - Target collection path to copy documents to
   * @param options - Copy options (transform, deleteSource for move, progress callback)
   * @returns Copy result with success/failure counts, copied IDs, and optional log file path
   */
  async copyTo(
    targetCollection: string,
    options: CopyToOptions = {}
  ): Promise<CopyToResult & { logFilePath?: string }> {
    this.validateSetup();

    if (!targetCollection || typeof targetCollection !== "string") {
      throw new Error("Target collection path is required");
    }

    if (this.isCollectionGroup) {
      throw new Error(
        "copyTo() cannot be used with collectionGroup(). Use collection() with a specific path instead."
      );
    }

    // Initialize log collector if logging is enabled
    const logCollector = options.log?.enabled
      ? createLogCollector("create", targetCollection)
      : null;

    const query = this.buildQuery();
    const snapshot = await query.get();

    const totalCount = snapshot.size;

    if (totalCount === 0) {
      const result: CopyToResult & { logFilePath?: string } = {
        successCount: 0,
        failureCount: 0,
        totalCount: 0,
        copiedIds: [],
      };
      if (logCollector && options.log) {
        result.logFilePath = logCollector.finalize(options.log);
      }
      return result;
    }

    let successCount = 0;
    let failureCount = 0;
    const copiedIds: string[] = [];
    const failedDocIds: string[] = [];

    const bulkWriter = this.firestore.bulkWriter();
    const targetCol = this.firestore.collection(targetCollection);

    let processedCount = 0;

    const docIdMap = new Map<string, string>();

    bulkWriter.onWriteResult((ref) => {
      successCount++;
      processedCount++;

      const docId = docIdMap.get(ref.path) || ref.id;
      copiedIds.push(docId);
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
      let data = doc.data();

      // Apply transform if provided
      if (options.transform) {
        const transformed = options.transform({ id: doc.id, data });
        if (transformed === null) {
          processedCount++;
          if (options.onProgress) {
            const progress = calculateProgress(processedCount, totalCount);
            options.onProgress(progress);
          }
          continue;
        }
        data = transformed;
      }

      const targetRef = targetCol.doc(doc.id);
      docIdMap.set(targetRef.path, doc.id);
      bulkWriter.set(targetRef, data);
    }

    await bulkWriter.close();

    // Delete source documents if deleteSource is true (move operation)
    if (options.deleteSource && copiedIds.length > 0) {
      const deleteBulkWriter = this.firestore.bulkWriter();
      const sourceCol = this.firestore.collection(this.collectionPath!);

      for (const id of copiedIds) {
        deleteBulkWriter.delete(sourceCol.doc(id));
      }

      await deleteBulkWriter.close();
    }

    const result: CopyToResult & { logFilePath?: string } = {
      successCount,
      failureCount,
      totalCount,
      copiedIds,
      failedDocIds: failedDocIds.length > 0 ? failedDocIds : undefined,
    };

    if (logCollector && options.log) {
      result.logFilePath = logCollector.finalize(options.log);
    }

    return result;
  }

  /**
   * Get distinct (unique) values of a specific field from matching documents
   * @param field - Field path to get unique values for
   * @returns Array of unique values
   */
  async distinct(field: string): Promise<any[]> {
    this.validateSetup();

    if (!field || typeof field !== "string") {
      throw new Error("Field path is required");
    }

    const query = this.buildQuery();
    const snapshot = await query.get();

    const valueSet = new Set<string>();
    const values: any[] = [];

    for (const doc of snapshot.docs) {
      const value = this.getNestedValue(doc.data(), field);
      if (value === undefined || value === null) continue;

      const key = JSON.stringify(value);
      if (!valueSet.has(key)) {
        valueSet.add(key);
        values.push(value);
      }
    }

    return values;
  }

  /**
   * Get a random sample of matching documents
   * @param n - Number of documents to sample
   * @returns Array of randomly selected documents with { id, data }
   */
  async sample(n: number): Promise<{ id: string; data: Record<string, any> }[]> {
    this.validateSetup();

    if (!Number.isInteger(n) || n < 1) {
      throw new Error("Sample size must be a positive integer");
    }

    const query = this.buildQuery();
    const snapshot = await query.get();

    if (snapshot.empty) {
      return [];
    }

    const docs = snapshot.docs.map((doc) => ({
      id: doc.id,
      data: doc.data(),
    }));

    if (docs.length <= n) {
      return docs;
    }

    // Fisher-Yates shuffle (partial - only shuffle first n elements)
    for (let i = docs.length - 1; i > docs.length - 1 - n; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [docs[i], docs[j]] = [docs[j], docs[i]];
    }

    return docs.slice(docs.length - n);
  }

  /**
   * Export matching documents to a JSON file
   * @param filePath - Path for the output JSON file
   * @param options - Export options (pretty print)
   * @returns Result with file path and document count
   */
  async toJSON(
    filePath: string,
    options: ToJSONOptions = {}
  ): Promise<ToJSONResult> {
    this.validateSetup();

    if (!filePath || typeof filePath !== "string") {
      throw new Error("File path is required");
    }

    const query = this.buildQuery();
    const snapshot = await query.get();

    const documents = snapshot.docs.map((doc) => ({
      id: doc.id,
      data: doc.data(),
    }));

    const pretty = options.pretty !== false; // default true
    const json = pretty
      ? JSON.stringify(documents, null, 2)
      : JSON.stringify(documents);

    // Ensure directory exists
    const fs = await import("fs");
    const path = await import("path");
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, json, "utf-8");

    return {
      filePath,
      documentCount: documents.length,
    };
  }

  /**
   * Count documents grouped by a specific field value
   * @param field - Field path to group by
   * @returns Object mapping field values to their document counts
   */
  async countBy(field: string): Promise<CountByResult> {
    this.validateSetup();

    if (!field || typeof field !== "string") {
      throw new Error("Field path is required");
    }

    const query = this.buildQuery();
    const snapshot = await query.get();

    const counts: CountByResult = {};

    for (const doc of snapshot.docs) {
      const value = this.getNestedValue(doc.data(), field);
      if (value === undefined || value === null) continue;

      const key = String(value);
      counts[key] = (counts[key] || 0) + 1;
    }

    return counts;
  }

  /**
   * Group matching documents by a specific field value
   * @param field - Field path to group by
   * @returns Object mapping field values to arrays of matching documents { id, data }
   */
  async groupBy(field: string): Promise<GroupByResult> {
    this.validateSetup();

    if (!field || typeof field !== "string") {
      throw new Error("Field path is required");
    }

    const query = this.buildQuery();
    const snapshot = await query.get();

    const groups: GroupByResult = {};

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const value = this.getNestedValue(data, field);
      if (value === undefined || value === null) continue;

      const key = String(value);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push({ id: doc.id, data });
    }

    return groups;
  }

  /**
   * Import documents from a JSON file into Firestore
   * @param filePath - Path to the JSON file to import
   * @param options - Import options (progress callback, log options, useIds)
   * @returns Import result with success/failure counts, created IDs, and optional log file path
   */
  async fromJSON(
    filePath: string,
    options: FromJSONOptions = {}
  ): Promise<FromJSONResult & { logFilePath?: string }> {
    this.validateSetup();

    if (this.isCollectionGroup) {
      throw new Error(
        "fromJSON() cannot be used with collectionGroup(). Use collection() with a specific path instead."
      );
    }

    if (!filePath || typeof filePath !== "string") {
      throw new Error("File path is required");
    }

    const fs = await import("fs");

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    let documents: Array<{ id?: string; data: Record<string, any> }>;

    try {
      documents = JSON.parse(fileContent);
    } catch {
      throw new Error("Invalid JSON file");
    }

    if (!Array.isArray(documents) || documents.length === 0) {
      throw new Error("JSON file must contain a non-empty array of documents");
    }

    const useIds = options.useIds !== false; // default true
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
      const docData = doc.data || doc;
      const docRef =
        useIds && doc.id ? collection.doc(doc.id) : collection.doc();
      bulkWriter.set(docRef, docData);
    }

    await bulkWriter.close();

    const result: FromJSONResult & { logFilePath?: string } = {
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
