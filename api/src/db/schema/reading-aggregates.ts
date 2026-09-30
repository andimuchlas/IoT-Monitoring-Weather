import { pgTable, uuid, varchar, doublePrecision, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { devices } from "./devices";
import { sensors } from "./sensors";
import { sensorTypes } from "./sensor-types";

export const readingAggregates = pgTable("reading_aggregates", {
  id: uuid("id").defaultRandom().primaryKey(),
  bucket: timestamp("bucket", { withTimezone: true }).notNull(), // bucket start time
  interval: varchar("interval", { length: 10 }).notNull(), // '1m', '1h', '1d'
  deviceId: varchar("device_id", { length: 50 }).references(() => devices.id, { onDelete: "cascade" }).notNull(),
  sensorId: uuid("sensor_id").references(() => sensors.id, { onDelete: "cascade" }).notNull(),
  sensorTypeId: varchar("sensor_type_id", { length: 50 }).references(() => sensorTypes.id).notNull(),
  avgValue: doublePrecision("avg_value"),
  minValue: doublePrecision("min_value"),
  maxValue: doublePrecision("max_value"),
  sumValue: doublePrecision("sum_value"), // especially for rain mm
  readingCount: integer("reading_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("reading_aggregates_unique_idx").on(table.deviceId, table.sensorId, table.bucket, table.interval),
  index("reading_aggregates_query_idx").on(table.deviceId, table.sensorTypeId, table.interval, table.bucket.desc()),
]);
