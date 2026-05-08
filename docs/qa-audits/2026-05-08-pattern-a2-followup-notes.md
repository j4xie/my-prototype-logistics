# Pattern A2 Audit Follow-up Notes — 2026-05-08

**Author**: chat 3
**Trigger**: PR #132 audit doc 末尾 follow-up notes section
**Reference**: PR #132 `c4201e434` (admin merged)
**Output**: doc-only verify + 1 docstring update (no logic change)

---

## Note 1: 2127/2492 receivable/payable percentage scale asymmetry — Python-side, not Java-side

### Python sites (line numbers updated post-#132)

| Old line | New line | File | Variable | Quantize idiom | Emit |
|---|---|---|---|---|---|
| 2127 | **2301** | `analysis_finance.py:_get_receivable_aging_chart` | `percentage` | `(amount/total_ar).quantize(0.0001) * 100` | `_decimal_to_number(percentage.quantize(0.01))` ← scale-2 re-quantize |
| 2492 | **2666** | `analysis_finance.py:_get_payable_aging_chart` | `pct` | `(amount/total_ap).quantize(0.0001) * 100` | `_decimal_to_number(pct)` ← NO re-quantize (Pattern A2) |

### Java side verify

`backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/FinanceAnalysisServiceImpl.java`:

```java
// Constants (line 81-83):
private static final int SCALE = 4;
private static final int DISPLAY_SCALE = 2;
private static final RoundingMode ROUNDING_MODE = RoundingMode.HALF_UP;

// getReceivableAgingChart line 586+ percentage (line 608):
item.put("percentage", totalAR.compareTo(BigDecimal.ZERO) > 0
        ? amount.divide(totalAR, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
        : BigDecimal.ZERO);

// getPayableAgingChart line 832+ percentage (line 854 same pattern):
item.put("percentage", totalAP.compareTo(BigDecimal.ZERO) > 0
        ? amount.divide(totalAP, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
        : BigDecimal.ZERO);
```

**Java side is SYMMETRIC scale-4** — both receivable + payable percentage emit
`BigDecimal` at scale=4 (no `setScale(2)` at chart `data` item emit, since
`LinkedHashMap.put` directly hands the `BigDecimal` to Jackson).

### Verdict

**Java symmetric scale-4. Python asymmetric path but both dict-eq with Java.**

| Side | Receivable percentage | Payable percentage | dict-eq with Java? |
|---|---|---|---|
| Java emit | "12.3400" (scale-4) | "12.3400" (scale-4) | — |
| Python emit | "12.34" (defensive scale-2) | "12.34" (Pattern A2 float collapse) | ✅ both pass dict-eq numeric equality |
| Byte-shape delta vs Java | Python -2 chars | Python -2 chars (Pattern A2) | Both identical Python-smaller-than-Java |

**No Java-side asymmetry** — does NOT trigger marching-order STOP-ping.

### Action

**NO code fix** per marching order constraint:
> "⛔ DO NOT 改 receivable/payable computation logic (Note 1) without verifying Java symmetric"
> "Defensive fix only if Java side confirms scale-2 symmetric"

Java is scale-4, NOT scale-2. So no defensive fix authorized. Both Python paths
are dict-eq accepted vs Java per Rule 4 expanded (Phase 2A dict-eq gate).

If Phase 3+ strict-byte gate adopted, both Python paths need fix to emit scale-4
(matching Java). At that point, the receivable scale-2 idiom needs reversal too.
For now, document and accept.

---

## Note 2: 1721 ROI possible inverse direction — AUDIT MISREAD, NO inverse

### Python ROI site (line shifted from 1721 → **1895**)

```python
# analysis_finance.py:1895
if total_cost > Decimal("0"):
    roi = (
        (gross_profit / total_cost).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        * Decimal("100")
    )
else:
    roi = Decimal("0")

# Emit at line 1969:
value=_decimal_to_number(roi.quantize(Decimal("0.01"), ROUND_HALF_UP)),
formatted_value=f"{roi.quantize(Decimal('0.01'), ROUND_HALF_UP)}%",
```

Python emits **scale-2** (re-quantize before `_decimal_to_number`).

### Java ROI side

`FinanceAnalysisServiceImpl.java` line 480-493:

```java
// ROI
BigDecimal roi = totalCost.compareTo(BigDecimal.ZERO) > 0
        ? grossProfit.divide(totalCost, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
        : BigDecimal.ZERO;
metrics.add(MetricResult.builder()
        .metricCode(MetricCalculatorService.ROI)
        .metricName("投入产出比")
        .value(roi.setScale(DISPLAY_SCALE, ROUNDING_MODE))            // ← scale-2!
        .formattedValue(roi.setScale(DISPLAY_SCALE, ROUNDING_MODE) + "%")
        .unit("%")
        .alertLevel(determineRoiAlertLevel(roi))
        .description("毛利额与成本的比率")
        .build());
```

Java line 488 uses `roi.setScale(DISPLAY_SCALE=2, ROUNDING_MODE)` at emit. **Java
also emits scale-2**.

### Verdict

**The audit doc note was based on incomplete read** of Java side (only saw the
internal `divide(totalCost, SCALE=4)` line, missed the `setScale(DISPLAY_SCALE=2)`
at DTO emit at line 488).

| Side | Internal calc scale | DTO emit scale |
|---|---|---|
| Java | 4 (`divide(SCALE=4)` × 100) | **2** (`roi.setScale(DISPLAY_SCALE=2, HALF_UP)`) |
| Python | 4 (`quantize(0.0001)` × 100) | **2** (`roi.quantize(Decimal("0.01"), ROUND_HALF_UP)`) |

**Both emit scale-2. NO inverse direction.** dict-eq match (also byte-shape
match for non-trailing-zero values; same Pattern A2 collapse for trailing-zero
e.g. `100.00` → `100`).

### Action

**NO code fix** — audit hypothesis disproved. Sample reproduce per marching order
Step 3.2 not necessary (Java code clearly shows `setScale(DISPLAY_SCALE)`).

Update audit history: Note 2 marked as "audit misread, no inverse direction".

---

## Note 3: `_safe_growth_rate` docstring warning — added

### Function (line 562)

Returns scale-4 Decimal. Current callers (728/729/764/765) all defensively
re-quantize to scale-2 before `_decimal_to_number` emit. But future callers
might forget, triggering Pattern A2.

### Action

**Docstring update** in `analysis_finance.py:_safe_growth_rate` adds explicit
caller warning per Rule 4 expanded (PR #132 audit recommendation):

```python
⚠️ CALLER RESPONSIBILITY (per Rule 4 expanded — Pattern A2 audit, PR #132):
Do NOT pass result directly to ``_decimal_to_number`` for emission — that
triggers Pattern A2 trailing-zero loss (e.g. ``99.9900`` → float ``99.99``).
All current callers (lines 728/729/764/765) defensively re-quantize:

    rate = _safe_growth_rate(num, denom)
    emitted = _decimal_to_number(rate.quantize(Decimal("0.01"), ROUND_HALF_UP))
    #                                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ MANDATORY

Phase 2A dict-eq gate accepts trailing-zero loss (numeric equality), but
Phase 3+ strict-byte gate would require defensive scale-2 re-quantize at
emission to match Java DTO ``setScale(DISPLAY_SCALE=2, HALF_UP)``.
```

NO logic change, NO behavior change. Pure docstring documentation.

---

## Decision summary

| Note | Verdict | Code change |
|---|---|---|
| Note 1: 2127/2492 scale asymmetry | Java symmetric scale-4 (no Java-side asymmetry); Python asymmetric paths both dict-eq accepted | **No fix** (Phase 2A dict-eq gate) |
| Note 2: 1721 ROI inverse direction | Audit misread; both Java + Python emit scale-2 (Java line 488 setScale(DISPLAY_SCALE=2)) | **No fix** (no inverse) |
| Note 3: `_safe_growth_rate` docstring | Defensive caller warning added | **Docstring only** (no logic change) |

**Net result**: 1 docstring update + 1 audit follow-up doc. Notes 1 and 2 audit
hypotheses disproved by deeper Java-side reading (proves the value of doing
verify cycles vs accepting initial findings as truth).

No STOP-and-ping triggers fired:
- ⛔ Note 1 STOP-ping trigger: "Java-side asymmetry" — disproved (Java symmetric scale-4)
- ⛔ Note 2 STOP-ping trigger: "true ROI inverse" — disproved (both scale-2 at emit)

Phase 2A dict-eq gate stays as official standard. Phase 3+ strict-byte gate
would benefit from cleanup of all 3 notes (consistent receivable/payable scale-4
emission; explicit ROI scale-2 vs Java scale-2 already aligned; growth_rate
caller idiom enforced via docstring).
