import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { timeseriesQuerySchema, summaryQuerySchema } from "../../services/readings/dto";
import { readingsService } from "../../services/readings/service";
import { optionalAuth } from "../../middlewares/auth";
import { AppError } from "../../services/base.service";
import type { AppBindings } from "../../app";

const readings = new Hono<AppBindings>();

const validationErrorHook = (result: any) => {
  if (!result.success) {
    const details = result.error.issues.map((issue: any) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    throw new AppError(422, "VALIDATION_ERROR", "Validation failed", details);
  }
};

// 1. Dashboard Overview (Spec: GET /api/v1/dashboard/overview)
const handleDashboardOverview = async (c: any) => {
  const result = await readingsService.getDashboardOverview();
  return c.json(result);
};
readings.get("/dashboard/overview", optionalAuth, handleDashboardOverview);
readings.get("/readings/dashboard/overview", optionalAuth, handleDashboardOverview);

// 2. Latest Device Readings (Spec: GET /api/v1/devices/{id}/readings/latest)
const handleLatestReadings = async (c: any) => {
  const deviceId = c.req.param("deviceId") || c.req.param("id");
  const result = await readingsService.getLatestDeviceReadings(deviceId);
  return c.json(result);
};
readings.get("/devices/:deviceId/readings/latest", optionalAuth, handleLatestReadings);
readings.get("/readings/devices/:deviceId/latest", optionalAuth, handleLatestReadings);

// 3. Time-Series Readings (Spec: GET /api/v1/readings)
readings.get(
  "/readings",
  optionalAuth,
  zValidator("query", timeseriesQuerySchema, validationErrorHook),
  async (c) => {
    const query = c.req.valid("query");
    const result = await readingsService.getTimeSeriesReadings(query);
    return c.json(result);
  }
);
readings.get(
  "/readings/devices/:deviceId/timeseries",
  optionalAuth,
  zValidator("query", timeseriesQuerySchema, validationErrorHook),
  async (c) => {
    const deviceId = c.req.param("deviceId");
    const query = c.req.valid("query");
    const result = await readingsService.getTimeSeriesReadings({
      ...query,
      deviceId,
    });
    return c.json(result);
  }
);

// 4. Summary Readings (Spec: GET /api/v1/readings/summary)
readings.get(
  "/readings/summary",
  optionalAuth,
  zValidator("query", summaryQuerySchema, validationErrorHook),
  async (c) => {
    const query = c.req.valid("query");
    const result = await readingsService.getSummary(query);
    return c.json(result);
  }
);
readings.get(
  "/readings/devices/:deviceId/summary",
  optionalAuth,
  zValidator("query", summaryQuerySchema, validationErrorHook),
  async (c) => {
    const deviceId = c.req.param("deviceId");
    const query = c.req.valid("query");
    const result = await readingsService.getSummary({
      ...query,
      deviceId,
    });
    return c.json(result);
  }
);

export default readings;
