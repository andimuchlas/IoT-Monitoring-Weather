export type DeviceStatus = "provisioned" | "active" | "maintenance" | "decommissioned";

export interface LatestReadings {
  temp_air?: number;
  humidity?: number;
  pressure?: number;
  wind_speed?: number;
  wind_dir?: number;
  rain_counter?: number;
  solar_rad?: number;
}

export interface DeviceOverview {
  id: string; // e.g. "WS-GRT-001"
  name: string;
  locationName: string;
  status: DeviceStatus;
  firmwareVersion?: string;
  batteryV: number | null;
  rssi: number | null;
  lastSeenAt: string | null;
  isOffline: boolean; // dihitung jika lastSeenAt > 15 menit
  latestReadings: LatestReadings;
}

export interface DashboardSummary {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  warningDevices: number; // battery rendah atau offline >15m
  avgTemp?: number;
}
