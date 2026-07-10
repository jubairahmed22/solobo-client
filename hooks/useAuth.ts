"use client";

import { useSession } from "next-auth/react";

type Role = "user" | "admin" | "superadmin";

export interface UseAuthValue {
  status: "loading" | "authenticated" | "unauthenticated";
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    role: Role;
  } | null;
  isAuthed: boolean;
  hasRole: (...roles: Role[]) => boolean;
}

export function useAuth(): UseAuthValue {
  const { data: session, status } = useSession();
  const user =
    session?.user && session.user.id
      ? {
          id: session.user.id,
          email: session.user.email ?? "",
          name: session.user.name ?? null,
          image: session.user.image ?? null,
          role: session.user.role,
        }
      : null;

  return {
    status,
    user,
    isAuthed: Boolean(user),
    hasRole: (...roles: Role[]) => Boolean(user && roles.includes(user.role)),
  };
}
