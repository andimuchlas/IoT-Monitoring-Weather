import { pgTable, varchar, doublePrecision, integer, timestamp } from "drizzle-orm/pg-core";

export const sensorTypes = pgTable("sensor_types", {
  id: varchar("id", { length: 50 }).primaryKey(), // e.g. "temp_air", "humidity", "pressure", "wind_speed", "wind_dir", "rain_counter", "solar_rad"
  name: varchar("name", { length: 100 }).notNull(),
  unit: varchar("unit", { length: 30 }).notNull(), // e.g. "°C", "%", "hPa", "m/s", "deg", "mm", "W/m²"
  minVal: doublePrecision("min_val").notNull(),
  maxVal: doublePrecision("max_val").notNull(),
  precision: integer("precision").default(2).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
