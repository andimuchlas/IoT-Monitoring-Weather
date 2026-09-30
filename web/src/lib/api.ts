import type { DeviceOverview } from "../types/device";
import type { DeviceDetail, SensorItem } from "../types/sensor";
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

/**
 * Mock data stasiun cuaca yang realistis
 */
export const MOCK_DEVICES: DeviceOverview[] = [
  {
    id: "WS-GRT-001",
    name: "Stasiun Cuaca Lembang 01",
    locationName: "Lembang Puncak, Jawa Barat (1.250 mdpl)",
    status: "active",
    firmwareVersion: "1.4.2",
    batteryV: 3.92,
    rssi: -71,
    lastSeenAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 menit lalu (ONLINE)
    isOffline: false,
    latestReadings: {
      temp_air: 23.4,
      humidity: 82.5,
      pressure: 1012.3,
      wind_speed: 2.8,
      wind_dir: 180,
      rain_counter: 1045,
      solar_rad: 512.0,
    },
  },
  {
    id: "WS-CSR-002",
    name: "Stasiun Cuaca Cisarua 02",
    locationName: "Cisarua Kebun Teh, Bogor (900 mdpl)",
    status: "active",
    firmwareVersion: "1.4.2",
    batteryV: 4.05,
    rssi: -65,
    lastSeenAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(), // 4 menit lalu (ONLINE)
    isOffline: false,
    latestReadings: {
      temp_air: 25.1,
      humidity: 88.0,
      pressure: 1009.6,
      wind_speed: 1.5,
      wind_dir: 210,
      rain_counter: 2120,
      solar_rad: 380.5,
    },
  },
  {
    id: "WS-DPK-003",
    name: "Stasiun Cuaca Depok 03",
    locationName: "Depok Asri, Jawa Barat (95 mdpl)",
    status: "active",
    firmwareVersion: "1.4.0",
    batteryV: 3.65,
    rssi: -82,
    lastSeenAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(), // 35 menit lalu (OFFLINE >15m)
    isOffline: true,
    latestReadings: {
      temp_air: 30.6,
      humidity: 62.0,
      pressure: 1006.1,
      wind_speed: 3.2,
      wind_dir: 95,
      rain_counter: 840,
      solar_rad: 720.0,
    },
  },
];

/**
 * Mock detail lengkap perangkat beserta sensor yang terpasang dan kalibrasinya
 */
export const MOCK_DEVICE_DETAILS: Record<string, DeviceDetail> = {
  "WS-GRT-001": {
    ...MOCK_DEVICES[0],
    latitude: -6.8168,
    longitude: 107.6186,
    altitude: 1250,
    installedSensors: [
      {
        id: "sn-01",
        serialNumber: "SNS-WS-GRT-001-TEMP",
        name: "SHT31-D Air Temperature",
        sensorTypeId: "temp_air",
        status: "active",
        installedAt: "2026-01-10T08:00:00Z",
        sensorType: {
          id: "temp_air",
          name: "Suhu Udara",
          unit: "°C",
          minVal: -40,
          maxVal: 65,
          precision: 2,
        },
        calibration: {
          id: "cal-01",
          sensorId: "sn-01",
          scale: 1.0,
          offset: -0.2,
          effectiveFrom: "2026-01-10T08:00:00Z",
          notes: "Kalibrasi chamber suhu standar",
        },
      },
      {
        id: "sn-02",
        serialNumber: "SNS-WS-GRT-001-HUM",
        name: "SHT31-D Humidity Sensor",
        sensorTypeId: "humidity",
        status: "active",
        installedAt: "2026-01-10T08:00:00Z",
        sensorType: {
          id: "humidity",
          name: "Kelembaban Relatif",
          unit: "%",
          minVal: 0,
          maxVal: 100,
          precision: 2,
        },
        calibration: {
          id: "cal-02",
          sensorId: "sn-02",
          scale: 1.0,
          offset: 1.5,
          effectiveFrom: "2026-01-10T08:00:00Z",
          notes: "Penyesuaian offset kelembaban dataran tinggi",
        },
      },
      {
        id: "sn-03",
        serialNumber: "SNS-WS-GRT-001-BARO",
        name: "BMP280 Barometric Pressure",
        sensorTypeId: "pressure",
        status: "active",
        installedAt: "2026-01-10T08:00:00Z",
        sensorType: {
          id: "pressure",
          name: "Tekanan Udara",
          unit: "hPa",
          minVal: 300,
          maxVal: 1100,
          precision: 2,
        },
        calibration: {
          id: "cal-03",
          sensorId: "sn-03",
          scale: 1.0,
          offset: 0.0,
          effectiveFrom: "2026-01-10T08:00:00Z",
        },
      },
      {
        id: "sn-04",
        serialNumber: "SNS-WS-GRT-001-WIND",
        name: "Davis Anemometer Speed",
        sensorTypeId: "wind_speed",
        status: "active",
        installedAt: "2026-01-10T08:00:00Z",
        sensorType: {
          id: "wind_speed",
          name: "Kecepatan Angin",
          unit: "m/s",
          minVal: 0,
          maxVal: 60,
          precision: 2,
        },
        calibration: {
          id: "cal-04",
          sensorId: "sn-04",
          scale: 1.02,
          offset: 0.1,
          effectiveFrom: "2026-01-10T08:00:00Z",
        },
      },
      {
        id: "sn-05",
        serialNumber: "SNS-WS-GRT-001-WDIR",
        name: "Wind Vane Direction 360",
        sensorTypeId: "wind_dir",
        status: "active",
        installedAt: "2026-01-10T08:00:00Z",
        sensorType: {
          id: "wind_dir",
          name: "Arah Angin",
          unit: "deg",
          minVal: 0,
          maxVal: 360,
          precision: 1,
        },
      },
      {
        id: "sn-06",
        serialNumber: "SNS-WS-GRT-001-RAIN",
        name: "Tipping Bucket 0.2mm Rain Gauge",
        sensorTypeId: "rain_counter",
        status: "active",
        installedAt: "2026-01-10T08:00:00Z",
        sensorType: {
          id: "rain_counter",
          name: "Counter Curah Hujan",
          unit: "tips",
          minVal: 0,
          maxVal: 1000000,
          precision: 0,
        },
      },
      {
        id: "sn-07",
        serialNumber: "SNS-WS-GRT-001-SOLAR",
        name: "SP-110 Pyranometer Solar Radiation",
        sensorTypeId: "solar_rad",
        status: "active",
        installedAt: "2026-01-10T08:00:00Z",
        sensorType: {
          id: "solar_rad",
          name: "Radiasi Matahari",
          unit: "W/m²",
          minVal: 0,
          maxVal: 2000,
          precision: 1,
        },
      },
    ],
  },
  "WS-CSR-002": {
    ...MOCK_DEVICES[1],
    latitude: -6.6991,
    longitude: 106.9452,
    altitude: 900,
    installedSensors: [
      {
        id: "sn-11",
        serialNumber: "SNS-WS-CSR-002-TEMP",
        name: "SHT31-D Air Temperature",
        sensorTypeId: "temp_air",
        status: "active",
        installedAt: "2026-01-12T09:00:00Z",
        sensorType: {
          id: "temp_air",
          name: "Suhu Udara",
          unit: "°C",
          minVal: -40,
          maxVal: 65,
          precision: 2,
        },
      },
      {
        id: "sn-12",
        serialNumber: "SNS-WS-CSR-002-HUM",
        name: "SHT31-D Humidity Sensor",
        sensorTypeId: "humidity",
        status: "active",
        installedAt: "2026-01-12T09:00:00Z",
        sensorType: {
          id: "humidity",
          name: "Kelembaban Relatif",
          unit: "%",
          minVal: 0,
          maxVal: 100,
          precision: 2,
        },
      },
      {
        id: "sn-13",
        serialNumber: "SNS-WS-CSR-002-BARO",
        name: "BMP280 Barometer",
        sensorTypeId: "pressure",
        status: "active",
        installedAt: "2026-01-12T09:00:00Z",
        sensorType: {
          id: "pressure",
          name: "Tekanan Udara",
          unit: "hPa",
          minVal: 300,
          maxVal: 1100,
          precision: 2,
        },
      },
      {
        id: "sn-14",
        serialNumber: "SNS-WS-CSR-002-RAIN",
        name: "Tipping Bucket 0.2mm Rain Gauge",
        sensorTypeId: "rain_counter",
        status: "active",
        installedAt: "2026-01-12T09:00:00Z",
        sensorType: {
          id: "rain_counter",
          name: "Counter Curah Hujan",
          unit: "tips",
          minVal: 0,
          maxVal: 1000000,
          precision: 0,
        },
      },
    ],
  },
  "WS-DPK-003": {
    ...MOCK_DEVICES[2],
    latitude: -6.4025,
    longitude: 106.7942,
    altitude: 95,
    installedSensors: [
      {
        id: "sn-21",
        serialNumber: "SNS-WS-DPK-003-TEMP",
        name: "SHT31-D Air Temperature",
        sensorTypeId: "temp_air",
        status: "maintenance",
        installedAt: "2026-01-15T10:00:00Z",
        sensorType: {
          id: "temp_air",
          name: "Suhu Udara",
          unit: "°C",
          minVal: -40,
          maxVal: 65,
          precision: 2,
        },
      },
      {
        id: "sn-22",
        serialNumber: "SNS-WS-DPK-003-HUM",
        name: "SHT31-D Humidity Sensor",
        sensorTypeId: "humidity",
        status: "active",
        installedAt: "2026-01-15T10:00:00Z",
        sensorType: {
          id: "humidity",
          name: "Kelembaban Relatif",
          unit: "%",
          minVal: 0,
          maxVal: 100,
          precision: 2,
        },
      },
    ],
  },
};

/**
 * Generator data time-series realistis untuk chart telemetri
 */
export function generateMockTelemetry(
  range: TimeRange = "24h",
  baseTemp = 24.5
): TelemetryReadingPoint[] {
  const points: TelemetryReadingPoint[] = [];
  const now = Date.now();

  let stepMinutes = 60; // default 1 hour step
  let count = 24;

  if (range === "24h") {
    stepMinutes = 30; // 48 points for 24h (tiap 30 menit)
    count = 48;
  } else if (range === "7d") {
    stepMinutes = 120; // tiap 2 jam untuk 7 hari
    count = 84;
  } else if (range === "30d") {
    stepMinutes = 720; // 2 kali per hari untuk 30 hari
    count = 60;
  }

  let cumulativeRainTips = 500;

  for (let i = count; i >= 0; i--) {
    const timeMs = now - i * stepMinutes * 60 * 1000;
    const date = new Date(timeMs);
    const hour = date.getHours();

    // Diurnal temperature cycle: puncak jam 14:00, terendah jam 05:00
    const tempSin = Math.sin(((hour - 8) * Math.PI) / 12);
    const temp = Number((baseTemp + 6.0 * tempSin + (Math.random() * 0.8 - 0.4)).toFixed(1));
    const humidity = Number(
      Math.max(40, Math.min(99, 82.0 - 24.0 * tempSin + (Math.random() * 2 - 1))).toFixed(1)
    );
    const pressure = Number(
      (1011.0 + 2.5 * Math.cos((hour * Math.PI) / 12) + (Math.random() * 0.4 - 0.2)).toFixed(1)
    );
    const windSpeed = Number((1.5 + Math.max(0, 3.2 * tempSin) + Math.random() * 0.6).toFixed(1));
    const windDir = Math.round((180 + 70 * Math.sin(hour / 3) + Math.random() * 15) % 360);

    // Hujan turun beberapa waktu (misal sore jam 15 - 17)
    let rainfallMm = 0;
    if (hour >= 15 && hour <= 17 && i % 3 === 0) {
      const tipsDelta = Math.floor(Math.random() * 12) + 3;
      cumulativeRainTips += tipsDelta;
      rainfallMm = Number((tipsDelta * 0.2).toFixed(1));
    }

    const solarRad =
      hour >= 6 && hour <= 18
        ? Number(
            (
              Math.max(0, 780.0 * Math.sin(((hour - 6) * Math.PI) / 12)) +
              Math.random() * 20
            ).toFixed(0)
          )
        : 0;

    const batteryV = Number((4.1 - (i / count) * 0.25 + (Math.random() * 0.04 - 0.02)).toFixed(2));
    const rssi = Math.floor(-68 - Math.random() * 10);

    points.push({
      time: date.toISOString(),
      temp_air: temp,
      humidity,
      pressure,
      wind_speed: windSpeed,
      wind_dir: windDir,
      rain_counter: cumulativeRainTips,
      rainfall_mm: rainfallMm,
      solar_rad: solarRad,
      battery_v: batteryV,
      rssi,
    });
  }

  return points;
}

/**
 * Fetch detail stasiun dengan fallback
 */
export async function getDeviceDetail(deviceId: string): Promise<DeviceDetail> {
  try {
    const data = await fetchApi<DeviceDetail>(`/api/v1/devices/${deviceId}`);
    return data;
  } catch (err) {
    console.warn(`Failed to fetch device ${deviceId}, using mock detail:`, err);
    if (MOCK_DEVICE_DETAILS[deviceId]) {
      return MOCK_DEVICE_DETAILS[deviceId];
    }
    // Generic fallback for any unknown device id
    return {
      id: deviceId,
      name: `Stasiun Cuaca ${deviceId}`,
      locationName: "Lokasi Sensor Stasiun Terdistribusi",
      status: "active",
      batteryV: 3.9,
      rssi: -72,
      lastSeenAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      isOffline: false,
      latitude: -6.9,
      longitude: 107.6,
      altitude: 800,
      latestReadings: {
        temp_air: 26.2,
        humidity: 78.0,
        pressure: 1010.5,
        wind_speed: 2.1,
        wind_dir: 160,
        rain_counter: 1200,
        solar_rad: 450,
      },
      installedSensors: MOCK_DEVICE_DETAILS["WS-GRT-001"].installedSensors,
    };
  }
}

/**
 * Fetch time-series telemetry dengan fallback
 */
export async function getDeviceTelemetry(
  deviceId: string,
  range: TimeRange = "24h"
): Promise<TelemetryReadingPoint[]> {
  try {
    const data = await fetchApi<TelemetryReadingPoint[]>(
      `/api/v1/readings?deviceId=${deviceId}&range=${range}`
    );
    if (data && data.length > 0) return data;
    return generateMockTelemetry(range);
  } catch (err) {
    console.warn(`Failed to fetch readings for ${deviceId}, using mock telemetry:`, err);
    return generateMockTelemetry(range);
  }
}

/**
 * Fetch semua stasiun
 */
export async function getAllDevices(): Promise<DeviceOverview[]> {
  try {
    const data = await fetchApi<DeviceOverview[]>("/api/v1/devices");
    return data;
  } catch (err) {
    console.warn("Failed to fetch all devices, using mock:", err);
    return MOCK_DEVICES;
  }
}
