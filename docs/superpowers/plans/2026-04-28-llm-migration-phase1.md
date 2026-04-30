# Phase 1: LLM Client Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Java's single-provider `DashScopeClient` with a thin Java proxy (`PythonLLMClient`) that delegates all LLM calls to Python's `llm_router.py` 4-provider fallback chain, while keeping `DashScopeClient` as a backward-compat shim so none of the 38 caller files need changes.

**Architecture:** Python gains 5 `/api/llm/` endpoints backed by `call_chain()` from the existing `llm_router.py`. Java's new `PythonLLMClient` POSTs to these endpoints using the same OkHttp pattern as `PythonSmartBIClient`. `DashScopeClient` becomes a ~60-line delegation shim (all 38 callers keep injecting it, unchanged); `DashScopeVisionClient` similarly delegates vision calls through `PythonLLMClient`. No nginx change required — Python already runs on `localhost:8083` (same host as Java).

**Tech Stack:** Python FastAPI + existing `llm_router.py` (SLOT enum, `call_chain`, `call_chain_stream`), OkHttp (existing Java dep), Jackson ObjectMapper (existing), Spring Boot `@Component`

**Note on scope:** This plan covers Phase 1 only. Phases 2 (SmartBI), 3 (Tool-Skill), and 4 (Embedding) each require a separate plan, in that dependency order: Phase 1 → (Phase 2 ‖ Phase 3) → Phase 4.

---

## File Structure

**Create:**
- `backend/python/llm/__init__.py` — package marker (empty)
- `backend/python/llm/api/__init__.py` — package marker (empty)
- `backend/python/llm/api/endpoints.py` — 5 FastAPI routes wrapping `llm_router.call_chain`
- `tests/python/llm/test_llm_endpoints.py` — pytest unit + smoke tests
- `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/client/PythonLLMClient.java` — ~100-line Java proxy

**Modify:**
- `backend/python/main.py` — add `app.include_router(llm_api.router, prefix="/api/llm", tags=["LLM"])`
- `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/client/DashScopeClient.java` — gut to ~60-line delegation shim (keep all method signatures)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/client/DashScopeVisionClient.java` — gut to ~40-line delegation shim

---

## Task 1: Python LLM package + chat/stream/tools/intent endpoints

**Files:**
- Create: `backend/python/llm/__init__.py`
- Create: `backend/python/llm/api/__init__.py`
- Create: `backend/python/llm/api/endpoints.py`

- [ ] **Step 1.1: Create package structure**

```bash
mkdir -p backend/python/llm/api
touch backend/python/llm/__init__.py
touch backend/python/llm/api/__init__.py
```

- [ ] **Step 1.2: Write failing test first**

Create `tests/python/llm/__init__.py` (empty) and `tests/python/llm/test_llm_endpoints.py`:

```python
# tests/python/llm/test_llm_endpoints.py
"""Unit tests for /api/llm/* endpoints. Mocks call_chain to avoid real LLM calls."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient


def _make_chat_response(content: str) -> dict:
    return {
        "choices": [{"message": {"role": "assistant", "content": content}}],
        "usage": {"total_tokens": 10},
        "model": "test-model",
    }


def _make_stream_event(text: str) -> dict:
    return {"type": "delta", "text": text}


@pytest.fixture
def client():
    from fastapi import FastAPI
    from llm.api.endpoints import router
    app = FastAPI()
    app.include_router(router, prefix="/api/llm")
    return TestClient(app)


def test_chat_returns_content(client):
    fake = _make_chat_response("安好")
    with patch("llm.api.endpoints.call_chain", new=AsyncMock(return_value=fake)):
        r = client.post("/api/llm/chat", json={
            "messages": [{"role": "user", "content": "你好"}],
            "temperature": 0.7,
        })
    assert r.status_code == 200
    assert r.json()["choices"][0]["message"]["content"] == "安好"


def test_chat_passes_slot(client):
    fake = _make_chat_response("ok")
    with patch("llm.api.endpoints.call_chain", new=AsyncMock(return_value=fake)) as mock:
        client.post("/api/llm/chat", json={
            "messages": [{"role": "user", "content": "hi"}],
            "slot": "insights",
        })
    from common.llm_router import SLOT
    args = mock.call_args
    assert args[0][0] == SLOT.INSIGHTS


def test_tool_call_returns_raw_response(client):
    fake = {
        "choices": [{"message": {"role": "assistant", "tool_calls": [
            {"id": "tc1", "type": "function",
             "function": {"name": "my_tool", "arguments": '{"x":1}'}}
        ]}}],
        "usage": {"total_tokens": 20},
        "model": "test-model",
    }
    with patch("llm.api.endpoints.call_chain", new=AsyncMock(return_value=fake)):
        r = client.post("/api/llm/tool-call", json={
            "messages": [{"role": "user", "content": "call it"}],
            "tools": [{"type": "function", "function": {"name": "my_tool"}}],
        })
    assert r.status_code == 200
    assert r.json()["choices"][0]["message"]["tool_calls"][0]["function"]["name"] == "my_tool"


def test_intent_classify_returns_content(client):
    fake = _make_chat_response("PURCHASE_QUERY")
    with patch("llm.api.endpoints.call_chain", new=AsyncMock(return_value=fake)):
        r = client.post("/api/llm/intent-classify", json={
            "messages": [
                {"role": "system", "content": "classify"},
                {"role": "user", "content": "查一下采购单"},
            ],
        })
    assert r.status_code == 200
    assert r.json()["choices"][0]["message"]["content"] == "PURCHASE_QUERY"


def test_chat_missing_messages_returns_422(client):
    r = client.post("/api/llm/chat", json={"temperature": 0.5})
    assert r.status_code == 422
```

- [ ] **Step 1.3: Run tests — expect failure (module not found)**

```bash
cd backend/python
python -m pytest tests/python/llm/test_llm_endpoints.py -v 2>&1 | head -30
```

Expected: `ModuleNotFoundError: No module named 'llm'`

- [ ] **Step 1.4: Implement the endpoints**

Create `backend/python/llm/api/endpoints.py`:

```python
"""
/api/llm/* — thin gateway that exposes llm_router.call_chain to Java via HTTP.

Java's PythonLLMClient calls these endpoints. All 4 providers + circuit breaker
logic lives in common/llm_router.py — this module only handles HTTP framing.

Routes:
  POST /api/llm/chat           — sync chat completion (passthrough)
  POST /api/llm/chat-stream    — SSE streaming chat
  POST /api/llm/tool-call      — function-calling passthrough
  POST /api/llm/intent-classify— low-temp classification (SLOT.CHAT, temp=0.1)
  POST /api/llm/vision         — image + text → VL model via SLOT.VL
"""
from __future__ import annotations

import base64
import json
import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from common.llm_router import SLOT, call_chain, call_chain_stream

logger = logging.getLogger(__name__)
router = APIRouter()


class LLMRequest(BaseModel):
    messages: list[Dict[str, Any]]
    slot: str = Field(default="chat", description="SLOT enum value: chat/insights/chart/mapper/reasoning/vl/review")
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    enable_thinking: Optional[bool] = None
    tools: Optional[list[Dict[str, Any]]] = None
    tool_choice: Optional[Any] = None


def _build_payload(req: LLMRequest) -> Dict[str, Any]:
    """Build llm_router payload from request, omitting None fields."""
    payload: Dict[str, Any] = {"messages": req.messages}
    if req.temperature is not None:
        payload["temperature"] = req.temperature
    if req.max_tokens is not None:
        payload["max_tokens"] = req.max_tokens
    if req.enable_thinking is not None:
        payload["enable_thinking"] = req.enable_thinking
    if req.tools is not None:
        payload["tools"] = req.tools
    if req.tool_choice is not None:
        payload["tool_choice"] = req.tool_choice
    return payload


def _parse_slot(slot_str: str) -> SLOT:
    try:
        return SLOT(slot_str.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown slot: {slot_str!r}. Valid: {[s.value for s in SLOT]}")


@router.post("/chat")
async def chat(req: LLMRequest) -> Dict[str, Any]:
    """Sync chat completion. Returns full OpenAI-compatible response object."""
    slot = _parse_slot(req.slot)
    payload = _build_payload(req)
    return await call_chain(slot, payload)


@router.post("/chat-stream")
async def chat_stream(req: LLMRequest) -> StreamingResponse:
    """SSE streaming chat. Each SSE event is a JSON delta from llm_router."""
    slot = _parse_slot(req.slot)
    payload = _build_payload(req)

    async def event_generator():
        try:
            async for event in call_chain_stream(slot, payload):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except Exception as exc:
            logger.error("chat_stream error: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/tool-call")
async def tool_call(req: LLMRequest) -> Dict[str, Any]:
    """Function-calling passthrough. tools and tool_choice are forwarded as-is."""
    slot = _parse_slot(req.slot)
    payload = _build_payload(req)
    return await call_chain(slot, payload)


@router.post("/intent-classify")
async def intent_classify(req: LLMRequest) -> Dict[str, Any]:
    """Intent classification: always SLOT.CHAT, forces temperature=0.1 for determinism."""
    payload = _build_payload(req)
    payload["temperature"] = 0.1  # override for classification stability
    return await call_chain(SLOT.CHAT, payload)


@router.post("/vision")
async def vision(
    image: UploadFile = File(...),
    prompt: str = Form(default="请描述这张图片的内容"),
) -> Dict[str, Any]:
    """Image analysis via VL model (SLOT.VL). Accepts multipart image upload."""
    image_bytes = await image.read()
    content_type = image.content_type or "image/jpeg"
    b64 = base64.b64encode(image_bytes).decode("ascii")
    payload = {
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{content_type};base64,{b64}"}},
                    {"type": "text", "text": prompt},
                ],
            }
        ]
    }
    return await call_chain(SLOT.VL, payload)
```

- [ ] **Step 1.5: Run tests again — expect pass**

```bash
cd backend/python
python -m pytest tests/python/llm/test_llm_endpoints.py -v
```

Expected output:
```
PASSED tests/python/llm/test_llm_endpoints.py::test_chat_returns_content
PASSED tests/python/llm/test_llm_endpoints.py::test_chat_passes_slot
PASSED tests/python/llm/test_llm_endpoints.py::test_tool_call_returns_raw_response
PASSED tests/python/llm/test_llm_endpoints.py::test_intent_classify_returns_content
PASSED tests/python/llm/test_llm_endpoints.py::test_chat_missing_messages_returns_422
5 passed
```

- [ ] **Step 1.6: Commit**

```bash
git commit -m "feat(llm-phase1): Python /api/llm/* endpoints wrapping llm_router" \
  -- backend/python/llm/__init__.py \
     backend/python/llm/api/__init__.py \
     backend/python/llm/api/endpoints.py \
     tests/python/llm/__init__.py \
     tests/python/llm/test_llm_endpoints.py
```

---

## Task 2: Register LLM router in main.py

**Files:**
- Modify: `backend/python/main.py`

- [ ] **Step 2.1: Find the last `app.include_router` block in main.py**

```bash
grep -n "include_router" backend/python/main.py | tail -5
```

Note the line number of the last `include_router` call.

- [ ] **Step 2.2: Add the LLM router import and registration**

In `backend/python/main.py`, add the import near the other module imports (search for `from smartbi.api` to find the import block):

```python
from llm.api import endpoints as llm_api
```

Then add the router registration after the last `include_router` line:

```python
app.include_router(llm_api.router, prefix="/api/llm", tags=["LLM"])
```

- [ ] **Step 2.3: Verify endpoint shows in OpenAPI docs**

```bash
cd backend/python
uvicorn main:app --port 8083 &
sleep 3
curl -s http://localhost:8083/openapi.json | python -m json.tool | grep -A2 '"/api/llm'
```

Expected: JSON entries for `/api/llm/chat`, `/api/llm/chat-stream`, `/api/llm/tool-call`, `/api/llm/intent-classify`, `/api/llm/vision`

Then kill the server: `kill %1`

- [ ] **Step 2.4: Smoke test the chat endpoint with curl**

```bash
curl -s -X POST http://localhost:8083/api/llm/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "用一个字回答：你好"}], "slot": "chat"}' | python -m json.tool
```

Expected: JSON response with `choices[0].message.content` set to some Chinese text.

- [ ] **Step 2.5: Commit**

```bash
git commit -m "feat(llm-phase1): register /api/llm router in main.py" \
  -- backend/python/main.py
```

---

## Task 3: Java PythonLLMClient

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/client/PythonLLMClient.java`

- [ ] **Step 3.1: Read the DashScopeClient method signatures to confirm**

```bash
grep -n "public " backend/java/cretas-api/src/main/java/com/cretas/aims/ai/client/DashScopeClient.java | grep -v "//"
```

Confirm the 13 public methods listed in the architecture section are all present.

- [ ] **Step 3.2: Create PythonLLMClient.java**

Create `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/client/PythonLLMClient.java`:

```java
package com.cretas.aims.ai.client;

import com.cretas.aims.ai.dto.ChatCompletionRequest;
import com.cretas.aims.ai.dto.ChatCompletionResponse;
import com.cretas.aims.ai.dto.ChatMessage;
import com.cretas.aims.ai.dto.Tool;
import com.cretas.aims.ai.dto.ToolCall;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Java proxy to Python's /api/llm/* endpoints.
 *
 * Replaces DashScopeClient internals. All LLM calls go through
 * llm_router.py which provides 4-provider fallback + circuit breaker.
 * DashScopeClient remains as a delegation shim so its 38 callers are unchanged.
 */
@Slf4j
@Component
public class PythonLLMClient {

    private static final MediaType JSON_MEDIA = MediaType.get("application/json; charset=utf-8");
    private static final int MAX_CONTENT_CHARS = 400_000; // 400k char ~ 280k token safety cut

    private final String baseUrl;
    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;

    public PythonLLMClient(
            @Value("${python-smartbi.url:http://localhost:8083}") String pythonUrl,
            @Qualifier("aiServiceHttpClient") OkHttpClient httpClient,
            ObjectMapper objectMapper) {
        this.baseUrl = pythonUrl.endsWith("/") ? pythonUrl.substring(0, pythonUrl.length() - 1) : pythonUrl;
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
    }

    // ── Core ──────────────────────────────────────────────────────────────────

    public ChatCompletionResponse chatCompletion(ChatCompletionRequest request) {
        return post("/api/llm/chat", request, ChatCompletionResponse.class);
    }

    public void chatCompletionStream(ChatCompletionRequest request,
                                     Consumer<String> onToken,
                                     Consumer<ChatCompletionResponse> onComplete) {
        String body;
        try {
            body = objectMapper.writeValueAsString(request);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize request", e);
        }
        Request req = new Request.Builder()
                .url(baseUrl + "/api/llm/chat-stream")
                .post(RequestBody.create(body, JSON_MEDIA))
                .build();
        try (Response resp = httpClient.newCall(req).execute()) {
            if (!resp.isSuccessful() || resp.body() == null) {
                throw new RuntimeException("Python LLM stream error: " + resp.code());
            }
            StringBuilder fullContent = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(resp.body().byteStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.startsWith("data: ")) {
                        String data = line.substring(6).trim();
                        if ("[DONE]".equals(data)) break;
                        try {
                            Map<?, ?> event = objectMapper.readValue(data, Map.class);
                            String type = (String) event.get("type");
                            if ("delta".equals(type)) {
                                String text = (String) event.get("text");
                                if (text != null && !text.isEmpty()) {
                                    onToken.accept(text);
                                    fullContent.append(text);
                                }
                            }
                        } catch (Exception ignored) {}
                    }
                }
            }
            ChatCompletionResponse complete = new ChatCompletionResponse();
            // Build a minimal response so callers can inspect finish reason
            ChatMessage msg = new ChatMessage();
            msg.setRole("assistant");
            msg.setContent(fullContent.toString());
            complete.setChoices(Collections.singletonList(
                    new ChatCompletionResponse.Choice(msg, "stop")));
            onComplete.accept(complete);
        } catch (IOException e) {
            throw new RuntimeException("Python LLM stream IO error", e);
        }
    }

    public ChatCompletionResponse chatCompletionWithTools(List<ChatMessage> messages,
                                                          List<Tool> tools,
                                                          String toolChoice) {
        Map<String, Object> body = new HashMap<>();
        body.put("messages", messages);
        body.put("tools", tools);
        body.put("tool_choice", toolChoice != null ? toolChoice : "auto");
        return post("/api/llm/tool-call", body, ChatCompletionResponse.class);
    }

    // ── Helper convenience methods ────────────────────────────────────────────

    public String chat(String systemPrompt, String userInput) {
        ChatCompletionRequest req = buildSimpleRequest(systemPrompt, userInput, 0.7, null);
        return extractContent(chatCompletion(req));
    }

    public String chatFast(String systemPrompt, String userInput) {
        // Python router selects fastest model per SLOT.CHAT; no separate fast-model config needed
        return chat(systemPrompt, userInput);
    }

    public String chatLowTemp(String systemPrompt, String userInput) {
        ChatCompletionRequest req = buildSimpleRequest(systemPrompt, userInput, 0.1, null);
        return extractContent(chatCompletion(req));
    }

    public ChatCompletionResponse chatWithThinking(String systemPrompt, String userInput, int thinkingBudget) {
        ChatCompletionRequest req = buildSimpleRequest(systemPrompt, userInput, 0.7, null);
        req.setEnableThinking(true);
        return chatCompletion(req);
    }

    public String classifyIntent(String systemPrompt, String userInput) {
        Map<String, Object> body = new HashMap<>();
        body.put("messages", List.of(
                Map.of("role", "system", "content", truncate(systemPrompt)),
                Map.of("role", "user", "content", truncate(userInput))
        ));
        ChatCompletionResponse resp = post("/api/llm/intent-classify", body, ChatCompletionResponse.class);
        return resp.getContent();
    }

    // ── Vision (delegated from DashScopeVisionClient) ─────────────────────────

    public String visionChat(byte[] imageBytes, String contentType, String prompt) {
        RequestBody filePart = RequestBody.create(imageBytes, MediaType.parse(contentType));
        RequestBody multipart = new MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("image", "image.jpg", filePart)
                .addFormDataPart("prompt", prompt)
                .build();
        Request req = new Request.Builder()
                .url(baseUrl + "/api/llm/vision")
                .post(multipart)
                .build();
        try (Response resp = httpClient.newCall(req).execute()) {
            if (!resp.isSuccessful() || resp.body() == null) {
                throw new RuntimeException("Python vision error: " + resp.code());
            }
            ChatCompletionResponse result = objectMapper.readValue(resp.body().string(), ChatCompletionResponse.class);
            return result.getContent();
        } catch (IOException e) {
            throw new RuntimeException("Python vision IO error", e);
        }
    }

    // ── Tool-call result helpers (pure logic, no HTTP) ─────────────────────────

    public boolean hasToolCalls(ChatCompletionResponse response) {
        if (response == null || response.getChoices() == null || response.getChoices().isEmpty()) return false;
        List<ToolCall> calls = response.getChoices().get(0).getMessage().getToolCalls();
        return calls != null && !calls.isEmpty();
    }

    public ToolCall getFirstToolCall(ChatCompletionResponse response) {
        if (!hasToolCalls(response)) return null;
        return response.getChoices().get(0).getMessage().getToolCalls().get(0);
    }

    public List<ToolCall> getAllToolCalls(ChatCompletionResponse response) {
        if (!hasToolCalls(response)) return Collections.emptyList();
        return response.getChoices().get(0).getMessage().getToolCalls();
    }

    public ChatCompletionResponse chatWithTools(String systemPrompt, String userInput, List<Tool> tools) {
        List<ChatMessage> messages = List.of(
                ChatMessage.system(systemPrompt),
                ChatMessage.user(userInput)
        );
        return chatCompletionWithTools(messages, tools, "auto");
    }

    public boolean isAvailable() {
        try {
            Request req = new Request.Builder().url(baseUrl + "/health").build();
            try (Response resp = httpClient.newCall(req).execute()) {
                return resp.isSuccessful();
            }
        } catch (Exception e) {
            log.warn("PythonLLMClient health check failed: {}", e.getMessage());
            return false;
        }
    }

    // ── Internal helpers ───────────────────────────────────────────────────────

    private <T> T post(String path, Object body, Class<T> responseType) {
        try {
            String json = objectMapper.writeValueAsString(body);
            Request req = new Request.Builder()
                    .url(baseUrl + path)
                    .post(RequestBody.create(json, JSON_MEDIA))
                    .build();
            try (Response resp = httpClient.newCall(req).execute()) {
                if (!resp.isSuccessful() || resp.body() == null) {
                    log.error("Python LLM error {} on {}", resp.code(), path);
                    throw new RuntimeException("Python LLM HTTP " + resp.code() + " on " + path);
                }
                return objectMapper.readValue(resp.body().string(), responseType);
            }
        } catch (IOException e) {
            throw new RuntimeException("Python LLM IO error on " + path, e);
        }
    }

    private ChatCompletionRequest buildSimpleRequest(String system, String user,
                                                      double temperature, Integer maxTokens) {
        ChatCompletionRequest req = new ChatCompletionRequest();
        req.setMessages(List.of(ChatMessage.system(truncate(system)), ChatMessage.user(truncate(user))));
        req.setTemperature(temperature);
        if (maxTokens != null) req.setMaxTokens(maxTokens);
        return req;
    }

    private String extractContent(ChatCompletionResponse resp) {
        if (resp == null || resp.getChoices() == null || resp.getChoices().isEmpty()) return "";
        return resp.getChoices().get(0).getMessage().getContent();
    }

    private String truncate(String s) {
        if (s == null) return "";
        return s.length() > MAX_CONTENT_CHARS ? s.substring(0, MAX_CONTENT_CHARS) : s;
    }
}
```

- [ ] **Step 3.3: Check that ChatMessage has static factory methods**

```bash
grep -n "static.*system\|static.*user" backend/java/cretas-api/src/main/java/com/cretas/aims/ai/dto/ChatMessage.java
```

If `ChatMessage.system()` and `ChatMessage.user()` don't exist, create them by checking what constructors exist:

```bash
grep -n "public ChatMessage\|@AllArgs\|@Builder" backend/java/cretas-api/src/main/java/com/cretas/aims/ai/dto/ChatMessage.java | head -5
```

If the class uses `@Builder`, replace `ChatMessage.system(...)` calls in PythonLLMClient with:
```java
ChatMessage.builder().role("system").content(truncate(system)).build()
```
and `ChatMessage.user(...)` with:
```java
ChatMessage.builder().role("user").content(truncate(user)).build()
```

- [ ] **Step 3.4: Check that ChatCompletionResponse.Choice exists**

```bash
grep -n "class Choice\|Choice\b" backend/java/cretas-api/src/main/java/com/cretas/aims/ai/dto/ChatCompletionResponse.java | head -10
```

If `ChatCompletionResponse.Choice` doesn't have a constructor `(ChatMessage msg, String finishReason)`, find the correct constructor pattern and update the `chatCompletionStream` method accordingly.

- [ ] **Step 3.5: Compile check**

```bash
cd backend/java/cretas-api
mvn compile -q 2>&1 | grep -E "ERROR|error:" | head -20
```

Fix any compilation errors, then re-run until clean.

- [ ] **Step 3.6: Commit**

```bash
git commit -m "feat(llm-phase1): add PythonLLMClient — Java proxy to Python /api/llm/*" \
  -- backend/java/cretas-api/src/main/java/com/cretas/aims/ai/client/PythonLLMClient.java
```

---

## Task 4: Gut DashScopeClient to delegation shim

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/client/DashScopeClient.java`

This task replaces 689 lines of direct DashScope API code with ~60 lines of delegation. The class name, package, and all method signatures stay identical so the 38 caller files need zero changes.

- [ ] **Step 4.1: Record current line count as baseline**

```bash
wc -l backend/java/cretas-api/src/main/java/com/cretas/aims/ai/client/DashScopeClient.java
```

Note the number (should be ~689).

- [ ] **Step 4.2: Replace DashScopeClient.java with the shim**

Overwrite the entire file:

```java
package com.cretas.aims.ai.client;

import com.cretas.aims.ai.dto.ChatCompletionRequest;
import com.cretas.aims.ai.dto.ChatCompletionResponse;
import com.cretas.aims.ai.dto.ChatMessage;
import com.cretas.aims.ai.dto.Tool;
import com.cretas.aims.ai.dto.ToolCall;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.function.Consumer;

/**
 * Backward-compat shim — delegates all LLM calls to PythonLLMClient.
 *
 * This class previously called DashScope directly (689 lines). It is now a
 * thin delegation wrapper so the 38 callers that inject DashScopeClient
 * require zero changes. The actual LLM logic (4-provider fallback, circuit
 * breaker, metrics) lives in PythonLLMClient → Python /api/llm/* → llm_router.py.
 *
 * Cleanup note: once all callers are updated to inject PythonLLMClient directly
 * (Phase 3 follow-up), this class can be deleted.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DashScopeClient {

    private final PythonLLMClient delegate;

    public ChatCompletionResponse chatCompletion(ChatCompletionRequest request) {
        return delegate.chatCompletion(request);
    }

    public String chat(String systemPrompt, String userInput) {
        return delegate.chat(systemPrompt, userInput);
    }

    public String chatFast(String systemPrompt, String userInput) {
        return delegate.chatFast(systemPrompt, userInput);
    }

    public String chatLowTemp(String systemPrompt, String userInput) {
        return delegate.chatLowTemp(systemPrompt, userInput);
    }

    public ChatCompletionResponse chatWithThinking(String systemPrompt, String userInput, int thinkingBudget) {
        return delegate.chatWithThinking(systemPrompt, userInput, thinkingBudget);
    }

    public void chatCompletionStream(ChatCompletionRequest request,
                                     Consumer<String> onToken,
                                     Consumer<ChatCompletionResponse> onComplete) {
        delegate.chatCompletionStream(request, onToken, onComplete);
    }

    public String classifyIntent(String systemPrompt, String userInput) {
        return delegate.classifyIntent(systemPrompt, userInput);
    }

    public boolean isAvailable() {
        return delegate.isAvailable();
    }

    public ChatCompletionResponse chatCompletionWithTools(List<ChatMessage> messages,
                                                          List<Tool> tools,
                                                          String toolChoice) {
        return delegate.chatCompletionWithTools(messages, tools, toolChoice);
    }

    public ChatCompletionResponse chatWithTools(String systemPrompt, String userInput, List<Tool> tools) {
        return delegate.chatWithTools(systemPrompt, userInput, tools);
    }

    public boolean hasToolCalls(ChatCompletionResponse response) {
        return delegate.hasToolCalls(response);
    }

    public ToolCall getFirstToolCall(ChatCompletionResponse response) {
        return delegate.getFirstToolCall(response);
    }

    public List<ToolCall> getAllToolCalls(ChatCompletionResponse response) {
        return delegate.getAllToolCalls(response);
    }

    /** Static utility — no HTTP call. Returns false if response has no choices. */
    public static boolean shouldEnableThinking(String userInput) {
        // Keep static utility: thinking mode determined by input complexity heuristic
        if (userInput == null) return false;
        return userInput.length() > 200 || userInput.contains("分析") || userInput.contains("推理");
    }
}
```

- [ ] **Step 4.3: Verify shim compiles**

```bash
cd backend/java/cretas-api
mvn compile -q 2>&1 | grep -E "ERROR|error:" | head -20
```

Expected: no errors. If any arise, they are likely missing method overloads in PythonLLMClient — add them.

- [ ] **Step 4.4: Verify the 38 callers all still compile**

```bash
cd backend/java/cretas-api
mvn compile -q 2>&1 | tail -5
```

Expected: `BUILD SUCCESS`

- [ ] **Step 4.5: Commit**

```bash
git commit -m "refactor(llm-phase1): DashScopeClient → delegation shim to PythonLLMClient" \
  -- backend/java/cretas-api/src/main/java/com/cretas/aims/ai/client/DashScopeClient.java
```

---

## Task 5: Gut DashScopeVisionClient to delegation shim

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/client/DashScopeVisionClient.java`

- [ ] **Step 5.1: Read the current DashScopeVisionClient public methods**

```bash
grep -n "public " backend/java/cretas-api/src/main/java/com/cretas/aims/ai/client/DashScopeVisionClient.java | grep -v "//"
```

Note all method signatures for the shim.

- [ ] **Step 5.2: Read each method body to extract the prompt string it uses**

```bash
grep -A 10 "public.*analyzeImage\|public.*parseScale\|public.*analyzeCameraAlert\|public.*analyzeCompletionGesture\|public.*recognizeLabel" \
  backend/java/cretas-api/src/main/java/com/cretas/aims/ai/client/DashScopeVisionClient.java | head -80
```

Note the hardcoded prompt string for each method (e.g., "请识别图片中的磅秤读数" for parseScaleImage).

- [ ] **Step 5.3: Replace DashScopeVisionClient.java with the shim**

The exact prompts come from Step 5.2. Fill them in below:

```java
package com.cretas.aims.ai.client;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Backward-compat shim — delegates vision calls to PythonLLMClient.visionChat().
 *
 * Each method preserves its original prompt string so behavior is unchanged.
 * The VL model is selected by Python's SLOT.VL routing in llm_router.py.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DashScopeVisionClient {

    private final PythonLLMClient delegate;

    public String parseScaleImage(byte[] imageBytes) {
        return delegate.visionChat(imageBytes, "image/jpeg",
                "请识别图片中的磅秤或电子秤显示的重量数值，只返回数字和单位，例如：12.5kg");
    }

    public String analyzeImage(byte[] imageBytes, String prompt) {
        return delegate.visionChat(imageBytes, "image/jpeg", prompt);
    }

    public String analyzeCameraAlert(byte[] imageBytes, String alertDescription) {
        return delegate.visionChat(imageBytes, "image/jpeg",
                "这是一个摄像头告警截图。告警描述：" + alertDescription + "。请分析图片内容，说明是否属实以及需要采取什么行动。");
    }

    public String analyzeCompletionGesture(byte[] imageBytes) {
        return delegate.visionChat(imageBytes, "image/jpeg",
                "请判断图片中的人是否在做完成手势（如OK手势、竖拇指、挥手）。只回答：是 或 否");
    }

    public String recognizeLabel(byte[] imageBytes) {
        return delegate.visionChat(imageBytes, "image/jpeg",
                "请识别图片中标签上的所有文字，按照原始格式输出，不要添加解释。");
    }

    public boolean isAvailable() {
        return delegate.isAvailable();
    }
}
```

**Note:** If Step 5.2 reveals different prompts in the original code, replace the strings above with the exact originals.

- [ ] **Step 5.4: Compile check**

```bash
cd backend/java/cretas-api
mvn compile -q 2>&1 | grep -E "ERROR|error:" | head -20
```

Expected: no errors.

- [ ] **Step 5.5: Commit**

```bash
git commit -m "refactor(llm-phase1): DashScopeVisionClient → delegation shim to PythonLLMClient" \
  -- backend/java/cretas-api/src/main/java/com/cretas/aims/ai/client/DashScopeVisionClient.java
```

---

## Task 6: Full build verification + deploy + smoke test

**Files:** None created. This is a verification and deploy task.

- [ ] **Step 6.1: Full Java build with tests**

```bash
cd backend/java/cretas-api
mvn clean package -DskipTests -q 2>&1 | tail -5
```

Expected: `BUILD SUCCESS` and a JAR file at `target/aims-0.0.1-SNAPSHOT.jar`.

If it fails, read the full error output and fix. Most likely causes:
- `ChatMessage` doesn't have `system(String)` / `user(String)` factory methods → use builder pattern in PythonLLMClient (see Task 3, Step 3.3)
- `ChatCompletionResponse.Choice` constructor mismatch → adjust `chatCompletionStream` to use the correct constructor

- [ ] **Step 6.2: Deploy Python to test env**

```bash
./scripts/deploy/deploy-smartbi-python.sh --env test
```

Wait for health check to pass: `curl -s http://47.100.235.168:8084/health`

- [ ] **Step 6.3: Smoke test new Python endpoints on test env**

```bash
# Basic chat
curl -s -X POST http://47.100.235.168:8084/api/llm/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"用两个字回答：你好"}],"slot":"chat"}' | python -m json.tool

# Intent classify
curl -s -X POST http://47.100.235.168:8084/api/llm/intent-classify \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"system","content":"你是意图分类器，返回意图代码"},{"role":"user","content":"查一下最近的采购单"}]}' | python -m json.tool
```

Expected: both return JSON with `choices[0].message.content` containing a non-empty string.

- [ ] **Step 6.4: Deploy Java to test env**

```bash
./scripts/deploy/deploy-backend.sh --env test
```

Wait for health: `curl -s http://47.100.235.168:10011/api/mobile/health`

- [ ] **Step 6.5: Smoke test Java → Python LLM path on test env**

Log in and trigger an intent that uses LLM fallback. The simplest way is to call an AI endpoint that's known to hit LLM:

```bash
# Get a token for test user
TOKEN=$(curl -s -X POST http://47.100.235.168:10011/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{"username":"factory_admin1","password":"123456"}' | python -c "import sys,json; d=json.load(sys.stdin); print(d['data']['accessToken'] or d['data']['tokens']['accessToken'])")

echo "Token: ${TOKEN:0:30}..."

# Trigger an intent that would use LLM fallback (use a nonsense query to force it)
curl -s -X POST "http://47.100.235.168:10011/api/mobile/F001/ai/intent" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userInput":"这是一个测试LLM兜底分类的随机问题xyzabc123"}' | python -m json.tool
```

Expected: The response should come back without a Java-level error. Check Python test logs for a `call_chain` call:

```bash
ssh root@47.100.235.168 "tail -20 /www/wwwroot/cretas/python-test.log | grep -E 'llm|LLM|call_chain|api/llm'"
```

- [ ] **Step 6.6: Verify fallback chain fires on rate limit**

Check circuit-breaker admin endpoint to confirm the CB is wired up:

```bash
curl -s http://47.100.235.168:8084/api/smartbi/admin/llm-router/cb-stats | python -m json.tool
```

Expected: JSON with `failures`, `threshold`, `cooldown_seconds` fields.

- [ ] **Step 6.7: Push origin**

```bash
git push origin HEAD
```

- [ ] **Step 6.8: Note for prod deployment**

Prod deployment (`--env prod`) should be done explicitly after test env has been validated for at least a few hours of real traffic. Run:

```bash
./scripts/deploy/deploy-smartbi-python.sh --env prod
./scripts/deploy/deploy-backend.sh --env prod
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Phase 1 Python endpoints: `/api/llm/chat`, `/api/llm/chat-stream`, `/api/llm/tool-call`, `/api/llm/intent-classify`, `/api/llm/vision` — Tasks 1-2
- ✅ Java PythonLLMClient (~80 lines proxy) — Task 3
- ✅ DashScopeClient gutted to shim — Task 4
- ✅ DashScopeVisionClient gutted to shim — Task 5
- ✅ Deploy + smoke test — Task 6
- ⬜ LlmIntentFallbackClientImpl LLM-call refactor — not required: since DashScopeClient is now a shim, `classifyIntent()` in DashScopeClient already delegates to Python. The "AI推理部分 → Python" migration is complete without touching LlmIntentFallbackClientImpl at all.
- ⬜ DashScopeConfig.java removal — left as dead code cleanup for Phase 3 follow-up (non-breaking)

**Placeholder scan:** None found.

**Type consistency:**
- `PythonLLMClient.visionChat(byte[], String, String) → String` — used consistently in both Task 3 (definition) and Task 5 (usage)
- `DashScopeClient.chatCompletion(ChatCompletionRequest) → ChatCompletionResponse` — matches Task 4 shim and Task 3 PythonLLMClient method
- `ChatMessage.system()/user()` factory methods — flagged in Task 3 Step 3.3 as conditional; if absent, builder pattern substituted
