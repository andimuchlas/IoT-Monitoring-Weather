import { describe, it, expect } from "bun:test";
import { runRollup, initializeRollupWorker } from "../workers/rollup/worker";
import { db } from "../db";

describe("Rollup Aggregation Worker (BullMQ)", () => {
  it("runRollup returns 0 processed buckets when no readings exist", async () => {
    const originalFindMany = db.query.sensorReadings.findMany;
    (db.query.sensorReadings as any).findMany = async () => [];

    try {
      const res = await runRollup(2);
      expect(res.processed).toBe(0);
      expect(res.success).toBe(true);
    } finally {
      (db.query.sensorReadings as any).findMany = originalFindMany;
    }
  });

  it("runRollup accurately computes min, max, avg, sum, count and wind vector mean", async () => {
    const originalFindMany = db.query.sensorReadings.findMany;
    const originalInsert = db.insert;

    const testTime = new Date("2026-10-01T10:15:00.000Z");

    const mockReadings = [
      {
        deviceId: "WS-GRT-001",
        sensorId: "sens-temp-uuid",
        sensorTypeId: "temp_air",
        time: testTime,
        value: 20.0,
        qualityFlag: "good",
      },
      {
        deviceId: "WS-GRT-001",
        sensorId: "sens-temp-uuid",
        sensorTypeId: "temp_air",
        time: new Date("2026-10-01T10:30:00.000Z"),
        value: 26.0,
        qualityFlag: "good",
      },
      {
        deviceId: "WS-GRT-001",
        sensorId: "sens-wind-uuid",
        sensorTypeId: "wind_dir",
        time: testTime,
        value: 350.0,
        qualityFlag: "good",
      },
      {
        deviceId: "WS-GRT-001",
        sensorId: "sens-wind-uuid",
        sensorTypeId: "wind_dir",
        time: new Date("2026-10-01T10:30:00.000Z"),
        value: 10.0,
        qualityFlag: "good",
      },
    ];

    (db.query.sensorReadings as any).findMany = async () => mockReadings;

    const upsertedRecords: any[] = [];
    (db as any).insert = () => ({
      values: (val: any) => {
        upsertedRecords.push(val);
        return {
          onConflictDoUpdate: async () => Promise.resolve(),
        };
      },
    });

    try {
      const res = await runRollup(2);
      expect(res.processed).toBe(2);

      const tempAgg = upsertedRecords.find((r) => r.sensorTypeId === "temp_air");
      expect(tempAgg).toBeDefined();
      expect(tempAgg.minValue).toBe(20.0);
      expect(tempAgg.maxValue).toBe(26.0);
      expect(tempAgg.avgValue).toBe(23.0);
      expect(tempAgg.sumValue).toBe(46.0);
      expect(tempAgg.readingCount).toBe(2);

      const windAgg = upsertedRecords.find((r) => r.sensorTypeId === "wind_dir");
      expect(windAgg).toBeDefined();
      expect([0, 360].includes(windAgg.avgValue)).toBe(true);
    } finally {
      (db.query.sensorReadings as any).findMany = originalFindMany;
      (db as any).insert = originalInsert;
    }
  });

  it("initializeRollupWorker instantiates BullMQ worker instance", async () => {
    const worker = initializeRollupWorker();
    expect(worker).toBeDefined();
    expect(worker.name).toBe("roll-up");
    await worker.close();
  });
});
