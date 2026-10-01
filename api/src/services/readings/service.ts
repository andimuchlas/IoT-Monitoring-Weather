import { eq, and, gte, lte, desc, asc, isNull, sql } from "drizzle-orm";
import { BaseService, AppError } from "../base.service";
import { db } from "../../db";
import { devices, sensorInstallations, sensorReadings, readingAggregates } from "../../db/schema";
import { isDeviceOffline } from "../devices/service";
import { getOrSet } from "../../lib/cache";
import type { TimeseriesQueryDto, SummaryQueryDto } from "./dto";

export class ReadingsService extends BaseService {
  async _fetchLatestDeviceReadings(deviceId: string) {
    const device = await db.query.devices.findFirst({
      where: and(eq(devices.id, deviceId), isNull(devices.deletedAt)),
      with: {
        location: true,
      },
    });

    if (!device) {
      throw new AppError(404, "DEVICE_NOT_FOUND", `Perangkat ${deviceId} tidak ditemukan`);
    }

    const installations = await db.query.sensorInstallations.findMany({
      where: and(
        eq(sensorInstallations.deviceId, deviceId),
        isNull(sensorInstallations.uninstalledAt)
      ),
      with: {
        sensor: {
          with: {
            type: true,
          },
        },
      },
    });

    const readingsList: Array<{
      sensorId: string;
      sensorTypeId: string;
      sensorName: string;
      unit: string;
      value: number | null;
      rawValue: number | null;
      qualityFlag: string | null;
      time: string | null;
    }> = [];

    for (const inst of installations) {
      const s = inst.sensor;
      if (!s || !s.type) continue;

      const latestRecord = await db.query.sensorReadings.findFirst({
        where: and(eq(sensorReadings.deviceId, deviceId), eq(sensorReadings.sensorId, s.id)),
        orderBy: [desc(sensorReadings.time)],
      });

      readingsList.push({
        sensorId: s.id,
        sensorTypeId: s.sensorTypeId,
        sensorName: s.name,
        unit: s.type.unit,
        value: latestRecord?.value ?? null,
        rawValue: latestRecord?.rawValue ?? null,
        qualityFlag: latestRecord?.qualityFlag ?? null,
        time: latestRecord?.time ? latestRecord.time.toISOString() : null,
      });
    }

    const offline = isDeviceOffline(device.lastSeenAt);

    const result = this.success({
      device: {
        id: device.id,
        name: device.name,
        status: device.status,
        isOffline: offline,
        lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
        batteryV: device.batteryV,
        rssi: device.rssi,
        location: device.location,
      },
      readings: readingsList,
    });

    return result;
  }

  async getLatestDeviceReadings(deviceId: string) {
    return getOrSet(`cache:latest:${deviceId}`, 30, () =>
      this._fetchLatestDeviceReadings(deviceId)
    );
  }

  async getTimeSeriesReadings(query: TimeseriesQueryDto) {
    const toDate = query.to ? new Date(query.to) : new Date();
    const fromDate = query.from
      ? new Date(query.from)
      : new Date(toDate.getTime() - 24 * 3600 * 1000);

    const targetDeviceId = query.deviceId || query.device_id;
    const targetSensorTypeId = query.sensorTypeId || query.sensor_type || query.sensor_type_id;

    const diffHours = (toDate.getTime() - fromDate.getTime()) / (3600 * 1000);

    let effectiveInterval = query.interval;
    if (effectiveInterval === "raw" || effectiveInterval === "1m") {
      if (diffHours > 30 * 24) {
        effectiveInterval = "1d";
      } else if (diffHours > 7 * 24) {
        effectiveInterval = "1h";
      }
    }

    if (effectiveInterval === "1h" || effectiveInterval === "1d") {
      const conditions = [
        gte(readingAggregates.bucket, fromDate),
        lte(readingAggregates.bucket, toDate),
        eq(readingAggregates.interval, effectiveInterval),
      ];

      if (targetDeviceId) {
        conditions.push(eq(readingAggregates.deviceId, targetDeviceId));
      }
      if (targetSensorTypeId) {
        conditions.push(eq(readingAggregates.sensorTypeId, targetSensorTypeId));
      }

      const rows = await db.query.readingAggregates.findMany({
        where: and(...conditions),
        orderBy: [asc(readingAggregates.bucket)],
        limit: query.limit,
      });

      return this.success({
        interval: effectiveInterval,
        forcedDownsampling: effectiveInterval !== query.interval,
        count: rows.length,
        data: rows.map((r) => {
          let selectedValue = r.avgValue;
          if (query.agg === "min") selectedValue = r.minValue;
          else if (query.agg === "max") selectedValue = r.maxValue;
          else if (query.agg === "sum") selectedValue = r.sumValue;

          return {
            time: r.bucket.toISOString(),
            deviceId: r.deviceId,
            sensorTypeId: r.sensorTypeId,
            value: selectedValue,
            avg: r.avgValue,
            min: r.minValue,
            max: r.maxValue,
            sum: r.sumValue,
            readingCount: r.readingCount,
          };
        }),
      });
    }

    const conditions = [gte(sensorReadings.time, fromDate), lte(sensorReadings.time, toDate)];

    if (targetDeviceId) {
      conditions.push(eq(sensorReadings.deviceId, targetDeviceId));
    }
    if (targetSensorTypeId) {
      conditions.push(eq(sensorReadings.sensorTypeId, targetSensorTypeId));
    }

    const offset = (query.page - 1) * query.limit;

    const rows = await db.query.sensorReadings.findMany({
      where: and(...conditions),
      orderBy: [asc(sensorReadings.time)],
      limit: query.limit,
      offset,
    });

    return this.success({
      interval: effectiveInterval,
      page: query.page,
      limit: query.limit,
      count: rows.length,
      data: rows.map((r) => ({
        id: r.id,
        time: r.time.toISOString(),
        deviceId: r.deviceId,
        sensorTypeId: r.sensorTypeId,
        value: r.value,
        rawValue: r.rawValue,
        qualityFlag: r.qualityFlag,
      })),
    });
  }

  async getSummary(query: SummaryQueryDto) {
    const toDate = query.to ? new Date(query.to) : new Date();
    const fromDate = query.from
      ? new Date(query.from)
      : new Date(toDate.getTime() - 24 * 3600 * 1000);

    const targetDeviceId = query.deviceId || query.device_id;
    const conditions = [gte(sensorReadings.time, fromDate), lte(sensorReadings.time, toDate)];

    if (targetDeviceId) {
      conditions.push(eq(sensorReadings.deviceId, targetDeviceId));
    }

    const readings = await db.query.sensorReadings.findMany({
      where: and(...conditions),
    });

    const byType: Record<string, number[]> = {};
    for (const r of readings) {
      if (r.qualityFlag === "sensor_error") continue;
      if (!byType[r.sensorTypeId]) {
        byType[r.sensorTypeId] = [];
      }
      byType[r.sensorTypeId]?.push(r.value);
    }

    const summarize = (arr?: number[]) => {
      if (!arr || arr.length === 0) return null;
      const min = Math.min(...arr);
      const max = Math.max(...arr);
      const sum = arr.reduce((acc, v) => acc + v, 0);
      const avg = Math.round((sum / arr.length) * 100) / 100;
      return { min, max, avg, count: arr.length };
    };

    const rainReadings = byType["rain_counter"] ?? [];
    const totalRainfallMm = Math.round(rainReadings.reduce((acc, v) => acc + v, 0) * 100) / 100;

    const windSpeedReadings = byType["wind_speed"] ?? [];
    const maxWindSpeed = windSpeedReadings.length > 0 ? Math.max(...windSpeedReadings) : null;

    return this.success({
      range: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      temperature: summarize(byType["temp_air"]),
      humidity: summarize(byType["humidity"]),
      pressure: summarize(byType["pressure"]),
      windSpeed: {
        summary: summarize(windSpeedReadings),
        max: maxWindSpeed,
      },
      rainfall: {
        totalMm: totalRainfallMm,
        readingsCount: rainReadings.length,
      },
    });
  }

  async _fetchDashboardOverview() {
    const allDevices = await db.query.devices.findMany({
      where: isNull(devices.deletedAt),
      with: {
        location: true,
      },
    });

    let onlineCount = 0;
    let offlineCount = 0;
    let maintenanceCount = 0;

    const stationCards = [];

    for (const d of allDevices) {
      if (d.status === "maintenance") {
        maintenanceCount++;
      } else {
        const isOffline = isDeviceOffline(d.lastSeenAt);
        if (isOffline) {
          offlineCount++;
        } else {
          onlineCount++;
        }
      }

      const latestTemp = await db.query.sensorReadings.findFirst({
        where: and(eq(sensorReadings.deviceId, d.id), eq(sensorReadings.sensorTypeId, "temp_air")),
        orderBy: [desc(sensorReadings.time)],
      });

      const latestHumidity = await db.query.sensorReadings.findFirst({
        where: and(eq(sensorReadings.deviceId, d.id), eq(sensorReadings.sensorTypeId, "humidity")),
        orderBy: [desc(sensorReadings.time)],
      });

      const latestWind = await db.query.sensorReadings.findFirst({
        where: and(
          eq(sensorReadings.deviceId, d.id),
          eq(sensorReadings.sensorTypeId, "wind_speed")
        ),
        orderBy: [desc(sensorReadings.time)],
      });

      stationCards.push({
        id: d.id,
        name: d.name,
        status: d.status,
        isOffline: isDeviceOffline(d.lastSeenAt),
        lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
        batteryV: d.batteryV,
        rssi: d.rssi,
        location: d.location?.name ?? null,
        metrics: {
          temperature: latestTemp?.value ?? null,
          humidity: latestHumidity?.value ?? null,
          windSpeed: latestWind?.value ?? null,
        },
      });
    }

    return this.success({
      summary: {
        totalStations: allDevices.length,
        onlineStations: onlineCount,
        offlineStations: offlineCount,
        maintenanceStations: maintenanceCount,
      },
      stations: stationCards,
    });
  }

  async getDashboardOverview() {
    return getOrSet("cache:dashboard:overview", 30, () => this._fetchDashboardOverview());
  }
}

export const readingsService = new ReadingsService();
