# Review Field Detection POC — Multi-merchant Abstraction (Slice 4 D-1)

**Date**: 2026-04-24
**Branch**: `e2e/v1-framework`
**Status**: Spec, awaiting user approval before plan
**Reviewer audit**: superpowers:code-reviewer 2026-04-24 (5 P0 + 5 P1 incorporated below)

---

## 1. Background & motivation

### 1.1 The problem

`backend/python/smartbi/services/materialized_analytics/templates/reviews_sentiment_summary.py` hardcodes 11 column-name candidate tuples (lines 30-43):

```python
_STAR_CANDIDATES = ("星级分", "评分", "星级")
_STORE_CANDIDATES = ("具体门店", "评价门店", "门店名称", "店铺名称")
_TASTE_CANDIDATES = ("口味分", "口味")
... (+8 more)
```

Each `compute()` and `applies()` call reaches for a local `_first(cols, candidates)` helper to find a present column. This means:

- **Multi-merchant blind spot**: 大众点评 exports use `具体门店`; 美团 exports may use `分店` or `门市` (handoff observation). Adding new vendors requires editing the local tuple in this template (and in the 2 other templates that inline `_first`).
- **No reuse**: 17 other templates already use `restaurant/schema_helpers.py` with the same literal-priority pattern but for POS-domain fields (`find_store_col`, `find_date_col` etc.). Review-domain fields have no parallel helper module — every review-aware template would re-roll the candidate list.

### 1.2 Why not regex (drop original D-1 design)

Original POC proposal was a new `field_patterns.py` with regex-based `find_by_pattern(cols, patterns)`. Independent reviewer audit found 5 P0 issues:

1. **Iteration order semantics break** — regex helper iterates `cols` (Excel-order driven), `_first()` iterates `candidates` (author-priority driven). On qhj 3975 the byte-match test passes accidentally because that xlsx lacks ambiguous column pairs; first multi-merchant xlsx with both `星级` and `评分` would silently pick a different field.
2. **Flat alternation collapses priority** — `r'.*(星级|评分|分数).*'` removes the `星级分 > 评分 > 星级` ordering encoded in `_STAR_CANDIDATES`.
3. **Over-match** — `r'.*口味.*分?$'` matches both `口味分` (rating, want) and `口味标签` (csv tag list, don't want); silent KPI loss when reordered.
4. **Over-match** — `r'.*(VIP|vip|会员).*'` catches `会员卡`, `非会员价`, `会员折扣`.
5. **Lookahead anchored at end only** — `^(?!.*(ID|编号|分类)$)` doesn't block `门店ID名称`.

Reviewer recommendation: **extend existing `restaurant/schema_helpers.py`** with literal-priority candidate tuples + `_first_present(cols, candidates)` (already shipped, in use by 17 templates). This eliminates all 5 P0s by avoiding regex entirely, while still solving multi-merchant via candidate enumeration (the actual variation point — knowing the vendor names — is data, not lookup mechanism).

### 1.3 Goal of this POC

Migrate `reviews_sentiment_summary.py` to use the established `schema_helpers` pattern. Establish naming + ordering conventions for review-domain helpers. Set the stage for remaining 2 templates with local `_first` (kitchen_dispatch_heatmap.py, period_comparison_trend.py) to lazy-migrate, and for adding 美团/抖音/小红书 candidate variants in the future without code structure churn.

---

## 2. Scope

### 2.1 In scope (single commit, ~3-4h)

- Extend `backend/python/smartbi/services/materialized_analytics/restaurant/schema_helpers.py`:
  - Add 12 candidate tuples for review-domain fields
  - Add 12 `find_*_col(cols)` helpers using existing `_first_present`
- Migrate `templates/reviews_sentiment_summary.py`:
  - Delete local `_XXX_CANDIDATES` (lines 30-43) and local `_first()` (lines 48-53)
  - Replace 11 call sites in `applies()` and `compute()` with `schema_helpers.find_*_col(cols)`
- Add unit tests `tests/test_schema_helpers_review.py` covering ambiguity, reorder, negative, multi-vendor scenarios
- Synthetic xlsx fixture `tests/fixtures/qhj_3975_meituan_renamed.xlsx` (cloned from real qhj Q3, columns renamed to 美团 style)
- Re-materialize upload 3975 post-deploy; assert byte-match KPIs

### 2.2 Out of scope

- Regex pattern matching (rejected per §1.2)
- Migrating other 34 templates (lazy-migrate backlog: only `kitchen_dispatch_heatmap.py` + `period_comparison_trend.py` have local `_first()` per grep; remaining 32 already use `schema_helpers` or hardcode literal column names)
- New review-only templates (turnover, reviews_external, single_store_detail — separate P2 backlog)
- Cross-upload joint analysis (Slice 3, separate)
- Cache invalidation API (deploy procedure manually re-materializes affected uploads — see §6.3)

---

## 3. Architecture

### 3.1 File layout

```
backend/python/smartbi/services/materialized_analytics/
├── restaurant/
│   └── schema_helpers.py          # ← EXTEND: +12 tuples, +12 helpers (~80 lines added)
├── templates/
│   └── reviews_sentiment_summary.py   # ← MIGRATE: -16 lines (delete local), +import line
└── tests/
    ├── test_schema_helpers_review.py  # ← NEW: ~120 lines unit tests
    └── fixtures/
        └── qhj_3975_meituan_renamed.xlsx  # ← NEW: synthetic test data (~4MB)
```

No new modules. No changes to `templates/base.py`, `materializer.py`, `persistence.py`, `chat.py`, or query router.

### 3.2 Helper naming convention

Pattern `find_<concept>_col(cols) -> Optional[str]`. Where review concepts overlap with existing POS concepts (store, time, platform), prefix with `review_` to disambiguate:

| Helper | Field semantic | POS overlap? |
|---|---|---|
| `find_review_store_col` | Store the customer reviewed | Yes — `find_store_col` is POS-domain |
| `find_star_col` | 5-star rating | No |
| `find_taste_score_col` | 口味分 rating | No (`taste` not POS concept) |
| `find_env_score_col` | 环境分 rating | No |
| `find_service_score_col` | 服务分 rating | Yes — could collide with 服务费 (POS service charge); `_score` suffix disambiguates |
| `find_review_time_col` | 评价时间 timestamp | Yes — POS uses `find_date_col` for business date; review timestamps are distinct |
| `find_review_content_col` | 评价详情 free text | No |
| `find_vip_flag_col` | 是否vip boolean | No (POS records VIP differently — via 会员卡 column) |
| `find_complaint_status_col` | 投诉状态 status | No |
| `find_review_platform_col` | 平台/渠道 categorical | Yes — POS may use `渠道` for sales channel |
| `find_dish_tag_col` | 菜品标签 csv tag list | No |
| `find_complaint_title_col` | 投诉标题 free text | No |

### 3.3 Candidate tuple ordering rule

Most specific first, fuzzy last (matches existing convention):

```python
_STAR_CANDIDATES = ("星级分", "评分", "星级")
#                   ↑ most specific (qualified)
#                              ↑ medium (synonym)
#                                     ↑ least specific (literal name only)
```

Rationale: when both `星级分` (qualified rating-with-suffix) and `星级` (bare) exist in the same xlsx, the qualified one is more likely to be the actual rating column (the bare one might be a category). Author intent encoded in tuple order.

---

## 4. Components

### 4.1 New candidate constants in `schema_helpers.py`

Inserted after `_TABLE_COL_CANDIDATES` (line 49), before `_first_present` (line 52). Add a section header:

```python
# ─── Review-domain candidates (大众点评 / 美团 / 抖音 / 小红书 export naming) ───

_REVIEW_STORE_CANDIDATES = (
    "具体门店",     # 大众点评 standard (qhj Q3/Q4)
    "评价门店",     # alternate
    "门店名称", "店铺名称",  # POS-style overlap (some merchants reuse)
    "分店", "门市",  # 美团 / regional variant (handoff observation)
)

_STAR_CANDIDATES = ("星级分", "评分", "星级")
_TASTE_SCORE_CANDIDATES = ("口味分",)   # NOT "口味" — that overlaps with 口味标签 (csv list)
_ENV_SCORE_CANDIDATES = ("环境分",)
_SERVICE_SCORE_CANDIDATES = ("服务分",)

_REVIEW_TIME_CANDIDATES = ("评价时间", "评论时间", "发表时间", "创建时间")
_REVIEW_CONTENT_CANDIDATES = ("评价详情", "评价内容", "评论详情", "评论内容")

_VIP_FLAG_CANDIDATES = ("是否vip", "是否VIP", "VIP")  # boolean flag, NOT "会员"
_COMPLAINT_STATUS_CANDIDATES = ("投诉状态",)  # only state, NOT 投诉时间/投诉内容
_REVIEW_PLATFORM_CANDIDATES = ("平台", "评价来源", "渠道", "来源")
_DISH_TAG_CANDIDATES = ("菜品标签",)
_COMPLAINT_TITLE_CANDIDATES = ("投诉标题",)
```

Note on what's deliberately excluded:
- `_TASTE_SCORE` excludes bare `"口味"` (qhj has both `口味分` and `口味标签`; bare `口味` would matchnow the wrong one if reordered)
- `_VIP_FLAG` excludes `"会员"` (matches `会员卡` measure column unrelated to VIP boolean)
- `_COMPLAINT_STATUS` only `"投诉状态"`, not just `"投诉"` (would match `投诉时间`, `投诉内容`, `投诉标题`)

### 4.2 New helper functions in `schema_helpers.py`

12 thin wrappers over `_first_present`. Inserted after `find_table_col` (line 111), before `preferred_revenue_col` (line 114). Pattern:

```python
def find_review_store_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding the reviewed store identity, or None.

    Searches 具体门店 → 评价门店 → 门店名称 → 店铺名称 → 分店 → 门市.
    Distinct from find_store_col() which is POS-domain (transaction store).
    """
    return _first_present(cols, _REVIEW_STORE_CANDIDATES)


def find_star_col(cols: Iterable[str]) -> Optional[str]:
    """Return the column holding overall star rating (1-5 scale), or None."""
    return _first_present(cols, _STAR_CANDIDATES)


# ... (10 more, all single-line wrappers + 2-line docstring)
```

### 4.3 Migration of `reviews_sentiment_summary.py`

**Delete** (lines 30-53):
```python
_STAR_CANDIDATES = ...
_TASTE_CANDIDATES = ...
_ENV_CANDIDATES = ...
_SERVICE_CANDIDATES = ...
_STORE_CANDIDATES = ...
_REVIEW_TIME_CANDIDATES = ...
_CONTENT_CANDIDATES = ...
_VIP_CANDIDATES = ...
_COMPLAINT_CANDIDATES = ...
_PLATFORM_CANDIDATES = ...
_DISH_TAG_CANDIDATES = ...
_COMPLAINT_TITLE_CANDIDATES = ...

def _first(cols, candidates):
    col_set = set(cols)
    for c in candidates:
        if c in col_set:
            return c
    return None
```

**Add import** (after existing imports):
```python
from ..restaurant import schema_helpers
```

**Replace 11 call sites** in `applies()` (line 84) and `compute()` (lines 90-98, 234, 268, 287):

| Old | New |
|---|---|
| `_first(names, _STAR_CANDIDATES)` | `schema_helpers.find_star_col(names)` |
| `_first(cols, _STAR_CANDIDATES)` | `schema_helpers.find_star_col(cols)` |
| `_first(cols, _TASTE_CANDIDATES)` | `schema_helpers.find_taste_score_col(cols)` |
| `_first(cols, _ENV_CANDIDATES)` | `schema_helpers.find_env_score_col(cols)` |
| `_first(cols, _SERVICE_CANDIDATES)` | `schema_helpers.find_service_score_col(cols)` |
| `_first(cols, _STORE_CANDIDATES)` | `schema_helpers.find_review_store_col(cols)` |
| `_first(cols, _REVIEW_TIME_CANDIDATES)` | `schema_helpers.find_review_time_col(cols)` |
| `_first(cols, _CONTENT_CANDIDATES)` | (only used? grep — currently NOT used in compute, but defined; safe to delete + add helper for future) |
| `_first(cols, _VIP_CANDIDATES)` | `schema_helpers.find_vip_flag_col(cols)` |
| `_first(cols, _COMPLAINT_CANDIDATES)` | `schema_helpers.find_complaint_status_col(cols)` |
| `_first(cols, _PLATFORM_CANDIDATES)` | `schema_helpers.find_review_platform_col(cols)` |
| `_first(cols, _DISH_TAG_CANDIDATES)` | `schema_helpers.find_dish_tag_col(cols)` |
| `_first(cols, _COMPLAINT_TITLE_CANDIDATES)` | (currently NOT used; same as content) |

Net file diff: ~-30 lines (delete 24 candidate lines + 6 helper lines, add 1 import line, replace 11 calls in place).

---

## 5. Test plan

### 5.1 Unit tests — `tests/test_schema_helpers_review.py`

Test depth: per qa-prompt v2.4 Rule 1, unit tests are **smoke** depth alone — must be paired with end-to-end materialize test (§5.2) for **deep** classification.

```python
import pytest
from backend.python.smartbi.services.materialized_analytics.restaurant import schema_helpers


class TestReviewStoreCol:
    def test_qhj_standard(self):
        cols = ["评价时间", "具体门店", "星级"]
        assert schema_helpers.find_review_store_col(cols) == "具体门店"

    def test_meituan_variant(self):
        cols = ["评价时间", "分店", "星级"]
        assert schema_helpers.find_review_store_col(cols) == "分店"

    def test_priority_specific_wins(self):
        # Both 具体门店 and 门店名称 present → priority-1 wins (qhj specific)
        cols = ["具体门店", "门店名称"]
        assert schema_helpers.find_review_store_col(cols) == "具体门店"

    def test_excludes_id_column(self):
        # 门店分类ID is in qhj 3975 — must NOT be returned as store col
        cols = ["门店分类ID", "评价时间"]
        assert schema_helpers.find_review_store_col(cols) is None  # no store col found

    def test_id_and_real_both_present(self):
        # 门店分类ID + 具体门店 → must return 具体门店
        cols = ["门店分类ID", "具体门店"]
        assert schema_helpers.find_review_store_col(cols) == "具体门店"

    def test_empty_cols(self):
        assert schema_helpers.find_review_store_col([]) is None


class TestStarCol:
    def test_qhj_uses_star(self):
        cols = ["星级", "口味分"]
        assert schema_helpers.find_star_col(cols) == "星级"

    def test_qualified_priority(self):
        # 星级分 > 评分 > 星级 priority
        cols = ["星级", "评分", "星级分"]
        assert schema_helpers.find_star_col(cols) == "星级分"

    def test_evaluation_score_variant(self):
        cols = ["评分", "口味"]
        assert schema_helpers.find_star_col(cols) == "评分"


class TestTasteScoreCol:
    def test_qhj_taste_score(self):
        cols = ["口味分", "口味标签"]
        assert schema_helpers.find_taste_score_col(cols) == "口味分"  # rating, not tag list

    def test_only_tag_present_returns_none(self):
        # 口味标签 alone → no rating col, return None (template won't compute taste KPI)
        cols = ["口味标签"]
        assert schema_helpers.find_taste_score_col(cols) is None

    def test_reorder_doesnt_affect(self):
        # Even if 口味标签 appears first in xlsx col order, helper still picks 口味分
        cols = ["口味标签", "口味分", "环境分"]
        assert schema_helpers.find_taste_score_col(cols) == "口味分"


class TestVipFlagCol:
    def test_qhj_vip_lowercase(self):
        cols = ["是否vip", "用户等级"]
        assert schema_helpers.find_vip_flag_col(cols) == "是否vip"

    def test_does_not_match_member_card(self):
        # 会员卡 is a measure column on POS xlsx — must NOT be picked as VIP flag
        cols = ["会员卡", "用户等级"]
        assert schema_helpers.find_vip_flag_col(cols) is None


class TestComplaintStatusCol:
    def test_only_status_not_time_or_title(self):
        # 投诉时间 / 投诉标题 / 投诉内容 all in qhj 3975 — must NOT be picked as status
        cols = ["投诉时间", "投诉标题", "投诉内容"]
        assert schema_helpers.find_complaint_status_col(cols) is None

    def test_status_present(self):
        cols = ["投诉时间", "投诉状态", "投诉标题"]
        assert schema_helpers.find_complaint_status_col(cols) == "投诉状态"
```

(+similar tests for env_score, service_score, review_time, review_content, review_platform, dish_tag, complaint_title)

Total: ~25-30 unit tests, ~150 lines. Target run time <1s.

### 5.2 End-to-end test — re-materialize upload 3975

**Depth: deep** (per qa-prompt Rule 1 + Rule 11 read-after-write).

**Step 1** (baseline): query current cached KPIs for upload 3975 BEFORE migration:
```bash
ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_db -tAc \
  \"SELECT kpi_values FROM smart_bi_pg_analysis_results
    WHERE upload_id=3975 AND template_code='reviews_sentiment_summary';\""
# Expected: {"评价总数":12903, "平均星级":4.83, "投诉率":0.18,
#            "最低评分门店":"青花椒·外卖卫星店（虹口店）",
#            "好评榜达标门店数":17, "黑珍珠候选门店数":9, ...}
# Save as evidence_pre.json
```

**Step 2** (migration deploy): `./scripts/deploy/deploy-smartbi-python.sh --env test`

**Step 3** (re-materialize):
```bash
ssh root@47.100.235.168 "
TOKEN=\$(curl -s -X POST http://localhost:10011/api/mobile/auth/unified-login \
  -H 'Content-Type: application/json' \
  -d '{\"username\":\"qhj_prod\",\"password\":\"123456\",\"deviceInfo\":{\"deviceId\":\"diag\",\"platform\":\"web\"}}' \
  | jq -r .data.accessToken)
curl -s -X POST http://localhost:8084/api/smartbi/analytics/materialize/3975 \
  -H \"Authorization: Bearer \$TOKEN\" -H 'Content-Type: application/json'
"
```

**Step 4** (read-after-write): query cached KPIs again, compare:
```bash
# Same SELECT as Step 1
# Save as evidence_post.json
diff evidence_pre.json evidence_post.json
# Expected: 0 lines (byte-identical)
```

**Acceptance**: zero diff. Any difference = silent regression, must fix before deploying prod.

### 5.3 Multi-merchant synthetic xlsx — `tests/fixtures/qhj_3975_meituan_renamed.xlsx`

**Construction**: clone `evaluation_download_2025.07.01-09.30.xlsx` (qhj Q3 review xlsx, 12,904 rows, ~4MB), rename columns:
- `具体门店` → `分店` (test 美团 store variant)
- `星级` → `评分` (test priority-2 over priority-3)
- `平台` → `渠道` (test review platform variant)
- `评价时间` → `评论时间` (test time variant)

Other 26 columns unchanged.

**Test flow**:
```bash
# Upload synthetic xlsx via FE or direct API
# Get new upload_id (e.g., 3990)
# Trigger materialize
# Verify reviews_sentiment_summary cache row written
# Compare KPIs — should be IDENTICAL to upload 3975 (12903/4.83/etc),
# proving multi-merchant column names produce same business answer
```

**Depth: deep** (real wire path + read-after-write byte-match).

### 5.4 Negative test (Rule 11 + Rule 9)

Synthetic xlsx with **only** `门店分类ID` and `评价ID` (no real store / star cols) → upload → trigger materialize → assert reviews_sentiment_summary row is **NOT** in cache (`applies()` should return False because `find_star_col(cols) is None`).

This guards against P1-5 regression risk: the migration must not broaden `applies()` semantics to make non-review uploads accidentally trigger this template.

### 5.5 Test depth summary

| Test | Depth (Rule 1) | Roundtrip (Rule 11) | Rule 9 抽检 |
|---|---|---|---|
| Unit tests §5.1 | smoke | N/A | N/A |
| §5.2 byte-match re-materialize 3975 | deep | ✓ pre/post diff | ✓ KPI 业务合理性 (12903 / 4.83 / 17 / 9 已知正确) |
| §5.3 multi-merchant synthetic | deep | ✓ new upload, fresh persist | ✓ KPI 与 3975 一致即业务合理 |
| §5.4 negative xlsx | deep | ✓ no row written = correct | N/A |

Per qa-prompt v2.4 起步动作 #6: error触发点 = §5.4 (no real store col), expected action = `applies()` return False, no materialize, no error toast (silent skip is correct backend behavior; Python log line `[materializer] reviews_sentiment_summary applies=False on upload N` confirms).

---

## 6. Migration & deploy plan

### 6.1 Single-commit deliverable

Per qa-prompt Rule 11 + concurrent-edit-safety Rule 5 (commit 前 git status 验干净):

1. Edit `restaurant/schema_helpers.py` (add 12 tuples + 12 helpers + section header)
2. Edit `templates/reviews_sentiment_summary.py` (delete locals + add import + replace 11 call sites)
3. Add `tests/test_schema_helpers_review.py`
4. Add `tests/fixtures/qhj_3975_meituan_renamed.xlsx` (binary, ~4MB — verify via git size before commit)
5. `git status --short` → verify only above 4 files staged
6. Commit message: `refactor(smartbi): migrate reviews_sentiment_summary to schema_helpers (Slice 4 D-1 POC)`

### 6.2 Deploy sequence

Per `.claude/rules/server-operations.md` 重大改动先 test 后 prod:

```bash
# 1. Deploy to test env
./scripts/deploy/deploy-smartbi-python.sh --env test

# 2. Run unit tests on test
ssh root@47.100.235.168 "cd /www/wwwroot/cretas/code/backend/python && \
  source venv38/bin/activate && \
  pytest smartbi/services/materialized_analytics/tests/test_schema_helpers_review.py -v"
# Expected: 25-30/25-30 PASS

# 3. Re-materialize upload 3975 (per §5.2 step 3)
# Verify byte-match (per §5.2 step 4)

# 4. Upload synthetic 美团-renamed xlsx (per §5.3), verify same KPIs

# 5. Smoke prod parity (no prod impact yet — code not deployed):
TARGET_URL=http://localhost:8084 node tests/e2e-comprehensive/p2-guardrail-full.mjs
# Expected: existing 93/94 pass rate maintained (no regression)

# 6. Only after 1-5 green: deploy prod
./scripts/deploy/deploy-smartbi-python.sh --env prod

# 7. Re-materialize all prod review uploads (currently: ZERO on prod 4169
#    — qhj_prod has no review xlsx uploaded). When customer uploads first
#    review xlsx post-deploy, materializer auto-runs new code path.
```

### 6.3 Cache invalidation (per reviewer P2-2)

Field detection runs at materialize time only; cache fast-path uses cached `analysis_result` blobs unchanged. Post-deploy, **already-materialized uploads keep stale results until re-materialized**. For Slice 4 specifically:

- Test 3975 will be re-materialized in §5.2 (mandatory test)
- Prod has no existing review uploads to worry about
- Future review uploads on prod auto-use new code

If we ever migrate POS templates (out-of-scope here), bulk re-materialize all uploads becomes deploy-checklist mandatory.

---

## 7. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Priority order regression (e.g. `星级` returned when `星级分` should win) | Low | High (KPI changes silently) | §5.1 `test_qualified_priority` unit test + §5.2 byte-match |
| `applies()` broadens (template fires on wrong-domain xlsx) | Low | Medium (wasted compute, possible garbage) | §5.4 negative test — synthetic xlsx with no star col must NOT trigger materialize |
| Excluded candidate (`口味` removed from TASTE) breaks an unknown upload that legitimately uses bare `口味` | Very Low | Medium | Backward search: grep prod `smart_bi_pg_field_definitions` for any upload with bare `口味` (no `分` suffix). If zero, exclusion safe. |
| Helper rename breaks future template | Low | Low | §3.2 naming convention documented; lazy-migrate other 2 templates can adopt same helpers |
| Concurrent-edit overwrite during long edit session | Low | High (per Apr 8 incident) | Migration is small (~50 lines net); commit immediately after edit, before any other work |
| Synthetic xlsx fixture binary in git | Certain | Low (~4MB blob) | Acceptable; alternative is generate-on-demand script which adds CI complexity. Add `.gitattributes` for binary handling. Re-evaluate if more fixtures needed. |

### 7.1 What 2-week-later bug looks like

Per reviewer adversarial scenario: customer uploads 美团 review xlsx with `综合评分` column (1-100 scale, NOT 1-5). New helper has `_STAR_CANDIDATES = ("星级分", "评分", "星级")` — `综合评分` matches NONE of these (we deliberately don't add `综合` because it's a different scale). Helper returns None, `applies()` returns False, template skips, customer sees "评价分析" template absent for that upload. They can re-upload as `综合评分→星级分` rename, OR file feature request to support 1-100 scale (separate template).

This is a **known unknown** — explicitly handled by NOT silently treating `综合评分` as 1-5. Better to skip than to mis-scale.

---

## 8. Future backlog (out of POC, for next sessions)

1. **Lazy migrate `kitchen_dispatch_heatmap.py` + `period_comparison_trend.py`**: only 2 other templates have local `_first`. Each ~30min when next touched. Do not pre-migrate.
2. **Add 美团/抖音/小红书 candidate variants** as customers upload data from those vendors. Edit `schema_helpers.py` only; no template changes.
3. **POS-domain expansion** if multi-merchant arises there (e.g. 客如云 vs 美团蓝软 column naming): add candidates to existing `_STORE_COL_CANDIDATES` etc. Already supported by current convention.
4. **Reviewer-recommended P2-2 future**: bulk re-materialize tooling (admin endpoint or cron) for when a multi-template migration ships. Not needed for POC.

---

## 9. Reviewer audit trace

5 P0 + 5 P1 from superpowers:code-reviewer 2026-04-24 → all addressed in this revised spec:

| Finding | Status |
|---|---|
| P0-1 iteration order semantics break | RESOLVED by adopting `_first_present` (iterates candidates first) |
| P0-2 STAR flat alternation | RESOLVED — using literal tuple, priority preserved |
| P0-3 TASTE over-match (口味分 vs 口味标签) | RESOLVED — `_TASTE_SCORE_CANDIDATES = ("口味分",)` excludes bare 口味 |
| P0-4 VIP over-match (会员卡 etc.) | RESOLVED — `_VIP_FLAG_CANDIDATES` excludes 会员 |
| P0-5 Lookahead anchored at end | N/A — no regex used |
| P1-1 missed schema_helpers.py | RESOLVED — extending it instead of creating parallel module |
| P1-2 POC scope too broad | PARTIAL — kept 11 fields (single template, single commit) but adopted safer literal approach so ambiguity risk is per-tuple-design-time, not per-call |
| P1-3 module-level compile | N/A — no regex |
| P1-4 test plan ambiguity tests | RESOLVED — §5.1 `test_priority_specific_wins`, §5.3 multi-merchant, §5.4 negative |
| P1-5 applies() regression | RESOLVED — §5.4 negative test guards |

---

## 10. Success criteria (Definition of Done)

- [ ] Unit tests §5.1: 25-30/25-30 PASS on test env
- [ ] §5.2 re-materialize 3975: byte-identical KPI diff (zero lines)
- [ ] §5.3 synthetic 美团 xlsx: same KPIs as 3975 (12903/4.83/17/9)
- [ ] §5.4 negative xlsx: `applies()` returns False, no cache row written
- [ ] Existing prod smoke test (`p2-guardrail-full.mjs` 94 cases): ≥93/94 pass (no regression vs current baseline)
- [ ] superpowers:code-reviewer audit on actual implementation (Rule 15) — 0 P0 findings
- [ ] Commit message + spec link in commit body
- [ ] Memory updated: short note in MEMORY.md noting Slice 4 D-1 shipped + extension pattern for future review-domain helpers

If any criterion fails → block prod deploy, debug per systematic-debugging.
