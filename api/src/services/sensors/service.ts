import { eq, and, isNull, desc, ilike, sql } from "drizzle-orm";
import { BaseService } from "../base.service";
import { db } from "../../db";
import {
  sensorTypes,
  sensors,
  sensorInstallations,
  sensorCalibrations,
  devices,
} from "../../db/schema";
import { logger } from "../../lib/logger";
import type {
  CreateSensorTypeDto,
  UpdateSensorTypeDto,
  CreateSensorDto,
  UpdateSensorDto,
  SensorQueryDto,
  AttachSensorDto,
  CreateCalibrationDto,
} from "./dto";

export class SensorService extends BaseService {
  async listSensorTypes() {
    const list = await db.query.sensorTypes.findMany({
      orderBy: [sensorTypes.id],
    });
    return this.success(list);
  }

  async getSensorTypeById(id: string) {
    const type = await db.query.sensorTypes.findFirst({
      where: eq(sensorTypes.id, id),
    });

    if (!type) {
      this.notFound("SENSOR_TYPE_NOT_FOUND", `Tipe sensor dengan ID '${id}' tidak ditemukan`);
    }

    return this.success(type);
  }

  async createSensorType(dto: CreateSensorTypeDto) {
    const existing = await db.query.sensorTypes.findFirst({
      where: eq(sensorTypes.id, dto.id),
    });

    if (existing) {
      this.conflict("SENSOR_TYPE_ALREADY_EXISTS", `Tipe sensor '${dto.id}' sudah terdaftar`);
    }

    const [newType] = await db.insert(sensorTypes).values(dto).returning();
    logger.info(`Sensor type created: ${dto.id} (${dto.name})`);
    return this.success(newType, "Tipe sensor berhasil dibuat");
  }

  async updateSensorType(id: string, dto: UpdateSensorTypeDto) {
    const existing = await db.query.sensorTypes.findFirst({
      where: eq(sensorTypes.id, id),
    });

    if (!existing) {
      this.notFound("SENSOR_TYPE_NOT_FOUND", `Tipe sensor dengan ID '${id}' tidak ditemukan`);
    }

    const [updated] = await db
      .update(sensorTypes)
      .set({
        name: dto.name ?? existing.name,
        unit: dto.unit ?? existing.unit,
        minVal: dto.minVal ?? existing.minVal,
        maxVal: dto.maxVal ?? existing.maxVal,
        precision: dto.precision ?? existing.precision,
        updatedAt: new Date(),
      })
      .where(eq(sensorTypes.id, id))
      .returning();

    return this.success(updated, "Tipe sensor berhasil diperbarui");
  }

  async listSensors(query: SensorQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (query.status) {
      conditions.push(eq(sensors.status, query.status));
    }
    if (query.sensorTypeId) {
      conditions.push(eq(sensors.sensorTypeId, query.sensorTypeId));
    }
    if (query.search && query.search.trim() !== "") {
      const kw = `%${query.search.trim().toLowerCase()}%`;
      conditions.push(
        sql`LOWER(${sensors.name}) LIKE ${kw} OR LOWER(${sensors.serialNumber}) LIKE ${kw}`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const sensorRecords = await db.query.sensors.findMany({
      where: whereClause,
      with: {
        type: true,
        installations: {
          where: isNull(sensorInstallations.uninstalledAt),
          with: {
            device: true,
          },
        },
      },
      orderBy: [desc(sensors.createdAt)],
      limit,
      offset,
    });

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sensors)
      .where(whereClause);

    const total = countResult?.count || 0;
    const totalPages = Math.ceil(total / limit);

    const formatted = await Promise.all(
      sensorRecords.map(async (s) => {
        const activeInstallation = s.installations[0] || null;

        const activeCal = await db.query.sensorCalibrations.findFirst({
          where: eq(sensorCalibrations.sensorId, s.id),
          orderBy: [desc(sensorCalibrations.effectiveFrom)],
        });

        return {
          id: s.id,
          serialNumber: s.serialNumber,
          name: s.name,
          sensorTypeId: s.sensorTypeId,
          status: s.status,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          type: s.type,
          currentInstallation: activeInstallation
            ? {
                installationId: activeInstallation.id,
                deviceId: activeInstallation.deviceId,
                deviceName: activeInstallation.device.name,
                installedAt: activeInstallation.installedAt,
              }
            : null,
          activeCalibration: activeCal || {
            scale: 1.0,
            offset: 0.0,
            effectiveFrom: s.createdAt,
            notes: "Default 1:1 calibration",
          },
        };
      })
    );

    return {
      success: true,
      data: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async getSensorById(id: string) {
    const sensor = await db.query.sensors.findFirst({
      where: eq(sensors.id, id),
      with: {
        type: true,
        installations: {
          orderBy: [desc(sensorInstallations.installedAt)],
          with: {
            device: true,
          },
        },
        calibrations: {
          orderBy: [desc(sensorCalibrations.effectiveFrom)],
        },
      },
    });

    if (!sensor) {
      this.notFound("SENSOR_NOT_FOUND", `Sensor fisik dengan ID '${id}' tidak ditemukan`);
    }

    const activeInstallation =
      sensor.installations.find((inst) => inst.uninstalledAt === null) || null;

    return this.success({
      ...sensor,
      currentInstallation: activeInstallation
        ? {
            installationId: activeInstallation.id,
            deviceId: activeInstallation.deviceId,
            deviceName: activeInstallation.device.name,
            installedAt: activeInstallation.installedAt,
          }
        : null,
    });
  }

  async createSensor(dto: CreateSensorDto) {
    const existing = await db.query.sensors.findFirst({
      where: eq(sensors.serialNumber, dto.serialNumber),
    });

    if (existing) {
      this.conflict(
        "SENSOR_SERIAL_EXISTS",
        `Sensor dengan nomor seri '${dto.serialNumber}' sudah terdaftar`
      );
    }

    const typeExists = await db.query.sensorTypes.findFirst({
      where: eq(sensorTypes.id, dto.sensorTypeId),
    });

    if (!typeExists) {
      this.notFound(
        "SENSOR_TYPE_NOT_FOUND",
        `Tipe sensor '${dto.sensorTypeId}' tidak terdaftar di sistem`
      );
    }

    const [newSensor] = await db
      .insert(sensors)
      .values({
        serialNumber: dto.serialNumber,
        name: dto.name,
        sensorTypeId: dto.sensorTypeId,
        status: dto.status || "active",
      })
      .returning();

    if (!newSensor) {
      throw new Error("Gagal mendaftarkan sensor");
    }

    logger.info(`New physical sensor registered: ${newSensor.serialNumber} (${newSensor.id})`);
    return this.success(newSensor, "Sensor berhasil didaftarkan");
  }

  async updateSensor(id: string, dto: UpdateSensorDto) {
    const existing = await db.query.sensors.findFirst({
      where: eq(sensors.id, id),
    });

    if (!existing) {
      this.notFound("SENSOR_NOT_FOUND", `Sensor dengan ID '${id}' tidak ditemukan`);
    }

    if (dto.sensorTypeId) {
      const typeExists = await db.query.sensorTypes.findFirst({
        where: eq(sensorTypes.id, dto.sensorTypeId),
      });
      if (!typeExists) {
        this.notFound("SENSOR_TYPE_NOT_FOUND", `Tipe sensor '${dto.sensorTypeId}' tidak terdaftar`);
      }
    }

    const [updated] = await db
      .update(sensors)
      .set({
        name: dto.name ?? existing.name,
        sensorTypeId: dto.sensorTypeId ?? existing.sensorTypeId,
        status: dto.status ?? existing.status,
        updatedAt: new Date(),
      })
      .where(eq(sensors.id, id))
      .returning();

    return this.success(updated, "Sensor berhasil diperbarui");
  }

  async deleteSensor(id: string) {
    const existing = await db.query.sensors.findFirst({
      where: eq(sensors.id, id),
    });

    if (!existing) {
      this.notFound("SENSOR_NOT_FOUND", `Sensor dengan ID '${id}' tidak ditemukan`);
    }

    await db.transaction(async (tx) => {
      await tx
        .update(sensorInstallations)
        .set({ uninstalledAt: new Date() })
        .where(
          and(eq(sensorInstallations.sensorId, id), isNull(sensorInstallations.uninstalledAt))
        );

      await tx
        .update(sensors)
        .set({
          status: "decommissioned",
          updatedAt: new Date(),
        })
        .where(eq(sensors.id, id));
    });

    logger.info(`Sensor ${id} decommissioned and uninstalled`);
    return this.success({ id, message: "Sensor berhasil dinonaktifkan (decommissioned)" });
  }

  async attachSensor(deviceId: string, dto: AttachSensorDto) {
    const targetDevice = await db.query.devices.findFirst({
      where: and(eq(devices.id, deviceId), isNull(devices.deletedAt)),
    });

    if (!targetDevice) {
      this.notFound("DEVICE_NOT_FOUND", `Stasiun cuaca '${deviceId}' tidak ditemukan`);
    }

    const sensor = await db.query.sensors.findFirst({
      where: eq(sensors.id, dto.sensorId),
      with: { type: true },
    });

    if (!sensor) {
      this.notFound("SENSOR_NOT_FOUND", `Sensor dengan ID '${dto.sensorId}' tidak ditemukan`);
    }

    if (sensor.status === "decommissioned") {
      this.badRequest(
        "SENSOR_DECOMMISSIONED",
        `Sensor '${sensor.serialNumber}' sudah dinonaktifkan dan tidak dapat dipasang`
      );
    }

    const installedTime = dto.installedAt || new Date();

    const result = await db.transaction(async (tx) => {
      const activeInstallation = await tx.query.sensorInstallations.findFirst({
        where: and(
          eq(sensorInstallations.sensorId, dto.sensorId),
          isNull(sensorInstallations.uninstalledAt)
        ),
      });

      if (activeInstallation) {
        if (activeInstallation.deviceId === deviceId) {
          return activeInstallation;
        }

        await tx
          .update(sensorInstallations)
          .set({ uninstalledAt: installedTime })
          .where(eq(sensorInstallations.id, activeInstallation.id));

        logger.info(
          `Sensor ${sensor.serialNumber} detached from previous station ${activeInstallation.deviceId} at ${installedTime.toISOString()}`
        );
      }

      const [newInstallation] = await tx
        .insert(sensorInstallations)
        .values({
          deviceId,
          sensorId: dto.sensorId,
          installedAt: installedTime,
          uninstalledAt: null,
        })
        .returning();

      if (!newInstallation) {
        throw new Error("Gagal memasang sensor ke stasiun");
      }

      if (dto.calibration) {
        await tx.insert(sensorCalibrations).values({
          sensorId: dto.sensorId,
          scale: dto.calibration.scale ?? 1.0,
          offset: dto.calibration.offset ?? 0.0,
          effectiveFrom: installedTime,
          notes:
            dto.calibration.notes ||
            `Inisialisasi kalibrasi saat pemasangan di stasiun ${deviceId}`,
        });
      }

      return newInstallation;
    });

    if (!result) {
      throw new Error("Gagal memproses pemasangan sensor");
    }

    logger.info(`Sensor ${sensor.serialNumber} successfully installed on station ${deviceId}`);
    return this.success(
      {
        installationId: result.id,
        deviceId,
        sensorId: dto.sensorId,
        installedAt: result.installedAt,
        sensor: {
          serialNumber: sensor.serialNumber,
          name: sensor.name,
          type: sensor.type,
        },
      },
      `Sensor '${sensor.name}' berhasil dipasang ke stasiun '${deviceId}'`
    );
  }

  async detachSensor(deviceId: string, sensorId: string) {
    const activeInstallation = await db.query.sensorInstallations.findFirst({
      where: and(
        eq(sensorInstallations.deviceId, deviceId),
        eq(sensorInstallations.sensorId, sensorId),
        isNull(sensorInstallations.uninstalledAt)
      ),
      with: {
        sensor: true,
      },
    });

    if (!activeInstallation) {
      this.notFound(
        "INSTALLATION_NOT_FOUND",
        `Sensor '${sensorId}' tidak sedang terpasang aktif pada stasiun '${deviceId}'`
      );
    }

    const uninstalledAt = new Date();

    await db
      .update(sensorInstallations)
      .set({ uninstalledAt })
      .where(eq(sensorInstallations.id, activeInstallation.id));

    logger.info(
      `Sensor ${activeInstallation.sensor.serialNumber} detached from station ${deviceId}`
    );

    return this.success({
      installationId: activeInstallation.id,
      deviceId,
      sensorId,
      uninstalledAt,
      message: `Sensor '${activeInstallation.sensor.name}' berhasil dilepas dari stasiun '${deviceId}'`,
    });
  }

  async addCalibration(sensorId: string, dto: CreateCalibrationDto) {
    const sensor = await db.query.sensors.findFirst({
      where: eq(sensors.id, sensorId),
      with: { type: true },
    });

    if (!sensor) {
      this.notFound("SENSOR_NOT_FOUND", `Sensor dengan ID '${sensorId}' tidak ditemukan`);
    }

    const [newCalibration] = await db
      .insert(sensorCalibrations)
      .values({
        sensorId,
        scale: dto.scale ?? 1.0,
        offset: dto.offset ?? 0.0,
        effectiveFrom: dto.effectiveFrom,
        notes: dto.notes || null,
      })
      .returning();

    if (!newCalibration) {
      throw new Error("Gagal menambahkan formula kalibrasi");
    }

    logger.info(
      `New calibration added for sensor ${sensor.serialNumber}: scale=${newCalibration.scale}, offset=${newCalibration.offset}, effectiveFrom=${newCalibration.effectiveFrom.toISOString()}`
    );

    return this.success(newCalibration, "Formula kalibrasi berhasil ditambahkan");
  }

  async getCalibrations(sensorId: string) {
    const sensor = await db.query.sensors.findFirst({
      where: eq(sensors.id, sensorId),
    });

    if (!sensor) {
      this.notFound("SENSOR_NOT_FOUND", `Sensor dengan ID '${sensorId}' tidak ditemukan`);
    }

    const list = await db.query.sensorCalibrations.findMany({
      where: eq(sensorCalibrations.sensorId, sensorId),
      orderBy: [desc(sensorCalibrations.effectiveFrom)],
    });

    return this.success(list);
  }

  async getActiveCalibration(sensorId: string, timestamp: Date = new Date()) {
    const cal = await db.query.sensorCalibrations.findFirst({
      where: and(
        eq(sensorCalibrations.sensorId, sensorId),
        sql`${sensorCalibrations.effectiveFrom} <= ${timestamp}`
      ),
      orderBy: [desc(sensorCalibrations.effectiveFrom)],
    });

    return cal || { scale: 1.0, offset: 0.0, effectiveFrom: timestamp };
  }
}

export const sensorService = new SensorService();
