/**
 * API Route Example (Next.js / Express)
 *
 * This example shows how to use BatchUpdater in an API endpoint
 * with proper error handling and response formatting
 */

import { getFirestore } from "firebase-admin/firestore";
// @ts-ignore - This example shows usage after package installation
import { BatchUpdater } from "firestore-batch-updater";

// Request body type
interface RequestBody {
  collection: string;
  filters?: Array<{
    field: string;
    operator: any;
    value: any;
  }>;
  updateData: Record<string, any>;
  previewOnly?: boolean;
}

// Example: Next.js API Route
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const { collection, filters, updateData } = body;

    // Validate input
    if (!collection || !updateData) {
      return Response.json(
        { error: "Missing required fields: collection, updateData" },
        { status: 400 }
      );
    }

    const firestore = getFirestore();
    const updater = new BatchUpdater(firestore);

    // Build query
    let query = updater.collection(collection);

    if (filters && Array.isArray(filters)) {
      for (const filter of filters) {
        query = query.where(filter.field, filter.operator, filter.value);
      }
    }

    // Preview first
    const preview = await query.preview(updateData);

    // Return preview if requested
    if (body.previewOnly) {
      return Response.json({
        success: true,
        preview: {
          affectedCount: preview.affectedCount,
          affectedFields: preview.affectedFields,
          samples: preview.samples.slice(0, 3), // Limit samples for API response
        },
      });
    }

    // Execute update
    const result = await query.update(updateData);

    return Response.json({
      success: true,
      result: {
        successCount: result.successCount,
        failureCount: result.failureCount,
        totalCount: result.totalCount,
        failedDocIds: result.failedDocIds,
      },
    });
  } catch (error) {
    console.error("Batch update error:", error);

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Example request body:
/*
{
  "collection": "users",
  "filters": [
    { "field": "status", "operator": "==", "value": "inactive" },
    { "field": "lastLogin", "operator": "<", "value": "2024-01-01" }
  ],
  "updateData": {
    "status": "archived",
    "archivedAt": "2024-12-24T00:00:00Z"
  },
  "previewOnly": false
}
*/
