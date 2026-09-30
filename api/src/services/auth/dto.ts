import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginDto = z.infer<typeof loginSchema>;

export interface AuthUserPayload {
  id: string;
  name: string;
  email: string;
  role: "admin" | "operator" | "viewer";
  [key: string]: unknown;
}

export interface JwtCustomPayload extends AuthUserPayload {
  exp: number;
}
