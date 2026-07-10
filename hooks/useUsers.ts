"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  usersApi,
  type UpdateProfileInput,
  type ChangePasswordInput,
} from "@/lib/api/users";

export const usersKeys = {
  me: ["users", "me"] as const,
};

export function useMe(enabled = true) {
  return useQuery({
    queryKey: usersKeys.me,
    queryFn: usersApi.getMe,
    enabled,
    staleTime: 30_000,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => usersApi.updateProfile(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: usersKeys.me });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => usersApi.changePassword(input),
  });
}
