# hex-chat

Local chat assistant that uses **Ollama** (`/api/chat` with tool calling) and the **HexStrike** MCP server (stdio subprocess) so the model can invoke your allowed MCP tools and answer with grounded results.

## Prerequisites

1. **HexStrike HTTP API** listening where your MCP script expects (default `http://127.0.0.1:8888`).
2. **Ollama** running (default `http://127.0.0.1:11434`) with a **tool-capable** model. The project defaults to **`kimi-k2.5:cloud`** (pull/run with `ollama run kimi-k2.5:cloud` if your Ollama setup supports it). You can switch models anytime via `OLLAMA_MODEL`.
3. Python **3.11+**.

## Security

HexStrike exposes powerful automation (command execution, scanners, exploitation-related workflows). This CLI is for **operator use on trusted systems**.

- Default configuration only exposes a **short tool allowlist** (`server_health`, `list_files`). Expand deliberately via `TOOL_ALLOWLIST` or set `*` only with full awareness of context size and risk.

## Setup

```bash
cd /path/to/hex-be
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .
cp .env.example .env          # edit paths and model
```

`hex-chat` spawns `hexstrike_mcp.py` with the same `python3` you use for the venv. The dependency **`requests`** is declared so that interpreter can import what the MCP script needs on startup. If you prefer to run the MCP with HexStrike’s own virtualenv instead, set `MCP_COMMAND` to that interpreter’s full path in `.env`.

Run:

```bash
hex-chat
# or: python -m hex_chat.cli
```

Inspect resolved settings (without starting MCP):

```bash
hex-chat --show-config
```

## Environment variables

Copy [.env.example](.env.example) to `.env`. Variables are case-insensitive.

| Variable | Purpose |
|----------|---------|
| `OLLAMA_HOST` | Ollama base URL |
| `OLLAMA_MODEL` | Model name known to Ollama |
| `MCP_COMMAND` / `MCP_ARGS` | MCP subprocess (`MCP_ARGS` is a **JSON array** of strings) |
| `TOOL_ALLOWLIST` | Comma-separated MCP tool names, or `*` for all |
| `TOOL_PREFIX` | Optional: only tools whose names **start with** this string |
| `MAX_TOOL_ROUNDS` | Max assistant steps (each may include tool calls) |
| `MCP_INHERIT_FULL_ENV` | `true` passes full process environment to the MCP child |

## REPL commands

- `/help` — short help
- `/tools` — names of tools currently exposed to the model
- `/reset` — clear conversation (keeps system prompt)
- `/config` — show key settings
- `/quit` — exit

## Troubleshooting

### `pip install -e .` fails: PyPI timeout / DNS / “No matching distribution found” for setuptools

That output means **pip could not reach the Python package index** (network down, VPN/DNS issues, firewall, or captive portal)—not a bug in this repo. Fix connectivity, then retry. Useful patterns:

```bash
# Longer timeout when the link is slow
pip install -e . --timeout 120
```

When you are online, prep the venv once, then avoid PEP 517 **build isolation** redownloading build tools:

```bash
pip install -U pip setuptools wheel
pip install -e . --no-build-isolation
```

Behind a proxy, set `HTTP_PROXY` / `HTTPS_PROXY` (or your org’s pip index) as required. You need **at least one successful online install** to pull dependencies unless you install from pre-downloaded wheels on another machine.

- **No tools match**: widen `TOOL_ALLOWLIST` or clear `TOOL_PREFIX`.
- **MCP errors**: confirm HexStrike is up on the URL passed to `hexstrike_mcp.py` and that `MCP_ARGS` points at the correct script.
- **Model never calls tools**: use a model and Ollama version that supports tool calling (`kimi-k2.5:cloud` or another tool-capable tag); keep tool schemas within reasonable size (avoid `*` with huge tool lists on small context models).
