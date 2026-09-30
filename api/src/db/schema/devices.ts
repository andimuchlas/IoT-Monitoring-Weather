import {
  pgTable,
  varchar,
  text,
  doublePrecision,
  integer,
  timestamp,
  pgEnum,
  uuid,
} from "drizzle-orm/pg-core";
import { locations } from "./locations";

export const deviceStatusEnum = pgEnum("device_status", [
  "provisioned",
  "active",
  "maintenance",
  "decommissioned",
]);

export const devices = pgTable("devices", {
  id: varchar("id", { length: 50 }).primaryKey(), // maps to device_id e.g. "WS-GRT-001"
  name: varchar("name", { length: 150 }).notNull(),
  locationId: uuid("location_id").references(() => locations.id, { onDelete: "set null" }),
  apiKeyHash: text("api_key_hash").notNull(),
  status: deviceStatusEnum("status").default("provisioned").notNull(),
  firmwareVersion: varchar("firmware_version", { length: 50 }),
  batteryV: doublePrecision("battery_v"),
  rssi: integer("rssi"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }), // soft delete
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
