import { Hono } from "hono";
import { requestId } from "../middlewares/request-id";
import { AppError } from "../services/base.service";
import type { AuthUserPayload } from "../services/auth/dto";

export type AppBindings = {
  Variables: {
    requestId: string;
    user?: AuthUserPayload;
    deviceId?: string;
  };
};

export default function createApp() {
  const app = new Hono<AppBindings>();

  app.use("*", requestId());

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

  return app;
}
