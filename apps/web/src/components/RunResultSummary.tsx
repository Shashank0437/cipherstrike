"use client";

import type { ReactNode } from "react";

const primary = "#684cb6";
const onSurface = "#30323e";
const onVariant = "#5d5e6c";
const border = "#e4e2ef";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function s(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && !Number.isNaN(v) ? v : undefined;
}

function bool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

type Props = {
  data: unknown;
  /** Tighter max height in dense layouts */
  compact?: boolean;
  /** Let content grow; parent should scroll (e.g. run modal) */
  unbounded?: boolean;
  className?: string;
};

/**
 * Renders API `result_json` as a security-operator-style summary. Extend this
 * component as new `tool_id` / schema shapes are added; no raw JSON in the UI.
 */
export function RunResultSummary({ data, compact, unbounded, className }: Props) {
  if (data == null) {
    return null;
  }
  if (!isRecord(data)) {
    return (
      <p className="text-sm" style={{ color: onVariant }}>
        Run completed. Detailed results will appear here once the tool integration returns structured data.
      </p>
    );
  }

  // Future: server may provide a pre-written narrative
  const humanOverride = s(data.human_report) ?? s(data.narrative) ?? s(data.executive_summary);

  const runId = s(data.run_id);
  const toolName = s(data.tool_name) ?? s(data.tool_id) ?? "Tool run";
  const target = s(data.target);
  const status = s(data.status);
  const summary = s(data.summary);
  const synthetic = data.synthetic === true;

  const nmap = isRecord(data.nmap_style) ? data.nmap_style : null;
  const sqlmap = isRecord(data.sqlmap_style) ? data.sqlmap_style : null;
  const output = isRecord(data.output) ? data.output : null;
  const genericMessage = s(output?.message);

  return (
    <div
      className={
        (unbounded
          ? ""
          : compact
            ? "max-h-56 overflow-y-auto "
            : "max-h-64 overflow-y-auto ") +
        "rounded-lg border p-3 text-left " +
        (className ?? "")
      }
      style={{
        borderColor: border,
        background: "#fbf8ff",
      }}
      data-testid="run-result-summary"
    >
      <div className="mb-2 border-b border-[#e8e5f0] pb-2">
        <h3 className="text-sm font-bold" style={{ color: onSurface }}>
          Run summary
        </h3>
        <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs" style={{ color: onVariant }}>
          {runId && (
            <>
              <dt className="font-medium" style={{ color: onSurface }}>
                Run
              </dt>
              <dd className="font-mono" style={{ color: primary }}>
                {runId}
              </dd>
            </>
          )}
          <dt className="font-medium" style={{ color: onSurface }}>
            Tool
          </dt>
          <dd className="capitalize">{toolName}</dd>
          {target && (
            <>
              <dt className="font-medium" style={{ color: onSurface }}>
                Target
              </dt>
              <dd className="break-all font-mono text-[0.7rem]">{target}</dd>
            </>
          )}
          {status && (
            <>
              <dt className="font-medium" style={{ color: onSurface }}>
                Status
              </dt>
              <dd className="capitalize text-emerald-800">{status}</dd>
            </>
          )}
        </dl>
      </div>

      {humanOverride && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: onSurface }}>
          {humanOverride}
        </p>
      )}

      {!humanOverride && summary && (
        <p className="text-sm leading-relaxed" style={{ color: onSurface }}>
          {summary}
        </p>
      )}

      {nmap && <NmapSection data={nmap} />}
      {sqlmap && <SqlmapSection data={sqlmap} />}

      {!nmap && !sqlmap && genericMessage && !humanOverride && (
        <p className="mt-2 text-sm" style={{ color: onSurface }}>
          {genericMessage}
        </p>
      )}

      {!humanOverride && !summary && !nmap && !sqlmap && !genericMessage && (
        <p className="text-sm" style={{ color: onVariant }}>
          The job finished successfully. Detailed finding text will be shown when your backend supplies it in this
          result object.
        </p>
      )}

      {synthetic && (
        <p
          className="mt-3 border-t border-[#e8e5f0] pt-2 text-[0.65rem] leading-snug"
          style={{ color: onVariant }}
        >
          Live scan output is not included in this build. When a worker is connected, this summary will be driven by
          real tool data while the same payload remains available to your agent API.
        </p>
      )}
    </div>
  );
}

function NmapSection({ data }: { data: Record<string, unknown> }): ReactNode {
  const host = isRecord(data.host) ? data.host : null;
  const addr = s(host?.addr) ?? s(host?.ip);
  const state = s(host?.state);
  const ports = Array.isArray(data.ports) ? data.ports : [];
  const scripts = Array.isArray(data.script_output) ? data.script_output : [];

  return (
    <div className="mt-3">
      <h4 className="text-xs font-semibold" style={{ color: onSurface }}>
        Host &amp; ports
      </h4>
      {addr && (
        <p className="mt-1 text-xs" style={{ color: onSurface }}>
          Host <span className="font-mono">{addr}</span>
          {state && (
            <span>
              {" "}
              is <span className="font-medium capitalize">{state}</span>
            </span>
          )}
        </p>
      )}
      {ports.length > 0 && (
        <ul className="mt-2 list-none space-y-1.5">
          {ports.map((p, i) => {
            if (!isRecord(p)) return null;
            const prt = num(p.port);
            const st = s(p.state);
            const service = s(p.service);
            const version = s(p.version);
            const line =
              prt != null
                ? `Port ${prt}/tcp${st ? ` ${st}` : ""}` +
                  (service ? ` — ${service}` : "") +
                  (version ? ` (${version})` : "")
                : "Service entry";
            return (
              <li
                key={i}
                className="rounded border px-2 py-1.5 text-xs"
                style={{ borderColor: border, color: onSurface, background: "#fff" }}
              >
                {line}
              </li>
            );
          })}
        </ul>
      )}

      {scripts.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-semibold" style={{ color: onSurface }}>
            Noteworthy findings
          </h4>
          <ul className="mt-1.5 list-none space-y-1.5">
            {scripts.map((r, i) => {
              if (!isRecord(r)) return null;
              const sev = s(r.severity) ?? "info";
              const msg = s(r.message) ?? s(r.id) ?? "Item";
              return (
                <li
                  key={i}
                  className="text-xs"
                  style={{ color: onSurface }}
                >
                  <span
                    className="mr-1.5 inline-block rounded px-1.5 py-0.5 font-semibold uppercase"
                    style={{
                      color: sev === "high" || sev === "critical" ? "#9f1239" : onVariant,
                      background: sev === "high" || sev === "critical" ? "#ffe4e6" : "#f0eeff",
                      fontSize: "0.6rem",
                    }}
                  >
                    {sev}
                  </span>
                  {msg}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function SqlmapSection({ data }: { data: Record<string, unknown> }): ReactNode {
  const vulnerable = bool(data.vulnerable) ?? null;
  const params = Array.isArray(data.parameters_tested)
    ? data.parameters_tested.filter((x) => typeof x === "string")
    : [];
  const inj = data.injection_type;

  return (
    <div className="mt-3">
      <h4 className="text-xs font-semibold" style={{ color: onSurface }}>
        SQL injection check
      </h4>
      <p className="mt-1 text-sm" style={{ color: onSurface }}>
        {vulnerable === true && "Potential SQL injection was indicated for the tested surface."}
        {vulnerable === false && "No SQL injection was indicated in this result for the tested parameters."}
        {vulnerable === null && "Injection risk could not be classified from this payload."}
      </p>
      {params.length > 0 && (
        <p className="mt-1 text-xs" style={{ color: onVariant }}>
          Parameters exercised: {params.join(", ")}
        </p>
      )}
      {inj != null && inj !== "null" && String(inj) !== "null" && (
        <p className="mt-1 text-xs" style={{ color: onVariant }}>
          Injection class: {typeof inj === "string" ? inj : String(inj)}
        </p>
      )}
    </div>
  );
}
