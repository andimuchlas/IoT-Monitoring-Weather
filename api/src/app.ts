import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { poweredBy } from "hono/powered-by";
import { env, validateEnv } from "./configs/env";
import { requestId } from "./middlewares/request-id";
import { AppError } from "./services/base.service";
import type { AuthUserPayload } from "./services/auth/dto";
import { v1Routes } from "./routes/v1";

export type AppBindings = {
  Variables: {
    requestId: string;
    user?: AuthUserPayload;
    deviceId?: string;
  };
};

validateEnv();

const app = new Hono<AppBindings>();

app.use("*", requestId());
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

app.use("*", cors(corsConfig[env.NODE_ENV as keyof typeof corsConfig] || corsConfig.development));

// Global Error Handler
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(
      {
        success: false,
        message: err.message,
        code: err.code,
        ...(err.details ? { details: err.details } : {}),
      },
      err.statusCode as any
    );
  }

  console.error("[Unhandled Error]:", err);
  return c.json(
    {
      success: false,
      message: "An internal server error occurred",
      code: "INTERNAL_SERVER_ERROR",
    },
    500
  );
});

// Mount all v1 routes under /api/v1
v1Routes.forEach((route) => {
  app.basePath("/api").route("/v1", route);
});

export default app;
