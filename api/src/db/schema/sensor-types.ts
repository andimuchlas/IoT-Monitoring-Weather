import { pgTable, varchar, doublePrecision, integer, timestamp } from "drizzle-orm/pg-core";

export const sensorTypes = pgTable("sensor_types", {
  id: varchar("id", { length: 50 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  unit: varchar("unit", { length: 30 }).notNull(),
  minVal: doublePrecision("min_val").notNull(),
  maxVal: doublePrecision("max_val").notNull(),
  precision: integer("precision").default(2).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
