import { pgTable, uuid, doublePrecision, text, timestamp, index } from "drizzle-orm/pg-core";
import { sensors } from "./sensors";

export const sensorCalibrations = pgTable("sensor_calibrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  sensorId: uuid("sensor_id").references(() => sensors.id, { onDelete: "cascade" }).notNull(),
  scale: doublePrecision("scale").default(1.0).notNull(),
  offset: doublePrecision("offset").default(0.0).notNull(),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("sensor_calibrations_lookup_idx").on(table.sensorId, table.effectiveFrom.desc()),
]);
