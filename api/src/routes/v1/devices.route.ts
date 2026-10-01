import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createDeviceSchema,
  updateDeviceSchema,
  deviceQuerySchema,
} from "../../services/devices/dto";
import { deviceService } from "../../services/devices/service";
import { requireAuth, requireAdmin, optionalAuth } from "../../middlewares/auth";
import { AppError } from "../../services/base.service";
import type { AppBindings } from "../../app";

const devices = new Hono<AppBindings>();

const validationErrorHook = (result: any) => {
  if (!result.success) {
    const details = result.error.issues.map((issue: any) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    throw new AppError(422, "VALIDATION_ERROR", "Validation failed", details);
  }
};

devices.get(
  "/devices",
  requireAuth,
  zValidator("query", deviceQuerySchema, validationErrorHook),
  async (c) => {
    const query = c.req.valid("query");
    const result = await deviceService.list(query);
    return c.json(result);
  }
);

devices.get("/devices/:id", optionalAuth, async (c) => {
  const id = c.req.param("id");
  const result = await deviceService.getById(id);
  return c.json(result);
});

devices.post(
  "/devices",
  requireAdmin,
  zValidator("json", createDeviceSchema, validationErrorHook),
  async (c) => {
    const body = c.req.valid("json");
    const user = c.get("user");
    const result = await deviceService.create(body, user?.id);
    return c.json(result, 201);
  }
);

devices.patch(
  "/devices/:id",
  requireAdmin,
  zValidator("json", updateDeviceSchema, validationErrorHook),
  async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const user = c.get("user");
    const result = await deviceService.update(id, body, user?.id);
    return c.json(result);
  }
);

devices.post("/devices/:id/credentials/rotate", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const result = await deviceService.rotateApiKey(id, user?.id);
  return c.json(result);
});

devices.post("/devices/:id/rotate-key", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const result = await deviceService.rotateApiKey(id, user?.id);
  return c.json(result);
});

devices.get("/devices/:id/health", requireAuth, async (c) => {
  const id = c.req.param("id");
  const threshold = c.req.query("threshold") ? parseInt(c.req.query("threshold")!, 10) : 15;
  const result = await deviceService.getHealth(id, threshold);
  return c.json(result);
});

devices.delete("/devices/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const reason = c.req.query("reason");
  const result = await deviceService.delete(id, user?.id, reason);
  return c.json(result);
});

export default devices;
