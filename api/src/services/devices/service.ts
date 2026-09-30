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
  /**
   * Mengambil daftar stasiun cuaca dengan filter pencarian dan status
   */
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

    // Filter berdasarkan teks pencarian (ID, Nama, atau Nama Lokasi)
    if (query.search && query.search.trim() !== "") {
      const keyword = query.search.toLowerCase();
      results = results.filter((d) => {
        const matchId = d.id.toLowerCase().includes(keyword);
        const matchName = d.name.toLowerCase().includes(keyword);
        const matchLocation = d.location?.name?.toLowerCase().includes(keyword) || false;
        return matchId || matchName || matchLocation;
      });
    }

    // Filter offline jika dispesifikasikan di query param
    if (query.isOffline !== undefined) {
      results = results.filter((d) => d.isOffline === query.isOffline);
    }

    return this.success(results);
  }

  /**
   * Mengambil detail satu stasiun cuaca beserta lokasi dan sensor yang sedang aktif terpasang
   */
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

    // Ambil sensor yang sedang terpasang aktif pada stasiun ini (uninstalledAt IS NULL)
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

    // Ambil formula kalibrasi aktif untuk setiap sensor terpasang
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

  /**
   * Mendaftarkan stasiun cuaca baru, generate API key, dan mencatat audit status
   */
  async create(dto: CreateDeviceDto, userId?: string) {
    // Periksa apakah ID stasiun sudah digunakan
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

      // Buat lokasi baru jika disediakan inline
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

      // Insert stasiun cuaca baru
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

      // Catat log riwayat status stasiun pertama kali
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
      apiKey: rawApiKey, // Plaintext API Key dikembalikan HANYA SEKALI untuk konfigurasi mikrokontroler
    });
  }

  /**
   * Memperbarui metadata atau status stasiun cuaca
   */
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

      // Catat riwayat jika ada perubahan status operasional
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

  /**
   * Rotasi kredensial API Key stasiun cuaca
   */
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
      apiKey: newRawKey, // Plaintext API Key baru dikembalikan hanya sekali
    });
  }

  /**
   * Soft-delete stasiun cuaca dan mencatat status decommissioned
   */
  async delete(id: string, userId?: string, reason?: string) {
    const existing = await db.query.devices.findFirst({
      where: and(eq(devices.id, id), isNull(devices.deletedAt)),
    });

    if (!existing) {
      this.notFound("DEVICE_NOT_FOUND", `Stasiun cuaca dengan ID '${id}' tidak ditemukan`);
    }

    await db.transaction(async (tx) => {
      // Catat riwayat decommission
      await tx.insert(deviceStatusHistory).values({
        deviceId: id,
        oldStatus: existing.status,
        newStatus: "decommissioned",
        changedBy: userId || null,
        reason: reason || "Stasiun dinonaktifkan (soft delete)",
      });

      // Soft delete stasiun
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
}

export const deviceService = new DeviceService();
