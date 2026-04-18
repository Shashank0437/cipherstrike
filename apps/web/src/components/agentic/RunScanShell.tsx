"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import {
  deleteChatThread,
  loadChatThreads,
  upsertChatThread,
  type RunScanChatThread,
} from "@/lib/run-scan-threads";

function formatShortDate(ts: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(ts));
  } catch {
    return "";
  }
}

export function RunScanShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [threads, setThreads] = useState<RunScanChatThread[]>([]);
  const lastSyncedThread = useRef<string | null>(null);

  const refreshThreads = useCallback(() => {
    setThreads(loadChatThreads());
  }, []);

  useEffect(() => {
    refreshThreads();
  }, [pathname, searchParams, refreshThreads]);

  useEffect(() => {
    const onThreads = () => refreshThreads();
    window.addEventListener("hex-threads-changed", onThreads);
    return () => window.removeEventListener("hex-threads-changed", onThreads);
  }, [refreshThreads]);

  const chatThreadId = pathname === "/run-scan/chat" ? searchParams.get("t") : null;

  useEffect(() => {
    if (pathname !== "/run-scan/chat") {
      lastSyncedThread.current = null;
      return;
    }
    if (!chatThreadId) {
      router.replace(`/run-scan/chat?t=${crypto.randomUUID()}`);
      return;
    }
    if (lastSyncedThread.current !== chatThreadId) {
      lastSyncedThread.current = chatThreadId;
      upsertChatThread(chatThreadId);
      setThreads(loadChatThreads());
    }
  }, [pathname, chatThreadId, router]);

  const activeThreadId = chatThreadId;

  const startNewChat = useCallback(() => {
    lastSyncedThread.current = null;
    const id = crypto.randomUUID();
    router.push(`/run-scan/chat?t=${encodeURIComponent(id)}`);
  }, [router]);

  const removeThread = useCallback(
    (threadId: string, e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      deleteChatThread(threadId);
      refreshThreads();
      window.dispatchEvent(new Event("hex-threads-changed"));
      if (activeThreadId === threadId) {
        lastSyncedThread.current = null;
        const next = loadChatThreads()[0];
        if (next) {
          router.replace(`/run-scan/chat?t=${encodeURIComponent(next.id)}`);
        } else {
          router.replace("/run-scan");
        }
      }
    },
    [activeThreadId, refreshThreads, router],
  );

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background font-sans text-on-surface">
      <aside className="flex w-64 min-w-64 shrink-0 flex-col border-r border-outline-variant bg-surface-container-low">
        <div className="shrink-0 p-4">
          <Link
            href="/history"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-xl leading-none">arrow_back</span>
            Go to Dashboard
          </Link>
        </div>

        <div className="flex min-h-0 flex-1 flex-col border-t border-outline-variant px-3 pt-4">
          <p className="shrink-0 px-1 text-xs font-bold uppercase tracking-widest text-primary">Recent chats</p>
          <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto px-0.5 pb-3">
            {threads.length === 0 ? (
              <p className="px-1 text-xs leading-relaxed text-on-surface-variant">
                No chats yet. Start with <span className="font-semibold text-on-surface">New chat</span> below.
              </p>
            ) : (
              threads.map((th) => {
                const active = activeThreadId === th.id;
                return (
                  <div
                    key={th.id}
                    className={
                      active
                        ? "group flex items-stretch gap-0.5 rounded-lg border border-outline-variant/60 bg-primary-container/50 py-1 pl-2 pr-1 shadow-sm"
                        : "group flex items-stretch gap-0.5 rounded-lg border border-transparent py-1 pl-2 pr-1 hover:border-outline-variant/40 hover:bg-surface-container"
                    }
                  >
                    <Link
                      href={`/run-scan/chat?t=${encodeURIComponent(th.id)}`}
                      className={
                        active
                          ? "min-w-0 flex-1 rounded-md py-2 pl-1.5 pr-1 text-left text-sm font-semibold text-on-primary-container transition-colors"
                          : "min-w-0 flex-1 rounded-md py-2 pl-1.5 pr-1 text-left text-sm text-on-surface-variant transition-colors group-hover:text-on-surface"
                      }
                    >
                      <span className="line-clamp-2">{th.title}</span>
                      <span
                        className={
                          active
                            ? "mt-0.5 block text-[10px] font-medium text-on-primary-container/80"
                            : "mt-0.5 block text-[10px] font-medium text-outline group-hover:text-on-surface-variant"
                        }
                      >
                        {formatShortDate(th.updatedAt)}
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={(e) => removeThread(th.id, e)}
                      className={
                        active
                          ? "flex shrink-0 items-center justify-center self-center rounded-md p-1.5 text-on-primary-container/70 transition hover:bg-primary/15 hover:text-on-primary-container"
                          : "flex shrink-0 items-center justify-center self-center rounded-md p-1.5 text-on-surface-variant/70 transition hover:bg-surface-container-high hover:text-error"
                      }
                      title="Delete chat"
                      aria-label={`Delete chat: ${th.title}`}
                    >
                      <span className="material-symbols-outlined text-lg leading-none">delete</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-outline-variant p-3">
          <button
            type="button"
            onClick={startNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-bold text-on-primary shadow-sm transition hover:opacity-90 active:scale-[0.99]"
          >
            <span className="material-symbols-outlined text-base">edit_square</span>
            New chat
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
