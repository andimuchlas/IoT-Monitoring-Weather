import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createSensorSchema,
  updateSensorSchema,
  sensorQuerySchema,
  attachSensorSchema,
  createCalibrationSchema,
} from "../../services/sensors/dto";
import { sensorService } from "../../services/sensors/service";
import { requireAuth, requireAdmin } from "../../middlewares/auth";
import { AppError } from "../../services/base.service";
import type { AppBindings } from "../../app";

const sensorsRoute = new Hono<AppBindings>();

const validationErrorHook = (result: any) => {
  if (!result.success) {
    const details = result.error.issues.map((issue: any) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    throw new AppError(422, "VALIDATION_ERROR", "Validation failed", details);
  }
};

sensorsRoute.get(
  "/sensors",
  requireAuth,
  zValidator("query", sensorQuerySchema, validationErrorHook),
  async (c) => {
    const query = c.req.valid("query");
    const result = await sensorService.listSensors(query);
    return c.json(result);
  }
);

sensorsRoute.get("/sensors/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const result = await sensorService.getSensorById(id);
  return c.json(result);
});

sensorsRoute.post(
  "/sensors",
  requireAdmin,
  zValidator("json", createSensorSchema, validationErrorHook),
  async (c) => {
    const body = c.req.valid("json");
    const result = await sensorService.createSensor(body);
    return c.json(result, 201);
  }
);

sensorsRoute.patch(
  "/sensors/:id",
  requireAdmin,
  zValidator("json", updateSensorSchema, validationErrorHook),
  async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const result = await sensorService.updateSensor(id, body);
    return c.json(result);
  }
);

sensorsRoute.delete("/sensors/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const result = await sensorService.deleteSensor(id);
  return c.json(result);
});

sensorsRoute.post(
  "/devices/:id/sensors",
  requireAdmin,
  zValidator("json", attachSensorSchema, validationErrorHook),
  async (c) => {
    const deviceId = c.req.param("id");
    const body = c.req.valid("json");
    const result = await sensorService.attachSensor(deviceId, body);
    return c.json(result, 201);
  }
);

sensorsRoute.delete("/devices/:id/sensors/:sensor_id", requireAdmin, async (c) => {
  const deviceId = c.req.param("id");
  const sensorId = c.req.param("sensor_id");
  const result = await sensorService.detachSensor(deviceId, sensorId);
  return c.json(result);
});

sensorsRoute.post(
  "/sensors/:id/calibrations",
  requireAdmin,
  zValidator("json", createCalibrationSchema, validationErrorHook),
  async (c) => {
    const sensorId = c.req.param("id");
    const body = c.req.valid("json");
    const result = await sensorService.addCalibration(sensorId, body);
    return c.json(result, 201);
  }
);

sensorsRoute.get("/sensors/:id/calibrations", requireAuth, async (c) => {
  const sensorId = c.req.param("id");
  const result = await sensorService.getCalibrations(sensorId);
  return c.json(result);
});

export default sensorsRoute;
