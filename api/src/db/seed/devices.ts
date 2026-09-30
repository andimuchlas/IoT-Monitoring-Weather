import { db } from "../index";
import { devices, locations } from "../schema";

export async function seedDevices() {
  console.info("  -> Seeding Devices (3 Stasiun Cuaca)...");

  const locs = await db.select().from(locations);
  const loc1 = locs[0]?.id;
  const loc2 = locs[1]?.id;
  const loc3 = locs[2]?.id;

  const defaultSecretHash = await Bun.password.hash("device-secret-123");

  const initialDevices = [
    {
      id: "WS-GRT-001",
      name: "Stasiun Cuaca Lembang 01",
      locationId: loc1,
      apiKeyHash: defaultSecretHash,
      status: "active" as const,
      firmwareVersion: "1.4.2",
      batteryV: 3.92,
      rssi: -71,
      lastSeenAt: new Date(),
    },
    {
      id: "WS-CSR-002",
      name: "Stasiun Cuaca Cisarua 02",
      locationId: loc2,
      apiKeyHash: defaultSecretHash,
      status: "active" as const,
      firmwareVersion: "1.4.2",
      batteryV: 4.05,
      rssi: -65,
      lastSeenAt: new Date(),
    },
    {
      id: "WS-DPK-003",
      name: "Stasiun Cuaca Depok 03",
      locationId: loc3,
      apiKeyHash: defaultSecretHash,
      status: "active" as const,
      firmwareVersion: "1.4.0",
      batteryV: 3.84,
      rssi: -78,
      lastSeenAt: new Date(),
    },
  ];

  for (const d of initialDevices) {
    await db.insert(devices).values(d).onConflictDoNothing({ target: devices.id });
  }
}
