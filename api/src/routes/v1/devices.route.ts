import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createDeviceSchema,
  updateDeviceSchema,
  deviceQuerySchema,
} from "../../services/devices/dto";
import { deviceService } from "../../services/devices/service";
import { requireAuth, requireAdmin } from "../../middlewares/auth";
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

// GET /devices - Daftar stasiun cuaca dengan filter status dan pencarian
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

// GET /devices/:id - Detail stasiun cuaca beserta sensor terpasang & kalibrasi
devices.get("/devices/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const result = await deviceService.getById(id);
  return c.json(result);
});

// POST /devices - Pendaftaran stasiun cuaca baru (Admin only)
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

// PATCH /devices/:id - Pembaruan metadata atau status stasiun cuaca (Admin only)
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

// POST /devices/:id/rotate-key - Rotasi kredensial API Key stasiun cuaca (Admin only)
devices.post("/devices/:id/rotate-key", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const result = await deviceService.rotateApiKey(id, user?.id);
  return c.json(result);
});

// DELETE /devices/:id - Decommission / Soft-delete stasiun cuaca (Admin only)
devices.delete("/devices/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const reason = c.req.query("reason");
  const result = await deviceService.delete(id, user?.id, reason);
  return c.json(result);
});

export default devices;
