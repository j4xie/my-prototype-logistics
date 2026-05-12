# R_*_REAL Chains Parity-Gate — Full 11-Chain Sweep (T6.6 Phase B Sub-A, Wave 7 Close)

**Date**: 2026-05-12
**Author**: parity-real-run worktree (chat3, full-sweep follow-up)
**Branch**: `feat/r-real-full-sweep`
**Trigger**: Convert PR #398's "inferred-safe" claim into empirical proof — exhaustively sweep the remaining 11 `R_*_REAL` chains not sampled in the representative run.
**Predecessor doc**: [`docs/qa-audits/2026-05-12-r-real-chains-parity-evidence.md`](2026-05-12-r-real-chains-parity-evidence.md) (PR #398 — 3 representative chains, 24/24 PASS)

---

## 0. TL;DR

| Dimension | Result |
|---|---|
| Endpoints exercised | **88 / 88** (11 factories × 8 analysisTypes) |
| Match rate (dict-eq with `--tolerate-divergence-patterns B`) | **88 / 88 at 100.0%** |
| REAL_BUG count | **0** |
| PATTERN_A count | **0** |
| PATTERN_B count (aggregate, all tolerated as structural) | **1001** (= 91 × 11 — perfect per-chain homogeneity) |
| Endpoints in Pattern B context | **88 / 88** |
| Java HTTP status | 200 on all 88 (after blue-green port correction — see §6) |
| Python HTTP status | 200 on all 88 |
| **Combined coverage with PR #398** | **14 / 14 R_*_REAL chains, 112 / 112 endpoint-runs, REAL_BUG = 0** |
| **Verdict** | 🎯 **Phase 2B wave 7 fully closed — empirical 14/14, no inference remaining** |

### What this means

✅ The **full 14-chain R_*_REAL surface is LIVE-confirmed in parity, end-to-end.** PR #398's representative sample (3 chains) said "remaining 11 inferred safe by shape-homogeneity"; this sweep converts that inference into evidence. Every PB count per chain is **identical** to the PR #398 sample (`91 / chain`) — confirming Pattern B is shape-structural (Java factory-mock vs Python restaurant envelope) and **not data-dependent**.

🟢 T6.6 cutover gate for the 14 R_*_REAL chains is **parity-unblocked across the full surface**. No factory-specific risk remaining; downstream gating items (customer comms / soak / rollback / Sub-ETL-2c) are unchanged from PR #398 §4.

---

## 1. Setup

### 1.1 Sweep scope — the 11 chains not in PR #398

PR #398 sampled 3 representative chains (`R_ILTEATRO_REAL` / `R_QINGHUAJIAO_REAL` / `R_SHANGMA_HG_REAL`) and noted the remaining 11 as inferred-safe. This run tests every one of those 11:

| factory_id | type | Chinese name |
|---|---|---|
| `R_DONGMENKOU_REAL`     | RESTAURANT | 东门口 |
| `R_HONGDEJI_REAL`       | RESTAURANT | 鸿德记 |
| `R_HUOGUO_GENERIC_REAL` | RESTAURANT | 火锅 (generic) |
| `R_JINCHUAN_HG_REAL`    | RESTAURANT | 锦川火锅 |
| `R_JINRINIUSHI_REAL`    | RESTAURANT | 今日牛事 |
| `R_LINJIAYAN_REAL`      | RESTAURANT | 邻家宴 |
| `R_XIMAXIANG_REAL`      | RESTAURANT | 唏嘛香 牛肉面 |
| `R_XINBASHU_REAL`       | RESTAURANT | 鑫巴蜀 |
| `R_YONGHE_REAL`         | RESTAURANT | 永和豆浆 |
| `R_YOUZIYOUWEI_REAL`    | RESTAURANT | 有滋有味 |
| `R_YUJIUJING_REAL`      | RESTAURANT | 御九井 日料 (真实) ← post-PR-#395 rename |

11 chains × 8 analysisType cells = **88 endpoint-runs**.

### 1.2 Run state — blue-green port flip mid-cycle (recovered)

Between PR #398's run (~10:30 CST) and this 11-chain sweep, **Java blue-green flipped slots**. PR #398 ran against active blue on **10010**; by the start of this sweep, `cretas-backend.service` had gone inactive at **2026-05-12 10:31:34 CST** and `cretas-backend-bluegreen` was serving prod on **10020**.

First attempt with `JAVA_BASE=http://localhost:10010` returned **88/88 `verdict=java_error` "Connection refused"** — verified non-REAL_BUG via report metadata (`total_real_bugs=0`, `java_http=-1`). Recovery: switched to `JAVA_BASE=http://localhost:10020`, re-ran → **88/88 PASS at 100%**. See §6.

### 1.3 Harness invocation (recovered run)

Executed on server 47.100.235.168. Parity-gate scripts at `/tmp/parity-gate-r-real-full-sweep`:

```bash
JAVA_BASE=http://localhost:10020 \
PYTHON_BASE=http://localhost:8083 \
FACTORIES="R_DONGMENKOU_REAL R_HONGDEJI_REAL R_HUOGUO_GENERIC_REAL \
           R_JINCHUAN_HG_REAL R_JINRINIUSHI_REAL R_LINJIAYAN_REAL \
           R_XIMAXIANG_REAL R_XINBASHU_REAL R_YONGHE_REAL \
           R_YOUZIYOUWEI_REAL R_YUJIUJING_REAL" \
TOLERATE_PATTERNS=B \
REPORTS_DIR=/tmp/parity-gate-r-real-full-sweep-reports \
bash ./record-restaurant-goldens.sh
```

Reports landed at `reports/r-real-sweep-2026-05-12/` (88 JSON + 88 HTML).

---

## 2. Per-chain aggregate table

Every chain reports `match=true` on every one of its 8 endpoints. PB count is **constant at 91 per chain**:

| factory                  | endpoints | REAL | PA  | PB  | Bctx |
|---|---|---|---|---|---|
| `R_DONGMENKOU_REAL`       | 8 | 0 | 0 | 91 | 8/8 |
| `R_HONGDEJI_REAL`         | 8 | 0 | 0 | 91 | 8/8 |
| `R_HUOGUO_GENERIC_REAL`   | 8 | 0 | 0 | 91 | 8/8 |
| `R_JINCHUAN_HG_REAL`      | 8 | 0 | 0 | 91 | 8/8 |
| `R_JINRINIUSHI_REAL`      | 8 | 0 | 0 | 91 | 8/8 |
| `R_LINJIAYAN_REAL`        | 8 | 0 | 0 | 91 | 8/8 |
| `R_XIMAXIANG_REAL`        | 8 | 0 | 0 | 91 | 8/8 |
| `R_XINBASHU_REAL`         | 8 | 0 | 0 | 91 | 8/8 |
| `R_YONGHE_REAL`           | 8 | 0 | 0 | 91 | 8/8 |
| `R_YOUZIYOUWEI_REAL`      | 8 | 0 | 0 | 91 | 8/8 |
| `R_YUJIUJING_REAL`        | 8 | 0 | 0 | 91 | 8/8 |
| **TOTAL (11 chains × 8)** | **88** | **0** | **0** | **1001** | **88/88** |

### 2.1 Homogeneity observation

The PB count of **91 per chain is identical to** PR #398's three sampled chains (`R_ILTEATRO_REAL` / `R_QINGHUAJIAO_REAL` / `R_SHANGMA_HG_REAL` were 91 each → 273 total in §2.1 of the predecessor doc).

Per-analysisType breakdown (constant across all 14 chains now confirmed):

| analysisType | PB per chain | × 11 chains |
|---|---|---|
| `production_efficiency`  | 41 | 451 |
| `production_equipment`   |  4 |  44 |
| `production_oee`         |  3 |  33 |
| `production_overview`    | 17 | 187 |
| `quality_defect`         |  3 |  33 |
| `quality_fpy`            |  3 |  33 |
| `quality_overview`       | 17 | 187 |
| `quality_rework`         |  3 |  33 |
| **per-chain total**      | **91** | **1001** |

**This identical 91-per-chain count across all 14 R_*_REAL factories** is the strongest possible empirical evidence that Pattern B is shape-structural (schema asymmetry between Java factory mock and Python restaurant envelope) and **not data-dependent**. The PR #398 inference is now empirically homogeneous across the entire onboarded surface.

---

## 3. Diverge classification

Aggregate across all 88 endpoint reports:

| Bucket | Count | Meaning | Action |
|---|---|---|---|
| `REAL_BUG`                | **0**    | Genuine value/key/shape mismatch unattributable to known patterns | None — gate clean |
| `PATTERN_A` (int-collapse)| **0**    | `Decimal("100.00")` → `int(100)` | None |
| `PATTERN_A2` (scale-4)    | **0**    | `99.9900` → `99.99` trailing-zero loss | None |
| `PATTERN_B_STRUCTURAL`    | **1001** | Java factory-mock surface vs Python restaurant-envelope surface | Tolerated by `--tolerate-divergence-patterns B` per Sub-A spec §6.1 |
| `PATTERN_C` (placeholder) | 0        | (not auto-detected) | n/a |

### 3.1 Pattern B example — `production_R_YONGHE_REAL_oee.json` (typical)

```json
{
  "verdict": "match",
  "java_http": 200, "python_http": 200,
  "java_size": 5569, "python_size": 833,
  "dict_eq": {
    "match": true,
    "total_leaves": 9,
    "matched_leaves": 8,
    "pattern_b_context": true,
    "diverges": [],
    "tolerated_byte_diffs": [
      { "path": "data.tenantType", "java": "<missing>",     "python": "RESTAURANT",      "classification": "PATTERN_B_STRUCTURAL" },
      { "path": "data.metrics",    "java": "<list len=10>", "python": "<list len=3>",    "classification": "PATTERN_B_STRUCTURAL" },
      { "path": "data.trendChart", "java": "<dict>",        "python": null,              "classification": "PATTERN_B_STRUCTURAL" }
    ]
  }
}
```

Identical structural picture to PR #398 §3.1 (`production_R_ILTEATRO_REAL_oee.json`): Java factory mock emits `trendChart` + a 10-leaf factory metrics list; Python restaurant envelope replaces with `tenantType` + 3-metric (M1/M2/M3) shape. Detector fires `pattern_b_context=true` on 88/88; per-leaf classification correctly suppressed in favor of global-context flag. `diverges` is empty (no REAL_BUG attribution).

### 3.2 Why 1001 PB total is healthy

PB count = **structural surface delta × factory count = 91 × 11**. Every one of these 1001 diverges has `classification: PATTERN_B_STRUCTURAL`. The exact homogeneity of `91 per chain` across all 11 chains (and identical to PR #398's 91 per chain for the other 3) is the conclusive evidence that the inferred-safe claim holds: if data-dependent shape divergence existed for any one chain, its PB count would deviate from 91. None do.

---

## 4. Verdict

🎯 **Phase 2B wave 7 (R_*_REAL onboarding) — FULLY CLOSED, no inference remaining**

| Gate | PR #398 (3 sampled) | **This PR (11 swept)** | **Combined (14/14)** |
|---|---|---|---|
| Onboard ✅                  | 14 rows in `factories` | (same) | 14/14 LIVE |
| Tenant detection ✅         | 200 on 24/24 | **200 on 88/88** | 200 on 112/112 |
| Python restaurant dispatch ✅ | 24/24 healthy envelope | **88/88 healthy envelope** | 112/112 healthy |
| REAL_BUG = 0 ✅             | 0 / 24 | **0 / 88** | **0 / 112** |
| PB homogeneity              | 91/chain × 3 = 273 | **91/chain × 11 = 1001** | **91/chain × 14 = 1274** |

🟢 **T6.6 cutover gate for the full R_*_REAL surface is parity-unblocked empirically, not by inference.**

### Items unchanged from PR #398 §4

| Gate | Owner | State |
|---|---|---|
| Sub-ETL-2c fact-table fill (14 chains)         | data-ops / ETL | Pending (independent of parity) |
| Customer comms sign-off                         | Steve / sales  | Pending |
| 30-day soak per active-E2E rule                 | Operations     | In flight |
| Rollback rehearsal                              | chat-AB / org  | Pending |
| Java tenant-aware dispatch (eliminate PB diff)  | Phase 3+       | Out of scope |

---

## 5. Combined-coverage summary table (PR #398 + this PR)

Full 14-chain × 8-endpoint matrix — every cell `match=true`, every cell PB-tolerated, zero REAL_BUG:

| factory | sampled in | production: oee/eff/equip/over | quality: def/fpy/rew/over | per-chain status |
|---|---|---|---|---|
| `R_ILTEATRO_REAL`        | **PR #398** | 4/4 ✅ | 4/4 ✅ | 8/8 PASS, PB=91 |
| `R_QINGHUAJIAO_REAL`     | **PR #398** | 4/4 ✅ | 4/4 ✅ | 8/8 PASS, PB=91 |
| `R_SHANGMA_HG_REAL`      | **PR #398** | 4/4 ✅ | 4/4 ✅ | 8/8 PASS, PB=91 |
| `R_DONGMENKOU_REAL`      | this PR     | 4/4 ✅ | 4/4 ✅ | 8/8 PASS, PB=91 |
| `R_HONGDEJI_REAL`        | this PR     | 4/4 ✅ | 4/4 ✅ | 8/8 PASS, PB=91 |
| `R_HUOGUO_GENERIC_REAL`  | this PR     | 4/4 ✅ | 4/4 ✅ | 8/8 PASS, PB=91 |
| `R_JINCHUAN_HG_REAL`     | this PR     | 4/4 ✅ | 4/4 ✅ | 8/8 PASS, PB=91 |
| `R_JINRINIUSHI_REAL`     | this PR     | 4/4 ✅ | 4/4 ✅ | 8/8 PASS, PB=91 |
| `R_LINJIAYAN_REAL`       | this PR     | 4/4 ✅ | 4/4 ✅ | 8/8 PASS, PB=91 |
| `R_XIMAXIANG_REAL`       | this PR     | 4/4 ✅ | 4/4 ✅ | 8/8 PASS, PB=91 |
| `R_XINBASHU_REAL`        | this PR     | 4/4 ✅ | 4/4 ✅ | 8/8 PASS, PB=91 |
| `R_YONGHE_REAL`          | this PR     | 4/4 ✅ | 4/4 ✅ | 8/8 PASS, PB=91 |
| `R_YOUZIYOUWEI_REAL`     | this PR     | 4/4 ✅ | 4/4 ✅ | 8/8 PASS, PB=91 |
| `R_YUJIUJING_REAL`       | this PR     | 4/4 ✅ | 4/4 ✅ | 8/8 PASS, PB=91 |
| **TOTAL** | **14 / 14** | **56 / 56** | **56 / 56** | **112 / 112 PASS, REAL_BUG=0, PB=1274** |

Plus PR #386 (May 11): `RES_3101_009` + `R_GML_DEMO` 16/16 PASS → restaurant-tenant universe end-to-end clean.

---

## 6. Operational gotcha — Java blue-green port flip mid-run

### What happened

PR #398's run finished against active blue on **10010** at ~10:30 CST. By the start of this sweep, blue-green had cycled: `cretas-backend.service` went inactive at **2026-05-12 10:31:34 CST**, and `cretas-backend-bluegreen` (10020) was serving prod traffic via nginx — i.e. **10020 was the new active slot**.

First attempt at the 11-chain sweep used `JAVA_BASE=http://localhost:10010` (the PR #398 value). Result: **88/88 `verdict=java_error` "Connection refused"**. Critically, this was **not 88 REAL_BUGs** — the parity reports correctly recorded:

```
java_http: -1, java_error: "Connection refused"
total_real_bugs: 0
```

Recovery: switched to `JAVA_BASE=http://localhost:10020` → 88/88 PASS at 100%. Total round-trip cost: one re-run (~3 minutes wall time).

### Recommended hardening

The harness should not rely on the caller knowing which blue-green slot is active. Two options:

1. **Auto-detect active port**: probe both 10010 and 10020, route to whichever is `up`. Cheap (2 HEAD calls).
2. **Hit nginx-routed external URL**: `http://47.100.235.168:10010` (or 10020 — nginx already abstracts the slot). External URL always points at active slot per `reference_blue_green_java_deploy.md`.

Filed as harness improvement (non-blocking for this PR). For now, runners must check active slot manually:

```bash
ssh root@47.100.235.168 "systemctl is-active cretas-backend cretas-backend-bluegreen"
# pick the one returning "active"
```

---

## 7. PR chain — full lineage

| PR | Author | Role |
|---|---|---|
| PR #350 / #352 / #358 | chat-A1/A2/chat4 | Restaurant skeleton + production + quality impl |
| PR #359 / #360 / #365 / #368 / #369 | chat3/1/4 | Parity-gate framework + router + tenant.py P0 fix |
| PR #377 / #378 | spec amend / chat3 | Original R_*_REAL onboarding migration + Pattern B classifier |
| PR #386 | chat3 (May 11) | First real-prod parity run — `RES_3101_009` + `R_GML_DEMO` (16/16) |
| PR #394 | chat3 (May 12) | Fixed PR #377's migration-directory bug (`migration-pg-converted/` → `db/flyway/`) |
| PR #395 | chat1 (May 12) | P0 name-collision fix for `R_YUJIUJING_REAL` (`御九井 日料` → `御九井 日料 (真实)`) |
| PR #398 | chat3 (May 12) | **R_*_REAL parity, 3 representative chains** (24/24 PASS, 11 inferred-safe) |
| **PR (this audit)** | **chat3 (May 12)** | **R_*_REAL parity, remaining 11 chains** (88/88 PASS) — **wave 7 fully closed** |

---

## 8. Reproducibility

Repeatable end-to-end. Substitute `JAVA_BASE` per current active blue-green slot (see §6).

### 8.1 11-chain sweep (this run)

```bash
JAVA_BASE=http://localhost:10020 \
PYTHON_BASE=http://localhost:8083 \
FACTORIES="R_DONGMENKOU_REAL R_HONGDEJI_REAL R_HUOGUO_GENERIC_REAL \
           R_JINCHUAN_HG_REAL R_JINRINIUSHI_REAL R_LINJIAYAN_REAL \
           R_XIMAXIANG_REAL R_XINBASHU_REAL R_YONGHE_REAL \
           R_YOUZIYOUWEI_REAL R_YUJIUJING_REAL" \
TOLERATE_PATTERNS=B \
REPORTS_DIR=/tmp/parity-gate-r-real-full-sweep-reports \
bash ./record-restaurant-goldens.sh
```

### 8.2 Full 14-chain variant (PR #398 + this PR combined)

```bash
JAVA_BASE=http://localhost:10020 \
PYTHON_BASE=http://localhost:8083 \
FACTORIES="R_ILTEATRO_REAL R_QINGHUAJIAO_REAL R_SHANGMA_HG_REAL \
           R_DONGMENKOU_REAL R_HONGDEJI_REAL R_HUOGUO_GENERIC_REAL \
           R_JINCHUAN_HG_REAL R_JINRINIUSHI_REAL R_LINJIAYAN_REAL \
           R_XIMAXIANG_REAL R_XINBASHU_REAL R_YONGHE_REAL \
           R_YOUZIYOUWEI_REAL R_YUJIUJING_REAL" \
TOLERATE_PATTERNS=B \
REPORTS_DIR=/tmp/parity-gate-r-real-full-14-reports \
bash ./record-restaurant-goldens.sh
```

Exit code `0` if all 88 (or 112) endpoints clear the gate. Inspect `reports/<run_id>/<key>.html` for any failing detail. If `verdict=java_error` "Connection refused" across all endpoints → blue-green slot flipped, swap `JAVA_BASE` between 10010 / 10020 and re-run.

---

**End of R_*_REAL full-sweep audit.** Third real-prod parity run in the wave-7 sequence (PR #386 → PR #398 → this PR): **14 / 14 R_*_REAL chains, 112 / 112 endpoint-runs, REAL_BUG = 0**. PR #398 §5's inferred-safe claim is now empirically confirmed. **Phase 2B wave 7 fully closed.**
