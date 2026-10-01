import { db } from "../index";
import { devices, sensorTypes, sensors, sensorInstallations, sensorCalibrations } from "../schema";
import { eq } from "drizzle-orm";

export async function seedSensors() {
  console.info("  -> Seeding Physical Sensors, Installations & Calibrations...");

  const allDevices = await db.select().from(devices);
  const allTypes = await db.select().from(sensorTypes);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  for (const device of allDevices) {
    for (const st of allTypes) {
      const serialNumber = `SNS-${device.id}-${st.id.toUpperCase()}`;

      let sensor = await db.query.sensors.findFirst({
        where: eq(sensors.serialNumber, serialNumber),
      });

      if (!sensor) {
        const [inserted] = await db
          .insert(sensors)
          .values({
            serialNumber,
            name: `${st.name} (${device.id})`,
            sensorTypeId: st.id,
            status: "active",
          })
          .returning();
        sensor = inserted;
      }

      if (sensor) {
        const activeInstall = await db.query.sensorInstallations.findFirst({
          where: eq(sensorInstallations.sensorId, sensor.id),
        });

        if (!activeInstall) {
          await db.insert(sensorInstallations).values({
            deviceId: device.id,
            sensorId: sensor.id,
            installedAt: sevenDaysAgo,
          });
        }

        const activeCalib = await db.query.sensorCalibrations.findFirst({
          where: eq(sensorCalibrations.sensorId, sensor.id),
        });

        if (!activeCalib) {
          await db.insert(sensorCalibrations).values({
            sensorId: sensor.id,
            scale: 1.0,
            offset: 0.0,
            effectiveFrom: sevenDaysAgo,
            notes: "Factory calibration default",
          });
        }
      }
    }
  }
}
