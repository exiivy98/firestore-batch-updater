# Firestore Batch Updater

[![npm version](https://img.shields.io/npm/v/firestore-batch-updater.svg)](https://www.npmjs.com/package/firestore-batch-updater)

Easy batch updates for Firebase Firestore with query-based filtering and progress tracking.

English | [한국어](./README.ko.md)

## Features

- Query-based updates - Filter documents with `where()` conditions
- No 500 document limit - Uses Firebase Admin SDK's BulkWriter
- Preview changes - See before/after comparison before updating
- Progress tracking - Real-time progress callbacks
- Batch create/upsert/delete - Create, upsert, or delete multiple documents at once
- Sorting and limiting - Use `orderBy()` and `limit()` for precise control
- Field selection - Use `select()` to load only needed fields (saves memory and costs)
- Single document operations - Use `findOne()`, `createOne()`, `updateOne()`, `deleteOne()` for efficient single-doc ops
- Existence check - Use `exists()` to quickly check if matching documents exist
- Empty check - Use `isEmpty()` to check if no matching documents exist (opposite of `exists()`)
- Get all documents - Use `getAll()` to retrieve all matching documents with data
- Aggregation - Use `aggregate()` for server-side `sum`, `average`, and `count` operations
- Quick aggregation - Use `sum()`, `avg()`, `min()`, `max()` for simple single-field aggregation
- Combined stats - Use `fieldStats()` to get sum/avg/min/max/count in one call
- Cursor pagination - Use `paginate()` for memory-efficient page-by-page iteration
- Direct ID lookup - Use `getOne()` for fast document retrieval by ID
- Document ID check - Use `has(id)` to check if a specific document ID exists without reading data
- Multi-ID lookup - Use `pick(ids)` to get multiple documents by IDs in a single efficient call
- Bulk operations - Use `bulkCreate()`, `bulkUpdate()`, `bulkDelete()` for efficient multi-document operations with different data each
- Transform - Use `transform()` to apply custom logic to each document (e.g., price increase, data migration)
- Copy & Move - Use `copyTo()` to copy/move documents between collections with optional data transformation
- Distinct values - Use `distinct()` to get unique field values from matching documents
- JSON export/import - Use `toJSON()` / `fromJSON()` to export/import documents as JSON
- Group counting - Use `countBy()` to count documents grouped by field value
- Group documents - Use `groupBy()` to group matching documents by a field value
- Random sampling - Use `sample()` to get random documents from query results
- Field value extraction - Use `pluck()` to get a simple array of field values
- Document ID extraction - Use `pluckIds()` to get an array of matching document IDs
- FieldValue support - Use `increment()`, `arrayUnion()`, `delete()`, `serverTimestamp()`, etc.
- Subcollection & Collection Group - Query subcollections or all collections with the same name
- Dry run mode - Simulate operations without making changes
- Count documents - Quickly count matching documents without loading them
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
| `collection(path)` | Select collection to operate on (supports subcollection paths) | `this` |
| `collectionGroup(id)` | Query all collections with the same ID | `this` |
| `where(field, op, value)` | Add filter condition (chainable) | `this` |
| `orderBy(field, direction?)` | Add sorting (chainable) | `this` |
| `limit(count)` | Limit number of documents (chainable) | `this` |
| `select(...fields)` | Select specific fields to retrieve (chainable) | `this` |
| `count()` | Count matching documents | `CountResult` |
| `exists()` | Check if matching documents exist | `boolean` |
| `isEmpty()` | Check if no matching documents exist | `boolean` |
| `findOne()` | Find first matching document | `{ id, data } \| null` |
| `getOne(id)` | Get document by ID directly | `{ id, data } \| null` |
| `has(id)` | Check if document ID exists | `boolean` |
| `pick(ids)` | Get multiple documents by IDs | `{ id, data }[]` |
| `getAll()` | Get all matching documents | `{ id, data }[]` |
| `preview(data)` | Preview changes before update | `PreviewResult` |
| `update(data, options?)` | Update matching documents | `UpdateResult` |
| `updateOne(data)` | Update first matching document | `{ success, id }` |
| `create(docs, options?)` | Create new documents | `CreateResult` |
| `createOne(data, id?)` | Create a single document | `{ success, id }` |
| `upsert(data, options?)` | Update or create (set with merge) | `UpsertResult` |
| `delete(options?)` | Delete matching documents | `DeleteResult` |
| `deleteOne()` | Delete first matching document | `{ success, id }` |
| `aggregate(spec)` | Run sum/average/count queries | `AggregateResult` |
| `sum(field)` | Get sum of a numeric field | `number \| null` |
| `avg(field)` | Get average of a numeric field | `number \| null` |
| `min(field)` | Get minimum value of a field | `any` |
| `max(field)` | Get maximum value of a field | `any` |
| `fieldStats(field)` | Get sum/avg/min/max/count for a field in one call | `FieldStatsResult` |
| `paginate(options)` | Cursor-based pagination | `PaginateResult` |
| `bulkCreate(docs, options?)` | Create multiple docs with different data | `BulkCreateResult` |
| `bulkUpdate(updates, options?)` | Update multiple docs with different data | `BulkUpdateResult` |
| `bulkDelete(ids, options?)` | Delete multiple docs by ID | `BulkDeleteResult` |
| `transform(fn, options?)` | Transform docs with custom function | `TransformResult` |
| `copyTo(target, options?)` | Copy/move docs to another collection | `CopyToResult` |
| `distinct(field)` | Get unique values of a field | `any[]` |
| `sample(n)` | Get random sample of matching documents | `{ id, data }[]` |
| `pluck(field)` | Get array of values for a specific field | `any[]` |
| `pluckIds()` | Get array of matching document IDs | `string[]` |
| `toJSON(path, options?)` | Export documents to JSON file | `ToJSONResult` |
| `fromJSON(path, options?)` | Import documents from JSON file | `FromJSONResult` |
| `countBy(field)` | Count documents grouped by field value | `CountByResult` |
| `groupBy(field)` | Group documents by field value | `GroupByResult` |
| `getFields(field)` | Get specific field values | `FieldValueResult[]` |

### Options

All write operations support an optional `options` parameter:

```typescript
{
  onProgress?: (progress: ProgressInfo) => void;
  log?: LogOptions;
  batchSize?: number;  // For update/upsert/delete
  dryRun?: boolean;    // For update/upsert/delete - simulate without writing
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

**dryRun option:**
- When `true`: Returns `DryRunResult` with `wouldAffect` count and `sampleIds` without making any changes

### Return Types

| Type | Fields |
|------|--------|
| `CountResult` | `count` |
| `DryRunResult` | `wouldAffect`, `sampleIds[]`, `operation` |
| `PreviewResult` | `affectedCount`, `samples[]`, `affectedFields[]` |
| `UpdateResult` | `successCount`, `failureCount`, `totalCount`, `failedDocIds?`, `logFilePath?` |
| `CreateResult` | `successCount`, `failureCount`, `totalCount`, `createdIds[]`, `failedDocIds?`, `logFilePath?` |
| `UpsertResult` | `successCount`, `failureCount`, `totalCount`, `failedDocIds?`, `logFilePath?` |
| `DeleteResult` | `successCount`, `failureCount`, `totalCount`, `deletedIds[]`, `failedDocIds?`, `logFilePath?` |
| `AggregateResult` | `{ [alias]: number \| null }` |
| `FieldStatsResult` | `sum`, `avg`, `min`, `max`, `count` |
| `PaginateResult` | `docs[]`, `nextCursor`, `hasMore` |
| `BulkCreateResult` | `successCount`, `failureCount`, `totalCount`, `createdIds[]`, `failedDocIds?`, `logFilePath?` |
| `BulkUpdateResult` | `successCount`, `failureCount`, `totalCount`, `failedDocIds?`, `logFilePath?` |
| `BulkDeleteResult` | `successCount`, `failureCount`, `totalCount`, `deletedIds[]`, `failedDocIds?`, `logFilePath?` |
| `TransformResult` | `successCount`, `failureCount`, `skippedCount`, `totalCount`, `failedDocIds?`, `logFilePath?` |
| `CopyToResult` | `successCount`, `failureCount`, `totalCount`, `copiedIds[]`, `failedDocIds?`, `logFilePath?` |
| `ToJSONResult` | `filePath`, `documentCount` |
| `FromJSONResult` | `successCount`, `failureCount`, `totalCount`, `createdIds[]`, `failedDocIds?`, `logFilePath?` |
| `CountByResult` | `{ [value]: number }` |
| `GroupByResult` | `{ [value]: { id, data }[] }` |
| `FieldValueResult` | `id`, `value` |

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

### Delete Documents

```typescript
const result = await updater
  .collection("users")
  .where("status", "==", "inactive")
  .delete();

console.log(`Deleted ${result.successCount} documents`);
console.log("Deleted IDs:", result.deletedIds);
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

> **Note:** When using multiple `where()` conditions on different fields, or combining `where()` with `orderBy()` on different fields, Firestore may require a [composite index](https://firebase.google.com/docs/firestore/query-data/indexing). If you see a `FAILED_PRECONDITION` error, follow the link in the error message to create the required index.

### Sorting and Limiting

```typescript
// Get top 10 users by score
const result = await updater
  .collection("users")
  .orderBy("score", "desc")
  .limit(10)
  .update({ featured: true });

// Delete oldest 100 inactive users
const deleted = await updater
  .collection("users")
  .where("status", "==", "inactive")
  .orderBy("createdAt", "asc")
  .limit(100)
  .delete();
```

### Using FieldValue

```typescript
import { BatchUpdater, FieldValue } from "firestore-batch-updater";

// Increment a counter
await updater
  .collection("users")
  .where("status", "==", "active")
  .update({ loginCount: FieldValue.increment(1) });

// Add to array
await updater
  .collection("users")
  .where("tier", "==", "premium")
  .update({ tags: FieldValue.arrayUnion("vip", "priority") });

// Remove from array
await updater
  .collection("users")
  .where("status", "==", "inactive")
  .update({ tags: FieldValue.arrayRemove("active") });

// Server timestamp
await updater
  .collection("users")
  .where("status", "==", "active")
  .update({ lastSeen: FieldValue.serverTimestamp() });

// Delete a field
await updater
  .collection("users")
  .where("status", "==", "inactive")
  .update({ temporaryData: FieldValue.delete() });
```

### Count Documents

```typescript
// Quickly count matching documents without loading them
const result = await updater
  .collection("users")
  .where("status", "==", "inactive")
  .count();

console.log(`Found ${result.count} inactive users`);
```

### Select Specific Fields

```typescript
// Only load name and email fields (reduces memory and read costs)
const result = await updater
  .collection("users")
  .select("name", "email")
  .where("status", "==", "active")
  .findOne();

console.log(result?.data); // Only contains { name, email }

// Works with all operations - documents will only have selected fields
const emails = await updater
  .collection("users")
  .select("email")
  .where("verified", "==", true)
  .getFields("email");
```

### Find Single Document

```typescript
// Find first matching document
const user = await updater
  .collection("users")
  .where("email", "==", "user@example.com")
  .findOne();

if (user) {
  console.log("Found user:", user.id);
  console.log("User data:", user.data);
} else {
  console.log("User not found");
}

// Combine with select for efficient lookup
const profile = await updater
  .collection("users")
  .select("name", "avatar", "tier")
  .where("username", "==", "johndoe")
  .findOne();
```

### Check Document Existence

```typescript
// Check if any admin users exist
const hasAdmin = await updater
  .collection("users")
  .where("role", "==", "admin")
  .exists();

if (!hasAdmin) {
  console.log("No admin users found - creating default admin");
}

// Check before expensive operations
const hasOldLogs = await updater
  .collection("logs")
  .where("createdAt", "<", thirtyDaysAgo)
  .exists();

if (hasOldLogs) {
  // Proceed with cleanup
}
```

### Check if Collection is Empty

```typescript
// Check if there are no pending orders
const noPending = await updater
  .collection("orders")
  .where("status", "==", "pending")
  .isEmpty();

if (noPending) {
  console.log("No pending orders - all caught up!");
}

// Opposite of exists() - useful for guard clauses
const noAdmins = await updater
  .collection("users")
  .where("role", "==", "admin")
  .isEmpty();

if (noAdmins) {
  console.log("Warning: No admin users found - creating default admin");
  await updater.collection("users").createOne({ role: "admin", name: "Default Admin" });
}
```

### Get All Documents

```typescript
// Get all matching documents with their data
const activeUsers = await updater
  .collection("users")
  .select("name", "email", "tier")
  .where("status", "==", "active")
  .limit(100)
  .getAll();

console.log(`Found ${activeUsers.length} active users`);
activeUsers.forEach(user => {
  console.log(`${user.id}: ${user.data.name}`);
});
```

### Update Single Document

```typescript
// Update only the first matching document
const result = await updater
  .collection("users")
  .where("email", "==", "user@example.com")
  .updateOne({ lastLogin: new Date(), loginCount: FieldValue.increment(1) });

if (result.success) {
  console.log(`Updated user: ${result.id}`);
} else {
  console.log("User not found");
}
```

### Delete Single Document

```typescript
// Delete only the first matching document
const result = await updater
  .collection("sessions")
  .where("token", "==", expiredToken)
  .deleteOne();

if (result.success) {
  console.log(`Deleted session: ${result.id}`);
} else {
  console.log("Session not found");
}
```

### Create Single Document

```typescript
// Create with auto-generated ID
const result = await updater
  .collection("users")
  .createOne({ name: "Alice", status: "active", score: 100 });

console.log(`Created document: ${result.id}`);

// Create with custom ID
const result2 = await updater
  .collection("users")
  .createOne({ name: "Bob", status: "active" }, "custom-bob-id");
```

### Aggregate Queries

```typescript
// Sum, average, count on matching documents
const stats = await updater
  .collection("orders")
  .where("status", "==", "completed")
  .aggregate({
    totalAmount: { op: "sum", field: "amount" },
    avgAmount: { op: "average", field: "amount" },
    orderCount: { op: "count" },
  });

console.log(`Total: $${stats.totalAmount}`);
console.log(`Average: $${stats.avgAmount}`);
console.log(`Orders: ${stats.orderCount}`);
```

### Quick Sum & Average

```typescript
// Get sum of a field directly (no need for aggregate spec)
const totalRevenue = await updater
  .collection("orders")
  .where("status", "==", "completed")
  .sum("amount");

console.log(`Total revenue: $${totalRevenue}`);

// Get average of a field directly
const avgScore = await updater
  .collection("users")
  .where("status", "==", "active")
  .avg("score");

console.log(`Average score: ${avgScore}`);

// Equivalent to aggregate(), but simpler for single-field queries
// aggregate({ total: { op: "sum", field: "amount" } }) → sum("amount")
// aggregate({ avg: { op: "average", field: "score" } }) → avg("score")
```

### Min & Max

```typescript
// Get the minimum/maximum value of a field
const cheapest = await updater.collection("products").min("price");
const mostExpensive = await updater.collection("products").max("price");
console.log(`Price range: $${cheapest} - $${mostExpensive}`);

// Works with dates/timestamps too
const earliestOrder = await updater
  .collection("orders")
  .where("status", "==", "completed")
  .min("createdAt");

// Returns null if no documents match
const maxScore = await updater
  .collection("users")
  .where("status", "==", "nonexistent")
  .max("score"); // null
```

> Note: Combining `where()` on one field with `min()/max()` on a different field may require a Firestore composite index. If you see a `FAILED_PRECONDITION` error, follow the link in the error message to create the required index.

### Combined Field Stats

```typescript
// Get sum, avg, min, max, count for a single field in one call
const stats = await updater.collection("products").fieldStats("price");
console.log(stats);
// { sum: 12500, avg: 250, min: 50, max: 500, count: 50 }

// Useful for dashboards
const orderStats = await updater
  .collection("orders")
  .where("status", "==", "completed")
  .fieldStats("amount");

console.log(`Total revenue: $${orderStats.sum}`);
console.log(`Average order: $${orderStats.avg}`);
console.log(`Order count: ${orderStats.count}`);
console.log(`Range: $${orderStats.min} - $${orderStats.max}`);
```

### Cursor-Based Pagination

```typescript
// Page through documents efficiently
let nextCursor = undefined;

do {
  const page = await updater
    .collection("users")
    .orderBy("createdAt", "desc")
    .paginate({ pageSize: 20, startAfter: nextCursor });

  page.docs.forEach((doc) => {
    console.log(`${doc.id}: ${doc.data.name}`);
  });

  nextCursor = page.nextCursor;
} while (nextCursor);

// Works with select for memory efficiency
const page = await updater
  .collection("users")
  .select("name", "email")
  .orderBy("name")
  .paginate({ pageSize: 50 });
```

### Get Document by ID

```typescript
// Fast lookup when you know the document ID
const user = await updater.collection("users").getOne("user-123");

if (user) {
  console.log(`Found: ${user.data.name}`);
} else {
  console.log("User not found");
}

// Works with select for field filtering
const profile = await updater
  .collection("users")
  .select("name", "avatar")
  .getOne("user-123");
```

### Check Document Exists by ID

```typescript
// Check if a specific document ID exists (without reading data)
const exists = await updater.collection("users").has("user-123");

if (exists) {
  console.log("User exists!");
} else {
  console.log("User not found");
}

// Useful for guard clauses before operations
if (!(await updater.collection("users").has(userId))) {
  throw new Error("User not found");
}
```

### Get Multiple Documents by IDs

```typescript
// Get multiple documents in a single call (more efficient than multiple getOne)
const users = await updater
  .collection("users")
  .pick(["user-1", "user-2", "user-3"]);

console.log(`Found ${users.length} users`);
users.forEach((u) => console.log(`${u.id}: ${u.data.name}`));

// Non-existent IDs are silently skipped
const docs = await updater
  .collection("products")
  .pick(["prod-1", "non-existent", "prod-3"]);
// Returns only prod-1 and prod-3 (if they exist)
```

### Bulk Update with Different Data

```typescript
// Update multiple documents with different data for each
const result = await updater.collection("users").bulkUpdate([
  { id: "user-1", data: { score: 100, rank: 1 } },
  { id: "user-2", data: { score: 85, rank: 2 } },
  { id: "user-3", data: { score: 70, rank: 3 } },
]);

console.log(`Updated ${result.successCount} documents`);

// With progress tracking
const result2 = await updater.collection("products").bulkUpdate(
  [
    { id: "prod-1", data: { price: 29.99, stock: 100 } },
    { id: "prod-2", data: { price: 49.99, stock: 50 } },
  ],
  {
    onProgress: (progress) => {
      console.log(`${progress.percentage}% complete`);
    },
  }
);
```

### Bulk Create

```typescript
// Create multiple documents with different data
const result = await updater.collection("users").bulkCreate([
  { id: "user-1", data: { name: "Alice", role: "admin" } },
  { id: "user-2", data: { name: "Bob", role: "user" } },
  { data: { name: "Charlie", role: "user" } }, // auto-generated ID
]);

console.log(`Created ${result.successCount} documents`);
console.log("Created IDs:", result.createdIds);
```

### Bulk Delete

```typescript
// Delete multiple documents by their IDs
const result = await updater
  .collection("users")
  .bulkDelete(["user-1", "user-2", "user-3"]);

console.log(`Deleted ${result.successCount} documents`);
console.log("Deleted IDs:", result.deletedIds);

// With progress tracking
const result2 = await updater.collection("logs").bulkDelete(expiredLogIds, {
  onProgress: (progress) => {
    console.log(`${progress.percentage}% complete`);
  },
});
```

### Transform Documents

```typescript
// Apply custom logic to each document
const result = await updater
  .collection("products")
  .where("category", "==", "electronics")
  .transform((doc) => ({
    price: doc.data.price * 1.1, // 10% price increase
    name: doc.data.name.toUpperCase(),
  }));

console.log(`Transformed ${result.successCount}, skipped ${result.skippedCount}`);

// Skip documents conditionally (return null)
const result2 = await updater
  .collection("users")
  .transform((doc) => {
    if (doc.data.score < 50) return null; // Skip low scores
    return { tier: "premium" };
  });
```

### Copy & Move Documents

```typescript
// Copy documents to another collection
const result = await updater
  .collection("users")
  .where("status", "==", "inactive")
  .copyTo("archived_users");

console.log(`Copied ${result.successCount} documents`);

// Copy with data transformation (e.g., remove sensitive fields)
await updater
  .collection("users")
  .copyTo("public_profiles", {
    transform: (doc) => ({
      name: doc.data.name,
      avatar: doc.data.avatar,
      // password, email omitted
    }),
  });

// Move documents (copy + delete source)
await updater
  .collection("orders")
  .where("status", "==", "completed")
  .copyTo("order_archive", { deleteSource: true });
```

### Distinct Values

```typescript
// Get unique values of a field
const statuses = await updater.collection("users").distinct("status");
console.log(statuses); // ["active", "inactive", "banned"]

// With where filter
const activeTiers = await updater
  .collection("users")
  .where("status", "==", "active")
  .distinct("tier");
console.log(activeTiers); // ["free", "premium", "enterprise"]
```

### Export to JSON

```typescript
// Export query results to a JSON file
const result = await updater
  .collection("users")
  .where("status", "==", "active")
  .select("name", "email")
  .toJSON("./exports/active-users.json");

console.log(`Exported ${result.documentCount} documents to ${result.filePath}`);

// Compact format (no pretty-print)
await updater
  .collection("logs")
  .toJSON("./exports/logs.json", { pretty: false });
```

### Count by Field Value

```typescript
// Count documents grouped by a field
const statusCounts = await updater.collection("users").countBy("status");
console.log(statusCounts); // { active: 150, inactive: 30, banned: 5 }

// With where filter
const roleCounts = await updater
  .collection("users")
  .where("status", "==", "active")
  .countBy("role");
console.log(roleCounts); // { admin: 5, user: 120, moderator: 25 }

// Nested fields
const countryCounts = await updater.collection("users").countBy("address.country");
console.log(countryCounts); // { US: 80, KR: 45, JP: 25 }
```

### Group Documents by Field Value

```typescript
// Group documents by a field value (with full document data)
const usersByRole = await updater.collection("users").groupBy("role");

console.log(`Admins: ${usersByRole.admin.length}`);
usersByRole.admin.forEach(user => {
  console.log(`- ${user.id}: ${user.data.name}`);
});

// With where filter
const activeProducts = await updater
  .collection("products")
  .where("status", "==", "active")
  .groupBy("category");

for (const [category, products] of Object.entries(activeProducts)) {
  console.log(`${category}: ${products.length} products`);
}

// Nested field support
const usersByCountry = await updater
  .collection("users")
  .groupBy("address.country");
```

### Import from JSON

```typescript
// Import documents from a JSON file (toJSON format)
const result = await updater
  .collection("users")
  .fromJSON("./exports/active-users.json");

console.log(`Imported ${result.successCount} documents`);
console.log("Created IDs:", result.createdIds);

// Import with auto-generated IDs (ignore IDs in JSON)
const result2 = await updater
  .collection("users_copy")
  .fromJSON("./exports/users.json", { useIds: false });

// Round-trip: export → import to another collection
await updater.collection("users").toJSON("./backup.json");
await updater.collection("users_backup").fromJSON("./backup.json");
```

### Pluck Field Values

```typescript
// Get just the email values as a simple array
const emails = await updater
  .collection("users")
  .where("status", "==", "active")
  .pluck("email");
console.log(emails); // ["alice@test.com", "bob@test.com", ...]

// Get prices for calculation
const prices = await updater.collection("products").pluck("price");
const total = prices.reduce((sum, p) => sum + p, 0);

// Nested field support
const countries = await updater.collection("users").pluck("address.country");
// ["US", "KR", "JP", ...]
```

### Pluck Document IDs

```typescript
// Get all matching document IDs as an array
const inactiveIds = await updater
  .collection("users")
  .where("status", "==", "inactive")
  .pluckIds();
console.log(inactiveIds); // ["user-1", "user-3", ...]

// Chain with bulk operations for efficient workflows
const expiredIds = await updater
  .collection("sessions")
  .where("expiresAt", "<", new Date())
  .pluckIds();

await updater.collection("sessions").bulkDelete(expiredIds);

// Works with limit() and orderBy()
const topIds = await updater
  .collection("users")
  .orderBy("score", "desc")
  .limit(10)
  .pluckIds();
```

### Random Sampling

```typescript
// Get 5 random documents
const samples = await updater.collection("users").sample(5);
samples.forEach(doc => console.log(doc.id, doc.data.name));

// Random sample from filtered results
const activeUsers = await updater
  .collection("users")
  .where("status", "==", "active")
  .sample(3);

// With select for memory efficiency
const randomProducts = await updater
  .collection("products")
  .select("name", "price")
  .sample(10);
```

### Dry Run Mode

```typescript
// Simulate an operation without making any changes
const simulation = await updater
  .collection("users")
  .where("status", "==", "inactive")
  .update(
    { status: "archived" },
    { dryRun: true }
  );

console.log(`Would affect ${simulation.wouldAffect} documents`);
console.log("Sample IDs:", simulation.sampleIds);

// Also works with delete
const deleteSimulation = await updater
  .collection("logs")
  .where("createdAt", "<", thirtyDaysAgo)
  .delete({ dryRun: true });

console.log(`Would delete ${deleteSimulation.wouldAffect} documents`);
```

### Subcollections

```typescript
// Query a specific subcollection path
const result = await updater
  .collection("users/user-123/orders")
  .where("status", "==", "pending")
  .update({ status: "cancelled" });

// Or use dynamic paths
const userId = "user-123";
await updater
  .collection(`users/${userId}/notifications`)
  .where("read", "==", false)
  .delete();
```

### Collection Group Queries

```typescript
// Query ALL "orders" subcollections across all users
const result = await updater
  .collectionGroup("orders")
  .where("status", "==", "pending")
  .where("createdAt", "<", thirtyDaysAgo)
  .update({ status: "expired" });

console.log(`Updated ${result.successCount} orders across all users`);

// Note: collectionGroup requires a Firestore index on the queried fields
```

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
