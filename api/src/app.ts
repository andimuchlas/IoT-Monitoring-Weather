import { Hono } from "hono";
import { cors } from "hono/cors";
import { httpStructuredLogger, logger } from "./lib/logger";
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
app.use("*", httpStructuredLogger());
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

app.onError((err, c) => {
  const reqId = c.get("requestId");

  if (err instanceof AppError) {
    logger.warn(`Application error [${err.code}]: ${err.message}`, {
      requestId: reqId,
      path: c.req.path,
      method: c.req.method,
      statusCode: err.statusCode,
      details: err.details,
    });

    return c.json(
      {
        success: false,
        message: err.message,
        code: err.code,
        requestId: reqId,
        ...(err.details ? { details: err.details } : {}),
      },
      err.statusCode as any
    );
  }

  logger.error("Unhandled internal server error", err, {
    requestId: reqId,
    path: c.req.path,
    method: c.req.method,
  });

  return c.json(
    {
      success: false,
      message: "An internal server error occurred",
      code: "INTERNAL_SERVER_ERROR",
      requestId: reqId,
    },
    500
  );
});

v1Routes.forEach((route) => {
  app.basePath("/api").route("/v1", route);
});

export default app;
