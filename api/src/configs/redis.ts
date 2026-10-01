import Redis from "ioredis";
import { env } from "./env";

export const redisConnection = {
  host: env.REDIS_HOST,
  port: Number(env.REDIS_PORT),
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

const redis = new Redis({
  ...redisConnection,
  lazyConnect: true,
});

export async function validateRedis(): Promise<void> {
  if (redis.status !== "ready" && redis.status !== "connecting") {
    await redis.connect();
  }
  const pong = await redis.ping();
  if (pong !== "PONG") {
    throw new Error(`Redis ping failed with response: ${pong}`);
  }
}

export async function closeRedis(): Promise<void> {
  if (redis.status === "ready" || redis.status === "connecting") {
    await redis.quit();
  }
}

export default redis;
