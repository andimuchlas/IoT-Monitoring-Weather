import { pgTable, uuid, varchar, timestamp, index } from "drizzle-orm/pg-core";
import { devices } from "./devices";
import { sensors } from "./sensors";

export const sensorInstallations = pgTable(
  "sensor_installations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deviceId: varchar("device_id", { length: 50 })
      .references(() => devices.id, { onDelete: "cascade" })
      .notNull(),
    sensorId: uuid("sensor_id")
      .references(() => sensors.id, { onDelete: "cascade" })
      .notNull(),
    installedAt: timestamp("installed_at", { withTimezone: true }).defaultNow().notNull(),
    uninstalledAt: timestamp("uninstalled_at", { withTimezone: true }), // null = currently active on device
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("sensor_installations_device_idx").on(table.deviceId),
    index("sensor_installations_sensor_idx").on(table.sensorId),
    index("sensor_installations_active_idx").on(table.deviceId, table.uninstalledAt),
  ]
);
