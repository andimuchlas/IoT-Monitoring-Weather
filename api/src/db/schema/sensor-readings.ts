import { pgTable, uuid, varchar, doublePrecision, integer, timestamp, index, uniqueIndex, pgEnum } from "drizzle-orm/pg-core";
import { devices } from "./devices";
import { sensors } from "./sensors";
import { sensorTypes } from "./sensor-types";

export const qualityFlagEnum = pgEnum("quality_flag", [
  "good",
  "out_of_range",
  "sensor_error",
  "uncalibrated",
  "future_timestamp",
  "duplicate",
]);

export const sensorReadings = pgTable("sensor_readings", {
  id: uuid("id").defaultRandom().primaryKey(),
  time: timestamp("time", { withTimezone: true }).notNull(), // device_time UTC
  deviceId: varchar("device_id", { length: 50 }).references(() => devices.id, { onDelete: "cascade" }).notNull(),
  sensorId: uuid("sensor_id").references(() => sensors.id, { onDelete: "cascade" }).notNull(),
  sensorTypeId: varchar("sensor_type_id", { length: 50 }).references(() => sensorTypes.id).notNull(),
  rawValue: doublePrecision("raw_value").notNull(),
  value: doublePrecision("value").notNull(), // calibrated value or converted rain mm
  qualityFlag: qualityFlagEnum("quality_flag").default("good").notNull(),
  serverTime: timestamp("server_time", { withTimezone: true }).defaultNow().notNull(),
  seq: integer("seq"),
}, (table) => [
  // Idempotency: prevents duplicate insertion on retry
  uniqueIndex("sensor_readings_idempotency_idx").on(table.deviceId, table.sensorId, table.time),
  // Performance indexes for time-series queries
  index("sensor_readings_sensor_time_idx").on(table.sensorId, table.time.desc()),
  index("sensor_readings_device_time_idx").on(table.deviceId, table.time.desc()),
  index("sensor_readings_device_type_time_idx").on(table.deviceId, table.sensorTypeId, table.time.desc()),
]);
