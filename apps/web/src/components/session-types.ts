export type SessionRow = {
  id: string;
  title: string;
  target: string;
  display_id: string;
  status: "running" | "completed" | "failed";
  tool_count: number;
  created_at: string;
  findings_crit: number;
  findings_info: number;
  /** Material Symbols ligature for the target column (dns, cloud, shield, …) */
  table_icon?: string | null;
};

export type SessionTerminalLogLine = { time: string; message: string };

export type SessionDashboardStats = {
  total_scans: number;
  total_scans_trend_pct: number;
  vulnerabilities_found: number;
  critical_active: number;
  avg_time_to_breach: string;
  avg_time_subtext: string;
};

export type VulnerabilityLog = {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  cve: string;
  title: string;
  category: string;
  description: string;
  cvss: number;
  exploited: string;
  fix_available: boolean;
};

export type ThreatSeverity = "info" | "low" | "medium" | "high" | "critical";

export type ThreatSurfaceEntry = {
  id: string;
  label: string;
  detail: string;
  severity: ThreatSeverity;
  source_session_id: string | null;
};

export type ThreatSurfaceLayer = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  risk: "low" | "medium" | "high" | "critical";
  entries: ThreatSurfaceEntry[];
};

export type ThreatEvolutionPoint = {
  label: string;
  date_iso: string;
  cumulative_pressure: number;
  delta: number;
};

export type ThreatAttackPath = {
  id: string;
  title: string;
  description: string;
  steps: string[];
};

export type ThreatSurfaceResponse = {
  headline: string;
  workspace_summary: string;
  layers: ThreatSurfaceLayer[];
  evolution: ThreatEvolutionPoint[];
  attack_paths: ThreatAttackPath[];
  hexstrike_ai_entries: ThreatSurfaceEntry[];
};

export type ReportDetail = {
  id: string;
  session_id: string;
  title: string;
  summary: string;
  severity_high: number;
  severity_medium: number;
  severity_low: number;
  findings: string[];
  created_at: string;
  target_host: string;
  primary_ip: string;
  risk_score: number;
  agent: string;
  scan_duration: string;
  packets_sent: string;
  total_vulns: number;
  severity_critical: number;
  vulnerability_logs: VulnerabilityLog[];
  audit_date_label: string;
};
