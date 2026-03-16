# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.11.0] - 2026-03-16

### Added

- **`isEmpty()` method** - Check if no documents match the query conditions
  - Opposite of `exists()` - returns `true` when the collection/query has no matching documents
  - Uses efficient count query internally (same as `exists()`)
  - Useful for guard clauses and empty state checks

## [1.10.0] - 2026-03-09

### Added

- **`countBy()` method** - Count documents grouped by a specific field value
  - Returns an object mapping field values to their document counts
  - Works with `where()` to count from filtered documents
  - Supports nested fields with dot notation
- **`fromJSON()` method** - Import documents from a JSON file into Firestore
  - Accepts `[{ id, data }]` format (compatible with `toJSON()` output)
  - Supports round-trip with `toJSON()` → `fromJSON()`
  - Option to use IDs from JSON or auto-generate new IDs (`useIds` option)
  - Progress tracking and log file support

### Types

- Added `CountByResult` / `FromJSONOptions` / `FromJSONResult` types

## [1.9.0] - 2025-03-02

### Added

- **`distinct()` method** - Get unique values of a specific field from matching documents
  - Returns an array of unique values (strings, numbers, etc.)
  - Works with `where()` to get distinct values from filtered documents
  - Supports nested fields with dot notation
- **`toJSON()` method** - Export matching documents to a JSON file
  - Outputs `[{ id, data }]` format
  - Works with `where()` and `select()` for filtered/partial exports
  - Supports pretty-print (default) or compact format
  - Automatically creates directories if needed

### Types

- Added `ToJSONOptions` / `ToJSONResult` types

## [1.8.0] - 2025-02-23

### Added

- **`transform()` method** - Transform matching documents using a custom function
  - Reads each document, applies a user-defined function, and updates with the result
  - Return `null` from the function to skip a document
  - Returns `TransformResult` with success/failure/skipped counts
  - Supports `batchSize` for large collections
- **`copyTo()` method** - Copy matching documents to another collection
  - Preserves document IDs in the target collection
  - Optional `transform` to modify data during copy
  - Optional `deleteSource: true` for move operations (copy + delete source)
  - Works with `where()` to copy only filtered documents
  - Returns `CopyToResult` with success/failure counts and copied IDs

### Types

- Added `TransformFn` type
- Added `TransformOptions` / `TransformResult` types
- Added `CopyToOptions` / `CopyToResult` types

## [1.7.0] - 2025-02-17

### Added

- **`bulkCreate()` method** - Create multiple documents in bulk with different data for each
  - Supports auto-generated or custom document IDs per document
  - Returns `BulkCreateResult` with success/failure counts and created IDs
  - Completes the bulk CRUD set (bulkCreate, bulkUpdate, bulkDelete)
- **`bulkDelete()` method** - Delete multiple documents by their IDs
  - Accepts an array of document IDs to delete
  - Returns `BulkDeleteResult` with success/failure counts and deleted IDs
  - Idempotent: deleting non-existent documents succeeds silently

### Types

- Added `BulkCreateInput` / `BulkCreateOptions` / `BulkCreateResult` types
- Added `BulkDeleteOptions` / `BulkDeleteResult` types

## [1.6.0] - 2025-02-09

### Added

- **`getOne()` method** - Get a document by its ID directly
  - Returns `{ id, data }` or `null` if not found
  - Faster than `findOne()` when you already know the document ID
  - Works with `select()` for field filtering
- **`bulkUpdate()` method** - Update multiple documents with different data for each
  - Unlike `update()` which applies the same data to all matching documents
  - Each document can have its own update data
  - Useful for rankings, score updates, syncing external data, etc.
  - Returns `BulkUpdateResult` with success/failure counts

### Types

- Added `BulkUpdateInput` type
- Added `BulkUpdateOptions` type
- Added `BulkUpdateResult` type

## [1.5.0] - 2025-02-02

### Added

- **`createOne()` method** - Create a single document in a collection
  - Returns `{ success: boolean, id: string }`
  - Supports auto-generated or custom document IDs
  - Completes the single-document CRUD set (findOne, updateOne, deleteOne, createOne)
- **`aggregate()` method** - Run aggregate queries on matching documents
  - Supports `sum`, `average`, and `count` operations
  - Uses Firestore's native aggregation for efficient server-side computation
  - Works with `where()` conditions for filtered aggregation
- **`paginate()` method** - Cursor-based pagination for large result sets
  - Returns `{ docs, nextCursor, hasMore }` for easy page-by-page iteration
  - Works with `orderBy()`, `select()`, and `where()` conditions
  - Memory-efficient alternative to `getAll()` for large datasets

### Types

- Added `CreateOneResult` type
- Added `AggregateSpec` / `AggregateResult` types
- Added `PaginateOptions` / `PaginateResult` types

## [1.4.0] - 2025-01-26

### Added

- **`exists()` method** - Check if any documents match the query conditions
  - Returns `boolean` - efficient existence check using count query
- **`getAll()` method** - Get all documents matching the query conditions
  - Returns array of `{ id, data }` objects
  - Works with `select()` for field filtering
- **`updateOne()` method** - Update only the first document matching the query
  - Returns `{ success: boolean, id: string | null }`
  - Efficient single-document update without loading all matches
- **`deleteOne()` method** - Delete only the first document matching the query
  - Returns `{ success: boolean, id: string | null }`
  - Efficient single-document deletion

## [1.3.0] - 2025-01-19

### Added

- **`select()` method** - Select specific fields to retrieve, reducing memory usage and read costs
  - Chainable method that works with all query operations
  - Only loads specified fields from Firestore documents
- **`findOne()` method** - Find and return the first document matching query conditions
  - Returns `{ id, data }` object or `null` if no document found
  - Efficient single-document retrieval with optional `where()` and `select()` filtering

## [1.2.0] - 2025-01-14

### Added

- **`count()` method** - Quickly count matching documents without loading them into memory
- **`collectionGroup()` method** - Query all subcollections with the same name across the entire database
- **`dryRun` option** - Simulate update/upsert/delete operations without making any changes
  - Returns `DryRunResult` with `wouldAffect` count and `sampleIds`
- **Subcollection path support** - Use paths like `users/userId/orders` with `collection()`
- **`FieldValue.delete()` documentation** - Added examples for deleting fields

### Types

- Added `CountResult` type
- Added `DryRunResult` type

## [1.1.0] - 2025-01-07

### Added

- **`delete()` method** - Delete documents matching query conditions with progress tracking and pagination support
- **`orderBy()` method** - Sort documents by field in ascending or descending order (chainable)
- **`limit()` method** - Limit the number of documents to process (chainable)
- **`FieldValue` support** - Re-exported from `firebase-admin/firestore` for convenience
  - `FieldValue.increment()` - Increment numeric fields
  - `FieldValue.arrayUnion()` - Add elements to arrays
  - `FieldValue.arrayRemove()` - Remove elements from arrays
  - `FieldValue.serverTimestamp()` - Set server timestamp

### Changed

- Updated examples in `advanced.ts` with new features

## [1.0.0] - 2025-01-06

### Added

- **`BatchUpdater` class** - Main class for batch operations
- **`collection()` method** - Select collection to operate on
- **`where()` method** - Add filter conditions (chainable, supports multiple conditions)
- **`preview()` method** - Preview changes before executing update (shows affected count, sample documents, affected fields)
- **`update()` method** - Update documents matching query conditions
- **`create()` method** - Create multiple documents at once (with auto-generated or custom IDs)
- **`upsert()` method** - Update or create documents using `set` with `merge: true`
- **`getFields()` method** - Retrieve specific field values from matching documents
- **Progress tracking** - Real-time progress callbacks with `onProgress` option
- **Pagination support** - `batchSize` option for processing large collections without memory issues
- **Log file generation** - Optional detailed operation logs for auditing
- Uses Firebase Admin SDK's **BulkWriter** for efficient batch operations (no 500 document limit)

### Types

- `ProgressInfo` - Progress information (current, total, percentage)
- `UpdateOptions` / `UpdateResult`
- `CreateDocumentInput` / `CreateOptions` / `CreateResult`
- `UpsertOptions` / `UpsertResult`
- `DeleteOptions` / `DeleteResult`
- `PreviewResult` / `DocumentSnapshot`
- `WhereCondition` / `OrderByCondition`
- `FieldValueResult`
- `LogOptions` / `LogEntry` / `OperationLog`
