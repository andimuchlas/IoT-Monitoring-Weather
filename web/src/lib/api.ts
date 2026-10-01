import type { DeviceOverview } from "../types/device";
import type { DeviceDetail } from "../types/sensor";
import type { TelemetryReadingPoint, TimeRange } from "../types/reading";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || `Request failed with status ${res.status}`);
  }

  return json.data;
}

export async function getDeviceDetail(deviceId: string): Promise<DeviceDetail> {
  const data = await fetchApi<any>(`/api/v1/devices/${encodeURIComponent(deviceId)}`);
  if (!data || !data.id) {
    throw new Error(`Stasiun ${deviceId} tidak ditemukan`);
  }

  return {
    id: data.id,
    name: data.name,
    locationName: data.locationName || data.location?.name || "Lokasi Sensor Stasiun",
    status: data.status || "active",
    firmwareVersion: data.firmwareVersion || "1.4.2",
    batteryV: data.batteryV ?? null,
    rssi: data.rssi ?? null,
    lastSeenAt: data.lastSeenAt || new Date().toISOString(),
    isOffline: data.isOffline ?? false,
    latitude: data.latitude ?? data.location?.latitude ?? -6.9,
    longitude: data.longitude ?? data.location?.longitude ?? 107.6,
    altitude: data.altitude ?? data.location?.altitude ?? 500,
    latestReadings: data.latestReadings || {},
    installedSensors: data.installedSensors || [],
  };
}

export async function getDeviceTelemetry(
  deviceId: string,
  range: TimeRange = "24h"
): Promise<TelemetryReadingPoint[]> {
  const now = new Date();
  let fromDate: Date;
  let interval = "1h";

  if (range === "24h") {
    fromDate = new Date(now.getTime() - 24 * 3600 * 1000);
    interval = "raw";
  } else if (range === "7d") {
    fromDate = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    interval = "1h";
  } else {
    fromDate = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    interval = "1d";
  }

  const endpoint = `/api/v1/readings?device_id=${encodeURIComponent(
    deviceId
  )}&from=${encodeURIComponent(fromDate.toISOString())}&to=${encodeURIComponent(
    now.toISOString()
  )}&interval=${interval}`;

  const response = await fetchApi<any>(endpoint);
  const items = Array.isArray(response) ? response : (response?.data ?? []);

  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  // Jika data sudah dalam format wide
  const hasWideFormat = items.some(
    (p: any) => p.temp_air !== undefined || p.humidity !== undefined
  );

  if (hasWideFormat) {
    return items.map((p: any) => ({
      time: p.time,
      temp_air: p.temp_air ?? null,
      humidity: p.humidity ?? null,
      pressure: p.pressure ?? null,
      wind_speed: p.wind_speed ?? null,
      wind_dir: p.wind_dir ?? null,
      rainfall_mm: p.rainfall_mm ?? (p.rain_counter ? p.rain_counter * 0.2 : null),
      rain_counter: p.rain_counter ?? null,
      solar_rad: p.solar_rad ?? null,
      battery_v: p.battery_v ?? null,
      rssi: p.rssi ?? null,
    }));
  }

  // Bila respons dalam format narrow, pivot menjadi time-series wide
  const grouped = new Map<string, TelemetryReadingPoint>();
  for (const r of items) {
    const timeStr = r.time || r.bucket;
    if (!timeStr) continue;
    let point = grouped.get(timeStr);
    if (!point) {
      point = { time: timeStr };
      grouped.set(timeStr, point);
    }
    if (r.sensorTypeId) {
      (point as any)[r.sensorTypeId] = r.value ?? r.avg ?? null;
      if (r.sensorTypeId === "rain_counter" && (r.value !== undefined || r.sum !== undefined)) {
        point.rainfall_mm = Number(((r.sum ?? r.value) * 0.2).toFixed(1));
      }
    }
  }

  return Array.from(grouped.values());
}

/**
 * Fetch semua stasiun dari overview endpoint /api/v1/dashboard/overview
 */
export async function getAllDevices(): Promise<DeviceOverview[]> {
  const res = await fetchApi<any>("/api/v1/dashboard/overview");
  const list = Array.isArray(res) ? res : (res?.stations ?? []);
  if (!Array.isArray(list) || list.length === 0) {
    return [];
  }

  return list.map((st: any) => ({
    id: st.id,
    name: st.name,
    locationName: st.locationName || st.location || "Lokasi Sensor",
    status: st.status || "active",
    firmwareVersion: st.firmwareVersion || "1.4.2",
    batteryV: st.batteryV ?? null,
    rssi: st.rssi ?? null,
    lastSeenAt: st.lastSeenAt,
    isOffline: st.isOffline ?? false,
    latestReadings: st.latestReadings || {
      temp_air: st.metrics?.temperature,
      humidity: st.metrics?.humidity,
      wind_speed: st.metrics?.windSpeed,
      pressure: st.metrics?.pressure,
    },
  }));
}

export interface TelemetryLogEntry {
  id: string;
  deviceId: string;
  stationName: string;
  ingestMode: "normal" | "offline_batch";
  sensorTime: string;
  serverTime: string;
  temp_air: number | null;
  humidity: number | null;
  pressure: number | null;
  wind_speed: number | null;
  wind_dir: number | null;
  rain_counter: number | null;
  rainfall_mm: number | null;
  solar_rad: number | null;
  battery_v: number | null;
  rssi: number | null;
  status: "VALID" | "DEDUPLICATED" | "RAIN_RESET";
  latencyMs: number;
  rawPayload: any;
}

/**
 * Fetch raw telemetry audit logs from database
 */
export async function getTelemetryLogs(): Promise<TelemetryLogEntry[]> {
  try {
    const stationNameMap: Record<string, string> = {};
    try {
      const overview = await fetchApi<any>("/api/v1/dashboard/overview");
      const stations = overview?.stations || [];
      for (const st of stations) {
        stationNameMap[st.id] = st.name;
      }
    } catch {
      // fallback
    }

    const res = await fetchApi<any>("/api/v1/readings?interval=raw&limit=300&order=desc");
    const items = Array.isArray(res) ? res : (res?.data ?? []);

    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const packetMap = new Map<string, TelemetryLogEntry>();

    for (const r of items) {
      const key = `${r.deviceId}_${r.time}`;
      let packet = packetMap.get(key);

      if (!packet) {
        const sensorTime = r.time;
        const serverTime = r.serverTime || r.time;
        const sensorDate = new Date(sensorTime);
        const serverDate = new Date(serverTime);
        const latencyMs = Math.max(0, serverDate.getTime() - sensorDate.getTime());
        const isOfflineBatch = latencyMs > 5 * 60 * 1000;

        let status: "VALID" | "DEDUPLICATED" | "RAIN_RESET" = "VALID";
        if (r.qualityFlag === "rain_counter_reset") {
          status = "RAIN_RESET";
        } else if (r.qualityFlag === "duplicate" || r.qualityFlag === "idempotent") {
          status = "DEDUPLICATED";
        }

        packet = {
          id: `pkt-${r.id ? String(r.id).substring(0, 8) : Math.random().toString(36).substring(2, 8)}`,
          deviceId: r.deviceId,
          stationName: stationNameMap[r.deviceId] || r.deviceId,
          ingestMode: isOfflineBatch ? "offline_batch" : "normal",
          sensorTime,
          serverTime,
          temp_air: null,
          humidity: null,
          pressure: null,
          wind_speed: null,
          wind_dir: null,
          rain_counter: null,
          rainfall_mm: null,
          solar_rad: null,
          battery_v: null,
          rssi: null,
          status,
          latencyMs,
          rawPayload: {
            device_id: r.deviceId,
            timestamp: sensorTime,
            sensors: {},
          },
        };
        packetMap.set(key, packet);
      }

      if (r.sensorTypeId) {
        (packet as any)[r.sensorTypeId] = r.value;
        packet.rawPayload.sensors[r.sensorTypeId] = r.value;
        if (r.sensorTypeId === "rain_counter" && r.value !== null && r.value !== undefined) {
          packet.rainfall_mm = Number((r.value * 0.2).toFixed(1));
        }
      }

      if (r.qualityFlag === "rain_counter_reset") {
        packet.status = "RAIN_RESET";
      } else if (r.qualityFlag === "duplicate" || r.qualityFlag === "idempotent") {
        packet.status = "DEDUPLICATED";
      }
    }

    return Array.from(packetMap.values());
  } catch (err) {
    console.warn("Gagal memuat log telemetri dari API:", err);
    return [];
  }
}
