import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.get("/healthz", (c) => c.json({ status: "ok" }));

const port = Number(process.env.PORT) || 3001;
console.log(`🚀 API Server running on port ${port}`);

export default {
    port,
    fetch: app.fetch,
};