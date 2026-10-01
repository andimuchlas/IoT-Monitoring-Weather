import { db } from "../index";
import { users } from "../schema";
import { eq } from "drizzle-orm";

export async function seedUsers() {
  console.info("  -> Seeding Users...");

  const existingAdmin = await db.query.users.findFirst({
    where: eq(users.email, "superadmin@iot.com"),
  });

  if (!existingAdmin) {
    const passwordHash = await Bun.password.hash("admin123");
    await db.insert(users).values([
      {
        name: "Superadmin",
        email: "superadmin@iot.com",
        passwordHash,
        role: "admin",
      },
      {
        name: "Operator",
        email: "operator@iot.id",
        passwordHash: await Bun.password.hash("operator123"),
        role: "operator",
      },
    ]);
  }
}
