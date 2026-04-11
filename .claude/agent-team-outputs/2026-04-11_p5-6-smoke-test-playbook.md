# P5.6 Runtime Smoke Test Playbook

**Date**: 2026-04-11
**Context**: Agent-team audit recommended Option A (route layer fix); code + unit tests landed (commits `5898de87c`, `df83e3f7c`, `efaccff89`, `bd2841f75`, `cc9be296a`). Runtime verification was blocked because:

1. The local Java backend was running an **old jar** that didn't contain the P5.6 route layer fix
2. The local DB was missing the V20260411_01..06 Flyway migrations (14 RESTAURANT_* diagnostic intent configs)

Both blockers have partial mitigation: the 6 migrations were **applied manually** to `cretas_db` in this session, but the running backend caches intent configs at startup and hasn't seen them yet.

---

## Pre-flight (one-time)

Migrations already applied to local `cretas_db` in this session — verified:

```bash
PGPASSWORD=cretas_pass "/c/Program Files/PostgreSQL/17/bin/psql.exe" \
  -h localhost -U cretas_user -d cretas_db \
  -c "SELECT count(*) FROM ai_intent_configs WHERE intent_code LIKE 'RESTAURANT_%';"
# Expected: 37 rows (18 legacy + 19 diagnostic/engineering/forecast)
```

## Step 1 — Restart the Java backend

Kill the currently running process and start fresh:

```bash
# Find and stop the running backend (if managed by mvn spring-boot:run or java -jar)
lsof -i:10010   # Or: netstat -an | grep 10010
# Kill the process by PID

# Start fresh with local pg profile:
cd backend/java/cretas-api
export DB_PASSWORD=cretas_pass
export POSTGRES_SMARTBI_PASSWORD=smartbi_pass
./mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=pg -Dspring-boot.run.jvmArguments="-DDB_PASSWORD=$DB_PASSWORD -DPOSTGRES_SMARTBI_PASSWORD=$POSTGRES_SMARTBI_PASSWORD"
```

Wait until you see `Started CretasApplication in ...s` in the log.

Verify it's up:

```bash
curl -s http://localhost:10010/api/mobile/health
# Expected: {"status":"UP","timestamp":...}
```

## Step 2 — Smoke test the public demo endpoint (no auth)

This tests `IntentExecutorService.execute()` which is the downstream dependency of the P5.6 fix:

```bash
# Use a file to avoid shell UTF-8 issues on Windows
echo '{"userInput":"帮我分析一下成本刚性 营收降了47% 人工只降了26%"}' > payload.json
curl -s -X POST http://localhost:10010/api/public/ai-demo/execute \
  -H "Content-Type: application/json; charset=utf-8" \
  --data-binary @payload.json | python -m json.tool
```

**Expected** (after restart):
```json
{
  "success": true,
  "data": {
    "intentRecognized": true,
    "intentCode": "RESTAURANT_COST_RIGIDITY",
    "intentName": "成本刚性诊断",
    "status": "SUCCESS",
    "resultData": {
      "success": true,
      "section": "cost_rigidity",
      "data": { "...": "..." },
      "followUpChips": ["...", "..."]
    },
    "metadata": {
      "toolName": "restaurant_cost_rigidity_analysis"
    }
  }
}
```

**Failure modes**:
- `status: NOT_RECOGNIZED` → restart didn't pick up new intents. Check Flyway or reapply migrations.
- `intentCode: RESTAURANT_COST_RIGIDITY` but `resultData: null` → Python backend (port 8083) not running. Start it.
- HTTP 500 → check `cretas-prod.log` or `spring-boot:run` console.

## Step 3 — Smoke test /smart-bi/query (the P5.6 target endpoint)

This requires authentication. Login first:

```bash
# Use a test account — replace <password> with real value from .env.test
TOKEN=$(curl -s -X POST http://localhost:10010/api/mobile/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"factory_admin1","password":"<password>"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

# Send a restaurant query through the P5.6 route layer
curl -s -X POST http://localhost:10010/api/mobile/F001/smart-bi/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  --data-binary @payload.json | python -m json.tool
```

**Expected** (P5.6 fix working):
```json
{
  "success": true,
  "data": {
    "intent": "RESTAURANT_DIAGNOSTIC",
    "intentCode": "RESTAURANT_COST_RIGIDITY",
    "toolName": "restaurant_cost_rigidity_analysis",
    "skillName": null,
    "responseText": "人工成本过度刚性 (0.561)",
    "message": "分析完成",
    "sections": [
      {
        "sectionName": "cost_rigidity",
        "status": "ok",
        "data": { "...": "..." },
        "warnings": [],
        "fromCache": false,
        "computedAtMs": 1234567890
      }
    ],
    "followUpChips": [
      "看看具体的岗位工资",
      "对标火锅行业的人工占比"
    ]
  }
}
```

**Critical check**: `sections[]` must be non-empty and `intentCode` must start with `RESTAURANT_`. If these are missing, the route layer fix didn't activate — check log for `P5.6 · 检测到餐饮诊断关键词` and `P5.6 · Tool-Skill 路由成功`.

## Step 4 — Web-admin browser test

1. Open `web-admin` dev server (or visit deployed `139.196.165.140:8086`)
2. Login as factory admin
3. Navigate to SmartBI → Restaurant Dashboard
4. Click "聊天问答" button (drawer opens from right)
5. Type: `帮我分析一下成本刚性 营收降了 47% 人工只降了 26%`
6. **Expected**: AI bubble shows 人工成本过度刚性 headline + section card with rigidity score + 2-4 follow-up chips

## Step 5 — Mobile RN smoke (optional, P2.11 rescope)

After Step 3 verifies web-admin path, verify Mobile RN shares the same wins:

1. Start Expo: `cd frontend/CretasFoodTrace && npm start`
2. Open NLQueryScreen
3. Type the same cost_rigidity query
4. **Expected**: at minimum, no crash and a structured response (the RN UI may not render sections yet — that's P6 work)

## Related test artifacts

- Unit tests (already passing in this session): `SmartBIRestaurantRoutingTest` — 6/6 green
- Integration tests (gated by `-DrunIntegration=true` after restart):
  ```bash
  ./mvnw.cmd test -Dtest=RestaurantDiagnosticChatE2ETest -DrunIntegration=true
  ```
  Expected: 5/5 green (intent routing contract locked in)

## What this playbook does NOT cover

- Python backend (port 8083) — assumed running. If not, `sections[]` will be empty with warning `Python 分析服务暂不可用`.
- DashScope keys — only needed if the query falls through to LLM fallback (keyword layer should handle 成本刚性 first).
- Data quality — `data` inside each section reflects whatever the Python section handler returns. For 鼎鲜 demo data, this should produce score=0.561 severity=HIGH.
