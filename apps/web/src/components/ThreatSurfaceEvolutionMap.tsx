"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { ThreatSurfaceResponse, ThreatSeverity } from "@/components/session-types";

function severityStyles(s: ThreatSeverity): { dot: string; text: string } {
  switch (s) {
    case "critical":
      return { dot: "bg-red-600", text: "text-red-700" };
    case "high":
      return { dot: "bg-orange-500", text: "text-orange-700" };
    case "medium":
      return { dot: "bg-amber-500", text: "text-amber-800" };
    case "low":
      return { dot: "bg-sky-500", text: "text-sky-800" };
    default:
      return { dot: "bg-zinc-400", text: "text-zinc-600" };
  }
}

function riskPill(risk: string): string {
  switch (risk) {
    case "critical":
      return "bg-red-100 text-red-800 ring-red-200";
    case "high":
      return "bg-orange-100 text-orange-900 ring-orange-200";
    case "medium":
      return "bg-amber-100 text-amber-900 ring-amber-200";
    default:
      return "bg-emerald-100 text-emerald-900 ring-emerald-200";
  }
}

type Props = {
  /** Tighter layout for Session History preview column */
  compact?: boolean;
  className?: string;
};

export function ThreatSurfaceEvolutionMap({ compact = false, className = "" }: Props) {
  const [data, setData] = useState<ThreatSurfaceResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [openLayer, setOpenLayer] = useState<string | null>(compact ? null : "external");

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await api<ThreatSurfaceResponse>("/sessions/threat-surface");
      setData(r);
    } catch {
      setErr("Could not load threat surface map.");
      setData(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const maxPressure = useMemo(() => {
    if (!data?.evolution.length) return 1;
    return Math.max(1, ...data.evolution.map((e) => e.cumulative_pressure));
  }, [data]);

  const evolutionPoints = data?.evolution ?? [];
  const chartWidth = compact ? 280 : 640;
  const chartHeight = compact ? 72 : 120;
  const pad = 8;
  const linePath = useMemo(() => {
    if (evolutionPoints.length < 2) return "";
    const w = chartWidth - pad * 2;
    const h = chartHeight - pad * 2;
    const pts = evolutionPoints.map((e, i) => {
      const x = pad + (i / Math.max(1, evolutionPoints.length - 1)) * w;
      const y = pad + h - (e.cumulative_pressure / maxPressure) * h;
      return `${x},${y}`;
    });
    return `M ${pts.join(" L ")}`;
  }, [evolutionPoints, maxPressure, chartWidth, chartHeight]);

  const lastPoint = evolutionPoints[evolutionPoints.length - 1];
  const circles = useMemo(() => {
    if (!evolutionPoints.length) return null;
    const w = chartWidth - pad * 2;
    const h = chartHeight - pad * 2;
    return evolutionPoints.map((e, i) => {
      const x = pad + (i / Math.max(1, evolutionPoints.length - 1)) * w;
      const y = pad + h - (e.cumulative_pressure / maxPressure) * h;
      return (
        <circle
          key={`${e.label}-${i}`}
          cx={x}
          cy={y}
          r={compact ? 3 : 4}
          className="fill-[#7c3aed] stroke-white"
          strokeWidth={2}
        />
      );
    });
  }, [evolutionPoints, maxPressure, chartWidth, chartHeight, compact]);

  const highestLayerRisk = useMemo(() => {
    const layers = data?.layers ?? [];
    if (!layers.length) return "low" as const;
    const order = ["low", "medium", "high", "critical"] as const;
    let idx = 0;
    for (const layer of layers) {
      const i = order.indexOf(layer.risk);
      if (i > idx) idx = i;
    }
    return order[idx] ?? "low";
  }, [data]);

  /** Compact mode nests inside a bordered shell (e.g. Session History); avoid a second box border. */
  const rootShell = compact
    ? "rounded-none border-0 bg-transparent p-4 shadow-none"
    : "rounded-xl border border-[#e4e4e7] bg-gradient-to-b from-[#faf5ff]/40 to-white p-5 shadow-sm sm:p-6";

  if (err) {
    return (
      <div
        className={`text-sm text-red-800 ${compact ? "rounded-lg border border-red-200 bg-red-50 px-3 py-2.5" : "rounded-xl border border-red-200 bg-red-50 px-4 py-3"} ${className}`}
      >
        {err}
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className={`animate-pulse text-center text-sm text-[#71717a] ${compact ? `${rootShell} py-6` : "rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-4 py-8"} ${className}`}
      >
        Loading threat surface map…
      </div>
    );
  }

  return (
    <div className={`${rootShell} ${className}`}>
      <div
        className={`flex flex-col gap-3 ${compact ? "pb-0" : "border-b border-[#e4e4e7] pb-4 sm:flex-row sm:items-start sm:justify-between"}`}
      >
        <div className="min-w-0">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[#7c3aed]">
            {compact ? "Threat surface snapshot" : "Threat surface evolution map"}
          </h2>
          <p className={`mt-1 font-black leading-snug text-[#18181b] ${compact ? "text-base" : "text-lg sm:text-xl"}`}>
            {data.headline}
          </p>
          {compact ? (
            <>
              <p className="mt-2 line-clamp-2 text-sm leading-snug text-[#52525b]">{data.workspace_summary}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px] text-[#71717a]">
                {lastPoint ? (
                  <span>
                    Pressure{" "}
                    <span className="tabular-nums font-semibold text-[#7c3aed]">{lastPoint.cumulative_pressure}</span>
                    {lastPoint.delta ? (
                      <span className="text-[#a1a1aa]"> (+{lastPoint.delta})</span>
                    ) : null}
                  </span>
                ) : null}
                {lastPoint ? (
                  <span className="text-[#d4d4d8]" aria-hidden>
                    ·
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5">
                  Peak layer risk
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${riskPill(highestLayerRisk)}`}
                  >
                    {highestLayerRisk}
                  </span>
                </span>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-[#a1a1aa]">
                Charts, layers, and drill-down live on{" "}
                <Link href="/analytics" className="font-semibold text-[#7c3aed] hover:underline">
                  Analytics
                </Link>
                .
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-[#52525b]">{data.workspace_summary}</p>
          )}
        </div>
        {!compact ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#e4e4e7] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#52525b]">
            <span className="material-symbols-outlined text-[16px] text-[#7c3aed]">hub</span>
            Workspace
          </span>
        ) : null}
      </div>

      {!compact ? (
        <div className="mt-6">
          <p className="text-xs font-bold uppercase tracking-wider text-[#71717a]">Cumulative surface pressure</p>
          <p className="mt-1 text-[11px] text-[#a1a1aa]">
            Modeled from session findings and tool activity over time (higher = more observed exposure).
          </p>
          <div className="mt-3 overflow-x-auto">
            <svg
              width={chartWidth}
              height={chartHeight}
              className="mx-auto max-w-full"
              role="img"
              aria-label="Threat surface pressure over sessions"
            >
              <defs>
                <linearGradient id="tsmGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <rect x={0} y={0} width={chartWidth} height={chartHeight} fill="#fafafa" rx={8} />
              {evolutionPoints.length >= 2 && lastPoint ? (
                <>
                  <path
                    d={`${linePath} L ${chartWidth - pad} ${chartHeight - pad} L ${pad} ${chartHeight - pad} Z`}
                    fill="url(#tsmGrad)"
                  />
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#7c3aed"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {circles}
                </>
              ) : evolutionPoints.length === 1 && lastPoint ? (
                <>
                  {circles}
                  <text
                    x={chartWidth / 2}
                    y={chartHeight - 4}
                    textAnchor="middle"
                    fill="#71717a"
                    fontSize={10}
                  >
                    {lastPoint.label}
                  </text>
                </>
              ) : (
                <text x={chartWidth / 2} y={chartHeight / 2} textAnchor="middle" fill="#a1a1aa" fontSize={11}>
                  Add sessions to plot evolution
                </text>
              )}
            </svg>
          </div>
          {lastPoint ? (
            <p className="mt-2 text-center text-xs text-[#71717a]">
              Latest: <span className="font-mono font-semibold text-[#18181b]">{lastPoint.label}</span> · pressure{" "}
              <span className="tabular-nums font-semibold text-[#7c3aed]">{lastPoint.cumulative_pressure}</span>
              {lastPoint.delta ? (
                <>
                  {" "}
                  <span className="text-[#a1a1aa]">(+{lastPoint.delta})</span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}

      {!compact ? (
        <div className="mt-6 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[#71717a]">Discoverable layers</p>
          {data.layers.map((layer) => {
            const isOpen = openLayer === layer.id;
            return (
              <div key={layer.id} className="overflow-hidden rounded-lg border border-[#e4e4e7] bg-white">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-[#fafafa]"
                  onClick={() => setOpenLayer(isOpen ? null : layer.id)}
                  aria-expanded={isOpen}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="material-symbols-outlined shrink-0 text-[22px] text-[#7c3aed]">{layer.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-[#18181b]">{layer.title}</span>
                      <span className="block truncate text-[11px] text-[#71717a]">{layer.subtitle}</span>
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${riskPill(layer.risk)}`}>
                    {layer.risk}
                  </span>
                </button>
                {isOpen ? (
                  <ul className="space-y-2 border-t border-[#f4f4f5] px-3 py-3">
                    {layer.entries.map((e) => {
                      const sev = severityStyles(e.severity);
                      return (
                        <li
                          key={e.id}
                          className="flex gap-2 rounded-md border border-[#f4f4f5] bg-[#fafafa]/80 px-2.5 py-2 text-sm"
                        >
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${sev.dot}`} aria-hidden />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <span className="font-semibold text-[#18181b]">{e.label}</span>
                              {e.source_session_id ? (
                                <Link
                                  href={`/reports/${e.source_session_id}`}
                                  className="text-[11px] font-semibold text-[#7c3aed] hover:underline"
                                >
                                  View session report
                                </Link>
                              ) : null}
                            </div>
                            {e.detail ? <p className={`mt-0.5 text-xs leading-relaxed ${sev.text}`}>{e.detail}</p> : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {!compact ? (
        <div className="mt-6 rounded-lg border border-[#ede9fe] bg-[#faf5ff]/50 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#5b21b6]">
            <span className="material-symbols-outlined text-[20px]">smart_toy</span>
            HexStrike AI &amp; agent surfaces
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-[#6d28d9]/90">
            Automated pentesting and QA agents add non-traditional entry points — include these in scope alongside
            classic web and API tests.
          </p>
          <ul className="mt-3 space-y-2">
            {data.hexstrike_ai_entries.map((e) => {
              const sev = severityStyles(e.severity);
              return (
                <li key={e.id} className="flex gap-2 rounded-md border border-white/80 bg-white/90 px-3 py-2 text-sm shadow-sm">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${sev.dot}`} aria-hidden />
                  <div>
                    <span className="font-semibold text-[#18181b]">{e.label}</span>
                    <p className={`mt-0.5 text-xs leading-relaxed ${sev.text}`}>{e.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {!compact ? (
        <div className="mt-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#71717a]">Example attack paths</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-1 lg:grid-cols-3">
            {data.attack_paths.map((p) => (
              <div key={p.id} className="rounded-lg border border-[#e4e4e7] bg-[#fafafa] p-4">
                <p className="text-sm font-bold text-[#18181b]">{p.title}</p>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-[#7c3aed]">{p.description}</p>
                <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-[#3f3f46]">
                  {p.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
