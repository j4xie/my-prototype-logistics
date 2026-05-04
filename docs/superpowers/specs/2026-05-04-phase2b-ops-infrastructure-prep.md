# Phase 2B Ops Infrastructure Prep — systemd cleanup + Prometheus dashboard

**Date**: 2026-05-04
**Author**: post-PR #73 (flag flip runbook) + #74 (drill-down PR-C) standby session
**Companion to**: [PR #29 Phase 3 AI migration rollout plan](../plans/2026-05-01-phase3-ai-migration-rollout.md) (the WHAT) + [PR #73 Phase 2B flag flip runbook](2026-05-04-phase2b-flag-flip-runbook.md) (the per-stage HOW)
**This doc scope**: the per-host + per-metric HOW — actual systemd `cretas-python.service` cleanup commands, Java + Python instrumentation diff, Prometheus scrape config, Grafana dashboard JSON skeleton, 4 steady-state alert rules, printable ops checklist
**Boundary**: doc-only PR, 0 code change, 0 systemd command actually executed

> **Document boundary** (do not duplicate):
> - PR #29 §2.1 owns: cleanup tech-debt list (single line: "remove `Environment=INTERNAL_API_SECRET=...`").
> - PR #29 §2.2 owns: 6-metric dashboard target list (qualitative names + thresholds).
> - PR #73 §5.1/5.2 owns: cutover-time monitoring panels + cutover rollback alert thresholds (rollback >2% / >3s / >30%).
> - This doc owns: actual ops execution commands + actual instrumentation diff + actual Grafana JSON + steady-state alert rules (>0.5% / >2000ms / >10% — tighter than cutover triggers since flag is fully on).
>
> If divergent: PR #29 wins for strategy; PR #73 wins for cutover-time numbers; this doc wins for steady-state numbers.

---

## 1. systemd `cretas-python.service` cleanup

### 1.1 Tech debt baseline

Per PR #29 §2.1 + PR #73 §1.4 (gating prereq for Stage 2 of flag flip).

The current state on server 47 (`/etc/systemd/system/cretas-python.service`):

```ini
[Unit]
Description=Cretas Python services (FastAPI on 8083)
After=postgresql.service redis.service network.target
Requires=postgresql.service redis.service

[Service]
Type=exec
User=root
WorkingDirectory=/www/wwwroot/cretas/code/backend/python
Environment=INTERNAL_API_SECRET=<plain-text-value>     # ← this line is the tech debt
Environment=PYTHONUNBUFFERED=1
# (other Environment= lines for LLM provider keys, DB connection, etc.)
ExecStart=/www/wwwroot/cretas/code/backend/python/venv38/bin/uvicorn main:app --host 0.0.0.0 --port 8083
# (Restart, RestartSec, etc.)
```

**Why it's tech debt**:
- `INTERNAL_API_SECRET` is **already** in `/www/wwwroot/cretas/.env.prod` (read by `cretas-backend.service` via `EnvironmentFile=`)
- The systemd `Environment=INTERNAL_API_SECRET=...` line in `cretas-python.service` is **a duplicate** that drifts independently
- Per PR #29 §2.5 pitfall 4 (and PR #73 §1.4): a byte-mismatch between the two sources causes Java→Python `X-Internal-Secret` 401, Java logs `Python returning empty`, fallback rate jumps to 100%
- Single source of truth: `.env.prod` only. Python systemd unit reads same file via `EnvironmentFile=`

### 1.2 Cleanup commands (do not execute as part of this PR — ops-ad-hoc)

Run on server 47 as root, during a low-traffic window. No deploy in flight.

```bash
ssh root@47.100.235.168
cd /etc/systemd/system

# 0. Pre-flight: verify INTERNAL_API_SECRET already exists in .env.prod (single source)
grep -c '^INTERNAL_API_SECRET=' /www/wwwroot/cretas/.env.prod
# Expect: 1 (must be exactly 1; 0 means migrate first, do NOT proceed)

# 0b. Capture current value to compare
SYSTEMD_VAL=$(systemctl show cretas-python | grep '^Environment=' | grep -oE 'INTERNAL_API_SECRET=[^[:space:]]*' | cut -d= -f2- | head -1)
ENVFILE_VAL=$(grep '^INTERNAL_API_SECRET=' /www/wwwroot/cretas/.env.prod | cut -d= -f2-)
[ "$SYSTEMD_VAL" = "$ENVFILE_VAL" ] && echo "MATCH: safe to drop systemd line" || echo "DRIFT: investigate before cleanup"
# Expect: MATCH. If DRIFT → STOP, file P1 issue, do not proceed (Java will 401 after restart)

# 1. Backup the systemd unit file
TS=$(date +%Y%m%d_%H%M%S)
sudo cp /etc/systemd/system/cretas-python.service \
        /etc/systemd/system/cretas-python.service.bak.$TS
ls -la /etc/systemd/system/cretas-python.service.bak.* | tail -5

# 2. Add EnvironmentFile= directive if not yet present (idempotent)
grep -q '^EnvironmentFile=/www/wwwroot/cretas/.env.prod$' /etc/systemd/system/cretas-python.service \
    || sudo sed -i '/^\[Service\]$/a EnvironmentFile=/www/wwwroot/cretas/.env.prod' /etc/systemd/system/cretas-python.service

# 3. Remove the hardcoded INTERNAL_API_SECRET= Environment= line
sudo sed -i '/^Environment=INTERNAL_API_SECRET=/d' /etc/systemd/system/cretas-python.service

# 4. Verify the diff is exactly 2 lines (1 added EnvironmentFile, 1 removed Environment)
diff /etc/systemd/system/cretas-python.service.bak.$TS \
     /etc/systemd/system/cretas-python.service
# Expect: exactly 2 line-changes

# 5. Reload systemd, restart Python service
sudo systemctl daemon-reload
sudo systemctl restart cretas-python

# 6. Wait for health (Python startup ~10-15s)
for i in {1..15}; do
    sleep 2
    if curl -sf http://localhost:8083/health > /dev/null; then
        echo "[$i*2s] Python up"; break
    fi
done

# 7. Verify env var resolved from .env.prod (not from removed Environment= line)
systemctl show cretas-python --property=Environment | grep -c INTERNAL_API_SECRET
# Expect: 1 (still present, but now sourced from EnvironmentFile)

# 8. Smoke: Java→Python intent match should still work (X-Internal-Secret check passes)
JWT_PROD=$(grep '^JWT_SECRET=' /www/wwwroot/cretas/.env.prod | cut -d= -f2-)
TOKEN=$(JWT_SECRET="$JWT_PROD" python3 -c "
import jwt,time,os
print(jwt.encode({
    'userId':1,'username':'systemd-cleanup-smoke',
    'factoryId':'F001','role':'factory_super_admin',
    'exp':int(time.time())+3600
}, os.environ['JWT_SECRET'], algorithm='HS256'))
")
INTERNAL=$(grep '^INTERNAL_API_SECRET=' /www/wwwroot/cretas/.env.prod | cut -d= -f2-)
curl -sS -X POST http://localhost:8083/api/ai/intent/match \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Internal-Secret: $INTERNAL" \
  -H "Content-Type: application/json" \
  -d '{"query":"测试","factoryId":"F001","role":"factory_super_admin"}' | jq '.intentCode // .detail'
# Expect: a valid intentCode (or empty string if no match) — NOT a 401 / forbidden
```

**Estimated duration**: 5 minutes ops time. Python service restart unblocks new traffic in ~15s; existing in-flight HTTP requests complete first (uvicorn graceful shutdown).

### 1.3 Rollback (if smoke check fails)

```bash
ssh root@47.100.235.168
LATEST_BAK=$(ls -t /etc/systemd/system/cretas-python.service.bak.* | head -1)
sudo cp "$LATEST_BAK" /etc/systemd/system/cretas-python.service
sudo systemctl daemon-reload
sudo systemctl restart cretas-python
# Recovery: ~15s Python startup
```

### 1.4 When to schedule

**Hard prereq for Stage 2** of PR #73 flag flip (per PR #73 §1.4 pitfall 4 — INTERNAL_API_SECRET drift would silently cause 401 storm). Schedule **before** Stage 2 of flag flip but **after** Phase 2B-β has soaked ≥48h on prod. Earliest: 2026-05-04 (today, β shipped 2026-04-30).

Sequencing relative to flag flip:
```
Phase 2B-β prod soak (48h) ──► §1.2 systemd cleanup ──► PR #73 Stage 1 (24h shadow) ──► PR #73 Stage 2
                                  ↑
                              this PR documents it; ops runs the 5-min execution
```

---

## 2. Prometheus dashboard + alert rules

### 2.1 What's already instrumented (do not re-add)

Inventory of existing prometheus-scrapeable metric sources, verified against repo HEAD:

| Source | Endpoint | Coverage | Verified at |
|---|---|---|---|
| Java backend (Spring Boot Actuator + micrometer-prometheus) | `:10010/actuator/prometheus` | `http_server_requests_seconds_*` (per-handler), `jvm_*`, `system_*`, `intent_stage_hits_total{stage=...}` (Phase 2B-α T24) | `pom.xml:57-58` (micrometer-registry-prometheus), `application.properties:32` (`management.endpoints.web.exposure.include=health,info,prometheus,metrics`), `application-pg-prod.properties:94`, `AIIntentServiceImpl.java:106-107` (MeterRegistry inject), `:116+` (`recordStageHit()` impl) |
| Java Resilience4j circuit breaker (auto-exposed via `resilience4j-micrometer`) | same `/actuator/prometheus` | `resilience4j_circuitbreaker_calls_total{name="pythonAiMatcher",kind="successful\|failed\|fallback"}`, `resilience4j_circuitbreaker_state{name="pythonAiMatcher",state="closed\|open\|half_open"}` | `PythonAiMatcherClient.java:60` (`@CircuitBreaker(name="pythonAiMatcher", fallbackMethod="matchFallback")`) |
| Python service (prometheus-fastapi-instrumentator) | `:8083/metrics` | `http_requests_total`, `http_request_duration_seconds_bucket{handler="/api/ai/intent/match"}` (per-URI auto p50/p95/p99) | `backend/python/main.py:820-821` (`Instrumentator().instrument(app).expose(app, endpoint="/metrics")`) |

**Therefore**: of the 6 metrics PR #29 §2.2 requested, the following are **free** (already scrapeable):

| PR #29 §2.2 metric | Source | Already free? |
|---|---|---|
| `/api/ai/intent/match` p50 latency (Python side) | Python `http_request_duration_seconds_bucket{handler="/api/ai/intent/match"}` quantile | ✅ free |
| `/api/ai/intent/match` p99 latency (Python side) | same | ✅ free |
| `IntentResultCache` hit rate | (need to add — see §2.2) | ❌ instrument needed |
| Python orchestrator error rate | Python `http_requests_total{handler="/api/ai/intent/match",status=~"5.."}` ÷ total | ✅ free (via HTTP status) |
| Java fallback to legacy rate | Java `resilience4j_circuitbreaker_calls_total{name="pythonAiMatcher",kind="fallback"}` ÷ total | ⚠️ partial — covers CB open. Python returning empty (non-CB fallback) needs a counter (see §2.2) |
| stage 8 LLM call rate | (need to add — see §2.2; or via Python HTTP path counter) | ❌ instrument needed |

### 2.2 Instrumentation diff to land before flag flip Stage 2

Two small Java adds + one small Python add. All three are NEW instrumentation, not refactor.

#### 2.2.1 Java: `intent_cache_hits_total` Counter (1 file, ~10 LOC)

Add MeterRegistry instrumentation to `IntentResultCache.java` (already exists at `backend/java/cretas-api/src/main/java/com/cretas/aims/cache/IntentResultCache.java:40`):

```java
// IntentResultCache.java (instrumentation diff)
@Autowired(required = false)
private MeterRegistry meterRegistry;

private void recordCacheLookup(boolean hit) {
    if (meterRegistry == null) return;
    try {
        meterRegistry.counter("intent_cache_lookups_total", "result", hit ? "hit" : "miss").increment();
    } catch (Exception e) {
        // never block primary path on metrics
    }
}
```

Then call `recordCacheLookup(true)` on cache-hit, `recordCacheLookup(false)` on miss. Hit rate query:

```promql
sum(rate(intent_cache_lookups_total{result="hit"}[5m]))
/
sum(rate(intent_cache_lookups_total[5m]))
```

#### 2.2.2 Java: `python_match_fallback_total` Counter (1 file, ~5 LOC)

Add to `AIIntentServiceImpl.java` where it logs `Python returning empty` (non-CB fallback case — Python returned 200 but with `MatchMethod.NONE` payload):

```java
// AIIntentServiceImpl.java (instrumentation diff, near where the empty-payload branch is)
if (meterRegistry != null && pythonResult != null && pythonResult.matchMethod() == NONE) {
    try {
        meterRegistry.counter("python_match_fallback_total", "reason", "empty_payload").increment();
    } catch (Exception e) { /* swallow */ }
}
```

Combined with the Resilience4j CB-fallback counter, total Java fallback rate:

```promql
(
  sum(rate(python_match_fallback_total[5m]))
  +
  sum(rate(resilience4j_circuitbreaker_calls_total{name="pythonAiMatcher",kind="fallback"}[5m]))
)
/
sum(rate(http_server_requests_seconds_count{uri="/api/mobile/{factoryId}/ai/intent/match"}[5m]))
```

#### 2.2.3 Python: `llm_provider_attempts_total` + `stage8_llm_calls_total` Counters (1 file, ~15 LOC)

Add to `backend/python/ai/orchestrator.py` (or wherever stage 8 LLM dispatch lives — `backend/python/ai/scoring/`):

```python
# orchestrator.py (instrumentation diff)
from prometheus_client import Counter

llm_provider_attempts = Counter(
    "llm_provider_attempts_total",
    "LLM provider call attempts (one increment per provider tried in fallback chain)",
    ["provider", "outcome"],  # provider in {aliyun_a, aliyun_b, zhipu, deepseek}; outcome in {success, error, timeout}
)

stage8_llm_calls = Counter(
    "stage8_llm_calls_total",
    "Stage 8 LLM fallback dispatches (final stage when stages 1-7 produce no high-confidence match)",
)

# At each LLM call site:
llm_provider_attempts.labels(provider=provider, outcome="success").inc()  # or error / timeout

# At stage 8 dispatch site:
stage8_llm_calls.inc()
```

Then PromQL:

```promql
# Stage 8 LLM call rate (PR #29 §2.2 target: <30% steady state with tier_selector=disabled β default)
sum(rate(stage8_llm_calls_total[5m]))
/
sum(rate(http_requests_total{handler="/api/ai/intent/match"}[5m]))
```

```promql
# LLM provider health (4-provider fallback chain — PR #29 §2.2 target: aliyun_a + aliyun_b carry >70%)
sum(rate(llm_provider_attempts_total{outcome="success"}[5m])) by (provider)
```

### 2.3 Prometheus scrape config

`/etc/prometheus/prometheus.yml` (or wherever the Prometheus instance lives — confirm during ops execution):

```yaml
# Add these scrape jobs to existing scrape_configs:

scrape_configs:
  - job_name: 'cretas-backend'                  # Java prod
    metrics_path: '/actuator/prometheus'
    scrape_interval: 30s
    scrape_timeout: 10s
    static_configs:
      - targets: ['47.100.235.168:10010']
        labels:
          env: prod
          service: cretas-backend
          host: '47.100.235.168'

  - job_name: 'cretas-backend-test'             # Java test
    metrics_path: '/actuator/prometheus'
    scrape_interval: 30s
    scrape_timeout: 10s
    static_configs:
      - targets: ['47.100.235.168:10011']
        labels:
          env: test
          service: cretas-backend
          host: '47.100.235.168'

  - job_name: 'cretas-python'                   # Python prod
    metrics_path: '/metrics'
    scrape_interval: 30s
    scrape_timeout: 10s
    static_configs:
      - targets: ['47.100.235.168:8083']
        labels:
          env: prod
          service: cretas-python
          host: '47.100.235.168'

  - job_name: 'cretas-python-test'              # Python test
    metrics_path: '/metrics'
    scrape_interval: 30s
    scrape_timeout: 10s
    static_configs:
      - targets: ['47.100.235.168:8084']
        labels:
          env: test
          service: cretas-python
          host: '47.100.235.168'
```

**Network**: Prometheus instance must reach 47 on the actuator/metrics ports. Per `.claude/rules/aliyun-credentials.md` Phase 3 SG, ports 10010/10011/8083/8084 are restricted to `139.196.165.140/32`. Either run Prometheus on 139, or whitelist Prometheus host IP in SG `sg-uf64n0hcl8w37d34zfmy`.

### 2.4 Steady-state alert rules (4 rules)

`prometheus/alerts/phase2b-steady-state.yml` — distinct from PR #73 §5.2 cutover-time rollback alerts (which use stricter rollback triggers like p99>3s/error>2%/fallback>30% only during the active flag-flip stages).

Steady-state thresholds reflect production normal-operation expectations after Stage 4 + 7d soak (per PR #73 §3.4 GO criteria):

```yaml
# prometheus/alerts/phase2b-steady-state.yml
# Steady-state ops alerts for Phase 2B post-flag-flip operation.
# Sister rule group to phase2b-flagflip.yml (PR #73 §5.2 — cutover-time rollback triggers, stricter).

groups:
- name: phase2b-steady-state
  interval: 30s
  rules:

  # Alert 1: Python /api/ai/intent/match error rate exceeds steady-state target
  # PR #29 §2.2 target: <0.5% post-warmup
  - alert: Python8083ErrorRateHigh
    expr: |
      sum(rate(http_requests_total{job="cretas-python",handler="/api/ai/intent/match",status=~"5.."}[5m]))
      /
      sum(rate(http_requests_total{job="cretas-python",handler="/api/ai/intent/match"}[5m]))
      > 0.005
    for: 5m
    labels:
      severity: warning      # not critical (no auto-rollback): operator investigates within business hours
      team: phase2b-ops
    annotations:
      summary: "Python 8083 /api/ai/intent/match error rate >0.5% for 5min"
      description: "Sustained Python error rate exceeds steady-state target. Rolling 5min: {{ $value | humanizePercentage }}. Investigate Python logs for stack traces."
      runbook_url: "https://github.com/j4xie/my-prototype-logistics/blob/main/docs/superpowers/specs/2026-05-04-phase2b-ops-infrastructure-prep.md#section-3"

  # Alert 2: Python p99 latency exceeds steady-state target
  # PR #29 §2.2 target: <2000ms post-warmup
  - alert: Python8083P99LatencyHigh
    expr: |
      histogram_quantile(0.99,
        sum(rate(http_request_duration_seconds_bucket{job="cretas-python",handler="/api/ai/intent/match"}[5m]))
        by (le)
      ) > 2.0
    for: 5m
    labels:
      severity: warning
      team: phase2b-ops
    annotations:
      summary: "Python 8083 /api/ai/intent/match p99 >2000ms for 5min"
      description: "Sustained p99 exceeds steady-state. Current: {{ $value }}s. Check pgvector index + LLM provider latency."

  # Alert 3: Java fallback to legacy pipeline exceeds steady-state target
  # PR #29 §2.2 target: <5% post-warmup; this alert fires at >10% to give headroom over the warm-up tail
  - alert: JavaFallbackSpike
    expr: |
      (
        sum(rate(python_match_fallback_total[5m]))
        +
        sum(rate(resilience4j_circuitbreaker_calls_total{name="pythonAiMatcher",kind="fallback"}[5m]))
      )
      /
      sum(rate(http_server_requests_seconds_count{uri=~"/api/mobile/.*ai/intent/match"}[5m]))
      > 0.10
    for: 5m
    labels:
      severity: warning
      team: phase2b-ops
    annotations:
      summary: "Java fallback rate >10% for 5min — Python coverage gap or service issue"
      description: "Java falling back to legacy pipeline at {{ $value | humanizePercentage }}. Check Python /metrics for error rate + circuit breaker state."

  # Alert 4: Any LLM provider unhealthy (4-provider fallback chain robustness)
  # PR #29 §2.2 implication: if aliyun_a goes down, aliyun_b should pick up; if both down, fall to zhipu.
  # Alert when ANY provider has >50% error rate OR no successful calls in 2min — early warning of provider chain degradation
  - alert: LLMProviderUnhealthy
    expr: |
      (
        sum(rate(llm_provider_attempts_total{outcome=~"error|timeout"}[2m])) by (provider)
        /
        clamp_min(sum(rate(llm_provider_attempts_total[2m])) by (provider), 0.001)
      ) > 0.5
      or
      (
        sum(rate(llm_provider_attempts_total{outcome="success"}[2m])) by (provider) == 0
        and
        sum(rate(llm_provider_attempts_total[2m])) by (provider) > 0
      )
    for: 2m
    labels:
      severity: warning
      team: phase2b-ops
    annotations:
      summary: "LLM provider {{ $labels.provider }} unhealthy >2min (error rate >50% OR 0 successes)"
      description: "Provider {{ $labels.provider }} appears unhealthy. Check provider quota + API key + network. 4-provider fallback chain still has redundancy at this severity (warning, not critical)."
```

**Severity intentionally `warning`, not `critical`**: steady-state alerts notify ops via Slack channel during business hours. Critical-severity (PagerDuty wake-up) reserved for cutover-time alerts (PR #73 §5.2) where rollback decision is time-sensitive. Steady-state can wait for triage.

### 2.5 Grafana dashboard JSON skeleton

Save as `monitoring/grafana/phase2b-ops-dashboard.json` (path TBD by ops). Import into Grafana via Dashboards → New → Import.

```json
{
  "title": "Phase 2B ops — steady state",
  "uid": "phase2b-ops-steady",
  "timezone": "browser",
  "schemaVersion": 38,
  "refresh": "30s",
  "time": { "from": "now-6h", "to": "now" },
  "panels": [
    {
      "type": "timeseries",
      "title": "Python /api/ai/intent/match p50 / p95 / p99 latency",
      "datasource": { "type": "prometheus" },
      "fieldConfig": { "defaults": { "unit": "s" } },
      "targets": [
        { "expr": "histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket{job=\"cretas-python\",handler=\"/api/ai/intent/match\"}[5m])) by (le))", "legendFormat": "p50" },
        { "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job=\"cretas-python\",handler=\"/api/ai/intent/match\"}[5m])) by (le))", "legendFormat": "p95" },
        { "expr": "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{job=\"cretas-python\",handler=\"/api/ai/intent/match\"}[5m])) by (le))", "legendFormat": "p99" }
      ]
    },
    {
      "type": "stat",
      "title": "Python error rate (5xx)",
      "datasource": { "type": "prometheus" },
      "fieldConfig": { "defaults": { "unit": "percentunit", "thresholds": { "mode": "absolute", "steps": [
        { "color": "green",  "value": null  },
        { "color": "yellow", "value": 0.005 },
        { "color": "red",    "value": 0.02  }
      ] } } },
      "targets": [
        { "expr": "sum(rate(http_requests_total{job=\"cretas-python\",handler=\"/api/ai/intent/match\",status=~\"5..\"}[5m])) / clamp_min(sum(rate(http_requests_total{job=\"cretas-python\",handler=\"/api/ai/intent/match\"}[5m])), 0.001)" }
      ]
    },
    {
      "type": "stat",
      "title": "Java IntentResultCache hit rate",
      "datasource": { "type": "prometheus" },
      "fieldConfig": { "defaults": { "unit": "percentunit", "thresholds": { "mode": "absolute", "steps": [
        { "color": "red",    "value": null },
        { "color": "yellow", "value": 0.20 },
        { "color": "green",  "value": 0.40 }
      ] } } },
      "targets": [
        { "expr": "sum(rate(intent_cache_lookups_total{result=\"hit\"}[5m])) / clamp_min(sum(rate(intent_cache_lookups_total[5m])), 0.001)" }
      ]
    },
    {
      "type": "stat",
      "title": "Java fallback rate (Python empty + CB open)",
      "datasource": { "type": "prometheus" },
      "fieldConfig": { "defaults": { "unit": "percentunit", "thresholds": { "mode": "absolute", "steps": [
        { "color": "green",  "value": null },
        { "color": "yellow", "value": 0.05 },
        { "color": "red",    "value": 0.10 }
      ] } } },
      "targets": [
        { "expr": "(sum(rate(python_match_fallback_total[5m])) + sum(rate(resilience4j_circuitbreaker_calls_total{name=\"pythonAiMatcher\",kind=\"fallback\"}[5m]))) / clamp_min(sum(rate(http_server_requests_seconds_count{uri=~\"/api/mobile/.*ai/intent/match\"}[5m])), 0.001)" }
      ]
    },
    {
      "type": "barchart",
      "title": "LLM provider 4-chain success rate (aliyun_a / aliyun_b / zhipu / deepseek)",
      "datasource": { "type": "prometheus" },
      "targets": [
        { "expr": "sum(rate(llm_provider_attempts_total{outcome=\"success\"}[5m])) by (provider)", "legendFormat": "{{ provider }}" }
      ]
    },
    {
      "type": "stat",
      "title": "Stage 8 LLM call rate",
      "datasource": { "type": "prometheus" },
      "fieldConfig": { "defaults": { "unit": "percentunit", "thresholds": { "mode": "absolute", "steps": [
        { "color": "green",  "value": null },
        { "color": "yellow", "value": 0.30 },
        { "color": "red",    "value": 0.50 }
      ] } } },
      "targets": [
        { "expr": "sum(rate(stage8_llm_calls_total[5m])) / clamp_min(sum(rate(http_requests_total{job=\"cretas-python\",handler=\"/api/ai/intent/match\"}[5m])), 0.001)" }
      ]
    },
    {
      "type": "barchart",
      "title": "Java intent stage hit distribution (already instrumented since β T24)",
      "description": "Free metric — no instrumentation needed. Should shift toward PYTHON_CACHE_HIT + PYTHON_MATCH after flag flip.",
      "datasource": { "type": "prometheus" },
      "targets": [
        { "expr": "sum(rate(intent_stage_hits_total[5m])) by (stage)", "legendFormat": "{{ stage }}" }
      ]
    },
    {
      "type": "stat",
      "title": "Resilience4j pythonAiMatcher CB state",
      "datasource": { "type": "prometheus" },
      "targets": [
        { "expr": "resilience4j_circuitbreaker_state{name=\"pythonAiMatcher\"}", "legendFormat": "{{ state }}" }
      ]
    }
  ]
}
```

**Operator note**: this JSON is a skeleton. Tune panel layout (gridPos), variables (env=prod|test selector), and links (drill-down to logs) during Grafana import.

---

## 3. Ops execution checklist (printable)

Each subsection is a single page when printed. Operator initials + timestamp on each item. Pre-flag-flip sequence (mirrors PR #73 §7 timing).

### 3.1 systemd cleanup pre-checks (T-3 days)

```
[ ] Verify INTERNAL_API_SECRET present in /www/wwwroot/cretas/.env.prod         _____ / _____
[ ] Compare systemd Environment= value vs .env.prod value (MATCH expected)      _____ / _____
[ ] Confirm no scheduled deploys in next 30 min (avoid race per §1.2 step)      _____ / _____
[ ] Backup file location confirmed: /etc/systemd/system/cretas-python.service.bak.<TS>  _____ / _____
```

### 3.2 systemd cleanup execution (T-3 days, 5 min window)

```
[ ] §1.2 step 0: pre-flight grep returns 1                                       _____ / _____
[ ] §1.2 step 0b: MATCH (not DRIFT) — STOP if DRIFT                              _____ / _____
[ ] §1.2 step 1: backup created                                                  _____ / _____
[ ] §1.2 step 2: EnvironmentFile= directive added                                _____ / _____
[ ] §1.2 step 3: Environment=INTERNAL_API_SECRET= line removed                   _____ / _____
[ ] §1.2 step 4: diff shows exactly 2 changed lines                              _____ / _____
[ ] §1.2 step 5: daemon-reload + restart succeeded (no systemd error)            _____ / _____
[ ] §1.2 step 6: Python /health returns 200 within 30s                           _____ / _____
[ ] §1.2 step 7: systemctl show output contains INTERNAL_API_SECRET              _____ / _____
[ ] §1.2 step 8: smoke /api/ai/intent/match returns valid intentCode (NOT 401)   _____ / _____
[ ] Slack post: cleanup complete + diff link + smoke result                      _____ / _____
```

If any step fails: §1.3 rollback. Recovery <30s.

### 3.3 Dashboard verify (T-2 days, after instrumentation PRs land)

```
[ ] Java instrumentation PR (§2.2.1 + §2.2.2) merged + deployed prod            _____ / _____
[ ] Python instrumentation PR (§2.2.3) merged + deployed prod                   _____ / _____
[ ] curl http://localhost:10010/actuator/prometheus | grep intent_cache_lookups _____ / _____
[ ] curl http://localhost:8083/metrics | grep llm_provider_attempts_total       _____ / _____
[ ] Prometheus scrape_configs (§2.3) added + Prometheus reloaded                 _____ / _____
[ ] Prometheus target page shows all 4 jobs UP (cretas-backend, *-test, python, *-test) _____ / _____
[ ] Steady-state alert rules (§2.4) loaded — `promtool check rules` returns 0   _____ / _____
[ ] Grafana dashboard (§2.5) imported — all 8 panels show data (not "No data")  _____ / _____
[ ] Slack channel #phase2b-ops subscribed to alertmanager phase2b-steady-state  _____ / _____
```

### 3.4 Sequence relative to PR #73 flag flip

```
T-7d   §1 systemd cleanup (this PR §1.2)                  → unblocks PR #73 §1.4
T-7d   Java + Python instrumentation merged + deployed     → unblocks PR #73 §5.1 panels working
T-3d   §2.3 Prometheus scrape_configs deployed
T-3d   §2.4 alert rules loaded
T-2d   §2.5 Grafana dashboard imported + sanity-checked    → unblocks PR #73 §5.1
T-1d   PR #73 §7.1 T-1d operator checklist                 → confirms this prep complete
T-0    PR #73 Stage 1 (24h shadow)                          → flag flip begins
```

---

## 4. References

- [PR #29 Phase 3 AI migration rollout plan](../plans/2026-05-01-phase3-ai-migration-rollout.md) — §2.1 systemd tech-debt list, §2.2 6-metric dashboard target, §6 action items (last 3 of which this PR satisfies)
- [PR #73 Phase 2B flag flip runbook](2026-05-04-phase2b-flag-flip-runbook.md) — §1.4 Stage 2 prereq names this systemd cleanup; §5.1/5.2 cutover-time monitoring uses the same panels + stricter rollback alert thresholds
- [PR #62 T6 cutover deploy runbook](2026-05-02-phase2a-t6-deploy-runbook.md) — sister doc-only ops companion shape (different scope: nginx upstream cutover); reused checklist + per-step verify pattern
- [.claude/rules/server-operations.md](../../../.claude/rules/server-operations.md) — server 47 systemd architecture, deploy commands, port allocation
- [.claude/rules/CREDENTIAL-MANAGEMENT.md](../../../.claude/rules/CREDENTIAL-MANAGEMENT.md) — `.env.prod` permissions, env-var injection pattern, INTERNAL_API_SECRET handling rule (single source = .env.prod)
- [.claude/rules/aliyun-credentials.md](../../../.claude/rules/aliyun-credentials.md) — server 47 SG `sg-uf64n0hcl8w37d34zfmy` (10010/10011/8083/8084 restricted to 139.196.165.140/32 — Prometheus scrape host needs whitelist)
- `backend/java/cretas-api/pom.xml:57-58` — micrometer-registry-prometheus dependency (already wired)
- `backend/java/cretas-api/src/main/resources/application.properties:32` — `management.endpoints.web.exposure.include=health,info,prometheus,metrics` (already enabled)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/AIIntentServiceImpl.java:106-107` — existing MeterRegistry inject + `recordStageHit()` at line 116 (Phase 2B-α T24 — `intent_stage_hits_total{stage}` already free)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/cache/IntentResultCache.java:40` — instrumentation target (§2.2.1)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/client/PythonAiMatcherClient.java:60` — `@CircuitBreaker(name="pythonAiMatcher")` already auto-exposes `resilience4j_circuitbreaker_*` metrics
- `backend/python/main.py:820-821` — `Instrumentator().instrument(app).expose(app, endpoint="/metrics")` (already wired)

---

**End of doc**. Total: 4 sections.

Cross-PR coverage:
- PR #29 (rollout): WHAT — 6-metric target list, action items
- PR #73 (flag flip runbook): per-stage HOW — cutover commands, rollback triggers
- This doc (ops infrastructure): per-host + per-metric HOW — actual systemd cleanup commands, instrumentation diff, scrape config, alert rules, Grafana JSON
