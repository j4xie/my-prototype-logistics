# Plan C 餐饮运营 Gold 集成 — Prod 部署清单

**状态**: test env 验证完整, prod 等用户 ack.
**Branch**: `e2e/v1-framework` (+8 commits 从 `ded7a8509` 之后)
**Scope**: 方案 C 全量 (Silver + Gold + ETL + 5 ops templates + 4 dashboards + 专属毛利页 + 1 小时 cron)

---

## 1. Commits 清单 (按顺序)

| SHA | 内容 | 文件数 |
|-----|------|--------|
| `411fe7116` | P0 sidebar hide 4 项 + POS onboarding | 3 |
| `ded7a8509` | 深度图表修复 (KPI 映射 + pie filter) | 7 |
| `2f75b0610` | P1 AnalyticsStrip + 归属分类 | 7 |
| `f3e3edfa7` | Plan C Phase 1+3 MVP | 6 |
| `418e8494b` | Phase 2+4+5 (wastage/recipe/stock + ops router + FE) | 8 |
| `2bd6b8a87` | P1.6 分析概览+KPI看板 | 3 |
| `c28d9bb72` | Phase 2.5 product_source_pk + Phase 6 cron | 4 |
| `3cc281e97` | Phase 7 GROSS_MARGIN + 术语 + 异常预警 | 3 |
| `6fd7fbc15` | 毛利全面集成 (+专属页/V2dashboard) | 8 |
| **待 commit** | BCG 真实版 (毛利维度) + store-compare link + intents + checklist | 4-5 |

---

## 2. 部署步骤 (按顺序执行)

### Step 1: Database migrations (smartbi_prod_db)
```sql
-- 应用顺序严格
\i backend/python/smartbi/database/migrations/V20260424_01__template_feedback.sql
\i backend/python/smartbi/database/migrations/2026_04_24_silver_restaurant_ops.sql
\i backend/python/smartbi/database/migrations/2026_04_24_gold_restaurant_ops.sql
\i backend/python/smartbi/database/migrations/2026_04_24_recipe_product_source_pk.sql
```
每次 `\i` 后执行:
```sql
GRANT ALL ON <all-new-tables> TO smartbi_user;
GRANT ALL ON <all-new-sequences> TO smartbi_user;
```
预期结果: 5 Silver + 3 Gold + smart_bi_llm_fallback_log 2 columns = 8 tables.

### Step 2: AI intent seed (cretas_prod_db)
```sql
INSERT INTO ai_intent_configs (...) VALUES (...)  -- 5 行 RESTAURANT_OPS_*
```
见 `docs/plans/2026-04-24-restaurant-daily-ai-integration-plan.md` 完整 SQL.

### Step 3: Python deploy
```bash
bash scripts/deploy/deploy-smartbi-python.sh --env prod
# 健康检查: curl http://47.100.235.168:8083/health
# Cron 日志检查: grep 'restaurant-ops hourly ETL armed' python-prod.log
```

### Step 4: Web-admin deploy
```bash
cd web-admin && npm run build
rsync -az --delete dist/ root@139.196.165.140:/www/wwwroot/web-admin/
# 注意: prod web-admin 目录是 /www/wwwroot/web-admin/ (非 web-admin-test/)
```

### Step 5: Env vars (可选, 默认已 on)
```bash
# /www/wwwroot/cretas/.env.prod 新增 (如需 disable):
# RESTAURANT_OPS_ETL_ENABLED=false  # 默认 true
```

---

## 3. Smoke test 清单 (prod 8083)

```bash
SECRET=<INTERNAL_API_SECRET>
# 1. 新 API 端点存在
curl -H "X-Internal-Secret: $SECRET" -H "X-Factory-Id: F001" \
  'http://localhost:8083/api/smartbi/restaurant-ops/summary?days=30'
# 期望: success=true, data 含 totals + margin 字段

# 2. ETL 手动触发 (等待 cron 首跑可跳过)
curl -X POST -H "X-Internal-Secret: $SECRET" -H "X-Factory-Id: F001" \
  http://localhost:8083/api/smartbi/restaurant-ops/etl
# 期望: success=true (F001 type=FACTORY 会返 dim_ingredient 5 左右,其他 facts 0)

# 3. Gold ops router 命中检查 (如有 POS 数据)
curl -X POST -H "X-Internal-Secret: $SECRET" -H "X-Factory-Id: qhj_prod" \
  -H "Content-Type: application/json" \
  -d '{"query":"最近30天领料最多的食材"}' \
  http://localhost:8083/api/chat/general-analysis-stream | tail -30
# 期望: event: done 含 source=restaurant_ops_gold OR 正常 fallback 到 LLM
```

---

## 4. 回滚 (如 prod 有问题)

### 单点回滚 (推荐)
```bash
# 禁用 cron
echo "RESTAURANT_OPS_ETL_ENABLED=false" >> /www/wwwroot/cretas/.env.prod
# 重启
systemctl restart cretas-python
```

### 完整 rollback (最后手段)
```bash
git revert 6fd7fbc15 3cc281e97 c28d9bb72 2bd6b8a87 418e8494b f3e3edfa7
# migrations rollback (反序):
# DROP TABLE agg_restaurant_product_cost, agg_restaurant_daily_totals, agg_restaurant_daily_ops,
#           fact_restaurant_stocktaking, fact_restaurant_recipe_line,
#           fact_restaurant_wastage, fact_restaurant_requisition, dim_ingredient;
# ai_intent_configs: DELETE WHERE intent_code LIKE 'RESTAURANT_OPS_%';
```

注意: Silver/Gold 表 drop 会删 cron 生成的数据, 不影响 cretas_db 源表.

---

## 5. 监控点 (prod 上线后 24h)

| 指标 | 预期 | 异常阈值 |
|------|-----:|---------|
| cretas-python CPU | ≤5% baseline + 1-2% cron spike hourly | >15% 持续 |
| smartbi_db 连接数 | +1-3 from cron | >10 cron 起的连接 |
| `/restaurant-ops/etl` 失败率 | 0% (应全成功) | >20% 需排查 |
| `restaurant_ops_gold` source 命中率 | 约 10-20% 餐饮查询 | 0% (router 没 wire) |
| Gold 表行数增速 | 线性增长 (每小时 ~少量) | 指数增长 (死循环) |

日志关键字:
```bash
grep -E 'restaurant-etl|restaurant_ops_gold' /www/wwwroot/cretas/python-prod.log | tail -50
```

---

## 6. 用户教育 (给工厂 admin 的提示)

- **餐饮老板**: 点侧边栏 "餐饮运营 → 菜品毛利分析" 可见每道菜的营收/成本/毛利/毛利率. 需先录入 **配方** (数据→餐饮运营→配方管理) 并给食材填 **单价** (系统→菜品信息管理 or 数据库), 否则毛利按 0 估算.
- **数据出现时间**: 新录入的领料/损耗/盘点单进入 Gold 最多等 1 小时 (cron 间隔).
- **AI 问答**: "最近30天哪道菜毛利最高" / "哪个食材损耗最多" 直接在 /智能BI/AI问答 输入秒回.
- **工厂租户**: factoryType=FACTORY 租户看不到餐饮专属数据 (预期). Gold 表会尝试同步但 facts 全 0.

---

## 7. 已知限制 (需客户沟通)

| 限制 | 说明 | 解决时机 |
|------|------|---------|
| dim_product 两套命名 | POS xlsx 解析 + 菜单配置 可能不一致 | v2.1 dim_product_alias layer |
| 无 seed 的餐饮租户 | 无真实数据前 dashboards 显示 0/空态 | 用户创建记录后自动激活 |
| fact_pos_item 数据来源 | 目前仅 qhj_prod 有, 其他餐饮 tenant 需上传 POS Excel + materialize 流程 | Week 4 已 live, 按需上 |
| 跨库 join 性能 | cretas_db + smartbi_db 两次连接/查询 | <20ms 实测可接受, 后续可缓存 name↔id 映射 |

---

## 8. 联系人 / 回滚窗口

- **部署窗口建议**: 工作日 10:00-16:00 (非高峰 + 易触达支持)
- **首次 cron 触发**: prod 部署后 ~120s 第一次跑, 观察 log
- **24h 后 review**: 看监控+用户反馈, 决定是否收入 "已部署 prod" commits

**当前状态**: 全 8 commits 在 test env 验证通过, 可随时 prod deploy. 用户 ack 后 1 小时内可完成全流程.
