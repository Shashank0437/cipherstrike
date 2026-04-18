"""Environment-backed settings for Ollama and MCP."""

from __future__ import annotations

import json
import os
from typing import Any

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    ollama_host: str = Field(default="http://127.0.0.1:11434")
    ollama_model: str = Field(default="kimi-k2.5:cloud")
    ollama_timeout_s: float = Field(default=300.0)

    mcp_command: str = Field(default="python3")
    mcp_args: list[str] = Field(
        default_factory=lambda: [
            "/Users/kumar.shashank/Desktop/hexstrike-ai/hexstrike_mcp.py",
            "--server",
            "http://127.0.0.1:8888",
        ],
    )
    mcp_inherit_full_env: bool = Field(default=True)

    tool_allowlist: str = Field(
        default="server_health,list_files",
        description="Comma-separated tool names, or * for all tools (large context / risky).",
    )
    tool_prefix: str = Field(
        default="",
        description="If non-empty, only tools whose name starts with this prefix are exposed.",
    )

    max_tool_rounds: int = Field(default=15)
    system_prompt: str = Field(
        default=(
            "You are a security automation assistant connected to HexStrike via MCP tools. "
            "Use tools when they help answer the user. Be concise and safe."
        ),
    )

    @field_validator("mcp_args", mode="before")
    @classmethod
    def parse_mcp_args(cls, v: Any) -> list[str]:
        if isinstance(v, list):
            return [str(x) for x in v]
        if isinstance(v, str):
            parsed = json.loads(v)
            if not isinstance(parsed, list):
                raise ValueError("MCP_ARGS must be a JSON array of strings")
            return [str(x) for x in parsed]
        raise ValueError("MCP_ARGS must be a JSON array or a list")

    @model_validator(mode="after")
    def validate_allowlist(self) -> Settings:
        if self.tool_allowlist.strip() == "":
            raise ValueError("TOOL_ALLOWLIST must be non-empty or use * for all tools")
        return self


def load_settings() -> Settings:
    return Settings()


def mcp_environment(settings: Settings) -> dict[str, str] | None:
    if settings.mcp_inherit_full_env:
        return dict(os.environ)
    return None
