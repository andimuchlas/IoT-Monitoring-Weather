import crypto from "node:crypto";
import { eq, and, isNull, or, ilike, desc, lte, inArray } from "drizzle-orm";
import { BaseService } from "../base.service";
import { db } from "../../db";
import {
  devices,
  locations,
  deviceStatusHistory,
  sensorInstallations,
  sensors,
  sensorTypes,
  sensorCalibrations,
} from "../../db/schema";
import type { CreateDeviceDto, UpdateDeviceDto, DeviceQueryDto } from "./dto";

export function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(24).toString("hex");
  return `ws_live_${randomBytes}`;
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function isDeviceOffline(lastSeenAt: Date | string | null, thresholdMinutes = 15): boolean {
  if (!lastSeenAt) return true;
  const time =
    typeof lastSeenAt === "string" ? new Date(lastSeenAt).getTime() : lastSeenAt.getTime();
  return Date.now() - time > thresholdMinutes * 60 * 1000;
}

export class DeviceService extends BaseService {
  async list(query: DeviceQueryDto) {
    const conditions = [isNull(devices.deletedAt)];

    if (query.status) {
      conditions.push(eq(devices.status, query.status));
    }

    const deviceRecords = await db.query.devices.findMany({
      where: and(...conditions),
      with: {
        location: true,
      },
      orderBy: [desc(devices.createdAt)],
    });

    let results = deviceRecords.map((d) => {
      const isOffline = isDeviceOffline(d.lastSeenAt);
      const { apiKeyHash, ...safeDevice } = d;
      return {
        ...safeDevice,
        isOffline,
      };
    });

    if (query.search && query.search.trim() !== "") {
      const keyword = query.search.toLowerCase();
      results = results.filter((d) => {
        const matchId = d.id.toLowerCase().includes(keyword);
        const matchName = d.name.toLowerCase().includes(keyword);
        const matchLocation = d.location?.name?.toLowerCase().includes(keyword) || false;
        return matchId || matchName || matchLocation;
      });
    }

    if (query.isOffline !== undefined) {
      results = results.filter((d) => d.isOffline === query.isOffline);
    }

    return this.success(results);
  }

  async getById(id: string) {
    const device = await db.query.devices.findFirst({
      where: and(eq(devices.id, id), isNull(devices.deletedAt)),
      with: {
        location: true,
      },
    });

    if (!device) {
      this.notFound("DEVICE_NOT_FOUND", `Stasiun cuaca dengan ID '${id}' tidak ditemukan`);
    }

    const activeInstallations = await db.query.sensorInstallations.findMany({
      where: and(eq(sensorInstallations.deviceId, id), isNull(sensorInstallations.uninstalledAt)),
      with: {
        sensor: {
          with: {
            type: true,
          },
        },
      },
      orderBy: [desc(sensorInstallations.installedAt)],
    });

    const installedSensors = await Promise.all(
      activeInstallations.map(async (inst) => {
        const activeCalibration = await db.query.sensorCalibrations.findFirst({
          where: and(
            eq(sensorCalibrations.sensorId, inst.sensorId),
            lte(sensorCalibrations.effectiveFrom, new Date())
          ),
          orderBy: [desc(sensorCalibrations.effectiveFrom)],
        });

        return {
          id: inst.sensor.id,
          serialNumber: inst.sensor.serialNumber,
          name: inst.sensor.name,
          sensorTypeId: inst.sensor.sensorTypeId,
          status: inst.sensor.status,
          sensorType: inst.sensor.type,
          installedAt: inst.installedAt,
          calibration: activeCalibration || {
            scale: 1.0,
            offset: 0.0,
            effectiveFrom: inst.installedAt,
            notes: "Formula kalibrasi default",
          },
        };
      })
    );

    const isOffline = isDeviceOffline(device.lastSeenAt);
    const { apiKeyHash, ...safeDevice } = device;

    return this.success({
      ...safeDevice,
      isOffline,
      installedSensors,
    });
  }

  async create(dto: CreateDeviceDto, userId?: string) {
    const existing = await db.query.devices.findFirst({
      where: eq(devices.id, dto.id),
    });

    if (existing) {
      this.conflict("DEVICE_ALREADY_EXISTS", `Stasiun dengan ID '${dto.id}' sudah terdaftar`);
    }

    const rawApiKey = generateApiKey();
    const apiKeyHash = hashApiKey(rawApiKey);

    const result = await db.transaction(async (tx) => {
      let finalLocationId = dto.locationId || null;

      if (dto.location) {
        const [newLocation] = await tx
          .insert(locations)
          .values({
            name: dto.location.name,
            latitude: dto.location.latitude,
            longitude: dto.location.longitude,
            altitude: dto.location.altitude ?? null,
          })
          .returning();

        if (!newLocation) {
          throw new Error("Gagal membuat data lokasi");
        }
        finalLocationId = newLocation.id;
      }

      const [newDevice] = await tx
        .insert(devices)
        .values({
          id: dto.id,
          name: dto.name,
          locationId: finalLocationId,
          apiKeyHash,
          status: dto.status || "provisioned",
          firmwareVersion: dto.firmwareVersion || null,
        })
        .returning();

      if (!newDevice) {
        throw new Error("Gagal mendaftarkan stasiun cuaca");
      }

      await tx.insert(deviceStatusHistory).values({
        deviceId: newDevice.id,
        oldStatus: null,
        newStatus: newDevice.status,
        changedBy: userId || null,
        reason: "Pendaftaran awal stasiun cuaca",
      });

      return newDevice;
    });

    const { apiKeyHash: _, ...safeDevice } = result;

    return this.success({
      device: safeDevice,
      apiKey: rawApiKey,
    });
  }

  async update(id: string, dto: UpdateDeviceDto, userId?: string) {
    const existing = await db.query.devices.findFirst({
      where: and(eq(devices.id, id), isNull(devices.deletedAt)),
    });

    if (!existing) {
      this.notFound("DEVICE_NOT_FOUND", `Stasiun cuaca dengan ID '${id}' tidak ditemukan`);
    }

    const updatedDevice = await db.transaction(async (tx) => {
      let finalLocationId = existing.locationId;

      if (dto.location) {
        const [newLocation] = await tx
          .insert(locations)
          .values({
            name: dto.location.name,
            latitude: dto.location.latitude,
            longitude: dto.location.longitude,
            altitude: dto.location.altitude ?? null,
          })
          .returning();

        if (!newLocation) {
          throw new Error("Gagal membuat data lokasi baru");
        }
        finalLocationId = newLocation.id;
      } else if (dto.locationId !== undefined) {
        finalLocationId = dto.locationId;
      }

      if (dto.status && dto.status !== existing.status) {
        await tx.insert(deviceStatusHistory).values({
          deviceId: id,
          oldStatus: existing.status,
          newStatus: dto.status,
          changedBy: userId || null,
          reason: dto.statusReason || "Pembaruan status operasional stasiun",
        });
      }

      const [updated] = await tx
        .update(devices)
        .set({
          name: dto.name ?? existing.name,
          firmwareVersion: dto.firmwareVersion ?? existing.firmwareVersion,
          status: dto.status ?? existing.status,
          locationId: finalLocationId,
          updatedAt: new Date(),
        })
        .where(eq(devices.id, id))
        .returning();

      if (!updated) {
        throw new Error("Gagal memperbarui data stasiun cuaca");
      }

      return updated;
    });

    const { apiKeyHash: _, ...safeDevice } = updatedDevice;
    return this.success(safeDevice);
  }

  async rotateApiKey(id: string, userId?: string) {
    const existing = await db.query.devices.findFirst({
      where: and(eq(devices.id, id), isNull(devices.deletedAt)),
    });

    if (!existing) {
      this.notFound("DEVICE_NOT_FOUND", `Stasiun cuaca dengan ID '${id}' tidak ditemukan`);
    }

    const newRawKey = generateApiKey();
    const newHash = hashApiKey(newRawKey);

    await db
      .update(devices)
      .set({
        apiKeyHash: newHash,
        updatedAt: new Date(),
      })
      .where(eq(devices.id, id));

    return this.success({
      deviceId: id,
      apiKey: newRawKey,
    });
  }

  async delete(id: string, userId?: string, reason?: string) {
    const existing = await db.query.devices.findFirst({
      where: and(eq(devices.id, id), isNull(devices.deletedAt)),
    });

    if (!existing) {
      this.notFound("DEVICE_NOT_FOUND", `Stasiun cuaca dengan ID '${id}' tidak ditemukan`);
    }

    await db.transaction(async (tx) => {
      await tx.insert(deviceStatusHistory).values({
        deviceId: id,
        oldStatus: existing.status,
        newStatus: "decommissioned",
        changedBy: userId || null,
        reason: reason || "Stasiun dinonaktifkan (soft delete)",
      });

      await tx
        .update(devices)
        .set({
          status: "decommissioned",
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(devices.id, id));
    });

    return this.success({
      message: `Stasiun '${id}' berhasil dinonaktifkan.`,
    });
  }

  async getHealth(id: string, thresholdMinutes = 15) {
    const device = await db.query.devices.findFirst({
      where: and(eq(devices.id, id), isNull(devices.deletedAt)),
      with: {
        location: true,
      },
    });

    if (!device) {
      this.notFound("DEVICE_NOT_FOUND", `Stasiun cuaca dengan ID '${id}' tidak ditemukan`);
    }

    const isOffline = isDeviceOffline(device.lastSeenAt, thresholdMinutes);
    const lastSeenTime = device.lastSeenAt ? new Date(device.lastSeenAt).getTime() : 0;
    const minutesSinceLastSeen =
      lastSeenTime > 0 ? Math.round((Date.now() - lastSeenTime) / (60 * 1000)) : null;

    return this.success({
      deviceId: device.id,
      name: device.name,
      status: device.status,
      isOffline,
      thresholdMinutes,
      minutesSinceLastSeen,
      lastSeenAt: device.lastSeenAt,
      batteryV: device.batteryV,
      isLowBattery: device.batteryV !== null && device.batteryV < 3.7,
      rssi: device.rssi,
      firmwareVersion: device.firmwareVersion,
      location: device.location ? { id: device.location.id, name: device.location.name } : null,
    });
  }
}

export const deviceService = new DeviceService();
