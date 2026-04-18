"use client";

/**
 * Pixels and class structure from Google Stitch (user-stitch MCP):
 * - list_screens / get_screen: "Session History (Light)" (screen 42231ff58600435e95177bfe85135f0c)
 * - HTML design tokens: Geist, MD3 light, primary #7c3aed, etc.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, downloadAuthenticatedBlob } from "@/lib/api";
import { SessionTerminalModal } from "@/components/SessionTerminalModal";
import { ThreatSurfaceEvolutionMap } from "@/components/ThreatSurfaceEvolutionMap";
import type { SessionRow, SessionDashboardStats, SessionTerminalLogLine } from "@/components/session-types";

const PAGE_SIZE = 6;

type SortKey = "newest" | "oldest" | "target";
type StatusFilter = "all" | "completed" | "failed";

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "newest", label: "Sort: Newest" },
  { id: "oldest", label: "Sort: Oldest" },
  { id: "target", label: "Sort: Target (A-Z)" },
];

function isDnsIcon(target: string) {
  if (target.includes("staging") || target.includes("hexstrike")) {
    return false;
  }
  return true;
}

export function SessionHistoryView() {
  const router = useRouter();
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [stats, setStats] = useState<SessionDashboardStats | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [page, setPage] = useState(1);
  const demoResetOnce = useRef(false);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  const sortWrapRef = useRef<HTMLDivElement>(null);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [logModal, setLogModal] = useState<{
    open: boolean;
    label: string;
    lines: SessionTerminalLogLine[];
    loading: boolean;
  }>({ open: false, label: "", lines: [], loading: false });

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const [s, m] = await Promise.all([
        (async () => {
          let list = await api<SessionRow[]>("/sessions");
          if (list.length === 0) {
            list = await api<SessionRow[]>("/sessions/seed-demo", { method: "POST" });
          }
          return list;
        })(),
        api<SessionDashboardStats>("/sessions/summary").catch(() => null),
      ]);
      setRows(s);
      if (m) setStats(m);
    } catch {
      setLoadError(true);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** `/history?demo=reset` replaces all sessions with the four demo rows (2 complete, 2 failed). */
  useEffect(() => {
    if (typeof window === "undefined" || demoResetOnce.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") !== "reset") return;
    demoResetOnce.current = true;
    void (async () => {
      try {
        await api<SessionRow[]>("/sessions/seed-demo?replace=true", { method: "POST" });
        await load();
      } finally {
        router.replace("/history", { scroll: false });
      }
    })();
  }, [load, router]);

  useEffect(() => {
    if (!filterMenuOpen && !sortMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (filterMenuOpen && filterWrapRef.current && !filterWrapRef.current.contains(t)) {
        setFilterMenuOpen(false);
      }
      if (sortMenuOpen && sortWrapRef.current && !sortWrapRef.current.contains(t)) {
        setSortMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [filterMenuOpen, sortMenuOpen]);

  const filtered = useMemo(() => {
    let list = rows.filter((r) => r.status === "completed" || r.status === "failed");
    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }
    const qRaw = search.trim();
    if (qRaw) {
      const words = qRaw
        .toLowerCase()
        .replace(/#/g, " ")
        .split(/\s+/)
        .filter(Boolean);
      list = list.filter((r) => {
        const blob = `${r.target} ${r.title} ${r.display_id} ${r.id}`.toLowerCase();
        return words.every((w) => blob.includes(w));
      });
    }
    if (sort === "newest") {
      list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    } else if (sort === "oldest") {
      list.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    } else {
      list.sort((a, b) => a.target.localeCompare(b.target));
    }
    return list;
  }, [rows, search, sort, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, sort, statusFilter, rows.length]);

  async function openLogs(sessionId: string, label: string) {
    setLogModal({ open: true, label, lines: [], loading: true });
    try {
      const res = await api<{ lines: SessionTerminalLogLine[] }>(`/sessions/${sessionId}/logs`);
      setLogModal({ open: true, label, lines: res.lines, loading: false });
    } catch {
      setLogModal({
        open: true,
        label,
        lines: [{ time: "--", message: "Could not load terminal log stream." }],
        loading: false,
      });
    }
  }

  async function downloadPdf(sessionId: string) {
    await downloadAuthenticatedBlob(`/reports/by-session/${sessionId}/pdf`, `session-report-${sessionId}.pdf`);
  }

  const fmt = (d: string) => {
    const x = new Date(d);
    return x.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const scanDisplay = stats?.total_scans.toLocaleString() ?? "—";
  const vulnDisplay = stats ? String(stats.vulnerabilities_found) : "—";

  return (
    <div className="mb-10 font-sans text-[#09090b]">
      <div className="mb-10">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-[#09090b]">Session History</h1>
        <p className="text-[#52525b]">
          Manage and review offensive security operations and automated breach reports.
        </p>
      </div>

      {loadError && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          Could not load sessions. Check the API and your session.
        </p>
      )}

      {stats && (
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex items-center justify-between rounded-lg border border-[#e4e4e7] bg-white p-5 shadow-sm">
            <div>
              <p className="mb-1 text-sm font-medium text-[#52525b]">Total Scans</p>
              <p className="text-3xl font-bold text-[#09090b]">{scanDisplay}</p>
              <p className="mt-2 flex items-center gap-1 text-xs font-medium text-[#059669]">
                <span className="material-symbols-outlined text-xs">trending_up</span>
                +{stats.total_scans_trend_pct}% from last month
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#e4e4e7] bg-[#f4f4f5]">
              <span className="material-symbols-outlined text-[#7c3aed]">history</span>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[#e4e4e7] bg-white p-5 shadow-sm">
            <div>
              <p className="mb-1 text-sm font-medium text-[#52525b]">Vulnerabilities Found</p>
              <p className="text-3xl font-bold text-[#09090b]">{vulnDisplay}</p>
              <p className="mt-2 flex items-center gap-1 text-xs font-medium text-[#dc2626]">
                <span className="material-symbols-outlined text-xs">warning</span>
                {stats.critical_active} critical active
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#e4e4e7] bg-[#f4f4f5]">
              <span className="material-symbols-outlined text-[#059669]">security</span>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[#e4e4e7] bg-white p-5 shadow-sm">
            <div>
              <p className="mb-1 text-sm font-medium text-[#52525b]">Avg. Time to Breach</p>
              <p className="text-3xl font-bold text-[#09090b]">{stats.avg_time_to_breach}</p>
              <p className="mt-2 flex items-center gap-1 text-xs font-medium text-[#52525b]">
                <span className="material-symbols-outlined text-xs">timer</span>
                {stats.avg_time_subtext}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#e4e4e7] bg-[#f4f4f5]">
              <span className="material-symbols-outlined text-[#7c3aed]">speed</span>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-[#e4e4e7] bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-[#e4e4e7] bg-[#fafafa] p-4 md:flex-row md:items-center">
          <div
            className="relative w-full md:w-96"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#52525b]">
              search
            </span>
            <input
              type="search"
              name="session-search"
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by target or session ID..."
              className="w-full rounded-md border border-[#e4e4e7] bg-white py-2 pl-10 pr-4 text-sm text-[#09090b] focus:border-transparent focus:ring-2 focus:ring-[#7c3aed]"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="relative" ref={filterWrapRef}>
              <button
                type="button"
                aria-expanded={filterMenuOpen}
                aria-haspopup="listbox"
                onClick={() => {
                  setSortMenuOpen(false);
                  setFilterMenuOpen((o) => !o);
                }}
                className={`flex items-center gap-2 rounded border px-4 py-2 text-sm font-medium transition-colors ${
                  statusFilter === "all"
                    ? "border-[#e4e4e7] bg-white text-[#09090b] hover:bg-[#fafafa]"
                    : "border-[#7c3aed]/40 bg-[#f5f3ff] text-[#5b21b6]"
                }`}
              >
                <span className="material-symbols-outlined text-sm">filter_list</span>
                Filter
                {statusFilter !== "all" ? (
                  <span className="rounded-full bg-[#7c3aed] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {statusFilter === "completed" ? "Complete" : "Failed"}
                  </span>
                ) : null}
              </button>
              {filterMenuOpen ? (
                <div
                  className="absolute right-0 z-30 mt-1 w-56 rounded-lg border border-[#e4e4e7] bg-white py-1 shadow-lg"
                  role="listbox"
                >
                  <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-[#71717a]">
                    Status
                  </p>
                  {(
                    [
                      { id: "all" as const, label: "All sessions" },
                      { id: "completed" as const, label: "Complete only" },
                      { id: "failed" as const, label: "Failed only" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      role="option"
                      aria-selected={statusFilter === opt.id}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                        statusFilter === opt.id ? "bg-[#f5f3ff] font-semibold text-[#5b21b6]" : "hover:bg-[#fafafa]"
                      }`}
                      onClick={() => {
                        setStatusFilter(opt.id);
                        setFilterMenuOpen(false);
                      }}
                    >
                      {opt.label}
                      {statusFilter === opt.id ? (
                        <span className="material-symbols-outlined text-[18px] text-[#7c3aed]">check</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="relative" ref={sortWrapRef}>
              <button
                type="button"
                aria-expanded={sortMenuOpen}
                aria-haspopup="listbox"
                aria-label="Sort sessions"
                onClick={() => {
                  setFilterMenuOpen(false);
                  setSortMenuOpen((o) => !o);
                }}
                className="flex min-w-[11rem] items-center gap-2 rounded border border-[#e4e4e7] bg-white px-3 py-2 text-left text-sm font-medium text-[#09090b] transition hover:bg-[#fafafa]"
              >
                <span className="material-symbols-outlined shrink-0 text-sm text-[#52525b]">sort</span>
                <span className="min-w-0 flex-1 truncate">
                  {SORT_OPTIONS.find((o) => o.id === sort)?.label ?? "Sort: Newest"}
                </span>
                <span className="material-symbols-outlined shrink-0 text-[18px] text-[#52525b]">
                  {sortMenuOpen ? "expand_less" : "expand_more"}
                </span>
              </button>
              {sortMenuOpen ? (
                <div
                  className="absolute right-0 z-40 mt-1 min-w-[220px] rounded-lg bg-[#4A4C50] py-1.5 shadow-xl ring-1 ring-black/15"
                  role="listbox"
                  aria-label="Sort order"
                >
                  {SORT_OPTIONS.map((opt) => {
                    const selected = sort === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white transition hover:bg-white/10 ${
                          selected ? "font-semibold" : "font-normal"
                        }`}
                        onClick={() => {
                          setSort(opt.id);
                          setSortMenuOpen(false);
                        }}
                      >
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                          {selected ? (
                            <span className="material-symbols-outlined text-[18px] text-white">check</span>
                          ) : null}
                        </span>
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#e4e4e7] bg-[#fafafa]">
                {["Target", "Status", "Date Started", "Findings", "Actions"].map((h) => (
                  <th
                    key={h}
                    className={
                      h === "Actions"
                        ? "px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-[#52525b]"
                        : "px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#52525b]"
                    }
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e4e7]">
              {paged.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-[#52525b]">
                    {rows.length === 0 ? "No sessions yet." : "No results match this search."}
                  </td>
                </tr>
              )}
              {paged.map((r) => {
                const iconName =
                  (r.table_icon && /^[a-z_]+$/.test(r.table_icon) ? r.table_icon : null) ??
                  (isDnsIcon(r.target) ? "dns" : "cloud");
                return (
                  <tr
                    key={r.id}
                    className="cursor-pointer transition-colors hover:bg-[#fafafa]"
                    onClick={() => router.push(`/reports/${r.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/reports/${r.id}`);
                      }
                    }}
                    tabIndex={0}
                    role="link"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded border border-[#e4e4e7] bg-[#e4e4e7]">
                          <span
                            className="material-symbols-outlined text-sm text-[#7c3aed]"
                            aria-hidden
                          >
                            {iconName}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-[#09090b]">{r.target}</div>
                          <div className="font-mono text-xs text-[#52525b]">#{r.display_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {r.status === "completed" && (
                        <span className="inline-flex items-center rounded border border-[#059669]/20 bg-[#d1fae5] px-2 py-1 text-[10px] font-bold uppercase tracking-tight text-[#059669]">
                          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-[#059669]" />
                          Complete
                        </span>
                      )}
                      {r.status === "failed" && (
                        <span className="inline-flex items-center rounded border border-[#dc2626]/20 bg-[#fee2e2] px-2 py-1 text-[10px] font-bold uppercase tracking-tight text-[#dc2626]">
                          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-[#dc2626]" />
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#52525b]">{fmt(r.created_at)}</td>
                    <td className="px-6 py-4">
                      {r.findings_crit > 0 || r.findings_info > 0 ? (
                        <div className="flex gap-1">
                          {r.findings_crit > 0 && (
                            <span className="rounded border border-[#dc2626]/20 bg-[#dc2626]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#dc2626]">
                              {r.findings_crit} CRIT
                            </span>
                          )}
                          {r.findings_info > 0 && (
                            <span className="rounded border border-[#e4e4e7] bg-[#52525b]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#52525b]">
                              {r.findings_info} INF
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-[#52525b]">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="p-2 text-[#52525b] transition-colors hover:text-[#7c3aed]"
                          title="Terminal"
                          onClick={() => void openLogs(r.id, r.display_id)}
                        >
                          <span className="material-symbols-outlined text-sm">terminal</span>
                        </button>
                        <button
                          type="button"
                          className="p-2 text-[#52525b] transition-colors hover:text-[#7c3aed]"
                          title="PDF"
                          onClick={() => {
                            void downloadPdf(r.id).catch(() => null);
                          }}
                        >
                          <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                        </button>
                        <button
                          type="button"
                          className="p-2 text-[#52525b] transition-colors hover:text-[#7c3aed]"
                          title="Refresh"
                          onClick={() => void load()}
                        >
                          <span className="material-symbols-outlined text-sm">replay</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-[#e4e4e7] bg-[#fafafa] px-6 py-4">
          <span className="text-xs text-[#52525b]">
            Showing {filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0} to {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} sessions
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-[#e4e4e7] bg-white text-[#52525b] shadow-sm transition hover:border-[#d4d4d8] hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">chevron_left</span>
            </button>
            {Array.from({ length: pageCount }, (_, i) => i + 1)
              .filter(
                (n) => n === 1 || n === pageCount || Math.abs(n - safePage) <= 1,
              )
              .map((n, idx, arr) => (
                <span key={n} className="inline-flex items-center">
                  {idx > 0 && arr[idx - 1]! < n - 1 && <span className="px-2 text-xs text-[#52525b]">…</span>}
                  <button
                    type="button"
                    onClick={() => setPage(n)}
                    className={`min-w-9 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      n === safePage
                        ? "bg-[#7c3aed] text-white shadow-sm"
                        : "text-[#09090b] hover:bg-[#f4f4f5]"
                    }`}
                  >
                    {n}
                  </button>
                </span>
              ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={safePage >= pageCount}
              className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-[#e4e4e7] bg-white text-[#52525b] shadow-sm transition hover:border-[#d4d4d8] hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="space-y-6 rounded-lg border border-[#e4e4e7] bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-[#09090b]">
              <span className="material-symbols-outlined text-[#7c3aed]">analytics</span>
              Executive Report Preview
            </h3>
            <button
              type="button"
              className="text-xs font-semibold text-[#7c3aed] hover:underline"
              onClick={() => router.push("/analytics")}
            >
              Open analytics
            </button>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <div className="rounded-lg border border-[#e4e4e7] bg-[#fafafa] p-4">
                <p className="mb-2 text-xs font-bold uppercase text-[#dc2626]">Critical Vector Identified</p>
                <p className="text-sm leading-relaxed text-[#09090b]">
                  CVE-2023-4911 (Looney Tunables) detected across 4 target nodes in the internal cluster.
                </p>
              </div>
              <div className="rounded-lg border border-[#e4e4e7] bg-[#fafafa] p-4">
                <p className="mb-2 text-xs font-bold uppercase text-[#059669]">Automated Remediation</p>
                <p className="text-sm leading-relaxed text-[#09090b]">
                  3 out of 5 minor misconfigurations were automatically resolved.
                </p>
              </div>
            </div>
            <div className="max-h-[min(520px,72vh)] min-h-[200px] overflow-x-hidden overflow-y-auto rounded-lg border border-[#e4e4e7] bg-[#fafafa]">
              <ThreatSurfaceEvolutionMap compact />
            </div>
          </div>
        </div>
      </div>

      <SessionTerminalModal
        open={logModal.open}
        onClose={() => setLogModal((m) => ({ ...m, open: false }))}
        title={logModal.label}
        lines={logModal.lines}
        loading={logModal.loading}
      />
    </div>
  );
}
