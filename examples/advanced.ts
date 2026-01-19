/**
 * Advanced Usage Example
 *
 * This example demonstrates:
 * - Multiple where conditions
 * - Field retrieval
 * - Error handling
 * - Custom progress tracking
 * - Pagination for large collections
 * - Log file generation
 * - Sorting and limiting with orderBy() and limit()
 * - Using FieldValue (increment, arrayUnion, delete, etc.)
 * - Deleting documents
 * - Counting documents with count()
 * - Dry run mode for simulating operations
 * - Subcollection queries
 * - Collection group queries
 * - Select specific fields with select()
 * - Find single document with findOne()
 */

import { getFirestore } from "firebase-admin/firestore";
// @ts-ignore - This example shows usage after package installation
import { BatchUpdater, FieldValue } from "firestore-batch-updater";

const firestore = getFirestore();

async function advancedExample() {
  const updater = new BatchUpdater(firestore);

  console.log("=== Example 1: Multiple Conditions ===");

  // Update users who are inactive AND haven't logged in for 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const result1 = await updater
    .collection("users")
    .where("status", "==", "inactive")
    .where("lastLoginAt", "<", ninetyDaysAgo)
    .where("accountType", "==", "free")
    .update({ status: "archived", reason: "inactivity" });

  console.log(`Archived ${result1.successCount} inactive users`);

  console.log("\n=== Example 2: Get Specific Fields ===");

  // Get all email addresses of active premium users
  const emails = await updater
    .collection("users")
    .where("status", "==", "active")
    .where("accountType", "==", "premium")
    .getFields("email");

  console.log(`Found ${emails.length} premium users`);
  console.log("Sample emails:", emails.slice(0, 3));

  console.log("\n=== Example 3: Custom Progress Tracking ===");

  // Create a progress bar
  let lastPercentage = 0;

  const result2 = await updater
    .collection("products")
    .where("inStock", "==", false)
    .update(
      { status: "discontinued", discontinuedAt: new Date() },
      {
        onProgress: (progress) => {
          // Only log every 10%
          if (
            progress.percentage >= lastPercentage + 10 ||
            progress.percentage === 100
          ) {
            const bar = "█".repeat(progress.percentage / 5);
            const empty = "░".repeat(20 - progress.percentage / 5);
            console.log(`[${bar}${empty}] ${progress.percentage}%`);
            lastPercentage = progress.percentage;
          }
        },
      }
    );

  console.log(`Discontinued ${result2.successCount} out-of-stock products`);

  console.log("\n=== Example 4: Nested Field Updates ===");

  // Update nested fields using dot notation
  const result3 = await updater
    .collection("users")
    .where("settings.notifications", "==", true)
    .update({
      "settings.emailFrequency": "weekly",
      "settings.lastUpdated": new Date(),
    });

  console.log(
    `Updated notification settings for ${result3.successCount} users`
  );

  console.log("\n=== Example 5: Conditional Update Based on Preview ===");

  // Only proceed if less than 1000 documents will be affected
  const preview = await updater
    .collection("orders")
    .where("status", "==", "pending")
    .where("createdAt", "<", ninetyDaysAgo)
    .preview({ status: "cancelled", cancelReason: "timeout" });

  if (preview.affectedCount > 1000) {
    console.log(`Too many documents (${preview.affectedCount}). Aborting.`);
  } else {
    console.log(`Safe to proceed with ${preview.affectedCount} documents`);

    const result = await updater
      .collection("orders")
      .where("status", "==", "pending")
      .where("createdAt", "<", ninetyDaysAgo)
      .update({ status: "cancelled", cancelReason: "timeout" });

    console.log(`Cancelled ${result.successCount} old pending orders`);
  }

  console.log("\n=== Example 6: Pagination for Large Collections ===");

  // Use batchSize to process large collections without memory issues
  const paginationResult = await updater
    .collection("logs")
    .where("createdAt", "<", ninetyDaysAgo)
    .update(
      { archived: true },
      {
        batchSize: 1000, // Process 1000 documents at a time
        onProgress: (progress) => {
          console.log(`Archiving logs: ${progress.percentage}%`);
        },
      }
    );

  console.log(`Archived ${paginationResult.successCount} old log entries`);
}

async function createAndUpsertExample() {
  const updater = new BatchUpdater(firestore);

  console.log("\n=== Example 7: Batch Create Documents ===");

  // Create multiple documents at once
  const createResult = await updater.collection("users").create(
    [
      { data: { name: "Alice", email: "alice@example.com", status: "active" } },
      { data: { name: "Bob", email: "bob@example.com", status: "active" } },
      {
        id: "user-charlie",
        data: { name: "Charlie", email: "charlie@example.com", status: "active" },
      },
    ],
    {
      onProgress: (progress) => {
        console.log(`Creating: ${progress.percentage}%`);
      },
    }
  );

  console.log(`Created ${createResult.successCount} documents`);
  console.log("Created IDs:", createResult.createdIds);

  console.log("\n=== Example 8: Upsert Documents ===");

  // Upsert - update if exists, create if not (using set with merge)
  const upsertResult = await updater
    .collection("users")
    .where("status", "==", "active")
    .upsert(
      { tier: "premium", updatedAt: new Date() },
      {
        onProgress: (progress) => {
          console.log(`Upserting: ${progress.percentage}%`);
        },
      }
    );

  console.log(`Upserted ${upsertResult.successCount} documents`);
}

async function errorHandlingExample() {
  const updater = new BatchUpdater(firestore);

  console.log("\n=== Error Handling Example ===");

  try {
    // This will throw an error - collection not set
    await updater
      .where("status", "==", "inactive")
      .update({ status: "archived" });
  } catch (error) {
    console.error(
      "Expected error:",
      error instanceof Error ? error.message : error
    );
  }

  try {
    // This will throw an error - empty update data
    await updater.collection("users").update({});
  } catch (error) {
    console.error(
      "Expected error:",
      error instanceof Error ? error.message : error
    );
  }

  // Handle partial failures
  const result = await updater
    .collection("users")
    .where("status", "==", "test")
    .update({ status: "verified" });

  if (result.failureCount > 0) {
    console.log(`Warning: ${result.failureCount} documents failed to update`);
    console.log("Failed IDs:", result.failedDocIds);

    // You could retry failed documents or log them for manual review
  }
}

async function logFileExample() {
  const updater = new BatchUpdater(firestore);

  console.log("\n=== Example 9: Log File Generation ===");

  // Update with log file generation
  const result = await updater
    .collection("users")
    .where("status", "==", "inactive")
    .update(
      { status: "archived", archivedAt: new Date() },
      {
        log: {
          enabled: true,
          path: "./logs",
        },
        onProgress: (progress) => {
          console.log(`Progress: ${progress.percentage}%`);
        },
      }
    );

  console.log(`Updated ${result.successCount} documents`);
  if (result.logFilePath) {
    console.log(`Log file saved to: ${result.logFilePath}`);
  }

  console.log("\n=== Example 10: Log with Custom Filename ===");

  // Create documents with custom log filename
  const createResult = await updater.collection("audit").create(
    [
      { data: { action: "user_created", timestamp: new Date() } },
      { data: { action: "user_updated", timestamp: new Date() } },
    ],
    {
      log: {
        enabled: true,
        path: "./logs/audit",
        filename: "audit-create.log",
      },
    }
  );

  console.log(`Created ${createResult.successCount} audit records`);
  if (createResult.logFilePath) {
    console.log(`Audit log saved to: ${createResult.logFilePath}`);
  }
}

async function sortingAndLimitingExample() {
  const updater = new BatchUpdater(firestore);

  console.log("\n=== Example 11: Sorting and Limiting ===");

  // Get top 10 users by score
  const topUsers = await updater
    .collection("users")
    .where("status", "==", "active")
    .orderBy("score", "desc")
    .limit(10)
    .getFields("name");

  console.log("Top 10 users by score:");
  topUsers.forEach((user, index) => {
    console.log(`  ${index + 1}. ${user.value}`);
  });

  // Update only top 5 users
  const updateResult = await updater
    .collection("users")
    .where("status", "==", "active")
    .orderBy("score", "desc")
    .limit(5)
    .update({ tier: "platinum", featuredAt: new Date() });

  console.log(`Updated ${updateResult.successCount} top users to platinum tier`);

  // Delete oldest 100 inactive users
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const deleteResult = await updater
    .collection("users")
    .where("status", "==", "inactive")
    .orderBy("lastLoginAt", "asc")
    .limit(100)
    .delete();

  console.log(`Deleted ${deleteResult.successCount} oldest inactive users`);
}

async function fieldValueExample() {
  const updater = new BatchUpdater(firestore);

  console.log("\n=== Example 12: Using FieldValue ===");

  // Increment a counter
  const incrementResult = await updater
    .collection("products")
    .where("id", "==", "product-1")
    .update({ viewCount: FieldValue.increment(1) });

  console.log(`Incremented view count for ${incrementResult.successCount} products`);

  // Add items to array
  const arrayUnionResult = await updater
    .collection("users")
    .where("tier", "==", "premium")
    .update({ tags: FieldValue.arrayUnion("vip", "priority-support") });

  console.log(`Added tags to ${arrayUnionResult.successCount} premium users`);

  // Remove items from array
  const arrayRemoveResult = await updater
    .collection("users")
    .where("status", "==", "inactive")
    .update({ tags: FieldValue.arrayRemove("active", "verified") });

  console.log(`Removed tags from ${arrayRemoveResult.successCount} inactive users`);

  // Server timestamp
  const timestampResult = await updater
    .collection("users")
    .where("status", "==", "active")
    .update({ lastSeen: FieldValue.serverTimestamp() });

  console.log(`Updated lastSeen for ${timestampResult.successCount} active users`);

  // Combine multiple FieldValue operations
  const combinedResult = await updater
    .collection("posts")
    .where("status", "==", "published")
    .update({
      viewCount: FieldValue.increment(1),
      tags: FieldValue.arrayUnion("trending"),
      updatedAt: FieldValue.serverTimestamp(),
    });

  console.log(`Applied multiple updates to ${combinedResult.successCount} posts`);
}

async function deleteExample() {
  const updater = new BatchUpdater(firestore);

  console.log("\n=== Example 13: Delete Documents ===");

  // Delete with where condition
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const deleteResult = await updater
    .collection("sessions")
    .where("createdAt", "<", ninetyDaysAgo)
    .delete({
      onProgress: (progress) => {
        console.log(`Deleting old sessions: ${progress.percentage}%`);
      },
    });

  console.log(`Deleted ${deleteResult.successCount} old sessions`);
  console.log("Deleted IDs:", deleteResult.deletedIds.slice(0, 5), "...");

  // Delete with pagination for large collections
  const paginatedDeleteResult = await updater
    .collection("logs")
    .where("level", "==", "debug")
    .where("createdAt", "<", ninetyDaysAgo)
    .delete({
      batchSize: 500,
      onProgress: (progress) => {
        console.log(`Cleaning up debug logs: ${progress.percentage}%`);
      },
    });

  console.log(`Deleted ${paginatedDeleteResult.successCount} debug log entries`);

  // Delete with log file for auditing
  const auditDeleteResult = await updater
    .collection("temp_data")
    .where("expiresAt", "<", new Date())
    .delete({
      log: {
        enabled: true,
        path: "./logs/cleanup",
        filename: "temp-data-cleanup.log",
      },
    });

  console.log(`Deleted ${auditDeleteResult.successCount} expired temp records`);
  if (auditDeleteResult.logFilePath) {
    console.log(`Deletion log saved to: ${auditDeleteResult.logFilePath}`);
  }
}

async function countExample() {
  const updater = new BatchUpdater(firestore);

  console.log("\n=== Example 14: Count Documents ===");

  // Count all users
  const allUsers = await updater.collection("users").count();
  console.log(`Total users: ${allUsers.count}`);

  // Count with conditions
  const inactiveUsers = await updater
    .collection("users")
    .where("status", "==", "inactive")
    .count();
  console.log(`Inactive users: ${inactiveUsers.count}`);

  // Count with multiple conditions
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const oldInactiveUsers = await updater
    .collection("users")
    .where("status", "==", "inactive")
    .where("lastLoginAt", "<", ninetyDaysAgo)
    .count();
  console.log(`Old inactive users (90+ days): ${oldInactiveUsers.count}`);
}

async function dryRunExample() {
  const updater = new BatchUpdater(firestore);

  console.log("\n=== Example 15: Dry Run Mode ===");

  // Simulate an update without making changes
  const updateSimulation = await updater
    .collection("users")
    .where("status", "==", "inactive")
    .update({ status: "archived" }, { dryRun: true });

  if ("wouldAffect" in updateSimulation) {
    console.log(`Update would affect ${updateSimulation.wouldAffect} documents`);
    console.log("Sample IDs:", updateSimulation.sampleIds.slice(0, 3));
  }

  // Simulate a delete
  const deleteSimulation = await updater
    .collection("logs")
    .where("level", "==", "debug")
    .delete({ dryRun: true });

  if ("wouldAffect" in deleteSimulation) {
    console.log(`Delete would affect ${deleteSimulation.wouldAffect} documents`);
  }

  // Simulate an upsert
  const upsertSimulation = await updater
    .collection("users")
    .where("tier", "==", "free")
    .upsert({ promotionSent: true }, { dryRun: true });

  if ("wouldAffect" in upsertSimulation) {
    console.log(`Upsert would affect ${upsertSimulation.wouldAffect} documents`);
  }
}

async function subcollectionExample() {
  const updater = new BatchUpdater(firestore);

  console.log("\n=== Example 16: Subcollection Queries ===");

  const userId = "user-123";

  // Query a specific user's orders
  const pendingOrders = await updater
    .collection(`users/${userId}/orders`)
    .where("status", "==", "pending")
    .count();

  console.log(`User ${userId} has ${pendingOrders.count} pending orders`);

  // Update orders in a subcollection
  const updateResult = await updater
    .collection(`users/${userId}/orders`)
    .where("status", "==", "pending")
    .where("createdAt", "<", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // 7 days ago
    .update({ status: "expired" });

  if ("successCount" in updateResult) {
    console.log(`Expired ${updateResult.successCount} old pending orders`);
  }

  // Delete notifications in a subcollection
  const deleteResult = await updater
    .collection(`users/${userId}/notifications`)
    .where("read", "==", true)
    .delete();

  if ("successCount" in deleteResult) {
    console.log(`Deleted ${deleteResult.successCount} read notifications`);
  }
}

async function collectionGroupExample() {
  const updater = new BatchUpdater(firestore);

  console.log("\n=== Example 17: Collection Group Queries ===");

  // Count all orders across all users
  const totalOrders = await updater.collectionGroup("orders").count();
  console.log(`Total orders across all users: ${totalOrders.count}`);

  // Count pending orders across all users
  const pendingOrders = await updater
    .collectionGroup("orders")
    .where("status", "==", "pending")
    .count();

  console.log(`Pending orders across all users: ${pendingOrders.count}`);

  // Update all expired orders across all users (with dry run first)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const simulation = await updater
    .collectionGroup("orders")
    .where("status", "==", "pending")
    .where("createdAt", "<", thirtyDaysAgo)
    .update({ status: "expired" }, { dryRun: true });

  if ("wouldAffect" in simulation) {
    console.log(`Would expire ${simulation.wouldAffect} old orders`);

    // Actually perform the update if count is reasonable
    if (simulation.wouldAffect > 0 && simulation.wouldAffect < 1000) {
      const result = await updater
        .collectionGroup("orders")
        .where("status", "==", "pending")
        .where("createdAt", "<", thirtyDaysAgo)
        .update({ status: "expired" });

      if ("successCount" in result) {
        console.log(`Actually expired ${result.successCount} orders`);
      }
    }
  }
}

async function fieldValueDeleteExample() {
  const updater = new BatchUpdater(firestore);

  console.log("\n=== Example 18: FieldValue.delete() ===");

  // Remove a specific field from documents
  const result = await updater
    .collection("users")
    .where("status", "==", "inactive")
    .update({
      temporaryToken: FieldValue.delete(),
      sessionData: FieldValue.delete(),
    });

  if ("successCount" in result) {
    console.log(`Removed sensitive fields from ${result.successCount} inactive users`);
  }

  // Combine delete with other FieldValue operations
  const combinedResult = await updater
    .collection("users")
    .where("status", "==", "active")
    .update({
      lastCleanup: FieldValue.serverTimestamp(),
      tempCache: FieldValue.delete(),
      loginCount: FieldValue.increment(0), // Reset without changing
    });

  if ("successCount" in combinedResult) {
    console.log(`Cleaned up ${combinedResult.successCount} active user records`);
  }
}

async function selectExample() {
  const updater = new BatchUpdater(firestore);

  console.log("\n=== Example 19: Select Specific Fields ===");

  // Only load specific fields to reduce memory and read costs
  const user = await updater
    .collection("users")
    .select("name", "email")
    .where("status", "==", "active")
    .findOne();

  if (user) {
    console.log("User (only name and email loaded):", user.data);
    console.log("Fields in data:", Object.keys(user.data));
  }

  // Use select with getFields for efficient data retrieval
  const emails = await updater
    .collection("users")
    .select("email", "name")
    .where("verified", "==", true)
    .limit(10)
    .getFields("email");

  console.log(`Found ${emails.length} verified user emails`);
}

async function findOneExample() {
  const updater = new BatchUpdater(firestore);

  console.log("\n=== Example 20: Find Single Document ===");

  // Find a user by email
  const user = await updater
    .collection("users")
    .where("email", "==", "admin@example.com")
    .findOne();

  if (user) {
    console.log("Found admin user:", user.id);
    console.log("User data:", user.data);
  } else {
    console.log("Admin user not found");
  }

  // Find with multiple conditions
  const premiumUser = await updater
    .collection("users")
    .where("tier", "==", "premium")
    .where("status", "==", "active")
    .findOne();

  if (premiumUser) {
    console.log("Found premium user:", premiumUser.id);
  }

  // Combine findOne with select for efficient lookups
  const profile = await updater
    .collection("users")
    .select("name", "avatar", "bio")
    .where("username", "==", "johndoe")
    .findOne();

  if (profile) {
    console.log("Profile data (only selected fields):", profile.data);
  }
}

// Run examples
Promise.all([
  advancedExample(),
  createAndUpsertExample(),
  errorHandlingExample(),
  logFileExample(),
  sortingAndLimitingExample(),
  fieldValueExample(),
  deleteExample(),
  countExample(),
  dryRunExample(),
  subcollectionExample(),
  collectionGroupExample(),
  fieldValueDeleteExample(),
  selectExample(),
  findOneExample(),
]).catch(console.error);
