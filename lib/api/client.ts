import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { getSession, signOut } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:50001";

/**
 * Singleton axios instance.
 * - Pulls the access token from the NextAuth session before each request, but
 *   prefers an in-memory token if /api/auth/refresh rotated one within this
 *   tab - NextAuth's signed JWT can't be mutated client-side, so without this
 *   override the next request would re-send the stale session token and the
 *   backend would 401 again.
 * - On 401, calls /api/auth/refresh ONCE; on success, retries the original
 *   request and caches the fresh access token for subsequent calls.
 * - On a refresh that itself returns 401/4xx, signs the user out so the
 *   "frontend says authed, backend says expired" zombie state can't strand
 *   the buyer on checkout with an unhelpful 401.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

/**
 * Latest access token seen on this tab. Set by a successful refresh, cleared
 * when the user is signed out. Lives in module scope so every consumer of
 * `apiClient` picks it up automatically without prop-drilling.
 */
let inMemoryAccessToken: string | null = null;
let signOutScheduled = false;

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (typeof window !== "undefined") {
      let token = inMemoryAccessToken;
      if (!token) {
        const session = await getSession();
        token = session?.accessToken ?? null;
      }
      if (token) config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

let refreshPromise: Promise<string | null> | null = null;

async function attemptRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await axios.post(
          `${API_URL}/api/auth/refresh`,
          {},
          { withCredentials: true, timeout: 10_000 },
        );
        const token = res.data?.data?.accessToken as string | undefined;
        if (token) {
          inMemoryAccessToken = token;
          return token;
        }
        return null;
      } catch {
        return null;
      } finally {
        // allow another refresh after this one settles
        setTimeout(() => {
          refreshPromise = null;
        }, 0);
      }
    })();
  }
  return refreshPromise;
}

/**
 * Tear down the in-memory token and force NextAuth to drop its session, then
 * bounce the user to /login with a return URL. Guarded so concurrent 401s
 * don't fire signOut() multiple times in the same tab.
 */
function forceSignOut() {
  if (signOutScheduled) return;
  signOutScheduled = true;
  inMemoryAccessToken = null;
  if (typeof window === "undefined") return;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  // signOut() is async - kick it off, let NextAuth do the redirect.
  void signOut({ callbackUrl: `/login?next=${next}` });
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error.response?.status as number | undefined;
    const url = (original?.url ?? "") as string;

    // Auth endpoints handle their own errors - never try to refresh on them.
    const isAuthEndpoint = url.includes("/auth/");

    if (status === 401 && original && !original._retried && !isAuthEndpoint) {
      original._retried = true;
      const fresh = await attemptRefresh();
      if (fresh) {
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${fresh}`;
        return apiClient(original);
      }
      // Refresh itself failed - the backend session is gone. Sign the user
      // out so the next interaction lands them on /login instead of looping
      // on dead tokens.
      forceSignOut();
    }
    return Promise.reject(error);
  },
);
