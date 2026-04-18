"""MCP stdio client helpers (session lifecycle + list all tools with pagination)."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

import mcp.types as types
from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

from hex_chat.config import Settings, mcp_environment


@asynccontextmanager
async def mcp_session(settings: Settings) -> AsyncIterator[ClientSession]:
    """Run the MCP subprocess and yield an initialized client session."""
    params = StdioServerParameters(
        command=settings.mcp_command,
        args=settings.mcp_args,
        env=mcp_environment(settings),
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            yield session


async def list_all_tools(session: ClientSession) -> list[types.Tool]:
    """Fetch every tool page exposed by the server."""
    tools: list[types.Tool] = []
    cursor: str | None = None
    while True:
        if cursor is None:
            result = await session.list_tools()
        else:
            result = await session.list_tools(
                params=types.PaginatedRequestParams(cursor=cursor),
            )
        tools.extend(result.tools)
        if result.nextCursor is None:
            break
        cursor = result.nextCursor
    return tools
