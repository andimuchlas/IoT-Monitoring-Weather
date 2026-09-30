import { z } from "zod";

export const locationInputSchema = z.object({
  name: z.string().min(2, "Nama lokasi minimal 2 karakter"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().optional().nullable(),
});

export type LocationInputDto = z.infer<typeof locationInputSchema>;

export const createDeviceSchema = z
  .object({
    id: z
      .string()
      .min(3, "ID stasiun minimal 3 karakter")
      .max(50)
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "ID stasiun hanya boleh berisi huruf, angka, strip, atau underscore"
      ),
    name: z.string().min(3, "Nama stasiun minimal 3 karakter").max(150),
    firmwareVersion: z.string().max(50).optional(),
    status: z
      .enum(["provisioned", "active", "maintenance", "decommissioned"])
      .default("provisioned"),
    locationId: z.string().uuid("ID lokasi harus berupa UUID valid").optional(),
    location: locationInputSchema.optional(),
  })
  .refine((data) => !(data.locationId && data.location), {
    message: "Gunakan salah satu: locationId ATAU objek data lokasi baru, bukan keduanya",
    path: ["locationId"],
  });

export type CreateDeviceDto = z.infer<typeof createDeviceSchema>;

export const updateDeviceSchema = z.object({
  name: z.string().min(3).max(150).optional(),
  firmwareVersion: z.string().max(50).optional(),
  status: z.enum(["provisioned", "active", "maintenance", "decommissioned"]).optional(),
  statusReason: z.string().max(255).optional(),
  locationId: z.string().uuid().optional().nullable(),
  location: locationInputSchema.optional(),
});

export type UpdateDeviceDto = z.infer<typeof updateDeviceSchema>;

export const deviceQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["provisioned", "active", "maintenance", "decommissioned"]).optional(),
  isOffline: z.union([z.boolean(), z.string().transform((val) => val === "true")]).optional(),
});

export type DeviceQueryDto = z.infer<typeof deviceQuerySchema>;
