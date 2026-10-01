import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  singleTelemetrySchema,
  batchTelemetrySchema,
  heartbeatSchema,
} from "../../services/ingest/dto";
import { ingestService } from "../../services/ingest/service";
import { AppError } from "../../services/base.service";
import type { AppBindings } from "../../app";

const ingest = new Hono<AppBindings>();

const validationErrorHook = (result: any) => {
  if (!result.success) {
    const details = result.error.issues.map((issue: any) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    throw new AppError(422, "VALIDATION_ERROR", "Validation failed", details);
  }
};

const getApiKey = (c: any): string => {
  const headerKey = c.req.header("X-API-Key");
  if (headerKey) return headerKey;

  const authHeader = c.req.header("Authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.substring(7).trim();
  }

  throw new AppError(401, "UNAUTHORIZED", "Header X-API-Key wajib disertakan");
};

ingest.post(
  "/ingest/telemetry",
  zValidator("json", singleTelemetrySchema, validationErrorHook),
  async (c) => {
    const body = c.req.valid("json");
    const apiKey = getApiKey(c);
    const result = await ingestService.ingestTelemetry(body, apiKey);
    return c.json(result.response, result.status as any);
  }
);

ingest.post(
  "/ingest/telemetry/batch",
  zValidator("json", batchTelemetrySchema, validationErrorHook),
  async (c) => {
    const body = c.req.valid("json");
    const apiKey = getApiKey(c);
    const result = await ingestService.ingestBatch(body, apiKey);
    return c.json(result.response, result.status as any);
  }
);

ingest.post(
  "/ingest/heartbeat",
  zValidator("json", heartbeatSchema, validationErrorHook),
  async (c) => {
    const body = c.req.valid("json");
    const apiKey = getApiKey(c);
    const result = await ingestService.ingestHeartbeat(body, apiKey);
    return c.json(result.response, result.status as any);
  }
);

export default ingest;
