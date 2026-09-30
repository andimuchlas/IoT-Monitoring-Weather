export type TimeRange = "24h" | "7d" | "30d";
export type AggInterval = "raw" | "1m" | "1h" | "1d";

export interface TelemetryReadingPoint {
  time: string; // ISO 8601 string
  temp_air?: number | null;
  humidity?: number | null;
  pressure?: number | null;
  wind_speed?: number | null;
  wind_dir?: number | null;
  rain_counter?: number | null;
  rainfall_mm?: number | null;
  solar_rad?: number | null;
  battery_v?: number | null;
  rssi?: number | null;
}

export interface ReadingAggregatePoint {
  bucket: string; // ISO timestamp bucket start
  sensorTypeId: string;
  avgValue: number | null;
  minValue: number | null;
  maxValue: number | null;
  sumValue: number | null;
  readingCount: number;
}

export interface DeviceTelemetryResponse {
  deviceId: string;
  range: TimeRange;
  interval: AggInterval;
  readings: TelemetryReadingPoint[];
}
