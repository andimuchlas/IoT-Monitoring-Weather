import { db } from "../index";
import { sensorTypes } from "../schema";

export const initialSensorTypes = [
  {
    id: "temp_air",
    name: "Air Temperature",
    unit: "°C",
    minVal: -40.0,
    maxVal: 85.0,
    precision: 2,
  },
  {
    id: "humidity",
    name: "Relative Humidity",
    unit: "%",
    minVal: 0.0,
    maxVal: 100.0,
    precision: 2,
  },
  {
    id: "pressure",
    name: "Atmospheric Pressure",
    unit: "hPa",
    minVal: 300.0,
    maxVal: 1100.0,
    precision: 2,
  },
  {
    id: "wind_speed",
    name: "Wind Speed",
    unit: "m/s",
    minVal: 0.0,
    maxVal: 60.0,
    precision: 2,
  },
  {
    id: "wind_dir",
    name: "Wind Direction",
    unit: "deg",
    minVal: 0.0,
    maxVal: 360.0,
    precision: 0,
  },
  {
    id: "rain_counter",
    name: "Rain Counter Tipping Bucket",
    unit: "tips",
    minVal: 0.0,
    maxVal: 1000000.0,
    precision: 0,
  },
  {
    id: "solar_rad",
    name: "Solar Radiation",
    unit: "W/m²",
    minVal: 0.0,
    maxVal: 2000.0,
    precision: 2,
  },
];

export async function seedSensorTypes() {
  console.info("  -> Seeding Sensor Types (7 Types)...");

  for (const st of initialSensorTypes) {
    await db.insert(sensorTypes).values(st).onConflictDoNothing({ target: sensorTypes.id });
  }
}
