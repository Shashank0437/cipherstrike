"""Serialize MCP CallToolResult into text for Ollama tool messages."""

from __future__ import annotations

import json

import mcp.types as types


def format_call_tool_result(result: types.CallToolResult) -> str:
    """Flatten content blocks and optional structured JSON."""
    parts: list[str] = []
    for block in result.content:
        if isinstance(block, types.TextContent):
            parts.append(block.text)
        else:
            parts.append(block.model_dump_json() if hasattr(block, "model_dump_json") else str(block))
    text = "\n".join(p for p in parts if p)
    if result.structuredContent is not None:
        blob = json.dumps(result.structuredContent, indent=2, default=str)
        text = (text + "\n" + blob) if text else blob
    if result.isError:
        return f"[tool error] {text or 'unknown error'}"
    return text if text else "(empty tool result)"
