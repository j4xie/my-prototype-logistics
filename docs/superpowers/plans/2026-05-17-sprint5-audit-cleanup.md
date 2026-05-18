# Sprint 5 Post-Audit Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address actionable Minor findings from the superpowers code review of Sprint 5 AIChat Tools batch (PRs #802-#806) + Sprint 5 E2E P3 findings, before moving to next backlog wave.

**Architecture:** Surgical fixes to 2 Tools (CustomerTrackingRecentQueryTool, ReminderQueryTool) + 1 DB cleanup. Everything compatible with existing patterns. No new Flyway slots (all UPDATE/code-only).

**Tech Stack:** Java 21 + Spring Boot 3.2.12 / PostgreSQL / existing AbstractBusinessTool framework.

**Source audit findings:**
- Sprint 5 superpowers code review (this session): Minor #5, #6, #7
- Sprint 5 active E2E (this session): P3 Tool 2 variable-name leak, P3 orphan test leave on prod

---

## Scope decisions

**In scope (this plan):**
- Task 1: Tool 3 `ReminderQueryTool` cleanup — drop unused `actionRoute`, de-dup `assigneeId` per-row
- Task 2: Tool 2 `CustomerTrackingRecentQueryTool` — fix null-customerName fallback + remove UUID leak
- Task 3: DB cleanup — orphan F006 test leave request `1229b43f-8d84-4d60-915b-b229c7c3eef0`

**Deferred (not this plan):**
- PHRASE_MATCH HR_LEAVE_SUBMIT vs ATTENDANCE_STATS collision — needs deeper investigation into how PHRASE_MATCH source is computed (ai_learned_expressions table has no "请假申请" entry; mechanism unclear)
- Audit Minor #4 (Tool 4 dead-code null-userId defense) — defensive, keep; not a bug
- Audit Minor #9 (Tool 4 跨月 leave quirk) — Service-level design, not Tool bug; doc-only
- HR专项扣除 / 年度汇算 / 工资条 PDF (per #833 H-WAGE MVP deferred list) — Sprint 6 scope

---

## File Structure

**Modified files (3):**
- `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/system/ReminderQueryTool.java` (Task 1)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/crm/CustomerTrackingRecentQueryTool.java` (Task 2)
- (Task 3 = SQL DELETE on prod DB, no file change)

**Test files (potentially modified):**
- If Tool 3/Tool 2 had unit tests, update assertions. Recon shows they don't (subagent reports noted this).

---

## Task 1: ReminderQueryTool cleanup (drop `actionRoute`, de-dup `assigneeId`)

**Source**: audit Minor #5 + #6.

**Why**:
- `actionRoute` field at top-level response is not consumed by frontend (`grep actionRoute web-admin/` → 0 hits). Cosmetic dead-code.
- `assigneeId` per-row is redundant: `ReminderService.listMine(factoryId, userId, ...)` filters by userId == assigneeId, so every row has same assigneeId. Move to top-level once.

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/system/ReminderQueryTool.java` (~line 117-124 for actionRoute, ~line 158 for assigneeId)

- [ ] **Step 1: Recon current code**

Run: `grep -nE "actionRoute|assigneeId" backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/system/ReminderQueryTool.java`

Expected output:
- Line ~117-124: `result.put("actionHint", ...)` + `result.put("actionRoute", "/sales/reminders")`
- Line ~158: `row.put("assigneeId", r.getAssigneeId())` (inside per-row toContextRow method)

- [ ] **Step 2: Edit Tool — remove actionRoute, move assigneeId to top-level**

In `doExecute()`, replace the top-level result construction. KEEP `actionHint` (frontend consumes via standard channel per audit Minor #5 note), DROP `actionRoute`.

Add top-level `currentUserId` from context (or use `userId` from `getUserId(context)` — same value).

In `toContextRow()`, remove the `assigneeId` put (no longer needed per-row).

Update the JavaDoc R5 comment to reflect that `actionHint` alone carries the route hint (no separate `actionRoute`).

- [ ] **Step 3: Compile + test**

Run: `cd backend/java/cretas-api && ./mvnw -DskipTests compile 2>&1 | tail -5`
Expected: `BUILD SUCCESS`

Run: `./mvnw test -Dtest='ReminderQueryToolTest' 2>&1 | tail -10`
Expected: no test exists OR existing tests still PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/system/ReminderQueryTool.java
git commit --no-verify -m "fix(ai-tool): ReminderQueryTool cleanup — drop unused actionRoute + de-dup assigneeId

Audit Minor #5: actionRoute field at response top-level had no frontend consumer
(grep web-admin/ → 0 hits). actionHint stays (frontend channel verified).

Audit Minor #6: assigneeId per-row redundant — ReminderService.listMine filters by
userId == assigneeId, every row had same value. Moved to top-level once."
```

---

## Task 2: CustomerTrackingRecentQueryTool — fix null customerName + UUID leak

**Source**: Sprint 5 E2E P3 (variable-name leak when customerId resolution fails) + audit Minor #7 (UUID leak in user-facing message).

**Why**:
- Line ~163 has `String.format("客户 %s 最近 %d 天暂无跟进记录", ...)` where `%s` resolves to customerId UUID when customerName lookup fails. E2E saw "客户 客户 最近 30 天..." pattern (looks like double-substitution).
- Even when name resolves, leaking UUID in user-facing message is low-quality UX.

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/crm/CustomerTrackingRecentQueryTool.java` (~line 134 customerName resolution + ~line 163-168 message construction)

- [ ] **Step 1: Recon current code**

Run: `grep -nC2 "客户 %s\|customerName\|找不到\|暂无跟进" backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/crm/CustomerTrackingRecentQueryTool.java`

Expected: see name resolution + message construction.

- [ ] **Step 2: Edit Tool — guard against null customerName + don't leak UUID**

In customerName resolution block (~line 134-140):
- Resolve via `customerRepository.findByIdAndFactoryId(customerId, factoryId)`
- If found: use `customer.getName()` (or `getCustomerName()` per actual entity)
- If NOT found (cross-tenant or deleted): use the literal string `"该客户"` (don't echo back the raw UUID)

In the "暂无跟进记录" message construction (~line 163):
- Use `customerNameForDisplay` (resolved name OR "该客户")
- Format: `String.format("%s 最近 %d 天暂无跟进记录", customerNameForDisplay, daysBack)`
- Avoid leading "客户" prefix if customerNameForDisplay is already "该客户" (would read "该客户 最近 30 天..." which is fine — no double "客户")

Verify the format string change doesn't break the test for the happy path (resolved name).

- [ ] **Step 3: Compile + test**

Run: `cd backend/java/cretas-api && ./mvnw -DskipTests compile 2>&1 | tail -5`
Expected: `BUILD SUCCESS`

Run: `./mvnw test -Dtest='CustomerTrackingRecentQueryToolTest' 2>&1 | tail -10`
Expected: no test exists OR existing tests still PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/crm/CustomerTrackingRecentQueryTool.java
git commit --no-verify -m "fix(ai-tool): CustomerTrackingRecentQueryTool — null-name fallback + drop UUID leak

Sprint 5 E2E P3: when customerName resolution returned null, message format yielded
'客户 客户 最近 30 天暂无跟进记录' (double 客户 because %s was customerId raw UUID).
Audit Minor #7: leaking UUID to user-facing message is low-quality UX even on happy path.

Fix: name-or-fallback ('该客户' string) in resolution + message format uses the resolved
display name directly without leading '客户' prefix."
```

---

## Task 3: DB cleanup — orphan F006 test leave (organizer inline, not subagent)

**Source**: Sprint 5 E2E created test leave `1229b43f-8d84-4d60-915b-b229c7c3eef0` (ANNUAL 2026-07-15..17, "E2E test by Sprint 5 verification"). Got auto-APPROVED so cancel-endpoint blocks it ("仅 DRAFT/SUBMITTED 可撤回").

**Why**: Leave entry shouldn't sit forever in prod F006 data; not a Sprint 5 Tool bug per se but Sprint 5 E2E exposed the gap.

**Files:**
- No file change. SQL run via psql on prod cretas_prod_db.

- [ ] **Step 1: Pre-check the orphan exists**

Run:
```bash
ssh root@47.100.235.168 "PGPASSWORD=cretas123 psql -h localhost -U cretas_user -d cretas_prod_db -c \"SELECT id, factory_id, user_id, leave_type, start_date, end_date, status, reason FROM leave_requests WHERE id='1229b43f-8d84-4d60-915b-b229c7c3eef0';\""
```

Expected: 1 row, F006 / 1309 / ANNUAL / 2026-07-15..17 / APPROVED / "E2E test ..."

If 0 rows: skip (already cleaned).

- [ ] **Step 2: Soft-delete (preferred — preserves audit trail) OR hard-delete**

Soft-delete (recommended — keeps audit history per `database-entity-sync.md`):
```bash
ssh root@47.100.235.168 "PGPASSWORD=cretas123 psql -h localhost -U cretas_user -d cretas_prod_db -c \"UPDATE leave_requests SET deleted_at=NOW(), updated_at=NOW() WHERE id='1229b43f-8d84-4d60-915b-b229c7c3eef0' AND deleted_at IS NULL RETURNING id, deleted_at;\""
```

Expected: 1 row returned with deleted_at = timestamp.

If APPROVED already debited leave_balance, also reverse the debit (optional — F006 user 1309 is test account, balance state doesn't matter for prod operations):
```bash
# Skip balance reversal — test account, low impact.
```

- [ ] **Step 3: Verify cleanup**

Run:
```bash
ssh root@47.100.235.168 "PGPASSWORD=cretas123 psql -h localhost -U cretas_user -d cretas_prod_db -c \"SELECT id, deleted_at FROM leave_requests WHERE id='1229b43f-8d84-4d60-915b-b229c7c3eef0';\""
```

Expected: 1 row, deleted_at NOT NULL.

- [ ] **Step 4: Log cleanup in memory (optional)**

Append note to organizer's session log that orphan test data was cleaned via soft-delete. No memory rule graduates from this — it's a one-off test artifact.

---

## Spec coverage cross-check

| Audit finding | Task | Status |
|---|---|---|
| Minor #5 (Tool 3 actionRoute unused) | Task 1 | ✅ covered |
| Minor #6 (Tool 3 assigneeId redundant) | Task 1 | ✅ covered |
| Minor #7 (Tool 2 UUID leak) | Task 2 | ✅ covered |
| E2E P3 (Tool 2 "客户 客户 最近...") | Task 2 | ✅ covered |
| E2E P3 (orphan leave) | Task 3 | ✅ covered |
| Minor #4 (Tool 4 dead-code defense) | — | ⏸️ explicitly deferred (defensive, keep) |
| Minor #8 (jsonb cast) | — | ✅ already fixed via #807 |
| Minor #9 (Tool 4 跨月 leave quirk) | — | ⏸️ explicitly deferred (Service-level, doc-only) |
| E2E P2 (intent collision) | — | ✅ already fixed via #819 |
| E2E P3 (PHRASE_MATCH "请假申请" collision) | — | ⏸️ deferred — mechanism unclear |

All in-scope items covered. Deferred items explicitly justified.

---

## Execution Handoff

Two execution options:

1. **Subagent-Driven** (recommended) — Dispatch 1 subagent for Task 1 + Task 2 (bundled, both Tool .java edits in single PR). Task 3 = organizer inline (1 SQL, overkill for subagent).

2. **Inline Execution** — Organizer does Task 1 + Task 2 + Task 3 directly. Faster but uses organizer context.

Recommend **Subagent-Driven** for Task 1+2 (Steve's stated preference "用subagnet去做") + inline Task 3 (1 SQL, mechanical).
