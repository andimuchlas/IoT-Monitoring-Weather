import { Worker } from "bullmq";
import { and, gte, ne } from "drizzle-orm";
import { env } from "@/configs/env";
import db from "@/db";
import { sensorReadings, readingAggregates } from "@/db/schema";
import { calculateVectorMeanWindDirection } from "@/lib/calibration";

export async function runRollup(hoursBack = 2) {
  const now = new Date();
  const currentHourBucket = new Date(Math.floor(now.getTime() / 3600000) * 3600000);
  const startTime = new Date(currentHourBucket.getTime() - hoursBack * 3600000);

  const rawReadings = await db.query.sensorReadings.findMany({
    where: and(gte(sensorReadings.time, startTime), ne(sensorReadings.qualityFlag, "sensor_error")),
  });

  if (rawReadings.length === 0) {
    return { success: true, processed: 0 };
  }

  const grouped = new Map<
    string,
    {
      deviceId: string;
      sensorId: string;
      sensorTypeId: string;
      bucket: Date;
      values: number[];
    }
  >();

  for (const r of rawReadings) {
    const bucketTime = new Date(Math.floor(r.time.getTime() / 3600000) * 3600000);
    const key = `${r.deviceId}|${r.sensorId}|${bucketTime.toISOString()}`;

    let entry = grouped.get(key);
    if (!entry) {
      entry = {
        deviceId: r.deviceId,
        sensorId: r.sensorId,
        sensorTypeId: r.sensorTypeId,
        bucket: bucketTime,
        values: [],
      };
      grouped.set(key, entry);
    }

    entry.values.push(r.value);
  }

  let processedCount = 0;

  for (const entry of grouped.values()) {
    const count = entry.values.length;
    if (count === 0) continue;

    const minVal = Math.min(...entry.values);
    const maxVal = Math.max(...entry.values);
    const sumVal = entry.values.reduce((acc, v) => acc + v, 0);

    let avgVal = sumVal / count;
    if (entry.sensorTypeId === "wind_dir") {
      avgVal = calculateVectorMeanWindDirection(entry.values);
    }

    const roundedAvg = Math.round(avgVal * 100) / 100;
    const roundedMin = Math.round(minVal * 100) / 100;
    const roundedMax = Math.round(maxVal * 100) / 100;
    const roundedSum = Math.round(sumVal * 100) / 100;

    await db
      .insert(readingAggregates)
      .values({
        deviceId: entry.deviceId,
        sensorId: entry.sensorId,
        sensorTypeId: entry.sensorTypeId,
        bucket: entry.bucket,
        interval: "1h",
        avgValue: roundedAvg,
        minValue: roundedMin,
        maxValue: roundedMax,
        sumValue: roundedSum,
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
          avgValue: roundedAvg,
          minValue: roundedMin,
          maxValue: roundedMax,
          sumValue: roundedSum,
          readingCount: count,
        },
      });

    processedCount++;
  }

  return { success: true, processed: processedCount };
}

export function initializeRollupWorker() {
  const worker = new Worker(
    "roll-up",
    async (job) => {
      try {
        console.log(`[Rollup Worker] Processing job ${job?.id ?? "unknown"}...`);
        const hoursBack = Number(job?.data?.hoursBack) || 2;
        const result = await runRollup(hoursBack);
        console.log(`[Rollup Worker] Processed ${result.processed} aggregate buckets`);
        return result;
      } catch (error) {
        console.error("[Rollup Worker] Error in worker processing execution:", error);
        throw error;
      }
    },
    {
      connection: {
        host: env.REDIS_HOST,
        port: Number(env.REDIS_PORT),
        password: env.REDIS_PASSWORD,
        maxRetriesPerRequest: null,
      },
      concurrency: 1,
    }
  );

  worker.on("ready", () => {
    console.log("✅ BullMQ worker ready (queue: roll-up)");
  });

  worker.on("error", (error) => {
    console.error("🔴 Rollup worker error", error);
  });

  worker.on("completed", (job) => {
    console.log("✅ Rollup job completed", job.id);
  });

  worker.on("failed", (job, error) => {
    console.error("🔴 Rollup job failed", {
      jobId: job?.id,
      error,
    });
  });

  return worker;
}
