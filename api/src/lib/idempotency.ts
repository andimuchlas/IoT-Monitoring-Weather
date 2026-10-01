import crypto from "node:crypto";
import redis from "@/lib/redis";

export interface CachedResponse {
  statusCode: number;
  body: any;
  timestamp: number;
}

const TTL_SECONDS = 15 * 60;

export class IdempotencyManager {
  generateKey(deviceId: string, ts: number, seq?: number | null): string {
    const seqStr = seq !== undefined && seq !== null ? seq.toString() : "noseq";
    return `idempotency:${deviceId}:${ts}:${seqStr}`;
  }

  hashPayload(payload: any): string {
    const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
    return crypto.createHash("sha256").update(raw).digest("hex");
  }

  async has(key: string): Promise<boolean> {
    const result = await redis.exists(key);
    return result === 1;
  }

  async get(key: string): Promise<CachedResponse | null> {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as CachedResponse;
  }

  async set(key: string, statusCode: number, body: any): Promise<void> {
    const payload: CachedResponse = { statusCode, body, timestamp: Date.now() };
    await redis.setex(key, TTL_SECONDS, JSON.stringify(payload));
  }
}

export const idempotencyManager = new IdempotencyManager();

export function deduplicateReadings<
  T extends { deviceId: string; sensorId: string; time: Date | string },
>(items: T[]): { unique: T[]; duplicateCount: number } {
  const seen = new Set<string>();
  const unique: T[] = [];
  let duplicateCount = 0;

  for (const item of items) {
    const timeIso = typeof item.time === "string" ? item.time : item.time.toISOString();
    const signature = `${item.deviceId}|${item.sensorId}|${timeIso}`;

    if (seen.has(signature)) {
      duplicateCount++;
    } else {
      seen.add(signature);
      unique.push(item);
    }
  }

  return { unique, duplicateCount };
}
