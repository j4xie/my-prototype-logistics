# Strict-Byte Gate Phase 3+ Adoption Decision Spec

**Status**: Decision-support / planning doc — guides per-category gate selection for Phase 2B+ port + future Phase 3+ requirements
**Phase**: Forward-looking (no execution; decision support only)
**Author**: chat 3 (strict-byte gate adoption decision)
**Date**: 2026-05-08
**Companion docs**: Phase 2A retrospective (chat 1 in flight) + Phase 2B scoping spec (chat 2 in flight) + T6.5 deprecation spec (PR #150)

---

## 0. TL;DR

Phase 2A locked **dict-eq gate** as official byte-shape parity standard, achieving T6.1 dryrun 99.945% match rate. Pattern A (integer-Decimal int-collapse) and Pattern A2 (scale-4 trailing-zero collapse) are documented expected divergences — semantic numeric equality holds, business behavior unchanged.

**This spec answers**: when does the next Phase need to upgrade dict-eq → strict-byte, and what's the cost?

**Recommendation summary**:
- **Phase 2A** (analysis, shipped): dict-eq stays. No migration.
- **Phase 2B** (Config 41 / Dashboard 11 / Upload 13 / PublicDemo 10): per-category — most stay dict-eq; Upload may need strict-byte for binary fidelity; Dashboard depends on frontend hash usage (per-page audit).
- **Phase 3+**: case-by-case per new requirement (frontend hash compare / third-party signature / audit log integrity / cache ETag / compliance).

Decision authority per category: PM/architect + new requirement source.

---

## 1. Current Phase 2A dict-eq gate state

### 1.1 Rule 4 official codification

Per `.claude/rules/python-java-port.md` Rule 4 (Phase 2A locked 2026-05-07 by PR #122 + raw-body fetch):

> **Phase 2A 锁定 dict-eq gate, NOT strict-byte.** dict-eq compares semantic numeric equality (`Decimal("100") == Decimal("100.00")` after parse → match). strict-byte compares string length (6 chars vs 3 chars → diverge).

**Confirmation evidence**:
- T6.1 dryrun 99.945% match rate is the official Phase 2A parity standard
- Rule 4 acceptance criteria: Pattern A/A2 byte delta in dict-eq match → **Accept**, expected, not a bug
- 2026-05-07 raw-body reproduction at server 47: F001 budget endpoint shows 36 trailing-zero Decimal occurrences accounting for ~106B delta, 0 Rule 11/12/structural divergence

### 1.2 Pattern A — integer-valued Decimal int-collapse

```diff
# Java prod 10020 vs Python prod 8083, F001 budget endpoint, 2026-05-07 reproduction:
< "actual": 2103829.00,        # Java BigDecimal scale-preserved
---
> "actual": 2103829,            # Python int(v) collapse
< "value": 0.00                 # Java BigDecimal.ZERO setScale(2)
---
> "value": 0                    # Python int(0)
```

Per-occurrence delta: **+3 chars Java-bigger**. Driver: Python `_decimal_to_number(Decimal("100.00"))` returns `int(100)` because `Decimal("100.00") == Decimal("100.00").to_integral_value()` is True. Java `BigDecimal("100.00")` Jackson serialize → `100.00` (scale-preserved).

**Phase 2A action**: ✅ Accept — semantic equality holds.
**Phase 3+ consideration**: would need helper preserving scale (`_decimal_preserve_scale`) replacing `_decimal_to_number`.

### 1.3 Pattern A2 — scale-4 Decimal trailing-zero collapse to float

```diff
< "executionRate": 99.9900,     # Java scale-4 preserved
---
> "executionRate": 99.99,       # Python float trailing-zero loss
< "executionRate": 100.0000,    # Java scale-4 preserved
---
> "executionRate": 100,         # Python int collapse (also Pattern A)
```

Per-occurrence delta: **+2 to +4 chars** depending on trailing zeros count. Driver: `_decimal_to_number(Decimal("99.9900"))` returns `float(99.99)` after `to_integral_value()` check fails.

**Phase 2A action**: ✅ Accept — semantic equality holds.
**Phase 3+ consideration**: same `_decimal_preserve_scale` helper — must emit string repr if Python float can't preserve scale, OR rely on JSON encoder customization.

### 1.4 Pattern B — Java legacy fallback structural divergence

⛔ **NOT Pattern A/A2 scope**. Pattern B was a structural mismatch where Java legacy fallback returned full DashboardResponse shape while Python's gold-first dispatch returned empty when Gold was empty.

**Closed via**: PR chain #119 / #124 / #127 / #131 / #135 / #137 / #138 — Pattern B 3-state branching (HOT / COLD / empty) implemented in `_get_finance_overview` matching Java legacy fallback semantics.

Pattern B is a **fix-required** category in Rule 4 acceptance criteria — separate from dict-eq tolerance for Pattern A/A2.

### 1.5 Rules 8 / 9 / 11 / 12 — already byte-strict scoped

These rules ALREADY enforce strict-byte parity within Phase 2A dict-eq gate (Rule 4 acceptance criteria explicitly):

| Rule | Topic | Strict-byte already enforced? |
|---|---|---|
| Rule 4 | Decimal serialization (`_decimal_to_number`) | NO — dict-eq accepts Pattern A/A2 |
| Rule 8 | `Map.of(N)` Jackson hash key order | YES — verified via golden recording |
| Rule 9 | Lombok `@Data` getter naming + null emit + derived getters | YES — golden truth |
| Rule 10 | BigDecimal `divide(scale,rounding).multiply(K)` | YES — semantic-rounding parity, also strict-byte if intermediate scale matches |
| Rule 11 | Java Jackson `LocalDateTime` trailing-zero microsecond | YES — `_java_isoformat` helper |
| Rule 12 | Java `String.format("%.Nf", d)` HALF_UP vs banker's | YES — display format strict-byte parity |

**Phase 2A 12 Rules collectively**: 11 of 12 are already byte-strict scoped (Rule 4 is the only dict-eq gate exception). This is important — Phase 2A is **already 11/12 strict-byte capable**, only Decimal serialization (Rule 4) remains the dict-eq tolerance window.

### 1.6 Strict-byte gate NOT applicable to Phase 2A

If Phase 2A retroactively adopted strict-byte:
- Pattern A: 36 occurrences × +3 chars per F001 budget endpoint = +108B Java-bigger per request
- Pattern A2: ~10 occurrences × +2-4 chars per finance endpoint = +20-40B Java-bigger per request
- Strict-byte would FAIL on these even though semantic equality holds

Phase 2A scope (50 endpoints) deliberately chose dict-eq because:
- No client hash-compare contract exists
- Frontend doesn't byte-compare response bodies
- ETag / cache contracts not in use
- Third-party byte-level integrations not present
- Effort:reward not justified for retroactive strict-byte adoption

---

## 2. Strict-byte requirement scenarios (when dict-eq insufficient)

### 2.1 Frontend hash-compare contracts

**Scenario**: Frontend computes hash (SHA-256 / MD5) of raw JSON response bytes for cache invalidation, change detection, or deduplication. If Java emits `0.00` and Python emits `0`, hashes diverge — even though parsed dict equality holds.

**Detection**: `grep -rn "hash\|sha256\|md5" web-admin/src frontend/CretasFoodTrace/src` looking for response-body hashing.

**Risk**: HIGH if exists — silent bug where Python responses appear "different" to frontend cache layer, triggering unnecessary re-renders or false sync indicators.

**Phase 2A status**: not present (verified via Phase 2A retrospective).

### 2.2 Third-party integration APIs

**Scenario**: API contract documented byte-level commitment (e.g. webhook signature based on response body, OAuth signature, SAML assertion, `application/vnd.api+json` strict mode).

**Detection**: Audit external API documentation, integration partner contracts, signed-request flows.

**Risk**: HIGH — third-party signature verification breaks → integration outage.

**Phase 2A status**: not present (Cretas SmartBI is internal-facing).

### 2.3 Audit log integrity

**Scenario**: Digital signature (HMAC / RSA) on response body for compliance audit trail. Strict byte-level reproduction needed for audit replay.

**Detection**: Audit framework / compliance docs — e.g. ISO 27001 / SOX / GDPR data-handling logs.

**Risk**: HIGH if exists — audit reconstruction fails, compliance gap.

**Phase 2A status**: not present.

### 2.4 Performance / cache contracts

**Scenario**: ETag computed from response body bytes. Server emits `ETag: "abc123"` based on body hash. Client uses `If-None-Match` to short-circuit network. If Python emits different bytes than Java for same logical content, cache invalidation breaks.

**Detection**: `grep -rn "ETag\|If-None-Match" web-admin/src frontend/ backend/`.

**Risk**: MED — performance regression (more cache misses) but functional correctness intact.

**Phase 2A status**: not present (no ETag/conditional-GET pattern in current SmartBI APIs).

### 2.5 Compliance / regulatory byte immutability

**Scenario**: Specific regulation requires byte-level immutability — e.g. tax records, financial filings, healthcare records.

**Detection**: Legal / compliance review.

**Risk**: HIGH if applicable — regulatory non-compliance.

**Phase 2A status**: not present.

### 2.6 Phase 2A scenario summary

All 5 strict-byte requirement scenarios: **NONE present in Phase 2A**. Confirmed by:
- Frontend audit (no body-hashing)
- No external API contracts
- No compliance digital-signature requirements
- No ETag pattern in SmartBI
- No regulatory byte-immutability scope

This is why Phase 2A dict-eq gate is sufficient and locked.

---

## 3. Migration path from dict-eq to strict-byte

### 3.1 Codebase audit

Estimated affected sites (extrapolated from Phase 2A 12 Rules audit history):

| Category | Approximate sites | Source |
|---|---|---|
| `_decimal_to_number` calls | ~120 sites | `grep -rn "_decimal_to_number" backend/python/smartbi_compat/` |
| `_format_decimal_half_up` calls | ~12 sites | Per Rule 12 fix history |
| `_java_isoformat` calls | ~50 sites | Per Rule 11 fix history (PR-M-7) |
| Map.of literal dict order | ~30+ sites | Per Rule 8 audit (sub-endpoints + profit + dept + region + inventory) |
| Lombok-pattern dict literals | ~50+ sites | Per Rule 9 audit (5 DTOs sample) |
| **Total estimate** | **~250-300 sites** | for Phase 2A scope alone |

Phase 2B+ scope (Config 41 / Dashboard 11 / Upload 13 / PublicDemo 10 = 75 endpoints) would add proportional sites.

### 3.2 Test infrastructure changes

Strict-byte gate requires:

1. **Golden recording strict mode**: existing `record-java-golden.sh` records Java raw response. Strict mode would compare raw bytes char-by-char, not parse-then-compare-dict.

2. **Comparator strict mode**: new `compare-strict-byte.py` (vs existing `compare-dict-eq.py`):
   ```python
   def compare_strict_byte(java_response: bytes, python_response: bytes) -> bool:
       return java_response == python_response  # exact byte equality
   ```

3. **Per-test gate selection**: tests need to declare gate (`@pytest.mark.gate("dict-eq")` vs `@pytest.mark.gate("strict-byte")`).

4. **CI matrix**: Phase 2A regression tests run dict-eq mode; new strict-byte tests run separate matrix.

**Effort**: ~2-3 weeks foundation infrastructure + per-controller test additions.

### 3.3 Java side adjustments per category

#### 3.3.1 Decimal — needs new Python helper

Current `_decimal_to_number(v)`:
```python
def _decimal_to_number(v: Decimal) -> Any:
    if v == v.to_integral_value():
        return int(v)
    return float(v)
```

Strict-byte required helper (`_decimal_preserve_scale`):
```python
def _decimal_preserve_scale(v: Decimal, scale: int) -> Any:
    """Preserve scale for byte-shape parity with Java BigDecimal."""
    if scale == 0 and v == v.to_integral_value():
        return int(v)
    # Emit Decimal repr (FastAPI must serialize as number, not string)
    quantized = v.quantize(Decimal(10) ** -scale, rounding=ROUND_HALF_UP)
    # Use custom JSON encoder to emit Decimal directly without string conversion
    return quantized
```

Plus FastAPI custom JSON encoder:
```python
class DecimalPreservingEncoder(json.JSONEncoder):
    def encode(self, o):
        if isinstance(o, Decimal):
            return str(o)  # 100.00 not "100.00"
        return super().encode(o)
```

⚠️ **Tricky**: Python's `json.dumps(Decimal("100.00"))` raises TypeError by default. Custom encoder needed. FastAPI's default uses `pydantic` which defaults to string. Custom encoder needs registration globally.

**Effort**: ~1-2 weeks helper + JSON encoder + tests.

#### 3.3.2 LocalDateTime — already handled

`_java_isoformat` already emits Java-Jackson-compatible trailing-zero microseconds dropped (per Rule 11). Strict-byte requires no further change.

#### 3.3.3 Map.of order — already handled

Golden recording reverse-engineers Java hash order, Python literal dicts mirror exact order (per Rule 8). Strict-byte requires no further change.

#### 3.3.4 String.format HALF_UP — already handled

`_format_decimal_half_up` helper (per Rule 12) uses Decimal.quantize with explicit `ROUND_HALF_UP` rounding. Strict-byte requires no further change.

#### 3.3.5 Lombok null emit — already handled

Per Rule 9: dict literal mirrors golden truth (xaxisField lowercase, full null emit per `@JsonInclude` absence). Strict-byte requires no further change.

### 3.4 Helper inventory needed

| Helper | New / Existing | Purpose |
|---|---|---|
| `_decimal_preserve_scale(v, scale)` | NEW | Replace `_decimal_to_number` for strict-byte categories |
| `DecimalPreservingEncoder` | NEW | Custom FastAPI JSON encoder |
| Strict-byte comparator script | NEW | Test infrastructure |
| Per-test gate annotation | NEW | `@pytest.mark.gate("strict-byte")` decorator |
| `_java_isoformat` | EXISTING | Already in `schema_compat.py` |
| `_format_decimal_half_up` | EXISTING | Already in `_java_compat.py` |

**Total new code**: ~200-400 LOC infrastructure + per-site Decimal call replacement.

### 3.5 Per-controller migration cost

Per-category dict-eq → strict-byte migration: **~4-6 weeks per major controller**.

Breakdown:
- Site identification (grep + audit): ~3 days
- Helper integration (replace `_decimal_to_number` with `_decimal_preserve_scale`): ~1 week
- Golden re-recording in strict mode: ~3 days
- Test rewrite + new strict-byte assertions: ~1-2 weeks
- Test env soak + diff verification: ~1 week
- Prod cutover (similar to T6.x staged pattern): ~1 week

If Phase 2B port adopts strict-byte from start (vs port-then-migrate), saves ~50% effort by skipping golden re-recording and test rewrite.

---

## 4. Per-category strict-byte recommendation

### 4.1 Phase 2A analysis (50 endpoints) — SHIPPED

| Aspect | Status |
|---|---|
| Gate | dict-eq (Rule 4 official, locked 2026-05-07) |
| Migration recommendation | ❌ NOT recommended |
| Reason | T6.1 dryrun 99.945% sufficient; no client hash contract; Phase 2A scope already complete and stable |

**Risk of retroactive migration**: HIGH. Pattern A/A2 across 50 endpoints means substantial Decimal serialization changes. Effort:reward not justified without business trigger.

**Trigger conditions to revisit**: frontend hash-compare contract added / external API integration with byte-level commitment / compliance scope change.

### 4.2 Phase 2B Config (~41 endpoints)

`SmartBIConfigController.java` — `/api/mobile/smartbi-config/*`

| Aspect | Status |
|---|---|
| Gate | **dict-eq sufficient** (recommended) |
| Migration recommendation | ❌ NOT recommended (port at dict-eq) |
| Reason | CRUD operations, no hash contract, no third-party signature, low-frequency UI configuration calls |

**Per-page audit task for Phase 2B chat 2 spec**: confirm Config endpoints don't include any signed configuration payload (e.g. license key validation). If found → upgrade to strict-byte for that endpoint subset.

### 4.3 Phase 2B Dashboard (~11 endpoints)

`SmartBIDashboardController.java` — dashboard layout / saved-config endpoints

| Aspect | Status |
|---|---|
| Gate | **TBD — depends on frontend hash usage** |
| Migration recommendation | ⚠️ Per-page audit |
| Reason | Dashboard composition may include user-customized layouts that frontend caches via hash-compare for save-state UX |

**Audit task**:
```bash
grep -rn "dashboardLayout\|savedDashboard\|hash" web-admin/src/views/smart-bi/
```
If frontend hashes layout JSON for save-state detection → strict-byte. If not → dict-eq.

### 4.4 Phase 2B Upload (~13 endpoints)

`SmartBIUploadController.java` — Excel upload pipeline

| Aspect | Status |
|---|---|
| Gate | **strict-byte likely required** |
| Migration recommendation | ✅ Adopt strict-byte from port start |
| Reason | Binary fidelity for upload metadata, file-level idempotency may rely on response hash, parsed Excel dimensions need byte-exact reproducibility for re-parse scenarios |

**Specific concern**: if customer uploads same Excel twice, file-hash dedup needs identical response bytes. Pattern A/A2 collapse on row counts / file size could break dedup logic.

**Audit task**: trace `dedup` / `idempotent` logic in upload pipeline. If found → strict-byte mandatory.

### 4.5 Phase 2B PublicDemo (~10 endpoints)

`SmartBIPublicDemoController.java` — public demo endpoints

| Aspect | Status |
|---|---|
| Gate | **dict-eq sufficient** |
| Migration recommendation | ❌ NOT recommended (port at dict-eq) |
| Reason | Demo route, no hash contract, low-traffic, no third-party integration |

### 4.6 Phase 3+ (unknown scope)

Case-by-case per new requirement. Decision matrix:

| Scenario | Gate decision |
|---|---|
| New frontend feature uses body hash | strict-byte for affected endpoints |
| Third-party webhook integration | strict-byte for webhook responses |
| Audit/compliance scope expansion | strict-byte for affected category |
| Performance / ETag cache contract | strict-byte if ETag based on body hash |
| Internal CRUD / non-customer-facing | dict-eq |
| Read-only analytics with no contract | dict-eq |

### 4.7 Summary table

| Phase | Category | Endpoints | Gate | Reason |
|---|---|---|---|---|
| 2A | Analysis (shipped) | 50 | **dict-eq** | T6.1 99.945% sufficient, no contract |
| 2B | Config | ~41 | **dict-eq** | CRUD, no hash contract |
| 2B | Dashboard | ~11 | **TBD per audit** | Depends frontend hash usage |
| 2B | Upload | ~13 | **strict-byte** | Binary fidelity, dedup |
| 2B | PublicDemo | ~10 | **dict-eq** | Low traffic, no contract |
| 3+ | Unknown | TBD | **case-by-case** | Per use case |

---

## 5. Implementation effort estimate per category

### 5.1 Per-category effort (if adopting strict-byte from port start)

| Category | Sites estimate | Effort |
|---|---|---|
| Phase 2B Config (dict-eq) | ~120 Decimal calls | Existing port pattern, no extra effort |
| Phase 2B Dashboard (TBD) | ~30 Decimal calls | If strict-byte: +1 week per controller |
| Phase 2B Upload (strict-byte) | ~40 Decimal calls | +2 weeks per controller (binary fidelity testing) |
| Phase 2B PublicDemo (dict-eq) | ~20 Decimal calls | Existing port pattern, no extra effort |

### 5.2 Foundation effort (one-time investment for strict-byte capability)

| Item | Effort |
|---|---|
| `_decimal_preserve_scale` helper + JSON encoder | 1 week |
| Strict-byte comparator + golden recording strict mode | 1 week |
| pytest gate annotation + CI matrix | 1 week |
| **Foundation total** | **~3 weeks** |

### 5.3 Retroactive Phase 2A strict-byte migration (NOT recommended)

If Phase 2A retroactively adopts strict-byte (e.g. for unforeseen Phase 3 requirement):

| Item | Effort |
|---|---|
| ~250 Decimal call replacements | 4-6 weeks |
| Re-record all goldens in strict mode | 2 weeks |
| Test rewrite for strict-byte assertions | 3-4 weeks |
| Test env regression sweep | 2 weeks |
| Prod cutover (T6.x-style staged) | 2-3 weeks |
| **Phase 2A retroactive total** | **~12-17 weeks** (~3 months) |

This is why retroactive migration NOT recommended without strong business trigger.

---

## 6. Triggers for adoption

### 6.1 Hard triggers (force adoption per affected category)

- New API contract requires byte-level commitment (e.g. webhook integration with HMAC)
- Customer reports cache invalidation issues traceable to byte-level mismatch
- Audit / compliance scope expansion (regulatory immutability requirement)
- Third-party integration onboarding with documented byte-shape contract

### 6.2 Soft triggers (worth discussing)

- Frontend feature ROI calculation requires body-hash deduplication
- Performance optimization considering ETag-based caching
- Microservices fan-out where downstream service hashes upstream response
- Service mesh / sidecar implementing response transformation that depends on byte stability

### 6.3 Phase 2B scoping spec finalization

Chat 2 Phase 2B scoping spec (in flight) will include per-controller gate selection. This doc provides the decision matrix; chat 2 spec applies it.

### 6.4 Anti-triggers (do NOT migrate)

- "Just to be safe" — effort:reward not justified
- "Future-proofing" without specific use case
- "Cleanup" — dict-eq is intentional engineering choice, not technical debt
- "Match Java exactly" — Java was chosen baseline, not gold standard

---

## 7. Decision points / open questions

### 7.1 Frontend hash-compare contract verification

**Task**: Audit frontend code for response-body hashing.

```bash
# web-admin
grep -rnE "JSON\.stringify.*\.toString\(\)|hashlib|sha256|md5|crc" web-admin/src/

# RN frontend
grep -rnE "JSON\.stringify.*hash|crypto|sha256" frontend/CretasFoodTrace/src/
```

**Expected outcome**: 0 hits for SmartBI response-body hashing. If found → upgrade affected endpoints to strict-byte.

### 7.2 Third-party integration roadmap

**Question for product/architecture**: Phase 2B+ planned third-party integrations? Examples:
- Webhook callbacks to customer systems
- OAuth-style signed-request integrations
- Public API offerings
- Compliance integrations (audit log forwarding)

**Decision authority**: PM / architect lead.

### 7.3 Resource allocation if broad adoption

Multi-quarter effort if strict-byte adopted broadly. Phase 2B alone could add 2-3 months on top of port effort if Upload + Dashboard go strict-byte.

**Question**: is engineering capacity available for strict-byte tax in 2026 H2?

### 7.4 Rollback path if strict-byte adoption causes operational issues

If a strict-byte category proves operationally fragile (test goldens churn frequently, CI flaky):
- Per-category opt-out back to dict-eq
- Retain `_decimal_preserve_scale` helper but allow `_decimal_to_number` alongside
- Document downgrade procedure in this spec's future revision

---

## 8. Out of scope

| Item | Why not |
|---|---|
| Phase 2A retroactive strict-byte adoption | Effort:reward not justified per §5.3 cost analysis |
| Frontend code refactor | Frontend already endpoint-agnostic per Phase 2A — no refactor regardless of byte-shape gate |
| Mobile app version compatibility | Separate cross-cutting concern (mobile points to api.cretaceousfuture.com, doesn't care about upstream byte-shape) |
| Java DTO restructuring to match Python | Java is downstream consumer per task #24 (GoldDashboardBuilder) — Java mirrors Python, not vice versa |
| Pattern B 3-state branching changes | Pattern B closed via #135 chain. Strict-byte gate does NOT affect Pattern B architecture. |
| Phase 2A retrospective doc | Companion doc by chat 1 — separate scope |

---

## 9. Recommendation summary

### 9.1 Phase-by-phase

| Phase | Recommendation | Rationale |
|---|---|---|
| **Phase 2A** (shipped) | dict-eq stays. **No migration.** | T6.1 99.945% sufficient; Pattern A/A2 documented expected; retroactive cost prohibitive |
| **Phase 2B** (chat 2 spec) | **Per-category**: Config / Demo dict-eq; Upload strict-byte; Dashboard TBD per audit | Aligned with use-case requirements; Phase 2B scoping spec applies this matrix |
| **Phase 3+** | Case-by-case per new requirement | Decision authority: PM/architect + new requirement source |

### 9.2 Decision authority

| Decision | Owner |
|---|---|
| Phase 2B per-category gate | chat 2 (Phase 2B scoping spec) + this spec's matrix |
| Phase 3+ per-feature gate | PM + architect lead |
| Foundation infrastructure investment (~3 weeks) | Engineering lead + PM trade-off |
| Phase 2A retroactive trigger | Architect + PM (high bar — requires business trigger) |
| Rollback to dict-eq from strict-byte | This spec's future revision + retrospective |

### 9.3 Decision principles

1. **Default to dict-eq** unless requirement forces strict-byte
2. **Foundation investment shared** — `_decimal_preserve_scale` + JSON encoder + comparator built once, reused per category
3. **Per-port adoption cheaper than retroactive** — if Phase 2B knows strict-byte needed, build during port (50% savings vs retroactive)
4. **Document tolerance windows** — like Rule 4 codifies Pattern A/A2, future strict-byte categories should document acceptance criteria
5. **Rollback path always preserved** — strict-byte to dict-eq downgrade should be ~1 week per category

---

## 10. Cross-references

### 10.1 Phase 2A foundation

- `.claude/rules/python-java-port.md` Rule 4 (dict-eq gate official) + Rules 8 / 9 / 10 / 11 / 12 (already byte-strict scoped)
- Memory `project_2026_05_07_t6_1_dryrun_in_flight.md` (T6.1 99.945% match rate)
- Memory `reference_smartbi_gold_layer_architecture.md` (Java GoldDashboardBuilder ↔ Python `/api/smartbi/gold/*` cross-language contract)
- `docs/qa-audits/2026-05-07-h1-confirm-raw-body-evidence.md` (Pattern A/A2 evidence at server 47)
- `docs/superpowers/specs/2026-05-07-phase2a-finance-overview-real-port-spec.md` (Pattern B chain spec)

### 10.2 Phase 2B / forward-looking

- Chat 2 Phase 2B scoping spec (in flight) — applies per-category matrix from §4
- T6.5 Java SmartBI deprecation spec (PR #150) — Phase 2A surface area reduction
- Phase 2A retrospective (chat 1 in flight) — completion summary informing Phase 2B

### 10.3 Companion docs (forward-looking trio)

This spec completes the Phase 2A → 2B → 3 progression doc trio:

1. **Phase 2A retrospective** (chat 1 in flight): looks backward, captures lessons learned
2. **Phase 2B scoping spec** (chat 2 in flight): looks at near-term, decides per-controller gate
3. **Strict-byte adoption decision** (this spec): looks far-forward, decides Phase 3+ triggers

Together, these three docs unblock the Phase 3+ kickoff prereq planning.

---

## 11. ⛔ HOLD blocks

- ⛔ This is a **decision-support spec only**. No code changes, no infrastructure investment, no per-controller migration triggered by this PR.
- ⛔ Phase 2A code stays — Rule 4 dict-eq gate is locked, NOT modified by this spec.
- ⛔ Phase 2B per-category decisions defer to chat 2 Phase 2B scoping spec (applies §4 matrix).
- ⛔ Foundation infrastructure investment (~3 weeks) requires engineering lead + PM go-ahead — NOT triggered by this spec.
- ⛔ Phase 2A retroactive migration explicitly NOT recommended without strong business trigger (per §5.3 cost analysis + §6 trigger criteria).
- ⛔ Customer-facing impact: ZERO — this spec is internal engineering decision-support.

---

## 12. Sign-off

Before this spec influences Phase 2B per-category gate selection, reviewed by:

- [ ] Engineering organizer (matrix + cost estimates acceptable)
- [ ] chat 2 (Phase 2B scoping spec author — matrix applicable to chat 2 spec)
- [ ] chat 1 (Phase 2A retrospective author — Phase 2A historical accuracy verified)
- [ ] PM / architect lead (decision authority assignments + Phase 3+ trigger criteria acceptable)

Sign-off recorded in PR description when this spec merges main.

---

## 13. Appendix: Phase 2A 12 Rules byte-shape scope

Reference table summarizing each Rule's strict-byte capability:

| Rule | Topic | dict-eq scope | strict-byte scope |
|---|---|---|---|
| 1 | Null fallback `is not None` | semantic correctness | not byte-shape |
| 2 | WEEK calendar year | semantic correctness | not byte-shape |
| 3 | Function signature mirror | code consistency | not byte-shape |
| 4 | Decimal serialization | ✅ Pattern A/A2 accept | ❌ would require helper change |
| 5 | SELECT * SQL helpers | code consistency | not byte-shape |
| 6 | None-check precondition | semantic correctness | not byte-shape |
| 7 | Decimal threshold compare | semantic correctness | not byte-shape |
| 8 | Map.of hash key order | ✅ enforced via golden | ✅ same |
| 9 | Lombok null/getter quirks | ✅ enforced via golden | ✅ same |
| 10 | BigDecimal divide.multiply | semantic + intermediate scale | ✅ if scale matches |
| 11 | LocalDateTime microsecond | ✅ `_java_isoformat` helper | ✅ same |
| 12 | String.format HALF_UP | ✅ `_format_decimal_half_up` | ✅ same |

**Conclusion**: 11 of 12 Rules already byte-strict scoped within Phase 2A. Only Rule 4 (Decimal serialization) is the dict-eq tolerance window. Foundation investment (`_decimal_preserve_scale` helper) addresses this single gap.

This means Phase 2B+ strict-byte adoption is **incremental from Phase 2A foundation**, not greenfield rewrite.

---

**End of Strict-Byte Gate Phase 3+ Adoption Decision Spec**
