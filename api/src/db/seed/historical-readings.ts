import { db } from "../index";
import { devices, sensors, sensorReadings, readingAggregates } from "../schema";
import { eq } from "drizzle-orm";

export async function seedHistoricalReadings() {
  console.info("  -> Seeding 7 Days Historical Time-Series Readings & Aggregates...");

  const existing = await db.select({ id: sensorReadings.id }).from(sensorReadings).limit(1);
  if (existing.length > 0) {
    console.info("  -> Readings already exist, skipping...");
    return;
  }

  const allDevices = await db.select().from(devices);
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const totalHours = 7 * 24; // 168 jam ke belakang

  const rawReadingsToInsert: (typeof sensorReadings.$inferInsert)[] = [];
  const aggregatesToInsert: (typeof readingAggregates.$inferInsert)[] = [];

  for (const device of allDevices) {
    const deviceSensors = await db.query.sensors.findMany({
      where: (s, { like }) => like(s.serialNumber, `SNS-${device.id}-%`),
    });

    let cumulativeRainTips = 400; // Counter awal

    for (let h = totalHours; h >= 0; h--) {
      const timestamp = new Date(now - h * oneHour);
      const hourOfDay = timestamp.getHours();

      // Formula cuaca realistis diurnal cycle
      const tempSin = Math.sin(((hourOfDay - 8) * Math.PI) / 12);
      const temp = Number((24.0 + 6.0 * tempSin + (Math.random() * 0.8 - 0.4)).toFixed(2));
      const humidity = Number((80.0 - 25.0 * tempSin + (Math.random() * 2.0 - 1.0)).toFixed(2));
      const pressure = Number(
        (1008.0 + 2.0 * Math.cos((hourOfDay * Math.PI) / 12) + (Math.random() * 0.4 - 0.2)).toFixed(
          2
        )
      );
      const windSpeed = Number((2.0 + Math.max(0, 3.0 * tempSin) + Math.random() * 0.5).toFixed(2));
      const windDir = Math.floor((180 + 90 * Math.sin(hourOfDay / 3) + Math.random() * 20) % 360);
      const solarRad =
        hourOfDay >= 6 && hourOfDay <= 18
          ? Number(
              (
                Math.max(0, 750.0 * Math.sin(((hourOfDay - 6) * Math.PI) / 12)) +
                Math.random() * 20
              ).toFixed(2)
            )
          : 0.0;

      // Simulasi hujan sesekali (misal sore hari)
      let hourlyRainMm = 0;
      if (hourOfDay >= 15 && hourOfDay <= 17 && h % 2 === 0) {
        const tipsDelta = Math.floor(Math.random() * 15) + 5; // 5-20 tips
        cumulativeRainTips += tipsDelta;
        hourlyRainMm = Number((tipsDelta * 0.2).toFixed(2));
      }

      for (const sensor of deviceSensors) {
        let rawVal = 0;
        let finalVal = 0;

        switch (sensor.sensorTypeId) {
          case "temp_air":
            rawVal = temp;
            finalVal = temp;
            break;
          case "humidity":
            rawVal = humidity;
            finalVal = humidity;
            break;
          case "pressure":
            rawVal = pressure;
            finalVal = pressure;
            break;
          case "wind_speed":
            rawVal = windSpeed;
            finalVal = windSpeed;
            break;
          case "wind_dir":
            rawVal = windDir;
            finalVal = windDir;
            break;
          case "rain_counter":
            rawVal = cumulativeRainTips;
            finalVal = hourlyRainMm; // mm curah hujan
            break;
          case "solar_rad":
            rawVal = solarRad;
            finalVal = solarRad;
            break;
        }

        rawReadingsToInsert.push({
          time: timestamp,
          deviceId: device.id,
          sensorId: sensor.id,
          sensorTypeId: sensor.sensorTypeId,
          rawValue: rawVal,
          value: finalVal,
          qualityFlag: "good",
          serverTime: timestamp,
          seq: 1000 + (totalHours - h),
        });

        // 1h pre-computed aggregate
        aggregatesToInsert.push({
          bucket: timestamp,
          interval: "1h",
          deviceId: device.id,
          sensorId: sensor.id,
          sensorTypeId: sensor.sensorTypeId,
          avgValue: finalVal,
          minValue: finalVal,
          maxValue: finalVal,
          sumValue: sensor.sensorTypeId === "rain_counter" ? finalVal : undefined,
          readingCount: 1,
        });
      }
    }
  }

  // Chunk insert agar aman dan sangat cepat
  const chunkSize = 500;
  console.info(`  -> Inserting ${rawReadingsToInsert.length} raw readings in chunks...`);
  for (let i = 0; i < rawReadingsToInsert.length; i += chunkSize) {
    const chunk = rawReadingsToInsert.slice(i, i + chunkSize);
    await db.insert(sensorReadings).values(chunk).onConflictDoNothing();
  }

  console.info(`  -> Inserting ${aggregatesToInsert.length} aggregates in chunks...`);
  for (let i = 0; i < aggregatesToInsert.length; i += chunkSize) {
    const chunk = aggregatesToInsert.slice(i, i + chunkSize);
    await db.insert(readingAggregates).values(chunk).onConflictDoNothing();
  }
}
