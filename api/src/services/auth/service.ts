import { sign } from "hono/jwt";
import { eq } from "drizzle-orm";
import { BaseService } from "../base.service";
import { db } from "../../db";
import { users } from "../../db/schema";
import type { LoginDto, AuthUserPayload } from "./dto";

export const JWT_SECRET = process.env.JWT_SECRET || "iot-weather-station-secret-jwt-key";

export class AuthService extends BaseService {
  async login(dto: LoginDto) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, dto.email),
    });

    if (!user) {
      this.unauthorized("INVALID_CREDENTIALS", "Invalid email or password");
    }

    const isMatch = await Bun.password.verify(dto.password, user.passwordHash);
    if (!isMatch) {
      this.unauthorized("INVALID_CREDENTIALS", "Invalid email or password");
    }

    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7; // 7 days
    const payload: AuthUserPayload & { exp: number } = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      exp,
    };

    const token = await sign(payload, JWT_SECRET, "HS256");

    return this.success({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  }

  async getProfile(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      this.notFound("USER_NOT_FOUND", "User not found");
    }

    return this.success(user);
  }
}

export const authService = new AuthService();
