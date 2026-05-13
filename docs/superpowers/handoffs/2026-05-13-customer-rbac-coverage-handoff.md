# Next-session handoff: customer RBAC coverage push

**Created**: 2026-05-13
**By**: Claude Opus 4.7 (1M) organizer @ end of session
**Approved by**: Steve ("就按这个继续下次 session 推")
**Status**: ready for next session opener to pick up

---

## Session-prior context (this session's outcome)

Original `/goal` (audit doc + E2E plan + scripts skeleton) **100% delivered** (PR #481 merged). But the audit itself revealed only **3.9% strong E2E coverage** of the 51-ask customer requirement matrix from 六扇门 (F006) meetings.

This session subsequently shipped **3 adjacent P0/P1 RBAC fixes** (PR #495/#499/#503, all merged + prod LIVE), but the broader customer-feature coverage push did NOT happen.

Steve approved continuing per this handoff.

---

## Long-term gaps (4 buckets, counts verified — not estimated)

### Bucket A: 51 客户 ask, 49 unverified (92%)

Per `docs/qa-audits/2026-05-13-liushanmen-coverage-gap-audit.md` §1.2 partition:

| Sub-bucket | Count | Asks |
|---|---|---|
| ◯ LIVE-only未E2E | 25 | T1-1..5, T2-1,2,4,5,6,7,8,9, T3-1,2,3,4,5,10,12,15, T4-B1,B7,B8,D3 |
| 🟡 Weak evidence | 9 | T2-10, T3-9, T4-B2,B3,B4,B5,B9, T4-D1, T4-D2 |
| 🔴 Real open | 7 | T1-6, T2-3, T3-6, T3-11, T3-13, T3-14, T4-B6 |
| ⛔ Audit-missed | 8 | T2-5b, T2-11, T2-12, T3-8b, T4-D4, T4-D5, T-RTA, T-INV |

**Already verified**: T3-7 (收货数量列), T3-8 (PDF 打印) — 2 only.

### Bucket B: RBAC sister sites un-closed

Run-time count via grep on `origin/main`:
```bash
find web-admin/src/views/sales web-admin/src/views/production \
     web-admin/src/views/transfer web-admin/src/views/finance \
     web-admin/src/views/inventory -name "*.vue" \
   | xargs grep -L "canViewPrice" | wc -l
# Last verified: 29 (2026-05-13 ~04:00 UTC)
```

Plus:
- PDF content masking (PR #456) — Excel button hidden ✓, PDF content NOT byte-grepped
- 5 controllers (PR #489) — prod cutover test-plan checkboxes unticked
- 8 SmartBI endpoints (#480/#490/#491) — same, prod cutover unverified

### Bucket C: Test infrastructure

- 21 follow-up E2E scenarios in `scripts/customer-audit-e2e-2026-05-13/run-e2e.mjs` (P0=5 / P1=11 / P2=5). Only P0 5 ran (re-verify of merged PRs, NOT new customer-ask coverage). P1 11 + P2 5 = **16 scenarios NOT yet executed**.
- No CI gate for RBAC regression — every web-admin deploy is a fresh risk.
- Multi-role × multi-factory negative regression matrix — never attempted.

### Bucket D: Local hygiene leftover

- `stash@{0}` (May 9 LLM router, 1216-line diff vs main, decision pending)
- 30 worktrees on disk (May 12 set freed 160GB by clearing 199; next layer ready)

---

## Recommended next-session priorities (by ROI)

### P1: Sister sweep 29 Vue views (mechanical, infra already exists)

`permissionStore.canViewPrice` is the centralized API (PR #472, MERGED). Pattern: add `import { usePermissionStore }` + `const canViewPrice = computed(() => permissionStore.canViewPrice)` + wrap `<el-table-column>` / `<el-descriptions-item>` with `v-if="canViewPrice"` for any price-bearing element.

Reference impl: PR #487 (procurement/orders/detail.vue) — 7 wraps including Option A whole-collapse for 三价对比.

**Concrete file list** (re-grep at session start to refresh):
```bash
find web-admin/src/views/{sales,production,transfer,finance,inventory} \
     -name "*.vue" -exec grep -L "canViewPrice" {} \;
```

Expected breakdown:
- sales (7): orders/detail, quotes/*, shipments/*, finished-goods/*, etc.
- production (10): batches/*, plans/*, bom/index, etc.
- transfer (2): list, detail
- finance (9): SKU毛利率, reports, ar-ap, etc.
- inventory (1): MaterialPriceTrendView

**Dispatch strategy**: 5 parallel subagents (one per dir). Each gets the dir-specific file list + sister-sweep pattern + scope-safe commit + Rule 7 verify.

ETA: ~3-4 hr wall-clock for parallel; ~10-15 hr serial.

### P2: Run E2E follow-up P1 scenarios (11 left)

Already-written: `scripts/customer-audit-e2e-2026-05-13/run-e2e.mjs --p1`

Prerequisite: **find test env web-admin URL** (B4.0 in plan doc identified backend test API at `47:10011/8084` but UI URL was TBD). Once known, P1 11 scenarios run:

- T4-D4 RPF chain
- T4-D5 WH-LOG fulfill
- T-RTA 退货
- T-INV 收款
- T2-5b / T2-11 / T2-12 ⛔
- S2/S3/S5/S6 weak-evidence re-test

Each scenario expected ~30-60s. Total ~10-15 min runtime.

### P3: Multi-role × multi-factory negative regression

Write a 5×5 matrix smoke:
- 5 roles: factory_super_admin (positive), warehouse_manager (negative), hr_admin (negative), operator (negative), viewer (negative)
- 5 routes: procurement orders list+detail, sales orders list+detail, transfer list
- Assert: positive role sees prices, negative roles see hidden columns + null wire
- Wire into CI as post-deploy gate

ETA: ~3-4 hr to author + 1 deploy cycle to validate gate.

---

## Reference artifacts (durable, on `origin/main`)

| Artifact | Path / link |
|---|---|
| Coverage matrix (51 asks) | `docs/qa-audits/2026-05-13-liushanmen-coverage-gap-audit.md` |
| Follow-up E2E script | `scripts/customer-audit-e2e-2026-05-13/run-e2e.mjs` |
| Follow-up E2E results | `scripts/customer-audit-e2e-2026-05-13/results.json` (P0 only, from 2026-05-12 smoke) |
| permissionStore canViewPrice API | `web-admin/src/store/modules/permission.ts` (post-PR #472) |
| Sister-sweep reference impl | `web-admin/src/views/procurement/orders/detail.vue` (PR #487) |
| Transcript access procedure | `docs/qa-audits/2026-05-13-liushanmen-coverage-gap-audit.md` §Source-of-truth (post-PR #505 amend) |

---

## Memory rules graduated this session

- `feedback_skill_invoke_before_each_task.md` — Skill 工作流纪律
- `feedback_count_dont_estimate_at_close_out.md` — 关合数据要 count 不要 estimate
- `feedback_audit_doc_references_open_pr_dangling_risk.md` — audit 文档引用 OPEN PR 的 dangle 风险
- `feedback_concurrent_edit_safety.md` Rule 7 — branch verify pre/post commit (3 次实战)

---

## NOT recommended for next session

- DON'T re-run the audit (it's already done; just execute its recommendations)
- DON'T `/goal` set to a vague "improve coverage" — pick a specific bucket and stick
- DON'T claim "全闭合" until 29 Vue views + 11 P1 scenarios + 5×5 matrix are all done — even then reviewer audit advised it's premature

---

## Sign-off

Session retrospective verified by Steve (`没有 misrepresent`). Ready for next session opener.
