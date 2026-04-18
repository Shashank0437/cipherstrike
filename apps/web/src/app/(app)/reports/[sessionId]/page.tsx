"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, apiRaw, ApiError, filenameFromContentDisposition } from "@/lib/api";
import { SessionTerminalModal } from "@/components/SessionTerminalModal";
import type { ReportDetail, SessionRow, SessionTerminalLogLine, VulnerabilityLog } from "@/components/session-types";

const errorRing = "rgba(249, 115, 134, 0.2)";

const RISK_BG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAXN8v0k88Bh85TD0jSBUK0lpI7hT0zbJxU_LPpEOw5r10hepp5qShiyAUEfMFMh3Akc6-uDNt5fpyAKLzqNLzSxbxuLR6qaF1EkDle09hRhxZRKKFuXjSRBGrCKKdYqboySMORW2tIj30dXVCXjKQ-_83j__OCk6gH_Wc9gnE0Q_E8udxtEviJtZRkerfzgYNnLg_lJrdXxRPwafB3G9yG1CBx9wnwfiCUncaX66sOvd583IwREebkJ6OoJZ5k-9XiiKN-3LpUz6w";

function riskStyle(score: number) {
  if (score >= 7.5) return { label: "High Criticality", text: "text-[#a8364b]", arc: "#a8364b" };
  if (score >= 4.5) return { label: "Elevated Risk", text: "text-[#f97316]", arc: "#f97316" };
  if (score >= 2) return { label: "Moderate Risk", text: "text-[#684cb6]", arc: "#684cb6" };
  return { label: "Lower Risk", text: "text-[#006d4b]", arc: "#006d4b" };
}

function sevRow(v: VulnerabilityLog) {
  if (v.severity === "critical") return { tag: "bg-[#a8364b] text-white", name: "CRITICAL" };
  if (v.severity === "high")
    return { tag: "bg-[#f97316] text-white", name: "High" };
  if (v.severity === "medium")
    return { tag: "bg-[#684cb6] text-white", name: "Medium" };
  return { tag: "bg-[#006d4b] text-white", name: "Low" };
}

export default function SessionReportPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [session, setSession] = useState<SessionRow | null>(null);
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logSort, setLogSort] = useState<"cvss" | "severity">("cvss");
  const [showAllVulns, setShowAllVulns] = useState(false);
  const [logModal, setLogModal] = useState<{
    open: boolean;
    label: string;
    lines: SessionTerminalLogLine[];
    loading: boolean;
  }>({ open: false, label: "", lines: [], loading: false });

  const load = useCallback(async () => {
    if (!sessionId) return;
    setError(null);
    try {
      const [s, r] = await Promise.all([
        api<SessionRow>(`/sessions/${sessionId}`),
        api<ReportDetail>(`/reports/by-session/${sessionId}`),
      ]);
      setSession(s);
      setReport(r);
    } catch {
      setError("Could not load this session report.");
      setSession(null);
      setReport(null);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedVulns = useMemo(() => {
    if (!report) return [];
    const v = [...report.vulnerability_logs];
    if (logSort === "cvss") v.sort((a, b) => b.cvss - a.cvss);
    else {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      v.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
    }
    return v;
  }, [report, logSort]);

  const displayVulns = useMemo(() => {
    if (showAllVulns || sortedVulns.length <= 5) return sortedVulns;
    return sortedVulns.slice(0, 5);
  }, [sortedVulns, showAllVulns]);

  const sortHeaderLabel = logSort === "cvss" ? "SORT BY: SCORE (DESC)" : "SORT BY: SEVERITY";

  const codeSnippet = useMemo(() => {
    if (!report) return "";
    const host = report.target_host;
    return `import requests

payload = "'; /bin/bash -c 'id' #"
headers = {
    "X-Forwarded-Exec": payload,
    "Authorization": "Bearer <token>"
}

r = requests.get("https://${host}/v2/proxy", headers=headers)
print(r.status_code)
print(r.text)`;
  }, [report]);

  async function downloadPdf() {
    if (!sessionId) return;
    const res = await apiRaw(`/reports/by-session/${sessionId}/pdf`);
    if (!res.ok) {
      const t = await res.text();
      throw new ApiError(t || "Download failed", res.status, t);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filenameFromContentDisposition(res, `session-report-${sessionId}.pdf`);
    a.click();
    URL.revokeObjectURL(url);
  }

  async function openLogs() {
    if (!sessionId || !session) return;
    setLogModal({ open: true, label: session.display_id, lines: [], loading: true });
    try {
      const res = await api<{ lines: SessionTerminalLogLine[] }>(`/sessions/${sessionId}/logs`);
      setLogModal({ open: true, label: session.display_id, lines: res.lines, loading: false });
    } catch {
      setLogModal({
        open: true,
        label: session?.display_id ?? "",
        lines: [{ time: "--", message: "Could not load logs." }],
        loading: false,
      });
    }
  }

  function share() {
    void navigator.clipboard.writeText(window.location.href);
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        {error}{" "}
        <Link href="/history" className="font-medium underline">
          Back to history
        </Link>
      </div>
    );
  }

  if (!report || !session) {
    return (
      <div className="max-w-6xl mx-auto p-8 text-center text-sm text-[#5d5e6c]">Loading report…</div>
    );
  }

  const sub = report.audit_date_label
    ? `${report.audit_date_label} · Agent: ${report.agent}`
    : `Agent: ${report.agent}`;

  const rStyle = riskStyle(report.risk_score);
  const findings = report.findings.length ? report.findings : [report.summary].filter(Boolean);

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex flex-col justify-between gap-4 sm:items-end sm:flex-row mb-8">
        <div>
          <nav className="mb-2 flex gap-2 text-xs font-medium text-[#5d5e6c]">
            <Link href="/history" className="uppercase transition hover:text-[#684cb6]">
              Sessions
            </Link>
            <span>/</span>
            <span className="font-bold uppercase text-[#684cb6]">{session.display_id}</span>
          </nav>
          <h1 className="text-3xl font-black tracking-tight text-[#30323e]">Detailed Session Report</h1>
          <p className="mt-1 text-sm text-[#5d5e6c]">{sub}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={share}
            className="flex items-center gap-2 rounded-lg border border-[#b1b1c0] bg-white px-4 py-2 text-sm font-semibold text-[#5d5e6c] transition hover:bg-[#e8e7f5]"
          >
            <span className="material-symbols-outlined text-[20px]">share</span>
            Share
          </button>
          <button
            type="button"
            onClick={() => void openLogs()}
            className="flex items-center gap-2 rounded-lg border border-[#b1b1c0] bg-white px-4 py-2 text-sm font-semibold text-[#5d5e6c] transition hover:bg-[#e8e7f5]"
          >
            <span className="material-symbols-outlined text-[20px]">terminal</span>
            Logs
          </button>
          <button
            type="button"
            onClick={() => void downloadPdf().catch(() => null)}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700"
          >
            <span className="material-symbols-outlined text-[20px]">download</span>
            Download PDF Report
          </button>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-12 gap-6">
        <div className="col-span-12 flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-6 shadow-sm md:col-span-8">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-lg bg-violet-100 p-2 text-violet-600">
                <span className="material-symbols-outlined">language</span>
              </span>
              <span className="text-xs font-bold uppercase tracking-widest text-[#5d5e6c]">Target Environment</span>
            </div>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs text-[#5d5e6c]">Domain</p>
                <p className="text-xl font-bold text-[#30323e] font-mono break-all">{report.target_host}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-[#5d5e6c]">Primary IP</p>
                <p className="text-xl font-bold text-[#30323e] font-mono">{report.primary_ip}</p>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-8 border-t border-zinc-100 pt-6 sm:gap-12">
            <div>
              <p className="mb-1 text-[10px] text-[#5d5e6c]">Scan duration</p>
              <p className="text-sm font-bold text-[#30323e]">{report.scan_duration}</p>
            </div>
            <div>
              <p className="mb-1 text-[10px] text-[#5d5e6c]">Packets sent</p>
              <p className="text-sm font-bold text-[#30323e]">{report.packets_sent}</p>
            </div>
            <div>
              <p className="mb-1 text-[10px] text-[#5d5e6c]">Vulns found</p>
              <p className="text-sm font-bold text-[#30323e]">{report.total_vulns} total</p>
            </div>
          </div>
        </div>

        <div className="relative col-span-12 flex flex-col items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm md:col-span-4">
          <div className="pointer-events-none absolute inset-0 opacity-[0.03]">
            {/* eslint-disable-next-line @next/next/no-img-element -- Stitch asset, external host */}
            <img src={RISK_BG} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="relative z-10 flex w-full flex-col items-center">
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[#5d5e6c]">Overall risk</p>
            <div className="relative mx-auto flex h-32 w-32 items-center justify-center">
              <div
                className="absolute inset-0 rounded-full border-[10px]"
                style={{ borderColor: errorRing }}
                aria-hidden
              />
              <div
                className="absolute inset-0 -rotate-45 rounded-full border-[10px] border-t-transparent"
                style={{
                  borderTopColor: "transparent",
                  borderLeftColor: rStyle.arc,
                  borderRightColor: rStyle.arc,
                  borderBottomColor: rStyle.arc,
                }}
                aria-hidden
              />
              <span
                className={`relative z-10 text-4xl font-black tabular-nums ${rStyle.text}`}
                style={{ lineHeight: 1 }}
              >
                {report.risk_score.toFixed(1)}
              </span>
            </div>
            <p className={`mt-4 text-sm font-bold uppercase tracking-tight ${rStyle.text}`}>{rStyle.label}</p>
          </div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4 md:gap-6">
        {(
          [
            { k: "CRITICAL", n: report.severity_critical, b: "border-l-[#a8364b]" },
            { k: "High", n: report.severity_high, b: "border-l-[#f97316]" },
            { k: "MEDIUM", n: report.severity_medium, b: "border-l-[#684cb6]" },
            { k: "LOW", n: report.severity_low, b: "border-l-[#006d4b]" },
          ] as const
        ).map((x) => (
          <div
            key={x.k}
            className={`rounded-xl border border-zinc-200 border-l-[6px] bg-white p-4 shadow-sm ${x.b}`}
          >
            <p className="text-xs font-bold text-[#5d5e6c]">{x.k}</p>
            <h3 className="mt-1 text-3xl font-black text-[#30323e] tabular-nums">
              {String(x.n).padStart(2, "0")}
            </h3>
          </div>
        ))}
      </div>

      <div className="mb-8 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-6 py-4">
          <h3 className="flex items-center gap-2 font-bold text-[#30323e]">
            <span className="material-symbols-outlined text-[#684cb6]">security</span>
            Vulnerability logs
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-[#5d5e6c] max-sm:hidden">{sortHeaderLabel}</span>
            <label className="text-xs text-[#5d5e6c]">
              <span className="sr-only">Sort by</span>
              <select
                value={logSort}
                onChange={(e) => setLogSort(e.target.value as "cvss" | "severity")}
                className="ml-1 rounded border border-zinc-200 bg-white py-0.5 pl-2 pr-6 text-xs font-bold"
              >
                <option value="cvss">Score (desc)</option>
                <option value="severity">Severity</option>
              </select>
            </label>
          </div>
        </div>
        <div className="divide-y divide-zinc-100">
          {displayVulns.map((v) => {
            const s = sevRow(v);
            return (
              <div key={v.id} className="group cursor-pointer p-6 transition hover:bg-zinc-50/80">
                <div className="flex justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2 sm:gap-3">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${s.tag}`}>
                        {s.name}
                      </span>
                      <span className="text-xs text-[#5d5e6c] font-mono">{v.cve}</span>
                      <span className="text-xs text-[#5d5e6c]">•</span>
                      <span className="text-xs text-[#5d5e6c]">{v.category}</span>
                    </div>
                    <h4 className="text-lg font-bold text-[#30323e] transition group-hover:text-[#684cb6]">
                      {v.title}
                    </h4>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#5d5e6c]">{v.description}</p>
                    <div className="mt-4 flex flex-wrap gap-3 sm:gap-4">
                      <div className="flex items-center gap-1.5 rounded bg-zinc-100 px-2.5 py-1 text-xs font-bold text-[#30323e]">
                        <span className="material-symbols-outlined text-sm">terminal</span>
                        Exploited: {v.exploited}
                      </div>
                      {v.fix_available && (
                        <div className="flex items-center gap-1.5 rounded bg-zinc-100 px-2.5 py-1 text-xs font-bold text-[#30323e]">
                          <span className="material-symbols-outlined text-sm">update</span>
                          Fix available
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-2xl font-black tracking-tighter text-[#30323e] tabular-nums">
                      {v.cvss.toFixed(1)}
                    </div>
                    <div className="text-[10px] font-bold uppercase text-[#5d5e6c]">CVSS v3.1</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {sortedVulns.length === 0 && (
          <p className="p-6 text-sm text-[#5d5e6c]">No detailed vulnerability objects for this run.</p>
        )}
        {sortedVulns.length > 5 && !showAllVulns && (
          <div className="bg-zinc-50 p-4 text-center">
            <button
              type="button"
              onClick={() => setShowAllVulns(true)}
              className="text-xs font-black uppercase tracking-widest text-[#684cb6] hover:underline"
            >
              Load all {sortedVulns.length} findings
            </button>
          </div>
        )}
      </div>

      {report.summary ? (
        <p className="mb-8 text-sm leading-relaxed text-[#30323e]">{report.summary}</p>
      ) : null}

      <div className="mb-12 grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#684cb6]" style={{ fontVariationSettings: "'FILL' 1" }}>
              smart_toy
            </span>
            <h3 className="font-bold text-[#30323e]">Agent observations</h3>
          </div>
          <ul className="space-y-4 text-sm text-[#5d5e6c]">
            {findings.map((line, i) => {
              const last = i === findings.length - 1;
              return (
                <li key={i} className="flex gap-3">
                  {last && /recommend|next|pivot/i.test(line) ? (
                    <span className="material-symbols-outlined text-lg text-[#684cb6]">info</span>
                  ) : (
                    <span className="material-symbols-outlined text-lg text-[#006d4b]">check_circle</span>
                  )}
                  <span>{line}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
          <div className="absolute right-4 top-4 flex gap-1.5" aria-hidden>
            <div className="h-2 w-2 rounded-full bg-zinc-700" />
            <div className="h-2 w-2 rounded-full bg-zinc-700" />
            <div className="h-2 w-2 rounded-full bg-zinc-700" />
          </div>
          <div className="mb-4 text-[10px] font-mono tracking-widest text-zinc-500">exploit_proof.py</div>
          <pre className="overflow-x-auto font-mono text-sm leading-relaxed text-zinc-300">
            <code>{codeSnippet}</code>
          </pre>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between border-t border-zinc-200 pt-10 opacity-70">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-2xl font-black tracking-tighter text-[#30323e]">CipherStrike</span>
          <span className="text-xs text-[#5d5e6c]">System audit report</span>
        </div>
        <p className="text-xs text-[#5d5e6c]">HexStrike — offensive security</p>
      </div>
      <p>
        <Link href="/history" className="text-sm font-bold text-[#684cb6] transition hover:underline">
          ← Back to session history
        </Link>
      </p>

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