# Firestore Batch Updater

[![npm version](https://img.shields.io/npm/v/firestore-batch-updater.svg)](https://www.npmjs.com/package/firestore-batch-updater)

Easy batch updates for Firebase Firestore with query-based filtering and progress tracking.

English | [한국어](./README.ko.md)

## Features

- Query-based updates - Filter documents with `where()` conditions
- No 500 document limit - Uses Firebase Admin SDK's BulkWriter
- Preview changes - See before/after comparison before updating
- Progress tracking - Real-time progress callbacks
- Batch create/upsert - Create or upsert multiple documents at once
- Log file generation - Optional detailed operation logs for auditing

## Installation

```bash
# npm
npm install firestore-batch-updater

# yarn
yarn add firestore-batch-updater

# pnpm
pnpm add firestore-batch-updater
```

**Required peer dependency:**

```bash
# npm
npm install firebase-admin

# yarn
yarn add firebase-admin

# pnpm
pnpm add firebase-admin
```

## Quick Start

```typescript
import { BatchUpdater } from "firestore-batch-updater";
import { getFirestore } from "firebase-admin/firestore";

const firestore = getFirestore();
const updater = new BatchUpdater(firestore);

// Preview changes
const preview = await updater
  .collection("users")
  .where("status", "==", "inactive")
  .preview({ status: "archived" });

console.log(`Will affect ${preview.affectedCount} documents`);

// Execute update
const result = await updater
  .collection("users")
  .where("status", "==", "inactive")
  .update({ status: "archived" });

console.log(`Updated ${result.successCount} documents`);
```

## API Reference

### Methods Overview

| Method | Description | Returns |
|--------|-------------|---------|
| `collection(path)` | Select collection to operate on | `this` |
| `where(field, op, value)` | Add filter condition (chainable) | `this` |
| `preview(data)` | Preview changes before update | `PreviewResult` |
| `update(data, options?)` | Update matching documents | `UpdateResult` |
| `create(docs, options?)` | Create new documents | `CreateResult` |
| `upsert(data, options?)` | Update or create (set with merge) | `UpsertResult` |
| `getFields(field)` | Get specific field values | `FieldValue[]` |

### Options

All write operations support an optional `options` parameter:

```typescript
{
  onProgress?: (progress: ProgressInfo) => void;
  log?: LogOptions;
  batchSize?: number;  // For update/upsert only
}

// ProgressInfo
{
  current: number;     // Documents processed
  total: number;       // Total documents
  percentage: number;  // 0-100
}

// LogOptions
{
  enabled: boolean;    // Enable log file generation
  path?: string;       // Custom log directory (default: ./logs)
  filename?: string;   // Custom filename (default: auto-generated)
}
```

**batchSize option (for large collections):**
- When not set: All documents are loaded into memory at once (suitable for small collections)
- When set (e.g., `batchSize: 1000`): Documents are processed in batches using cursor pagination (suitable for large collections to prevent memory issues)

### Return Types

| Type | Fields |
|------|--------|
| `PreviewResult` | `affectedCount`, `samples[]`, `affectedFields[]` |
| `UpdateResult` | `successCount`, `failureCount`, `totalCount`, `failedDocIds?`, `logFilePath?` |
| `CreateResult` | `successCount`, `failureCount`, `totalCount`, `createdIds[]`, `failedDocIds?`, `logFilePath?` |
| `UpsertResult` | `successCount`, `failureCount`, `totalCount`, `failedDocIds?`, `logFilePath?` |
| `FieldValue` | `id`, `value` |

## Usage Examples

### Update Documents

```typescript
const result = await updater
  .collection("users")
  .where("status", "==", "inactive")
  .update({ status: "archived" });
```

### Create Documents

```typescript
// Auto-generated IDs
const result = await updater.collection("users").create([
  { data: { name: "Alice", age: 30 } },
  { data: { name: "Bob", age: 25 } },
]);
console.log("Created IDs:", result.createdIds);

// With specific IDs
const result2 = await updater.collection("users").create([
  { id: "user-001", data: { name: "Charlie" } },
  { id: "user-002", data: { name: "Diana" } },
]);
```

### Upsert Documents

```typescript
const result = await updater
  .collection("users")
  .where("status", "==", "active")
  .upsert({ tier: "premium", updatedAt: new Date() });
```

### Preview Before Update

```typescript
const preview = await updater
  .collection("orders")
  .where("status", "==", "pending")
  .preview({ status: "cancelled" });

if (preview.affectedCount > 1000) {
  console.log("Too many documents. Aborting.");
} else {
  await updater
    .collection("orders")
    .where("status", "==", "pending")
    .update({ status: "cancelled" });
}
```

### Progress Tracking

```typescript
const result = await updater
  .collection("products")
  .where("inStock", "==", false)
  .update(
    { status: "discontinued" },
    {
      onProgress: (progress) => {
        console.log(`${progress.percentage}% complete`);
      },
    }
  );
```

### Get Field Values

```typescript
const emails = await updater
  .collection("users")
  .where("status", "==", "active")
  .getFields("email");

// [{ id: 'user1', value: 'user1@example.com' }, ...]
```

### Multiple Conditions

```typescript
const ninetyDaysAgo = new Date();
ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

const result = await updater
  .collection("users")
  .where("status", "==", "inactive")
  .where("lastLoginAt", "<", ninetyDaysAgo)
  .where("accountType", "==", "free")
  .update({ status: "archived" });
```

> **Note:** When using multiple `where()` conditions on different fields, Firestore may require a [composite index](https://firebase.google.com/docs/firestore/query-data/indexing). If you see a `FAILED_PRECONDITION` error, follow the link in the error message to create the required index.

### Error Handling

```typescript
const result = await updater
  .collection("users")
  .where("status", "==", "test")
  .update({ status: "verified" });

if (result.failureCount > 0) {
  console.log(`${result.failureCount} documents failed`);
  console.log("Failed IDs:", result.failedDocIds);
}
```

### Pagination for Large Collections

```typescript
// Process documents in batches of 1000 to prevent memory issues
const result = await updater
  .collection("users")
  .where("status", "==", "inactive")
  .update(
    { status: "archived" },
    {
      batchSize: 1000,
      onProgress: (progress) => {
        console.log(`${progress.percentage}% complete`);
      },
    }
  );
```

### Log File Generation

```typescript
const result = await updater
  .collection("users")
  .where("status", "==", "inactive")
  .update(
    { status: "archived" },
    {
      log: {
        enabled: true,
        path: "./logs",  // optional
      },
    }
  );

if (result.logFilePath) {
  console.log(`Log saved to: ${result.logFilePath}`);
}
```

Log file example:
```
============================================================
FIRESTORE BATCH OPERATION LOG
============================================================

Operation: UPDATE
Collection: users
Started: 2024-01-15T10:30:00.000Z
Completed: 2024-01-15T10:30:05.000Z

Conditions:
  - status == "inactive"

============================================================
SUMMARY
============================================================
Total: 150
Success: 148
Failure: 2

============================================================
DETAILS
============================================================

2024-01-15T10:30:01.000Z [SUCCESS] user-001
2024-01-15T10:30:01.100Z [SUCCESS] user-002
2024-01-15T10:30:01.200Z [FAILURE] user-003
  Error: Document not found
...
```

## Requirements

- Node.js 18+
- Firebase Admin SDK 13.x
- Server-side environment only (Admin SDK required)

## Why BulkWriter?

This library uses Firebase's `BulkWriter` which:

- No 500 document limit (unlike batch writes)
- Automatic rate limiting
- Built-in retry logic
- Better performance for large operations

## Examples

Check out the [examples](./examples) folder:

- [basic.ts](./examples/basic.ts) - Basic usage workflow
- [api-route.ts](./examples/api-route.ts) - Using in API endpoints
- [advanced.ts](./examples/advanced.ts) - Advanced features and patterns

## Disclaimer

This package is provided "as is" without warranty of any kind. The author is not responsible for any data loss, corruption, or other issues that may arise from using this package. Always test thoroughly in a development environment before using in production, and ensure you have proper backups of your data.

## License

MIT
