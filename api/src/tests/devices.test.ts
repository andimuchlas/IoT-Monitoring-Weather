import { describe, it, expect } from "bun:test";
import { generateApiKey, hashApiKey, isDeviceOffline } from "../services/devices/service";
import { createDeviceSchema, updateDeviceSchema, deviceQuerySchema } from "../services/devices/dto";

describe("Device Utility Functions", () => {
  it("generateApiKey should generate valid prefixed key", () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();

    expect(key1.startsWith("ws_live_")).toBe(true);
    expect(key2.startsWith("ws_live_")).toBe(true);
    expect(key1.length).toBe(56);
    expect(key1).not.toBe(key2);
  });

  it("hashApiKey should generate deterministic SHA-256 hash", () => {
    const key = "ws_live_abcdef0123456789abcdef0123456789abcdef0123456789";
    const hash1 = hashApiKey(key);
    const hash2 = hashApiKey(key);

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);

    const differentHash = hashApiKey("ws_live_different_key_value");
    expect(hash1).not.toBe(differentHash);
  });

  it("isDeviceOffline should correctly classify device online/offline status", () => {
    expect(isDeviceOffline(null)).toBe(true);

    const now = Date.now();

    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);
    expect(isDeviceOffline(fiveMinutesAgo)).toBe(false);

    const twentyMinutesAgo = new Date(now - 20 * 60 * 1000);
    expect(isDeviceOffline(twentyMinutesAgo)).toBe(true);

    expect(isDeviceOffline(fiveMinutesAgo.toISOString())).toBe(false);
    expect(isDeviceOffline(twentyMinutesAgo.toISOString())).toBe(true);

    expect(isDeviceOffline(fiveMinutesAgo, 3)).toBe(true);
    expect(isDeviceOffline(fiveMinutesAgo, 10)).toBe(false);
  });
});

describe("Device DTO Schemas", () => {
  it("createDeviceSchema validates correct payload", () => {
    const validWithLocationId = {
      id: "WS-BDG-001",
      name: "Stasiun Bandung Barat",
      firmwareVersion: "v1.2.0",
      status: "active",
      locationId: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    };

    const parse1 = createDeviceSchema.safeParse(validWithLocationId);
    expect(parse1.success).toBe(true);

    const validWithInlineLocation = {
      id: "WS-BDG-002",
      name: "Stasiun Lembang",
      status: "provisioned",
      location: {
        name: "Lembang Highland",
        latitude: -6.8167,
        longitude: 107.6167,
        altitude: 1250,
      },
    };

    const parse2 = createDeviceSchema.safeParse(validWithInlineLocation);
    expect(parse2.success).toBe(true);
  });

  it("createDeviceSchema rejects mutually exclusive locationId AND location", () => {
    const invalidPayload = {
      id: "WS-INVALID",
      name: "Invalid Station",
      locationId: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      location: {
        name: "Conflict Location",
        latitude: -6.8,
        longitude: 107.6,
      },
    };

    const parse = createDeviceSchema.safeParse(invalidPayload);
    expect(parse.success).toBe(false);
  });

  it("createDeviceSchema rejects invalid device ID formats", () => {
    const invalidId = {
      id: "WS BDG #001",
      name: "Invalid ID Station",
    };

    const parse = createDeviceSchema.safeParse(invalidId);
    expect(parse.success).toBe(false);
  });

  it("deviceQuerySchema correctly parses query params", () => {
    const query1 = deviceQuerySchema.safeParse({
      search: "Garut",
      status: "active",
      isOffline: "true",
    });

    expect(query1.success).toBe(true);
    if (query1.success) {
      expect(query1.data.isOffline).toBe(true);
    }

    const query2 = deviceQuerySchema.safeParse({
      isOffline: "false",
    });

    expect(query2.success).toBe(true);
    if (query2.success) {
      expect(query2.data.isOffline).toBe(false);
    }

    const query3 = deviceQuerySchema.safeParse({
      isOffline: true,
    });

    expect(query3.success).toBe(true);
    if (query3.success) {
      expect(query3.data.isOffline).toBe(true);
    }
  });

  it("updateDeviceSchema allows partial updates", () => {
    const update1 = {
      name: "Updated Station Name",
      status: "maintenance",
      statusReason: "Rutin penggantian anemometer",
    };

    const parse = updateDeviceSchema.safeParse(update1);
    expect(parse.success).toBe(true);
  });
});

describe("Device Endpoints RBAC & Validation", async () => {
  const { default: app } = await import("../app");
  const { sign } = await import("hono/jwt");
  const { JWT_SECRET } = await import("../services/auth/service");

  const viewerToken = await sign(
    {
      id: "viewer-uuid",
      name: "Viewer",
      email: "viewer@luwes.co.id",
      role: "viewer",
      exp: 9999999999,
    },
    JWT_SECRET,
    "HS256"
  );

  const adminToken = await sign(
    { id: "admin-uuid", name: "Admin", email: "admin@luwes.co.id", role: "admin", exp: 9999999999 },
    JWT_SECRET,
    "HS256"
  );

  it("GET /api/v1/devices rejects unauthenticated requests with 401", async () => {
    const res = await app.request("/api/v1/devices");
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("POST /api/v1/devices rejects non-admin users with 403 Forbidden", async () => {
    const res = await app.request("/api/v1/devices", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${viewerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: "WS-NEW-001",
        name: "Stasiun Baru",
      }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.code).toBe("FORBIDDEN");
  });

  it("POST /api/v1/devices validates request body with 422 for invalid payloads", async () => {
    const res = await app.request("/api/v1/devices", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: "INVALID ID SPACES",
        name: "Ab",
      }),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("POST /api/v1/devices/:id/rotate-key rejects non-admin users with 403", async () => {
    const res = await app.request("/api/v1/devices/WS-GRT-001/rotate-key", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${viewerToken}`,
      },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.code).toBe("FORBIDDEN");
  });

  it("DELETE /api/v1/devices/:id rejects non-admin users with 403", async () => {
    const res = await app.request("/api/v1/devices/WS-GRT-001", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${viewerToken}`,
      },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.code).toBe("FORBIDDEN");
  });
});
