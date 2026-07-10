import NextAuth, { type DefaultSession } from "next-auth";
import type { JWT as DefaultJWT } from "@auth/core/jwt";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import { z } from "zod";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:50001";
const OAUTH_BRIDGE_SECRET = process.env.OAUTH_BRIDGE_SECRET ?? "";

type Role = "user" | "admin" | "superadmin";

interface BackendAuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatar?: string;
}

interface BackendAuthResponse {
  success: true;
  data: {
    accessToken: string;
    user: BackendAuthUser;
    expiresIn: string;
  };
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Talks to the Express backend. The backend is the source of truth for users,
 * tokens, and roles - NextAuth just stores the result of those calls.
 */
async function callBackendLogin(email: string, password: string): Promise<BackendAuthResponse["data"] | null> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as BackendAuthResponse;
  return json.success ? json.data : null;
}

async function callBackendOauth(input: {
  provider: "google" | "facebook";
  email: string;
  name: string;
  avatar?: string;
  providerId: string;
}): Promise<BackendAuthResponse["data"] | null> {
  const res = await fetch(`${API_URL}/api/auth/oauth-callback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-OAuth-Secret": OAUTH_BRIDGE_SECRET,
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as BackendAuthResponse;
  return json.success ? json.data : null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const data = await callBackendLogin(parsed.data.email, parsed.data.password);
        if (!data) return null;
        // Surfaced in the jwt() callback as `user`.
        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          image: data.user.avatar,
          role: data.user.role,
          accessToken: data.accessToken,
        } as unknown as { id: string };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: false,
          }),
        ]
      : []),
    ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
      ? [
          Facebook({
            clientId: process.env.FACEBOOK_CLIENT_ID,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    /**
     * For OAuth providers: bridge to backend so the user record + tokens come from us.
     * If the backend call fails, signIn returns false and the user gets bounced to /login?error=.
     */
    async signIn({ user, account, profile }) {
      if (account?.provider === "credentials") return true;
      if (account?.provider === "google" || account?.provider === "facebook") {
        const data = await callBackendOauth({
          provider: account.provider,
          email: (user.email ?? "").toLowerCase(),
          name: user.name ?? (profile as { name?: string } | undefined)?.name ?? "User",
          avatar: user.image ?? undefined,
          providerId: account.providerAccountId,
        });
        if (!data) return false;
        // Stash backend data on `user` so jwt() can pick it up.
        (user as unknown as { role: Role; accessToken: string }).role = data.user.role;
        (user as unknown as { role: Role; accessToken: string }).accessToken = data.accessToken;
        return true;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as { id: string; role: Role; accessToken: string };
        token.id = u.id;
        token.role = u.role;
        token.accessToken = u.accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? "";
        session.user.role = (token.role as Role) ?? "user";
      }
      session.accessToken = (token.accessToken as string) ?? "";
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    accessToken: string;
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    role?: Role;
    accessToken?: string;
  }
}
