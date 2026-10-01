import { z } from "zod";

export const telemetryReadingItemSchema = z.object({
  s: z
    .string({ message: "Sensor type ID wajib diisi" })
    .min(1, { message: "Sensor type ID tidak boleh kosong" }),
  v: z.number({ message: "Nilai sensor harus berupa angka" }),
});

export const singleTelemetrySchema = z.object({
  device_id: z
    .string({ message: "Device ID wajib diisi" })
    .min(1, { message: "Device ID tidak boleh kosong" }),
  fw: z.string().optional(),
  ts: z
    .number({ message: "Timestamp wajib berupa angka Unix epoch" })
    .int({ message: "Timestamp harus integer" }),
  seq: z.number().int().optional(),
  battery_v: z.number().optional(),
  rssi: z.number().int().optional(),
  readings: z
    .array(telemetryReadingItemSchema)
    .min(1, { message: "Readings minimal berisi 1 item" }),
});

export const batchTelemetryItemSchema = z.object({
  ts: z
    .number({ message: "Timestamp wajib berupa angka Unix epoch" })
    .int({ message: "Timestamp harus integer" }),
  seq: z.number().int().optional(),
  battery_v: z.number().optional(),
  rssi: z.number().int().optional(),
  readings: z
    .array(telemetryReadingItemSchema)
    .min(1, { message: "Readings minimal berisi 1 item" }),
});

export const batchTelemetrySchema = z.object({
  device_id: z
    .string({ message: "Device ID wajib diisi" })
    .min(1, { message: "Device ID tidak boleh kosong" }),
  fw: z.string().optional(),
  batch: z
    .array(batchTelemetryItemSchema)
    .min(1, { message: "Batch minimal berisi 1 record" })
    .max(500, { message: "Maksimal 500 record per batch" }),
});

export const heartbeatSchema = z.object({
  device_id: z
    .string({ message: "Device ID wajib diisi" })
    .min(1, { message: "Device ID tidak boleh kosong" }),
  ts: z
    .number({ message: "Timestamp wajib berupa angka Unix epoch" })
    .int({ message: "Timestamp harus integer" }),
  fw: z.string().optional(),
  battery_v: z.number().optional(),
  rssi: z.number().int().optional(),
  uptime_s: z.number().int().optional(),
});

export type TelemetryReadingItemDto = z.infer<typeof telemetryReadingItemSchema>;
export type SingleTelemetryDto = z.infer<typeof singleTelemetrySchema>;
export type BatchTelemetryItemDto = z.infer<typeof batchTelemetryItemSchema>;
export type BatchTelemetryDto = z.infer<typeof batchTelemetrySchema>;
export type HeartbeatDto = z.infer<typeof heartbeatSchema>;
