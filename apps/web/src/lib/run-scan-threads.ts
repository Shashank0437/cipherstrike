const STORAGE_KEY = "hex-run-scan-chat-threads-v1";

export type RunScanChatThread = {
  id: string;
  title: string;
  updatedAt: number;
};

export function loadChatThreads(): RunScanChatThread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is RunScanChatThread =>
          typeof x === "object" &&
          x !== null &&
          typeof (x as RunScanChatThread).id === "string" &&
          typeof (x as RunScanChatThread).title === "string" &&
          typeof (x as RunScanChatThread).updatedAt === "number",
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function persist(threads: RunScanChatThread[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(threads.slice(0, 40)));
}

/** Creates or bumps a chat thread (used when opening /run-scan/chat?t=…). */
export function upsertChatThread(threadId: string): void {
  if (typeof window === "undefined") return;
  const all = loadChatThreads();
  const prev = all.find((t) => t.id === threadId);
  const rest = all.filter((t) => t.id !== threadId);
  rest.unshift({
    id: threadId,
    title: prev?.title ?? "New chat",
    updatedAt: Date.now(),
  });
  persist(rest);
}

export function renameChatThread(threadId: string, title: string): void {
  if (typeof window === "undefined") return;
  const threads = loadChatThreads().map((t) =>
    t.id === threadId ? { ...t, title: title.trim() || t.title, updatedAt: Date.now() } : t,
  );
  persist(threads);
}

const CHAT_UI_PREFIX = "hex-chat-ui-";

/** Removes a thread and its session transcript. */
export function deleteChatThread(threadId: string): void {
  if (typeof window === "undefined") return;
  const threads = loadChatThreads().filter((t) => t.id !== threadId);
  persist(threads);
  try {
    window.sessionStorage.removeItem(CHAT_UI_PREFIX + threadId);
  } catch {
    /* ignore */
  }
}
