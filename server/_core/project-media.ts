import { storageRead } from "../storage";
import { AiOperationError } from "./ai-operation";
import { MAX_MEDIA_BYTES, validateMediaBuffer, type ValidatedMedia } from "./media-validation";

type StoredAsset = {
  storagePath: string;
  mimeType: string;
};

/** Reads a storage-owned project asset and turns it into provider-safe media. */
export async function readValidatedProjectMedia(
  asset: StoredAsset,
  operation: string,
): Promise<ValidatedMedia> {
  if (!asset.storagePath) {
    throw new AiOperationError("MEDIA_UNAVAILABLE", { operation }).report();
  }
  try {
    const stored = await storageRead(asset.storagePath, MAX_MEDIA_BYTES);
    return await validateMediaBuffer(stored.buffer, asset.mimeType, operation);
  } catch (error) {
    if (error instanceof AiOperationError) throw error;
    throw new AiOperationError("MEDIA_UNAVAILABLE", { operation, cause: error, retryable: true }).report();
  }
}
