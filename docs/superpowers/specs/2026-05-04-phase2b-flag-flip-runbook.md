# Phase 2B Flag Flip — Deploy Runbook (operational companion)

**Date**: 2026-05-04
**Author**: post-PR #71 (retrospective) + #72 (drill-down PR-A) standby session
**Companion to**: [PR #29 Phase 3 AI migration rollout plan](../plans/2026-05-01-phase3-ai-migration-rollout.md) (197 LOC, the WHAT)
**Sister doc**: [PR #62 T6 cutover deploy runbook](2026-05-02-phase2a-t6-deploy-runbook.md) — same structure, different scope (nginx vs flag flip)
**This doc scope**: the HOW — actual `AI_USE_PYTHON_MATCHER` flag flip commands, stage-by-stage execution, GO/NO-GO numerical criteria, rollback procedures, monitoring panel refs, LLM-router baseline collection, printable operator checklist

> **Document boundary** (do not duplicate):
> - PR #29 owns: rollout strategy, soak windows, kill-switch design, Phase 3.A/B/C cleanup ordering, action items.
> - This runbook owns: command sequences, threshold values, CSV formats, panel IDs, day-by-day operator checklist, baseline-collection script extensions.
>
> If divergent, **PR #29 wins** for strategy; this runbook may be tuned during execution.

---

## 1. 背景 + Pre-flight prerequisites

### 1.1 What this runbook is

Phase 2B-β ([PR #24, commit `fb92f4b01`, merged 2026-04-30](https://github.com/j4xie/my-prototype-logistics/pull/24)) **dark-shipped** the Python AI orchestration layer (SemanticRouter / Calibrator / IntentScorer / RAG / Learners) into prod. Today it is wired but never called: `ai.use-python-matcher=false` is the runtime default at `application.properties:298`, and `AIIntentServiceImpl.java:88-89` reads `@Value("${ai.use-python-matcher:false}")` into a `private boolean usePythonMatcher` field that gates the Python branch at line 244-281.

This runbook covers the operator workflow for **flipping that flag to true**, in 4 stages, with kill-switch rollback. It does **not** cover Phase 3.A/B/C cleanup — that is a separate execution plan owned by [PR #63 Phase 3 cleanup design](2026-05-02-phase3-cleanup-design.md).

### 1.2 Doc relationship

```
PR #29 rollout plan ────┐
                        │
                        ├──► flag flip decision (single source of truth for timing + soak + kill-switch)
                        │
This runbook ───────────┘
```

PR #29 §3.2 reads "在 prod Java 上设置环境变量 ... systemctl restart cretas-backend". This runbook §3.2 reads "Run these exact commands in this exact order with these exact GO/NO-GO thresholds". Complementary, not redundant.

### 1.3 Phase 2B-β ship + soak status (as of 2026-05-04)

| Requirement | Status | Evidence |
|---|---|---|
| Phase 2B-α merged main | ✅ | PR #16 commit `38b545d0c`, 2026-04-30 |
| Phase 2B-α backlog merged | ✅ | PR #19 commit `2d8a8a272`, 2026-04-30 |
| Phase 2B-β merged main | ✅ | PR #24 commit `fb92f4b01`, 2026-04-30 |
| Auth fix shipped | ✅ | PR #26 commit `fdb5f3c48`, 2026-04-30 |
| ≥48h prod soak post-β ship | ✅ | 2026-04-30 → 2026-05-04 = 4 days |
| Flag still `false` in prod | ✅ | grep `.env.prod | grep AI_USE_PYTHON_MATCHER` → unset (defaults false) |
| `cretas-python.service` healthy on 47 | (verify) | `systemctl status cretas-python` should show active |
| `/api/ai/intent/match` smoke green via SSH tunnel | (verify) | per §1.5 |

**Cutover blocker**: dashboard panels (§5.1) + Prometheus alerts (§5.2) must exist BEFORE Stage 2.1.

### 1.4 Hard prereqs gating Stage 2 (canary)

PR #29 §3.1 notes that the flag is a **global boolean** — there is no per-factory whitelist field. To do a 10% canary (Stage 2) or 50% (Stage 3), one of two paths must be chosen:

**Path A (recommended per PR #29 §3.1)** — Java refactor adds `ai.python-matcher-factories` whitelist:
```java
@Value("${ai.python-matcher-factories:}")
private List<String> pythonMatcherFactories;  // empty = global use of usePythonMatcher
```
Then `AIIntentServiceImpl.java:245` becomes:
```java
boolean factoryEligible = pythonMatcherFactories.isEmpty()
    || pythonMatcherFactories.contains(factoryId);
if (usePythonMatcher && factoryEligible && pythonClient != null && ...) { ... }
```
Estimated effort: ~2-3h (single Java PR + IntentParityTest + property doc). **Must be merged + deployed to prod BEFORE Stage 2.1.**

**Path B (simplified, per PR #29 §3.2)** — Skip Stages 2 and 3, jump from Stage 1 (0%) to Stage 4 (100%) at off-peak time, rely on kill switch.

This runbook documents **Path A** as primary (4 distinct stages mirror T6 deploy runbook structure). Path B is a fallback if the whitelist refactor cannot be sequenced before flag flip.

### 1.5 Python `/api/ai/intent/match` ready check

Before Stage 1 starts, verify Python service ready:

```bash
# Check 1: systemd healthy on prod port 8083
ssh root@47.100.235.168 "systemctl status cretas-python --no-pager"
# Expect: Active: active (running)

# Check 2: orchestrator init logged tier_selector=disabled (β default)
ssh root@47.100.235.168 "grep -i 'AI orchestrator\|tier_selector' /www/wwwroot/cretas/python-prod.log | tail -10"
# Expect: line containing 'tier_selector=disabled' OR no startup error

# Check 3: /api/ai/intent/match smoke from same host (avoids public 443 since SG closed)
JWT_PROD=$(ssh root@47.100.235.168 "cat /www/wwwroot/cretas/.env.prod | grep '^JWT_SECRET=' | cut -d= -f2-")
TOKEN=$(JWT_SECRET="$JWT_PROD" python3 -c "
import jwt,time,os
print(jwt.encode({
    'userId':1,'username':'flagflip-smoke',
    'factoryId':'F001','role':'factory_super_admin',
    'exp':int(time.time())+3600
}, os.environ['JWT_SECRET'], algorithm='HS256'))
")
ssh root@47.100.235.168 "curl -sS -X POST http://localhost:8083/api/ai/intent/match \
  -H 'Authorization: Bearer $TOKEN' \
  -H 'X-Internal-Secret: \$INTERNAL_API_SECRET' \
  -H 'Content-Type: application/json' \
  -d '{\"query\":\"查看本月销售额\",\"factoryId\":\"F001\",\"role\":\"factory_super_admin\"}' | jq '.intentCode, .confidence, .timingMs'"
# Expect: non-null intentCode, confidence>=0.7, timingMs object with router/semantic fields
```

### 1.6 LLM router baseline metrics — collect 1 week before Stage 1

The numerical GO/NO-GO criteria in §3 (Stages 2/3/4) reference **Java in-process matcher baseline** (e.g. "Python p99 ≤ Java baseline p99 + 500ms"). Baseline must be captured BEFORE flag flip. Use the script extension in §6.

Data needed (T-7d → T-1d):
- `/api/ai/intent/match` is the post-flip endpoint, but pre-flip baseline is captured via Java internal metric `intent_match_duration_seconds` (Phase 2B-α T24 micrometer counter) — not via end-user HTTP path
- Per-stage hit count: STAGE_1_EXACT, STAGE_2_PHRASE, STAGE_3_REGEX, STAGE_4_KEYWORD, STAGE_5_SEMANTIC, STAGE_6_CLASSIFIER, STAGE_7_FUSION, STAGE_8_LLM
- Java cache hit rate (`intent_cache_hits_total`)
- Java fallback frequency (per PR #29 §2.2 metric: `Python returning empty` count — should be 0 pre-flip since Python never called)

**Required volume**: ≥10000 samples per day across all factories (typical daily intent traffic). Samples below 1000/day per individual stage produce unreliable percentiles; aggregate across stages or skip stage-level gating.

---

## 2. 实际 flag flip 命令

### 2.1 Current state (flag false, Python dark-shipped)

**On server 47** (`/www/wwwroot/cretas/.env.prod`):
```bash
# (no AI_USE_PYTHON_MATCHER line — defaults to false via @Value("${ai.use-python-matcher:false}"))
```

**Java behavior**: `AIIntentServiceImpl.recognizeIntentWithConfidence()` skips the Python branch entirely (line 245 short-circuits on `usePythonMatcher=false`), runs legacy in-process pipeline. Python `/api/ai/intent/match` is wired and healthy but receives 0 traffic.

### 2.2 Target state (flag true, all factories via Python)

**On server 47** (`/www/wwwroot/cretas/.env.prod`):
```bash
AI_USE_PYTHON_MATCHER=true
# Optional (Path A whitelist refactor):
# AI_PYTHON_MATCHER_FACTORIES=F001,F003,F999
```

**Java behavior**: cache check → Python `/api/ai/intent/match` → Python returns empty (or throws) → fallback to legacy pipeline. The Python branch becomes primary path.

### 2.3 The flip command (Stage 4 form, full prod)

```bash
ssh root@47.100.235.168
cd /www/wwwroot/cretas

# Backup .env.prod
TS=$(date +%Y%m%d_%H%M%S)
cp .env.prod .env.prod.bak.flagflip.$TS

# Append flag (or sed-modify if line exists)
if grep -q '^AI_USE_PYTHON_MATCHER=' .env.prod; then
    sed -i 's/^AI_USE_PYTHON_MATCHER=.*/AI_USE_PYTHON_MATCHER=true/' .env.prod
else
    echo "AI_USE_PYTHON_MATCHER=true" >> .env.prod
fi

# Verify
grep '^AI_USE_PYTHON_MATCHER=' .env.prod
# Expect: AI_USE_PYTHON_MATCHER=true

# Restart Java backend (systemd reads EnvironmentFile=.env.prod on start)
systemctl restart cretas-backend

# Wait for health (Spring Boot startup ~80s)
for i in {1..30}; do
    sleep 5
    if curl -sf http://localhost:10010/api/mobile/health > /dev/null; then
        echo "[$i*5s] Java backend up"; break
    fi
    echo "[$i*5s] still starting..."
done

# Confirm flag took effect (check startup log for the @Value resolution)
journalctl -u cretas-backend --since '2 min ago' | grep -i 'usePythonMatcher\|use-python-matcher'
# Expect: log line confirming usePythonMatcher=true OR no log line + see runtime behavior
```

### 2.4 Backup before each stage (mandatory)

```bash
ssh root@47.100.235.168
cd /www/wwwroot/cretas
TS=$(date +%Y%m%d_%H%M%S)
cp .env.prod .env.prod.bak.flagflip_stage{N}.$TS
ls -la .env.prod.bak.flagflip* | tail -5   # confirm backup created
```

Each stage (1, 2, 3, 4) creates its own timestamped backup. **Do not delete backups until Stage 4 + 30 days** — needed for §4 rollback.

### 2.5 Critical pitfalls

1. **systemd `Restart=on-failure` interaction**: `cretas-backend.service` is configured with `Restart=on-failure RestartSec=15`. If Spring Boot fails to read the new `.env.prod` line on restart (typo, file permissions), systemd will respawn 3× then `StartLimitBurst=3` triggers a 120s cooldown. Don't panic-edit the file repeatedly during cooldown — wait, then fix.

2. **`.env.prod` permissions**: must remain `chmod 600` (root-only). After edit, verify: `stat -c '%a' /www/wwwroot/cretas/.env.prod` → expect `600`. Wrong perms → systemd's `EnvironmentFile=` silently skips the file → flag stays false. (Per `.claude/rules/CREDENTIAL-MANAGEMENT.md`.)

3. **Blue-Green deploys reset the env**: any subsequent `./scripts/deploy/deploy-backend.sh --env prod` reads the `.env.prod` at deploy time. The flag persists across deploys, but a deploy in flight DURING flag flip can race. **Rule**: do not run a code deploy + flag flip in the same maintenance window. Flip first OR deploy first; never simultaneously.

4. **Python `INTERNAL_API_SECRET` must match**: Java→Python call passes `X-Internal-Secret` header. If Python's `INTERNAL_API_SECRET` (set via `cretas-python.service` Environment= line OR `.env.prod` if both share) drifts from Java's, every Python call returns 401, Java logs `Python returning empty`, fallback rate jumps to 100%. Per PR #29 §2.1 audit tech-debt — verify `INTERNAL_API_SECRET` byte-matches both sides.

5. **`AI_TIER_SELECTOR_ENABLED` is independent**: that env var is the β `LlmTierSelector` opt-in. **Do not flip both at once**. Stage 4 + 7d soak should run with `AI_TIER_SELECTOR_ENABLED=false` (default) to isolate flag-flip impact. Tier selector flip is a future separate stage.

---

## 3. 4-stage execution commands

### 3.1 Stage 1 — 0% Python (24h pre-flip baseline + Python health smoke)

**Trigger**: §1.3 ✅ + §1.4 Path chosen + §1.5 Python ready ✅ + §1.6 baseline started.

**Action**: NO flag change. Run a comparison sidecar that calls both Java legacy path AND Python `/api/ai/intent/match` with identical inputs, logs divergence.

```bash
ssh root@47.100.235.168

# Prepare query corpus (sample real production queries from past 7 days)
cat > /tmp/flagflip-stage1-queries.txt <<'EOF'
查看本月销售额
原料库存盘点
今天有多少订单待发货
F001 工厂质检报告
统计上周生产完成率
EOF

# Launch shadow comparison (script to be authored alongside flip; see §6.1)
nohup bash /www/wwwroot/cretas/scripts/flagflip-shadow-compare.sh \
    --duration 24h \
    --queries /tmp/flagflip-stage1-queries.txt \
    --interval 60 \
    --java-base http://localhost:10010 \
    --python-base http://localhost:8083 \
    --jwt-prod \
    --output /var/log/cretas-flagflip-stage1.log \
    > /tmp/flagflip-stage1.out 2>&1 &
echo "PID: $!"
disown
```

**24h checkpoint**: review `/var/log/cretas-flagflip-stage1.log`.

**GO criteria** (numerical):
- Total samples: ≥1440 (1/min × 24h × 1 query batch)
- intentCode match rate (Java vs Python): ≥99.0%
- Top-10 query corpus 100% intentCode match
- Python p99 ≤ Java baseline p99 + 500ms across the window
- 0 Python service restarts during window
- 0 Python 5xx errors
- 0 Java fallback events (since flag is still false; any "Python returning empty" log entries indicate code bug)

**NO-GO** triggers:
- Any intentCode mismatch in top-10 queries
- Overall intentCode match rate <99%
- Any Python 5xx
- Python p99 > Java + 500ms in >5% of intervals
- INTERNAL_API_SECRET mismatch (per §2.5 pitfall 4)

NO-GO action: STOP. File a P1 bug. Re-run Stage 1 only after fix shipped + ≥48h additional Phase 2B-β prod soak.

### 3.2 Stage 2 — 10% canary (whitelist: 1 factory, 24h soak)

**Trigger**: Stage 1 GO + Path A whitelist refactor merged & deployed + canary factory chosen.

**Pre-action**: pick canary factory. Selection criteria:
- Low intent traffic volume (<2k requests/day for `/api/ai/intent/match`-equivalent paths)
- Recent activity (active within past 7 days)
- Non-customer-facing if available (e.g. F999 test factory) OR low-blast-radius real factory
- Document chosen factory: `Stage 2 canary = <factory_id>` in handoff log

**Action** (Path A whitelist):

```bash
ssh root@47.100.235.168
cd /www/wwwroot/cretas
TS=$(date +%Y%m%d_%H%M%S)
cp .env.prod .env.prod.bak.flagflip_stage2.$TS

# Add both flag + whitelist
cat >> .env.prod <<EOF
AI_USE_PYTHON_MATCHER=true
AI_PYTHON_MATCHER_FACTORIES=F999
EOF

# Restart Java
systemctl restart cretas-backend

# Wait for health
for i in {1..30}; do sleep 5; if curl -sf http://localhost:10010/api/mobile/health > /dev/null; then echo "up"; break; fi; done

# Smoke from canary factory token
TOKEN_F999=$(JWT_SECRET="$JWT_PROD" python3 -c "...factoryId=F999...")
curl -sS -X POST http://localhost:10010/api/mobile/F999/ai/intent/match \
  -H "Authorization: Bearer $TOKEN_F999" \
  -d '{"query":"查看本月销售额"}' | jq '.intentCode, .timingMs'
# Expect: routerMs / semanticMs fields (Python path) NOT just stageHits (Java path)

# Smoke from non-canary factory (should still hit Java path)
TOKEN_F001=$(JWT_SECRET="$JWT_PROD" python3 -c "...factoryId=F001...")
curl -sS -X POST http://localhost:10010/api/mobile/F001/ai/intent/match \
  -H "Authorization: Bearer $TOKEN_F001" \
  -d '{"query":"查看本月销售额"}' | jq '.intentCode, .timingMs'
# Expect: Java timing fields (stageHits.STAGE_X) NOT routerMs
```

**Soak**: 24h.

**GO criteria** (numerical, applied to canary factory traffic only):
- Python error rate (5xx + Python-thrown business errors) <0.5%
- Python p50 <200ms across 24h
- Python p99 <2000ms across 24h
- Java fallback rate ("Python returning empty" + circuit-breaker open) <5%
- 0 user-reported issues for canary factory
- Java baseline (other factories): unchanged from §1.6 baseline (no spillover impact)
- IntentResultCache hit rate: trending upward (cold-start expected; first hour <10%, stabilizing >30% by 24h)

**NO-GO** triggers:
- Python error rate ≥0.5%
- Python p99 ≥2000ms in >5% of intervals
- Java fallback rate ≥10% sustained 1h
- ≥1 P1 user report
- Cache hit rate <10% at end of 24h (suggests Python broken or cache misconfigured)

NO-GO → §4 rollback procedure (sed back to false + restart, ~95s).

### 3.3 Stage 3 — 50% canary (whitelist expanded, 24h soak)

**Trigger**: Stage 2 GO.

**Action**: expand whitelist to 50% of factories by traffic. Method:

```bash
# Identify top 50% by past-30d intent traffic
# (run on prod DB or via metric query)
ssh root@47.100.235.168
psql -U cretas_user -d cretas_prod_db -c "
SELECT factory_id, COUNT(*) AS req_count
FROM intent_match_records
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY factory_id
ORDER BY req_count DESC
LIMIT 20;
"
# Pick factory IDs that aggregate to ~50% of total traffic

# Update whitelist (typically 5-10 factory IDs cover 50% by power-law distribution)
cd /www/wwwroot/cretas
TS=$(date +%Y%m%d_%H%M%S)
cp .env.prod .env.prod.bak.flagflip_stage3.$TS
sed -i 's/^AI_PYTHON_MATCHER_FACTORIES=.*/AI_PYTHON_MATCHER_FACTORIES=F999,F001,F003,F005,F042,F088/' .env.prod
systemctl restart cretas-backend
```

**Soak**: 24h. **GO/NO-GO**: same numerical thresholds as §3.2, applied to the larger sample (5-10 factories instead of 1). **Kill switch**: §4 rollback.

### 3.4 Stage 4 — 100% (full flip + 7-day soak)

**Trigger**: Stage 3 GO.

**Action**: remove whitelist constraint, flip flag globally.

```bash
ssh root@47.100.235.168
cd /www/wwwroot/cretas
TS=$(date +%Y%m%d_%H%M%S)
cp .env.prod .env.prod.bak.flagflip_stage4_pre.$TS

# Remove whitelist line entirely (empty whitelist == global use of usePythonMatcher per Path A code)
sed -i '/^AI_PYTHON_MATCHER_FACTORIES=/d' .env.prod
# (AI_USE_PYTHON_MATCHER=true line stays from Stage 2)

systemctl restart cretas-backend

# Wait + smoke from a factory NOT in Stage 3's whitelist
for i in {1..30}; do sleep 5; if curl -sf http://localhost:10010/api/mobile/health > /dev/null; then echo "up"; break; fi; done
TOKEN_NEW=$(JWT_SECRET="$JWT_PROD" python3 -c "...factoryId=F999_new_factory...")
curl -sS http://localhost:10010/api/mobile/F999_new/ai/intent/match -H "Authorization: Bearer $TOKEN_NEW" -d '{"query":"测试"}' | jq '.timingMs'
# Expect: Python timing fields (routerMs / semanticMs)
```

**Soak**: 7 days extended observation.

**GO criteria** (gating Phase 3.A cleanup entry per PR #63):
- 7-day Python uptime: 100% (no service restarts other than scheduled deploys)
- 7-day error rate: <0.5% rolling average
- 7-day p99 latency: ≤Java baseline p99 + 200ms (tightened from +500ms; stable steady-state)
- 7-day Java fallback rate: <2% rolling average (Python should be primary path; high fallback = Python coverage gap)
- 0 P0/P1 user reports
- 0 stage-8 LLM call rate spike (`AI_TIER_SELECTOR_ENABLED=false` keeps stage-8 below 30% per PR #29 §2.2)
- IntentResultCache hit rate: ≥40% steady-state by Day 3

If 7d GO: schedule **Phase 3.A** (DashScopeClient SmartBI-path consumer migration) per PR #63 §2.

---

## 4. Rollback execution

### 4.1 Trigger detection — how to spot in real time

Detection methods (run continuously during Stage 2/3/4):

```bash
# Method 1: Java log tail for Python failure indicators
ssh root@47.100.235.168 "tail -f /www/wwwroot/cretas/cretas-prod.log | grep -E 'Python returning empty|PythonAiMatcherClient.*ERROR|circuit.breaker.*open'"
# If lines flood (>1/sec sustained for 1min), trigger §4.2.

# Method 2: Python service status
ssh root@47.100.235.168 "systemctl status cretas-python --no-pager | head -3"
# If "Active: failed" or repeated restart, trigger §4.2.

# Method 3: Grafana dashboard (see §5)
# Open dashboard panel "Phase 2B flag flip — Python match latency p99"
# If p99 > 3000ms for ≥5min, trigger §4.2.

# Method 4: Java fallback rate
ssh root@47.100.235.168 "tail -10000 /www/wwwroot/cretas/cretas-prod.log | grep -c 'Python returning empty'"
# Numerator. Compare to total /api/ai/intent/match log entries (denominator).
# If ratio >30% sustained 5min, trigger §4.2.
```

PR #29 §3.3 lists authoritative trigger thresholds (p99>3s for 5min; error rate>2% for 5min; fallback>30% for 5min). This runbook adds the detection one-liners.

### 4.2 Rollback commands (~95s target — JVM restart bound)

```bash
ssh root@47.100.235.168
cd /www/wwwroot/cretas

# Single-line revert (preserves whitelist line if present, just flips main flag)
sed -i 's/^AI_USE_PYTHON_MATCHER=true$/AI_USE_PYTHON_MATCHER=false/' .env.prod

# Or full restore from backup (if multiple stages need unwind)
# LATEST_BAK=$(ls -t .env.prod.bak.flagflip* | head -1)
# cp "$LATEST_BAK" .env.prod

# Restart (~95s recovery: 15s systemd + 80s Spring Boot startup)
systemctl restart cretas-backend

# Wait + verify
for i in {1..30}; do
    sleep 5
    if curl -sf http://localhost:10010/api/mobile/health > /dev/null; then
        echo "[$i*5s] backend healthy"; break
    fi
done

# Confirm rollback effective: a request should hit Java path, not Python
TOKEN=$(JWT_SECRET="$JWT_PROD" python3 -c "...")
curl -sS -X POST http://localhost:10010/api/mobile/F001/ai/intent/match \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"查看销售"}' | jq '.timingMs'
# Expect: Java fields (stageHits.STAGE_X) — NO routerMs / semanticMs
```

**Total recovery time**: ~95s from sed command to fully serving via Java legacy path.

### 4.3 Notification list (post-rollback, within 10 minutes)

| Recipient | Channel | Message template |
|---|---|---|
| Tech lead | Slack DM / phone | "Phase 2B flag flip Stage [N] rolled back at [HH:MM]. Trigger: [metric] > [threshold]. Java legacy pipeline restored." |
| Ops on-call | PagerDuty + Slack | (Same as above, plus) "AI intent matching now 100% Java in-process. Python orchestrator remains running but receives 0 traffic. RCA in 24h." |
| Customer-facing PM | Slack | "Brief AI intent matching cutover paused; Java backend continues to serve all traffic. No customer action needed." (only if Stage 3 or Stage 4) |
| Phase 2B-β authors | Slack channel | (Same as tech lead, plus) "Will need eyes on [metric/log signature that triggered rollback] for RCA." |

### 4.4 Post-rollback root cause + retry decision

Within 24h of rollback:
1. **RCA document**: open `docs/incidents/2026-XX-XX-flagflip-rollback-stage[N].md`. Include: stage, trigger metric + actual values, suspected root cause, fix plan, retry timing.
2. **Fix landed** (PR with regression test if applicable). Most likely candidates: Python orchestrator bug, INTERNAL_API_SECRET drift, `tier_selector` accidentally enabled, pgvector index regression.
3. **Retry decision** (tech lead + Phase 2B authors + ops):
   - Retry same stage: schedule once fix merged + ≥48h soak in test env
   - Retry from earlier stage: if confidence shaken, re-run Stage 1 shadow before retrying
   - Defer flip: if multiple rollbacks at same stage, escalate to Phase 2B retro

---

## 5. Monitoring

### 5.1 Grafana panels (build BEFORE Stage 1)

Panel set "Phase 2B flag flip" — to be created on `grafana.internal/d/phase2b-flagflip`. Required panels:

| Panel ID | Title | Query basis |
|---|---|---|
| flagflip-1 | Java in-process vs Python `/api/ai/intent/match` p50/p95/p99 — side-by-side | Java micrometer `intent_match_duration_seconds` vs Python prometheus `intent_match_duration_seconds` |
| flagflip-2 | Java fallback rate (Python empty + CB open) | Java log parser → metric `python_match_fallback_total / intent_total` |
| flagflip-3 | Python error rate (5xx + business 500) | Python prometheus `intent_match_errors_total / intent_match_total` |
| flagflip-4 | LLM router 4-provider fallback chain | Python prometheus `llm_provider_attempts_total{provider="aliyun_a|aliyun_b|zhipu|deepseek"}` — stacked bars |
| flagflip-5 | IntentResultCache hit rate | Java micrometer `intent_cache_hits_total / intent_cache_lookups_total` |
| flagflip-6 | Stage hit distribution (1-8) | Java micrometer `intent_stage_hits_total{stage}` — should shift toward "PYTHON_CACHE_HIT" + "PYTHON_MATCH" labels post-flip |
| flagflip-7 | Python service health (systemd state) | systemd unit `cretas-python` |
| flagflip-8 | Per-stage time-to-rollback histogram | systemd `cretas-backend` restart event log (post-flip audit) |

PR #29 §2.2 defines the same dashboard from a metrics-list lens. This runbook makes panel IDs concrete so an oncall can find them in 10 seconds.

### 5.2 Prometheus alert rules (build BEFORE Stage 2)

```yaml
# prometheus/alerts/phase2b-flagflip.yml

groups:
- name: phase2b-flagflip
  interval: 30s
  rules:

  - alert: FlagFlipPythonErrorRateHigh
    expr: |
      sum(rate(intent_match_errors_total[5m]))
      /
      sum(rate(intent_match_total[5m]))
      > 0.02
    for: 5m
    labels:
      severity: critical
      team: phase2b-flagflip
    annotations:
      summary: "Phase 2B Python intent match error rate >2% for 5min — rollback trigger"
      runbook_url: "https://github.com/j4xie/my-prototype-logistics/blob/main/docs/superpowers/specs/2026-05-04-phase2b-flag-flip-runbook.md#42-rollback-commands"

  - alert: FlagFlipPythonP99LatencyHigh
    expr: |
      histogram_quantile(0.99,
        sum(rate(intent_match_duration_seconds_bucket{job="cretas-python"}[5m]))
        by (le)
      ) > 3.0
    for: 5m
    labels:
      severity: critical
      team: phase2b-flagflip
    annotations:
      summary: "Phase 2B Python intent match p99 >3s for 5min — rollback trigger"

  - alert: FlagFlipJavaFallbackRateHigh
    expr: |
      sum(rate(python_match_fallback_total[5m]))
      /
      sum(rate(intent_match_total[5m]))
      > 0.30
    for: 5m
    labels:
      severity: critical
      team: phase2b-flagflip
    annotations:
      summary: "Phase 2B Java fallback rate >30% for 5min — Python coverage gap, rollback trigger"

  - alert: FlagFlipPythonServiceDown
    expr: up{job="cretas-python"} == 0
    for: 30s
    labels:
      severity: critical
      team: phase2b-flagflip
    annotations:
      summary: "Phase 2B Python service is DOWN — Java will fallback 100%, no user impact but alert immediately"
```

If `intent_match_*` metrics aren't yet exposed, add the micrometer/prometheus instrumentation BEFORE Stage 1. (One-time setup per PR #29 §2.2; not a per-stage task.)

### 5.3 Per-stage monitoring cadence

| Stage | Cadence | Operator |
|---|---|---|
| Stage 1 (24h shadow, no flip) | Real-time tail of `/var/log/cretas-flagflip-stage1.log`; review every 4h | Cutover lead |
| Stage 2 (24h, 1 factory) | Real-time first 1h, then 1h interval review for next 23h | Cutover lead + ops on-call |
| Stage 3 (24h, 50%) | 1h interval throughout | Cutover lead + ops on-call |
| Stage 4 (7d, 100%) | First 24h: 1h interval. Days 2-7: daily 9am check + alerts on-call | Ops on-call (daily); cutover lead (alert response) |
| Post-Stage 4 (steady state) | Standard daily oncall + alerts | Ops |

---

## 6. LLM-router baseline collection (extension of PR #66 tooling)

PR #66 (`scripts/baseline-java-metrics.sh` + `scripts/lib/baseline-aggregate.py`) is the T6 pre-cutover Java HTTP latency baseline collector for SmartBI analysis endpoints. **This Phase 2B runbook extends that pattern** to capture pre-flip Java in-process matcher metrics + LLM router 4-provider behavior.

### 6.1 Script outline — `scripts/baseline-java-intent-matcher.sh` (new, ~200 LOC)

Differences from PR #66 script:
- Source endpoint is **internal Java micrometer** at `/actuator/prometheus` (not user-facing HTTP); uses Java backend's exposed prometheus scrape endpoint
- Captures per-stage hit counts + cache hit rate + duration histograms (not just p50/p99 latency)
- Captures **Python-side baseline simultaneously** (shadow run): hits Python `/api/ai/intent/match` with same query corpus, logs side-by-side dict-eq for shadow `intentCode` divergence detection
- Output: 2 CSVs (`baseline-java-intent-YYYYMMDD.csv` + `baseline-python-intent-YYYYMMDD.csv`) + 1 dict-eq divergence log

```bash
#!/usr/bin/env bash
# scripts/baseline-java-intent-matcher.sh
# Capture pre-flip Java intent matcher baseline + Python shadow comparison.

set -euo pipefail

QUERIES_FILE="${QUERIES_FILE:-/tmp/flagflip-baseline-queries.txt}"
OUTPUT_DIR="${OUTPUT_DIR:-/var/log}"
INTERVAL_SEC="${INTERVAL_SEC:-60}"
DURATION_SEC="${DURATION_SEC:-604800}"  # 1 week
JWT_SECRET="${JWT_SECRET:?required}"
INTERNAL_SECRET="${INTERNAL_SECRET:?required}"
JAVA_BASE="${JAVA_BASE:-http://localhost:10010}"
PYTHON_BASE="${PYTHON_BASE:-http://localhost:8083}"
FACTORY="${FACTORY:?required}"

CSV_JAVA="$OUTPUT_DIR/baseline-java-intent-$(date +%Y%m%d).csv"
CSV_PYTHON="$OUTPUT_DIR/baseline-python-intent-$(date +%Y%m%d).csv"
DIVERGENCE_LOG="$OUTPUT_DIR/baseline-divergence-$(date +%Y%m%d).log"

echo "timestamp_iso,query,java_intentCode,java_confidence,java_p99_ms,java_stageHit" > "$CSV_JAVA"
echo "timestamp_iso,query,python_intentCode,python_confidence,python_routerMs,python_semanticMs" > "$CSV_PYTHON"

# (... loop similar to PR #66 baseline-java-metrics.sh, but with per-query-batch shadow comparison)
```

### 6.2 Aggregation reuses PR #66 helper

```bash
# Aggregate after run completes (use PR #66 baseline-aggregate.py with --endpoint-filter)
python3 scripts/lib/baseline-aggregate.py \
    --input /var/log/baseline-python-intent-20260510.csv \
    --output /var/log/baseline-python-intent-summary-20260510.csv \
    --endpoint-filter "intent_match"
```

PR #66's aggregator (nearest-rank percentile, per-endpoint p50/p95/p99/error/qps) works as-is. The CSV columns are different (no `endpoint` field for intent matcher, but the script accepts a custom column via `--latency-column`).

### 6.3 Divergence log format

```text
2026-05-08T09:00:01+00:00 query="查看本月销售额" factory=F001 java=SALES_QUERY python=SALES_QUERY  -> MATCH
2026-05-08T09:00:02+00:00 query="今天有多少订单" factory=F001 java=ORDER_COUNT python=ORDER_QUERY  -> MISMATCH (P1 — investigate)
```

A MISMATCH count >1% of total samples is a Stage 1 NO-GO trigger (per §3.1).

---

## 7. Operator checklist (printable)

Each subsection is a single page when printed. Operator initials + timestamp on each item.

### 7.1 Pre-flip (T-1 week, T-1 day, T-0)

#### T-1 week (Stage 0 + 7 days = T-7d)

```
[ ] Phase 2B-β prod soak ≥48h (β shipped 2026-04-30; eligibility 2026-05-02+)    _____ / _____
[ ] Path chosen (A: whitelist refactor / B: simplified 0-100 + kill switch)      _____ / _____
[ ] If Path A: whitelist Java refactor PR merged + deployed prod                 _____ / _____
[ ] LLM-router baseline collection script (§6) deployed to server 47             _____ / _____
[ ] Baseline collection running (verified PID + log file)                        _____ / _____
[ ] Grafana dashboard "Phase 2B flag flip" created with all 8 panels (§5.1)      _____ / _____
[ ] Prometheus alert rules (§5.2) deployed to alertmanager                       _____ / _____
[ ] PagerDuty / Slack channel for flag-flip alerts subscribed by oncall          _____ / _____
[ ] INTERNAL_API_SECRET byte-match audit verified Java + Python (§2.5 pitfall 4) _____ / _____
[ ] AI_TIER_SELECTOR_ENABLED confirmed false in prod (§2.5 pitfall 5)            _____ / _____
```

#### T-1 day (T-1d)

```
[ ] LLM-router baseline collection completed (CSVs + aggregated summary present) _____ / _____
[ ] Baseline summary reviewed by tech lead (record p50/p99/error/cache-hit-rate) _____ / _____
[ ] Python /api/ai/intent/match smoke against current prod queries (§1.5)        _____ / _____
[ ] Cutover lead designated + on-call ops contact confirmed                      _____ / _____
[ ] Notification list (§4.3) reviewed and contact info up-to-date                _____ / _____
[ ] §2.3 flag flip command reviewed by sysadmin (sed regex, perms)               _____ / _____
[ ] Backup retention policy confirmed (≥30 days for `.env.prod.bak.flagflip*`)   _____ / _____
[ ] §4 rollback dry-run on test env (10011) — measure rollback time <100s        _____ / _____
```

#### T-0 (just before Stage 1)

```
[ ] All T-1d items closed                                                        _____ / _____
[ ] Phase 2A migration freeze announced (no `--env prod` deploys during window)  _____ / _____
[ ] Cutover lead pre-flight: review §3.1 Stage 1 commands                        _____ / _____
[ ] Operator runbook printed and on hand                                         _____ / _____
[ ] Slack thread for flag flip cutover created (live status updates)             _____ / _____
```

### 7.2 During cutover — 4-stage GO/NO-GO table

Initial each stage as completed; record GO/NO-GO decision + responsible lead.

```
Stage  | Start time | End time | Sample/threshold       | GO / NO-GO | Responsible | Notes
-------+-----------+----------+-------------------------+------------+-------------+----------
1 (0%) | _____      | _____     | match ≥99% / no Py 5xx  | __________ | ___________ | _________
2 (10%)| _____      | _____     | err <0.5% / p99 <2s    | __________ | ___________ | _________
       |           |          | / fallback <5%          |            |             |
3 (50%)| _____      | _____     | err <0.5% / p99 <2s    | __________ | ___________ | _________
       |           |          | / fallback <5%          |            |             |
4(100%)| _____      | _____     | err <0.5% / p99        | __________ | ___________ | _________
       |           |          | <Java+200ms / 7d        |            |             |
```

If NO-GO at any stage: §4 rollback executed. Record:
```
Rollback time: _________________________________
Trigger metric value: __________________________
Backup file restored: __________________________
RCA document path: _____________________________
Retry decision: ________________________________
```

### 7.3 Post-flip (T+1d, T+1w, T+1m)

#### T+1 day (after Stage 4 begin)

```
[ ] 24h alert review — any FlagFlip*Critical alerts fired?                       _____ / _____
[ ] Shadow comparison (if continued) divergence rate <1%                         _____ / _____
[ ] User-reported issues for AI intent matching: 0                               _____ / _____
[ ] Grafana panel review: Java fallback rate trending below 5%                   _____ / _____
[ ] IntentResultCache hit rate trending up (Day 1 ≥20%)                         _____ / _____
```

#### T+1 week (Stage 4 + 7 days = Stage 4 GO checkpoint)

```
[ ] Python service uptime: 100% (no restarts other than scheduled deploys)       _____ / _____
[ ] Error rate rolling 7d avg: <0.5%                                             _____ / _____
[ ] p99 latency rolling 7d: ≤Java baseline p99 + 200ms                           _____ / _____
[ ] Java fallback rate rolling 7d: <2%                                           _____ / _____
[ ] User issues filed for AI intent: 0 P0/P1                                     _____ / _____
[ ] IntentResultCache hit rate steady-state ≥40%                                 _____ / _____
[ ] Stage 4 GO confirmed → schedule Phase 3.A cleanup (per PR #63 §2)            _____ / _____
```

#### T+1 month

```
[ ] Phase 3.A cleanup PR shipped + 7d soaked (per PR #63 §1.4)                   _____ / _____
[ ] Old `.env.prod.bak.flagflip*` files older than 30 days: removed              _____ / _____
[ ] Flag flip retro doc filed: lessons learned / process improvements            _____ / _____
[ ] Grafana panels for flag flip archived (read-only, kept for historical ref)   _____ / _____
[ ] Phase 2B flag flip marked DONE in project tracker                            _____ / _____
[ ] Consider scheduling AI_TIER_SELECTOR_ENABLED separate enablement (next flip) _____ / _____
```

---

## 8. References

- [PR #29 Phase 3 AI migration rollout plan](../plans/2026-05-01-phase3-ai-migration-rollout.md) — strategy, soak windows, kill-switch design, Phase 3.A/B/C scope, action items
- [PR #62 T6 cutover deploy runbook](2026-05-02-phase2a-t6-deploy-runbook.md) — sister structure (8-section doc-only ops companion), nginx scope vs this flag-flip scope; reuse the operator-checklist + monitoring pattern
- [PR #63 Phase 3 cleanup design](2026-05-02-phase3-cleanup-design.md) — what happens AFTER 7d Stage 4 GO (DashScope SmartBI consumer migration → Java analysis impl deletion → flag removal)
- [PR #66 T6 baseline tooling](../../../scripts/lib/README.md) — baseline-java-metrics.sh + baseline-aggregate.py (reused/extended in §6)
- [PR #24 Phase 2B-β AI orchestration](https://github.com/j4xie/my-prototype-logistics/pull/24) — what is dark-shipped (8 services migrated, F999/F001 byte-shape gates green)
- [PR #16 Phase 2B-α intent matching](https://github.com/j4xie/my-prototype-logistics/pull/16) — α foundation that the β flag flip activates
- [.claude/rules/server-operations.md](../../../.claude/rules/server-operations.md) — server 47 architecture, systemd units (`cretas-backend`, `cretas-python`), `.env.prod` location/perms, deploy commands
- [.claude/rules/CREDENTIAL-MANAGEMENT.md](../../../.claude/rules/CREDENTIAL-MANAGEMENT.md) — `.env.prod` permissions (chmod 600), env-var injection pattern, INTERNAL_API_SECRET handling
- [.claude/rules/aliyun-credentials.md](../../../.claude/rules/aliyun-credentials.md) — server 47 ECS instance + access keys (account A, AK rotated 2026-04-22)
- [Memory `feedback_test_before_prod_smartbi.md`](https://github.com/anthropic) — HARD RULE: any Java env var change must verify in test env (10011 + 8084) first, including this flag

---

**End of runbook**. Total: 8 sections.

Cross-PR coverage:
- PR #29 (rollout): WHAT — strategy, soak, kill-switch (qualitative), Phase 3.x ordering
- This runbook (operational): HOW — flag flip commands, threshold values, baseline extension, panel IDs, day-by-day operator checklist
- PR #62 (T6 ops): SISTER PATTERN — same 8-section doc-only structure, nginx vs flag scope
- PR #63 (Phase 3 cleanup): SUCCESSOR — what to do after Stage 4 + 7d GO

If this runbook diverges from PR #29 at any point, PR #29 wins (single source of truth for strategy decisions). Operational specifics here may be tuned during execution; updates land via follow-up PR after flip completes.
