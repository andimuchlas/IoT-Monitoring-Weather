import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";
import { JWT_SECRET } from "../services/auth/service";
import type { AuthUserPayload } from "../services/auth/dto";
import { AppError } from "../services/base.service";
import type { AppBindings } from "../lib/create-app";

export const requireAuth = createMiddleware<AppBindings>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError(401, "UNAUTHORIZED", "Missing or invalid Authorization header");
  }

  const token = authHeader.substring(7).trim();
  try {
    const payload = (await verify(token, JWT_SECRET, "HS256")) as unknown as AuthUserPayload;
    c.set("user", payload);
    await next();
  } catch {
    throw new AppError(401, "INVALID_TOKEN", "Token is invalid or expired");
  }
});

export const requireAdmin = createMiddleware<AppBindings>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError(401, "UNAUTHORIZED", "Missing or invalid Authorization header");
  }

  const token = authHeader.substring(7).trim();
  try {
    const payload = (await verify(token, JWT_SECRET, "HS256")) as unknown as AuthUserPayload;
    if (payload.role !== "admin") {
      throw new AppError(403, "FORBIDDEN", "Admin access required");
    }
    c.set("user", payload);
    await next();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(401, "INVALID_TOKEN", "Token is invalid or expired");
  }
});
