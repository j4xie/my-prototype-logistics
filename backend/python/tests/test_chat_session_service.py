"""Tests for smartbi.services.chat_session_service.

Pure-python tests for truncate_summary and build_context_block (no DB).
DB-backed lookup/upsert/prune tests run only when PostgreSQL is configured;
they skip cleanly otherwise.
"""
from __future__ import annotations

import uuid

import pytest
import pytest_asyncio

from smartbi.services.chat_session_service import (
    ChatSessionService,
    SUMMARY_CHAR_BUDGET,
    build_context_block,
    truncate_summary,
)


# ---------- Pure-python tests (no DB) ----------

def test_truncate_short_text_unchanged():
    assert truncate_summary("短文本") == "短文本"
    assert truncate_summary("") == ""


def test_truncate_under_budget_unchanged():
    text = "x" * (SUMMARY_CHAR_BUDGET - 1)
    assert truncate_summary(text) == text


def test_truncate_long_text_keeps_head_and_tail():
    head = "总营收 ¥15,493,162.35 (253 天覆盖)"
    middle = "中段冗余" * 500  # filler well over budget
    tail = "建议: 复盘 SOP, 每周回顾客诉率."
    text = head + middle + tail
    out = truncate_summary(text)
    assert len(out) <= SUMMARY_CHAR_BUDGET + 20  # marker overhead
    assert head[:20] in out, "head should survive"
    assert tail[-15:] in out, "tail should survive"
    assert "省略中段" in out, "marker should be present"


def test_build_context_block_with_complete_parent():
    block = build_context_block({
        "parent_query": "qhj 4189 营业总额多少",
        "parent_answer_summary": "总营收 ¥15.4M (253 天)",
        "parent_template_code": "revenue_management_report",
    })
    assert "上一轮提问" in block
    assert "qhj 4189" in block
    assert "上一轮回答" in block
    assert "15.4M" in block
    assert block.endswith("---\n\n")


def test_build_context_block_returns_empty_when_missing_fields():
    assert build_context_block({}) == ""
    assert build_context_block({"parent_query": "q only"}) == ""
    assert build_context_block({"parent_answer_summary": "a only"}) == ""
    assert build_context_block({"parent_query": "", "parent_answer_summary": "a"}) == ""


# ---------- DB-backed tests (skipped without Postgres) ----------

_TENANT_A = "TEST_CHATSESSION_A"
_TENANT_B = "TEST_CHATSESSION_B"


@pytest_asyncio.fixture
async def pool():
    import asyncpg
    from smartbi.config import get_settings
    settings = get_settings()
    if not settings.postgres_url:
        pytest.skip("No Postgres configured")
    p = await asyncpg.create_pool(
        settings.postgres_url, min_size=1, max_size=2,
    )
    try:
        # Ensure table exists for first-run test envs.
        async with p.acquire() as conn:
            exists = await conn.fetchval(
                "SELECT to_regclass('public.smart_bi_chat_session') IS NOT NULL"
            )
            if not exists:
                pytest.skip(
                    "smart_bi_chat_session table not created — "
                    "apply V20260426_02__chat_session.sql first"
                )
        yield p
    finally:
        await p.close()


async def _reset(pool, *tenants):
    async with pool.acquire() as conn:
        for t in tenants:
            await conn.execute(
                "DELETE FROM smart_bi_chat_session WHERE factory_id=$1", t,
            )


@pytest.mark.asyncio
async def test_lookup_miss_returns_none(pool):
    await _reset(pool, _TENANT_A)
    svc = ChatSessionService(pool)
    out = await svc.lookup(str(uuid.uuid4()), _TENANT_A)
    assert out is None


@pytest.mark.asyncio
async def test_upsert_then_lookup_round_trip(pool):
    await _reset(pool, _TENANT_A)
    svc = ChatSessionService(pool)
    sid = str(uuid.uuid4())
    await svc.upsert(
        session_id=sid,
        factory_id=_TENANT_A,
        parent_query="本月营业额",
        parent_answer_summary="总额 1500 万",
        parent_template_code="revenue_summary",
        parent_upload_id=4189,
    )
    got = await svc.lookup(sid, _TENANT_A)
    assert got is not None
    assert got["parent_query"] == "本月营业额"
    assert got["parent_answer_summary"] == "总额 1500 万"
    assert got["parent_template_code"] == "revenue_summary"
    assert got["parent_upload_id"] == 4189
    assert got["turn_count"] == 1


@pytest.mark.asyncio
async def test_upsert_same_session_increments_turn_and_refreshes(pool):
    await _reset(pool, _TENANT_A)
    svc = ChatSessionService(pool)
    sid = str(uuid.uuid4())
    await svc.upsert(sid, _TENANT_A, "q1", "a1")
    await svc.upsert(sid, _TENANT_A, "q2", "a2")
    got = await svc.lookup(sid, _TENANT_A)
    assert got["turn_count"] == 2
    assert got["parent_query"] == "q2"
    assert got["parent_answer_summary"] == "a2"


@pytest.mark.asyncio
async def test_lookup_factory_mismatch_returns_none(pool):
    await _reset(pool, _TENANT_A, _TENANT_B)
    svc = ChatSessionService(pool)
    sid = str(uuid.uuid4())
    await svc.upsert(sid, _TENANT_A, "tenant A query", "tenant A answer")
    # Cross-tenant lookup must NOT leak.
    cross = await svc.lookup(sid, _TENANT_B)
    assert cross is None
    same = await svc.lookup(sid, _TENANT_A)
    assert same is not None


@pytest.mark.asyncio
async def test_prune_deletes_expired_only(pool):
    await _reset(pool, _TENANT_A)
    svc = ChatSessionService(pool)
    sid_live = str(uuid.uuid4())
    sid_dead = str(uuid.uuid4())
    await svc.upsert(sid_live, _TENANT_A, "live q", "live a")
    await svc.upsert(sid_dead, _TENANT_A, "dead q", "dead a")
    # Force one to expire.
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE smart_bi_chat_session SET expires_at = NOW() - INTERVAL '1 second' "
            "WHERE session_id = $1",
            sid_dead,
        )
    deleted = await svc.prune_expired()
    assert deleted >= 1
    assert await svc.lookup(sid_live, _TENANT_A) is not None
    assert await svc.lookup(sid_dead, _TENANT_A) is None


@pytest.mark.asyncio
async def test_upsert_truncates_long_summary(pool):
    await _reset(pool, _TENANT_A)
    svc = ChatSessionService(pool)
    sid = str(uuid.uuid4())
    long_text = "ABC" * (SUMMARY_CHAR_BUDGET * 2)
    await svc.upsert(sid, _TENANT_A, "q", long_text)
    got = await svc.lookup(sid, _TENANT_A)
    assert got is not None
    assert len(got["parent_answer_summary"]) <= SUMMARY_CHAR_BUDGET + 20
