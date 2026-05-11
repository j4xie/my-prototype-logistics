# Rule 17.1 SmartBIConfigController Sister-Sweep — Impl Design Plan

**Spec author**: chat3 (organizer-dispatched, fresh /clear context)
**Spec date**: 2026-05-12
**Issue tracked**: [#320 P0 Rule 17.1 sister-sweep SmartBIConfigController](https://github.com/j4xie/my-prototype-logistics/issues/320)
**Scope**: design plan only — no code edits, no impl. Dispatch plan for ≤4-chat parallel batches.
**HOLD**: spec doc only; STOP-and-ping organizer BEFORE push.

---

## §0 — TL;DR

Issue #320 hypothesized 10 endpoints in `SmartBIConfigController.java` share the same
entity-direct-bind + `@Builder.Default` silent-drop root cause as #279 (fixed in PR #301)
and need parallel sister-sweep fixes.

**Audit result**: the **active-production silent-drop risk is essentially zero today**:

| Endpoint family | BE `@Builder.Default` exists? | Active FE caller? | Real risk today |
|---|---|---|---|
| `/thresholds` PUT (line 192) | YES — `comparisonOperator="GT"` | YES (`SmartBIConfigView.vue` inline-edit) | **ALREADY FIXED by PR #301** |
| `/chart-templates` POST/PUT (line 572, 594) | YES — `category="GENERAL"` + 4 others | **DEAD URL** (`ChartTemplateView.vue` calls wrong path `/charts` → 404) | LATENT — surfaces when URL/field mismatch fixed |
| `/intents` POST/PUT (line 76, 97) | YES — `priority=100`, `confidenceThreshold=0.6`, `isActive` | NO FE caller anywhere | LATENT only |
| `/incentive-rules` POST/PUT (line 265, 287) | YES — `isActive`, `sortOrder=0` | NO FE caller | LATENT only |
| `/field-mappings` POST/PUT (line 360, 382) | YES — `source="USER"`, `priority=100`, `axisPriority=99`, `isActive` | NO FE caller | LATENT only |
| `/metric-formulas` POST/PUT (line 455, 476) | YES — `aggregation="SUM"`, `isActive` | NO FE caller (UI card marked "即将推出") | LATENT only |
| `/thresholds` POST (line 170) | YES — same as PUT | NO FE caller (only inline edit, never create) | LATENT only |

The single active-flow case (`/thresholds` PUT) was already fixed by PR #301 using **Option A
(FE rename + add omitted fields)**. Issue #320's premise — "customer editing chart-templates /
formulas / intents / dictionary via inline-edit will hit identical silent-drop" — is **not
currently true** because no inline-edit FE flow exists for any of those endpoints.

The fix path is therefore **defensive Option B (BE Update DTO)** for the latent surfaces, not
emergency Option A patching of phantom FE flows. **Severity reclassifies P0 → P2** (latent
data-integrity hardening, not active customer-affecting bug).

**Dispatch plan**: 3 sequential PR batches (~6-8 chat-hours total). Parallelism is not
warranted because the entity layer pattern repeats — each batch should reuse the prior batch's
Update DTO template.

**Side-finding requiring its own ticket**: `ChartTemplateView.vue` is currently **completely
non-functional** — FE calls `/smartbi-config/charts` but BE only exposes
`/smartbi-config/chart-templates`. Also `ChartTemplate` FE interface field names
(`code`/`name`/`type`/`configJson`) do not match BE entity columns
(`templateCode`/`templateName`/`chartType`/`chartOptions`), so even after URL fix Jackson
will silent-drop every write. **Separate prerequisite ticket recommended.**

---

## §1 — 10-Endpoint Audit Matrix

`backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIConfigController.java`

| # | Endpoint | Line | Method | Bound entity | `@Builder.Default` silent-overwrite fields | FE caller (verified via grep) | FE flow type | Risk today |
|---|---|---|---|---|---|---|---|---|
| 1 | `/intents` POST | 76 | `createIntent` | `AiIntentConfig` | `priority=100`, `confidenceThreshold=0.6`, `isActive=true` | NONE | — | LATENT only |
| 2 | `/intents` PUT | 97 | `updateIntent` | `AiIntentConfig` | same as above | NONE | — | LATENT only |
| 3 | `/thresholds` POST | 170 | `createThreshold` | `SmartBiAlertThreshold` | `comparisonOperator="GT"`, `isActive=true` | NONE | — | LATENT only |
| 4 | `/thresholds` PUT | 192 | `updateThreshold` | `SmartBiAlertThreshold` | same as above | `SmartBIConfigView.vue:78` (`saveThreshold`) | partial-PUT inline-edit | **FIXED PR #301** |
| 5 | `/incentive-rules` POST | 265 | `createIncentiveRule` | `SmartBiIncentiveRule` | `isActive=true`, `sortOrder=0` | NONE | — | LATENT only |
| 6 | `/incentive-rules` PUT | 287 | `updateIncentiveRule` | `SmartBiIncentiveRule` | same as above | NONE | — | LATENT only |
| 7 | `/field-mappings` POST | 360 | `createFieldMapping` | `SmartBiDictionary` | `source="USER"`, `isActive=true`, `priority=100`, `axisPriority=99` | NONE | — | LATENT only |
| 8 | `/field-mappings` PUT | 382 | `updateFieldMapping` | `SmartBiDictionary` | same as above | NONE | — | LATENT only |
| 9 | `/metric-formulas` POST | 455 | `createMetricFormula` | `SmartBiMetricFormula` | `aggregation="SUM"`, `isActive=true` | NONE (FE has `createFormula` in `api/smartbi-config.ts:245` but no Vue invocation; UI card on `SmartBIConfigView.vue:194-205` is disabled with "即将推出" tag) | — | LATENT only |
| 10 | `/metric-formulas` PUT | 476 | `updateMetricFormula` | `SmartBiMetricFormula` | same as above | NONE | — | LATENT only |
| 11 | `/chart-templates` POST | 572 | `createChartTemplate` | `SmartBiChartTemplate` | `category="GENERAL"`, `isActive=true`, `sortOrder=0`, `analysisEnabled=true`, `analysisCacheTtl=300` | DEAD URL — `ChartTemplateView.vue:211` calls `createChartTemplate()` → `api/smartbi-config.ts:195` → POST `/smartbi-config/charts` (BE does NOT expose this path; 404) | full-replace dialog | LATENT (URL-broken today) |
| 12 | `/chart-templates` PUT | 594 | `updateChartTemplate` | `SmartBiChartTemplate` | same as above | DEAD URL — `ChartTemplateView.vue:209` → `api/smartbi-config.ts:202` → PUT `/smartbi-config/charts/{id}` (404) | full-replace dialog | LATENT (URL-broken today) |

Issue #320 lists 10 endpoints; this matrix shows 12 (POST+PUT for 6 families). The "10"
count likely excludes `/thresholds` POST + PUT as "already covered by #279/#301". The
audit covers all 12 for completeness.

### §1.1 — Discrepancy with Phase C Rule 17 static scan

`docs/qa-audits/2026-05-10-phase-c-rule15-rule17-static-scan.md` §2 reported only **3 hits**
for the `@RequestBody Entity` pattern in SmartBI controllers, all DTOs. That scan was
scoped to **BASE..HEAD diff** (Phase C deletes only), not the full controller file. The 10
SmartBIConfigController hits pre-date that diff window and were therefore not flagged.
Issue #320 (filed off the C-4 reviewer audit, 2026-05-11) correctly identifies them as
out-of-scope from the May 10 scan.

### §1.2 — FE-BE URL/field divergence map (`ChartTemplate` family)

This is the **side-finding requiring a separate prerequisite ticket** before chart-templates
sister-sweep fix is meaningful.

| Layer | Identifier | Value |
|---|---|---|
| FE TS interface | `ChartTemplate.code` | string |
| BE entity column | `template_code` (Java field `templateCode`) | varchar(64) |
| FE TS interface | `ChartTemplate.name` | string |
| BE entity column | `template_name` (Java `templateName`) | varchar(128) |
| FE TS interface | `ChartTemplate.type` | union `'LINE' \| 'BAR' \| ...` |
| BE entity column | `chart_type` (Java `chartType`) | varchar(32) |
| FE TS interface | `ChartTemplate.configJson` | string (JSON-stringified) |
| BE entity column | `chart_options` (Java `chartOptions`) | JSON |
| FE URL (`api/smartbi-config.ts:181/195/202`) | `/smartbi-config/charts` | — |
| BE `@RequestMapping` (`SmartBIConfigController.java:529/569/590`) | `/smartbi-config/chart-templates` | — |

**Net effect**: every FE call from `ChartTemplateView.vue` returns 404. The view is registered
in the router (`web-admin/src/router/index.ts:649`) and reachable from `SmartBIConfigView.vue`
quick-action card, but listing/create/edit/delete all fail silently from the user's POV (only
the axios interceptor toast surfaces). No customer has reported this, consistent with the
"latent only — no inline-edit flow exists" finding.

Until the FE URL + field rename ships, the `@Builder.Default` silent-drop on
`category="GENERAL"` etc. cannot manifest because no PUT body reaches the controller in the
first place.

---

## §2 — Fix Priority Ranking

Re-ranking based on §1 audit (Issue #320 hypothesis P0 → reality P2):

### §2.1 — P0 (Customer-affecting active risk)

**None.**  `/thresholds` PUT — the only confirmed active inline-edit flow — was already fixed
by PR #301 using Option A pattern.

### §2.2 — P1 (High future risk — gated only by sibling ticket)

| Endpoint family | Reason | Gating ticket |
|---|---|---|
| `/chart-templates` POST + PUT | When `ChartTemplateView.vue` URL/field bug is fixed (sibling §1.2 ticket), the `@Builder.Default` overwrite of `category` becomes immediate-active. Pre-emptive Option B Update DTO closes the door before the FE fix lands. | Filed as prerequisite ticket §6.2 |

### §2.3 — P2 (Latent risk — no active or imminent FE flow)

| Endpoint family | Risk profile |
|---|---|
| `/intents` POST + PUT | Admin-only NLU config. If a future admin UI or mobile client uses partial PUT, `confidenceThreshold=0.6` could silently overwrite tuned values. Severity moderate (intent quality regression, not data loss). |
| `/metric-formulas` POST + PUT | "即将推出" disabled card. Pre-emptive fix lets the future feature ship without re-introducing the bug. `aggregation="SUM"` overwriting AVG/COUNT/MAX/MIN is the highest-impact default in this set. |
| `/field-mappings` POST + PUT | Admin-only dictionary mgmt. Four `@Builder.Default` fields — `source="USER"` is the most-risky (could overwrite SYSTEM-imported or AI-learned entries down to USER, losing provenance). |

### §2.4 — P3 (Low risk — minor defaults)

| Endpoint family | Reason for low rank |
|---|---|
| `/incentive-rules` POST + PUT | Only two `@Builder.Default` fields: `isActive=true` and `sortOrder=0`. Both are low-impact (isActive overwrite is recoverable; sortOrder reset is cosmetic). |
| `/thresholds` POST | No FE caller. Even if a future "create threshold" dialog is added, full-form POST sends every field by convention, so `@Builder.Default` overwrite is unlikely to manifest. Defer until concrete need arises. |

---

## §3 — Fix Option Per Endpoint

Per Issue #320 Fix Options A/B/C:

- **Option A (FE rename + add omitted fields to PUT body)** — fast, 1-2h per endpoint. Requires
  active FE caller with partial-PUT pattern.
- **Option B (BE Update DTO + null-aware copy)** — clean, 4-6h per endpoint. Defensive against
  any future client. Compatible with full-replace and partial-PUT both.
- **Option C (DB-level: nullable everything + remove `@Builder.Default`)** — high risk, 1-2
  days. Changes schema defaults; affects read paths and downstream consumers; not justified
  unless Options A/B both impractical.

### §3.1 — Recommendation

**Option B for all P1/P2/P3 endpoints**, because:

1. No active FE caller exists for any of them — Option A has nothing to rename.
2. Future FE/mobile/integration clients may use partial PUT; Option B closes the door
   independently of client behavior.
3. The Update DTO pattern is repeatable (one template, six families); incremental cost per
   family is low once the first one lands.
4. Option C touches DB schema and breaks the entity invariant that fields like `is_active`
   are always populated on read — risk outsized vs. benefit.

### §3.2 — Update DTO template pattern

```java
package com.cretas.aims.dto.smartbi;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.math.BigDecimal;

/**
 * Partial-update DTO for SmartBiAlertThreshold.
 *
 * Rule 17.1 anti-pattern fix: client may PUT a subset of fields; absent fields stay
 * unchanged on the persisted entity. Compare with direct `@RequestBody SmartBiAlertThreshold`
 * which triggers `@Builder.Default` silent-overwrite when caller omits a field.
 *
 * @JsonInclude(NON_NULL) is for outbound serialization only — irrelevant on inbound,
 * left here for symmetry if this DTO is ever returned. Inbound semantics rely on
 * Jackson's default behavior: unknown fields ignored, missing fields stay null.
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UpdateAlertThresholdRequest {
    @Size(max = 64)  private String  thresholdType;
    @Size(max = 64)  private String  metricCode;
                     private BigDecimal warningValue;
                     private BigDecimal criticalValue;
    @Size(max = 16)  private String  comparisonOperator;
    @Size(max = 32)  private String  unit;
    @Size(max = 255) private String  description;
    @Size(max = 32)  private String  factoryId;
                     private Boolean isActive;
}
```

Then in the service:

```java
public ConfigOperationResult updateThreshold(String id, UpdateAlertThresholdRequest req) {
    SmartBiAlertThreshold entity = thresholdRepo.findById(id)
        .orElseThrow(() -> new EntityNotFoundException("threshold " + id));

    // Null-aware copy: only fields the client supplied get written.
    if (req.getThresholdType()      != null) entity.setThresholdType(req.getThresholdType());
    if (req.getMetricCode()         != null) entity.setMetricCode(req.getMetricCode());
    if (req.getWarningValue()       != null) entity.setWarningValue(req.getWarningValue());
    if (req.getCriticalValue()      != null) entity.setCriticalValue(req.getCriticalValue());
    if (req.getComparisonOperator() != null) entity.setComparisonOperator(req.getComparisonOperator());
    if (req.getUnit()               != null) entity.setUnit(req.getUnit());
    if (req.getDescription()        != null) entity.setDescription(req.getDescription());
    if (req.getFactoryId()          != null) entity.setFactoryId(req.getFactoryId());
    if (req.getIsActive()           != null) entity.setIsActive(req.getIsActive());

    thresholdRepo.save(entity);
    return ConfigOperationResult.success(...);
}
```

Repeat per entity family. POST endpoints get a `CreateXxxRequest` DTO with `@NotNull` on
required fields (matches existing `@Column(nullable=false)` annotations).

### §3.3 — Fix option table

| # | Endpoint | Family | Option | Effort | Rationale |
|---|---|---|---|---|---|
| 1, 2 | `/intents` POST + PUT | AiIntentConfig | **B** | 4h | No FE caller; defensive. Two new DTOs (`CreateIntentRequest`, `UpdateIntentRequest`). |
| 3 | `/thresholds` POST | SmartBiAlertThreshold | **B** | 1.5h | No FE caller; one new DTO. Update DTO from #4 already covers PUT. |
| 4 | `/thresholds` PUT | SmartBiAlertThreshold | **B** (replace A) | 2h | Option A patch in PR #301 fixed the active symptom; Option B retrofit completes defensive coverage. Verify PR #301 FE fix continues to work after Update DTO replaces direct entity bind. |
| 5, 6 | `/incentive-rules` POST + PUT | SmartBiIncentiveRule | **B** | 3h | Two new DTOs. Smaller field surface, faster. |
| 7, 8 | `/field-mappings` POST + PUT | SmartBiDictionary | **B** | 4h | Two new DTOs. Watch `source` field — `@Builder.Default = "USER"` is the most-impact silent overwrite vector. |
| 9, 10 | `/metric-formulas` POST + PUT | SmartBiMetricFormula | **B** | 4h | Two new DTOs. Watch `aggregation` default. |
| 11, 12 | `/chart-templates` POST + PUT | SmartBiChartTemplate | **B** | 5h | Two new DTOs, larger field surface (analysisPrompt TEXT, JSON columns). **Blocked by §6.2 prerequisite**. |

Total Option B effort: ~23.5 chat-hours across BE service layer changes (DTO + service rewire
+ unit tests). FE-side: zero changes required for endpoints 1-10. Endpoint 11-12 needs the FE
URL/field fix done first (§6.2).

### §3.4 — Why not Option A for any of these?

Option A is "rename FE field + add omitted fields to PUT body." It requires:
1. An active FE caller exists.
2. That caller uses partial-PUT pattern.
3. The fix is at the call-site level, not the contract level.

For endpoints 1-10, criterion (1) fails — no FE caller exists. For endpoint 11-12, the FE
caller is broken at the URL level (§1.2); fixing the URL+field-rename is **not Option A**, it
is the prerequisite ticket (§6.2). Option B on the BE remains the right fix regardless of
whether the FE caller eventually lands as partial-PUT or full-replace.

### §3.5 — Why not Option C?

Removing `@Builder.Default` on `comparisonOperator`, `aggregation`, `source`, `category`,
etc. would mean:
- Existing DB rows with these columns NULL break runtime invariants (e.g.,
  `SmartBiAlertThreshold.compare()` switches on `comparisonOperator` — null switch throws NPE).
- Repository tests assuming defaults would break.
- The defaults serve a legitimate purpose at construction time (Builder pattern, seed data
  insertion). Removing them shifts the responsibility to every call site, with no net safety
  gain over Option B.

Option C is the wrong tradeoff. Document in spec; move on.

---

## §4 — Dispatch Batch Plan

### §4.1 — Total scope

12 endpoints × ~2h average = ~24 chat-hours of impl + tests + verify. The marching order
allows ≤4-chat parallel batches. Sequential is more efficient here because:

1. The first batch establishes the Update DTO template; subsequent batches reuse it.
2. Each batch touches `SmartBIConfigController.java` + `SmartBIConfigServiceImpl.java`,
   which means parallel branches will conflict at the merge level.
3. Service-layer test scaffolding can be shared.

**Recommendation**: 3 sequential batches, NOT parallel.

### §4.2 — Batch plan

#### Batch 1 (P1+P3 quick wins) — `/thresholds` + `/incentive-rules`

**Files**:
- `dto/smartbi/CreateAlertThresholdRequest.java` (new)
- `dto/smartbi/UpdateAlertThresholdRequest.java` (new)
- `dto/smartbi/CreateIncentiveRuleRequest.java` (new)
- `dto/smartbi/UpdateIncentiveRuleRequest.java` (new)
- `controller/SmartBIConfigController.java` (lines 170, 192, 265, 287)
- `service/smartbi/SmartBIConfigService.java` (interface signatures)
- `service/smartbi/impl/SmartBIConfigServiceImpl.java` (4 method rewires)
- `service/smartbi/impl/SmartBIConfigServiceImplTest.java` (new tests OR additions to existing)

**Estimated effort**: ~6.5 chat-hours.

**Rationale**: Smallest field surfaces, fastest template establishment. PR #301 inline-edit
flow on `/thresholds` PUT must regression-pass — explicit verify step.

**Verify gate**:
- `mvn -pl backend/java/cretas-api test -Dtest=SmartBIConfigServiceImplTest` PASS
- Manual on test env (10011): re-run PR #301 manual smoke from `SmartBIConfigView.vue`
  thresholds tab — partial-PUT preserves untouched fields.
- Issue #320 sister-sweep table update.

#### Batch 2 (P2 high-impact defaults) — `/field-mappings` + `/metric-formulas`

**Files**:
- `dto/smartbi/CreateFieldMappingRequest.java` (new)
- `dto/smartbi/UpdateFieldMappingRequest.java` (new)
- `dto/smartbi/CreateMetricFormulaRequest.java` (new)
- `dto/smartbi/UpdateMetricFormulaRequest.java` (new)
- `controller/SmartBIConfigController.java` (lines 360, 382, 455, 476)
- `service/smartbi/SmartBIConfigService.java`
- `service/smartbi/impl/SmartBIConfigServiceImpl.java` (4 method rewires)
- `service/smartbi/impl/SmartBIConfigServiceImplTest.java`

**Estimated effort**: ~8 chat-hours.

**Rationale**: `source="USER"` and `aggregation="SUM"` are the highest-impact silent-overwrite
vectors in the latent set. Land these before someone wires the "即将推出" formula UI.

**Verify gate**: unit tests + service-layer smoke on test env (curl PUT with partial body,
re-GET, confirm preserved fields).

#### Batch 3 (P1 blocked + P2 admin) — `/chart-templates` + `/intents`

**Files**:
- `dto/smartbi/CreateChartTemplateRequest.java` (new, large)
- `dto/smartbi/UpdateChartTemplateRequest.java` (new, large)
- `dto/smartbi/CreateIntentRequest.java` (new)
- `dto/smartbi/UpdateIntentRequest.java` (new)
- `controller/SmartBIConfigController.java` (lines 572, 594, 76, 97)
- `service/smartbi/SmartBIConfigService.java`
- `service/smartbi/impl/SmartBIConfigServiceImpl.java` (4 method rewires)
- `service/smartbi/impl/SmartBIConfigServiceImplTest.java`

**Estimated effort**: ~9 chat-hours.

**Rationale**: Chart-templates has the largest field surface and is blocked by §6.2
prerequisite (FE URL + field rename ticket). Intents bundles cleanly with it (admin-only,
similar template). Both can ship together once §6.2 lands, or chart-templates BE can ship
first decoupled from §6.2 — the BE DTO doesn't require FE changes to be safe.

**Verify gate**: unit tests; after §6.2 lands, end-to-end smoke from `ChartTemplateView.vue`
(create + edit + delete round-trip on test env).

### §4.3 — Why not parallelize Batch 2 and Batch 3?

Both batches modify `SmartBIConfigController.java` and `SmartBIConfigServiceImpl.java`. Two
chats writing different methods in the same file in parallel violates
`.claude/rules/concurrent-edit-safety.md` Rule 1 (single-session per file). Sequential
batches with git worktree per chat is the safe pattern.

If schedule pressure demands parallel, split per-file:
- Chat A: Controller-side edits only (Batch 2 + 3 controller method changes)
- Chat B: Service-side edits only (Batch 2 + 3 service method changes)

This forces a coordinated interface change but eliminates same-file concurrent edits. Not
recommended unless time-pressured.

### §4.4 — Worktree convention

Per `.claude/rules/concurrent-edit-safety.md` Rule 2:

```bash
git worktree add ../my-prototype-logistics-rule17-batch1 main
cd ../my-prototype-logistics-rule17-batch1
git checkout -b rule17-batch1-thresholds-incentive-rules
```

After PR merges, `git worktree remove` cleans up.

---

## §5 — Effort Estimate

| Batch | Endpoints | Files | Tests | Effort | Sequencing |
|---|---|---|---|---|---|
| Batch 1 | 4 (thresh + incentive) | 4 new DTO, 2 modified | unit + manual | ~6.5h | First |
| Batch 2 | 4 (mappings + formulas) | 4 new DTO, 2 modified | unit + service smoke | ~8h | After Batch 1 |
| Batch 3 | 4 (charts + intents) | 4 new DTO, 2 modified | unit + (post-§6.2) e2e | ~9h | After Batch 2, may block on §6.2 |
| §6.2 prereq | ChartTemplateView FE fix | `api/smartbi-config.ts` + `ChartTemplateView.vue` | manual + vue-tsc | ~3h | Sibling, can run parallel to Batch 1/2 |
| **Total** | **12 BE + 1 FE prereq** | **12 new DTOs, 3 modified Java files, 2 modified TS files** | — | **~26.5 chat-hours** | 3 batches + 1 sibling |

Spread across 3-5 chat sessions over ~1 calendar week is realistic.

---

## §6 — Cross-References

### §6.1 — Source-of-truth links

| Reference | Path / URL | Why it matters |
|---|---|---|
| Issue #320 | https://github.com/j4xie/my-prototype-logistics/issues/320 | Original sister-sweep filing |
| PR #279 issue | (Linked from #301) | Threshold silent-drop original bug |
| PR #301 | https://github.com/j4xie/my-prototype-logistics/pull/301 | Option A fix exemplar — `/thresholds` PUT |
| PR #303 | https://github.com/j4xie/my-prototype-logistics/pull/303 | Datasource fix — disclosed sister-sweep but no follow-up filed (why #320 exists) |
| Phase C Rule 17 static scan | `docs/qa-audits/2026-05-10-phase-c-rule15-rule17-static-scan.md` §2 | Why §1 hits not flagged earlier (scoped to BASE..HEAD diff) |
| Phase C bug-fix prod verify | `docs/qa-audits/2026-05-11-phase-c-bug-fix-prod-verify.md` | Reviewer audit C-4 → Issue #320 trigger |
| Concurrent edit safety | `.claude/rules/concurrent-edit-safety.md` | Why §4 plan is sequential not parallel |
| Field naming convention | `.claude/rules/field-naming-convention.md` | Underpins why FE-BE field mismatches silent-drop |
| API response handling | `.claude/rules/api-response-handling.md` | Rule on rich error bodies (relevant if Update DTO returns 400 on schema mismatch) |

### §6.2 — Prerequisite ticket to file (separate from this spec)

**Title**: `fix(smart-bi): ChartTemplateView.vue dead URL + field-name mismatch (4 fields)`

**Summary**:
- FE `api/smartbi-config.ts` lines 181/188/195/202/209/216 call `/smartbi-config/charts`
  paths; BE `SmartBIConfigController.java` only exposes `/smartbi-config/chart-templates`.
  Six functions hit 404 today.
- FE `ChartTemplate` interface fields `code` / `name` / `type` / `configJson` don't match
  BE entity columns `templateCode` / `templateName` / `chartType` / `chartOptions`. Even
  after URL fix, Jackson silent-drops every write field.

**Fix**:
- URL: rename `/charts` → `/chart-templates` in `api/smartbi-config.ts:181/188/195/202/209/216`
- Field rename in `ChartTemplate` interface and all `ChartTemplateView.vue` references:
  `code` → `templateCode`, `name` → `templateName`, `type` → `chartType`,
  `configJson` → `chartOptions`. Plus add missing fields (`dataMapping`, `layoutConfig`,
  `applicableMetrics`, `analysisPrompt`, `analysisEnabled`, `analysisCacheTtl`).
- Preview endpoint: BE `/chart-templates/{code}/build-with-analysis` is the only preview-ish
  endpoint, takes POST body. FE `previewChart(id: number)` calls `GET /charts/{id}/preview`
  which doesn't exist. Either remove preview button or wire to a real BE endpoint.

**Verify**: vue-tsc clean + manual smoke on test env: load ChartTemplate list, create new,
edit, delete — all 200 success.

**Scope**: pure FE, 1-2 files, ~3 chat-hours.

**Why filed separately**: This is not Rule 17.1 silent-drop; it's a different bug class
(broken URL + Jackson silent-drop on field names). Conflating them in the sister-sweep PR
would muddy the audit trail. Land §6.2 first or in parallel; Batch 3 chart-templates BE
work proceeds independently and is safe to land before §6.2 because the BE Update DTO
never breaks the current 404 state.

### §6.3 — Out-of-scope follow-ups (not blockers)

- **Schema-orphan tables** (`smart_bi_analysis_config`, `smart_bi_share_tokens`): documented
  in Phase C Rule 15 audit §F-1. Separate Flyway migration task; not blocking this spec.
- **DB-row enum-form normalization** (`comparisonOperator` mixed `LESS_THAN` long vs `GT`
  short): documented in PR #301 "Residual / known follow-up". Display layer compatible, no
  current data-integrity issue. Defer.
- **Rule 17.2 mapper partial-field audit**: 5 hits in `mapper/` (production / user / supplier
  / material / customer) flagged in Phase C scan §3. Out of SmartBI scope; separate
  domain-owner sweep recommended.

---

## §7 — Open Questions for Organizer Review

Before this plan is approved for dispatch, please clarify:

1. **Severity reclassification confirm**: Audit shows P0 → P2 (no active customer-affecting
   bug today). Does this match organizer's risk model? If a stricter "any latent silent-drop
   on customer-touchable surface is P1" interpretation is preferred, the Batch 1 sequencing
   stays unchanged but doc framing shifts.

2. **Batch 3 sequencing with §6.2**: Two valid paths:
   - (a) §6.2 lands first → Batch 3 BE can verify e2e from `ChartTemplateView.vue`.
   - (b) Batch 3 BE lands first → §6.2 lands later; BE is "defensive but unreachable" for an
     interim window.
   Which does organizer prefer?

3. **Test scope**: Spec assumes unit tests + service-layer smoke for Batches 1-2; manual e2e
   only for Batch 3 (gated on §6.2). Should Batches 1-2 also include manual smoke given the
   "no active FE caller" verification result (i.e., what would manual smoke even cover)?

4. **Issue #320 update**: After this spec is approved, should chat3 (or organizer)
   amend-comment Issue #320 to reflect the audit's reality-check finding (active risk = 0
   today, severity adjusted P0 → P2, dispatch plan link)?

5. **Should `/thresholds` POST be in Batch 1 even though it has no FE caller?** It's the
   "completeness pair" with the already-fixed PUT — cheap to retrofit since the Update DTO
   template is established the same batch. Spec assumes YES (included in Batch 1).

---

## §8 — Acceptance Criteria for This Spec

- [x] §1 matrix lists all 12 endpoint sites with line numbers, entities, `@Builder.Default`
  fields, FE caller status — verified via Read/Grep at spec-write time
- [x] §2 priority rationale grounded in audit findings, not hypothesis
- [x] §3 fix option (A/B/C) recommended per endpoint with explicit "why not the alternative"
- [x] §4 dispatch batch plan respects `concurrent-edit-safety.md` (sequential not parallel)
- [x] §5 effort estimate in chat-hours, per-batch breakdown
- [x] §6 cross-references list every prior PR/issue/audit cited
- [x] §7 explicit organizer-review open questions for sign-off
- [x] No code edits or PRs opened (spec doc only)

---

**End of spec.**  Total LOC: ~480. Awaiting organizer review before dispatch.
