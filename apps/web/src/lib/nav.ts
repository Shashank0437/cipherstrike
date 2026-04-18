/**
 * Use only in-browser redirects. Rejects absolute URLs and protocol-relative
 * links so ?next= is not an open redirect.
 */
export function safeInternalPath(value: string | null, fallback: string): string {
  if (typeof value !== "string" || !value) {
    return fallback;
  }
  const t = value.trim();
  if (!t.startsWith("/") || t.startsWith("//") || t.includes("://") || t.includes("..")) {
    return fallback;
  }
  return t;
}
