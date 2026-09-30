import { pgTable, uuid, varchar, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { sensorTypes } from "./sensor-types";

export const sensorStatusEnum = pgEnum("sensor_status", [
  "active",
  "maintenance",
  "faulty",
  "decommissioned",
]);

export const sensors = pgTable("sensors", {
  id: uuid("id").defaultRandom().primaryKey(),
  serialNumber: varchar("serial_number", { length: 100 }).unique().notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  sensorTypeId: varchar("sensor_type_id", { length: 50 })
    .references(() => sensorTypes.id, { onDelete: "restrict" })
    .notNull(),
  status: sensorStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
