import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createSensorTypeSchema, updateSensorTypeSchema } from "../../services/sensors/dto";
import { sensorService } from "../../services/sensors/service";
import { requireAuth, requireAdmin } from "../../middlewares/auth";
import { AppError } from "../../services/base.service";
import type { AppBindings } from "../../app";

const sensorTypesRoute = new Hono<AppBindings>();

const validationErrorHook = (result: any) => {
  if (!result.success) {
    const details = result.error.issues.map((issue: any) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    throw new AppError(422, "VALIDATION_ERROR", "Validation failed", details);
  }
};

sensorTypesRoute.get("/sensor-types", requireAuth, async (c) => {
  const result = await sensorService.listSensorTypes();
  return c.json(result);
});

sensorTypesRoute.get("/sensor-types/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const result = await sensorService.getSensorTypeById(id);
  return c.json(result);
});

sensorTypesRoute.post(
  "/sensor-types",
  requireAdmin,
  zValidator("json", createSensorTypeSchema, validationErrorHook),
  async (c) => {
    const body = c.req.valid("json");
    const result = await sensorService.createSensorType(body);
    return c.json(result, 201);
  }
);

sensorTypesRoute.patch(
  "/sensor-types/:id",
  requireAdmin,
  zValidator("json", updateSensorTypeSchema, validationErrorHook),
  async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const result = await sensorService.updateSensorType(id, body);
    return c.json(result);
  }
);

export default sensorTypesRoute;
