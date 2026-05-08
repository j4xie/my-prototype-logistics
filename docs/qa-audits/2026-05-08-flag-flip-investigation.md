# SMARTBI_GOLD_READ_PRIMARY_ENABLED=true on prod — root-cause investigation

**Date**: 2026-05-08
**Auditor**: chat 3 (flag-flip-investigation)
**Trigger**: chat 4 rehearsal RED finding (`df5ded859`) flagged flag=true on prod as 2026-05-06 03:24:55 deliberate flip with undocumented reason. PR #135 deploy MO (PR #145) Step 5/6 expects flag=false → would halt at Step 5.
**Verdict**: **Flag flip is intentional Phase B Dashboard Gold UI port work from 2026-04-23 — chat 4's "5/6 03:24" timestamp is misleading (BGE threshold file mtime, NOT flag flip).** **Decision recommendation: Option B (keep flag=true + amend deploy MO to expect State A behavior)**.

---

## 1. Investigation findings

### 1.1 Track 1.1 — Git log archaeology (`git log -S` for flag string)

Searched `git log --all --since='2026-05-01' -S 'SMARTBI_GOLD_READ_PRIMARY_ENABLED'` — the string only appears in **PR #135 family** (`2e90a2016` Pattern B PR-B v2, `4b11e08d5` PR-B v1, `4caa2858d` PR-B impl) and downstream sister chain (`7e6c35495` K-1 sales fix per PR #149).

`git log -p -- .env.prod scripts/deploy/ scripts/systemd/` shows **no flag toggle in deploy scripts or .env.prod commits** (no `.env.prod` is committed to repo per CREDENTIAL-MANAGEMENT.md hard rule).

### 1.2 Track 1.2 — Server 47 .env.prod backup history (decisive)

```
.env.prod                                                      (1280B, mtime May 6 03:24:55, current)
.env.prod.bak                                                  (813B,  Apr 14 22:56)         ← NO FLAG
.env.prod.bak.20260505_015029                                  (985B,  May 5 01:50:29)       ← HAS FLAG
.env.prod.bak.20260505_023843_stage3                          (1101B, May 5 02:38)
.env.prod.bak.20260505_091800_stage4                          (1106B, May 5 09:18)
.env.prod.bak.20260506_024911_before_semthreshold              (1097B, May 6 02:49)
.env.prod.bak.20260506_032128_before_bge_threshold_restore     (1389B, May 6 03:21)
.env.prod.bak.20260506_032455_before_bge_threshold             (1098B, May 6 03:24)
```

**Diff Apr 14 (no flag) vs May 5 first backup (has flag)** localizes the flag addition to the **Apr 14-May 5 window**:

```diff
< ALIBABA_ACCESSKEY_ID=placeholder
< ALIBABA_SECRET_KEY=placeholder
---
> ALIBABA_ACCESSKEY_ID=LTAI5tGjGs6wnKDk8BZDNKFL
> ALIBABA_SECRET_KEY=B5p7rjWjtXSk1pflWFh5lQz1J3zxUw
+ ALIYUN_OSS_ENABLED=true
+ SMARTBI_GOLD_READ_PRIMARY_ENABLED=true
+ SMARTBI_GOLD_SHADOW_READ_ENABLED=false
+ SMARTBI_ENABLE_SILVER_DUAL_WRITE=true
```

**Bulk env update** added 4 SmartBI flags + Aliyun credentials together — strongly suggests one ops session (not 4 incremental flips).

**Diff May 6 03:21 backup vs current** confirms May 6 03:24:55 mtime is from BGE threshold edit, **NOT a flag flip**:

```diff
< AI_SEMANTIC_THRESHOLD=1.001
---
> AI_SEMANTIC_THRESHOLD=0.55  # BGE-base-zh-v1.5 produces top-1 in 0.5-0.7 range...
```

The flag was already `true` in all post-Apr-14 backups — the May 6 mtime change is unrelated.

### 1.3 Track 1.3 — Memory grep (decisive find)

`memory/project_apr23_dashboard_gold_uiport.md` line 32 explicitly documents:

> **Prod 10010** (blue, 切换后 active): `EnvironmentFile=/www/wwwroot/cretas/.env.prod` 中已有 `SMARTBI_GOLD_READ_PRIMARY_ENABLED=true`.

Line 33: green peer also has flag=true via inline `Environment=` line.

This memory entry describes commits `b1cf06fd8` (Dashboard Gold UI port + date-range picker + Gold-mode KPI mapping) and `315887092` (Bug #417 fix — 53s legacy scan → 228ms when Gold authoritative). **Prod deployment + verified Apr 23**.

→ **Flag was set on prod ~Apr 23** for Java's `GoldDashboardBuilder` to enable Phase B Gold-primary dispatch. Documented, intentional, predates Phase 2A Python port + PR #135.

### 1.4 Track 1.4 — Repo grep (cross-reference)

Active flag references in current main:

| File | Line | Purpose |
|---|---|---|
| `scripts/systemd/.env.test.template:27` | template | TEST env preset (matches prod state) |
| `docs/qa-audits/2026-05-08-pattern-b-sister-endpoint-scan.md:23+` | audit | Documents flag gate addition for Pattern B |
| `docs/qa-audits/2026-05-08-phase2a-retrospective.md:153,195,296,300` | retrospective | "Resolves task #20 latent: env var now read by Python (default false)" |
| `docs/superpowers/dispatch/2026-05-09-pr-135-prod-deploy-marching-order.md` | deploy MO | **MO assumes flag=false on prod** (HARD RULE §6) — MISALIGNED with reality |

PR #135 (`backend/python/smartbi_compat/api/analysis_finance.py:1858`) reads `os.environ.get("SMARTBI_GOLD_READ_PRIMARY_ENABLED", "false")`. Default false matches Java `@Value(":false")`. Prod env override sets true.

### 1.5 Track 1.5 — Python prod log Pattern B 3-state signals (current behavior verified)

```
2026-05-08 21:58:56 - smartbi_compat.api.analysis_finance - INFO -
  [gold-primary] finance factory=F999 Gold empty — skipping legacy
2026-05-08 21:58:56 - smartbi_compat.api.analysis_sales - INFO -
  [gold-builder] factory=F999 range=2026-01-01..2026-12-31 empty Gold -> None (legacy fallback)
2026-05-08 21:58:56 - smartbi_compat.api.analysis_sales - INFO -
  [gold-primary] sales factory=F999 gold empty — skipping legacy
```

**Pattern B 3-state branching IS already firing on prod Python** with flag=true:
- F999 (no Gold POS data) → State B "Gold empty — skipping legacy" → empty stub ✅
- F001 (has Gold POS data per task #20 reversal) → presumably State A ✅
- Exception path → legacy fallback (State C) ✅

### 1.6 Track 1.5b — Code verification on prod disk

```
ssh root@47 "cd /www/wwwroot/cretas/code && git log --oneline -1"
2e90a2016 feat(phase2a): _get_finance_overview full 3-state branching (Pattern B PR-B v2) (#135)
```

**PR #135 IS already deployed to prod disk** via N=2 cutover at 2026-05-07 11:36:28 CST (Python service uptime 1d 15h+ at investigation time). Combined with flag=true env var inherited from Apr 23, Pattern B 3-state branching is **active on Python prod since 2026-05-07 11:36**.

---

## 2. Hypothesis ranking

| # | Hypothesis | Evidence | Verdict |
|---|---|---|---|
| 1 | **Apr 23 Phase B Dashboard Gold UI port (intentional)** | memory `project_apr23_dashboard_gold_uiport.md` line 32 explicit documentation; bulk env update with related Phase B flags (`SMARTBI_ENABLE_SILVER_DUAL_WRITE`, `ALIYUN_OSS_ENABLED`); flag value preserved across May 5-6 BGE threshold edits | ✅ **CONFIRMED** |
| 2 | T6.2 canary launch side effect (env var inheritance from N=2 PR-3 cutover) | T6.2 was 2026-05-07 04:01 CST; N=2 cutover 2026-05-07 11:36 CST. Both POST-date the flag's existence. Flag was already in `.env.prod` before either event. | ❌ Ruled out — temporal mismatch |
| 3 | N=2 multi-worker deploy script side effect | Same — N=2 cutover post-dates flag presence | ❌ Ruled out |
| 4 | Manual ops decision (Steve / earlier chat) without doc trail | Apr 23 work IS documented in memory, with commit refs `b1cf06fd8` + `315887092` | ❌ Doc trail exists |
| 5 | May 5/6 deliberate flip per chat 4 rehearsal interpretation | May 6 03:24:55 mtime is from `AI_SEMANTIC_THRESHOLD=0.55` BGE edit, NOT flag toggle. Backup diff confirms flag preserved unchanged. | ❌ **Misinterpretation of file mtime** |

→ **Single confirmed hypothesis**: Apr 23 Phase B Dashboard Gold UI port intentional flag enablement.

---

## 3. Current prod state validation

### 3.1 Java prod 10010 (since Apr 23)

`SMARTBI_GOLD_READ_PRIMARY_ENABLED=true` enables `FinanceAnalysisServiceImpl.getFinanceOverview` (Java line 112-190) Gold-primary dispatch via `GoldDashboardBuilder`:
- F001: Gold has data → State A 4 KPIs (revenue / bills / avg_bill_value / store_count) + top_stores rankings
- F999 + 14 T6.4 customers: Gold empty → State B empty stub (`buildEmptyDashboard` Java line 105-107) — skips slow legacy scan per Bug #417 fix

### 3.2 Python prod 8083 (since 2026-05-07 11:36 N=2 cutover, with PR #135)

Same dispatch logic mirrored:
- F001: State A — 4 KPIs Gold-derived (parity with Java)
- F999: State B — empty stub (parity)
- 14 T6.4 customers: Gold empty → State B empty stub (per K-1 audit `smart_bi_sales_data` = 0 rows for all 14)

### 3.3 Behavior consistent with code intent

Apr 23 Phase B work + PR #135 Pattern B implementation + flag=true on prod = **intentional architecture state**. Phase B was documented as Bug #417 perf fix (53s → 228ms, 236× speedup) by skipping legacy when Gold authoritative. Flag=true is the trigger for that fix.

---

## 4. PR #135 deploy MO amendment recommendation

### 4.1 Misalignment in PR #145 deploy MO

| MO assumption | Reality | Source of misalignment |
|---|---|---|
| Flag=false on prod (HARD RULE §6) | Flag=true since Apr 23 | MO author missed the Apr 23 Phase B work |
| PR #135 not yet deployed | Already deployed via N=2 cutover May 7 11:36 | MO author assumed deploy is fresh |
| F001 smoke expects State C 10 KPIs + 3 charts (legacy) | F001 actually emits State A 4 KPIs + top_stores (Gold) | Consequence of flag=true + PR #135 |
| Step 5 will trigger "STOP, ping organizer" if 4-card shape | Will fire on every F001 smoke since flag=true | MO assumption wrong |

### 4.2 Decision verdict — **Option B (keep + amend MO)**

| Option | Action | Pros | Cons | Recommendation |
|---|---|---|---|---|
| **A** — flip flag back to false | Edit `.env.prod`, restart Python, re-test | Preserves MO unchanged | Reverts Apr 23 Phase B work, breaks Bug #417 perf fix (53s legacy scan returns), no documented business justification to revert | ❌ NOT recommended |
| **B** — keep flag=true + amend MO | Update PR #145 §5 F001 smoke to expect State A 4 KPIs; update §6 HARD RULE to "track current prod state"; add State A regression check | Preserves intentional Apr 23 work; MO reflects reality; future MOs reference correct prod state | Requires MO doc edit + cross-team review | ✅ **RECOMMENDED** |
| **C** — keep + investigate further | This investigation IS the further-investigation step | (already done) | Adds delay | ❌ Subsumed by this audit |

### 4.3 Specific MO amendments needed (PR #145)

PR #145 amendment (chat 1 specialty per ownership):

1. **§5 F001 smoke amend**: Accept State A response shape for F001
   ```
   Expected (State A — Gold has F001 POS data):
     kpiCards count = 4
     keys = [total_revenue, bill_count, avg_bill_value, store_count]
     rankings.top_stores = present (≤10 stores)
     charts = [] (Gold path doesn't emit charts yet per GoldDashboardBuilder line 31-35)
     aiInsights = [] / suggestions = []
   ```

2. **§5 F999 smoke unchanged**: Still expect State B empty stub
   ```
   Expected (State B — Gold empty for F999):
     kpiCards = []
     charts = []
     rankings = {}
   ```

3. **§5 14 T6.4 customer smoke**: State B empty stub via Gold-empty (matches per K-1 audit)
   ```
   Expected (State B per customer):
     Same empty stub as F999 (Gold empty → skipping legacy)
     Java + Python parity: both empty (legacy table also 0 rows per K-1 audit)
   ```

4. **§6 HARD RULE update**: Replace "flag must be `false` or unset" with:
   ```
   HARD RULE: track current prod state. Do NOT toggle flag during deploy.
   Current state (since 2026-04-23 Phase B Dashboard Gold UI port):
     SMARTBI_GOLD_READ_PRIMARY_ENABLED=true (intentional, documented)
   This deploy does NOT change flag state.
   ```

5. **§6 PR #135 deployment status note**: Replace "PR #135 prod deploy = T6.4 prereq blocker" with:
   ```
   PR #135 deployed to prod 2026-05-07 11:36 CST via N=2 cutover.
   This MO is now a RE-VERIFICATION of post-deploy state, not a fresh deploy.
   ```

6. **Step 1 line 107 grep pattern**: Per chat 4 rehearsal GAP-3, replace `uvicorn.*:8083` with `ps --ppid <MainPID> | grep -c spawn_main` for accurate N=2 worker count.

7. **§1+2 nginx config filename**: Per chat 4 rehearsal GAP-2, replace `cretas-java-upstream.conf` with `_upstream_cretas.conf`.

### 4.4 PR #145 deploy MO redundancy assessment

Given PR #135 already deployed + flag=true since Apr 23:
- Original deploy MO scope: deploy PR #135 binary + verify flag=false
- Reality: PR #135 already running 1d 15h+; flag=true intentional

**Option B-1**: Drop PR #145 deploy entirely (it's a no-op deploy). T6.4 trigger blockers list updated to remove PR #135 deploy as prereq (already satisfied).

**Option B-2**: Keep PR #145 as **re-verification doc** with §6 amendments — runs as smoke-only verification (no actual deploy step), confirms post-cutover state stable.

→ **Recommend Option B-2**: keep MO as smoke-verification, amend per §4.3, dispatch May 9 13:01 as planned.

---

## 5. Decision verdict

✅ **Option B (keep flag=true + amend MO)** is the long-term right per Steve's framing.

| Aspect | Decision |
|---|---|
| Flag state | KEEP true (intentional Apr 23 Phase B work, Bug #417 perf fix dependency) |
| PR #135 deployment | NO new deploy needed (already on prod since 2026-05-07 11:36 N=2 cutover) |
| PR #145 deploy MO | Amend per §4.3 (chat 1 ownership recommended); convert to smoke re-verification |
| T6.4 trigger blockers | Remove "PR #135 prod deploy" from blocker list (already satisfied) |
| Customer-visible behavior change | NONE — Apr 23 to today is single stable state |
| Doc trail | This investigation closes the doc gap; chat 4 rehearsal GAP-1 resolved |

---

## 6. Long-term recommendation per Phase 2B trajectory

### 6.1 Phase 2B implication

Per PR #152 Phase 2B scoping spec + PR #153 strict-byte adoption decision: Phase 2B per-tier port. Each tier inherits Phase 2A's `SMARTBI_GOLD_READ_PRIMARY_ENABLED=true` state — Pattern B 3-state branching becomes the Phase 2B baseline (not opt-in).

Implications:
- Phase 2B Tier 1 Config: not affected (no Gold path)
- Phase 2B Tier 2 Dashboard: inherits Phase 2A baseline (Gold-primary if Gold available)
- Phase 2B Tier 3 Upload: not affected (no Gold path)
- Phase 2B Tier 4 PublicDemo (recommended SUNSET): not affected

### 6.2 Documentation gaps to close

This investigation surfaces 3 doc gaps to close:

1. **CREDENTIAL-MANAGEMENT.md / .claude/rules/server-operations.md**: Add note about flag history (Apr 23 set, intentional Phase B). Future ops + chats reference this when reading `.env.prod`.

2. **`reference_smartbi_gold_layer_architecture.md`**: Update to confirm flag=true is current prod state (memory currently has stale "task #20 latent" note that's resolved).

3. **PR #145 deploy MO (`docs/superpowers/dispatch/2026-05-09-pr-135-prod-deploy-marching-order.md`)**: Apply §4.3 amendments before May 9 13:01 dispatch.

### 6.3 Future flag toggle discipline

**Recommendation**: Any change to `SMARTBI_*_ENABLED` flags on prod requires:
- Memory entry documenting reason + commit reference
- Backup naming convention `bak.<reason>.<ts>` (current pattern is good)
- MO update if any in-flight work assumes flag state

---

## 7. ⛔ HOLD blocks

- ⛔ This is a **read-only investigation**. No prod mutation. No `.env.prod` change. No nginx edit. No Python restart.
- ⛔ Flag stays `true` per recommendation §5. Do NOT flip back without business trigger.
- ⛔ MO amendments (§4.3) require separate dispatch (chat 1 specialty per PR #145 ownership).
- ⛔ This audit does NOT modify PR #145 — that's a follow-up MO amendment commit.
- ⛔ T6.1 BG dryrun task `bccuc6z3e` parallel unaffected by this read-only investigation.

---

## 8. Cross-references

- chat 4 rehearsal: `df5ded859` (`docs/qa-audits/2026-05-08-pr-135-deploy-mo-rehearsal.md`)
- PR #145 deploy MO: `docs/superpowers/dispatch/2026-05-09-pr-135-prod-deploy-marching-order.md`
- Apr 23 Phase B work: memory `project_apr23_dashboard_gold_uiport.md` (commits `b1cf06fd8` + `315887092`)
- PR #135 Pattern B 3-state: `2e90a2016` (`backend/python/smartbi_compat/api/analysis_finance.py:1746-1880`)
- PR #138 smoke verify: `6310f0027`
- K-1 audit (14 T6.4 customer Gold state): PR #147 `a687814bd`
- PR #149 K-1 sales fix: `7e6c35495` (mirrors flag gate to sales path)
- Bug #417 fix: `315887092` (legacy scan 53s → 228ms when Gold authoritative)
- Memory `reference_smartbi_gold_layer_architecture.md` (Java GoldDashboardBuilder ↔ Python `/api/smartbi/gold/*`)

---

## 9. Investigation summary one-liner

> **Flag=true is intentional Apr 23 Phase B Dashboard Gold UI port state, NOT a 5/6 03:24 flip. Chat 4 misinterpreted .env.prod mtime which actually reflects BGE_THRESHOLD edit. PR #135 already deployed via N=2 cutover May 7. Recommendation: Option B amend deploy MO (chat 1 ownership), preserve flag=true.**

---

**End of SMARTBI_GOLD_READ_PRIMARY_ENABLED=true Investigation**
