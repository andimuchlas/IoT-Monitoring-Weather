import { relations } from "drizzle-orm";
import { locations } from "./locations";
import { users } from "./users";
import { devices } from "./devices";
import { deviceStatusHistory } from "./device-status-history";
import { sensorTypes } from "./sensor-types";
import { sensors } from "./sensors";
import { sensorInstallations } from "./sensor-installations";
import { sensorCalibrations } from "./sensor-calibrations";
import { sensorReadings } from "./sensor-readings";
import { readingAggregates } from "./reading-aggregates";

export const locationsRelations = relations(locations, ({ many }) => ({
  devices: many(devices),
}));

export const usersRelations = relations(users, ({ many }) => ({
  statusChanges: many(deviceStatusHistory),
}));

export const devicesRelations = relations(devices, ({ one, many }) => ({
  location: one(locations, {
    fields: [devices.locationId],
    references: [locations.id],
  }),
  statusHistory: many(deviceStatusHistory),
  installations: many(sensorInstallations),
  readings: many(sensorReadings),
  aggregates: many(readingAggregates),
}));

export const deviceStatusHistoryRelations = relations(deviceStatusHistory, ({ one }) => ({
  device: one(devices, {
    fields: [deviceStatusHistory.deviceId],
    references: [devices.id],
  }),
  changedByUser: one(users, {
    fields: [deviceStatusHistory.changedBy],
    references: [users.id],
  }),
}));

export const sensorTypesRelations = relations(sensorTypes, ({ many }) => ({
  sensors: many(sensors),
  readings: many(sensorReadings),
  aggregates: many(readingAggregates),
}));

export const sensorsRelations = relations(sensors, ({ one, many }) => ({
  type: one(sensorTypes, {
    fields: [sensors.sensorTypeId],
    references: [sensorTypes.id],
  }),
  installations: many(sensorInstallations),
  calibrations: many(sensorCalibrations),
  readings: many(sensorReadings),
  aggregates: many(readingAggregates),
}));

export const sensorInstallationsRelations = relations(sensorInstallations, ({ one }) => ({
  device: one(devices, {
    fields: [sensorInstallations.deviceId],
    references: [devices.id],
  }),
  sensor: one(sensors, {
    fields: [sensorInstallations.sensorId],
    references: [sensors.id],
  }),
}));

export const sensorCalibrationsRelations = relations(sensorCalibrations, ({ one }) => ({
  sensor: one(sensors, {
    fields: [sensorCalibrations.sensorId],
    references: [sensors.id],
  }),
}));

export const sensorReadingsRelations = relations(sensorReadings, ({ one }) => ({
  device: one(devices, {
    fields: [sensorReadings.deviceId],
    references: [devices.id],
  }),
  sensor: one(sensors, {
    fields: [sensorReadings.sensorId],
    references: [sensors.id],
  }),
  sensorType: one(sensorTypes, {
    fields: [sensorReadings.sensorTypeId],
    references: [sensorTypes.id],
  }),
}));

export const readingAggregatesRelations = relations(readingAggregates, ({ one }) => ({
  device: one(devices, {
    fields: [readingAggregates.deviceId],
    references: [devices.id],
  }),
  sensor: one(sensors, {
    fields: [readingAggregates.sensorId],
    references: [sensors.id],
  }),
  sensorType: one(sensorTypes, {
    fields: [readingAggregates.sensorTypeId],
    references: [sensorTypes.id],
  }),
}));
