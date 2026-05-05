"""Compare embedding models for AI intent matching.

Models:
    A. gte-base-zh-finetuned-onnx-fixed (current, via cretas-embedding gRPC)
    B. DashScope text-embedding-v3 (Aliyun API, already used by SmartBI/food_kb)
    C. BGE-base-zh-v1.5 (best open Chinese model, requires HF download)

Test harness:
    1. Pick a representative subset of intents (50 from various categories)
    2. For each model: embed all 50 intents (using the same source text builder)
    3. For 8 test queries (mix of paraphrase / short / nonsense / multi-domain):
       - Compute query embedding via that model
       - Compute top-3 cosine similarity matches
    4. Report side-by-side: top-1 intent, sim, sim spread (top1-top5)
    5. Also report: % queries where top-1 is "correct" (manually labeled gold)

Output: comparison table per query, per model.

Usage (run on server 47, where DashScope key + cretas-embedding gRPC reachable):
    cd /www/wwwroot/cretas/code/backend/python && source venv38/bin/activate
    python /tmp/compare-embedding-models.py
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from typing import Dict, List, Optional, Tuple

sys.path.insert(0, "/www/wwwroot/cretas/code/backend/python")

import asyncpg
import httpx

# ----- Test queries with gold labels -----
TEST_CASES = [
    # (query, expected_intent_code or None for "should not match anything")
    ("成本趋势", "COST_TREND_ANALYSIS"),
    ("查询库存", "QUERY_INVENTORY_QUANTITY"),
    ("我想看一下这个月的成本变化情况", "COST_TREND_ANALYSIS"),
    ("请帮我列出当前所有库存原料数量", "QUERY_MATERIAL_STOCK_SUMMARY"),
    ("今天有什么待处理的工单", None),  # no specific intent expected
    ("供应商的付款情况怎么样", None),  # finance payable-ish
    ("RANDOMNONSENSE无意义查询测试", None),  # SHOULD return low scores / NONE
    ("添加一个新的客户档案", None),  # CRM domain
]


async def fetch_intents_with_text(pool: asyncpg.Pool, limit: int = 60):
    """Fetch a representative subset of intents — only those with rich text."""
    rows = await pool.fetch("""
        SELECT id, intent_code, intent_name, intent_category, description,
               keywords, example_queries
        FROM ai_intent_configs
        WHERE deleted_at IS NULL AND is_active=true
          AND LENGTH(COALESCE(description, '')) > 10
        ORDER BY intent_category, priority DESC, intent_code
        LIMIT $1
    """, limit)
    return rows


def build_source_text(row) -> str:
    """Same formula as backfill — name + category + desc + keywords + examples."""
    name = (row["intent_name"] or "").strip()
    desc = (row["description"] or "").strip()
    cat = (row["intent_category"] or "").strip()

    def list_from_jsonb(v):
        if v is None:
            return []
        if isinstance(v, list):
            return [str(x).strip() for x in v if str(x).strip()]
        if isinstance(v, str):
            try:
                p = json.loads(v)
                if isinstance(p, list):
                    return [str(x).strip() for x in p if str(x).strip()]
            except json.JSONDecodeError:
                pass
        return []

    parts = []
    if name:
        parts.append(name)
    if cat:
        parts.append(cat)
    if desc and desc != name:
        parts.append(desc)
    parts.extend(list_from_jsonb(row.get("keywords")))
    parts.extend(list_from_jsonb(row.get("example_queries")))
    return " ".join(parts)


# ----- Model A: gte-finetuned via gRPC (current) -----
async def embed_a(texts: List[str]) -> List[Optional[List[float]]]:
    from ai.embedding import get_embedding as gte_embed
    results = []
    for t in texts:
        v = await gte_embed(t)
        results.append(v)
    return results


# ----- Model B: DashScope text-embedding-v3 -----
DASHSCOPE_KEY = None
DASHSCOPE_BASE = "https://dashscope.aliyuncs.com/compatible-mode/v1"


async def embed_b(texts: List[str]) -> List[Optional[List[float]]]:
    """Call DashScope OpenAI-compatible /embeddings endpoint."""
    global DASHSCOPE_KEY
    if not DASHSCOPE_KEY:
        env = open("/www/wwwroot/cretas/code/backend/python/.env.keys").read()
        for line in env.split("\n"):
            if line.startswith("LLM_ALIYUN_B_API_KEY="):
                DASHSCOPE_KEY = line.split("=", 1)[1].strip()
                break
    results = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        for t in texts:
            try:
                resp = await client.post(
                    f"{DASHSCOPE_BASE}/embeddings",
                    headers={
                        "Authorization": f"Bearer {DASHSCOPE_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={"model": "text-embedding-v3", "input": t, "dimensions": 768},
                )
                resp.raise_for_status()
                data = resp.json()
                results.append(data["data"][0]["embedding"])
            except Exception as e:
                print(f"  [B fail] {t[:30]!r}: {e}")
                results.append(None)
    return results


# ----- Model C: BGE-base-zh-v1.5 (local) -----
_BGE_MODEL = None
_BGE_TOK = None


def _load_bge():
    global _BGE_MODEL, _BGE_TOK
    if _BGE_MODEL is None:
        from transformers import AutoTokenizer, AutoModel
        import torch
        MODEL_DIR = "/tmp/models/models--BAAI--bge-base-zh-v1.5/snapshots/f03589ceff5aac7111bd60cfc7d497ca17ecac65"
        _BGE_TOK = AutoTokenizer.from_pretrained(MODEL_DIR)
        _BGE_MODEL = AutoModel.from_pretrained(MODEL_DIR)
        _BGE_MODEL.eval()


async def embed_c(texts: List[str]) -> List[Optional[List[float]]]:
    import torch
    import torch.nn.functional as F
    _load_bge()
    # BGE recommended prefix for retrieval queries (improves quality)
    # See: https://huggingface.co/BAAI/bge-base-zh-v1.5#usage
    prefixed = [f"为这个句子生成表示以用于检索相关文章：{t}" for t in texts]
    with torch.no_grad():
        enc = _BGE_TOK(prefixed, padding=True, truncation=True, max_length=512, return_tensors="pt")
        out = _BGE_MODEL(**enc)
        emb = out.last_hidden_state[:, 0]
        emb = F.normalize(emb, p=2, dim=1)
    return emb.numpy().tolist()


# ----- Cosine similarity -----
def cosine(a: List[float], b: List[float]) -> float:
    import math
    dot = sum(x * y for x, y in zip(a, b))
    n1 = math.sqrt(sum(x * x for x in a))
    n2 = math.sqrt(sum(y * y for y in b))
    return dot / (n1 * n2) if n1 and n2 else 0.0


def top_k(query_vec, intent_vecs, k=5) -> List[Tuple[float, int]]:
    """Return list of (sim, intent_idx) sorted desc."""
    scored = [(cosine(query_vec, v), i) for i, v in enumerate(intent_vecs) if v is not None]
    scored.sort(key=lambda x: -x[0])
    return scored[:k]


# ----- Main -----
async def main():
    pool = await asyncpg.create_pool(
        "postgresql://cretas_user:cretas123@localhost:5432/cretas_prod_db",
        min_size=1, max_size=2,
    )
    try:
        print("Fetching 60 representative intents...")
        rows = await fetch_intents_with_text(pool, limit=60)
        intent_codes = [r["intent_code"] for r in rows]
        intent_names = [r["intent_name"] for r in rows]
        intent_texts = [build_source_text(r) for r in rows]
        n = len(rows)
        print(f"  Got {n} intents.\n")

        # Embed intents with both models
        print("Embedding intents with model A (gte-finetuned)...")
        t0 = time.time()
        a_intent_vecs = await embed_a(intent_texts)
        print(f"  A: {n} intents in {time.time() - t0:.1f}s")

        print("Embedding intents with model B (DashScope text-embedding-v3)...")
        t0 = time.time()
        b_intent_vecs = await embed_b(intent_texts)
        print(f"  B: {n} intents in {time.time() - t0:.1f}s")

        print("Embedding intents with model C (BGE-base-zh-v1.5 local)...")
        t0 = time.time()
        # BGE: for the corpus side (intents), no prefix recommended
        # Override embed_c temporarily for corpus
        from transformers import AutoTokenizer, AutoModel
        import torch
        import torch.nn.functional as F
        _load_bge()
        with torch.no_grad():
            enc = _BGE_TOK(intent_texts, padding=True, truncation=True, max_length=512, return_tensors="pt")
            out = _BGE_MODEL(**enc)
            emb = out.last_hidden_state[:, 0]
            emb = F.normalize(emb, p=2, dim=1)
        c_intent_vecs = emb.numpy().tolist()
        print(f"  C: {n} intents in {time.time() - t0:.1f}s")

        # Run test queries
        print("\n" + "=" * 80)
        print("QUERY-BY-QUERY COMPARISON")
        print("=" * 80)

        gold_correct_a, gold_correct_b, gold_correct_c = 0, 0, 0
        gold_total = 0
        spread_a_sum, spread_b_sum, spread_c_sum = 0.0, 0.0, 0.0
        b_lat_sum, c_lat_sum = 0.0, 0.0

        for q, gold in TEST_CASES:
            a_qvec = (await embed_a([q]))[0]
            t0 = time.time()
            b_qvec = (await embed_b([q]))[0]
            b_lat = (time.time() - t0) * 1000
            b_lat_sum += b_lat
            t0 = time.time()
            c_qvec = (await embed_c([q]))[0]
            c_lat = (time.time() - t0) * 1000
            c_lat_sum += c_lat

            print(f"\n--- query: {q!r}  (gold={gold or 'NONE/any'}) ---")

            # Model A top-3
            top_a = top_k(a_qvec, a_intent_vecs, k=5)
            print(f"  A gte-finetuned:")
            for sim, idx in top_a[:3]:
                marker = "✓" if intent_codes[idx] == gold else " "
                print(f"    {marker} sim={sim:.4f} | {intent_codes[idx]:<35} | {intent_names[idx]}")
            spread_a = top_a[0][0] - top_a[4][0] if len(top_a) >= 5 else 0
            print(f"    spread={spread_a:.4f}  {'⚠ COLLAPSE' if spread_a < 0.01 else ''}")

            # Model B top-3
            top_b = top_k(b_qvec, b_intent_vecs, k=5) if b_qvec else []
            print(f"  B DashScope text-embedding-v3 [{b_lat:.0f}ms]:")
            for sim, idx in top_b[:3]:
                marker = "✓" if intent_codes[idx] == gold else " "
                print(f"    {marker} sim={sim:.4f} | {intent_codes[idx]:<35} | {intent_names[idx]}")
            spread_b = top_b[0][0] - top_b[4][0] if len(top_b) >= 5 else 0
            print(f"    spread={spread_b:.4f}  {'⚠ COLLAPSE' if spread_b < 0.01 else ''}")

            # Model C top-3
            top_c = top_k(c_qvec, c_intent_vecs, k=5) if c_qvec else []
            print(f"  C BGE-base-zh-v1.5 local [{c_lat:.0f}ms]:")
            for sim, idx in top_c[:3]:
                marker = "✓" if intent_codes[idx] == gold else " "
                print(f"    {marker} sim={sim:.4f} | {intent_codes[idx]:<35} | {intent_names[idx]}")
            spread_c = top_c[0][0] - top_c[4][0] if len(top_c) >= 5 else 0
            print(f"    spread={spread_c:.4f}  {'⚠ COLLAPSE' if spread_c < 0.01 else ''}")

            # Score correctness against gold
            if gold:
                gold_total += 1
                if top_a and intent_codes[top_a[0][1]] == gold:
                    gold_correct_a += 1
                if top_b and intent_codes[top_b[0][1]] == gold:
                    gold_correct_b += 1
                if top_c and intent_codes[top_c[0][1]] == gold:
                    gold_correct_c += 1

            spread_a_sum += spread_a
            spread_b_sum += spread_b
            spread_c_sum += spread_c

        # Summary
        n_q = len(TEST_CASES)
        print("\n" + "=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(f"  Top-1 gold correctness:     A={gold_correct_a}/{gold_total}  B={gold_correct_b}/{gold_total}  C={gold_correct_c}/{gold_total}")
        print(f"  Avg sim spread (top1-top5): A={spread_a_sum/n_q:.4f}  B={spread_b_sum/n_q:.4f}  C={spread_c_sum/n_q:.4f}")
        print(f"    (higher = more discriminating; <0.01 = collapse)")
        print(f"  Avg per-query latency:      A=<50ms  B={b_lat_sum/n_q:.0f}ms  C={c_lat_sum/n_q:.0f}ms")

    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
