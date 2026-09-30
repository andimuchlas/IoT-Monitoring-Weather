import { rateLimiter } from "hono-rate-limiter";
import type { Context } from "hono";
import type { AppBindings } from "../app";

export const apiRateLimiter = rateLimiter<AppBindings>({
  windowMs: 60 * 1000, // 1 menit
  limit: 120, // Maksimal 120 request per menit
  standardHeaders: "draft-6",
  keyGenerator: (c: Context<AppBindings>) => {
    const deviceId = c.req.header("X-Device-Id");
    if (deviceId) {
      return `device:${deviceId}`;
    }

    const ip =
      c.req.header("cf-connecting-ip") ||
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      "anonymous-client";

    return `ip:${ip}`;
  },
  handler: (c) => {
    return c.json(
      {
        success: false,
        message: "Too many requests. Please slow down and try again later.",
        code: "RATE_LIMIT_EXCEEDED",
      },
      429
    );
  },
});
