import { z } from "zod";

export const timeseriesQuerySchema = z.object({
  deviceId: z.string().optional(),
  device_id: z.string().optional(),
  sensorTypeId: z.string().optional(),
  sensor_type: z.string().optional(),
  sensor_type_id: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  interval: z.enum(["raw", "1m", "5m", "1h", "1d"]).default("raw"),
  agg: z.enum(["avg", "min", "max", "sum"]).optional(),
  order: z.enum(["asc", "desc"]).default("asc"),
  limit: z.coerce.number().int().min(1).max(5000).default(500),
  page: z.coerce.number().int().min(1).default(1),
});

export const summaryQuerySchema = z.object({
  deviceId: z.string().optional(),
  device_id: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type TimeseriesQueryDto = z.infer<typeof timeseriesQuerySchema>;
export type SummaryQueryDto = z.infer<typeof summaryQuerySchema>;
