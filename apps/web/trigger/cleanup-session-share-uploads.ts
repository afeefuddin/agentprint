import { schedules } from "@trigger.dev/sdk";
import { deleteStaleSessionShareUploads } from "@agentprint/database";

export const cleanupSessionShareUploadsTask = schedules.task({
  id: "cleanup-session-share-uploads",
  cron: {
    pattern: "17 3 * * *",
    timezone: "UTC",
    environments: ["PRODUCTION"]
  },
  run: async () => ({ deleted: await deleteStaleSessionShareUploads() })
});
