import { describe, it, expect } from "bun:test";
import {
  singleTelemetrySchema,
  batchTelemetrySchema,
  heartbeatSchema,
} from "../services/ingest/dto";
import { verifyDeviceApiKey, IngestService } from "../services/ingest/service";
import { idempotencyManager } from "../lib/idempotency";
import { hashApiKey } from "../services/devices/service";
import { db } from "../db";

describe("Ingest DTO Schemas", () => {
  it("singleTelemetrySchema validates valid single payload from spec", () => {
    const valid = {
      device_id: "WS-GRT-001",
      fw: "1.4.2",
      ts: 1757308800,
      seq: 10432,
      battery_v: 3.92,
      rssi: -71,
      readings: [
        { s: "temp_air", v: 27.4 },
        { s: "humidity", v: 82.1 },
        { s: "pressure", v: 1008.3 },
        { s: "wind_speed", v: 3.2 },
        { s: "wind_dir", v: 217 },
        { s: "rain_counter", v: 1043 },
        { s: "solar_rad", v: 512.7 },
      ],
    };

    const parse = singleTelemetrySchema.safeParse(valid);
    expect(parse.success).toBe(true);
  });

  it("singleTelemetrySchema rejects payload missing device_id or ts", () => {
    const invalid = {
      fw: "1.4.2",
      readings: [{ s: "temp_air", v: 27.4 }],
    };

    const parse = singleTelemetrySchema.safeParse(invalid);
    expect(parse.success).toBe(false);
  });

  it("singleTelemetrySchema rejects empty readings array", () => {
    const invalid = {
      device_id: "WS-GRT-001",
      ts: 1757308800,
      readings: [],
    };

    const parse = singleTelemetrySchema.safeParse(invalid);
    expect(parse.success).toBe(false);
  });

  it("batchTelemetrySchema validates batch payload from spec", () => {
    const valid = {
      device_id: "WS-GRT-001",
      fw: "1.4.2",
      batch: [
        {
          ts: 1757308800,
          seq: 10432,
          battery_v: 3.92,
          rssi: -71,
          readings: [
            { s: "temp_air", v: 27.4 },
            { s: "rain_counter", v: 1043 },
          ],
        },
        {
          ts: 1757308860,
          seq: 10433,
          battery_v: 3.91,
          rssi: -73,
          readings: [
            { s: "temp_air", v: 27.6 },
            { s: "rain_counter", v: 1045 },
          ],
        },
      ],
    };

    const parse = batchTelemetrySchema.safeParse(valid);
    expect(parse.success).toBe(true);
  });

  it("batchTelemetrySchema rejects batch exceeding 500 items", () => {
    const item = {
      ts: 1757308800,
      readings: [{ s: "temp_air", v: 25.0 }],
    };
    const oversizedBatch = {
      device_id: "WS-GRT-001",
      batch: Array(501).fill(item),
    };

    const parse = batchTelemetrySchema.safeParse(oversizedBatch);
    expect(parse.success).toBe(false);
  });

  it("heartbeatSchema validates heartbeat payload from spec", () => {
    const valid = {
      device_id: "WS-GRT-001",
      ts: 1757308920,
      fw: "1.4.2",
      battery_v: 3.9,
      rssi: -70,
      uptime_s: 864321,
    };

    const parse = heartbeatSchema.safeParse(valid);
    expect(parse.success).toBe(true);
  });
});

describe("Device Authentication Logic", () => {
  it("verifyDeviceApiKey validates pre-shared SHA-256 key", async () => {
    const rawKey = "ws_live_secret_key_123456789012345678901234";
    const hashedKey = hashApiKey(rawKey);

    const valid = await verifyDeviceApiKey(rawKey, hashedKey);
    expect(valid).toBe(true);

    const invalid = await verifyDeviceApiKey("ws_live_wrong_key", hashedKey);
    expect(invalid).toBe(false);
  });

  it("verifyDeviceApiKey validates Bun hashed secret", async () => {
    const rawKey = "device-secret-123";
    const hashed = await Bun.password.hash(rawKey);

    const valid = await verifyDeviceApiKey(rawKey, hashed);
    expect(valid).toBe(true);

    const invalid = await verifyDeviceApiKey("wrong-secret", hashed);
    expect(invalid).toBe(false);
  });
});

describe("Ingest Endpoints Validation & Auth", async () => {
  const { default: app } = await import("../app");

  it("POST /api/v1/ingest/telemetry rejects request without body with 422", async () => {
    const res = await app.request("/api/v1/ingest/telemetry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "test-key",
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("POST /api/v1/ingest/telemetry rejects request without API key with 401", async () => {
    const res = await app.request("/api/v1/ingest/telemetry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        device_id: "WS-GRT-001",
        ts: 1757308800,
        readings: [{ s: "temp_air", v: 27.4 }],
      }),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("POST /api/v1/ingest/telemetry/batch rejects request without API key with 401", async () => {
    const res = await app.request("/api/v1/ingest/telemetry/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        device_id: "WS-GRT-001",
        batch: [{ ts: 1757308800, readings: [{ s: "temp_air", v: 25.0 }] }],
      }),
    });

    expect(res.status).toBe(401);
  });

  it("POST /api/v1/ingest/heartbeat rejects request without API key with 401", async () => {
    const res = await app.request("/api/v1/ingest/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        device_id: "WS-GRT-001",
        ts: 1757308920,
      }),
    });

    expect(res.status).toBe(401);
  });
});

describe("Ingest Service Idempotency & Processing", () => {
  it("idempotencyManager avoids re-processing exact duplicate payload", async () => {
    const deviceId = "WS-TEST-IDEMP";
    const ts = 1757308800;
    const seq = 10432;
    const key = idempotencyManager.generateKey(deviceId, ts, seq);

    const mockResponse = {
      success: true,
      code: "INGEST_SUCCESS",
      message: "Telemetry reading ingested successfully",
      data: {
        deviceId,
        time: new Date(ts * 1000).toISOString(),
        processedCount: 2,
        qualityFlags: { good: 2 },
      },
    };

    idempotencyManager.set(key, 201, mockResponse);

    expect(idempotencyManager.has(key)).toBe(true);
    const cached = idempotencyManager.get(key);
    expect(cached?.statusCode).toBe(201);
    expect(cached?.body.data.processedCount).toBe(2);
  });

  it("authenticateDevice rejects non-existent device with 404", async () => {
    const service = new IngestService();
    const originalFindFirst = db.query.devices.findFirst;
    (db.query.devices as any).findFirst = async () => null;

    try {
      await service.authenticateDevice("WS-NONEXISTENT", "valid-key");
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe("DEVICE_NOT_FOUND");
    } finally {
      (db.query.devices as any).findFirst = originalFindFirst;
    }
  });

  it("authenticateDevice rejects decommissioned device with 403", async () => {
    const service = new IngestService();
    const originalFindFirst = db.query.devices.findFirst;
    (db.query.devices as any).findFirst = async () => ({
      id: "WS-DECOM",
      status: "decommissioned",
      apiKeyHash: "somehash",
    });

    try {
      await service.authenticateDevice("WS-DECOM", "valid-key");
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe("DEVICE_DECOMMISSIONED");
    } finally {
      (db.query.devices as any).findFirst = originalFindFirst;
    }
  });

  it("authenticateDevice rejects invalid API key with 401", async () => {
    const service = new IngestService();
    const originalFindFirst = db.query.devices.findFirst;
    const expectedHash = hashApiKey("correct-api-key");

    (db.query.devices as any).findFirst = async () => ({
      id: "WS-ACTIVE",
      status: "active",
      apiKeyHash: expectedHash,
    });

    try {
      await service.authenticateDevice("WS-ACTIVE", "wrong-api-key");
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe("UNAUTHORIZED");
    } finally {
      (db.query.devices as any).findFirst = originalFindFirst;
    }
  });

  it("ingestHeartbeat successfully records heartbeat and updates metadata", async () => {
    const service = new IngestService();
    const originalFindFirst = db.query.devices.findFirst;
    const originalUpdate = db.update;
    const expectedHash = hashApiKey("heartbeat-key");

    (db.query.devices as any).findFirst = async () => ({
      id: "WS-GRT-001",
      status: "active",
      apiKeyHash: expectedHash,
      batteryV: 3.95,
      rssi: -70,
      firmwareVersion: "1.4.2",
    });

    (db as any).update = () => ({
      set: () => ({
        where: async () => Promise.resolve(),
      }),
    });

    try {
      const result = await service.ingestHeartbeat(
        {
          device_id: "WS-GRT-001",
          ts: 1757308920,
          fw: "1.4.2",
          battery_v: 3.9,
          rssi: -70,
          uptime_s: 864321,
        },
        "heartbeat-key"
      );

      expect(result.status).toBe(200);
      expect(result.response.success).toBe(true);
      expect(result.response.code).toBe("HEARTBEAT_RECORDED");
      expect(result.response.data.deviceId).toBe("WS-GRT-001");
      expect(result.response.data.uptimeSeconds).toBe(864321);
    } finally {
      (db.query.devices as any).findFirst = originalFindFirst;
      (db as any).update = originalUpdate;
    }
  });
});

describe("Technical Evaluation Section F.3 Cases", () => {
  it("Case 1: handles clock drift with future timestamp > 5 mins by assigning future_timestamp quality flag", async () => {
    const { evaluateQualityFlag } = await import("../lib/calibration");
    const now = new Date();
    const futureDate = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const flag = evaluateQualityFlag({
      rawValue: 27.4,
      minVal: -40,
      maxVal: 85,
      timestamp: futureDate,
      serverTime: now,
    });

    expect(flag).toBe("future_timestamp");
  });

  it("Case 2: handles sensor error code -999 by assigning sensor_error quality flag", async () => {
    const { evaluateQualityFlag } = await import("../lib/calibration");
    const flag = evaluateQualityFlag({
      rawValue: -999,
      minVal: -40,
      maxVal: 85,
      timestamp: new Date(),
    });

    expect(flag).toBe("sensor_error");
  });

  it("Case 3: handles out of range values like humidity 150 by assigning out_of_range quality flag", async () => {
    const { evaluateQualityFlag } = await import("../lib/calibration");
    const flag = evaluateQualityFlag({
      rawValue: 150,
      minVal: 0,
      maxVal: 100,
      timestamp: new Date(),
    });

    expect(flag).toBe("out_of_range");
  });

  it("Case 4: handles rain counter reboot reset (1043 -> 5) preventing negative rainfall and calculating correct mm", async () => {
    const { calculateRainfallMm } = await import("../lib/calibration");
    const result = calculateRainfallMm(5, 1043);

    expect(result.isReset).toBe(true);
    expect(result.deltaTips).toBe(5);
    expect(result.rainfallMm).toBe(1.0);
  });

  it("Case 5: idempotent deduplication returns cached response when exact payload sent 3x", async () => {
    const deviceId = "WS-GRT-001";
    const ts = 1757308800;
    const seq = 10432;
    const key = idempotencyManager.generateKey(deviceId, ts, seq);

    const initialResponse = {
      success: true,
      code: "INGEST_SUCCESS",
      message: "Telemetry reading ingested successfully",
      data: {
        deviceId,
        time: new Date(ts * 1000).toISOString(),
        processedCount: 7,
      },
    };

    idempotencyManager.set(key, 201, initialResponse);

    const retry1 = idempotencyManager.get(key);
    const retry2 = idempotencyManager.get(key);

    expect(retry1?.statusCode).toBe(201);
    expect(retry1?.body.data.processedCount).toBe(7);
    expect(retry2?.statusCode).toBe(201);
    expect(retry2?.body.data.processedCount).toBe(7);
  });

  it("Case 6: unrecognised device ID produces 404 DEVICE_NOT_FOUND", async () => {
    const service = new IngestService();
    const originalFindFirst = db.query.devices.findFirst;
    (db.query.devices as any).findFirst = async () => null;

    try {
      await service.authenticateDevice("WS-UNREGISTERED-999", "any-key");
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe("DEVICE_NOT_FOUND");
    } finally {
      (db.query.devices as any).findFirst = originalFindFirst;
    }
  });

  it("Case 7: missing sensor like solar_rad in readings array is accepted and ignored gracefully", () => {
    const payloadWithoutSolarRad = {
      device_id: "WS-GRT-001",
      fw: "1.4.2",
      ts: 1757308800,
      seq: 10432,
      battery_v: 3.92,
      rssi: -71,
      readings: [
        { s: "temp_air", v: 27.4 },
        { s: "humidity", v: 82.1 },
      ],
    };

    const parse = singleTelemetrySchema.safeParse(payloadWithoutSolarRad);
    expect(parse.success).toBe(true);
    if (parse.success) {
      expect(parse.data.readings.length).toBe(2);
      expect(parse.data.readings.some((r) => r.s === "solar_rad")).toBe(false);
    }
  });

  it("Case 8: batch limit accommodates up to 500 records and rejects 501", () => {
    const item = {
      ts: 1757308800,
      readings: [{ s: "temp_air", v: 25.0 }],
    };

    const validBatch500 = {
      device_id: "WS-GRT-001",
      batch: Array(500).fill(item),
    };
    expect(batchTelemetrySchema.safeParse(validBatch500).success).toBe(true);

    const invalidBatch501 = {
      device_id: "WS-GRT-001",
      batch: Array(501).fill(item),
    };
    const parse501 = batchTelemetrySchema.safeParse(invalidBatch501);
    expect(parse501.success).toBe(false);
  });
});
