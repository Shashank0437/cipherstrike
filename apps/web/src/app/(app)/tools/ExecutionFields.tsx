"use client";

import type { ComponentPropsWithoutRef } from "react";
import { ArsenalToolIcon } from "@/components/ArsenalIcon";

const primary = "#684cb6";
const onSurface = "#30323e";
const onVariant = "#5d5e6c";
const border = "#e4e2ef";
const surface = "#ffffff";

export type ToolFlagT = {
  id: string;
  label: string;
  cli: string;
  default_on: boolean;
  required?: boolean;
};

type ToolT = {
  id: string;
  name: string;
  icon: string;
  flags: ToolFlagT[];
};

type Props = {
  tool: ToolT;
  target: string;
  onTargetChange: (v: string) => void;
  flagValues: Record<string, boolean>;
  onFlagToggle: (id: string) => void;
  extraArgs: string;
  onExtraArgsChange: (v: string) => void;
  showHeader?: boolean;
} & ComponentPropsWithoutRef<"div">;

export function ExecutionFields({
  tool,
  target,
  onTargetChange,
  flagValues,
  onFlagToggle,
  extraArgs,
  onExtraArgsChange,
  showHeader = true,
  className,
  ...rest
}: Props) {
  return (
    <div className={className} {...rest}>
      {showHeader && (
        <div className="mb-2 flex items-start gap-2 border-b border-[#e8e5f0] pb-3">
          <div
            className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: "#f4f2fe" }}
          >
            <ArsenalToolIcon name={tool.icon} className="text-[#684cb6]" size={20} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold" style={{ color: onSurface }}>
              {tool.name} engine
            </p>
            <p className="truncate text-xs" style={{ color: primary }}>
              Target: {target || "—"}
            </p>
          </div>
        </div>
      )}

      <div className="mb-0.5 mt-1 text-sm font-medium" style={{ color: onSurface }}>
        Target <span className="text-red-600">*</span>
      </div>
      <input
        className="mb-2 w-full rounded-lg border border-[#e4e2ef] px-3 py-2 text-sm text-[#30323e] outline-none focus:ring-2 focus:ring-[#684cb6]/25"
        value={target}
        onChange={(e) => onTargetChange(e.target.value)}
        placeholder="192.168.1.0/24 or URL for sqlmap"
        spellCheck={false}
        required
        aria-label="Target"
      />

      {tool.flags.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 text-sm font-medium" style={{ color: onSurface }}>
            Execution flags
          </div>
          <ul className="space-y-0.5">
            {tool.flags.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-2 rounded-md py-0.5 text-sm"
                style={{ color: onSurface }}
              >
                <span className="pr-1 text-xs" style={{ color: onVariant }}>
                  {f.label}
                  {f.required && <span className="ml-0.5 text-red-500">*</span>}
                </span>
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 cursor-pointer rounded border-2 border-[#e4e2ef] accent-[#684cb6]"
                  checked={flagValues[f.id] ?? f.default_on}
                  onChange={() => onFlagToggle(f.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-0.5 text-sm font-medium" style={{ color: onSurface }}>
        Extra CLI (optional)
      </div>
      <textarea
        className="mb-1 w-full min-h-[2.5rem] resize-y rounded-lg border border-[#e4e2ef] bg-white px-3 py-2 text-xs text-[#30323e] outline-none focus:ring-2 focus:ring-[#684cb6]/25"
        value={extraArgs}
        onChange={(e) => onExtraArgsChange(e.target.value)}
        placeholder="Additional arguments (split like shell: e.g. -p 22,80)"
        rows={2}
        spellCheck={false}
        aria-label="Optional extra command-line arguments"
      />
      <p className="text-[0.65rem] leading-snug" style={{ color: onVariant }}>
        Appended to the command after the built-in flags. Parsed for preview; a worker can enforce a policy in production.
      </p>
    </div>
  );
}

export { onSurface, onVariant, border, surface, primary };
