"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@iconify/react";
import { RunResultSummary } from "@/components/RunResultSummary";
import { ExecutionFields, primary } from "./ExecutionFields";
import type { ToolFlagT } from "./ExecutionFields";

const border = "#e4e2ef";
const onSurface = "#30323e";
const onVariant = "#5d5e6c";
const surface = "#ffffff";

type Tool = {
  id: string;
  name: string;
  icon: string;
  flags: ToolFlagT[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  tool: Tool | null;
  target: string;
  onTargetChange: (v: string) => void;
  flagValues: Record<string, boolean>;
  onFlagToggle: (id: string) => void;
  extraArgs: string;
  onExtraArgsChange: (v: string) => void;
  commandPreview: string;
  previewLoading: boolean;
  onExecute: () => void;
  executing: boolean;
  lastResultJson: unknown;
  error: string | null;
};

export function RunToolModal({
  open,
  onClose,
  tool,
  target,
  onTargetChange,
  flagValues,
  onFlagToggle,
  extraArgs,
  onExtraArgsChange,
  commandPreview,
  previewLoading,
  onExecute,
  executing,
  lastResultJson,
  error,
}: Props) {
  const resultBlockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && lastResultJson != null) {
      resultBlockRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [open, lastResultJson]);

  if (!open || !tool) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="run-tool-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/40"
        onClick={onClose}
        aria-label="Close"
      />
      <div
        className="relative z-10 flex h-[min(100dvh,44rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border shadow-lg"
        style={{ background: surface, borderColor: border }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex shrink-0 items-center justify-between border-b px-4 py-3"
          style={{ borderColor: border, background: "#fbf8ff" }}
        >
          <h2
            id="run-tool-modal-title"
            className="text-sm font-bold"
            style={{ color: onSurface }}
          >
            Run {tool.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-2xl leading-none hover:opacity-80"
            style={{ color: onVariant }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div
          className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4"
          data-run-modal-body
        >
          <p className="text-xs" style={{ color: onVariant }}>
            Set the target, execution flags, and optional extra CLI. Execute uses the same job as the configuration
            panel on the right.
          </p>

          <div className="text-xs font-medium" style={{ color: onSurface }}>
            Command preview
          </div>
          <pre
            className="min-h-14 max-h-24 overflow-x-auto overflow-y-auto rounded-lg p-2.5 font-mono text-xs leading-relaxed"
            style={{
              background: "#0a0a0c",
              color: "#4ade80",
              fontFamily: "var(--font-geist-mono),Consolas,monospace",
            }}
          >
            {previewLoading
              ? "Composing…"
              : commandPreview || "Set a target to preview the full command string."}
          </pre>

          <ExecutionFields
            tool={tool as Tool & { name: string }}
            showHeader
            target={target}
            onTargetChange={onTargetChange}
            flagValues={flagValues}
            onFlagToggle={onFlagToggle}
            extraArgs={extraArgs}
            onExtraArgsChange={onExtraArgsChange}
          />

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          {lastResultJson != null && (
            <div ref={resultBlockRef}>
              <div className="mb-1.5 text-xs font-semibold" style={{ color: onSurface }}>
                Result
              </div>
              <RunResultSummary data={lastResultJson} unbounded />
            </div>
          )}
        </div>
        <div
          className="shrink-0 border-t px-4 py-3"
          style={{ borderColor: border, background: surface }}
        >
          <button
            type="button"
            onClick={onExecute}
            disabled={executing || !target.trim() || !commandPreview}
            className="flex w-full min-h-12 items-center justify-center gap-1.5 rounded-lg text-sm font-bold text-white enabled:hover:opacity-90 disabled:opacity-50"
            style={{ background: primary }}
          >
            <Icon
              icon="material-symbols:terminal"
              className="h-4 w-4"
              style={{ minWidth: 16, minHeight: 16 }}
              width={16}
              height={16}
              aria-hidden
            />
            {executing ? "…" : "Execute"}
          </button>
        </div>
      </div>
    </div>
  );
}
