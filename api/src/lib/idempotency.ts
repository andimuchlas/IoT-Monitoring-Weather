import crypto from "node:crypto";

export interface CachedResponse {
  statusCode: number;
  body: any;
  timestamp: number;
}

export class IdempotencyManager {
  private cache: Map<string, CachedResponse>;
  private readonly ttlMs: number;
  private readonly maxSize: number;

  constructor(ttlMinutes = 15, maxSize = 10000) {
    this.cache = new Map();
    this.ttlMs = ttlMinutes * 60 * 1000;
    this.maxSize = maxSize;

    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  public generateKey(deviceId: string, ts: number, seq?: number | null): string {
    const seqStr = seq !== undefined && seq !== null ? seq.toString() : "noseq";
    return `telemetry:${deviceId}:${ts}:${seqStr}`;
  }

  public hashPayload(payload: any): string {
    const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
    return crypto.createHash("sha256").update(raw).digest("hex");
  }

  public has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  public get(key: string): CachedResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  public set(key: string, statusCode: number, body: any): void {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      statusCode,
      body,
      timestamp: Date.now(),
    });
  }

  public cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }

  public clear(): void {
    this.cache.clear();
  }
}

export const idempotencyManager = new IdempotencyManager(15, 20000);

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
