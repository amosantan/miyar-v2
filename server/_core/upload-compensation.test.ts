import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  storageDelete: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock("../storage", () => ({ storageDelete: mocks.storageDelete }));
vi.mock("./sentry", () => ({
  captureException: mocks.captureException,
  captureMessage: mocks.captureMessage,
}));

import {
  cleanupRejectedUpload,
  reportIndeterminateUploadPersistence,
} from "./upload-compensation";

describe("upload compensation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retries deletion three times and then succeeds", async () => {
    mocks.storageDelete
      .mockRejectedValueOnce(new Error("one"))
      .mockRejectedValueOnce(new Error("two"))
      .mockResolvedValueOnce(undefined);
    await expect(cleanupRejectedUpload("normalized/key", "correlation")).resolves.toBeUndefined();
    expect(mocks.storageDelete).toHaveBeenCalledTimes(3);
    expect(mocks.captureException).not.toHaveBeenCalled();
  });

  it("emits key-only critical telemetry after bounded cleanup failure", async () => {
    mocks.storageDelete.mockRejectedValue(new Error("unavailable"));
    await expect(cleanupRejectedUpload("normalized/key", "correlation")).rejects.toThrow(
      "Upload cleanup failed (correlation)"
    );
    expect(mocks.storageDelete).toHaveBeenCalledTimes(3);
    expect(mocks.captureException).toHaveBeenCalledWith(expect.any(Error), {
      source: "upload-cleanup-failed",
      correlationId: "correlation",
      objectKey: "normalized/key",
    });
  });

  it("marks indeterminate persistence for reconciliation without deletion", () => {
    const error = new Error("commit status unknown");
    expect(reportIndeterminateUploadPersistence("normalized/key", error, "correlation"))
      .toBe("correlation");
    expect(mocks.storageDelete).not.toHaveBeenCalled();
    expect(mocks.captureException).toHaveBeenCalledWith(error, {
      source: "upload-reconciliation-required",
      correlationId: "correlation",
      objectKey: "normalized/key",
    });
  });
});
