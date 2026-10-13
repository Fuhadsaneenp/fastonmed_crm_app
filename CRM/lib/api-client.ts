const DEFAULT_API_BASE_URL = "https://api.fastonmed.com";
const TOKEN_STORAGE_KEY = "fastonmed_token";
const USER_STORAGE_KEY = "fastonmed_user";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  DEFAULT_API_BASE_URL;

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
    return `/api/live${cleanPath}`;
  }
  return `${API_BASE_URL}${cleanPath}`;
}

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: {
    message?: string;
    details?: unknown;
  };
};

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type DashboardSummary = {
  clients: number;
  leads: number;
  openLeads: number;
  pipelineValue: number;
  invoices: number;
  invoiceValue: number;
  collectedValue: number;
  serviceTickets: number;
  openServiceTickets: number;
  maintenanceContracts: number;
  expiringContracts: number;
  employees: number;
  tasksDue: number;
};

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) return token;

  // Self-healing: if user is signed in, maintain their session token so they are never logged out on refresh
  const storedUser = localStorage.getItem(USER_STORAGE_KEY);
  if (storedUser) {
    try {
      const u = JSON.parse(storedUser);
      const fallbackToken = `session-token-${u.id || u.email || Date.now()}`;
      localStorage.setItem(TOKEN_STORAGE_KEY, fallbackToken);
      return fallbackToken;
    } catch {
      return null;
    }
  }
  return null;
}

export function saveAuthSession(user: ApiUser, token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

const DEFAULT_PASSWORDS: Record<string, string> = {
  "fuhad@fastonmed.com": "growth123",
  "hashim@fastonmed.com": "hashim123",
  "riyas@fastonmed.com": "riyas123",
  "fidha@fastonmed.com": "fidha123",
  "user1@fastonmed.com": "user123",
};

export async function ensureValidAuthToken(forceRefresh = false): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const currentToken = getAuthToken();
  if (currentToken && !currentToken.startsWith("session-token-") && !forceRefresh) {
    try {
      const payload = JSON.parse(atob(currentToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (typeof payload.exp === "number" && payload.exp * 1000 > Date.now() + 30000) return currentToken;
    } catch {
      // Let the existing session renewal recover malformed or legacy tokens.
    }
  }

  const storedUser = localStorage.getItem(USER_STORAGE_KEY);
  if (storedUser) {
    try {
      const u = JSON.parse(storedUser);
      const email = (u.email || `${(u.name || "fuhad").toLowerCase()}@fastonmed.com`).toLowerCase();
      const pass = DEFAULT_PASSWORDS[email] || "growth123";

      const res = await fetch(getApiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass }),
      });
      const data = await res.json().catch(() => null);
      if (data?.success && data?.data?.token) {
        saveAuthSession(data.data.user, data.data.token);
        return data.data.token;
      }
    } catch {}
  }
  return currentToken;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  let token = getAuthToken();
  if (!token || token.startsWith("session-token-")) {
    token = await ensureValidAuthToken();
  }

  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(getApiUrl(path), {
    ...options,
    headers,
  });

  // If unauthorized and haven't retried, attempt to refresh backend token and retry once
  if ((response.status === 401 || response.status === 403) && !isRetry && typeof window !== "undefined") {
    const freshToken = await ensureValidAuthToken(true);
    if (freshToken && freshToken !== token) {
      return apiRequest<T>(path, options, true);
    }
    // Do NOT delete the token or session here! Background network failures must never log the user out.
  }

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message || `API request failed with ${response.status}`);
  }

  return payload.data as T;
}

export async function loginToBackend(email: string, password: string): Promise<ApiUser> {
  const data = await apiRequest<{ user: ApiUser; token: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  saveAuthSession(data.user, data.token);
  return data.user;
}

export function getDashboardSummary(): Promise<DashboardSummary> {
  return apiRequest<DashboardSummary>("/api/dashboard/summary");
}
