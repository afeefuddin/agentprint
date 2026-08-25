import { AbortTaskRunError, task } from "@trigger.dev/sdk";
import {
  PermanentSessionShareUploadError,
  processSessionShareUpload
} from "../lib/session-share-processing";
import { failSessionShareUpload } from "@agentprint/database";

export const processSessionShareTask = task({
  id: "process-session-share",
  machine: "medium-1x",
  queue: { concurrencyLimit: 2 },
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 10_000,
    factor: 2,
    randomize: true
  },
  maxDuration: 120,
  run: async ({ uploadId }: { uploadId: string }) => {
    try {
      return await processSessionShareUpload(uploadId);
    } catch (error) {
      if (error instanceof PermanentSessionShareUploadError) {
        throw new AbortTaskRunError(error.code);
      }
      throw error;
    }
  },
  onFailure: async ({ payload }) => {
    await failSessionShareUpload(payload.uploadId, "processing_failed");
  }
});
