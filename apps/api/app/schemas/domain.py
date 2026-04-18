from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class SessionItem(BaseModel):
    id: str
    title: str
    # Host / target label for session table (e.g. prod-api-v2.internal)
    target: str = ""
    # Short public id, e.g. SX-88219
    display_id: str = ""
    status: Literal["running", "completed", "failed"]
    tool_count: int
    created_at: datetime
    # Table badges
    findings_crit: int = 0
    findings_info: int = 0
    # Material icon name for session table (dns, cloud, shield, …)
    table_icon: str | None = None


class VulnerabilityLogItem(BaseModel):
    id: str
    severity: Literal["critical", "high", "medium", "low"]
    cve: str
    title: str
    category: str
    description: str
    cvss: float
    exploited: str = "No"
    fix_available: bool = True


class ReportDetail(BaseModel):
    id: str
    session_id: str
    title: str
    summary: str
    severity_high: int = 0
    severity_medium: int = 0
    severity_low: int = 0
    findings: list[str] = Field(default_factory=list)
    created_at: datetime
    # Extended session report (stitch / operator UI)
    target_host: str = ""
    primary_ip: str = ""
    risk_score: float = 0.0
    agent: str = "Obsidian-V4"
    scan_duration: str = "14m 22s"
    packets_sent: str = "1.2M"
    total_vulns: int = 0
    severity_critical: int = 0
    vulnerability_logs: list[VulnerabilityLogItem] = Field(default_factory=list)
    audit_date_label: str = ""


class SessionTerminalLogLine(BaseModel):
    time: str
    message: str


class SessionLogsResponse(BaseModel):
    session_id: str
    lines: list[SessionTerminalLogLine]


class SessionDashboardStats(BaseModel):
    total_scans: int
    total_scans_trend_pct: int
    vulnerabilities_found: int
    critical_active: int
    avg_time_to_breach: str
    avg_time_subtext: str


class ThreatSurfaceEntry(BaseModel):
    id: str
    label: str
    detail: str = ""
    severity: Literal["info", "low", "medium", "high", "critical"] = "info"
    source_session_id: str | None = None


class ThreatSurfaceLayer(BaseModel):
    id: str
    title: str
    subtitle: str
    icon: str
    risk: Literal["low", "medium", "high", "critical"]
    entries: list[ThreatSurfaceEntry]


class ThreatEvolutionPoint(BaseModel):
    label: str
    date_iso: str
    cumulative_pressure: int
    delta: int


class ThreatAttackPath(BaseModel):
    id: str
    title: str
    description: str
    steps: list[str]


class ThreatSurfaceResponse(BaseModel):
    headline: str
    workspace_summary: str
    layers: list[ThreatSurfaceLayer]
    evolution: list[ThreatEvolutionPoint]
    attack_paths: list[ThreatAttackPath]
    hexstrike_ai_entries: list[ThreatSurfaceEntry]


class ChatMessage(BaseModel):
    id: str
    role: Literal["user", "assistant", "system"]
    content: str
    created_at: datetime


class ToolFlag(BaseModel):
    """A toggleable CLI fragment for the configuration panel."""

    id: str
    label: str
    # Single flag or multi-token fragment, e.g. -sV, -T4, --script vuln
    cli: str
    default_on: bool = False
    # If True, the checkbox must be on to execute (optional vs required in UI)
    required: bool = False


class ToolItem(BaseModel):
    id: str
    # Short name shown on cards (e.g. nmap)
    name: str
    version: str
    description: str
    category: str
    # Material Symbols Outlined ligature name
    icon: str = "extension"
    # Small tag chips (Network, Discovery, …)
    tags: list[str] = Field(default_factory=list)
    # Which filter tabs include this: recon, network, web, binary, osint
    filter_tags: list[str] = Field(default_factory=list)
    integrated: bool = True
    # First token of the built command
    command_binary: str
    # Execution toggles; empty = simple {binary} {target}
    flags: list[ToolFlag] = Field(default_factory=list)


class ToolExecuteRequest(BaseModel):
    tool_id: str
    target: str = Field(min_length=1, max_length=2048)
    # Flag id -> enabled
    flag_values: dict[str, bool] = Field(default_factory=dict)
    # Optional user-supplied suffix (quoted safely when parsed)
    extra_args: str = Field(default="", max_length=2000)


class ToolLogLine(BaseModel):
    time: str  # local HH:MM
    message: str


class ToolExecuteResult(BaseModel):
    command: str
    run_id: str
    status: str  # "queued" | "completed"
    message: str
    new_logs: list[ToolLogLine]
    recent_logs: list[ToolLogLine]
    # Machine-readable run output for downstream AI / humanization
    result_json: dict[str, Any]


class ToolCommandPreview(BaseModel):
    command: str
