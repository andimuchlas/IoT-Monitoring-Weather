import "dotenv/config";

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/iot_db",
  PORT: process.env.PORT || "3001",
  ORIGIN: process.env.ORIGIN ? parseOrigin(process.env.ORIGIN) : undefined,
  JWT_SECRET: process.env.JWT_SECRET || "iot-weather-station-secret-jwt-key",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
};

export function parseOrigin(origin: string): string[] | string | undefined {
  if (!origin) return undefined;
  const trimmed = origin.trim();
  if (trimmed === "*") return "*";
  return trimmed.split(",").map((item) => item.trim());
}

export function validateEnv() {
  const requiredEnvVars: (keyof typeof env)[] = ["NODE_ENV", "DATABASE_URL", "PORT"];

  requiredEnvVars.forEach((key) => {
    if (!env[key]) {
      throw new Error(`Missing environment variable: ${key}`);
    }
  });

  console.info("Environment variables validated successfully");
}
