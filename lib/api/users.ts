import axios from "axios";
import { apiClient } from "./client";
import type { ApiResponse } from "@/types/api";
import type { Role } from "@/types/api";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatar?: string;
  phone?: string;
}

export interface UpdateProfileInput {
  name?: string;
  phone?: string;
  avatar?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export class UsersError extends Error {
  code: string;
  fieldErrors?: Array<{ path: string; message: string }>;
  constructor(message: string, code: string, fieldErrors?: Array<{ path: string; message: string }>) {
    super(message);
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  try {
    const res = await promise;
    if (res.data.success) return res.data.data;
    throw new UsersError(res.data.message, res.data.code ?? "ERROR", res.data.errors);
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data) {
      const body = err.response.data as { message?: string; code?: string; errors?: unknown };
      throw new UsersError(
        body.message ?? "Request failed",
        body.code ?? "ERROR",
        body.errors as { path: string; message: string }[] | undefined,
      );
    }
    throw err;
  }
}

/**
 * /api/users/me - currently returns { user, coins }. Both are included so the
 * profile page can show the current loyalty balance alongside the editable
 * fields without a second fetch.
 */
export const usersApi = {
  getMe: () =>
    unwrap<{ user: AuthUser; coins: number }>(apiClient.get("/users/me")),

  updateProfile: (input: UpdateProfileInput) =>
    unwrap<{ user: AuthUser; phone?: string }>(apiClient.patch("/users/me", input)),

  changePassword: (input: ChangePasswordInput) =>
    unwrap<{ message: string }>(apiClient.post("/users/me/change-password", input)),
};
