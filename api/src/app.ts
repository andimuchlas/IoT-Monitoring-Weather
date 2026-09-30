import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { poweredBy } from "hono/powered-by";
import { env, validateEnv } from "./configs/env";
import createApp from "./lib/create-app";
import { v1Routes } from "./routes/v1";

validateEnv();

const app = createApp();

app.use("*", logger());
app.use("*", poweredBy({ serverName: "Luwes IoT Weather Station API" }));

const corsConfig = {
  development: {
    origin: env.ORIGIN || "*",
    credentials: true,
  },
  production: {
    origin: env.ORIGIN || "*",
    allowHeaders: ["Content-Type", "Authorization", "Cookie", "X-Request-Id", "X-API-Key"],
    allowMethods: ["POST", "GET", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length", "X-Request-Id"],
    maxAge: 600,
    credentials: true,
  },
};

app.use(
  "*",
  cors(
    corsConfig[env.NODE_ENV as keyof typeof corsConfig] ||
      corsConfig.development
  )
);

// Mount all v1 routes under /api/v1
v1Routes.forEach((route) => {
  app.basePath("/api").route("/v1", route);
});

export default app;
