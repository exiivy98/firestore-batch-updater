# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
