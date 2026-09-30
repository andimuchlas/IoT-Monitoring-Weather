import { Hono } from "hono";
import type { AppBindings } from "../../lib/create-app";

const health = new Hono<AppBindings>();

health.get("/health", (c) =>
  c.json({
    success: true,
    message: "Server is healthy",
    status: "ok",
    timestamp: new Date().toISOString(),
  })
);

export default health;
