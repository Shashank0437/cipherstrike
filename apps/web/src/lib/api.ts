import { getApiBase } from "./env";

const TOKEN_KEY = "cipherstrike_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(
  path: string,
  opts?: RequestInit & { json?: unknown },
): Promise<T> {
  const headers = new Headers(opts?.headers);
  if (!headers.has("Content-Type") && opts?.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  const token = typeof window !== "undefined" ? getToken() : null;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const { json, ...rest } = opts ?? {};
  const res = await fetch(`${getApiBase()}${path}`, {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = res.statusText || "Request failed";
    try {
      const j = JSON.parse(text) as { detail?: unknown };
      if (typeof j.detail === "string") msg = j.detail;
      else if (Array.isArray(j.detail)) msg = JSON.stringify(j.detail);
    } catch {
      /* keep msg */
    }
    throw new ApiError(msg, res.status, text);
  }
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/** Prefer server-suggested download name (e.g. sample penetration report PDF). */
export function filenameFromContentDisposition(res: Response, fallback: string): string {
  const cd = res.headers.get("Content-Disposition");
  if (!cd) return fallback;
  const utf = /filename\*=UTF-8''([^;\s]+)/i.exec(cd);
  if (utf) {
    try {
      return decodeURIComponent(utf[1].trim());
    } catch {
      /* fall through */
    }
  }
  const quoted = /filename="([^"]+)"/i.exec(cd);
  if (quoted) return quoted[1];
  const plain = /filename=([^;\s]+)/i.exec(cd);
  if (plain) return plain[1].replace(/^"|"$/g, "").trim();
  return fallback;
}

/** GET with auth, returns raw Response (e.g. for PDF). Caller checks res.ok. */
/** Authenticated GET that saves a binary (e.g. PDF) using Content-Disposition filename when present. */
export async function downloadAuthenticatedBlob(
  path: string,
  fallbackFilename: string,
): Promise<void> {
  const res = await apiRaw(path);
  if (!res.ok) {
    const t = await res.text();
    throw new ApiError(t || "Download failed", res.status, t);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filenameFromContentDisposition(res, fallbackFilename);
  a.click();
  URL.revokeObjectURL(url);
}

export async function apiRaw(path: string, opts?: RequestInit): Promise<Response> {
  const headers = new Headers(opts?.headers);
  const token = typeof window !== "undefined" ? getToken() : null;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(`${getApiBase()}${path}`, { ...opts, headers });
}
