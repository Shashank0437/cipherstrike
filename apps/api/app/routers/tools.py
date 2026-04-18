import shlex
import uuid
from collections import defaultdict
from datetime import datetime
from typing import Any, Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import get_current_user_id
from app.schemas.domain import (
    ToolCommandPreview,
    ToolExecuteRequest,
    ToolExecuteResult,
    ToolFlag,
    ToolItem,
    ToolLogLine,
)

router = APIRouter(prefix="/tools", tags=["tools"])

# Per-user in-memory “recent activity” (demo; not production durable)
_type_logs: dict[str, list[ToolLogLine]] = defaultdict(
    lambda: [ToolLogLine(time="--:--", message="Arsenal log channel initialized.")]
)
_MAX = 20


def _log_append(user_id: str, time_s: str, message: str) -> ToolLogLine:
    line = ToolLogLine(time=time_s, message=message)
    acc = _type_logs[user_id]
    acc.append(line)
    if len(acc) > _MAX:
        del acc[: len(acc) - _MAX]
    return line


def _now_t() -> str:
    return datetime.now(ZoneInfo("UTC")).strftime("%H:%M")


NMAP = ToolItem(
    id="nmap",
    name="nmap",
    version="v7.95",
    description="Network discovery and security auditing. Probes open ports, services, and NSE across targets.",
    category="recon",
    icon="search",
    tags=["Network", "Discovery"],
    filter_tags=["recon", "network"],
    integrated=True,
    command_binary="nmap",
    flags=[
        ToolFlag(
            id="sV",
            label="Service version detection",
            cli="-sV",
            default_on=True,
            required=True,
        ),
        ToolFlag(id="sC", label="Default script scan", cli="-sC", default_on=True),
        ToolFlag(id="O", label="OS fingerprinting", cli="-O", default_on=False),
        ToolFlag(id="t4", label="Timing (-T4)", cli="-T4", default_on=True),
        ToolFlag(id="aggr", label="Aggressive scan", cli="-A", default_on=False),
        ToolFlag(id="script", label="NSE vuln scripts (after target)", cli="--script vuln", default_on=True),
    ],
)

_DEFAULT_TOOLS: list[ToolItem] = [
    NMAP,
    ToolItem(
        id="masscan",
        name="masscan",
        version="v1.3.2",
        description="Asynchronous high-speed port scanner. Ideal for large network sweeps in lab conditions.",
        category="recon",
        icon="cell_tower",
        tags=["Network", "Recon"],
        filter_tags=["recon", "network", "osint"],
        command_binary="masscan",
        flags=[ToolFlag(id="rate", label="Rate ( --rate 1000 )", cli="--rate 1000", default_on=True)],
    ),
    ToolItem(
        id="sqlmap",
        name="sqlmap",
        version="v1.8",
        description="Automatic SQL injection and database takeover. Detects and exploits db injection in web parameters.",
        category="exploitation",
        icon="database",
        tags=["Web", "Exploitation"],
        filter_tags=["web", "binary"],
        command_binary="sqlmap",
        flags=[
            ToolFlag(
                id="batch",
                label="Non-interactive ( --batch )",
                cli="--batch",
                default_on=True,
                required=True,
            ),
            ToolFlag(id="crawl", label="Crawl depth 2 ( --crawl=2 )", cli="--crawl=2", default_on=False),
        ],
    ),
    ToolItem(
        id="metasploit",
        name="msfconsole",
        version="v6.4",
        description="Exploitation framework for payloads, auxiliary, and post-exploitation modules in one console.",
        category="exploitation",
        icon="shield",
        tags=["Exploit", "Framework"],
        filter_tags=["binary", "web"],
        command_binary="msfconsole",
        flags=[],
    ),
    ToolItem(
        id="burp",
        name="burp",
        version="v2024.8",
        description="Web proxy, scanner, and manual testing. Core workflow for app-layer offensive testing.",
        category="web",
        icon="language",
        tags=["Web", "Proxy"],
        filter_tags=["web"],
        command_binary="burpsuite",
        flags=[],
    ),
    ToolItem(
        id="nikto",
        name="nikto",
        version="v2.5",
        description="Web server scan for known vulnerable paths, service banners, and misconfigurations.",
        category="web",
        icon="captive_portal",
        tags=["Web", "OSINT"],
        filter_tags=["web", "osint"],
        command_binary="nikto",
        flags=[ToolFlag(id="ssl", label="SSL ( -ssl )", cli="-ssl", default_on=True)],
    ),
    ToolItem(
        id="john",
        name="john",
        version="v1.9",
        description="Fast password hash cracker. Rules, wordlists, and custom formats for credential recovery.",
        category="exploitation",
        icon="key",
        tags=["Binary", "Crack"],
        filter_tags=["binary"],
        command_binary="john",
        flags=[ToolFlag(id="word", label="Wordlist ( --wordlist=... )", cli="--wordlist=rockyou.txt", default_on=False)],
    ),
    ToolItem(
        id="aircrack",
        name="aircrack",
        version="v1.7",
        description="WEP and WPA-PSK key analysis from wireless captures. Suite foundation for 802.11 work.",
        category="wireless",
        icon="wifi",
        tags=["Radio", "Wireless"],
        filter_tags=["network", "recon"],
        command_binary="aircrack-ng",
        flags=[],
    ),
    ToolItem(
        id="wireshark",
        name="wireshark",
        version="v4.2",
        description="Packet dissection, decode chains, and PCAP triage. Deep visibility into live or offline traffic.",
        category="analysis",
        icon="lan",
        tags=["PCAP", "Network"],
        filter_tags=["network", "recon", "osint"],
        command_binary="wireshark",
        flags=[],
    ),
]

_BY_ID: dict[str, ToolItem] = {t.id: t for t in _DEFAULT_TOOLS}


def _append_extra(argv: list[str], extra: str) -> None:
    t = (extra or "").strip()
    if not t:
        return
    try:
        argv.extend(shlex.split(t))
    except ValueError:
        argv.append(t)


def _join_cmd(a: list[str], extra: str) -> str:
    _append_extra(a, extra)
    return " ".join(a)


def build_command(
    tool: ToolItem, target: str, values: dict[str, bool], extra: str = ""
) -> str:
    """User-visible command string. Does not execute the binary."""
    target = " ".join(target.split())
    if not target:
        return ""

    if tool.id == "sqlmap":
        u = target if target.startswith("http://") or target.startswith("https://") else f"http://{target.lstrip('/')}/"
        a: list[str] = shlex.split(tool.command_binary) if " " in tool.command_binary else [tool.command_binary]
        a.append("-u")
        a.append(u)
        for f in tool.flags:
            if values.get(f.id, f.default_on) and f.cli.strip():
                a.extend(shlex.split(f.cli))
        return _join_cmd(a, extra)

    if tool.id == "nikto":
        a = shlex.split(tool.command_binary) if " " in tool.command_binary else [tool.command_binary]
        a.append("-h")
        a.append(target)
        for f in tool.flags:
            if values.get(f.id, f.default_on) and f.cli.strip():
                a.extend(shlex.split(f.cli))
        return _join_cmd(a, extra)

    if tool.id == "nmap":
        a = ["nmap"]
        for f in tool.flags:
            if f.id == "script":
                continue
            if values.get(f.id, f.default_on) and f.cli.strip():
                a.extend(shlex.split(f.cli))
        a.append(target)
        for f in tool.flags:
            if f.id == "script" and values.get(f.id, f.default_on) and f.cli.strip():
                a.extend(shlex.split(f.cli))
        return _join_cmd(a, extra)

    a = shlex.split(tool.command_binary) if " " in tool.command_binary else [tool.command_binary]
    for f in tool.flags:
        if values.get(f.id, f.default_on) and f.cli.strip():
            a.extend(shlex.split(f.cli))
    a.append(target)
    return _join_cmd(a, extra)


def _validate_required_flags(tool: ToolItem, values: dict[str, bool]) -> None:
    for f in tool.flags:
        if not f.required:
            continue
        on = values.get(f.id, f.default_on)
        if not on:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=f"Required flag must be enabled: {f.label}",
            )


def _synthetic_result_json(
    tool: ToolItem, target: str, command: str, run_id: str
) -> dict[str, Any]:
    """Stub JSON for AI / future humanized reporting. Replace with real worker output."""
    base: dict[str, Any] = {
        "schema_version": 1,
        "run_id": run_id,
        "tool_id": tool.id,
        "tool_name": tool.name,
        "target": target,
        "command": command,
        "status": "completed",
        "synthetic": True,
        "summary": (
            "Stub run only — no live binary was executed. "
            "When wired to a worker, this object will hold raw tool JSON for your agent."
        ),
    }
    if tool.id == "nmap":
        base["nmap_style"] = {
            "host": {"addr": target, "state": "up"},
            "ports": [
                {
                    "port": 22,
                    "state": "open",
                    "service": "ssh",
                    "version": "OpenSSH 8.2",
                },
                {
                    "port": 80,
                    "state": "open",
                    "service": "http",
                    "version": "nginx 1.18",
                },
            ],
            "script_output": [
                {
                    "id": "vuln",
                    "severity": "high",
                    "message": "Example: detected missing security header (stub).",
                }
            ],
        }
    elif tool.id == "sqlmap":
        base["sqlmap_style"] = {
            "vulnerable": False,
            "parameters_tested": ["id"],
            "injection_type": None,
        }
    else:
        base["output"] = {"message": "Generic tool stub; attach schema per integration."}
    return base


@router.get("", response_model=list[ToolItem])
async def list_tools(_user_id: Annotated[str, Depends(get_current_user_id)]) -> list[ToolItem]:  # noqa: ARG001
    return _DEFAULT_TOOLS


@router.post("/preview", response_model=ToolCommandPreview)
async def preview_command(
    body: ToolExecuteRequest,
    _user_id: Annotated[str, Depends(get_current_user_id)],  # noqa: ARG001
) -> ToolCommandPreview:
    tool = _BY_ID.get(body.tool_id)
    if not tool:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Unknown tool_id"
        )
    v = {k: bool(x) for k, x in body.flag_values.items()}
    _validate_required_flags(tool, v)
    command = build_command(
        tool,
        body.target,
        v,
        body.extra_args,
    )
    if not command or not _token_safe_target(body.target):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Invalid or empty target"
        )
    return ToolCommandPreview(command=command)


@router.post("/execute", response_model=ToolExecuteResult)
async def execute_tool(
    body: ToolExecuteRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> ToolExecuteResult:
    tool = _BY_ID.get(body.tool_id)
    if not tool:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Unknown tool_id"
        )
    v = {k: bool(x) for k, x in body.flag_values.items()}
    _validate_required_flags(tool, v)
    command = build_command(
        tool,
        body.target,
        v,
        body.extra_args,
    )
    if not command or not _token_safe_target(body.target):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Invalid or empty target"
        )

    run = uuid.uuid4().hex[:12]
    t = _now_t()
    msg1 = f'Job {run} queued: "{command[:200]}{"…" if len(command) > 200 else ""}"'
    n1 = _log_append(user_id, t, msg1)
    n2 = _log_append(
        user_id,
        t,
        "Run recorded (orchestrator stub — no binary executed in this build).",
    )
    result_json = _synthetic_result_json(
        tool, " ".join(body.target.split()), command, run
    )
    return ToolExecuteResult(
        command=command,
        run_id=run,
        status="completed",
        message="Command validated. JSON in result_json is ready for your AI / reporting pipeline.",
        new_logs=[n1, n2],
        recent_logs=list(_type_logs[user_id])[-8:],
        result_json=result_json,
    )


def _token_safe_target(s: str) -> bool:
    t = s.strip()
    if len(t) > 2048:
        return False
    if not t or "\x00" in t:
        return False
    return True

