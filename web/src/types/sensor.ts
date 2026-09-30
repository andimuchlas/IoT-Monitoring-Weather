import type { DeviceOverview } from "./device";

export type SensorStatus = "active" | "maintenance" | "faulty" | "decommissioned";

export interface SensorType {
  id: string; // e.g. "temp_air", "humidity", "pressure", "wind_speed", "wind_dir", "rain_counter", "solar_rad"
  name: string;
  unit: string;
  minVal: number;
  maxVal: number;
  precision: number;
}

export interface SensorCalibration {
  id: string;
  sensorId: string;
  scale: number;
  offset: number;
  effectiveFrom: string;
  notes?: string | null;
}

export interface SensorItem {
  id: string;
  serialNumber: string;
  name: string;
  sensorTypeId: string;
  status: SensorStatus;
  sensorType?: SensorType;
  installedAt?: string;
  calibration?: SensorCalibration | null;
}

export interface SensorInstallationRecord {
  id: string;
  deviceId: string;
  sensorId: string;
  installedAt: string;
  uninstalledAt: string | null;
  sensor?: SensorItem;
  deviceName?: string;
}

export interface DeviceDetail extends DeviceOverview {
  latitude?: number;
  longitude?: number;
  altitude?: number;
  installedSensors: SensorItem[];
}
