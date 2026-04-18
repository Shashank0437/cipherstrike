"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { ThreatSurfaceEvolutionMap } from "@/components/ThreatSurfaceEvolutionMap";
import { api, downloadAuthenticatedBlob } from "@/lib/api";
import type { SessionRow, SessionDashboardStats } from "@/components/session-types";

export default function AnalyticsPage() {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [stats, setStats] = useState<SessionDashboardStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [downloadingMonthly, setDownloadingMonthly] = useState(false);
  const [downloadingCompliance, setDownloadingCompliance] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [s, m] = await Promise.all([
        api<SessionRow[]>("/sessions"),
        api<SessionDashboardStats>("/sessions/summary"),
      ]);
      setRows(s);
      setStats(m);
    } catch {
      setErr("Could not load analytics.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshSummary = useCallback(() => {
    setSummaryBusy(true);
    void load().finally(() => setSummaryBusy(false));
  }, [load]);

  const done = useMemo(
    () => rows.filter((r) => r.status === "completed" || r.status === "failed"),
    [rows],
  );
  const completed = done.filter((r) => r.status === "completed").length;
  const failed = done.filter((r) => r.status === "failed").length;
  const crit = done.reduce((a, r) => a + r.findings_crit, 0);

  const metricItems = [
    { label: "Sessions (workspace)", value: String(done.length), sub: "Completed + failed", icon: "hub" as const },
    { label: "Completed", value: String(completed), sub: "Successful runs", icon: "check_circle" as const },
    { label: "Failed", value: String(failed), sub: "Needs attention", icon: "error" as const },
    { label: "Critical findings", value: String(crit), sub: "Across listed sessions", icon: "crisis_alert" as const },
  ];

  const complianceBullets = [
    "Session and report counts for the current workspace",
    "Illustrative CC6 / CC7 / CC8 control narrative (customize for your matrix)",
    "Ready to attach to diligence and enterprise procurement flows",
  ];

  return (
    <div className="w-full min-w-0 max-w-none font-sans text-[#09090b]">
      <div className="rounded-2xl border border-[#e4e4e7] bg-white p-6 shadow-sm sm:p-8">
        <PageBreadcrumbs
          items={[
            { label: "Sessions", href: "/history" },
            { label: "Analytics" },
          ]}
        />
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#faf5ff]/90 via-white to-[#f4f4f5] p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#7c3aed]/[0.08] blur-2xl" />
          <div className="relative">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-[#7c3aed]/20 bg-white/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#7c3aed]">
              <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
              GTM · Feature analytics
            </p>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-[#18181b] sm:text-3xl">
              Security operations analytics
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#52525b]">
              Live rollups from your workspace — session throughput, failure rate, and critical finding pressure.
              Use this view for leadership reviews and pipeline storytelling.
            </p>
          </div>
        </div>

        {err && (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {err}
          </p>
        )}

        {stats && (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {metricItems.map((c) => (
              <div
                key={c.label}
                className="flex min-h-[132px] flex-col justify-between rounded-xl border border-[#e4e4e7] bg-[#fafafa] p-4 shadow-sm transition hover:border-[#7c3aed]/25 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-medium leading-snug text-[#52525b]">{c.label}</p>
                  <span className="material-symbols-outlined shrink-0 rounded-lg bg-white p-1.5 text-[20px] text-[#7c3aed] shadow-sm">
                    {c.icon}
                  </span>
                </div>
                <div>
                  <p className="text-3xl font-black tabular-nums leading-none text-[#18181b]">{c.value}</p>
                  <p className="mt-1.5 text-[11px] text-[#71717a]">{c.sub}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <section
          id="monthly-executive-summary"
          className="mt-8 scroll-mt-6 rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-sm sm:p-6"
          aria-labelledby="monthly-heading"
        >
          <div className="flex flex-col gap-4 border-b border-[#e4e4e7] pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-[#7c3aed]">Monthly executive summary</p>
              <h2 id="monthly-heading" className="mt-2 text-xl font-black tracking-tight text-[#18181b] sm:text-2xl">
                Last 30 days consolidated
              </h2>
            </div>
            <div className="shrink-0 rounded-full border border-[#7c3aed]/25 bg-[#faf5ff] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#6d28d9]">
              GTM · Premium
            </div>
          </div>

          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-[#52525b]">
            One PDF for leadership: session counts, outcomes, and critical-finding pressure — formatted for board readouts
            and pipeline reviews.
          </p>

          {stats && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-4 py-3 text-sm">
                <span className="text-[#52525b]">Workspace scans</span>
                <span className="ml-2 font-bold tabular-nums text-[#18181b]">{stats.total_scans}</span>
              </div>
              <div className="rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-4 py-3 text-sm">
                <span className="text-[#52525b]">Vulnerabilities tracked</span>
                <span className="ml-2 font-bold tabular-nums text-[#18181b]">{stats.vulnerabilities_found}</span>
              </div>
            </div>
          )}
          {summaryBusy && <p className="mt-3 text-sm text-[#52525b]">Refreshing metrics…</p>}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              disabled={downloadingMonthly}
              onClick={() => {
                setDownloadingMonthly(true);
                void downloadAuthenticatedBlob("/reports/exports/monthly-summary", "CipherStrike-Monthly-Summary.pdf")
                  .catch(() => null)
                  .finally(() => setDownloadingMonthly(false));
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#7c3aed] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#6d28d9] disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[20px]">download</span>
              {downloadingMonthly ? "Preparing PDF…" : "Download monthly PDF"}
            </button>
            <button
              type="button"
              disabled={summaryBusy}
              onClick={() => void refreshSummary()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e4e4e7] bg-white px-5 py-3 text-sm font-semibold text-[#18181b] transition hover:bg-[#fafafa] disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[20px] text-[#52525b]">refresh</span>
              Refresh metrics
            </button>
          </div>
        </section>

        <section
          id="compliance-export"
          className="mt-6 scroll-mt-6 rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-sm sm:p-6"
          aria-labelledby="compliance-heading"
        >
          <div className="flex flex-col gap-4 border-b border-[#e4e4e7] pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-[#52525b]">SOC 2 Type II</p>
              <h2 id="compliance-heading" className="mt-2 text-xl font-black tracking-tight text-[#18181b] sm:text-2xl">
                Audit-ready evidence export
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-full border border-emerald-200/90 bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-900">
              <span className="material-symbols-outlined text-[16px] text-emerald-700">verified_user</span>
              Compliance
            </div>
          </div>

          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-[#52525b]">
            Generate a structured summary that maps your offensive security program to common SOC 2 trust criteria.
            Pair this PDF with per-session PDFs and raw logs for your auditor workspace.
          </p>

          <ul className="mt-5 grid gap-3">
            {complianceBullets.map((line) => (
              <li
                key={line}
                className="flex gap-3 rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-4 py-3 text-sm text-[#3f3f46]"
              >
                <span className="material-symbols-outlined shrink-0 text-[20px] text-emerald-600">check_circle</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6">
            <button
              type="button"
              disabled={downloadingCompliance}
              onClick={() => {
                setDownloadingCompliance(true);
                void downloadAuthenticatedBlob(
                  "/reports/exports/compliance-soc2",
                  "CipherStrike-SOC2-Compliance-Export.pdf",
                )
                  .catch(() => null)
                  .finally(() => setDownloadingCompliance(false));
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0f172a] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#1e293b] disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[20px]">download</span>
              {downloadingCompliance ? "Preparing export…" : "Download SOC 2 evidence PDF"}
            </button>
          </div>
        </section>

        <section className="mt-6 flex min-h-[300px] flex-col rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#18181b]">
            <span className="material-symbols-outlined text-[22px] text-[#7c3aed]">show_chart</span>
            Activity pulse (last sessions)
          </h2>
          <div className="mt-4 flex min-h-[200px] flex-1 flex-col">
            {done.length > 0 ? (
              <>
                <div className="flex min-h-[200px] flex-1 items-end gap-1.5 rounded-lg bg-[#fafafa] px-2 pb-2 pt-4">
                  {done.slice(0, 12).map((r, i) => {
                    const h = 22 + ((i * 17 + r.tool_count) % 70);
                    const color = r.status === "failed" ? "bg-red-500/85" : "bg-emerald-500/90";
                    return (
                      <div
                        key={r.id}
                        title={`${r.display_id} · ${r.status}`}
                        className={`min-w-0 flex-1 rounded-t-md ${color} transition hover:opacity-90`}
                        style={{ height: `${h}%`, minHeight: "28px" }}
                      />
                    );
                  })}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-[#71717a]">
                  Bar height reflects relative intensity (tools used + demo jitter) for the last sessions.
                </p>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[#e4e4e7] bg-[#fafafa] px-4 py-12 text-center">
                <p className="text-sm text-[#52525b]">No sessions yet. Open Session History to seed demo data.</p>
              </div>
            )}
          </div>
        </section>

        <ThreatSurfaceEvolutionMap className="mt-6" />
      </div>
    </div>
  );
}
