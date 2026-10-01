import { rollUpQueue } from "@/queue/queues";

export async function registerRollupScheduler() {
  await rollUpQueue.upsertJobScheduler(
    "rollup-loop",
    {
      pattern: "0 * * * * *",
    },
    {
      name: "rollup-job",
      opts: {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: true,
      },
    }
  );

  console.log("✅ Rollup scheduler registered (1m interval)");
}
