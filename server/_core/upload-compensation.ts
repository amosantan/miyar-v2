import { nanoid } from "nanoid";
import { storageDelete } from "../storage";
import { captureException, captureMessage } from "./sentry";

const CLEANUP_ATTEMPTS = 3;

export async function cleanupRejectedUpload(
  objectKey: string,
  correlationId = nanoid(12),
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= CLEANUP_ATTEMPTS; attempt += 1) {
    try {
      await storageDelete(objectKey);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  captureException(lastError, {
    source: "upload-cleanup-failed",
    correlationId,
    objectKey,
  });
  throw new Error(`Upload cleanup failed (${correlationId})`);
}

export function reportIndeterminateUploadPersistence(
  objectKey: string,
  error: unknown,
  correlationId = nanoid(12),
): string {
  captureException(error, {
    source: "upload-reconciliation-required",
    correlationId,
    objectKey,
  });
  captureMessage(`Upload reconciliation required (${correlationId})`, "error");
  return correlationId;
}
