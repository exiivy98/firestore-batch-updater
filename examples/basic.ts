/**
 * Basic Usage Example
 *
 * This example shows the basic workflow:
 * 1. Initialize Firebase Admin
 * 2. Create BatchUpdater instance
 * 3. Preview changes
 * 4. Execute update with progress tracking
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
// @ts-ignore - This example shows usage after package installation
import { BatchUpdater } from "firestore-batch-updater";

// Initialize Firebase Admin SDK
// NOTE: Replace with your own service account credentials
initializeApp({
  credential: cert({
    projectId: "your-project-id",
    clientEmail: "your-client-email",
    privateKey: "your-private-key",
  }),
});

const firestore = getFirestore();

async function main() {
  // Create BatchUpdater instance
  const updater = new BatchUpdater(firestore);

  console.log("=== Step 1: Preview Changes ===");

  // Preview what will be updated
  const preview = await updater
    .collection("users")
    .where("status", "==", "inactive")
    .preview({ status: "archived", archivedAt: new Date() });

  console.log(`Will affect ${preview.affectedCount} documents`);
  console.log(`Fields to be changed: ${preview.affectedFields.join(", ")}`);

  if (preview.samples.length > 0) {
    console.log("\nSample document:");
    console.log("Before:", preview.samples[0].before);
    console.log("After:", preview.samples[0].after);
  }

  console.log("\n=== Step 2: Execute Update ===");

  // Execute the update with progress tracking
  const result = await updater
    .collection("users")
    .where("status", "==", "inactive")
    .update(
      { status: "archived", archivedAt: new Date() },
      {
        onProgress: (progress) => {
          console.log(
            `Progress: ${progress.percentage}% (${progress.current}/${progress.total})`
          );
        },
      }
    );

  console.log("\n=== Results ===");
  console.log(`Successfully updated: ${result.successCount} documents`);
  console.log(`Failed: ${result.failureCount} documents`);
  console.log(`Total processed: ${result.totalCount} documents`);

  if (result.failedDocIds && result.failedDocIds.length > 0) {
    console.log("Failed document IDs:", result.failedDocIds);
  }
}

main().catch(console.error);
