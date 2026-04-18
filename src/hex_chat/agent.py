"""Multi-round Ollama + MCP tool execution loop."""

from __future__ import annotations

import json
import traceback
from typing import Any

import mcp.types as types
from mcp.client.session import ClientSession

from hex_chat.config import Settings
from hex_chat.mcp_result import format_call_tool_result
from hex_chat.ollama_client import OllamaClient, OllamaHttpError, parse_tool_arguments


def _extract_tool_call(tc: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    fn = tc.get("function")
    if isinstance(fn, dict):
        name = str(fn.get("name") or "")
        raw_args = fn.get("arguments")
    else:
        name = str(tc.get("name") or "")
        raw_args = tc.get("arguments")
    try:
        args = parse_tool_arguments(raw_args)
    except (json.JSONDecodeError, TypeError, ValueError) as e:
        args = {"_raw_arguments": raw_args, "_parse_error": str(e)}
    return name, args


async def run_turn(
    settings: Settings,
    ollama: OllamaClient,
    mcp: ClientSession,
    messages: list[dict[str, Any]],
    ollama_tools: list[dict[str, Any]],
) -> tuple[str, list[dict[str, Any]]]:
    """
    Run up to ``max_tool_rounds`` LLM steps until the assistant returns content without tool_calls.

    Returns (final_reply_text, updated_message_list).
    """
    max_r = settings.max_tool_rounds
    working: list[dict[str, Any]] = list(messages)

    for _ in range(max_r):
        try:
            data = await ollama.chat(working, ollama_tools)
        except OllamaHttpError as e:
            return f"[ollama error] {e}", working

        msg = data.get("message")
        if not isinstance(msg, dict):
            return "[ollama error] missing message in response", working

        working.append(msg)

        raw_calls = msg.get("tool_calls")
        if not raw_calls:
            return str(msg.get("content") or ""), working

        tcs = raw_calls if isinstance(raw_calls, list) else []
        for tc in tcs:
            if not isinstance(tc, dict):
                working.append(
                    {
                        "role": "tool",
                        "tool_name": "unknown",
                        "content": f"[hex-chat] malformed tool_calls entry: {tc!r}",
                    }
                )
                continue

            name, args = _extract_tool_call(tc)
            if not name:
                working.append(
                    {
                        "role": "tool",
                        "tool_name": "unknown",
                        "content": "[hex-chat] tool call missing name",
                    }
                )
                continue

            try:
                result: types.CallToolResult = await mcp.call_tool(name, args)
                body = format_call_tool_result(result)
            except Exception as e:  # noqa: BLE001 — surface to the model
                body = f"[mcp exception calling {name}] {e}\n{traceback.format_exc()}"

            working.append(
                {
                    "role": "tool",
                    "tool_name": name,
                    "content": body,
                }
            )

    return (
        "Stopped: MAX_TOOL_ROUNDS exhausted without a final non-tool assistant reply.",
        working,
    )
