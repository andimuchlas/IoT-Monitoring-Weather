import { seedUsers } from "./seed/users";
import { seedLocations } from "./seed/locations";
import { seedSensorTypes } from "./seed/sensor-types";
import { seedDevices } from "./seed/devices";
import { seedSensors } from "./seed/sensors";
import { seedHistoricalReadings } from "./seed/historical-readings";

export const seeders = async () => {
  console.info("🌱 Starting seeders...");
  await seedUsers();
  await seedLocations();
  await seedSensorTypes();
  await seedDevices();
  await seedSensors();
  await seedHistoricalReadings();
};

seeders()
  .then(() => {
    console.info("✅ All seeders completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Failed to seeders: ", error);
    process.exit(1);
  });
