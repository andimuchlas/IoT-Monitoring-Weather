import { z } from "zod";

export const createSensorTypeSchema = z
  .object({
    id: z
      .string()
      .min(2, "ID tipe sensor minimal 2 karakter")
      .max(50)
      .regex(
        /^[a-z0-9_]+$/,
        "ID tipe sensor hanya boleh huruf kecil, angka, dan underscore (contoh: temp_air)"
      ),
    name: z.string().min(2, "Nama tipe sensor minimal 2 karakter").max(100),
    unit: z.string().min(1, "Satuan pengukuran wajib diisi").max(30),
    minVal: z.number({ message: "Batas nilai minimum (minVal) wajib diisi" }),
    maxVal: z.number({ message: "Batas nilai maksimum (maxVal) wajib diisi" }),
    precision: z.number().int().min(0).max(6).default(2),
  })
  .refine((data) => data.maxVal > data.minVal, {
    message: "Batas nilai maksimum (maxVal) harus lebih besar dari batas minimum (minVal)",
    path: ["maxVal"],
  });

export type CreateSensorTypeDto = z.infer<typeof createSensorTypeSchema>;

export const updateSensorTypeSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    unit: z.string().min(1).max(30).optional(),
    minVal: z.number().optional(),
    maxVal: z.number().optional(),
    precision: z.number().int().min(0).max(6).optional(),
  })
  .refine(
    (data) => {
      if (data.minVal !== undefined && data.maxVal !== undefined) {
        return data.maxVal > data.minVal;
      }
      return true;
    },
    {
      message: "Batas nilai maksimum (maxVal) harus lebih besar dari batas minimum (minVal)",
      path: ["maxVal"],
    }
  );

export type UpdateSensorTypeDto = z.infer<typeof updateSensorTypeSchema>;

export const createSensorSchema = z.object({
  serialNumber: z
    .string()
    .min(3, "Serial number minimal 3 karakter")
    .max(100)
    .regex(/^[A-Za-z0-9_-]+$/, "Serial number hanya boleh huruf, angka, strip, dan underscore"),
  name: z.string().min(2, "Nama sensor minimal 2 karakter").max(100),
  sensorTypeId: z.string().min(2, "Tipe sensor wajib dipilih").max(50),
  status: z.enum(["active", "maintenance", "faulty", "decommissioned"]).default("active"),
});

export type CreateSensorDto = z.infer<typeof createSensorSchema>;

export const updateSensorSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  sensorTypeId: z.string().min(2).max(50).optional(),
  status: z.enum(["active", "maintenance", "faulty", "decommissioned"]).optional(),
});

export type UpdateSensorDto = z.infer<typeof updateSensorSchema>;

export const sensorQuerySchema = z.object({
  search: z.string().optional(),
  sensorTypeId: z.string().optional(),
  status: z.enum(["active", "maintenance", "faulty", "decommissioned"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type SensorQueryDto = z.infer<typeof sensorQuerySchema>;

export const attachSensorSchema = z.object({
  sensorId: z.string().uuid("ID sensor harus berupa UUID yang valid"),
  installedAt: z.coerce.date().optional(),
  calibration: z
    .object({
      scale: z.number().default(1.0),
      offset: z.number().default(0.0),
      notes: z.string().max(255).optional(),
    })
    .optional(),
});

export type AttachSensorDto = z.infer<typeof attachSensorSchema>;

export const createCalibrationSchema = z.object({
  scale: z.number().default(1.0),
  offset: z.number().default(0.0),
  effectiveFrom: z.coerce.date().default(() => new Date()),
  notes: z.string().max(255).optional(),
});

export type CreateCalibrationDto = z.infer<typeof createCalibrationSchema>;
