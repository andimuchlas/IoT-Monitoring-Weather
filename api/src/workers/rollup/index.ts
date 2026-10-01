import { validateRedis, closeRedis } from "@/configs/redis";
import { checkDatabaseConnection } from "@/db";
import { registerRollupScheduler } from "./scheduler";
import { initializeRollupWorker } from "./worker";

async function initialize() {
  console.log("🔄 Initializing rollup worker process");

  await validateRedis();
  if (!(await checkDatabaseConnection())) {
    throw new Error("Database connection check failed");
  }

  await registerRollupScheduler();
  const worker = initializeRollupWorker();

  console.log("🚀 Rollup worker is ready (BullMQ)");

  const shutdown = async (signal: string) => {
    console.log(`📤 Shutting down rollup worker (${signal})...`);
    await worker.close();
    await closeRedis();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void initialize().catch((error) => {
  console.error("❌ Failed to initialize rollup worker", error);
  process.exit(1);
});
