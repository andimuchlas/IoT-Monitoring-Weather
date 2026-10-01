import crypto from "node:crypto";
import { eq, and, isNull, or, gt, gte, lt, lte, ne, desc } from "drizzle-orm";
import { BaseService, AppError } from "../base.service";
import { db } from "../../db";
import {
  devices,
  sensorInstallations,
  sensorCalibrations,
  sensorReadings,
  readingAggregates,
} from "../../db/schema";
import {
  applyCalibration,
  evaluateQualityFlag,
  calculateRainfallMm,
  calculateVectorMeanWindDirection,
} from "../../lib/calibration";
import { idempotencyManager } from "../../lib/idempotency";
import { invalidate } from "../../lib/cache";
import type { SingleTelemetryDto, BatchTelemetryDto, HeartbeatDto } from "./dto";

export async function verifyDeviceApiKey(rawKey: string, storedHash: string): Promise<boolean> {
  if (storedHash.length === 64 && !storedHash.startsWith("$")) {
    const computed = crypto.createHash("sha256").update(rawKey).digest("hex");
    return computed === storedHash;
  }
  if (storedHash.startsWith("$")) {
    return await Bun.password.verify(rawKey, storedHash);
  }
  return rawKey === storedHash;
}

export class IngestService extends BaseService {
  async authenticateDevice(deviceId: string, apiKey?: string) {
    if (!apiKey) {
      throw new AppError(401, "UNAUTHORIZED", "Header X-API-Key wajib disertakan");
    }

    const device = await db.query.devices.findFirst({
      where: and(eq(devices.id, deviceId), isNull(devices.deletedAt)),
    });

    if (!device) {
      throw new AppError(404, "DEVICE_NOT_FOUND", `Perangkat ${deviceId} tidak terdaftar`);
    }

    if (device.status === "decommissioned") {
      throw new AppError(403, "DEVICE_DECOMMISSIONED", `Perangkat ${deviceId} telah dinonaktifkan`);
    }

    const isValid = await verifyDeviceApiKey(apiKey, device.apiKeyHash);
    if (!isValid) {
      throw new AppError(401, "UNAUTHORIZED", "API key perangkat tidak valid");
    }

    return device;
  }

  async ingestTelemetry(payload: SingleTelemetryDto, apiKey?: string) {
    const device = await this.authenticateDevice(payload.device_id, apiKey);

    const idempotencyKey = idempotencyManager.generateKey(
      payload.device_id,
      payload.ts,
      payload.seq ?? 0
    );

    if (await idempotencyManager.has(idempotencyKey)) {
      const cached = await idempotencyManager.get(idempotencyKey);
      if (cached) {
        return {
          status: cached.statusCode,
          response: cached.body,
        };
      }
    }

    const time = new Date(payload.ts * 1000);
    const serverTime = new Date();

    const activeInstallations = await db.query.sensorInstallations.findMany({
      where: and(
        eq(sensorInstallations.deviceId, device.id),
        lte(sensorInstallations.installedAt, time),
        or(isNull(sensorInstallations.uninstalledAt), gt(sensorInstallations.uninstalledAt, time))
      ),
      with: {
        sensor: {
          with: {
            type: true,
            calibrations: {
              where: lte(sensorCalibrations.effectiveFrom, time),
              orderBy: [desc(sensorCalibrations.effectiveFrom)],
              limit: 1,
            },
          },
        },
      },
    });

    const sensorMap = new Map<
      string,
      {
        sensorId: string;
        sensorTypeId: string;
        minVal: number;
        maxVal: number;
        calibration: { scale: number; offset: number } | null;
      }
    >();

    for (const inst of activeInstallations) {
      const s = inst.sensor;
      if (!s || !s.type) continue;
      const cal = s.calibrations[0];
      sensorMap.set(s.sensorTypeId, {
        sensorId: s.id,
        sensorTypeId: s.sensorTypeId,
        minVal: s.type.minVal,
        maxVal: s.type.maxVal,
        calibration: cal ? { scale: cal.scale, offset: cal.offset } : null,
      });
    }

    const readingsToInsert: (typeof sensorReadings.$inferInsert)[] = [];
    const qualityCounts = {
      good: 0,
      out_of_range: 0,
      sensor_error: 0,
      future_timestamp: 0,
      uncalibrated: 0,
      duplicate: 0,
    };

    let prevRainTips: number | null = null;
    const hasRainReading = payload.readings.some((r) => r.s === "rain_counter");
    if (hasRainReading) {
      const lastRainRecord = await db.query.sensorReadings.findFirst({
        where: and(
          eq(sensorReadings.deviceId, device.id),
          eq(sensorReadings.sensorTypeId, "rain_counter"),
          lt(sensorReadings.time, time)
        ),
        orderBy: [desc(sensorReadings.time)],
      });
      if (lastRainRecord) {
        prevRainTips = lastRainRecord.rawValue;
      }
    }

    for (const item of payload.readings) {
      const sensorInfo = sensorMap.get(item.s);
      if (!sensorInfo) continue;

      let calibratedVal = item.v;
      let flag = evaluateQualityFlag({
        rawValue: item.v,
        minVal: sensorInfo.minVal,
        maxVal: sensorInfo.maxVal,
        timestamp: time,
        serverTime,
        hasCalibration: !!sensorInfo.calibration,
      });

      if (item.s === "rain_counter") {
        const rainResult = calculateRainfallMm(item.v, prevRainTips);
        calibratedVal = rainResult.rainfallMm;
      } else if (flag !== "sensor_error") {
        if (item.s === "wind_dir") {
          const offset = sensorInfo.calibration?.offset ?? 0;
          calibratedVal = (item.v + offset + 360) % 360;
        } else {
          calibratedVal = applyCalibration(item.v, sensorInfo.calibration);
        }
      }

      if (flag in qualityCounts) {
        qualityCounts[flag as keyof typeof qualityCounts]++;
      }

      readingsToInsert.push({
        time,
        deviceId: device.id,
        sensorId: sensorInfo.sensorId,
        sensorTypeId: sensorInfo.sensorTypeId,
        rawValue: item.v,
        value: calibratedVal,
        qualityFlag: flag,
        serverTime,
        seq: payload.seq ?? null,
      });
    }

    if (readingsToInsert.length > 0) {
      await db
        .insert(sensorReadings)
        .values(readingsToInsert)
        .onConflictDoNothing({
          target: [sensorReadings.deviceId, sensorReadings.sensorId, sensorReadings.time],
        });
    }

    await db
      .update(devices)
      .set({
        lastSeenAt: serverTime,
        batteryV: payload.battery_v ?? device.batteryV,
        rssi: payload.rssi ?? device.rssi,
        firmwareVersion: payload.fw ?? device.firmwareVersion,
        status: device.status === "provisioned" ? "active" : device.status,
        updatedAt: serverTime,
      })
      .where(eq(devices.id, device.id));

    const responseData = {
      success: true,
      code: "INGEST_SUCCESS",
      message: "Telemetry reading ingested successfully",
      data: {
        deviceId: device.id,
        time: time.toISOString(),
        processedCount: readingsToInsert.length,
        qualityFlags: qualityCounts,
      },
    };

    await idempotencyManager.set(idempotencyKey, 201, responseData);
    await invalidate(`cache:latest:${device.id}`);

    return {
      status: 201,
      response: responseData,
    };
  }

  async ingestBatch(payload: BatchTelemetryDto, apiKey?: string) {
    const device = await this.authenticateDevice(payload.device_id, apiKey);
    const serverTime = new Date();

    const results: Array<{
      seq?: number;
      ts: number;
      status: "accepted" | "duplicate" | "failed";
      message?: string;
      readingsCount?: number;
    }> = [];

    let acceptedCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;

    let latestTime: Date = new Date(0);

    const activeInstallations = await db.query.sensorInstallations.findMany({
      where: and(
        eq(sensorInstallations.deviceId, device.id),
        or(
          isNull(sensorInstallations.uninstalledAt),
          gt(sensorInstallations.uninstalledAt, new Date())
        )
      ),
      with: {
        sensor: {
          with: {
            type: true,
            calibrations: {
              orderBy: [desc(sensorCalibrations.effectiveFrom)],
              limit: 1,
            },
          },
        },
      },
    });

    const sensorMap = new Map<
      string,
      {
        sensorId: string;
        sensorTypeId: string;
        minVal: number;
        maxVal: number;
        calibration: { scale: number; offset: number } | null;
      }
    >();

    for (const inst of activeInstallations) {
      const s = inst.sensor;
      if (!s || !s.type) continue;
      const cal = s.calibrations[0];
      sensorMap.set(s.sensorTypeId, {
        sensorId: s.id,
        sensorTypeId: s.sensorTypeId,
        minVal: s.type.minVal,
        maxVal: s.type.maxVal,
        calibration: cal ? { scale: cal.scale, offset: cal.offset } : null,
      });
    }

    for (const item of payload.batch) {
      const itemTime = new Date(item.ts * 1000);
      if (itemTime > latestTime) {
        latestTime = itemTime;
      }

      const idempotencyKey = idempotencyManager.generateKey(
        payload.device_id,
        item.ts,
        item.seq ?? 0
      );

      if (await idempotencyManager.has(idempotencyKey)) {
        duplicateCount++;
        results.push({
          seq: item.seq,
          ts: item.ts,
          status: "duplicate",
          message: "Duplicate payload detected in cache window",
        });
        continue;
      }

      const readingsToInsert: (typeof sensorReadings.$inferInsert)[] = [];

      let prevRainTips: number | null = null;
      if (item.readings.some((r) => r.s === "rain_counter")) {
        const lastRainRecord = await db.query.sensorReadings.findFirst({
          where: and(
            eq(sensorReadings.deviceId, device.id),
            eq(sensorReadings.sensorTypeId, "rain_counter"),
            lt(sensorReadings.time, itemTime)
          ),
          orderBy: [desc(sensorReadings.time)],
        });
        if (lastRainRecord) {
          prevRainTips = lastRainRecord.rawValue;
        }
      }

      for (const reading of item.readings) {
        const sensorInfo = sensorMap.get(reading.s);
        if (!sensorInfo) continue;

        let calibratedVal = reading.v;
        const flag = evaluateQualityFlag({
          rawValue: reading.v,
          minVal: sensorInfo.minVal,
          maxVal: sensorInfo.maxVal,
          timestamp: itemTime,
          serverTime,
          hasCalibration: !!sensorInfo.calibration,
        });

        if (reading.s === "rain_counter") {
          const rain = calculateRainfallMm(reading.v, prevRainTips);
          calibratedVal = rain.rainfallMm;
        } else if (flag !== "sensor_error") {
          if (reading.s === "wind_dir") {
            const offset = sensorInfo.calibration?.offset ?? 0;
            calibratedVal = (reading.v + offset + 360) % 360;
          } else {
            calibratedVal = applyCalibration(reading.v, sensorInfo.calibration);
          }
        }

        readingsToInsert.push({
          time: itemTime,
          deviceId: device.id,
          sensorId: sensorInfo.sensorId,
          sensorTypeId: sensorInfo.sensorTypeId,
          rawValue: reading.v,
          value: calibratedVal,
          qualityFlag: flag,
          serverTime,
          seq: item.seq ?? null,
        });
      }

      if (readingsToInsert.length > 0) {
        const inserted = await db
          .insert(sensorReadings)
          .values(readingsToInsert)
          .onConflictDoNothing({
            target: [sensorReadings.deviceId, sensorReadings.sensorId, sensorReadings.time],
          })
          .returning();

        if (inserted.length === 0) {
          duplicateCount++;
          results.push({
            seq: item.seq,
            ts: item.ts,
            status: "duplicate",
            message: "Payload duplicate on unique constraint",
          });
          continue;
        }

        await idempotencyManager.set(idempotencyKey, 201, { accepted: true });
        await invalidate(`cache:latest:${device.id}`);
        acceptedCount++;
        results.push({
          seq: item.seq,
          ts: item.ts,
          status: "accepted",
          readingsCount: readingsToInsert.length,
        });
      } else {
        failedCount++;
        results.push({
          seq: item.seq,
          ts: item.ts,
          status: "failed",
          message: "No installed sensors matched for readings",
        });
      }
    }

    if (latestTime.getTime() > 0) {
      await db
        .update(devices)
        .set({
          lastSeenAt: serverTime,
          firmwareVersion: payload.fw ?? device.firmwareVersion,
          status: device.status === "provisioned" ? "active" : device.status,
          updatedAt: serverTime,
        })
        .where(eq(devices.id, device.id));
    }

    let statusCode = 201;
    if (acceptedCount > 0 && duplicateCount > 0) {
      statusCode = 207;
    } else if (acceptedCount === 0 && duplicateCount > 0) {
      statusCode = 200;
    } else if (acceptedCount === 0 && failedCount > 0) {
      statusCode = 400;
    }

    const response = {
      success: acceptedCount > 0,
      code:
        statusCode === 207
          ? "INGEST_BATCH_MULTI_STATUS"
          : statusCode === 201
            ? "INGEST_BATCH_COMPLETED"
            : "INGEST_BATCH_DUPLICATES",
      message: `Batch telemetry processed: ${acceptedCount} accepted, ${duplicateCount} duplicate`,
      data: {
        deviceId: device.id,
        total: payload.batch.length,
        accepted: acceptedCount,
        duplicate: duplicateCount,
        failed: failedCount,
        results,
      },
    };

    return {
      status: statusCode,
      response,
    };
  }

  async ingestHeartbeat(payload: HeartbeatDto, apiKey?: string) {
    const device = await this.authenticateDevice(payload.device_id, apiKey);
    const serverTime = new Date();

    await db
      .update(devices)
      .set({
        lastSeenAt: serverTime,
        batteryV: payload.battery_v ?? device.batteryV,
        rssi: payload.rssi ?? device.rssi,
        firmwareVersion: payload.fw ?? device.firmwareVersion,
        status: device.status === "provisioned" ? "active" : device.status,
        updatedAt: serverTime,
      })
      .where(eq(devices.id, device.id));

    return {
      status: 200,
      response: {
        success: true,
        code: "HEARTBEAT_RECORDED",
        message: "Heartbeat recorded successfully",
        data: {
          deviceId: device.id,
          lastSeenAt: serverTime.toISOString(),
          batteryV: payload.battery_v ?? device.batteryV,
          rssi: payload.rssi ?? device.rssi,
          uptimeSeconds: payload.uptime_s ?? null,
        },
      },
    };
  }

  async rollupHourlyAggregate(
    deviceId: string,
    sensorId: string,
    sensorTypeId: string,
    bucket: Date
  ) {
    const nextBucket = new Date(bucket.getTime() + 3600 * 1000);

    const bucketReadings = await db.query.sensorReadings.findMany({
      where: and(
        eq(sensorReadings.deviceId, deviceId),
        eq(sensorReadings.sensorId, sensorId),
        gte(sensorReadings.time, bucket),
        lt(sensorReadings.time, nextBucket),
        ne(sensorReadings.qualityFlag, "sensor_error")
      ),
    });

    if (bucketReadings.length === 0) return;

    const count = bucketReadings.length;
    const values = bucketReadings.map((r) => r.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const sumVal = values.reduce((acc, v) => acc + v, 0);

    let avgVal = sumVal / count;
    if (sensorTypeId === "wind_dir") {
      avgVal = calculateVectorMeanWindDirection(values);
    }

    await db
      .insert(readingAggregates)
      .values({
        deviceId,
        sensorId,
        sensorTypeId,
        bucket,
        interval: "1h",
        avgValue: Math.round(avgVal * 100) / 100,
        minValue: Math.round(minVal * 100) / 100,
        maxValue: Math.round(maxVal * 100) / 100,
        sumValue: Math.round(sumVal * 100) / 100,
        readingCount: count,
      })
      .onConflictDoUpdate({
        target: [
          readingAggregates.deviceId,
          readingAggregates.sensorId,
          readingAggregates.bucket,
          readingAggregates.interval,
        ],
        set: {
          avgValue: Math.round(avgVal * 100) / 100,
          minValue: Math.round(minVal * 100) / 100,
          maxValue: Math.round(maxVal * 100) / 100,
          sumValue: Math.round(sumVal * 100) / 100,
          readingCount: count,
        },
      });
  }
}

export const ingestService = new IngestService();
