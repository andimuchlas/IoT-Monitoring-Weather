import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { loginSchema } from "../../services/auth/dto";
import { authService } from "../../services/auth/service";
import { requireAuth } from "../../middlewares/auth";
import { AppError } from "../../services/base.service";
import type { AppBindings } from "../../lib/create-app";

const auth = new Hono<AppBindings>();

auth.post(
  "/auth/login",
  zValidator("json", loginSchema, (result) => {
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      throw new AppError(422, "VALIDATION_ERROR", "Validation failed", details);
    }
  }),
  async (c) => {
    const body = c.req.valid("json");
    const result = await authService.login(body);
    return c.json(result);
  }
);

auth.get("/auth/me", requireAuth, async (c) => {
  const user = c.get("user");
  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "User session not found");
  }
  const result = await authService.getProfile(user.id);
  return c.json(result);
});

export default auth;
