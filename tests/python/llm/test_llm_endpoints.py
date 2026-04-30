"""
Tests for /api/llm/* endpoints.

All tests mock common.llm_router.call_chain / call_chain_stream so no real
LLM calls are made.  Tests are async (pytest-asyncio auto mode).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, AsyncIterator, Dict
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient
from fastapi import FastAPI

# ── make backend/python importable ─────────────────────────────────────────
_PYTHON_ROOT = Path(__file__).resolve().parents[3] / "backend" / "python"
if str(_PYTHON_ROOT) not in sys.path:
    sys.path.insert(0, str(_PYTHON_ROOT))

from llm.api.endpoints import router  # noqa: E402  (after sys.path fix)

# ── minimal FastAPI app for testing ────────────────────────────────────────
app = FastAPI()
app.include_router(router, prefix="/api/llm")

# ── fixtures ────────────────────────────────────────────────────────────────

MOCK_RESPONSE: Dict[str, Any] = {
    "choices": [{"message": {"role": "assistant", "content": "Hello!"}}],
    "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
    "model": "qwen-plus",
}

MOCK_TOOL_RESPONSE: Dict[str, Any] = {
    "choices": [
        {
            "message": {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": "call_abc",
                        "type": "function",
                        "function": {"name": "get_weather", "arguments": '{"city":"Beijing"}'},
                    }
                ],
            }
        }
    ],
    "usage": {"prompt_tokens": 20, "completion_tokens": 10, "total_tokens": 30},
    "model": "qwen-plus",
}


@pytest.fixture
def client():
    """Synchronous TestClient — no live server needed."""
    return TestClient(app, raise_server_exceptions=True)


# ── /chat ────────────────────────────────────────────────────────────────────


def test_chat_returns_full_response(client):
    """/chat passes the full call_chain response back to the caller."""
    with patch("llm.api.endpoints.call_chain", new_callable=AsyncMock) as mock_cc:
        mock_cc.return_value = MOCK_RESPONSE
        resp = client.post(
            "/api/llm/chat",
            json={"messages": [{"role": "user", "content": "hi"}]},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["choices"][0]["message"]["content"] == "Hello!"
    assert data["usage"]["total_tokens"] == 15


def test_chat_default_slot_is_chat(client):
    """When `slot` is omitted, call_chain is called with SLOT.CHAT."""
    from common.llm_router import SLOT

    with patch("llm.api.endpoints.call_chain", new_callable=AsyncMock) as mock_cc:
        mock_cc.return_value = MOCK_RESPONSE
        client.post(
            "/api/llm/chat",
            json={"messages": [{"role": "user", "content": "hi"}]},
        )
    mock_cc.assert_called_once()
    called_slot = mock_cc.call_args[0][0]  # positional arg 0
    assert called_slot == SLOT.CHAT


def test_chat_custom_slot_insights(client):
    """Passing `slot='insights'` routes to SLOT.INSIGHTS."""
    from common.llm_router import SLOT

    with patch("llm.api.endpoints.call_chain", new_callable=AsyncMock) as mock_cc:
        mock_cc.return_value = MOCK_RESPONSE
        resp = client.post(
            "/api/llm/chat",
            json={"messages": [{"role": "user", "content": "analyze"}], "slot": "insights"},
        )
    assert resp.status_code == 200
    called_slot = mock_cc.call_args[0][0]
    assert called_slot == SLOT.INSIGHTS


def test_chat_invalid_slot_returns_400(client):
    """An unrecognised slot name returns HTTP 400."""
    with patch("llm.api.endpoints.call_chain", new_callable=AsyncMock):
        resp = client.post(
            "/api/llm/chat",
            json={"messages": [{"role": "user", "content": "hi"}], "slot": "nonexistent_slot"},
        )
    assert resp.status_code == 400


def test_chat_missing_messages_returns_422(client):
    """`messages` is required; omitting it returns 422 Unprocessable Entity."""
    with patch("llm.api.endpoints.call_chain", new_callable=AsyncMock):
        resp = client.post("/api/llm/chat", json={"slot": "chat"})
    assert resp.status_code == 422


def test_chat_optional_fields_forwarded(client):
    """temperature and max_tokens are forwarded in the payload when provided."""
    with patch("llm.api.endpoints.call_chain", new_callable=AsyncMock) as mock_cc:
        mock_cc.return_value = MOCK_RESPONSE
        client.post(
            "/api/llm/chat",
            json={
                "messages": [{"role": "user", "content": "hi"}],
                "temperature": 0.7,
                "max_tokens": 512,
            },
        )
    payload = mock_cc.call_args[0][1]  # positional arg 1
    assert payload["temperature"] == 0.7
    assert payload["max_tokens"] == 512


def test_chat_none_fields_not_forwarded(client):
    """Fields left as None should not be included in the payload."""
    with patch("llm.api.endpoints.call_chain", new_callable=AsyncMock) as mock_cc:
        mock_cc.return_value = MOCK_RESPONSE
        client.post(
            "/api/llm/chat",
            json={"messages": [{"role": "user", "content": "hi"}]},
        )
    payload = mock_cc.call_args[0][1]
    assert "temperature" not in payload
    assert "max_tokens" not in payload
    assert "enable_thinking" not in payload
    assert "tools" not in payload


# ── /tool-call ───────────────────────────────────────────────────────────────


def test_tool_call_returns_full_response_with_tool_calls(client):
    """/tool-call passes the complete response including tool_calls field."""
    tools = [
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "Get current weather",
                "parameters": {
                    "type": "object",
                    "properties": {"city": {"type": "string"}},
                    "required": ["city"],
                },
            },
        }
    ]
    with patch("llm.api.endpoints.call_chain", new_callable=AsyncMock) as mock_cc:
        mock_cc.return_value = MOCK_TOOL_RESPONSE
        resp = client.post(
            "/api/llm/tool-call",
            json={
                "messages": [{"role": "user", "content": "What's the weather in Beijing?"}],
                "tools": tools,
                "tool_choice": "auto",
            },
        )
    assert resp.status_code == 200
    data = resp.json()
    tool_calls = data["choices"][0]["message"]["tool_calls"]
    assert tool_calls[0]["function"]["name"] == "get_weather"


def test_tool_call_forwards_tools_in_payload(client):
    """tools and tool_choice are included in the payload sent to call_chain."""
    tools = [{"type": "function", "function": {"name": "noop", "parameters": {}}}]
    with patch("llm.api.endpoints.call_chain", new_callable=AsyncMock) as mock_cc:
        mock_cc.return_value = MOCK_TOOL_RESPONSE
        client.post(
            "/api/llm/tool-call",
            json={
                "messages": [{"role": "user", "content": "call it"}],
                "tools": tools,
                "tool_choice": "auto",
            },
        )
    payload = mock_cc.call_args[0][1]
    assert payload["tools"] == tools
    assert payload["tool_choice"] == "auto"


# ── /intent-classify ─────────────────────────────────────────────────────────


def test_intent_classify_forces_temperature_01(client):
    """/intent-classify always uses temperature=0.1 regardless of request value."""
    with patch("llm.api.endpoints.call_chain", new_callable=AsyncMock) as mock_cc:
        mock_cc.return_value = MOCK_RESPONSE
        # Caller attempts to pass temperature=0.9 — must be overridden
        client.post(
            "/api/llm/intent-classify",
            json={
                "messages": [{"role": "user", "content": "classify this"}],
                "temperature": 0.9,
            },
        )
    payload = mock_cc.call_args[0][1]
    assert payload["temperature"] == 0.1


def test_intent_classify_forces_temperature_when_not_provided(client):
    """/intent-classify injects temperature=0.1 even if caller omits it."""
    with patch("llm.api.endpoints.call_chain", new_callable=AsyncMock) as mock_cc:
        mock_cc.return_value = MOCK_RESPONSE
        client.post(
            "/api/llm/intent-classify",
            json={"messages": [{"role": "user", "content": "classify this"}]},
        )
    payload = mock_cc.call_args[0][1]
    assert payload["temperature"] == 0.1


def test_intent_classify_missing_messages_returns_422(client):
    """messages is required for /intent-classify too."""
    with patch("llm.api.endpoints.call_chain", new_callable=AsyncMock):
        resp = client.post("/api/llm/intent-classify", json={"temperature": 0.1})
    assert resp.status_code == 422


def test_intent_classify_returns_full_response(client):
    """/intent-classify returns the full call_chain response."""
    with patch("llm.api.endpoints.call_chain", new_callable=AsyncMock) as mock_cc:
        mock_cc.return_value = MOCK_RESPONSE
        resp = client.post(
            "/api/llm/intent-classify",
            json={"messages": [{"role": "user", "content": "帮我查询原材料库存"}]},
        )
    assert resp.status_code == 200
    assert resp.json()["choices"][0]["message"]["content"] == "Hello!"


# ── /vision ──────────────────────────────────────────────────────────────────


def test_vision_builds_vl_slot_message(client):
    """/vision encodes image to base64 and calls SLOT.VL."""
    from common.llm_router import SLOT

    image_bytes = b"\x89PNG\r\n\x1a\n"  # minimal fake PNG header

    with patch("llm.api.endpoints.call_chain", new_callable=AsyncMock) as mock_cc:
        mock_cc.return_value = MOCK_RESPONSE
        resp = client.post(
            "/api/llm/vision",
            files={"image": ("test.png", image_bytes, "image/png")},
            data={"prompt": "What do you see?"},
        )

    assert resp.status_code == 200
    called_slot = mock_cc.call_args[0][0]
    assert called_slot == SLOT.VL

    payload = mock_cc.call_args[0][1]
    msgs = payload["messages"]
    assert len(msgs) >= 1
    # There should be a user message containing image_url content
    user_msg = msgs[-1]
    assert user_msg["role"] == "user"
    # content can be a list (multi-part) or string
    content = user_msg["content"]
    if isinstance(content, list):
        types = [part.get("type") for part in content]
        assert "image_url" in types
        assert "text" in types
    else:
        # Flat string: at minimum must contain the prompt
        assert "What do you see?" in content


def test_vision_missing_image_returns_422(client):
    """/vision requires an image file — omitting it returns 422."""
    with patch("llm.api.endpoints.call_chain", new_callable=AsyncMock):
        resp = client.post(
            "/api/llm/vision",
            data={"prompt": "no image"},
        )
    assert resp.status_code == 422


# ── /chat-stream ─────────────────────────────────────────────────────────────


def test_chat_stream_sse_format(client):
    """/chat-stream emits SSE events (data: prefix) and ends with [DONE]."""

    async def _mock_stream(*args, **kwargs) -> AsyncIterator[Dict[str, Any]]:
        yield {"type": "delta", "text": "Hello"}
        yield {"type": "delta", "text": " World"}
        yield {"type": "usage", "tokens": 20}

    with patch("llm.api.endpoints.call_chain_stream", new=_mock_stream):
        resp = client.post(
            "/api/llm/chat-stream",
            json={"messages": [{"role": "user", "content": "hi"}]},
        )

    assert resp.status_code == 200
    body = resp.text
    assert "data: " in body
    assert "[DONE]" in body

    # Parse SSE lines
    lines = [ln for ln in body.splitlines() if ln.startswith("data: ")]
    payloads = []
    for ln in lines:
        raw = ln[len("data: "):]
        if raw == "[DONE]":
            continue
        payloads.append(json.loads(raw))

    # Should have at least the delta events
    delta_texts = [p["text"] for p in payloads if p.get("type") == "delta"]
    assert "Hello" in delta_texts
    assert " World" in delta_texts


def test_chat_stream_missing_messages_returns_422(client):
    """`messages` is required for /chat-stream."""
    with patch("llm.api.endpoints.call_chain_stream"):
        resp = client.post("/api/llm/chat-stream", json={"slot": "chat"})
    assert resp.status_code == 422


def test_chat_stream_error_yields_error_event_before_done(client):
    """When call_chain_stream raises RuntimeError, SSE stream emits an error event then [DONE]."""

    async def _error_stream(*args, **kwargs):
        raise RuntimeError("all providers exhausted")
        yield  # makes this an async generator

    with patch("llm.api.endpoints.call_chain_stream", new=_error_stream):
        resp = client.post(
            "/api/llm/chat-stream",
            json={"messages": [{"role": "user", "content": "hi"}]},
        )
    assert resp.status_code == 200
    body = resp.text
    assert "[DONE]" in body
    assert '"type": "error"' in body
    assert "all providers exhausted" in body
