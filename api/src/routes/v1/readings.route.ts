import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { timeseriesQuerySchema, summaryQuerySchema } from "../../services/readings/dto";
import { readingsService } from "../../services/readings/service";
import { requireAuth } from "../../middlewares/auth";
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

readings.get("/readings/dashboard/overview", requireAuth, async (c) => {
  const result = await readingsService.getDashboardOverview();
  return c.json(result);
});

readings.get("/readings/devices/:deviceId/latest", requireAuth, async (c) => {
  const deviceId = c.req.param("deviceId");
  const result = await readingsService.getLatestDeviceReadings(deviceId);
  return c.json(result);
});

readings.get(
  "/readings/devices/:deviceId/timeseries",
  requireAuth,
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

readings.get(
  "/readings/devices/:deviceId/summary",
  requireAuth,
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
