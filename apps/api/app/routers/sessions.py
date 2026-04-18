from datetime import UTC, datetime
from typing import Any, Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.db import get_db
from app.deps import get_current_user_id
from app.schemas.domain import (
    SessionDashboardStats,
    SessionItem,
    SessionLogsResponse,
    SessionTerminalLogLine,
    ThreatAttackPath,
    ThreatEvolutionPoint,
    ThreatSurfaceEntry,
    ThreatSurfaceLayer,
    ThreatSurfaceResponse,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _display_id(oid: Any) -> str:
    return f"SX-{str(oid)[-5:].upper()}"


def _default_terminal_logs() -> list[dict[str, str]]:
    return [
        {"time": "14:02:01", "message": "[agent] session bootstrap — target resolved"},
        {"time": "14:02:04", "message": "[nmap] starting discovery against primary host…"},
        {"time": "14:05:12", "message": "[nmap] 2 open TCP ports (22, 443) — see report"},
        {"time": "14:08:44", "message": "[scanner] WAF check — edge rule set v4 applied"},
        {"time": "14:11:02", "message": "[agent] policy gate — medium findings below threshold, continuing"},
        {"time": "14:14:22", "message": "[orchestrator] run completed, report indexed"},
    ]


def _failed_terminal_logs(reason: str) -> list[dict[str, str]]:
    return [
        {"time": "14:02:01", "message": "[agent] session bootstrap — target resolved"},
        {"time": "14:04:18", "message": "[orchestrator] scan phase started"},
        {"time": "14:09:55", "message": f"[error] run aborted — {reason}"},
        {"time": "14:10:02", "message": "[orchestrator] partial artifacts retained; see report for captured findings"},
    ]


def _session_doc(
    user_id: str,
    title: str,
    st: str,
    tool_count: int,
    **extra: Any,
) -> dict[str, Any]:
    now = datetime.now(UTC)
    doc: dict[str, Any] = {
        "user_id": user_id,
        "title": title,
        "status": st,
        "tool_count": tool_count,
        "created_at": now,
        "updated_at": now,
    }
    doc.update(extra)
    if "target" not in doc:
        doc["target"] = title
    if "findings_crit" not in doc:
        doc["findings_crit"] = 0
    if "findings_info" not in doc:
        doc["findings_info"] = 0
    if "terminal_logs" not in doc:
        doc["terminal_logs"] = _default_terminal_logs()
    return doc


def _doc_to_item(doc: dict) -> SessionItem:
    return SessionItem(
        id=str(doc["_id"]),
        title=doc["title"],
        target=doc.get("target", doc["title"]),
        display_id=doc.get("display_id") or _display_id(doc["_id"]),
        status=doc["status"],
        tool_count=doc["tool_count"],
        created_at=doc["created_at"],
        findings_crit=int(doc.get("findings_crit", 0)),
        findings_info=int(doc.get("findings_info", 0)),
        table_icon=doc.get("table_icon"),
    )


async def _list_sessions_impl(user_id: str) -> list[SessionItem]:
    db = get_db()
    cursor = db.sessions.find({"user_id": user_id}).sort("created_at", -1).limit(200)
    return [_doc_to_item(d) async for d in cursor]


@router.get("/summary", response_model=SessionDashboardStats)
async def session_dashboard_stats(
    user_id: str = Depends(get_current_user_id),
) -> SessionDashboardStats:
    """Headline numbers for the session history dashboard (stitch)."""
    db = get_db()
    n = await db.sessions.count_documents({"user_id": user_id})
    crit = await db.sessions.count_documents({"user_id": user_id, "findings_crit": {"$gt": 0}})
    if n == 0:
        return SessionDashboardStats(
            total_scans=0,
            total_scans_trend_pct=0,
            vulnerabilities_found=0,
            critical_active=0,
            avg_time_to_breach="—",
            avg_time_subtext="No scans yet",
        )
    return SessionDashboardStats(
        total_scans=n,
        total_scans_trend_pct=12,
        vulnerabilities_found=max(1, n * 8),
        critical_active=min(8, crit or 1),
        avg_time_to_breach="14m 22s",
        avg_time_subtext="Optimized by AI",
    )


def _risk_from_counts(crit: int, info: int) -> Literal["low", "medium", "high", "critical"]:
    if crit > 0:
        return "critical" if crit > 1 else "high"
    if info > 8:
        return "high"
    if info > 0:
        return "medium"
    return "low"


def _build_threat_surface_from_docs(docs: list[dict[str, Any]]) -> ThreatSurfaceResponse:
    """Structured attack-surface view derived from workspace sessions + HexStrike product model."""
    n = len(docs)
    total_crit = sum(int(d.get("findings_crit", 0) or 0) for d in docs)
    total_info = sum(int(d.get("findings_info", 0) or 0) for d in docs)

    # Evolution: chronological cumulative "pressure" (findings + tool activity)
    evolution: list[ThreatEvolutionPoint] = []
    cumulative = 0
    sorted_docs = sorted(docs, key=lambda d: d.get("created_at") or datetime.min.replace(tzinfo=UTC))
    for d in sorted_docs:
        crit = int(d.get("findings_crit", 0) or 0)
        info = int(d.get("findings_info", 0) or 0)
        tools = int(d.get("tool_count", 0) or 0)
        delta = crit * 10 + min(info, 40) + min(tools // 4, 25)
        cumulative += delta
        ca = d.get("created_at")
        date_iso = ca.isoformat() if hasattr(ca, "isoformat") else datetime.now(UTC).isoformat()
        evolution.append(
            ThreatEvolutionPoint(
                label=str(d.get("display_id") or _display_id(d.get("_id", ""))),
                date_iso=date_iso,
                cumulative_pressure=cumulative,
                delta=delta,
            )
        )

    if not evolution:
        evolution = [
            ThreatEvolutionPoint(
                label="—",
                date_iso=datetime.now(UTC).isoformat(),
                cumulative_pressure=0,
                delta=0,
            )
        ]

    max_p = max((e.cumulative_pressure for e in evolution), default=1)

    # Map sessions to layers by keyword (title/target)
    external_dyn: list[ThreatSurfaceEntry] = []
    internal_dyn: list[ThreatSurfaceEntry] = []
    app_dyn: list[ThreatSurfaceEntry] = []
    infra_dyn: list[ThreatSurfaceEntry] = []
    human_dyn: list[ThreatSurfaceEntry] = []

    for idx, d in enumerate(docs):
        title = str(d.get("title") or d.get("target") or "Session")
        t = title.lower()
        sid_s = str(d["_id"])
        crit = int(d.get("findings_crit", 0) or 0)
        info = int(d.get("findings_info", 0) or 0)
        sev = _risk_from_counts(crit, info)
        if any(k in t for k in ("perimeter", "external", "surface", "cve", "web tier")):
            external_dyn.append(
                ThreatSurfaceEntry(
                    id=f"ext-{sid_s}",
                    label=title[:80],
                    detail=f"Observed in scan · {crit} critical, {info} other findings",
                    severity=sev,
                    source_session_id=sid_s,
                )
            )
        elif any(k in t for k in ("staging", "api fuzz", "internal")):
            internal_dyn.append(
                ThreatSurfaceEntry(
                    id=f"int-{sid_s}",
                    label=title[:80],
                    detail="Post-perimeter / internal API exposure",
                    severity=sev,
                    source_session_id=sid_s,
                )
            )
        elif "shadow" in t or "sweep" in t:
            app_dyn.append(
                ThreatSurfaceEntry(
                    id=f"app-{sid_s}",
                    label=title[:80],
                    detail="Application-layer test coverage",
                    severity=sev,
                    source_session_id=sid_s,
                )
            )
        else:
            infra_dyn.append(
                ThreatSurfaceEntry(
                    id=f"inf-{sid_s}",
                    label=title[:80],
                    detail="Infrastructure / orchestration touchpoint",
                    severity=sev,
                    source_session_id=sid_s,
                )
            )

        if d.get("status") == "failed":
            human_dyn.append(
                ThreatSurfaceEntry(
                    id=f"hum-{sid_s}",
                    label=f"Operational signal: {title[:60]}",
                    detail="Failed run — review credentials, rate limits, or policy gates",
                    severity="medium",
                    source_session_id=sid_s,
                )
            )

    layers: list[ThreatSurfaceLayer] = [
        ThreatSurfaceLayer(
            id="external",
            title="External attack surface",
            subtitle="Public-facing assets reachable from the internet",
            icon="public",
            risk="high" if external_dyn or total_crit else "medium",
            entries=[
                ThreatSurfaceEntry(
                    id="ext-static-1",
                    label="Domains & subdomains",
                    detail="DNS and certificate discovery; apex and wildcard coverage",
                    severity="info",
                ),
                ThreatSurfaceEntry(
                    id="ext-static-2",
                    label="REST / GraphQL APIs",
                    detail="Versioned endpoints, auth schemes, and schema introspection",
                    severity="medium",
                ),
                ThreatSurfaceEntry(
                    id="ext-static-3",
                    label="Web apps (login, upload, forms)",
                    detail="XSS/CSRF and file upload pipelines",
                    severity="high",
                ),
                ThreatSurfaceEntry(
                    id="ext-static-4",
                    label="Open ports & edge services",
                    detail="SSH, HTTPS, mail, and misconfigured load balancers",
                    severity="medium",
                ),
                *external_dyn,
            ],
        ),
        ThreatSurfaceLayer(
            id="internal",
            title="Internal attack surface",
            subtitle="Exposure after initial access or from trusted networks",
            icon="lan",
            risk="high" if internal_dyn else "medium",
            entries=[
                ThreatSurfaceEntry(
                    id="int-static-1",
                    label="Internal APIs & admin panels",
                    detail="Service mesh, internal gateways, and debug routes",
                    severity="high",
                ),
                ThreatSurfaceEntry(
                    id="int-static-2",
                    label="Service-to-service traffic",
                    detail="mTLS gaps, plaintext hops, and replay between services",
                    severity="medium",
                ),
                ThreatSurfaceEntry(
                    id="int-static-3",
                    label="IAM & roles",
                    detail="Over-privileged roles, shadow access, and federation",
                    severity="critical",
                ),
                *internal_dyn,
            ],
        ),
        ThreatSurfaceLayer(
            id="application",
            title="Application layer",
            subtitle="Logic and input surfaces",
            icon="web_asset",
            risk="high" if total_crit else "medium",
            entries=[
                ThreatSurfaceEntry(
                    id="app-static-1",
                    label="Authentication & session flows",
                    detail="OAuth/OIDC, refresh tokens, and session fixation",
                    severity="high",
                ),
                ThreatSurfaceEntry(
                    id="app-static-2",
                    label="Inputs & parsers",
                    detail="SQLi, NoSQLi, XSS, deserialization",
                    severity="critical",
                ),
                ThreatSurfaceEntry(
                    id="app-static-3",
                    label="Business logic",
                    detail="IDOR, workflow bypass, and race conditions",
                    severity="high",
                ),
                *app_dyn,
            ],
        ),
        ThreatSurfaceLayer(
            id="infrastructure",
            title="Infrastructure layer",
            subtitle="Cloud, containers, and delivery",
            icon="cloud",
            risk="medium",
            entries=[
                ThreatSurfaceEntry(
                    id="infra-static-1",
                    label="Cloud resources (AWS/GCP/Azure)",
                    detail="Storage buckets, metadata APIs, and network ACLs",
                    severity="high",
                ),
                ThreatSurfaceEntry(
                    id="infra-static-2",
                    label="Containers & Kubernetes",
                    detail="Image pulls, admission control, and secrets in manifests",
                    severity="high",
                ),
                ThreatSurfaceEntry(
                    id="infra-static-3",
                    label="CI/CD & build pipelines",
                    detail="Poisoned dependencies, runner tokens, and supply chain",
                    severity="medium",
                ),
                ThreatSurfaceEntry(
                    id="infra-static-4",
                    label="Secrets storage",
                    detail="Vaults, KMS, and leaked env vars",
                    severity="critical",
                ),
                *infra_dyn,
            ],
        ),
        ThreatSurfaceLayer(
            id="human_process",
            title="Human & process surface",
            subtitle="Social engineering and operational hygiene",
            icon="groups",
            risk="medium" if human_dyn else "low",
            entries=[
                ThreatSurfaceEntry(
                    id="hum-static-1",
                    label="Phishing & pretext",
                    detail="Operator and developer credentials",
                    severity="medium",
                ),
                ThreatSurfaceEntry(
                    id="hum-static-2",
                    label="Password & MFA policy",
                    detail="Weak defaults and missing MFA on privileged accounts",
                    severity="medium",
                ),
                ThreatSurfaceEntry(
                    id="hum-static-3",
                    label="Token leakage in logs",
                    detail="Bearer tokens and API keys in CI or app logs",
                    severity="high",
                ),
                *human_dyn,
            ],
        ),
    ]

    attack_paths = [
        ThreatAttackPath(
            id="path-1",
            title="Prompt injection → tool misuse",
            description="HexStrike AI / agent platforms",
            steps=[
                "Malicious prompt in test case or chat",
                "Model invokes tool or API with elevated context",
                "Lateral movement to internal orchestration or results store",
            ],
        ),
        ThreatAttackPath(
            id="path-2",
            title="File upload → agent execution",
            description="Test artifacts and scripts",
            steps=[
                "Upload malicious payload as test data",
                "Runner executes in shared sandbox or mis-scoped environment",
                "Credential or network access from runner identity",
            ],
        ),
        ThreatAttackPath(
            id="path-3",
            title="Weak session boundary → runner access",
            description="Auth and session management",
            steps=[
                "Session fixation or token theft on dashboard",
                "Access to test runner or queued jobs",
                "Read sensitive results or trigger destructive runs",
            ],
        ),
    ]

    hexstrike_ai = [
        ThreatSurfaceEntry(
            id="ai-1",
            label="Prompt inputs",
            detail="Prompt injection, jailbreaks, and instruction override",
            severity="critical",
        ),
        ThreatSurfaceEntry(
            id="ai-2",
            label="Model outputs",
            detail="Data leakage in summaries and retrieved context",
            severity="high",
        ),
        ThreatSurfaceEntry(
            id="ai-3",
            label="Tool-calling & agent APIs",
            detail="Abuse of orchestration, MCP, or agent execution endpoints",
            severity="critical",
        ),
        ThreatSurfaceEntry(
            id="ai-4",
            label="Integration webhooks",
            detail="CI/CD, Slack, Jira — forged callbacks and replay",
            severity="medium",
        ),
    ]

    summary = (
        f"{n} workspace session(s) indexed; {total_crit} critical and {total_info} other findings "
        f"across discoverable layers. Surface pressure peaks at {max_p} (cumulative)."
        if n
        else "No sessions yet — map shows standard pentest layers; run scans to attach live targets."
    )

    return ThreatSurfaceResponse(
        headline="Where can we attack?",
        workspace_summary=summary,
        layers=layers,
        evolution=evolution,
        attack_paths=attack_paths,
        hexstrike_ai_entries=hexstrike_ai,
    )


@router.get("/threat-surface", response_model=ThreatSurfaceResponse)
async def threat_surface_map(
    user_id: str = Depends(get_current_user_id),
) -> ThreatSurfaceResponse:
    """Structured threat / attack surface map with evolution from workspace sessions."""
    db = get_db()
    cursor = db.sessions.find({"user_id": user_id}).sort("created_at", 1).limit(200)
    docs = [d async for d in cursor]
    return _build_threat_surface_from_docs(docs)


@router.get("", response_model=list[SessionItem])
async def list_sessions(user_id: str = Depends(get_current_user_id)) -> list[SessionItem]:
    return await _list_sessions_impl(user_id)


DEMO_SESSION_TS = datetime(2026, 4, 18, 16, 31, 0, tzinfo=UTC)


def _four_demo_sessions(user_id: str) -> list[dict[str, Any]]:
    """Exactly four rows: 2 completed, 2 failed — matches Stitch session history dummy data."""
    return [
        _session_doc(
            user_id,
            "Shadow Ops — perimeter scan",
            "completed",
            12,
            target="Shadow Ops — perimeter scan",
            display_id="SX-30312",
            findings_crit=1,
            findings_info=12,
            table_icon="dns",
            created_at=DEMO_SESSION_TS,
            updated_at=DEMO_SESSION_TS,
        ),
        _session_doc(
            user_id,
            "CVE sweep — web tier",
            "completed",
            147,
            target="CVE sweep — web tier",
            display_id="SX-30314",
            findings_crit=0,
            findings_info=4,
            table_icon="dns",
            created_at=DEMO_SESSION_TS,
            updated_at=DEMO_SESSION_TS,
        ),
        _session_doc(
            user_id,
            "API fuzz — staging",
            "failed",
            3,
            target="API fuzz — staging",
            display_id="SX-30313",
            findings_crit=0,
            findings_info=0,
            table_icon="cloud",
            terminal_logs=_failed_terminal_logs("credential rate-limit exceeded on staging API"),
            created_at=DEMO_SESSION_TS,
            updated_at=DEMO_SESSION_TS,
        ),
        _session_doc(
            user_id,
            "External Surface Scan",
            "failed",
            8,
            target="External Surface Scan",
            display_id="SX-30315",
            findings_crit=0,
            findings_info=2,
            table_icon="shield",
            terminal_logs=_failed_terminal_logs("upstream WAF blocked automated probe traffic"),
            created_at=DEMO_SESSION_TS,
            updated_at=DEMO_SESSION_TS,
        ),
    ]


@router.post("/seed-demo", response_model=list[SessionItem])
async def seed_demo_sessions(
    user_id: str = Depends(get_current_user_id),
    replace: bool = Query(
        False,
        description="If true, delete this user's sessions and reports, then insert the 4 demo sessions.",
    ),
) -> list[SessionItem]:
    """Create four sample sessions (2 complete, 2 failed) when the account has none, or when replace=true."""
    db = get_db()
    count = await db.sessions.count_documents({"user_id": user_id})
    if count > 0 and not replace:
        return await _list_sessions_impl(user_id)

    if replace and count > 0:
        await db.sessions.delete_many({"user_id": user_id})
        await db.reports.delete_many({"user_id": user_id})

    await db.sessions.insert_many(_four_demo_sessions(user_id))
    return await _list_sessions_impl(user_id)


@router.get("/{session_id}/logs", response_model=SessionLogsResponse)
async def session_logs(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
) -> SessionLogsResponse:
    db = get_db()
    try:
        oid = ObjectId(session_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid id",
        ) from exc
    doc = await db.sessions.find_one({"_id": oid, "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    raw = doc.get("terminal_logs")
    if not raw:
        raw = _default_terminal_logs()
    lines: list[SessionTerminalLogLine] = []
    for e in raw:
        if not isinstance(e, dict):
            continue
        t = e.get("time", "")
        m = e.get("message", "")
        lines.append(SessionTerminalLogLine(time=str(t), message=str(m)))
    if not lines:
        lines = [SessionTerminalLogLine(time="--", message="No terminal output captured for this session.")]
    return SessionLogsResponse(session_id=session_id, lines=lines)


@router.get("/{session_id}", response_model=SessionItem)
async def get_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
) -> SessionItem:
    db = get_db()
    try:
        oid = ObjectId(session_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid id",
        ) from exc
    doc = await db.sessions.find_one({"_id": oid, "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return _doc_to_item(doc)
