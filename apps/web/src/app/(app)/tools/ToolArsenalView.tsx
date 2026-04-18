"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Icon } from "@iconify/react";
import { ArsenalToolIcon } from "@/components/ArsenalIcon";
import { loadToolConfig, saveToolConfig } from "@/lib/tool-arsenal-config";
import { RunResultSummary } from "@/components/RunResultSummary";
import { ExecutionFields } from "./ExecutionFields";
import { RunToolModal } from "./RunToolModal";

type ToolFlag = {
  id: string;
  label: string;
  cli: string;
  default_on: boolean;
  required?: boolean;
};

type Tool = {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  icon: string;
  tags: string[];
  filter_tags: string[];
  integrated: boolean;
  command_binary: string;
  flags: ToolFlag[];
};

type LogLine = { time: string; message: string };

const FILTER_TABS: { id: "all" | "recon" | "network" | "web" | "binary" | "osint"; label: string }[] = [
  { id: "all", label: "All Tools" },
  { id: "recon", label: "Recon" },
  { id: "network", label: "Network" },
  { id: "web", label: "Web" },
  { id: "binary", label: "Binary" },
  { id: "osint", label: "OSINT" },
];

const DEFAULT_TARGET = "192.168.1.0/24";
const SQLMAP_DEFAULT = "https://192.168.1.1/login?id=1";

function defaultTargetFor(t: Tool): string {
  return t.id === "sqlmap" ? SQLMAP_DEFAULT : DEFAULT_TARGET;
}

function defaultFlags(t: Tool | null): Record<string, boolean> {
  if (!t) return {};
  return Object.fromEntries(t.flags.map((f) => [f.id, f.default_on]));
}

export function ToolArsenalView() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<(typeof FILTER_TABS)[number]["id"]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const [flagValues, setFlagValues] = useState<Record<string, boolean>>({});
  const [extraArgs, setExtraArgs] = useState("");
  const [commandPreview, setCommandPreview] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executeMsg, setExecuteMsg] = useState<string | null>(null);
  const [lastResultJson, setLastResultJson] = useState<unknown | null>(null);
  const [recentLogs, setRecentLogs] = useState<LogLine[]>([]);
  const [sideError, setSideError] = useState<string | null>(null);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [configToast, setConfigToast] = useState<string | null>(null);

  useEffect(() => {
    setLoadError(false);
    void api<Tool[]>("/tools")
      .then((list) => {
        setTools(list);
        if (list.length) {
          setSelectedId((prev) => {
            if (prev && list.some((t) => t.id === prev)) {
              return prev;
            }
            return (list.find((x) => x.id === "nmap") ?? list[0]).id;
          });
        }
      })
      .catch(() => {
        setLoadError(true);
        setTools([]);
      });
  }, []);

  const selected = useMemo(
    () => (selectedId ? (tools.find((t) => t.id === selectedId) ?? null) : null),
    [tools, selectedId],
  );

  useEffect(() => {
    const t = tools.find((x) => x.id === selectedId);
    if (!t) return;
    const saved = loadToolConfig(t.id);
    setTarget(saved?.target ?? defaultTargetFor(t));
    setFlagValues({ ...defaultFlags(t), ...(saved?.flagValues ?? {}) });
    setExtraArgs(saved?.extraArgs ?? "");
    setLastResultJson(null);
    setSideError(null);
  }, [selectedId, tools]);

  const onFlagToggle = useCallback(
    (id: string) => {
      if (!selected) return;
      const f = selected.flags.find((x) => x.id === id);
      if (!f) return;
      setFlagValues((prev) => ({
        ...prev,
        [id]: !(prev[id] ?? f.default_on),
      }));
    },
    [selected],
  );

  const saveCurrentConfig = useCallback(() => {
    if (!selected) return;
    saveToolConfig(selected.id, {
      target: target.trim() || defaultTargetFor(selected),
      flagValues: { ...flagValues },
      extraArgs,
    });
    setConfigToast("Configuration saved in this browser.");
    window.setTimeout(() => setConfigToast(null), 3000);
  }, [selected, target, flagValues, extraArgs]);

  const fetchPreview = useCallback(async () => {
    if (!selected || !target.trim()) {
      setCommandPreview("");
      return;
    }
    setPreviewLoading(true);
    setSideError(null);
    try {
      const { command } = await api<{ command: string }>("/tools/preview", {
        method: "POST",
        json: {
          tool_id: selected.id,
          target: target.trim(),
          flag_values: flagValues,
          extra_args: extraArgs,
        },
      });
      setCommandPreview(command);
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        setCommandPreview("");
        setSideError(e.message);
        return;
      }
      setSideError("Could not refresh command preview");
    } finally {
      setPreviewLoading(false);
    }
  }, [selected, target, flagValues, extraArgs]);

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchPreview();
    }, 300);
    return () => clearTimeout(t);
  }, [fetchPreview]);

  const runExecute = useCallback(async () => {
    if (!selected) return;
    setExecuting(true);
    setExecuteMsg(null);
    setSideError(null);
    try {
      const res = await api<{
        message: string;
        recent_logs: LogLine[];
        result_json: unknown;
      }>("/tools/execute", {
        method: "POST",
        json: {
          tool_id: selected.id,
          target: target.trim(),
          flag_values: flagValues,
          extra_args: extraArgs,
        },
      });
      setExecuteMsg(res.message);
      if (res.recent_logs) setRecentLogs(res.recent_logs);
      if (res.result_json !== undefined) setLastResultJson(res.result_json);
    } catch (e) {
      if (e instanceof ApiError) {
        setSideError(e.message);
      } else {
        setSideError("Execute failed. Check the target and try again.");
      }
    } finally {
      setExecuting(false);
    }
  }, [selected, target, flagValues, extraArgs]);

  async function copyCommand() {
    if (typeof navigator !== "undefined" && commandPreview) {
      try {
        await navigator.clipboard.writeText(commandPreview);
        setConfigToast("Command copied.");
        window.setTimeout(() => setConfigToast(null), 2000);
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div className="min-h-0 space-y-6 bg-background font-sans text-on-surface">
      <div className="sticky top-0 z-20 -mx-6 -mt-1 border-b border-outline-variant bg-surface-container-lowest px-6 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h1 className="shrink-0 text-2xl font-bold tracking-tight text-primary">Tool Arsenal</h1>
          <div className="flex w-full min-w-0 sm:max-w-md sm:flex-1 sm:justify-end" style={{ maxWidth: "min(100%, 28rem)" }}>
            <div className="flex w-full min-w-0 items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-3 py-2">
              <Icon
                icon="material-symbols:search"
                className="h-5 w-5 shrink-0 text-on-surface-variant opacity-60"
                width={20}
                height={20}
                aria-hidden
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-on-surface outline-none placeholder:text-outline"
                placeholder="Search arsenal (e.g. nmap, recon…)"
                type="search"
                aria-label="Search tools"
              />
            </div>
          </div>
        </div>
      </div>

      {loadError && (
        <p className="text-sm text-red-600" role="alert">
          Could not load the arsenal. Ensure the API is up and you are signed in.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((ft) => {
          const on = filterTab === ft.id;
          return (
            <button
              key={ft.id}
              type="button"
              onClick={() => setFilterTab(ft.id)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                on
                  ? "border-primary bg-primary text-on-primary shadow-[0_1px_2px_rgba(104,76,182,0.2)]"
                  : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {ft.label}
            </button>
          );
        })}
      </div>

      {configToast && (
        <p className="text-sm text-emerald-800" role="status">
          {configToast}
        </p>
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filteredList(tools, search, filterTab).map((t) => {
              const isSel = selectedId === t.id;
              return (
                <div
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedId(t.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedId(t.id);
                    }
                  }}
                  className="w-full cursor-pointer text-left"
                >
                  <div
                    className={`flex h-full flex-col rounded-2xl border-2 bg-surface-container-lowest p-4 transition-all ${
                      isSel
                        ? "border-primary shadow-[0_0_0_1px_rgba(104,76,182,0.1)]"
                        : "border-outline-variant shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container/60">
                        <ArsenalToolIcon name={t.icon} className="text-primary" size={24} />
                      </div>
                      <span className="text-xs text-on-surface-variant">{t.version}</span>
                    </div>
                    <h3 className="text-base font-bold text-on-surface">{t.name}</h3>
                    <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-on-surface-variant">
                      {t.description}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {t.tags?.map((g) => (
                        <span
                          key={g}
                          className="rounded-md bg-primary-container/50 px-1.5 py-0.5 text-[0.65rem] font-medium text-on-primary-container"
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(t.id);
                          setRunModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-on-surface px-3 py-1.5 text-xs font-semibold text-surface-container-lowest"
                      >
                        <Icon
                          icon="material-symbols:play-arrow"
                          className="h-3.5 w-3.5 text-surface-container-lowest"
                          width={14}
                          height={14}
                          aria-hidden
                        />
                        Run
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredList(tools, search, filterTab).length === 0 && !loadError && (
              <p className="col-span-full text-center text-sm text-on-surface-variant">
                No tools match this view.
              </p>
            )}
          </div>
        </div>

        <aside
          className="w-full shrink-0 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm lg:sticky lg:top-4 lg:max-w-[24rem] lg:min-w-[20rem] xl:max-w-[28rem] xl:min-w-[24rem]"
          style={{ maxHeight: "min(100vh-8rem, 100%)" }}
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-extrabold tracking-[0.2em] uppercase text-on-surface-variant">
              Configuration
            </span>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Ready
            </div>
          </div>

          {selected ? (
            <div>
              <div className="mb-1 text-sm font-medium text-on-surface">Command preview</div>
              <pre
                className="min-h-16 overflow-x-auto rounded-lg p-2.5 font-mono text-xs leading-relaxed"
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
              <div className="mb-1 mt-1.5">
                <button
                  type="button"
                  onClick={() => void copyCommand()}
                  className="text-xs font-medium text-primary underline decoration-primary/40 hover:opacity-80"
                >
                  Copy command
                </button>
              </div>
              {sideError && <p className="mt-1.5 text-xs text-red-600">{sideError}</p>}

              <div className="mb-0.5 mt-2">
                <ExecutionFields
                  tool={selected}
                  className="mt-1"
                  showHeader
                  target={target}
                  onTargetChange={setTarget}
                  flagValues={flagValues}
                  onFlagToggle={onFlagToggle}
                  extraArgs={extraArgs}
                  onExtraArgsChange={setExtraArgs}
                />
              </div>

              {lastResultJson != null && (
                <div className="mb-2 mt-2">
                  <RunResultSummary data={lastResultJson} />
                </div>
              )}

              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void runExecute()}
                  disabled={executing || !commandPreview}
                  className="flex min-h-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-sm font-bold text-on-primary enabled:hover:opacity-90 disabled:opacity-50"
                >
                  <Icon icon="material-symbols:terminal" className="h-4 w-4" width={16} height={16} aria-hidden />
                  {executing ? "…" : "Execute"}
                </button>
                <button
                  type="button"
                  onClick={saveCurrentConfig}
                  className="shrink-0 rounded-lg border border-outline-variant bg-surface-container px-3 py-2.5 text-sm font-medium text-on-surface"
                  title="Save target, flags, and extra args for this tool (browser storage)"
                >
                  <Icon icon="material-symbols:save" className="h-4 w-4" width={16} height={16} aria-hidden />
                </button>
              </div>
              {executeMsg && <p className="mt-2 text-xs text-on-surface-variant">{executeMsg}</p>}

              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-medium text-on-surface">Recent activity</span>
                </div>
                <ul className="max-h-48 space-y-1.5 overflow-y-auto pr-0.5">
                  {recentLogs.length === 0 && (
                    <li className="text-xs text-on-surface-variant">Execute a job to populate activity.</li>
                  )}
                  {recentLogs.map((log, i) => (
                    <li
                      key={i + log.time + log.message}
                      className="rounded-md border border-outline-variant bg-background p-1.5 text-xs text-on-surface-variant"
                    >
                      <span className="text-[0.6rem] font-mono text-primary">{log.time}</span> {log.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="pt-2 text-sm text-on-surface-variant">Select a tool from the grid.</p>
          )}
        </aside>
      </div>

      <RunToolModal
        open={runModalOpen}
        onClose={() => setRunModalOpen(false)}
        tool={selected}
        target={target}
        onTargetChange={setTarget}
        flagValues={flagValues}
        onFlagToggle={onFlagToggle}
        extraArgs={extraArgs}
        onExtraArgsChange={setExtraArgs}
        commandPreview={commandPreview}
        previewLoading={previewLoading}
        onExecute={() => {
          void runExecute();
        }}
        executing={executing}
        lastResultJson={lastResultJson}
        error={sideError}
      />
    </div>
  );
}

function filteredList(
  tools: Tool[],
  search: string,
  filterTab: (typeof FILTER_TABS)[number]["id"],
): Tool[] {
  const q = search.trim().toLowerCase();
  return tools.filter((t) => {
    if (filterTab !== "all" && !t.filter_tags?.includes(filterTab)) {
      return false;
    }
    if (!q) return true;
    const pool = [t.name, t.description, ...(t.tags ?? []), t.category].join(" ").toLowerCase();
    return pool.includes(q);
  });
}
