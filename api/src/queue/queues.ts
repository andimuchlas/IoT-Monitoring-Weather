import { Queue } from "bullmq";
import { env } from "@/configs/env";

export const rollUpQueue = new Queue("roll-up", {
  connection: {
    host: env.REDIS_HOST,
    port: Number(env.REDIS_PORT),
    password: env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
  },
});
