import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { devices, deviceStatusEnum } from "./devices";
import { users } from "./users";

export const deviceStatusHistory = pgTable("device_status_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  deviceId: varchar("device_id", { length: 50 })
    .references(() => devices.id, { onDelete: "cascade" })
    .notNull(),
  oldStatus: deviceStatusEnum("old_status"),
  newStatus: deviceStatusEnum("new_status").notNull(),
  changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
