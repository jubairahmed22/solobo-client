import axios from "axios";
import type { ApiResponse } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:50001";

/**
 * Auth-flow endpoints that DON'T require a session (register, OTP, password reset).
 * Intentionally uses a fresh axios instance so we don't accidentally attach a stale token.
 */
const authClient = axios.create({
  baseURL: `${API_URL}/api/auth`,
  withCredentials: true,
  timeout: 15_000,
});

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  try {
    const res = await promise;
    if (res.data.success) return res.data.data;
    throw new AuthError(res.data.message, res.data.code ?? "ERROR", res.data.errors);
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data) {
      const body = err.response.data as { message?: string; code?: string; errors?: unknown };
      throw new AuthError(
        body.message ?? "Request failed",
        body.code ?? "ERROR",
        body.errors as { path: string; message: string }[] | undefined,
      );
    }
    throw err;
  }
}

export class AuthError extends Error {
  code: string;
  fieldErrors?: Array<{ path: string; message: string }>;
  constructor(message: string, code: string, fieldErrors?: Array<{ path: string; message: string }>) {
    super(message);
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

/* ───────────────────────── Calls ───────────────────────── */

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export const authApi = {
  register: (payload: RegisterPayload) =>
    unwrap<{ message: string; email: string }>(authClient.post("/register", payload)),

  requestOtp: (email: string) =>
    unwrap<{ message: string }>(authClient.post("/request-otp", { email })),

  verifyOtp: (email: string, code: string) =>
    unwrap<{
      accessToken: string;
      user: { id: string; email: string; name: string; role: "user" | "admin" | "superadmin" };
      expiresIn: string;
    }>(authClient.post("/verify-otp", { email, code })),

  forgotPassword: (email: string) =>
    unwrap<{ message: string }>(authClient.post("/forgot-password", { email })),

  resetPassword: (token: string, password: string) =>
    unwrap<{ message: string }>(authClient.post("/reset-password", { token, password })),

  logout: () => unwrap<{ message: string }>(authClient.post("/logout")),
};
