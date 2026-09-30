import app from "./app";
import { env } from "./configs/env";
import { checkDatabaseConnection } from "./db";

const port = env.PORT ? Number(env.PORT) : 3001;

async function bootstrap() {
  console.log("Checking service dependencies...");

  const postgresConnected = await checkDatabaseConnection();
  if (!postgresConnected) {
    throw new Error("PostgreSQL connection failed");
  }

  const server = Bun.serve({
    hostname: "0.0.0.0",
    port,
    fetch: app.fetch,
  });

  console.log("Service status:");
  console.log(`- API: running on http://0.0.0.0:${port}`);
  console.log("- PostgreSQL: connected");

  let isShuttingDown = false;
  const shutdown = (signal: string) => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    console.log(`🛑 Received ${signal}, shutting down...`);
    server.stop(true);
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

void bootstrap().catch((error) => {
  console.error("❌ Failed to start server", error);
  process.exit(1);
});
