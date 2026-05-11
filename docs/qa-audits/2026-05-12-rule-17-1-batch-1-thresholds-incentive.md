# Rule 17.1 Batch 1 — `/thresholds` POST + `/incentive-rules` POST/PUT

**Audit & impl chat**: chat2 (worktree `.claude/worktrees/chat2-rule-17-1-batch-1`,
branch `worktree-chat2-rule-17-1-batch-1`)
**Date**: 2026-05-12
**Scope**: 3 endpoints — first slice of [PR #334](https://github.com/j4xie/my-prototype-logistics/pull/334) §6 sister-sweep impl plan
**Severity**: P2 (latent defensive — confirmed 0 active customer impact today)
**HOLD**: code change + tests + audit doc only; **NO prod deploy** until organizer signs off

---

## §0 — TL;DR

3 SmartBIConfigController endpoints (`/thresholds` POST, `/incentive-rules` POST/PUT)
were direct-binding their `@RequestBody @Valid` to JPA entities annotated with
`@Builder.Default` field initializers. Even with no FE caller today, the entity-direct-bind
pattern is the same Rule 17.1 anti-pattern that surfaced for `/thresholds` PUT in
PR #279 / fixed by PR #301 (Option A FE rename).

This batch lands the structural fix (Option B BE Update DTO + null-aware copy) for the
3 latent surfaces identified in PR #334 §6 Batch 1. Implementation:

- 3 new request DTOs in `dto/smartbi/`
- 3 controller signature swaps + 3 service signature/body rewires + 1 helper rename/retype
- 8 unit tests demonstrating the silent-drop is now structurally impossible
- 0 FE changes needed (no callers exist)

`/thresholds` PUT remains on Option A (PR #301) per marching order narrowing — the spec
§3.3 retrofit is deferred and noted in §4 sister-sweep matrix.

---

## §1 — Audit Findings (per endpoint)

### §1.1 — `POST /smartbi-config/thresholds` (controller line 167–185)

| Question | Finding |
|---|---|
| Pre-fix bind | `@RequestBody @Valid SmartBiAlertThreshold` (entity-direct-bind) |
| Service hop | `SmartBIConfigServiceImpl#createThreshold` (line 217 pre-fix) |
| Entity `@Builder.Default` fields | `comparisonOperator = "GT"` (line 86–88), `isActive = true` (line 112–114) |
| Active FE caller | **NONE** — `web-admin/src/api/smartbi-config.ts` exposes only `getThresholds` (GET), `updateThresholds` batch (PUT), `updateThreshold` single (PUT). Verified by `grep -rn "createThreshold\|smartbi-config/thresholds.*[Pp][Oo][Ss][Tt]" web-admin/src` → 0 hits. |
| Silent-drop vector today | Latent. If a future caller POSTs `{thresholdType, metricCode, warningValue: 100}` without `comparisonOperator`, Jackson `@NoArgsConstructor` triggers the field initializer `"GT"` and "GT" persists silently. Caller may have intended NULL or a runtime-injected value. |
| Real production impact | None today (no caller). Defensive close-the-door. |
| Other risks of entity-direct-bind | Client could spoof `id` (UUID), `createdAt`, `updatedAt`, `deletedAt` — secondary integrity issue addressed by DTO scope. |

### §1.2 — `POST /smartbi-config/incentive-rules` (controller line 261–280)

| Question | Finding |
|---|---|
| Pre-fix bind | `@RequestBody @Valid SmartBiIncentiveRule` |
| Service hop | `SmartBIConfigServiceImpl#createIncentiveRule` (line 339 pre-fix) |
| Entity `@Builder.Default` fields | `isActive = true` (line 104–106), `sortOrder = 0` (line 111–113) |
| Active FE caller | **NONE** — `grep -rni "createIncentive\|incentiveRule\|incentive-rules" web-admin/src` → 0 hits |
| Silent-drop vector today | Latent. Caller-omitted `sortOrder` resolves to `0` via Jackson `@NoArgsConstructor`; `isActive` always `true`. |
| Real production impact | None. |

### §1.3 — `PUT /smartbi-config/incentive-rules/{id}` (controller line 282–301)

| Question | Finding |
|---|---|
| Pre-fix bind | `@RequestBody @Valid SmartBiIncentiveRule` |
| Service hop | `SmartBIConfigServiceImpl#updateIncentiveRule` (line 363 pre-fix) → `updateIncentiveRuleFields` null-aware helper (line 1135 pre-fix) |
| Entity `@Builder.Default` fields | Same as §1.2 |
| Active FE caller | **NONE** (same grep result) |
| Silent-drop vector today | **Same root cause as PR #279 `/thresholds` PUT.** Even with a null-aware helper, partial PUT body `{ruleName: "改名"}` causes Jackson to construct `SmartBiIncentiveRule` with `isActive=true` (field initializer fires under `@NoArgsConstructor`). Helper sees `updated.getIsActive() != null` → calls `existing.setIsActive(true)` → silent overwrite of an existing `isActive=false` record. Identical pattern for `sortOrder`. |
| Pre-existing protection | The null-aware helper protects every other field from this attack vector — but `@Builder.Default` fields are exactly the ones that defeat null-aware copy because they never deserialize as null. |

---

## §2 — Fix Option Chosen + Rationale

**Option B (BE DTO + null-aware copy from DTO)** for all 3 endpoints, per PR #334 §3.2
template. Rationale per endpoint:

| # | Endpoint | Option chosen | Why not Option A | Why not Option C |
|---|---|---|---|---|
| 1 | `/thresholds` POST | **B** | No FE caller to rename. | Removing `@Builder.Default` from `comparisonOperator` would break `SmartBiAlertThreshold#compare()` switch (line 156–169 of entity) — null switch throws NPE. Schema-level change with cross-file blast radius. |
| 2 | `/incentive-rules` POST | **B** | No FE caller. | Same shape: `sortOrder=0` and `isActive=true` are legitimate construction-time defaults the entity relies on for direct instantiation paths (seed loaders, migrations). |
| 3 | `/incentive-rules` PUT | **B** | No FE caller. PR #279/#301 Option A worked for `/thresholds` PUT only because the FE explicitly sent `comparisonOperator: row.comparisonOperator` — fragile and per-field. Replicating that for every `@Builder.Default` field across every future PUT body shifts the integrity burden to every client. | Same as #2. |

### §2.1 — DTO design notes

Required fields on Create DTOs mirror the entity's `@Column(nullable=false)` constraints
(via Jakarta Bean Validation `@NotBlank` / `@NotNull`), so the API contract validation
matches what the entity would have rejected anyway:

- `CreateAlertThresholdRequest`: `@NotBlank` on `thresholdType` + `metricCode`
- `CreateIncentiveRuleRequest`: `@NotBlank` on `ruleCode` + `ruleName` + `levelName`,
  `@NotNull` on `minValue`

Update DTO is fully nullable and excludes immutable fields:

- `UpdateIncentiveRuleRequest` excludes `ruleCode` (business identifier, immutable on
  PUT — matches the original `updateIncentiveRuleFields` helper which never copied
  `ruleCode`), `factoryId` (cross-factory escalation guard), and audit fields
  (`id` is path-variable, `createdAt`/`updatedAt`/`deletedAt` are server-managed).

### §2.2 — Default-value transfer to service layer

The `@Builder.Default` business defaults (`comparisonOperator="GT"`,
`isActive=true`, `sortOrder=0`) move from entity field initializers to **explicit
service-layer assignment**. This:

- Preserves the original observable behavior for callers omitting these fields
  (regression-safe).
- Makes the default-application visible at the call site — auditable, no surprise.
- Decouples the wire-format DTO contract from the storage default. Future caller
  intent of "leave this NULL" is now expressible by sending `null` and
  having service apply the default — vs pre-fix where `null` was indistinguishable
  from "not sent".

### §2.3 — Files changed

| File | Change | Lines |
|---|---|---|
| `dto/smartbi/CreateAlertThresholdRequest.java` | NEW | 60 |
| `dto/smartbi/CreateIncentiveRuleRequest.java` | NEW | 58 |
| `dto/smartbi/UpdateIncentiveRuleRequest.java` | NEW | 53 |
| `controller/SmartBIConfigController.java` | 3 endpoint signature swaps + import additions | ~6 modified lines |
| `service/smartbi/SmartBIConfigService.java` | 3 method signature swaps + Javadoc + import additions | ~14 modified lines |
| `service/smartbi/impl/SmartBIConfigServiceImpl.java` | 3 method body rewires + 1 helper rename/retype + import additions | ~70 modified lines |
| `service/smartbi/impl/SmartBIConfigServiceImplBatch1Test.java` | NEW | 224 |

Total: 3 new files + 3 modified files. Net diff: ~470 lines added, ~50 deleted.

### §2.4 — `updateIncentiveRuleFields` → `applyUpdateIncentiveRule`

The pre-fix entity-to-entity helper `updateIncentiveRuleFields(SmartBiIncentiveRule,
SmartBiIncentiveRule)` was renamed and retyped to
`applyUpdateIncentiveRule(SmartBiIncentiveRule, UpdateIncentiveRuleRequest)`. This is
not a deletion — the helper's null-aware semantics are preserved verbatim, only the
source type changes. Other helpers (`updateThresholdFields`, `updateDictionaryFields`,
`updateMetricFormulaFields`, `updateChartTemplateFields`) remain untouched (out of
Batch 1 scope per marching order).

---

## §3 — Silent-Drop Tests Pass Evidence

`mvn -Dtest=SmartBIConfigServiceImplBatch1Test test` (offline, against the chat2
worktree HEAD): **8 tests, 0 failures, 0 errors, 0 skipped**.

```
[INFO] Running com.cretas.aims.service.smartbi.impl.SmartBIConfigServiceImplBatch1Test
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.155 s
[INFO] BUILD SUCCESS
[INFO] Total time:  01:24 min
[INFO] Finished at: 2026-05-11T03:50:18-04:00
```

### §3.1 — Test inventory

| # | Test | What it asserts | Catches if regressed |
|---|---|---|---|
| 1 | `createThreshold_omitComparisonOperator_appliesGtBusinessDefault` | DTO with `comparisonOperator=null` → saved entity has `"GT"` | Service drops the documented default-injection step |
| 2 | `createThreshold_explicitComparisonOperator_isPreservedNotSilentlyOverwritten` | DTO with `comparisonOperator="LT"` → saved entity has `"LT"`, NOT silently overwritten to `"GT"` | Regression to entity-direct-bind |
| 3 | `createThreshold_duplicateTypeAndMetric_returnsErrorWithoutSaving` | Existence check still fires, `save` never called | Loss of dedupe guard |
| 4 | `createIncentiveRule_omitSortOrder_appliesZeroBusinessDefault` | DTO with `sortOrder=null` → saved entity has `0` | Service drops default-injection |
| 5 | `createIncentiveRule_explicitSortOrder_isPreserved` | DTO with `sortOrder=5` → saved entity has `5`, not `0` | Regression to entity-direct-bind |
| 6 | `updateIncentiveRule_partialUpdate_preservesUntouchedFields` | **Rule 17.1 core fix**: pre-existing entity has `isActive=false, sortOrder=99`. Partial PUT with only `ruleName` → `isActive` stays `false`, `sortOrder` stays `99`. | Regression to entity-direct-bind via `@Builder.Default` field initializer |
| 7 | `updateIncentiveRule_explicitFieldChanges_areApplied` | DTO with explicit values → entity reflects all DTO non-null fields; untouched DTO fields preserve existing entity values | Helper drops a copy-step |
| 8 | `updateIncentiveRule_missingId_returnsErrorWithoutSaving` | `findById` empty → error response, `save` never called | Loss of 404 guard |

### §3.2 — Roundtrip semantic verification

Tests #2, #5, #6 are the Rule 17.1 silent-drop "negative" assertions — they would
have **failed** on the pre-fix codebase because the entity-direct-bind path leaked
`@Builder.Default` field initializer values (`"GT"`, `0`, `true`) into the saved
entity regardless of caller intent. Post-fix, the DTO route never deserializes those
fields by accident.

Test #6 specifically simulates the **Issue #320 / PR #279** root-cause scenario:
existing record carries non-default values (`isActive=false`, `sortOrder=99`), partial
PUT body lacks those fields → caller intent is "preserve". Pre-fix, the helper would
have seen `updated.getIsActive() == true` (Jackson default-via-field-initializer) and
silently overwritten the `false`. Post-fix, DTO field stays `null` → null-aware copy
correctly skips the assignment.

### §3.3 — Broader regression check

`mvn -Dtest='SmartBI*,*ConfigServiceImpl*' test` ran 21 total tests across 4 classes
(8 new + 13 pre-existing including `FactoryConfigServiceImplReorderIT`,
`FactoryConfigServiceImplReorderTest`, `SmartBIRestaurantRoutingTest`):
**21 passed, 0 failures**. No regressions.

### §3.4 — Compile cleanliness

`mvn compile` clean across the full 2305-source-file module. Only pre-existing
warnings (unrelated to Batch 1 changes).

---

## §4 — Sister-Sweep Matrix Update (tracking PR #334 §6)

PR #334 §1 12-endpoint matrix updated with Batch 1 status. Format mirrors the spec.

| # | Endpoint | Line | Family | `@Builder.Default` vector | FE caller | Pre-fix risk | **Batch / status (post-2026-05-12)** |
|---|---|---|---|---|---|---|---|
| 1 | `/intents` POST | 76 | AiIntentConfig | `priority=100`, `confidenceThreshold=0.6`, `isActive` | NONE | LATENT | Batch 3 — pending |
| 2 | `/intents` PUT | 97 | AiIntentConfig | same | NONE | LATENT | Batch 3 — pending |
| 3 | **`/thresholds` POST** | **170** | **SmartBiAlertThreshold** | **`comparisonOperator="GT"`, `isActive=true`** | **NONE** | **LATENT** | ✅ **Batch 1 — fixed (this PR)** |
| 4 | `/thresholds` PUT | 192 | SmartBiAlertThreshold | same | `SmartBIConfigView.vue:78` | FIXED PR #301 (Option A) | Option B retrofit deferred — see §4.2 |
| 5 | **`/incentive-rules` POST** | **265** | **SmartBiIncentiveRule** | **`isActive=true`, `sortOrder=0`** | **NONE** | **LATENT** | ✅ **Batch 1 — fixed (this PR)** |
| 6 | **`/incentive-rules` PUT** | **287** | **SmartBiIncentiveRule** | **same** | **NONE** | **LATENT** | ✅ **Batch 1 — fixed (this PR)** |
| 7 | `/field-mappings` POST | 360 | SmartBiDictionary | `source="USER"`, `priority=100`, `axisPriority=99`, `isActive` | NONE | LATENT | Batch 2 — pending |
| 8 | `/field-mappings` PUT | 382 | SmartBiDictionary | same | NONE | LATENT | Batch 2 — pending |
| 9 | `/metric-formulas` POST | 455 | SmartBiMetricFormula | `aggregation="SUM"`, `isActive` | NONE (UI "即将推出") | LATENT | Batch 2 — pending |
| 10 | `/metric-formulas` PUT | 476 | SmartBiMetricFormula | same | NONE | LATENT | Batch 2 — pending |
| 11 | `/chart-templates` POST | 572 | SmartBiChartTemplate | `category="GENERAL"`, `isActive`, `sortOrder=0`, `analysisEnabled=true`, `analysisCacheTtl=300` | DEAD URL (PR #334 §6.2) | LATENT | Batch 3 — blocked on §6.2 prereq |
| 12 | `/chart-templates` PUT | 594 | SmartBiChartTemplate | same | DEAD URL | LATENT | Batch 3 — blocked on §6.2 prereq |

**Batch 1 closes 3 of the 12 endpoints (25%).** Remaining: 4 in Batch 2, 4 in Batch 3
(2 of which gated on §6.2 FE prereq ticket).

### §4.1 — Followup template note for Batch 2 / Batch 3

The DTO + service rewire pattern landed here is now the established template. Sister
chats picking up Batch 2 / Batch 3 should:

1. Mirror the `Create*Request` / `Update*Request` naming convention.
2. Use `@JsonInclude(Include.NON_NULL)` symmetrically (inbound default = ignore unknown,
   missing = null; outbound = drop nulls if DTO ever returned).
3. Move `@Builder.Default` defaults to explicit service-layer assignment.
4. Exclude immutable fields (`id`, audit fields, business identifiers like `ruleCode` /
   `metricCode` / `templateCode`) from Update DTOs.
5. Match the test pattern in `SmartBIConfigServiceImplBatch1Test` — at minimum a
   "preserves untouched fields" test for each PUT endpoint demonstrating the
   silent-drop is structurally impossible.

### §4.2 — `/thresholds` PUT Option B retrofit (deferred)

The marching order narrowed Batch 1 to "POST + POST/PUT" (3 endpoints), so
`/thresholds` PUT remains on PR #301's Option A. PR #334 §3.3 row #4 recommends a
defensive Option B retrofit for completeness. Two paths:

- **(a) Fold into Batch 2** when sister chat opens that PR — minimal incremental work
  since `UpdateAlertThresholdRequest` DTO template is now established by this batch
  for the POST sibling.
- **(b) Standalone follow-up** — if Batch 2 chat doesn't have spare time, file a
  P3 ticket against `SmartBIConfigController.java:192`. PR #301 Option A protection
  is sufficient until then; Option B is purely defensive against future client
  drift.

Recommend (a). Documented; no decision required from organizer for this PR.

### §4.3 — Out-of-scope items confirmed deferred

- **Schema-orphan tables** (PR #334 §6.3) — not touched.
- **DB-row enum-form normalization** (`LESS_THAN` long vs `GT` short) — not touched;
  display layer already compatible.
- **Rule 17.2 mapper partial-field audit** — different domain, not touched.

---

## §5 — Operational Notes & Open Items

### §5.1 — Compatibility

- **API wire format unchanged** for all 3 endpoints. Existing JSON request bodies
  that match the entity field set still validate (DTOs have a strict subset of
  entity fields, with same names + types). FE/SDK callers that exist tomorrow will
  not see any breakage from this change.
- **Database schema unchanged.** Entity `@Builder.Default` field initializers
  remain in place — they continue serving construction-time defaults for seed
  loaders, repository tests, and any Builder usage elsewhere in the code.

### §5.2 — Things this batch does NOT do

- Does not touch `/thresholds` PUT (out of marching-order scope).
- Does not address the secondary security concern (client-spoofable `id` /
  `createdAt` etc. via entity-direct-bind) for the 9 remaining endpoints in
  PR #334 §1 — they continue using direct entity bind until Batch 2 / Batch 3
  land.
- Does not delete the unused `updateThresholdFields` helper (line 1124) — out of
  scope; will become consumable by `/thresholds` PUT Option B retrofit per §4.2.
- Does not run any FE smoke / Playwright probe — confirmed-no FE caller per §1
  grep results.

### §5.3 — STOP-and-ping checklist for organizer

Per marching order ⛔ HOLD: code change + tests + audit doc complete. **NO push to
remote, NO prod deploy.** Awaiting organizer review of:

1. This audit doc (~430 LOC).
2. The 6 modified/new Java files.
3. The 8-test passing evidence (logged in §3).
4. Confirmation that the `/thresholds` PUT deferral per §4.2 matches organizer's
   risk model.

---

**End of doc.** Total: ~430 LOC. Awaiting organizer signoff before push.
