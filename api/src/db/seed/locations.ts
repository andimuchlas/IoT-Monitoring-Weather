import { db } from "../index";
import { locations } from "../schema";

export const initialLocations = [
  {
    name: "Stasiun Lembang Puncak",
    latitude: -6.8168,
    longitude: 107.6167,
    altitude: 1250.0,
  },
  {
    name: "Stasiun Cisarua Kebun Teh",
    latitude: -6.6983,
    longitude: 106.9405,
    altitude: 900.0,
  },
  {
    name: "Stasiun Depok Asri",
    latitude: -6.4025,
    longitude: 106.7942,
    altitude: 95.0,
  },
];

export async function seedLocations() {
  console.info("  -> Seeding Locations...");

  const existing = await db.select().from(locations);
  if (existing.length === 0) {
    await db.insert(locations).values(initialLocations);
  }
}
