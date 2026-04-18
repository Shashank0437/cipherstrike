"use client";

import type { SessionTerminalLogLine } from "./session-types";

const border = "#e4e2ef";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  lines: SessionTerminalLogLine[];
  loading: boolean;
};

export function SessionTerminalModal({ open, onClose, title, lines, loading }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Session terminal logs"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/45"
        onClick={onClose}
        aria-label="Close"
      />
      <div
        className="relative z-10 flex h-[min(100dvh,32rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-lg"
        style={{ borderColor: border, background: "#0a0a0c" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between border-b border-[#2a2a2e] px-4 py-2.5"
          style={{ background: "#111116" }}
        >
          <span className="font-mono text-xs text-emerald-400/90">terminal — {title}</span>
          <button
            type="button"
            onClick={onClose}
            className="text-lg leading-none text-zinc-400 hover:text-zinc-200"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 font-mono text-[0.7rem] leading-relaxed text-emerald-200/90">
          {loading ? (
            <p className="text-zinc-500">Loading log stream…</p>
          ) : (
            <ul className="space-y-0.5">
              {lines.map((ln, i) => (
                <li key={i} className="whitespace-pre-wrap break-all">
                  <span className="text-zinc-500">{ln.time}</span>{" "}
                  <span className="text-emerald-300/95">{ln.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
