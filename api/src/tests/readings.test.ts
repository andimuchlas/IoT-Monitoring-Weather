import { describe, it, expect, mock } from "bun:test";

const mockRedis = {
  get: mock(async (_key: string) => null as string | null),
  setex: mock(async (_key: string, _ttl: number, _value: string) => "OK"),
  del: mock(async (_key: string) => 1),
  exists: mock(async (_key: string) => 0),
};

mock.module("@/configs/redis", () => ({ default: mockRedis }));
mock.module("@/lib/redis", () => ({ default: mockRedis }));

const { readingsService } = await import("../services/readings/service");
const { db } = await import("../db");

describe("Readings Service", () => {
  it("throws 404 if device is not found in getLatestDeviceReadings", async () => {
    const originalFindFirst = db.query.devices.findFirst;
    (db.query.devices as any).findFirst = async () => null;

    try {
      let error: any = null;
      try {
        await readingsService.getLatestDeviceReadings("non-existent-device");
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe("DEVICE_NOT_FOUND");
    } finally {
      (db.query.devices as any).findFirst = originalFindFirst;
    }
  });

  it("returns latest device readings for existing device and installed sensors", async () => {
    const originalFindFirstDevice = db.query.devices.findFirst;
    const originalFindManyInstallations = db.query.sensorInstallations.findMany;
    const originalFindFirstReading = db.query.sensorReadings.findFirst;

    (db.query.devices as any).findFirst = async () => ({
      id: "DEV-001",
      name: "Weather Station Alpha",
      status: "active",
      location: null,
      lastSeenAt: new Date(),
    });

    (db.query.sensorInstallations as any).findMany = async () => [
      {
        id: "inst-1",
        deviceId: "DEV-001",
        sensorId: "sensor-temp",
        sensor: {
          id: "sensor-temp",
          name: "Air Temperature Sensor",
          sensorTypeId: "temp_air",
          type: {
            id: "temp_air",
            name: "Air Temperature",
            unit: "°C",
          },
        },
      },
    ];

    (db.query.sensorReadings as any).findFirst = async () => ({
      id: "reading-1",
      deviceId: "DEV-001",
      sensorId: "sensor-temp",
      sensorTypeId: "temp_air",
      time: new Date("2026-10-01T12:00:00Z"),
      value: 27.5,
      rawValue: 27.5,
      qualityFlag: "good",
    });

    try {
      const res = await readingsService.getLatestDeviceReadings("DEV-001");
      expect(res.data.device.id).toBe("DEV-001");
      expect(res.data.readings.length).toBe(1);
      expect(res.data.readings[0]?.value).toBe(27.5);
      expect(res.data.readings[0]?.sensorTypeId).toBe("temp_air");
    } finally {
      (db.query.devices as any).findFirst = originalFindFirstDevice;
      (db.query.sensorInstallations as any).findMany = originalFindManyInstallations;
      (db.query.sensorReadings as any).findFirst = originalFindFirstReading;
    }
  });

  it("returns time series data with raw interval", async () => {
    const originalFindMany = db.query.sensorReadings.findMany;

    (db.query.sensorReadings as any).findMany = async () => [
      {
        id: "r-1",
        time: new Date("2026-10-01T12:00:00Z"),
        deviceId: "DEV-001",
        sensorTypeId: "temp_air",
        value: 28.0,
        rawValue: 28.0,
        qualityFlag: "good",
      },
    ];

    try {
      const res = await readingsService.getTimeSeriesReadings({
        deviceId: "DEV-001",
        interval: "raw",
        limit: 10,
        page: 1,
      });

      expect(res.data.interval).toBe("raw");
      expect(res.data.data.length).toBe(1);
      const firstItem = res.data.data[0] as any;
      expect(firstItem.value).toBe(28.0);
    } finally {
      (db.query.sensorReadings as any).findMany = originalFindMany;
    }
  });

  it("calculates 24-hour summary metrics correctly", async () => {
    const originalFindMany = db.query.sensorReadings.findMany;

    (db.query.sensorReadings as any).findMany = async () => [
      {
        sensorTypeId: "temp_air",
        value: 20.0,
      },
      {
        sensorTypeId: "temp_air",
        value: 30.0,
      },
      {
        sensorTypeId: "rain_counter",
        value: 5.5,
      },
      {
        sensorTypeId: "wind_speed",
        value: 12.0,
      },
    ];

    try {
      const res = await readingsService.getSummary({ deviceId: "DEV-001" });
      expect(res.data.temperature).toBeDefined();
      expect(res.data.temperature?.min).toBe(20.0);
      expect(res.data.temperature?.max).toBe(30.0);
      expect(res.data.temperature?.avg).toBe(25.0);
      expect(res.data.rainfall.totalMm).toBe(5.5);
      expect(res.data.windSpeed.max).toBe(12.0);
    } finally {
      (db.query.sensorReadings as any).findMany = originalFindMany;
    }
  });

  it("returns dashboard overview metrics", async () => {
    const originalFindManyDevices = db.query.devices.findMany;
    const originalFindManyInstallations = db.query.sensorInstallations.findMany;
    const originalFindFirstReading = db.query.sensorReadings.findFirst;

    (db.query.devices as any).findMany = async () => [
      {
        id: "DEV-001",
        name: "Station 1",
        status: "active",
        lastSeenAt: new Date(),
        location: null,
      },
    ];

    (db.query.sensorInstallations as any).findMany = async () => [];
    (db.query.sensorReadings as any).findFirst = async () => null;

    try {
      const res = await readingsService.getDashboardOverview();
      expect(res.data.summary.totalStations).toBe(1);
      expect(res.data.stations.length).toBe(1);
    } finally {
      (db.query.devices as any).findMany = originalFindManyDevices;
      (db.query.sensorInstallations as any).findMany = originalFindManyInstallations;
      (db.query.sensorReadings as any).findFirst = originalFindFirstReading;
    }
  });
});
