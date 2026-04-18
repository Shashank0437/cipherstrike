"""HTTP client for Ollama /api/chat (non-streaming) with tool support."""

from __future__ import annotations

import json
from typing import Any

import httpx


class OllamaHttpError(RuntimeError):
    """Raised when Ollama returns an error field or non-2xx response."""


class OllamaClient:
    def __init__(
        self,
        base_url: str,
        model: str,
        timeout_s: float = 300.0,
    ) -> None:
        self._base = base_url.rstrip("/")
        self._model = model
        self._timeout = timeout_s
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> OllamaClient:
        self._client = httpx.AsyncClient(base_url=self._base, timeout=self._timeout)
        return self

    async def __aexit__(self, *args: object) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    async def chat(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """POST /api/chat with stream=false; returns parsed JSON body."""
        if not self._client:
            raise RuntimeError("OllamaClient must be used as an async context manager")
        body: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "stream": False,
        }
        if tools is not None:
            body["tools"] = tools
        r = await self._client.post("/api/chat", json=body)
        data = r.json()
        if r.status_code >= 400:
            err = data.get("error") if isinstance(data, dict) else None
            raise OllamaHttpError(err or f"HTTP {r.status_code}: {r.text!r}")
        if isinstance(data, dict) and data.get("error"):
            raise OllamaHttpError(str(data["error"]))
        return data


def parse_tool_arguments(raw: Any) -> dict[str, Any]:
    """Normalize Ollama tool `arguments` (object or JSON string)."""
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        raw_stripped = raw.strip()
        if not raw_stripped:
            return {}
        return json.loads(raw_stripped)
    raise TypeError(f"Unsupported tool arguments type: {type(raw)!r}")
