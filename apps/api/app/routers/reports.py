from datetime import UTC, datetime, timedelta
from io import BytesIO
from pathlib import Path
from typing import Annotated, Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from fpdf import FPDF

from app.db import get_db
from app.deps import get_current_user_id
from app.schemas.domain import ReportDetail, VulnerabilityLogItem

router = APIRouter(prefix="/reports", tags=["reports"])

# Sample penetration-test PDF served on session report download (demo / UX parity).
_SAMPLE_REPORT_FILENAME = "Khan_Academy_Penetration_Test_Report.pdf"
_SAMPLE_REPORT_PATH = Path(__file__).resolve().parent.parent / "assets" / _SAMPLE_REPORT_FILENAME


def _sample_pdf_bytes() -> bytes | None:
    if not _SAMPLE_REPORT_PATH.is_file():
        return None
    return _SAMPLE_REPORT_PATH.read_bytes()


def _vuln_template() -> list[dict[str, Any]]:
    return [
        {
            "id": "v1",
            "severity": "critical",
            "cve": "CVE-2023-4421",
            "title": "Unauthenticated Remote Code Execution in API Gateway",
            "category": "Auth Bypass",
            "description": (
                "The target gateway endpoint /v2/proxy fails to validate JWT signatures, "
                "allowing attackers to inject arbitrary shell commands via the X-Forwarded-Exec header."
            ),
            "cvss": 9.8,
            "exploited": "Yes",
            "fix_available": True,
        },
        {
            "id": "v2",
            "severity": "high",
            "cve": "CVE-2023-1102",
            "title": "Information Disclosure: Exposed .env file in Public Root",
            "category": "Exposed Env",
            "description": "Static file handler served .env with DB credentials; confirmed read access.",
            "cvss": 7.5,
            "exploited": "No",
            "fix_available": True,
        },
    ]


def _doc_to_report(doc: dict) -> ReportDetail:
    vuln_raw = doc.get("vulnerability_logs", [])
    vuln: list[VulnerabilityLogItem] = []
    for e in vuln_raw:
        if not isinstance(e, dict):
            continue
        try:
            vuln.append(
                VulnerabilityLogItem(
                    id=str(e.get("id", "")),
                    severity=e["severity"],
                    cve=str(e.get("cve", "")),
                    title=str(e.get("title", "")),
                    category=str(e.get("category", "")),
                    description=str(e.get("description", "")),
                    cvss=float(e.get("cvss", 0)),
                    exploited=str(e.get("exploited", "No")),
                    fix_available=bool(e.get("fix_available", True)),
                )
            )
        except (KeyError, TypeError, ValueError):
            continue
    if not vuln:
        for e in _vuln_template():
            try:
                vuln.append(
                    VulnerabilityLogItem(
                        id=str(e.get("id", "")),
                        severity=e["severity"],
                        cve=str(e.get("cve", "")),
                        title=str(e.get("title", "")),
                        category=str(e.get("category", "")),
                        description=str(e.get("description", "")),
                        cvss=float(e.get("cvss", 0)),
                        exploited=str(e.get("exploited", "No")),
                        fix_available=bool(e.get("fix_available", True)),
                    )
                )
            except (KeyError, TypeError, ValueError):
                continue
    return ReportDetail(
        id=str(doc["_id"]),
        session_id=doc["session_id"],
        title=doc["title"],
        summary=doc["summary"],
        severity_high=int(doc.get("severity_high", 0)),
        severity_medium=int(doc.get("severity_medium", 0)),
        severity_low=int(doc.get("severity_low", 0)),
        findings=list(doc.get("findings", [])),
        created_at=doc["created_at"],
        target_host=str(doc.get("target_host", "")),
        primary_ip=str(doc.get("primary_ip", "")),
        risk_score=float(doc.get("risk_score", 0.0)),
        agent=str(doc.get("agent", "Obsidian-V4")),
        scan_duration=str(doc.get("scan_duration", "14m 22s")),
        packets_sent=str(doc.get("packets_sent", "1.2M")),
        total_vulns=int(doc.get("total_vulns", 0)),
        severity_critical=int(doc.get("severity_critical", 0)),
        vulnerability_logs=vuln,
        audit_date_label=str(doc.get("audit_date_label", "")),
    )


def _default_report_body(sess: dict, session_id: str) -> dict[str, Any]:
    now = datetime.now(UTC)
    vlogs = _vuln_template()
    sc = 2
    sh = 5
    sm = 12
    sl = 5
    total = sc + sh + sm + sl
    target = str(sess.get("target", sess.get("title", "")))
    return {
        "session_id": session_id,
        "title": f"Report — {sess['title']}",
        "summary": (
            "Automated assessment completed. High-severity items require review before lower-priority remediations."
        ),
        "severity_high": sh,
        "severity_medium": sm,
        "severity_low": sl,
        "severity_critical": sc,
        "total_vulns": total,
        "findings": [
            "TLS 1.0 enabled on edge listener (deprecated)",
            "Admin endpoint exposed without rate limiting",
            "Outdated dependency with known CVE (see vulnerability logs)",
        ],
        "created_at": now,
        "target_host": target or "staging-alpha.example.io",
        "primary_ip": "192.168.1.104",
        "risk_score": 8.4,
        "agent": "Obsidian-V4",
        "scan_duration": "14m 22s",
        "packets_sent": "1.2M",
        "vulnerability_logs": vlogs,
        "audit_date_label": now.strftime("Audit conducted on %b %d, %Y"),
    }


# Rich defaults for the four seeded demo sessions (display_id) — distinct summaries and vuln sets.
_DEMO_REPORT_OVERRIDES: dict[str, dict[str, Any]] = {
    "SX-30312": {
        "summary": (
            "Perimeter scan finished with one critical exposure on the edge ingress and multiple "
            "informational findings. Prioritize gateway hardening before expanding scope."
        ),
        "risk_score": 7.8,
        "target_host": "perimeter.shadow-ops.internal",
        "primary_ip": "10.0.14.22",
        "severity_critical": 1,
        "severity_high": 3,
        "severity_medium": 8,
        "severity_low": 4,
        "total_vulns": 16,
        "scan_duration": "22m 08s",
        "packets_sent": "840K",
        "agent": "Obsidian-V4",
        "audit_date_label": "Audit conducted on Apr 18, 2026",
        "findings": [
            "Ingress policy allows overly broad TLS cipher suites (deprecated)",
            "Shadow proxy exposes internal service metadata on /debug",
            "Recommend rotating perimeter API keys within 7 days",
        ],
        "vulnerability_logs": [
            {
                "id": "p1",
                "severity": "critical",
                "cve": "CVE-2024-2201",
                "title": "TLS termination proxy accepts client renegotiation",
                "category": "TLS",
                "description": "Edge listener permits insecure renegotiation, enabling request smuggling attempts.",
                "cvss": 9.1,
                "exploited": "No",
                "fix_available": True,
            },
            {
                "id": "p2",
                "severity": "high",
                "cve": "CVE-2023-44402",
                "title": "Debug endpoint leaks upstream routing table",
                "category": "Info Leak",
                "description": "GET /debug/routes returns internal CIDRs and service names without auth.",
                "cvss": 7.8,
                "exploited": "No",
                "fix_available": True,
            },
            {
                "id": "p3",
                "severity": "medium",
                "cve": "SC-118",
                "title": "Missing HSTS on administrative vhost",
                "category": "Web",
                "description": "Admin UI served without Strict-Transport-Security header.",
                "cvss": 5.3,
                "exploited": "No",
                "fix_available": True,
            },
        ],
    },
    "SX-30314": {
        "summary": (
            "Web-tier CVE sweep completed successfully. Medium findings dominate; schedule dependency "
            "upgrades during the next maintenance window."
        ),
        "risk_score": 6.2,
        "target_host": "web-tier.internal.corp",
        "primary_ip": "172.16.88.40",
        "severity_critical": 0,
        "severity_high": 2,
        "severity_medium": 12,
        "severity_low": 5,
        "total_vulns": 19,
        "scan_duration": "41m 02s",
        "packets_sent": "2.1M",
        "agent": "Obsidian-V4",
        "audit_date_label": "Audit conducted on Apr 18, 2026",
        "findings": [
            "Container base images lag two quarterly patch cycles",
            "JWT validation uses symmetric key shared across services",
            "Rate limiting absent on password-reset endpoint",
        ],
        "vulnerability_logs": [
            {
                "id": "w1",
                "severity": "high",
                "cve": "CVE-2023-5012",
                "title": "Outdated OpenSSL in application container",
                "category": "Dependencies",
                "description": "OpenSSL 1.1.1 series past support; upgrade path documented by vendor.",
                "cvss": 7.5,
                "exploited": "No",
                "fix_available": True,
            },
            {
                "id": "w2",
                "severity": "medium",
                "cve": "CVE-2024-0900",
                "title": "Verbose error pages expose stack traces",
                "category": "Web",
                "description": "500 responses include framework version and file paths.",
                "cvss": 5.4,
                "exploited": "No",
                "fix_available": True,
            },
        ],
    },
    "SX-30313": {
        "summary": (
            "Run aborted before full coverage due to API rate limiting. Partial findings below reflect "
            "artifacts captured prior to termination; re-run with throttled requests or off-peak window."
        ),
        "risk_score": 4.1,
        "target_host": "api.staging.hexstrike.local",
        "primary_ip": "10.50.1.8",
        "severity_critical": 0,
        "severity_high": 0,
        "severity_medium": 1,
        "severity_low": 0,
        "total_vulns": 1,
        "scan_duration": "09m 55s",
        "packets_sent": "312K",
        "agent": "Obsidian-V4",
        "audit_date_label": "Audit conducted on Apr 18, 2026",
        "findings": [
            "Credential stuffing protection triggered mid-scan (expected)",
            "Retry recommended with lower concurrency",
        ],
        "vulnerability_logs": [
            {
                "id": "a1",
                "severity": "medium",
                "cve": "SC-901",
                "title": "Verbose JSON error on auth failure",
                "category": "API",
                "description": "401 responses distinguish invalid user vs bad password, aiding enumeration.",
                "cvss": 5.0,
                "exploited": "No",
                "fix_available": True,
            },
        ],
    },
    "SX-30315": {
        "summary": (
            "External surface enumeration blocked by WAF; limited endpoint visibility. Report reflects "
            "passive observations only. Engage with network team for allowlisting if deeper testing is required."
        ),
        "risk_score": 5.0,
        "target_host": "edge.external-scan.target",
        "primary_ip": "203.0.113.44",
        "severity_critical": 0,
        "severity_high": 0,
        "severity_medium": 0,
        "severity_low": 2,
        "total_vulns": 2,
        "scan_duration": "11m 40s",
        "packets_sent": "180K",
        "agent": "Obsidian-V4",
        "audit_date_label": "Audit conducted on Apr 18, 2026",
        "findings": [
            "WAF blocked 94% of active probes — high false-positive risk on custom payloads",
            "DNS exposes staging subdomain pattern for internal services",
        ],
        "vulnerability_logs": [
            {
                "id": "e1",
                "severity": "low",
                "cve": "SC-220",
                "title": "Wildcard DNS TXT record for verification",
                "category": "DNS",
                "description": "TXT record reveals third-party vendor used for certificate issuance.",
                "cvss": 3.2,
                "exploited": "No",
                "fix_available": False,
            },
            {
                "id": "e2",
                "severity": "low",
                "cve": "SC-221",
                "title": "TLS 1.0 advertised on legacy marketing host",
                "category": "TLS",
                "description": "One marketing subdomain still negotiates TLS 1.0; traffic is low volume.",
                "cvss": 3.7,
                "exploited": "No",
                "fix_available": True,
            },
        ],
    },
}


def _report_body_for_session(sess: dict, session_id: str) -> dict[str, Any]:
    base = _default_report_body(sess, session_id)
    did = str(sess.get("display_id") or "")
    extra = _DEMO_REPORT_OVERRIDES.get(did)
    if not extra:
        return base
    merged: dict[str, Any] = {**base, **extra}
    if "vulnerability_logs" in extra:
        merged["vulnerability_logs"] = extra["vulnerability_logs"]
    return merged


async def _ensure_report_for_session(user_id: str, session_id: str) -> ReportDetail | None:
    db = get_db()
    try:
        oid = ObjectId(session_id)
    except Exception:
        return None
    sess = await db.sessions.find_one({"_id": oid, "user_id": user_id})
    if not sess:
        return None
    existing = await db.reports.find_one({"session_id": session_id, "user_id": user_id})
    if existing:
        return _doc_to_report(existing)
    body = _report_body_for_session(sess, session_id)
    ins_doc = {
        "user_id": user_id,
        **body,
    }
    ins = await db.reports.insert_one(ins_doc)
    ins_doc["_id"] = ins.inserted_id
    return _doc_to_report(ins_doc)


def _pdf_str(s: str) -> str:
    """Helvetica in fpdf2 is limited; fall back to latin-1 for PDF body text."""
    return s.encode("latin-1", errors="replace").decode("latin-1")


def _build_pdf_bytes(report: ReportDetail) -> bytes:
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=16)
    pdf.add_page()
    w = pdf.epw
    pdf.set_font("helvetica", "B", 16)
    pdf.cell(w, 10, "CipherStrike - Session report", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", size=11)
    pdf.cell(w, 6, _pdf_str(f"Session: {report.title}"), new_x="LMARGIN", new_y="NEXT")
    if report.audit_date_label:
        pdf.cell(w, 6, _pdf_str(report.audit_date_label), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)
    pdf.set_font("helvetica", size=10)
    pdf.multi_cell(w, 5, _pdf_str(report.summary))
    pdf.ln(2)
    pdf.set_font("helvetica", "B", 12)
    pdf.cell(w, 8, "Target", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", size=10)
    pdf.cell(w, 5, _pdf_str(f"Host: {report.target_host or '-'}"), new_x="LMARGIN", new_y="NEXT")
    pdf.cell(w, 5, _pdf_str(f"IP: {report.primary_ip or '-'}"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.set_font("helvetica", "B", 12)
    pdf.cell(w, 8, "Severity summary", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", size=10)
    pdf.cell(w, 5, f"Critical: {report.severity_critical}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(w, 5, f"High: {report.severity_high}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(w, 5, f"Medium: {report.severity_medium}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(w, 5, f"Low: {report.severity_low}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.set_font("helvetica", "B", 12)
    pdf.cell(w, 8, "Key findings", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", size=10)
    for f in report.findings:
        pdf.multi_cell(w, 5, _pdf_str(f"- {f}"))
    pdf.ln(2)
    if report.vulnerability_logs:
        pdf.set_font("helvetica", "B", 12)
        pdf.cell(w, 8, "Vulnerability details", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("helvetica", size=9)
        for v in report.vulnerability_logs:
            line = f"[{v.severity.upper()}] {v.cve} - {v.title} (CVSS {v.cvss})"
            pdf.multi_cell(w, 4, _pdf_str(line))
    raw_out = pdf.output(dest="S")
    if isinstance(raw_out, (bytes, bytearray)):
        return bytes(raw_out)
    return str(raw_out).encode("latin-1")


def _build_monthly_summary_pdf(
    *,
    period_label: str,
    total_sessions: int,
    completed: int,
    failed: int,
    critical_findings: int,
) -> bytes:
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=16)
    pdf.add_page()
    w = pdf.epw
    pdf.set_font("helvetica", "B", 18)
    pdf.cell(w, 10, _pdf_str("CipherStrike — Monthly executive summary"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", size=10)
    pdf.cell(w, 6, _pdf_str(f"Reporting period: {period_label}"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("helvetica", "B", 12)
    pdf.cell(w, 8, _pdf_str("Headline metrics"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", size=10)
    pdf.multi_cell(
        w,
        5,
        _pdf_str(
            f"Total offensive sessions: {total_sessions}\n"
            f"Completed: {completed} | Failed: {failed}\n"
            f"Critical-class findings (aggregate): {critical_findings}\n\n"
            "This report consolidates session activity for governance and leadership review. "
            "Drill into Session History for per-run evidence and PDF exports."
        ),
    )
    pdf.ln(4)
    pdf.set_font("helvetica", "I", 9)
    pdf.multi_cell(
        w,
        4,
        _pdf_str(
            "Generated by CipherStrike GTM reporting. "
            "Figures reflect data available in your workspace at export time."
        ),
    )
    raw_out = pdf.output(dest="S")
    if isinstance(raw_out, (bytes, bytearray)):
        return bytes(raw_out)
    return str(raw_out).encode("latin-1")


def _build_compliance_soc2_pdf(*, org_label: str, session_count: int, report_count: int) -> bytes:
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=16)
    pdf.add_page()
    w = pdf.epw
    pdf.set_font("helvetica", "B", 18)
    pdf.cell(w, 10, _pdf_str("SOC 2 Type II — Control evidence export"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", size=10)
    pdf.cell(w, 6, _pdf_str(f"Organization scope: {org_label}"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("helvetica", "B", 12)
    pdf.cell(w, 8, _pdf_str("Summary"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", size=10)
    pdf.multi_cell(
        w,
        5,
        _pdf_str(
            f"Indexed offensive security sessions: {session_count}\n"
            f"Generated assessment reports on file: {report_count}\n\n"
            "Trust services criteria mapping (illustrative):\n"
            "- CC6.1 Logical access: session-scoped credentials and JWT auth to API.\n"
            "- CC7.2 Monitoring: session logs and terminal capture per run.\n"
            "- CC8.1 Change management: versioned tool configurations and scan manifests.\n\n"
            "Attach this export to your auditor packet alongside raw evidence exports from each session."
        ),
    )
    pdf.ln(4)
    pdf.set_font("helvetica", "I", 9)
    pdf.multi_cell(
        w,
        4,
        _pdf_str("This document is a structured summary for compliance workflows; tailor mappings to your control matrix."),
    )
    raw_out = pdf.output(dest="S")
    if isinstance(raw_out, (bytes, bytearray)):
        return bytes(raw_out)
    return str(raw_out).encode("latin-1")


@router.get("/exports/monthly-summary")
async def export_monthly_summary_pdf(
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> StreamingResponse:
    """Last 30 days rollup — GTM monthly executive PDF."""
    db = get_db()
    since = datetime.now(UTC) - timedelta(days=30)
    cursor = db.sessions.find({"user_id": user_id, "created_at": {"$gte": since}})
    sessions: list[dict[str, Any]] = await cursor.to_list(500)
    total = len(sessions)
    completed = sum(1 for s in sessions if s.get("status") == "completed")
    failed = sum(1 for s in sessions if s.get("status") == "failed")
    crit = sum(int(s.get("findings_crit", 0) or 0) for s in sessions)
    period = f"{since.strftime('%b %d, %Y')} — {datetime.now(UTC).strftime('%b %d, %Y')}"
    data = _build_monthly_summary_pdf(
        period_label=period,
        total_sessions=total,
        completed=completed,
        failed=failed,
        critical_findings=crit,
    )
    name = "CipherStrike-Monthly-Summary.pdf"
    return StreamingResponse(
        BytesIO(data),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


@router.get("/exports/compliance-soc2")
async def export_compliance_soc2_pdf(
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> StreamingResponse:
    """SOC2-style evidence summary PDF for auditors and GTM compliance workflows."""
    db = get_db()
    session_count = await db.sessions.count_documents({"user_id": user_id})
    report_count = await db.reports.count_documents({"user_id": user_id})
    data = _build_compliance_soc2_pdf(
        org_label="Your organization (CipherStrike workspace)",
        session_count=session_count,
        report_count=report_count,
    )
    name = "CipherStrike-SOC2-Compliance-Export.pdf"
    return StreamingResponse(
        BytesIO(data),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


@router.get("/by-session/{session_id}/pdf")
async def report_pdf(
    session_id: str,
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> StreamingResponse:
    try:
        ObjectId(session_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid session id",
        ) from exc
    report = await _ensure_report_for_session(user_id, session_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    sample = _sample_pdf_bytes()
    if sample is not None:
        data = sample
        name = _SAMPLE_REPORT_FILENAME
    else:
        data = _build_pdf_bytes(report)
        name = f"session-report-{session_id}.pdf"
    return StreamingResponse(
        BytesIO(data),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


@router.get("/by-session/{session_id}", response_model=ReportDetail)
async def report_by_session(
    session_id: str,
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> ReportDetail:
    try:
        ObjectId(session_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid session id",
        ) from exc
    report = await _ensure_report_for_session(user_id, session_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if not report.audit_date_label:
        report = report.model_copy(
            update={
                "audit_date_label": report.created_at.strftime("Audit conducted on %b %d, %Y"),
            }
        )
    return report


@router.get("/{report_id}", response_model=ReportDetail)
async def get_report(
    report_id: str,
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> ReportDetail:
    db = get_db()
    try:
        oid = ObjectId(report_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid id",
        ) from exc
    doc = await db.reports.find_one({"_id": oid, "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return _doc_to_report(doc)
