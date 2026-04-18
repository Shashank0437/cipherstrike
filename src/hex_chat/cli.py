"""Interactive REPL: Ollama + HexStrike MCP."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from typing import Any

from rich.console import Console
from rich.markdown import Markdown

from hex_chat.agent import run_turn
from hex_chat.config import load_settings
from hex_chat.mcp_session import list_all_tools, mcp_session
from hex_chat.ollama_client import OllamaClient
from hex_chat.tool_adapter import filter_tools, print_warnings, to_ollama_tools

console = Console()


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Chat with Ollama using HexStrike MCP tools.")
    p.add_argument(
        "--show-config",
        action="store_true",
        help="Print effective settings and exit (no MCP spawn).",
    )
    return p.parse_args()


def _cmds() -> str:
    return (
        "Commands: /help  /tools  /reset  /config  /quit\n"
        "Send natural language to chat; the model may invoke allowed MCP tools."
    )


def _system_message(settings: Any) -> dict[str, Any]:
    return {"role": "system", "content": settings.system_prompt}


async def _async_main(ns: argparse.Namespace) -> int:
    settings = load_settings()
    if ns.show_config:
        console.print("[bold]Effective configuration[/bold]")
        console.print_json(json.dumps(settings.model_dump(mode="json"), indent=2))
        return 0

    console.print("[bold green]hex-chat[/bold green] — Ollama + HexStrike MCP")
    console.print(_cmds())

    async with mcp_session(settings) as session:
        all_mcp = await list_all_tools(session)
        filtered, warns = filter_tools(all_mcp, settings)
        print_warnings(warns)
        if not filtered:
            console.print(
                "[red]No tools match your allowlist/prefix. "
                "Adjust TOOL_ALLOWLIST or TOOL_PREFIX in .env[/red]"
            )
            return 1

        ollama_defs = to_ollama_tools(filtered)
        loaded_names = [t.name for t in filtered]
        console.print(
            f"[dim]Loaded {len(ollama_defs)} tool(s): "
            f"{', '.join(loaded_names[:12])}"
            f"{'…' if len(loaded_names) > 12 else ''}[/dim]"
        )

        history: list[dict[str, Any]] = [_system_message(settings)]

        async with OllamaClient(
            settings.ollama_host,
            settings.ollama_model,
            timeout_s=settings.ollama_timeout_s,
        ) as ollama:
            while True:
                try:
                    line = console.input("[bold cyan]You>[/bold cyan] ").rstrip("\n")
                except EOFError:
                    console.print("\n[dim]EOF — bye[/dim]")
                    break

                if not line.strip():
                    continue

                if line.startswith("/"):
                    parts = line.split(maxsplit=1)
                    cmd = parts[0].lower()
                    if cmd in ("/quit", "/exit", "/q"):
                        console.print("[dim]bye[/dim]")
                        break
                    if cmd == "/help":
                        console.print(_cmds())
                        continue
                    if cmd == "/reset":
                        history = [_system_message(settings)]
                        console.print("[dim]History cleared.[/dim]")
                        continue
                    if cmd == "/tools":
                        for name in loaded_names:
                            console.print(f"  • {name}")
                        continue
                    if cmd == "/config":
                        console.print_json(
                            json.dumps(
                                {
                                    "OLLAMA_HOST": settings.ollama_host,
                                    "OLLAMA_MODEL": settings.ollama_model,
                                    "MCP_COMMAND": settings.mcp_command,
                                    "MCP_ARGS": settings.mcp_args,
                                    "TOOL_ALLOWLIST": settings.tool_allowlist,
                                    "TOOL_PREFIX": settings.tool_prefix,
                                    "MAX_TOOL_ROUNDS": settings.max_tool_rounds,
                                },
                                indent=2,
                            )
                        )
                        continue
                    console.print(f"[yellow]Unknown command {cmd}. Try /help[/yellow]")
                    continue

                user_msg = {"role": "user", "content": line}
                messages = [*history, user_msg]

                with console.status("[bold]Thinking…[/bold]", spinner="dots"):
                    reply, new_hist = await run_turn(
                        settings,
                        ollama,
                        session,
                        messages,
                        ollama_defs,
                    )

                history = new_hist
                console.print("[bold magenta]Assistant>[/bold magenta]")
                try:
                    console.print(Markdown(reply or "_[empty reply]_"))
                except Exception:  # noqa: BLE001 — rich may dislike odd markdown; still show text
                    console.print(reply or "", markup=False)

    return 0


def main() -> None:
    ns = _parse_args()
    try:
        raise SystemExit(asyncio.run(_async_main(ns)))
    except KeyboardInterrupt:
        console.print("\n[dim]Interrupted — bye[/dim]")
        sys.exit(130)


if __name__ == "__main__":
    main()
