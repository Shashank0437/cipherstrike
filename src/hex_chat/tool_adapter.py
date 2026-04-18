"""Map MCP tool definitions to Ollama `tools` payloads and apply filters."""

from __future__ import annotations

import json
import sys

import mcp.types as types

from hex_chat.config import Settings


def mcp_tool_to_ollama(tool: types.Tool) -> dict:
    """Convert an MCP Tool into Ollama /api/chat tool schema."""
    params = tool.inputSchema
    if not isinstance(params, dict):
        params = {"type": "object", "properties": {}}
    return {
        "type": "function",
        "function": {
            "name": tool.name,
            "description": (tool.description or "").strip(),
            "parameters": params,
        },
    }


def filter_tools(tools: list[types.Tool], settings: Settings) -> tuple[list[types.Tool], list[str]]:
    """
    Apply TOOL_ALLOWLIST and optional TOOL_PREFIX.

    Returns (filtered_tools, warnings_to_print).
    """
    warnings: list[str] = []
    raw = settings.tool_allowlist.strip()
    out: list[types.Tool]

    if raw == "*":
        out = list(tools)
        warnings.append(
            "TOOL_ALLOWLIST=* — exposing every MCP tool to the model (large context; high risk)."
        )
    else:
        allow = {name.strip() for name in raw.split(",") if name.strip()}
        out = [t for t in tools if t.name in allow]
        missing = allow - {t.name for t in out}
        if missing:
            warnings.append(
                "These allowlist entries are not exposed by the server: "
                + ", ".join(sorted(missing))
            )

    prefix = settings.tool_prefix.strip()
    if prefix:
        before = len(out)
        out = [t for t in out if t.name.startswith(prefix)]
        if before and not out:
            warnings.append(f"TOOL_PREFIX={prefix!r} removed all tools after allowlist filtering.")

    return out, warnings


def to_ollama_tools(mcp_tools: list[types.Tool]) -> list[dict]:
    return [mcp_tool_to_ollama(t) for t in mcp_tools]


def print_warnings(warnings: list[str]) -> None:
    for w in warnings:
        print(w, file=sys.stderr)
