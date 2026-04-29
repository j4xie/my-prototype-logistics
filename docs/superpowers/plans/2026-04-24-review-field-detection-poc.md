# Review Field Detection POC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `reviews_sentiment_summary.py` to centralized `schema_helpers` helpers, enabling multi-merchant column-name resolution without regex risks.

**Architecture:** Extend existing `restaurant/schema_helpers.py` with 12 review-domain field candidate tuples + 12 `find_*_col()` wrappers using existing `_first_present` literal-priority pattern. Replace 11 local `_first()` calls in `reviews_sentiment_summary.py` with the new helpers. Delete local `_XXX_CANDIDATES` (12 tuples) + local `_first()` from template. Add unit tests + 美团-renamed synthetic xlsx test + negative xlsx test.

**Tech Stack:** Python 3.8 (server venv38), polars (template compute), pytest, FastAPI (Python service 8084 test / 8083 prod), PostgreSQL (smartbi_db cache).

**Spec:** `docs/superpowers/specs/2026-04-24-review-field-detection-poc-design.md` (commits 1421a7154 + 9b906e3bd)

**Branch:** `e2e/v1-framework`

---

## File map

| File | Action | Lines |
|---|---|---|
| `backend/python/smartbi/services/materialized_analytics/restaurant/schema_helpers.py` | MODIFY | +90 |
| `backend/python/smartbi/services/materialized_analytics/templates/reviews_sentiment_summary.py` | MODIFY | -32, +12 |
| `backend/python/smartbi/services/materialized_analytics/tests/test_schema_helpers_review.py` | CREATE | ~180 |
| `backend/python/smartbi/services/materialized_analytics/tests/fixtures/qhj_3975_meituan_renamed.xlsx` | CREATE | binary ~4MB |
| `backend/python/smartbi/services/materialized_analytics/tests/fixtures/qhj_3975_no_review_cols.xlsx` | CREATE | binary ~50KB |
| `backend/python/smartbi/services/materialized_analytics/tests/fixtures/generate_review_fixtures.py` | CREATE | ~80 lines (regenerator script) |

---

## Task 1: TDD — Write failing test_schema_helpers_review.py

**Files:**
- Create: `backend/python/smartbi/services/materialized_analytics/tests/test_schema_helpers_review.py`

- [ ] **Step 1: Create test file with all unit tests (will fail — helpers don't exist yet)**

```python
"""Unit tests for review-domain helpers in restaurant/schema_helpers.py.

Test depth: smoke (per qa-prompt v2.4 Rule 1). Paired with end-to-end
re-materialize byte-match test for deep coverage.

Each helper is tested for:
  - happy path (qhj 大众点评 Q3 column name present)
  - multi-merchant variant (美团/抖音 plausible name present)
  - priority ordering (most-specific candidate wins when multiple present)
  - negative cases (ID-suffixed columns / unrelated columns / empty cols)
"""
from smartbi.services.materialized_analytics.restaurant import schema_helpers


# ─── STORE ───
class TestReviewStoreCol:
    def test_qhj_standard(self):
        assert schema_helpers.find_review_store_col(["评价时间", "具体门店", "星级"]) == "具体门店"

    def test_meituan_branch_variant(self):
        assert schema_helpers.find_review_store_col(["评价时间", "分店", "星级"]) == "分店"

    def test_dianping_alternate(self):
        assert schema_helpers.find_review_store_col(["评价时间", "评价门店", "星级"]) == "评价门店"

    def test_priority_specific_wins(self):
        # 具体门店 (priority-1) wins over 门店名称 (priority-3) when both present
        assert schema_helpers.find_review_store_col(["具体门店", "门店名称"]) == "具体门店"

    def test_only_id_returns_none(self):
        # qhj 3975 contains 门店分类ID — must NOT be picked as store col
        assert schema_helpers.find_review_store_col(["门店分类ID", "评价时间"]) is None

    def test_id_and_real_both_present(self):
        # ID suffix col + real store col → must return real store col
        assert schema_helpers.find_review_store_col(["门店分类ID", "具体门店"]) == "具体门店"

    def test_empty_cols(self):
        assert schema_helpers.find_review_store_col([]) is None


# ─── STAR / RATING ───
class TestStarCol:
    def test_qhj_uses_star(self):
        assert schema_helpers.find_star_col(["星级", "口味分"]) == "星级"

    def test_qualified_priority(self):
        # _STAR_CANDIDATES = ("星级分", "评分", "星级") — most-qualified first
        assert schema_helpers.find_star_col(["星级", "评分", "星级分"]) == "星级分"

    def test_evaluation_score_variant(self):
        # 评分 alone (no 星级) — common 美团 variant
        assert schema_helpers.find_star_col(["评分", "口味"]) == "评分"

    def test_no_rating_col_returns_none(self):
        # No star/score col present
        assert schema_helpers.find_star_col(["评价时间", "用户昵称"]) is None


# ─── TASTE / ENV / SERVICE SCORES ───
class TestTasteScoreCol:
    def test_qhj_taste_score(self):
        assert schema_helpers.find_taste_score_col(["口味分", "口味标签"]) == "口味分"

    def test_only_tag_present_returns_none(self):
        # 口味标签 alone is csv tag list, NOT rating — must return None
        assert schema_helpers.find_taste_score_col(["口味标签"]) is None

    def test_reorder_does_not_affect(self):
        # Even with 口味标签 first in xlsx col order, helper picks 口味分
        assert schema_helpers.find_taste_score_col(["口味标签", "口味分", "环境分"]) == "口味分"


class TestEnvScoreCol:
    def test_qhj_env(self):
        assert schema_helpers.find_env_score_col(["环境分", "环境标签"]) == "环境分"

    def test_only_tag_returns_none(self):
        assert schema_helpers.find_env_score_col(["环境标签"]) is None


class TestServiceScoreCol:
    def test_qhj_service(self):
        assert schema_helpers.find_service_score_col(["服务分", "服务标签"]) == "服务分"

    def test_only_tag_returns_none(self):
        # 服务标签 (qhj has this) must NOT be picked as service rating
        assert schema_helpers.find_service_score_col(["服务标签"]) is None


# ─── REVIEW TIME ───
class TestReviewTimeCol:
    def test_qhj_review_time(self):
        assert schema_helpers.find_review_time_col(["评价时间", "用户昵称"]) == "评价时间"

    def test_meituan_comment_time(self):
        assert schema_helpers.find_review_time_col(["评论时间", "用户昵称"]) == "评论时间"

    def test_priority_evaluation_over_creation(self):
        # _REVIEW_TIME_CANDIDATES = ("评价时间", "评论时间", "发表时间", "创建时间")
        # Evaluation timestamp wins over generic creation timestamp
        assert schema_helpers.find_review_time_col(["创建时间", "评价时间"]) == "评价时间"


# ─── REVIEW CONTENT ───
class TestReviewContentCol:
    def test_qhj_content(self):
        # qhj uses 评价内容 (older) and 评价详情 (newer)
        assert schema_helpers.find_review_content_col(["评价内容", "用户昵称"]) == "评价内容"

    def test_priority_detail_over_content(self):
        # _REVIEW_CONTENT_CANDIDATES = ("评价详情", "评价内容", "评论详情", "评论内容")
        assert schema_helpers.find_review_content_col(["评价内容", "评价详情"]) == "评价详情"


# ─── VIP FLAG ───
class TestVipFlagCol:
    def test_qhj_vip_lowercase(self):
        assert schema_helpers.find_vip_flag_col(["是否vip", "用户等级"]) == "是否vip"

    def test_uppercase_variant(self):
        assert schema_helpers.find_vip_flag_col(["是否VIP", "用户等级"]) == "是否VIP"

    def test_does_not_match_member_card(self):
        # 会员卡 is a POS measure column — must NOT be picked as VIP flag
        assert schema_helpers.find_vip_flag_col(["会员卡", "会员卡支付", "用户等级"]) is None


# ─── COMPLAINT STATUS ───
class TestComplaintStatusCol:
    def test_only_status_not_time_or_title(self):
        # qhj 3975 has 投诉时间 / 投诉标题 / 投诉内容 — must NOT pick those
        assert schema_helpers.find_complaint_status_col(["投诉时间", "投诉标题", "投诉内容"]) is None

    def test_status_present(self):
        assert schema_helpers.find_complaint_status_col(["投诉时间", "投诉状态", "投诉标题"]) == "投诉状态"


# ─── REVIEW PLATFORM ───
class TestReviewPlatformCol:
    def test_qhj_platform(self):
        assert schema_helpers.find_review_platform_col(["平台", "评价来源"]) == "平台"

    def test_priority_platform_over_source(self):
        # _REVIEW_PLATFORM_CANDIDATES = ("平台", "评价来源", "渠道", "来源")
        assert schema_helpers.find_review_platform_col(["来源", "平台"]) == "平台"

    def test_meituan_channel(self):
        assert schema_helpers.find_review_platform_col(["渠道", "用户昵称"]) == "渠道"


# ─── DISH TAG ───
class TestDishTagCol:
    def test_qhj_dish_tag(self):
        assert schema_helpers.find_dish_tag_col(["菜品标签", "口味标签"]) == "菜品标签"

    def test_no_dish_tag_returns_none(self):
        # 口味标签 / 服务标签 are NOT dish tags
        assert schema_helpers.find_dish_tag_col(["口味标签", "服务标签"]) is None


# ─── COMPLAINT TITLE ───
class TestComplaintTitleCol:
    def test_qhj_title(self):
        assert schema_helpers.find_complaint_title_col(["投诉标题", "投诉内容"]) == "投诉标题"

    def test_no_title_returns_none(self):
        # 投诉内容 / 投诉时间 / 投诉状态 are NOT titles
        assert schema_helpers.find_complaint_title_col(["投诉内容", "投诉时间"]) is None
```

- [ ] **Step 2: Verify all tests fail with ImportError or AttributeError**

Run on local Windows (or test env):
```bash
cd backend/python
python -m pytest smartbi/services/materialized_analytics/tests/test_schema_helpers_review.py -v 2>&1 | head -40
```

Expected: every test fails with `AttributeError: module 'smartbi.services.materialized_analytics.restaurant.schema_helpers' has no attribute 'find_review_store_col'` (or similar — the helpers don't exist yet).

If tests don't even import: check that `backend/python` is on PYTHONPATH or that pytest discovery finds the file.

---

## Task 2: Implement candidates + helpers in schema_helpers.py

**Files:**
- Modify: `backend/python/smartbi/services/materialized_analytics/restaurant/schema_helpers.py:49-58` (insert review section after `_TABLE_COL_CANDIDATES`, before `_first_present`)

- [ ] **Step 1: Add review-domain candidate constants**

Insert AFTER line 49 (end of `_TABLE_COL_CANDIDATES`), BEFORE the blank line preceding `_first_present`:

```python


# ─── Review-domain candidates (大众点评 / 美团 / 抖音 / 小红书 export naming) ───
# Ordered by specificity; first match wins via _first_present.
# Excludes deliberately: _TASTE_SCORE_CANDIDATES does NOT contain bare "口味"
# (overlaps with 口味标签 csv tag list); _VIP_FLAG_CANDIDATES does NOT contain
# "会员" (matches 会员卡 measure col on POS xlsx).

_REVIEW_STORE_CANDIDATES: Tuple[str, ...] = (
    "具体门店",            # 大众点评 standard (qhj Q3/Q4 exports)
    "评价门店",            # 大众点评 alternate
    "门店名称", "店铺名称",  # POS-style names some merchants reuse
    "分店", "门市",          # 美团 / regional variants
)

_STAR_CANDIDATES: Tuple[str, ...] = ("星级分", "评分", "星级")
_TASTE_SCORE_CANDIDATES: Tuple[str, ...] = ("口味分",)
_ENV_SCORE_CANDIDATES: Tuple[str, ...] = ("环境分",)
_SERVICE_SCORE_CANDIDATES: Tuple[str, ...] = ("服务分",)

_REVIEW_TIME_CANDIDATES: Tuple[str, ...] = (
    "评价时间", "评论时间", "发表时间", "创建时间",
)
_REVIEW_CONTENT_CANDIDATES: Tuple[str, ...] = (
    "评价详情", "评价内容", "评论详情", "评论内容",
)

_VIP_FLAG_CANDIDATES: Tuple[str, ...] = ("是否vip", "是否VIP", "VIP")
_COMPLAINT_STATUS_CANDIDATES: Tuple[str, ...] = ("投诉状态",)
_REVIEW_PLATFORM_CANDIDATES: Tuple[str, ...] = (
    "平台", "评价来源", "渠道", "来源",
)
_DISH_TAG_CANDIDATES: Tuple[str, ...] = ("菜品标签",)
_COMPLAINT_TITLE_CANDIDATES: Tuple[str, ...] = ("投诉标题",)
```

- [ ] **Step 2: Add 12 helper functions**

Insert AFTER `find_table_col()` (currently line 111), BEFORE `preferred_revenue_col()`:

```python


# ─── Review-domain helpers (added 2026-04-24, Slice 4 D-1 POC) ───

def find_review_store_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding the reviewed store identity, or None.

    Searches 具体门店 → 评价门店 → 门店名称 → 店铺名称 → 分店 → 门市.
    Distinct from find_store_col() which is POS-domain (transaction store).
    """
    return _first_present(cols, _REVIEW_STORE_CANDIDATES)


def find_star_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding overall star rating (1-5 scale), or None.

    Priority: 星级分 (qualified) → 评分 (synonym) → 星级 (bare).
    """
    return _first_present(cols, _STAR_CANDIDATES)


def find_taste_score_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding 口味 rating score, or None.

    Deliberately does NOT match bare 口味 — that overlaps with 口味标签
    (csv tag list); we want the rating score column only.
    """
    return _first_present(cols, _TASTE_SCORE_CANDIDATES)


def find_env_score_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding 环境 rating score, or None."""
    return _first_present(cols, _ENV_SCORE_CANDIDATES)


def find_service_score_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding 服务 rating score, or None.

    `_score` suffix disambiguates from POS 服务费 (service charge measure).
    """
    return _first_present(cols, _SERVICE_SCORE_CANDIDATES)


def find_review_time_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding review/comment timestamp, or None.

    Distinct from find_date_col() which is POS business-date semantics.
    """
    return _first_present(cols, _REVIEW_TIME_CANDIDATES)


def find_review_content_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding review free-text content, or None."""
    return _first_present(cols, _REVIEW_CONTENT_CANDIDATES)


def find_vip_flag_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding VIP boolean flag, or None.

    Boolean-flag column only — does NOT match 会员卡 (measure col on POS).
    """
    return _first_present(cols, _VIP_FLAG_CANDIDATES)


def find_complaint_status_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding complaint status, or None.

    Strict literal — only 投诉状态. Does NOT match 投诉时间 / 投诉内容 /
    投诉标题 which are different complaint columns.
    """
    return _first_present(cols, _COMPLAINT_STATUS_CANDIDATES)


def find_review_platform_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding review platform/source, or None."""
    return _first_present(cols, _REVIEW_PLATFORM_CANDIDATES)


def find_dish_tag_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding csv-comma-separated dish tags, or None.

    Strict literal — only 菜品标签. Does NOT match 口味标签 / 服务标签.
    """
    return _first_present(cols, _DISH_TAG_CANDIDATES)


def find_complaint_title_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding complaint title text, or None."""
    return _first_present(cols, _COMPLAINT_TITLE_CANDIDATES)
```

- [ ] **Step 3: Run all unit tests, verify all pass**

```bash
cd backend/python
python -m pytest smartbi/services/materialized_analytics/tests/test_schema_helpers_review.py -v
```

Expected: all 25-30 tests PASS. If any fail, FIX schema_helpers.py — do NOT edit tests to match.

- [ ] **Step 4: Run full smartbi test suite — verify no regression on existing 17 templates that use schema_helpers**

```bash
cd backend/python
python -m pytest smartbi/services/materialized_analytics/ -x --tb=short 2>&1 | tail -50
```

Expected: prior pass count maintained (existing tests should not be affected since we only ADDED helpers, didn't modify `_first_present` or existing helpers).

- [ ] **Step 5: Commit**

```bash
git status --short  # verify only schema_helpers.py + test_schema_helpers_review.py staged
git add backend/python/smartbi/services/materialized_analytics/restaurant/schema_helpers.py
git add backend/python/smartbi/services/materialized_analytics/tests/test_schema_helpers_review.py
git status --short --cached  # final verify
git commit -m "$(cat <<'EOF'
feat(smartbi): add 12 review-domain helpers to schema_helpers (Slice 4 D-1)

Review-domain field detection extended:
- _REVIEW_STORE / _STAR / _TASTE_SCORE / _ENV_SCORE / _SERVICE_SCORE candidates
- _REVIEW_TIME / _REVIEW_CONTENT / _VIP_FLAG / _COMPLAINT_STATUS / _REVIEW_PLATFORM
- _DISH_TAG / _COMPLAINT_TITLE candidates
- 12 find_*_col() wrappers via existing _first_present pattern

Excludes by design (verified by unit tests):
- bare 口味 from TASTE_SCORE (overlaps 口味标签 csv list)
- 会员 from VIP_FLAG (overlaps 会员卡 POS measure)
- only 投诉状态 (not 投诉时间/标题/内容)
- only 菜品标签 (not 口味标签/服务标签)

25-30 unit tests, all green. Existing template tests unaffected.
Spec: docs/superpowers/specs/2026-04-24-review-field-detection-poc-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Migrate reviews_sentiment_summary.py to use schema_helpers

**Files:**
- Modify: `backend/python/smartbi/services/materialized_analytics/templates/reviews_sentiment_summary.py:1-100, 234`

- [ ] **Step 1: Replace local imports/constants/helper with schema_helpers import**

Edit `templates/reviews_sentiment_summary.py`:

a) **Add import after line 27** (after `from .registry import register`):

```python
from ..restaurant import schema_helpers
```

b) **Delete lines 30-43** (all 12 `_XXX_CANDIDATES` tuples):

```python
# DELETE these lines:
_STAR_CANDIDATES = ("星级分", "评分", "星级")
_TASTE_CANDIDATES = ("口味分", "口味")
_ENV_CANDIDATES = ("环境分", "环境")
_SERVICE_CANDIDATES = ("服务分", "服务")
_STORE_CANDIDATES = ("具体门店", "评价门店", "门店名称", "店铺名称")
_REVIEW_TIME_CANDIDATES = ("评价时间", "评论时间")
_CONTENT_CANDIDATES = ("评价详情", "评价内容")
_VIP_CANDIDATES = ("是否vip", "是否VIP", "VIP")
_COMPLAINT_CANDIDATES = ("投诉状态", "投诉")
_PLATFORM_CANDIDATES = ("平台", "评价来源")
_DISH_TAG_CANDIDATES = ("菜品标签",)
_COMPLAINT_TITLE_CANDIDATES = ("投诉标题", "投诉")
```

c) **Delete `_first()` definition at lines 48-53:**

```python
# DELETE:
def _first(cols, candidates):
    col_set = set(cols)
    for c in candidates:
        if c in col_set:
            return c
    return None
```

(Keep `_TOP_N = 10` at line 45 — that's a different constant.)

- [ ] **Step 2: Replace 11 `_first()` call sites with schema_helpers calls**

Replace EACH call site as listed (line numbers from current file):

| Line | Old | New |
|---|---|---|
| 84 | `_first(names, _STAR_CANDIDATES) is not None` | `schema_helpers.find_star_col(names) is not None` |
| 90 | `_first(cols, _STAR_CANDIDATES)` | `schema_helpers.find_star_col(cols)` |
| 91 | `_first(cols, _TASTE_CANDIDATES)` | `schema_helpers.find_taste_score_col(cols)` |
| 92 | `_first(cols, _ENV_CANDIDATES)` | `schema_helpers.find_env_score_col(cols)` |
| 93 | `_first(cols, _SERVICE_CANDIDATES)` | `schema_helpers.find_service_score_col(cols)` |
| 94 | `_first(cols, _STORE_CANDIDATES)` | `schema_helpers.find_review_store_col(cols)` |
| 95 | `_first(cols, _REVIEW_TIME_CANDIDATES)` | `schema_helpers.find_review_time_col(cols)` |
| 96 | `_first(cols, _VIP_CANDIDATES)` | `schema_helpers.find_vip_flag_col(cols)` |
| 97 | `_first(cols, _COMPLAINT_CANDIDATES)` | `schema_helpers.find_complaint_status_col(cols)` |
| 98 | `_first(cols, _PLATFORM_CANDIDATES)` | `schema_helpers.find_review_platform_col(cols)` |
| 234 | `_first(cols, _DISH_TAG_CANDIDATES)` | `schema_helpers.find_dish_tag_col(cols)` |

After all 11 replacements, file should:
- Have new `from ..restaurant import schema_helpers` import (line ~28)
- Have NO `_XXX_CANDIDATES` constants (deleted)
- Have NO local `_first()` (deleted)
- Have 11 `schema_helpers.find_*_col(...)` calls

- [ ] **Step 3: Run existing live test — verify byte-match KPIs on real qhj xlsx**

The existing `test_reviews_sentiment_live.py` at line 18 already tests `ReviewsSentimentSummary.compute()` against the real qhj Q3 xlsx. This is a regression check.

```bash
cd backend/python
python -m pytest smartbi/services/materialized_analytics/templates/test_reviews_sentiment_live.py -v
```

Expected: existing 6 tests still PASS with same KPIs (12,903 reviews / 4.83 avg star / 17 quality-eligible / 9 black pearl candidates).

If any test FAILS or KPIs differ → revert template changes, debug schema_helpers, do NOT proceed.

- [ ] **Step 4: Run full smartbi test suite — verify no broader regression**

```bash
cd backend/python
python -m pytest smartbi/services/materialized_analytics/ -x --tb=short 2>&1 | tail -30
```

Expected: same pass count as Task 2 Step 4.

- [ ] **Step 5: Commit**

```bash
git status --short
git add backend/python/smartbi/services/materialized_analytics/templates/reviews_sentiment_summary.py
git status --short --cached
git commit -m "$(cat <<'EOF'
refactor(smartbi): migrate reviews_sentiment_summary to schema_helpers (Slice 4 D-1)

Removed local _XXX_CANDIDATES (12 tuples) + local _first() helper.
All 11 call sites now route through restaurant/schema_helpers.find_*_col.

Multi-merchant column names (大众点评 / 美团 / 抖音) now resolve via
the centralized candidate registry — to support a new vendor, edit
schema_helpers.py only, no template changes.

Existing test_reviews_sentiment_live.py still green: byte-identical
KPIs (12,903/4.83/17/9) on qhj Q3 fixture.

Spec: docs/superpowers/specs/2026-04-24-review-field-detection-poc-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Generate synthetic test fixtures (美团-renamed + negative)

**Files:**
- Create: `backend/python/smartbi/services/materialized_analytics/tests/fixtures/generate_review_fixtures.py`
- Create: `backend/python/smartbi/services/materialized_analytics/tests/fixtures/qhj_3975_meituan_renamed.xlsx` (binary, generated)
- Create: `backend/python/smartbi/services/materialized_analytics/tests/fixtures/qhj_3975_no_review_cols.xlsx` (binary, generated)

- [ ] **Step 1: Write the fixture generator script**

```python
"""generate_review_fixtures.py — regenerate synthetic test xlsx fixtures.

Usage:
    cd backend/python/smartbi/services/materialized_analytics/tests/fixtures
    python generate_review_fixtures.py

Reads qhj Q3 review xlsx (12,904 rows, 30 cols) and produces:
  1. qhj_3975_meituan_renamed.xlsx — same data, columns renamed to 美团 style
     for verifying multi-merchant column detection works.
  2. qhj_3975_no_review_cols.xlsx — first 100 rows, ONLY non-review columns
     (no 星级 / 口味分 / etc.) for verifying applies() returns False.

Both fixtures committed to git as part of Slice 4 POC test infrastructure.
"""
from __future__ import annotations

import os
import sys

import pandas as pd


_HERE = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.abspath(os.path.join(_HERE, "..", "..", "..", "..", "..", "..", ".."))
SOURCE_XLSX = os.path.join(
    _PROJECT_ROOT,
    "smartbi维度分析", "大众点评", "真实餐饮连锁数据", "青花椒",
    "评价下载2025.07.01-2025.09.30_1328220_1773721054386.xlsx",
)

MEITUAN_RENAMED_OUT = os.path.join(_HERE, "qhj_3975_meituan_renamed.xlsx")
NO_REVIEW_COLS_OUT = os.path.join(_HERE, "qhj_3975_no_review_cols.xlsx")


# Column rename map (qhj 大众点评 → 美团-style variants).
# Picks variants that are listed in schema_helpers candidate tuples so the
# helpers should still detect them, just via a different priority slot.
MEITUAN_RENAME = {
    "具体门店": "分店",          # _REVIEW_STORE_CANDIDATES priority-5
    "星级":     "评分",          # _STAR_CANDIDATES priority-2
    "口味分":   "口味分",        # unchanged (单 candidate)
    "环境分":   "环境分",        # unchanged
    "服务分":   "服务分",        # unchanged
    "评价时间": "评论时间",      # _REVIEW_TIME_CANDIDATES priority-2
    "平台":     "渠道",          # _REVIEW_PLATFORM_CANDIDATES priority-3
    "是否vip":  "是否vip",      # unchanged (lowercase preserved)
    "投诉状态": "投诉状态",      # unchanged
    "菜品标签": "菜品标签",      # unchanged
}


def main():
    if not os.path.exists(SOURCE_XLSX):
        print(f"ERROR: source xlsx not found at {SOURCE_XLSX}", file=sys.stderr)
        sys.exit(1)

    print(f"Reading source xlsx ({os.path.getsize(SOURCE_XLSX) / 1024 / 1024:.1f} MB)...")
    df = pd.read_excel(SOURCE_XLSX, engine="openpyxl")
    print(f"  loaded {len(df):,} rows × {len(df.columns)} cols")

    # Fixture 1: 美团-renamed (full data)
    print("Generating qhj_3975_meituan_renamed.xlsx...")
    renamed_df = df.rename(columns=MEITUAN_RENAME)
    renamed_df.to_excel(MEITUAN_RENAMED_OUT, index=False, engine="openpyxl")
    print(f"  wrote {os.path.getsize(MEITUAN_RENAMED_OUT) / 1024 / 1024:.1f} MB to {MEITUAN_RENAMED_OUT}")

    # Fixture 2: no review cols (first 100 rows, dropped any rating/review column)
    print("Generating qhj_3975_no_review_cols.xlsx...")
    drop_cols = [
        c for c in df.columns
        if any(kw in c for kw in ("星级", "评分", "口味", "环境", "服务",
                                   "评价", "评论", "投诉", "菜品标签",
                                   "VIP", "vip", "门店", "店铺", "分店", "门市"))
    ]
    print(f"  dropping {len(drop_cols)} review-related cols: {drop_cols}")
    no_review_df = df.head(100).drop(columns=drop_cols)
    print(f"  result: {len(no_review_df)} rows × {len(no_review_df.columns)} cols (kept: {list(no_review_df.columns)})")
    no_review_df.to_excel(NO_REVIEW_COLS_OUT, index=False, engine="openpyxl")
    print(f"  wrote {os.path.getsize(NO_REVIEW_COLS_OUT) / 1024:.1f} KB to {NO_REVIEW_COLS_OUT}")

    print("Done.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the generator from Windows shell**

```bash
cd backend/python/smartbi/services/materialized_analytics/tests/fixtures
python generate_review_fixtures.py
```

Expected output:
```
Reading source xlsx (4.0 MB)...
  loaded 12,904 rows × 30 cols
Generating qhj_3975_meituan_renamed.xlsx...
  wrote ~4.0 MB to ...qhj_3975_meituan_renamed.xlsx
Generating qhj_3975_no_review_cols.xlsx...
  dropping ~14 review-related cols
  result: 100 rows × ~16 cols
  wrote ~30 KB to ...qhj_3975_no_review_cols.xlsx
Done.
```

If the source path doesn't exist on this dev machine, copy from the project root or skip — fixtures can be regenerated on a machine that has access to the qhj sample.

- [ ] **Step 3: Verify fixture columns are as expected**

```bash
cd backend/python
python -c "
import pandas as pd
df1 = pd.read_excel('smartbi/services/materialized_analytics/tests/fixtures/qhj_3975_meituan_renamed.xlsx', engine='openpyxl', nrows=1)
print('美团 fixture cols:', list(df1.columns))
print('  has 分店?', '分店' in df1.columns)
print('  has 评分?', '评分' in df1.columns)
print('  has 评论时间?', '评论时间' in df1.columns)
print('  has 具体门店 (orig)?', '具体门店' in df1.columns)  # should be False

df2 = pd.read_excel('smartbi/services/materialized_analytics/tests/fixtures/qhj_3975_no_review_cols.xlsx', engine='openpyxl', nrows=1)
print('Negative fixture cols:', list(df2.columns))
print('  has 星级?', '星级' in df2.columns)  # should be False
print('  has 评分?', '评分' in df2.columns)  # should be False
"
```

Expected:
- 美团 fixture has `分店`, `评分`, `评论时间` (renamed) — original `具体门店` absent
- Negative fixture has only non-review cols (评价ID / 省份 / 城市 / 团购ID / 用户昵称 / 用户等级 / 回复状态 / 最新回复内容 / 复楼内容 etc., no rating/review semantic cols)

- [ ] **Step 4: Commit fixtures + script**

```bash
git status --short backend/python/smartbi/services/materialized_analytics/tests/fixtures/
git add backend/python/smartbi/services/materialized_analytics/tests/fixtures/generate_review_fixtures.py
git add backend/python/smartbi/services/materialized_analytics/tests/fixtures/qhj_3975_meituan_renamed.xlsx
git add backend/python/smartbi/services/materialized_analytics/tests/fixtures/qhj_3975_no_review_cols.xlsx
git status --short --cached
git commit -m "$(cat <<'EOF'
test(smartbi): add multi-merchant + negative review xlsx fixtures (Slice 4 D-1)

Two synthetic fixtures generated from qhj Q3 review xlsx (upload 3975 source):

1. qhj_3975_meituan_renamed.xlsx (~4MB, 12,904 rows)
   Columns renamed: 具体门店→分店, 星级→评分, 评价时间→评论时间, 平台→渠道.
   Verifies schema_helpers.find_*_col detect via priority-2/3/5 candidates.

2. qhj_3975_no_review_cols.xlsx (~30KB, 100 rows)
   All review-semantic columns dropped. Verifies applies() returns False.

Generator script committed for reproducibility.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: End-to-end re-materialize test on test env (existing upload 3975 byte-match)

**Files:** No code changes — evidence-gathering task.

- [ ] **Step 1: Capture baseline KPI from test DB BEFORE deploy**

```bash
ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_db -tAc \"
SELECT kpi_values::text
FROM smart_bi_pg_analysis_results
WHERE upload_id=3975 AND template_code='reviews_sentiment_summary';
\"" > /tmp/evidence_pre.json
cat /tmp/evidence_pre.json
```

Expected: `{"评价总数":12903, "平均星级":4.83, "投诉率":0.18, "最低评分门店":"青花椒·外卖卫星店（虹口店）", "最低评分门店星级":3.56, "最常提及菜品":"味道好", "最常提及菜品次数":1874, "好评榜达标门店数":17, "必吃榜候选门店数":17, "黑珍珠候选门店数":9}` (or similar — record actual JSON for diff later)

- [ ] **Step 2: Deploy Python to test env**

```bash
./scripts/deploy/deploy-smartbi-python.sh --env test
```

Expected: rsync sync, dependencies check, restart-test.sh runs, Python 8084 listening:
```
ssh root@47.100.235.168 "ss -tln | grep 8084"
# LISTEN 0 2048 0.0.0.0:8084
```

- [ ] **Step 3: Trigger materialize on upload 3975**

```bash
ssh root@47.100.235.168 "
TOKEN=\$(curl -s -X POST http://localhost:10011/api/mobile/auth/unified-login \
  -H 'Content-Type: application/json' \
  -d '{\"username\":\"qhj_prod\",\"password\":\"123456\",\"deviceInfo\":{\"deviceId\":\"diag\",\"platform\":\"web\"}}' \
  | jq -r .data.accessToken)
curl -s -o /tmp/mat_3975.json -w 'HTTP=%{http_code} time=%{time_total}s\n' \
  -X POST http://localhost:8084/api/smartbi/analytics/materialize/3975 \
  -H \"Authorization: Bearer \$TOKEN\"
cat /tmp/mat_3975.json | head -c 400
"
```

Expected: HTTP 200 + JSON response with `templates_written` count >= 8 (including reviews_sentiment_summary).

If the materialize endpoint path is different, locate it via:
```bash
ssh root@47.100.235.168 "grep -r 'materialize' /www/wwwroot/cretas/code/backend/python/smartbi/api/ -l | head -5"
```

- [ ] **Step 4: Capture post-deploy KPI, diff with baseline**

```bash
ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_db -tAc \"
SELECT kpi_values::text
FROM smart_bi_pg_analysis_results
WHERE upload_id=3975 AND template_code='reviews_sentiment_summary';
\"" > /tmp/evidence_post.json

diff /tmp/evidence_pre.json /tmp/evidence_post.json
```

Expected: ZERO lines of diff (byte-identical).

If diff is non-empty: STOP. Either (a) helper is returning different col, or (b) test was run against a different DB. Investigate before continuing. Per qa-prompt Rule 11, byte-mismatch on read-after-write = silent regression bug.

---

## Task 6: 美团 synthetic xlsx end-to-end test

**Files:** No code changes — evidence-gathering on the new fixture.

- [ ] **Step 1: Upload 美团-renamed xlsx via test API**

The Python service has an `/excel/upload` endpoint (via Java). For test env, easier: directly upload via the existing Vue smart-bi page on test domain (139:8097) OR scp the xlsx to server and use a Python helper script.

Direct upload approach (server-side):
```bash
scp backend/python/smartbi/services/materialized_analytics/tests/fixtures/qhj_3975_meituan_renamed.xlsx root@47.100.235.168:/tmp/

ssh root@47.100.235.168 "
TOKEN=\$(curl -s -X POST http://localhost:10011/api/mobile/auth/unified-login \
  -H 'Content-Type: application/json' \
  -d '{\"username\":\"qhj_prod\",\"password\":\"123456\",\"deviceInfo\":{\"deviceId\":\"diag\",\"platform\":\"web\"}}' \
  | jq -r .data.accessToken)
# Java upload endpoint: /api/mobile/F001/smartbi/excel-uploads
curl -s -o /tmp/upload.json -w 'HTTP=%{http_code}\n' \
  -X POST http://localhost:10011/api/mobile/F001/smartbi/excel-uploads \
  -H \"Authorization: Bearer \$TOKEN\" \
  -F 'file=@/tmp/qhj_3975_meituan_renamed.xlsx'
cat /tmp/upload.json | head -c 500
"
```

Expected: HTTP 200 + JSON with new `id` field (e.g., 3995). Record this as `NEW_UPLOAD_ID` for next steps.

If endpoint path differs, find it:
```bash
grep -r "excel-uploads" backend/java/cretas-api/src/main/java/com/cretas/aims/controller/ -l
```

- [ ] **Step 2: Wait for Python excel_async to parse + write field defs**

Python parses async after Java accepts upload. Wait ~10s, then verify field_definitions populated:

```bash
ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_db -tAc \"
SELECT array_agg(original_name ORDER BY display_order)
FROM smart_bi_pg_field_definitions
WHERE upload_id=NEW_UPLOAD_ID;
\""
```

(Replace `NEW_UPLOAD_ID` with value from Step 1.)

Expected: array containing 分店, 评分, 评论时间, 渠道 etc. — the renamed cols.

- [ ] **Step 3: Trigger materialize on the new upload**

```bash
ssh root@47.100.235.168 "
TOKEN=\$(curl -s -X POST http://localhost:10011/api/mobile/auth/unified-login \
  -H 'Content-Type: application/json' \
  -d '{\"username\":\"qhj_prod\",\"password\":\"123456\",\"deviceInfo\":{\"deviceId\":\"diag\",\"platform\":\"web\"}}' \
  | jq -r .data.accessToken)
curl -s -o /tmp/mat_meituan.json -w 'HTTP=%{http_code} time=%{time_total}s\n' \
  -X POST http://localhost:8084/api/smartbi/analytics/materialize/NEW_UPLOAD_ID \
  -H \"Authorization: Bearer \$TOKEN\"
cat /tmp/mat_meituan.json | head -c 400
"
```

Expected: HTTP 200, reviews_sentiment_summary in `templates_written`.

- [ ] **Step 4: Verify KPIs match upload 3975 (multi-merchant equivalence proof)**

```bash
ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_db -tAc \"
SELECT kpi_values::text
FROM smart_bi_pg_analysis_results
WHERE upload_id=NEW_UPLOAD_ID AND template_code='reviews_sentiment_summary';
\"" > /tmp/evidence_meituan.json

diff /tmp/evidence_post.json /tmp/evidence_meituan.json
```

Expected: ZERO lines of diff. Same KPIs proves multi-merchant column names produce same business answer (12,903 reviews / 4.83 avg star / 17 quality / 9 黑珍珠).

If diff is non-empty: investigate which helper returned different col. Likely candidates:
- `find_review_store_col(["分店"])` should return `"分店"` (priority-5) → if returns None, candidates tuple wrong
- `find_star_col(["评分"])` should return `"评分"` (priority-2) → if None, candidates tuple wrong

---

## Task 7: Negative xlsx test (applies() should return False)

**Files:** No code changes — evidence-gathering.

- [ ] **Step 1: Upload negative xlsx**

```bash
scp backend/python/smartbi/services/materialized_analytics/tests/fixtures/qhj_3975_no_review_cols.xlsx root@47.100.235.168:/tmp/

ssh root@47.100.235.168 "
TOKEN=\$(curl -s -X POST http://localhost:10011/api/mobile/auth/unified-login \
  -H 'Content-Type: application/json' \
  -d '{\"username\":\"qhj_prod\",\"password\":\"123456\",\"deviceInfo\":{\"deviceId\":\"diag\",\"platform\":\"web\"}}' \
  | jq -r .data.accessToken)
curl -s -o /tmp/upload_neg.json -w 'HTTP=%{http_code}\n' \
  -X POST http://localhost:10011/api/mobile/F001/smartbi/excel-uploads \
  -H \"Authorization: Bearer \$TOKEN\" \
  -F 'file=@/tmp/qhj_3975_no_review_cols.xlsx'
cat /tmp/upload_neg.json | head -c 400
"
```

Record new upload_id as `NEG_UPLOAD_ID`.

- [ ] **Step 2: Trigger materialize**

```bash
ssh root@47.100.235.168 "
TOKEN=\$(curl -s -X POST http://localhost:10011/api/mobile/auth/unified-login \
  -H 'Content-Type: application/json' \
  -d '{\"username\":\"qhj_prod\",\"password\":\"123456\",\"deviceInfo\":{\"deviceId\":\"diag\",\"platform\":\"web\"}}' \
  | jq -r .data.accessToken)
curl -s -o /tmp/mat_neg.json -w 'HTTP=%{http_code}\n' \
  -X POST http://localhost:8084/api/smartbi/analytics/materialize/NEG_UPLOAD_ID \
  -H \"Authorization: Bearer \$TOKEN\"
cat /tmp/mat_neg.json | head -c 400
"
```

- [ ] **Step 3: Verify reviews_sentiment_summary is NOT in cache for negative upload**

```bash
ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_db -tAc \"
SELECT template_code
FROM smart_bi_pg_analysis_results
WHERE upload_id=NEG_UPLOAD_ID
ORDER BY template_code;
\""
```

Expected: list of templates that DID materialize (e.g. category_distribution if non-review cols are dimensions, monthly_trend if a date col exists). **MUST NOT** include `reviews_sentiment_summary` — its `applies()` returned False because no rating col present.

- [ ] **Step 4: Verify Python log shows applies=False decision**

```bash
ssh root@47.100.235.168 "grep 'reviews_sentiment_summary' /www/wwwroot/cretas/python-test.log | tail -5"
```

Expected: log line confirming `reviews_sentiment_summary applies=False on upload NEG_UPLOAD_ID, skip_reason='no 星级 column'` (or similar — exact wording per template's skip_reason).

---

## Task 8: Existing prod smoke regression (94-test matrix)

**Files:** No code changes — regression check.

- [ ] **Step 1: Run p2-guardrail-full.mjs against test env**

```bash
TARGET_URL=http://localhost:8084 node tests/e2e-comprehensive/p2-guardrail-full.mjs
```

If the script targets a domain (not localhost), use SSH tunnel or test domain:
```bash
TARGET_URL=http://139.196.165.140:8097 node tests/e2e-comprehensive/p2-guardrail-full.mjs
```

(Per memory: test web-admin at 139:8097.)

- [ ] **Step 2: Verify ≥93/94 pass rate (no regression vs current baseline)**

Expected: ≥93/94 pass (current baseline is 93/94). The 1 known-fail is `客户评价怎么样` on upload 4169 which has no review xlsx in prod (LLM fallback expected, not a regression).

If pass rate drops to <93: investigate failing tests, identify whether new helpers caused unexpected applies()/template behavior on other queries.

---

## Task 9: superpowers code-reviewer audit on actual implementation

**Files:** No code — audit task per qa-prompt Rule 15.

- [ ] **Step 1: Dispatch superpowers:code-reviewer agent**

Use the Agent tool to dispatch superpowers:code-reviewer with this prompt:

```
Independent post-implementation review for Slice 4 D-1 POC at C:\Users\Steve\my-prototype-logistics, branch e2e/v1-framework.

Review commits since 9b906e3bd (the spec). Should be 3-4 commits:
- "feat(smartbi): add 12 review-domain helpers to schema_helpers"
- "refactor(smartbi): migrate reviews_sentiment_summary to schema_helpers"
- "test(smartbi): add multi-merchant + negative review xlsx fixtures"

Spec: docs/superpowers/specs/2026-04-24-review-field-detection-poc-design.md

Review focus:
1. Did the implementation match the spec? Surface any drift.
2. Are the 12 helpers correctly using _first_present (matches existing pattern at restaurant/schema_helpers.py:52)?
3. Does the migration of reviews_sentiment_summary.py preserve all semantic behavior? Walk each call site replacement.
4. Are the test cases sufficient? Per qa-prompt v2.4 Rule 1 (smoke vs deep), Rule 11 (read-after-write).
5. Any new patterns we should sweep through other 2 templates with local _first (kitchen_dispatch_heatmap, period_comparison_trend)?
6. Backward compat audit: does the migration risk breaking any existing materialized result?

Output: P0/P1/P2 findings with file:line refs.
```

- [ ] **Step 2: Address any P0 findings**

If reviewer surfaces P0: STOP, fix, re-test, re-commit, re-run reviewer.

If only P1/P2 surfaced: record in §11 Future backlog of spec, proceed to deploy.

If 0 findings: proceed.

---

## Task 10: Deploy to test env final smoke + verify all 5 evidence files green

**Files:** No code — final test gate before prod.

- [ ] **Step 1: Confirm test env still healthy after all materialize calls**

```bash
ssh root@47.100.235.168 "
ss -tln | grep -E ':10011|:8084'
curl -s http://localhost:8084/health
curl -s http://localhost:10011/api/mobile/health
"
```

Expected: both ports listening + health endpoints return 200.

- [ ] **Step 2: Verify all 5 success criteria from spec §10 met**

Check off:
- [ ] Unit tests §5.1: 25-30/25-30 PASS (Task 2 Step 3)
- [ ] §5.2 re-materialize 3975 byte-match diff = 0 lines (Task 5 Step 4)
- [ ] §5.3 美团 synthetic xlsx KPIs match 3975 (Task 6 Step 4)
- [ ] §5.4 negative xlsx applies=False (Task 7 Step 3)
- [ ] Existing 94-test smoke ≥93/94 (Task 8 Step 2)
- [ ] Reviewer 0 P0 findings (Task 9 Step 2)

If any not met: STOP, do not deploy prod. Debug per systematic-debugging.

---

## Task 11: USER GATE — deploy to prod (waits for explicit user OK)

**Files:** No code — deploy + smoke verify.

- [ ] **Step 1: Pause and ask user**

Print: "All test env criteria green. Ready to deploy prod? Production change: review xlsx materialize will use new schema_helpers code path. Existing prod has zero review uploads (qhj_prod has only POS uploads), so risk surface is post-deploy customer uploads. Reply '部 prod' to proceed."

WAIT for explicit user confirmation. Do NOT deploy without it.

- [ ] **Step 2: Deploy Python to prod (only after user said 部 prod)**

```bash
./scripts/deploy/deploy-smartbi-python.sh --env prod
```

- [ ] **Step 3: Verify prod systemd healthy**

```bash
ssh root@47.100.235.168 "
systemctl status cretas-python --no-pager | grep -E 'Active|Main PID'
ss -tln | grep ':8083'
curl -s http://localhost:8083/health
"
```

Expected: Active (running), port 8083 listening, health 200.

- [ ] **Step 4: Smoke verify prod — confirm reviews query still works on existing prod cache (upload 4169 still LLM-fallback as before)**

```bash
TARGET_URL=https://admin.cretaceousfuture.com node tests/e2e-comprehensive/p2-guardrail-full.mjs
```

Expected: ≥93/94 pass (same as test env baseline).

If prod smoke drops below 93/94: rollback per spec §6.3. Investigate before any further work.

```bash
# Rollback if needed:
git revert HEAD~3..HEAD --no-edit  # revert 3 implementation commits
git push origin e2e/v1-framework
./scripts/deploy/deploy-smartbi-python.sh --env prod
```

---

## Task 12: Update memory + handoff

**Files:**
- Create: `C:\Users\Steve\.claude\projects\C--Users-Steve-my-prototype-logistics\memory\project_apr24_slice4_review_helpers_shipped.md`
- Modify: `C:\Users\Steve\.claude\projects\C--Users-Steve-my-prototype-logistics\memory\MEMORY.md` (add 1 entry near top)

- [ ] **Step 1: Write project memory file documenting what shipped**

```markdown
---
name: Apr 24 2026 — Slice 4 D-1 review field detection POC shipped
description: Migrated reviews_sentiment_summary.py to centralized schema_helpers helpers (+12 review-domain find_*_col funcs). Multi-merchant column names now resolve via candidate tuples in restaurant/schema_helpers.py — adding 美团/抖音/小红书 vendors only requires editing the candidate list. POC scope: 1 template, ~3-4h work, byte-identical KPIs verified on qhj 3975 + 美团-renamed synthetic xlsx.
type: project
---
# Slice 4 D-1 — Review field detection POC shipped (Apr 24 2026)

## Commits on `e2e/v1-framework`
- (insert SHAs from Tasks 2 / 3 / 4)

## What changed
- `restaurant/schema_helpers.py`: +90 lines (12 review-domain candidate tuples + 12 find_*_col helpers via existing _first_present pattern). Pattern matches the 8 POS-domain helpers already there.
- `templates/reviews_sentiment_summary.py`: -32 lines, +12 lines (deleted local _XXX_CANDIDATES + local _first, added schema_helpers import + 11 call site replacements).
- `tests/test_schema_helpers_review.py`: +180 lines (25-30 unit tests covering priority/exclusions/multi-vendor)
- `tests/fixtures/qhj_3975_meituan_renamed.xlsx` (~4MB) + `qhj_3975_no_review_cols.xlsx` (~30KB) + `generate_review_fixtures.py`

## Reviewer audit findings addressed
- 5 P0 from initial design audit drove pivot from regex to literal candidates (see spec §9)
- Post-impl reviewer (Task 9): N findings (record actual count + dispositions)

## What's NOT in this POC
- Lazy migrate `kitchen_dispatch_heatmap.py` + `period_comparison_trend.py` (only 2 other templates with local _first per grep)
- Adding 美团/抖音/小红书 actual candidate variants beyond the placeholders (just 分店/门市 for 美团; expand as customers upload)
- Slice 3 (cross-upload joint analysis) — separate spec/PR
- P2 turnover (翻台率) template — separate spec/PR

## Verification evidence
- Re-materialize upload 3975: byte-identical KPIs (12,903/4.83/17/9) pre vs post
- 美团-renamed xlsx (new upload XXX): same KPIs as 3975
- Negative xlsx (no rating col, upload YYY): reviews_sentiment_summary NOT in cache (applies()=False as expected)
- Existing 94-test smoke: 93/94 maintained, no regression

## Deployment
- Test 8084: shipped at (timestamp)
- Prod 8083: shipped at (timestamp) — explicit user approval received

## How to extend (when 美团/抖音 customer onboards)
1. Customer uploads their export, observe column names (e.g. `店铺` vs `门店`)
2. Edit `restaurant/schema_helpers.py` — append new variant to the relevant `_XXX_CANDIDATES` tuple
3. Re-materialize the customer's upload
4. Done. No template changes needed.
```

- [ ] **Step 2: Append entry to MEMORY.md index (top of file)**

Insert AFTER `# Project Memory` line, BEFORE the next existing section:

```markdown

## Apr 24 2026 (afternoon) — Slice 4 D-1 review field detection POC shipped
- [Slice 4 D-1 shipped](project_apr24_slice4_review_helpers_shipped.md) — 12 review-domain `find_*_col` helpers added to `restaurant/schema_helpers.py`, `reviews_sentiment_summary.py` migrated. Multi-merchant column names (美团/抖音 future) extend by editing candidate tuples; no template changes.
```

- [ ] **Step 3: Commit memory updates**

Memory dir is OUTSIDE the repo (it lives at `C:\Users\Steve\.claude\projects\...\memory`). No git commit needed there. The memory persists in the user's local Claude Code memory store automatically.

---

## Done checklist

After all 12 tasks complete:
- [ ] All commits pushed to `origin/e2e/v1-framework`
- [ ] Test env runs the new code, all 5 evidence files captured
- [ ] Prod deployed (after user explicit OK)
- [ ] Prod smoke ≥93/94
- [ ] Memory updated
- [ ] No outstanding P0 findings
- [ ] Spec backlog (§8) reviewed for follow-ups

If any item un-checked: that's the next thing to fix before declaring done.
