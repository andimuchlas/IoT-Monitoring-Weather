import { describe, it, expect } from "bun:test";
import {
  applyCalibration,
  evaluateQualityFlag,
  calculateRainfallMm,
  calculateVectorMeanWindDirection,
} from "../lib/calibration";
import { IdempotencyManager, deduplicateReadings } from "../lib/idempotency";
import {
  createSensorTypeSchema,
  createSensorSchema,
  createCalibrationSchema,
} from "../services/sensors/dto";

describe("Calibration Utilities", () => {
  it("applyCalibration should correctly compute linear transformation y = m*x + c", () => {
    const calibrated = applyCalibration(20.0, { scale: 1.05, offset: -0.5 });
    expect(calibrated).toBe(20.5);

    const tempCal = applyCalibration(25.4, { scale: 1.0, offset: -0.2 });
    expect(tempCal).toBe(25.2);

    expect(applyCalibration(1008.3, null)).toBe(1008.3);
    expect(applyCalibration(1008.3, undefined)).toBe(1008.3);
    expect(applyCalibration(1008.3, {})).toBe(1008.3);

    expect(applyCalibration(-999, { scale: 1.5, offset: 10 })).toBe(-999);
  });

  it("evaluateQualityFlag should correctly identify sensor errors, range violations, and clock drift", () => {
    const tempSensorType = { minVal: -40.0, maxVal: 85.0 };
    const humiditySensorType = { minVal: 0.0, maxVal: 100.0 };
    const now = new Date();

    expect(
      evaluateQualityFlag({
        rawValue: 27.5,
        minVal: tempSensorType.minVal,
        maxVal: tempSensorType.maxVal,
        timestamp: now,
        serverTime: now,
      })
    ).toBe("good");

    expect(
      evaluateQualityFlag({
        rawValue: -999,
        minVal: tempSensorType.minVal,
        maxVal: tempSensorType.maxVal,
        timestamp: now,
        serverTime: now,
      })
    ).toBe("sensor_error");

    expect(
      evaluateQualityFlag({
        rawValue: 150,
        minVal: humiditySensorType.minVal,
        maxVal: humiditySensorType.maxVal,
        timestamp: now,
        serverTime: now,
      })
    ).toBe("out_of_range");

    expect(
      evaluateQualityFlag({
        rawValue: -45,
        minVal: tempSensorType.minVal,
        maxVal: tempSensorType.maxVal,
        timestamp: now,
        serverTime: now,
      })
    ).toBe("out_of_range");

    const futureTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    expect(
      evaluateQualityFlag({
        rawValue: 28.0,
        minVal: tempSensorType.minVal,
        maxVal: tempSensorType.maxVal,
        timestamp: futureTime,
        serverTime: now,
      })
    ).toBe("future_timestamp");
  });

  it("calculateRainfallMm should handle normal tipping increments and device restart counter resets", () => {
    const normal = calculateRainfallMm(1053, 1043);
    expect(normal.isReset).toBe(false);
    expect(normal.deltaTips).toBe(10);
    expect(normal.rainfallMm).toBe(2.0);

    const reboot = calculateRainfallMm(5, 1043);
    expect(reboot.isReset).toBe(true);
    expect(reboot.deltaTips).toBe(5);
    expect(reboot.rainfallMm).toBe(1.0);

    const firstReading = calculateRainfallMm(500, null);
    expect(firstReading.isReset).toBe(false);
    expect(firstReading.rainfallMm).toBe(0.0);

    const noRain = calculateRainfallMm(1043, 1043);
    expect(noRain.isReset).toBe(false);
    expect(noRain.deltaTips).toBe(0);
    expect(noRain.rainfallMm).toBe(0.0);
  });

  it("calculateVectorMeanWindDirection should compute circular mean instead of arithmetic average", () => {
    const meanNorth = calculateVectorMeanWindDirection([350, 10]);
    expect([0, 360].includes(meanNorth)).toBe(true);

    const meanSE = calculateVectorMeanWindDirection([90, 180]);
    expect(meanSE).toBe(135);
  });
});

describe("Idempotency & Deduplication", () => {
  it("IdempotencyManager should cache responses and detect duplicate retries", () => {
    const manager = new IdempotencyManager(5, 100);
    const key = manager.generateKey("WS-GRT-001", 1757308800, 10432);

    expect(manager.has(key)).toBe(false);

    manager.set(key, 201, { success: true, message: "Telemetry accepted" });

    expect(manager.has(key)).toBe(true);
    const cached = manager.get(key);
    expect(cached?.statusCode).toBe(201);
    expect(cached?.body.success).toBe(true);
  });

  it("deduplicateReadings should filter duplicate readings in batch arrays", () => {
    const t1 = new Date("2026-10-01T08:00:00Z");
    const t2 = new Date("2026-10-01T08:01:00Z");

    const batch = [
      { deviceId: "WS-01", sensorId: "sn-1", time: t1, value: 25.0 },
      { deviceId: "WS-01", sensorId: "sn-2", time: t1, value: 80.0 },
      { deviceId: "WS-01", sensorId: "sn-1", time: t1, value: 25.0 },
      { deviceId: "WS-01", sensorId: "sn-1", time: t2, value: 25.5 },
    ];

    const { unique, duplicateCount } = deduplicateReadings(batch);
    expect(duplicateCount).toBe(1);
    expect(unique.length).toBe(3);
  });
});

describe("Sensor DTO Validation & Schemas", () => {
  it("createSensorTypeSchema validates minVal < maxVal constraint", () => {
    const valid = {
      id: "temp_water",
      name: "Suhu Air Kolam",
      unit: "°C",
      minVal: 0,
      maxVal: 50,
      precision: 1,
    };
    expect(createSensorTypeSchema.safeParse(valid).success).toBe(true);

    const invalid = {
      ...valid,
      minVal: 60,
      maxVal: 50,
    };
    const parse = createSensorTypeSchema.safeParse(invalid);
    expect(parse.success).toBe(false);
  });

  it("createSensorSchema rejects invalid serial numbers", () => {
    const valid = {
      serialNumber: "SNS-TEST-001",
      name: "Sensor Uji",
      sensorTypeId: "temp_air",
    };
    expect(createSensorSchema.safeParse(valid).success).toBe(true);

    const invalid = {
      serialNumber: "SNS TEST WITH SPACES",
      name: "Sensor Uji",
      sensorTypeId: "temp_air",
    };
    expect(createSensorSchema.safeParse(invalid).success).toBe(false);
  });

  it("createCalibrationSchema accepts valid calibration factors", () => {
    const cal = {
      scale: 1.02,
      offset: -0.15,
      notes: "Kalibrasi laboratorium kalibrasi LK-01",
    };
    const parse = createCalibrationSchema.safeParse(cal);
    expect(parse.success).toBe(true);
    if (parse.success) {
      expect(parse.data.scale).toBe(1.02);
      expect(parse.data.offset).toBe(-0.15);
    }
  });
});

describe("Sensor Endpoints RBAC & Validation", async () => {
  const { default: app } = await import("../app");
  const { sign } = await import("hono/jwt");
  const { JWT_SECRET } = await import("../services/auth/service");

  const viewerToken = await sign(
    {
      id: "viewer-uuid",
      name: "Viewer",
      email: "viewer@luwes.co.id",
      role: "viewer",
      exp: 9999999999,
    },
    JWT_SECRET,
    "HS256"
  );

  const adminToken = await sign(
    {
      id: "admin-uuid",
      name: "Admin",
      email: "admin@luwes.co.id",
      role: "admin",
      exp: 9999999999,
    },
    JWT_SECRET,
    "HS256"
  );

  it("GET /api/v1/sensor-types rejects unauthenticated requests with 401", async () => {
    const res = await app.request("/api/v1/sensor-types");
    expect(res.status).toBe(401);
  });

  it("POST /api/v1/sensor-types rejects non-admin users with 403 Forbidden", async () => {
    const res = await app.request("/api/v1/sensor-types", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${viewerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: "lux_sensor",
        name: "Lux Sensor",
        unit: "lx",
        minVal: 0,
        maxVal: 100000,
      }),
    });

    expect(res.status).toBe(403);
  });

  it("POST /api/v1/sensors rejects non-admin users with 403 Forbidden", async () => {
    const res = await app.request("/api/v1/sensors", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${viewerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        serialNumber: "SNS-TEST-403",
        name: "Sensor",
        sensorTypeId: "temp_air",
      }),
    });

    expect(res.status).toBe(403);
  });

  it("POST /api/v1/devices/WS-GRT-001/sensors rejects invalid UUID payload with 422", async () => {
    const res = await app.request("/api/v1/devices/WS-GRT-001/sensors", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sensorId: "not-a-valid-uuid",
      }),
    });

    expect(res.status).toBe(422);
  });
});
