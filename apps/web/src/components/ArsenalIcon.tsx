import { Icon } from "@iconify/react";

/**
 * Maps API `icon` keys (Stitch / Material name style) to Iconify `material-symbols` ids.
 * Same design family as Stitch HTML (`<span class="material-symbols-outlined">…</span>`).
 */
const MATERIAL_SYMBOL: Record<string, string> = {
  search: "material-symbols:search",
  cell_tower: "material-symbols:cell-tower",
  database: "material-symbols:database",
  shield: "material-symbols:shield",
  key: "material-symbols:key",
  language: "material-symbols:language",
  /* wireshark & network */
  lan: "material-symbols:lan",
  wifi: "material-symbols:wifi",
  /* nikto / web scan: no separate captive_portal in Iconify; use web server / HTTP */
  captive_portal: "material-symbols:troubleshoot",
  http: "material-symbols:http",
  extension: "material-symbols:extension",
  sensors: "material-symbols:radar",
  radar: "material-symbols:radar",
  speed: "material-symbols:speed",
  appwindow: "material-symbols:web-asset",
};

const FALLBACK = "material-symbols:deployed-code";

function resolveIconId(name: string): string {
  const t = (name || "").trim();
  if (MATERIAL_SYMBOL[t]) {
    return MATERIAL_SYMBOL[t]!;
  }
  const kebab = t.replace(/_/g, "-");
  if (!kebab) {
    return FALLBACK;
  }
  return `material-symbols:${kebab}`;
}

/**
 * Renders official Material Symbols paths (via Iconify) so icons match Stitch’s
 * Google design set — not generic Lucide substitutes.
 */
export function ArsenalToolIcon({
  name,
  className,
  size = 20,
  "aria-hidden": a11y = true,
}: {
  name: string;
  className?: string;
  size?: number;
  "aria-hidden"?: boolean;
}) {
  return (
    <Icon
      icon={resolveIconId(name)}
      width={size}
      height={size}
      className={className}
      style={{ minWidth: size, minHeight: size }}
      aria-hidden={a11y}
    />
  );
}
