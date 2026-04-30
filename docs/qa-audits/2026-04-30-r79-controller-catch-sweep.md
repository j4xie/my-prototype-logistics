# R79 — Controller Catch Sweep (110 Sites in 20 Controllers)

**Date**: 2026-04-30
**Branch**: `e2e/v1-framework`
**Commits**: `77edff9db` (initial 110-site batch) + `1f852360b` (R79-FIX-A compile) + `cafebf96c` (R79-FIX-B reviewer)
**Module focus** (Rule 11): backend `ApiResponse.error` sweep continuation; pulled-in R80 `.orElse` Optional chain pattern

---

## Why this round

R76+R77+R78 cumulative covered 93 sites. R79 targets **the next ~110 sites** by site-count from a fresh grep ranking (top 15 controllers + 5 R80-backlog Optional chain patterns).

Big change from R78: **Python regex transform extended** to handle 5 patterns (catch handler, IAE catch, validation paths, 2-arg `ApiResponse.error(code, msg)`, `.orElse` Optional chain). Manual edits dropped from 30+ to 1.

---

## 110 Sites Fixed

### Top 15 controllers by site count (103 sites)

| Controller | Sites | Notable patterns |
|---|---|---|
| TemplatePackage | 23 | catch + 模板包不存在 404 + 行业代码已存在 409 + 权限不足 403 + usageCount>0 409 |
| RuleController | 15 | catch + 规则语法错误 400 + Dry-Run 异常 500 |
| FileUpload | 15 | catch + file ext/size 400 + sanitize concern (FIX-B) |
| ImageAnalysisTest | 6 | gesture detection failure 400 |
| FormTemplate | 6 | catch handlers |
| DictionaryTest | 6 | catch handlers |
| Sop | 5 | 2-arg variant + sanitize catch |
| Equipment | 4 | catch + IllegalArgumentException |
| EdgeGateway | 4 | catch + EdgeUploadResponse soft-fail (FIX-A non-Throwable) |
| Customer | 4 | validation + catch |
| ComplexityTraining | 4 | training failures |
| ProductType | 3 | validation paths |
| Mobile | 3 | password reset + auth |
| Config | 3 | moduleCode validation |
| WorkReporting | 2 | catch |

### R80 backlog pulled-in (7 sites)

`.orElse(ApiResponse.error(...))` Optional chain pattern — same anti-pattern but R78 grep missed:
- WorkReporting:260 (1 site)
- FeatureConfig:38 (1 site)
- LowcodeController:68, 154 (2 sites)
- restaurant.MaterialRequisition:78 (1 site)
- restaurant.StocktakingRecord:70 (1 site)
- restaurant.WastageRecord:79 (1 site)

→ rewrote as `.orElseThrow(() -> new BusinessException(404, ...))` with hint.

---

## Method: regex-driven batch transform

**Reusable scripts** (now in dev-tools collection):
- `r79-add-import.py` — Add `BusinessException` import after last `com.cretas.aims.*` import
- `r78-transform.py` (R78 v1) — Catch handler with sanitize(e) — handles ~30 sites
- `r78-transform-v3.py` (R78 v3) — Catch handlers without sanitize, IAE simple form
- `r79-validation-transform.py` — Validation paths (5 keyword patterns: 不存在/已存在/权限不足/无法/失败 + generic 400 fallback)
- `r79-validation-v2.py` — File type / e.getMessage() / bare e variants
- `r79-validation-v3.py` — 2-arg `ApiResponse.error(code, msg)` variant + complex concat
- `r79-orelse-transform.py` — `.orElse(ApiResponse.error)` → `.orElseThrow(BusinessException)`

**Manual edit**: 1 site (TemplatePackage:493 `usageCount > 0` 无法删除 409).

**Time**: ~30 min total (vs estimated 6-8 hours if all manual).

---

## Reviewer findings (Rule 9 — independent agent `aa25452e0ea681127`)

Verdict: **FIX BEFORE PROD** → addressed in `cafebf96c` (FIX-B).

Key findings:

1. ⚠️ **400 → 403 misclassification (4 sites)**: My v1 generic 400 fallback caught `无权` keyword which differs from `权限不足` (correctly 403 in TemplatePackage). Same semantic, regex didn't match. Fixed:
   - MobileController:426 `无权重置密码，需要管理员权限`
   - RuleController:161 `无权限修改此规则`
   - RuleController:214 `无权限删除此规则`
   - RuleController:332 `无权限测试此规则`

2. ⚠️ **FileUpload sanitize gap (6 sites)**: catch handlers used raw `e.getMessage()` instead of `ErrorSanitizer.sanitize(e)`. Could leak validator internals / stack-trace fragments. Fixed all 6 + added `ErrorSanitizer` import.

3. ✅ **HTTP code defense**:
   - "规则语法错误" 400 — defensible (Spring's default for invalid input, consistent with codebase)
   - "无法删除：模板包已被使用" 409 — correct (REST conflict semantics)
   - DRL syntax 400 — defensible (could be 422 by REST purist; project convention is 400 for invalid input)

4. ⚠️ **Same-cause sweep gap (Rule 8) — major**: Reviewer's broader grep showed 305 occurrences of `ApiResponse.error` still remaining across 31 files. Cumulative `203/387` claim needs reconciliation.

5. **R80+ backlog**: `ResponseEntity.ok(ApiResponse.error(...))` pattern — different wrapper, ~180 sites across AiAgentRule (14) + IntentAnalysis (45) + SmartBI* (127). Untouched. Not in R79 scope (SmartBI excluded per user; AiAgentRule + IntentAnalysis are R80 candidates).

---

## R79-FIX-A: regex transform compile errors (3 sites)

R79 v2 transform regex had a bug: pattern `("[^"]*失败[^"]*"\s*\+\s*(\w+)\.getMessage\(\))` captured ANY variable with `.getMessage()` method, not just exceptions. 3 sites passed non-Throwable as 3rd arg of `BusinessException(int, String, Throwable)`:

- EdgeGatewayController:59 `response` (EdgeUploadResponse) — drop 3rd arg
- EdgeGatewayController:96 same pattern in uploadImage method
- ImageAnalysisTestController:116 `result` (CompletionGestureResult) — drop 3rd arg

Caught by mvn compile failure on test deploy `bfd0xniva`. Test deploy script gracefully retained R78 jar (no service interruption). Fix in `1f852360b`. Re-deploy `bbsnmhsc0` succeeded.

**Lesson**: Always run mvn compile (or test deploy) after regex batch — static type system catches subtle regex over-matches.

---

## Cumulative state (R76+R77+R78+R79)

| Round | Sites fixed | New controllers touched |
|-------|-------------|-------------------------|
| R76 | 2 | ProductionProgress + BehaviorCalibration (1) |
| R77 | 25 | UserController + BehaviorCalibration (rest) + AIRule (partial) + frontend llm-usage |
| R78 | 66 | DahuaDevice + Device + IsapiDevice + AIRule chain |
| R79 | **110** | **20 new controllers (top 15 + 5 orElse)** |
| **Total** | **203** | **29 controllers** |

Per reviewer's broader grep: ~305 `ApiResponse.error` remaining → ~62% true total still pending. R80+ priority targets:
- AiAgentRuleController 14 sites
- IntentAnalysisController 45 sites (`ResponseEntity.ok(ApiResponse.error)` pattern, different wrapper)

---

## Test/prod ship status

- ✅ vue-tsc N/A (backend-only)
- ✅ Test deploy: `bbsnmhsc0` (FIX-A, compile passed) + `b7mzx2cww` (FIX-B, compile passed). 10011 alive.
- ✅ Push origin: `ac2697820..cafebf96c` (3 commits: 77edff9db + 1f852360b + cafebf96c)
- ⏳ Prod deploy in progress (Blue-Green; no web-admin redeploy)
- ⏳ Audit doc + memory commit pending

---

## R80+ backlog

1. **R80** — `ResponseEntity.ok(ApiResponse.error(...))` cluster: AiAgentRule 14 + IntentAnalysis 45 = 59 sites in 2 controllers (different wrapper pattern from R76-R79). Excluding SmartBI* per user.
2. **R81** — Remaining ~250 individual sites scattered across smaller controllers; needs different sweep strategy.
3. **R82** — Module breadth: equipment/* + quality/* + scheduling/* UI verify (R69-R72 backend touched, UI never live-verified).

---

## Files touched

20 backend controllers (15 main + 5 orElse pulled-in). 1 frontend file unchanged.

LOC: 20 files / +2050 / -1944 across 3 commits.
