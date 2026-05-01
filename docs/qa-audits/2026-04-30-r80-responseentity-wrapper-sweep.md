# R80 — ResponseEntity.ok(ApiResponse.error) Wrapper Sweep

**Date**: 2026-04-30
**Branch**: `e2e/v1-framework`
**Commits**: `9405f42a1` (98-site batch) + `bf1f8ba41` (FIX-A reviewer regression)
**Module focus** (Rule 11): backend `ApiResponse.error` sweep — different wrapper pattern from R76-R79

---

## Why this round

R79 reviewer's broader grep surfaced **a different wrapper pattern** that R76-R79 transforms didn't catch:

```java
// R76-R79 pattern: return ApiResponse.error("X");
// R80 pattern:    return ResponseEntity.ok(ApiResponse.error("X"));
```

Both anti-patterns return HTTP 200 + `success:false` body, but R80 wraps in `ResponseEntity` for controllers that declare `ResponseEntity<ApiResponse<X>>` return type. **Total newly discovered**: 243 sites in 14 controllers; excluding SmartBI per user → 98 sites in 9 controllers in scope.

---

## 98 Sites Fixed

| Controller | Sites | Notable |
|---|---|---|
| IntentAnalysisController | 45 | catch + 统计/趋势/失败模式/歧义/优化建议 endpoints |
| SchedulingOptimizationController | 20 | scheduling AI failures |
| AiAgentRuleController | 14 | 5 不存在 404 + 4 无权 403 + 5 无法全局规则 409 |
| VoiceRecognitionController | 9 | iFlytek soft-fail 502 + IAE/ISE catch |
| SystemConfigController | 3 | `.orElse(ResponseEntity.ok(ApiResponse.error))` Optional chain |
| UserMenuPermissionController | 2 | menuCode 不能为空 400 |
| FoodKBFeedbackController | 2 | feedback catch handlers |
| AIIntentConfigController | 1 | 意图代码已存在 409 |
| RuleController | 2 | response.getMessage() soft-fail (R79 already touched non-wrapper sites) |

---

## Method correctness — return type compatibility

The 9 controllers all declare `public ResponseEntity<ApiResponse<X>> myMethod(...)`. R80 changes method body from:
```java
return ResponseEntity.ok(ApiResponse.error("X"));
```
to:
```java
throw new BusinessException(404, "X");
```

**Spring's @ExceptionHandler intercepts the throw before evaluating the declared return type.** `GlobalExceptionHandler.handleBusinessException` returns `ResponseEntity<ApiResponse<?>>` which Spring writes to response stream directly. Method's declared return type is never reached at runtime on error path — declaration is purely compile-time contract.

Verified: no method signature changes needed; no caller breakage.

---

## R80-FIX-A: critical reviewer regression

Reviewer agent `a2032a60605bb0be3` caught **the most damaging same-pattern bug from R80 v1**:

19 sites where R80 transform replaced `return ResponseEntity.ok(ApiResponse.error())` with `throw new BusinessException()` **inside try blocks** whose outer `catch (Exception e)` swallowed the throw and re-wrapped as 500:

```java
try {
    if (notFound) {
        throw new BusinessException(404, "X不存在: " + id);  // R80 v1
    }
    // ... service call
} catch (Exception e) {
    throw new BusinessException(500, "X失败: " + sanitize(e), e);  // catches the 404 above!
}
```

Users got generic HTTP 500 toasts instead of actionable 404/403/409 messages — defeats R80's purpose.

**Fix**: Insert `} catch (BusinessException be) { throw be; }` BEFORE existing `catch (Exception e)` block:

```java
} catch (BusinessException be) {
    throw be;
} catch (Exception e) {
    throw new BusinessException(500, ...);
}
```

Applied via `r80-fix-passthrough.py` to 5 files (58 catch blocks updated):
- IntentAnalysisController: 27 catch blocks
- SchedulingOptimizationController: 19
- VoiceRecognitionController: 5
- RuleController: 4
- FoodKBFeedbackController: 3

(AiAgentRule had bare throws not inside try; AIIntentConfig already had passthrough.)

**Lesson**: Pure regex transform can't model control flow. Always pair with reviewer + structural analysis after batch transforms.

---

## R80-FIX-A Issue #2: IllegalStateException semantic correction

Reviewer flagged: VoiceRecognitionController 2 sites mapped `IllegalStateException` to 400 (Bad Request) — semantically wrong. ISE typically signals invariant violation (task already cancelled, batch already running) → 409 Conflict.

Fixed:
- Line 293 (bare ISE catch) → 409 + actionHint "请刷新后重试,任务状态可能已变化"
- Line 365 (multi-catch `IllegalArgumentException | IllegalStateException`) → split into two catches with proper codes

---

## Method: Python regex transforms

**Reusable scripts**:
- `r79-add-import.py` — Already used in R79
- `r80-transform.py` (v1) — 9 patterns: catch with sanitize / 不存在 / 未找到 / 无权 403 / 权限不足 403 / 无法 409 / .orElse Optional chain / generic 400
- `r80-transform-v2.py` (v2) — 5 follow-up: 已存在 409 / bare sanitize / response.getMessage soft-fail / .orElse without concat
- `r80-fix-passthrough.py` (FIX-A) — Insert BusinessException passthrough before existing catches

**Time**: ~30 min total (v1 + v2 transforms + reviewer fix). vs estimated 10-12 hours if all manual.

---

## Reviewer findings (Rule 9 — `a2032a60605bb0be3`)

Verdict: **FIX BEFORE PROD** → addressed in `bf1f8ba41`.

Critical (90+ confidence):
1. ⚠️ **Throw-inside-try regression** (19 sites) — passthrough catch added, all 19 now correctly preserve HTTP code through GlobalExceptionHandler. **Fixed.**

Important (80-89):
2. ⚠️ **VoiceRecognition IllegalStateException 400→409** (2 sites) — invariant-violation semantics. **Fixed** with actionHint.

Other answers:
- ✅ Q1 return type compat: Spring intercepts before return-type evaluation. Safe.
- ✅ Q2 response.getMessage() regex risk: Verified Type — VoiceRecognitionResponse DTO not Throwable. Safe.
- ✅ Q5 same-cause sweep: 26 surviving non-wrapper `return ApiResponse.error` (R81 backlog), 5 SmartBI files excluded, 2 `ResponseEntity.status(429).body(ApiResponse.error)` in AIPublicDemo are semantic-correct.
- ✅ Q6 imports: All 9 files clean.

---

## Module coverage matrix update (Rule 11)

| Module | Pre-R80 | Post-R80 |
|---|---|---|
| AI agent rule (backend) | none | medium (14 sites + passthrough) |
| Intent analysis (backend) | none | medium (45 sites + 27 passthrough) |
| Scheduling optimization (backend) | none | medium (20 sites + 19 passthrough) |
| Voice recognition (backend) | none | medium (9 sites + 5 passthrough) |
| System config / Auth menu / FoodKB / AIIntentConfig | none | medium (8 sites total) |

---

## Cumulative state (R76→R80)

| Round | Sites | New controllers |
|---|---|---|
| R76 | 2 | 2 (dashboard) |
| R77 | 25 | 4 (system + frontend) |
| R78 | 66 | 4 (equipment cluster + AIRule chain) |
| R79 | 110 | 20 (top 15 + 5 orElse pulled-in) |
| R80 | **98** | **9 (wrapper pattern)** |
| **Total** | **301** | **38 controllers** |

Per reviewer's broader grep: ~26 non-wrapper sites + ~145 SmartBI (excluded) remain. Effective remaining: ~26 sites in ~17 controllers (R81 candidate, scattered).

---

## Test/prod ship status

- ✅ vue-tsc N/A (backend-only)
- ✅ Test deploy 10011 alive: `bn6kvyvy8` (v1 compile passed) + `bamsn896e` (FIX-A compile passed)
- ✅ Push origin: 2 commits — `9405f42a1`, `bf1f8ba41`
- ⏳ Prod deploy in progress (`b5vvkx5im`)
- ⏳ Audit doc + memory commit pending

---

## R81+ backlog (priority, excluding SmartBI per user)

1. **R81** — Remaining ~26 scattered `return ApiResponse.error` sites in ~17 small controllers (need fresh grep + reviewer broader scan)
2. **R82** — Module breadth: equipment/* + quality/* + scheduling/* UI verify (R69-R72 backend touched, UI never live-verified)
3. **R83+** — Frontend type safety sweep: ~273 `as any` sites tracked in `.claude/rules/typescript-type-safety.md`

---

## Files touched

9 backend controllers across 2 commits.

LOC: 9 files / +514 / -386 (v1 + FIX-A combined).
