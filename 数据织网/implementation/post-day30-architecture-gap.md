# 数据织网 Sub-Project C — Day 30+ 架构缺口修复 ADR

**版本**: v1
**日期**: 2026-04-28
**状态**: Open — 待评审 + 排期
**触发**: Day 23-30 完成后, 真实窗口测试 (139:8097 + 47:8084) 揭示 1 个核心架构缺口 + 3 个部署/工具 nits

---

## 1. 背景: Day 23-30 完成状态回顾

| Day | Commit | 内容 |
|---|---|---|
| 23 | `f471e3f63` | TrustIndicator.vue 组件 + 5 vitest |
| 24-25 | `72d1961f8` | top-products provenance JOIN POC + GoldPreview integration |
| 26 | `6249bec46` | cell-audit page + GET /api/smartbi/provenance/audit endpoint |
| 27 | `db2ab0fc6` | admin factory_provenance_config UI + GET/PUT endpoint |

全部已推 `origin/e2e/v1-framework`. Test 环境部署 + Playwright 真实窗口测试通过 (3 页面端到端 + 4 行 demo provenance 数据驱动渲染).

---

## 2. Critical 架构缺口: top_products 读旧表, writer 写新表

### 2.1 问题陈述

**Day 24-25 实施的 SQL JOIN 在 prod 不会有效.** 原因:

- `backend/python/smartbi/gold/queries.py:top_products` 读的是 **legacy `agg_product`** (Phase A 月级聚合)
- `backend/python/smartbi/canonical/silver_writers/product_summary_writer.py` 写的是 **`agg_product_period`** (Phase B 周期级聚合) + `field_provenance`

两张表 schema 不同, 主键不同 (`agg_product` 是 `(factory_id, product_id, month)`, `agg_product_period` 用 `period_start/period_end`), 没有同步机制. 即使 `SMARTBI_ENABLE_PROVENANCE=1` 在 prod 打开, 用户上传 Excel 走 ProductSummaryWriter pipeline:

1. Writer 写 `agg_product_period` ✓
2. Writer 写 `field_provenance` (entity_type='product', entity_id=...) ✓
3. `top_products` SQL 仍然只 SELECT `agg_product` (没新数据) — 永远 SELECT 不到刚写的 product_id
4. LEFT JOIN field_provenance 配对成功的概率 = product_id 既在 `agg_product` 也在 `agg_product_period` 的交集

**实证 (test smartbi_db, 2026-04-28)**:
```
SET app.factory_id='F001';
agg_product F001:             2998 rows  ← top_products SQL 实际读的来源
agg_product_period F001:         0 rows  ← ProductSummaryWriter 写的目标
field_provenance:                0 rows  ← writers OFF + agg_product_period 空
```

3 个新页面 (Day 24-25 GoldPreview / Day 26 cell-audit / Day 27 config) 在 test 环境**只能靠手工 INSERT field_provenance 来 demo**. 真实生产路径 (writer→provenance→FE 渲染) **从未端到端跑过**.

### 2.2 影响

- Prod-OFF 状态: 0 影响 (FE 全部 fallback 老体验, TrustIndicator 不渲染)
- Prod-ON 状态: TrustIndicator 仍然几乎全部 muted, 因为 agg_product (legacy) 不会被新 writer 写; 用户感知 "这功能没工作"
- **deploy 后到 prod 后果不可见,但功能形同虚设** — 这比有 bug 更糟糕 (因为 metric 上线但没人发现没数据)

### 2.3 三个修复选项

#### Option α: 改 top_products 读 agg_product_period (推荐)

```python
# backend/python/smartbi/gold/queries.py:top_products
SELECT p.product_id, p.name,
       SUM(app.qty_sold), SUM(app.revenue), SUM(app.bill_count)
  FROM agg_product_period app                          -- 改这里
  JOIN dim_product p ON p.product_id = app.product_id
  LEFT JOIN field_provenance fp ON ...                  -- JOIN 不变
 WHERE app.factory_id = $1
   AND app.period_start >= $2 AND app.period_end <= $3  -- date range 适配
```

**Pros**:
- 干净, 单一聚合源
- writer 直接喂 → 端到端贯通
- agg_product (Phase A 老表) 可逐步淘汰

**Cons**:
- API 响应字段语义微变 (`month` → `period_start/end`); FE GoldPreview 已 camelCase, 不影响渲染
- 需 backfill agg_product_period 给历史数据 (BF1-类似机制)
- prod 切换风险: 切换瞬间老用户的 KPI 数字可能跳变 (新表数据 vs 老表数据精度差)

**LOC 估**: 后端 ~50 行 (queries.py + 1-2 个 reader 适配); 后端测 ~30 行; FE 0 行 (camelCase 已就位); backfill 脚本 ~150 行 (复用 BF1 模式).

**部署**: 1 次 Python deploy + 1 次数据迁移 (BF1.1 backfill agg_product → agg_product_period).

#### Option β: ProductSummaryWriter 双写 agg_product + agg_product_period

```python
# silver_writers/product_summary_writer.py
async def _write_aggregates(self, ...):
    await self._write_agg_product_period(...)   # 现有
    await self._write_agg_product_legacy(...)   # 新加
```

**Pros**:
- top_products 不变, 风险最低
- 渐进过渡, 老 reader 仍然工作

**Cons**:
- 永远双写, 维护成本 ×2
- 两张表数据可能漂移 (写一半, 查询期不一致)
- 没有淘汰路径, 技术债累积

**不推荐**: 长期成本 > 短期收益.

#### Option γ: ETL 任务 agg_product_period → agg_product

定期 (e.g. 每小时) 跑 transform job 把新表投影到老表.

**Pros**:
- 改动最小, top_products 完全不动
- 能用 cron / DAG 复用既有调度

**Cons**:
- 新增定时任务 = 新故障点
- 数据延迟 (1 小时 lag) — TrustIndicator "新鲜度" 误导
- 双源 + 转换 + ETL 失败时排查链路长

**不推荐**: 增加运维复杂度.

### 2.4 推荐: Option α + 分阶段实施

**Phase 1 (1 天 Python work)**: 改 `top_products()` 读 `agg_product_period`, 加 reader test, 加 dual-source flag 让两套并存可切换.

**Phase 2 (2 天数据 + 验证)**: 写 BF1.1 backfill `agg_product` → `agg_product_period` for 历史 12 个工厂. 验证 KPI 数字一致性.

**Phase 3 (1 天 deploy + soak)**: 按阶段切换 reader (test → prod 单工厂 → 全量), 对比 KPI 看有无飘移.

**Phase 4 (1 天 cleanup)**: 关闭 dual-source flag, 全切到 agg_product_period; 标记 agg_product 弃用; 6 个月后删表.

**总预算**: ~5 工作日, 1 个新 commit batch (类似 Day 23-30 风格).

**前置依赖**: DBA 把 6 个 C migrations apply 到 prod (V20260430_01 / V20260501_01-03 / V20260502_01-02), 否则 ProductSummaryWriter 在 prod 还是不能工作.

---

## 3. 其他发现 (Day 29 部署期间暴露)

### 3.1 deploy-smartbi-python.sh: 健康检查 30s 超时太短

**症状**: 部署到 test 时, 脚本最后一步 `wait_for_health` 30s 超时报警:

```
[2026-04-27T14:39:38] [INFO] 等待服务启动... (30/30s, HTTP 000000)
[2026-04-27T14:39:43] [ERROR] 健康检查超时 (30s), 最后状态: HTTP 000000
[2026-04-27T14:39:43] [WARN] [测试] 健康检查超时,请检查...
```

但服务实际**已经启动** — `journalctl` / log 显示 `Application startup complete` 在 `02:38:21` (~30s 后), `prometheus metrics loaded` 在 `02:39:51` (~70s 后).

**原因**: Python 服务启动慢 (8 个模块 + 食品 KB embedding + LLM warmup), 平均启动 60-90s. `wait_for_health 30s` 是 deploy-backend.sh (Java) 的默认值, 复用到 Python 不合适.

**修复**: 把 `deploy-smartbi-python.sh` 里 `wait_for_health $url 15 2` 改成 `wait_for_health $url 60 2` (60 retry × 2s = 120s 总等待).

**严重程度**: Low — 部署最终成功, 报警只是误报. 但会让人误以为部署失败, 触发不必要的 ssh 排查.

**LOC**: ~1 行改动.

### 3.2 deploy-web-admin.sh: 验证 URL 用错端口

**症状**: 部署 `--env test` 时, 脚本最后验证:

```
[14:39:00] 🔍 验证...
[14:39:02]    HTTP 200 (http://139.196.165.140:8086/)   ← prod 端口!
```

`--env test` 应该验证 `:8097` (test vhost), 但脚本验证 `:8086` (prod). 实际部署目标路径 `/www/wwwroot/web-admin-test/` 是对的, 只是验证 URL 写死了 prod.

**修复**: 在 deploy-web-admin.sh 里, `verify_url` 根据 `$ENV` 选 URL:
```bash
case "$ENV" in
  test) VERIFY_URL="http://139.196.165.140:8097/" ;;
  prod) VERIFY_URL="http://139.196.165.140:8086/" ;;
esac
```

**严重程度**: Low — 部署目标正确, 验证 URL 偏离造成"看起来 prod 也通了"假象, 容易在 test/prod 同名 vhost 时混淆故障源.

**LOC**: ~5 行改动.

### 3.3 prod_db 6 个 migrations 未应用

**状态**: 项目记忆载明 "Prod smartbi_prod_db: 0 migrations applied (Day 17+ DBA 任务)".

**未应用清单**:
- V20260430_01__c_field_provenance.sql (主表 + RLS + 索引)
- V20260501_01__c_provenance_columns_extension.sql (3 列 + CHECK)
- V20260501_02__c_factory_provenance_config.sql (Day 27 用)
- V20260501_03__c_admin_queue_field_conflict.sql
- V20260502_01__c_field_name_widen.sql (VARCHAR 100→200)
- V20260502_02__c_backfill_progress.sql

**前置**: BF2 backfill 也需要这些表存在.

**修复**: DBA 联络协调维护窗口, 跑 Flyway migrate. 30 分钟级.

**严重程度**: High — 阻塞 prod 部署. 直到这步完成, prod 上线只是部 FE (TrustIndicator 全 muted) + Python 端点 500 (如有 admin 调用 cell-audit / config).

---

## 4. 优先级建议

| 项 | 优先级 | 责任方 | 预估 |
|---|---|---|---|
| **3.3** Prod migrations 应用 | **P0** (阻塞 prod) | DBA + ops | 30 min + 24h soak |
| **2** Architecture α 修复 | **P1** (功能形同虚设) | Backend dev | 5 工作日 |
| **3.1** Python deploy timeout | P2 (DX 提升) | DevOps | 30 min |
| **3.2** web-admin verify URL | P2 (DX 提升) | DevOps | 30 min |

---

## 5. 真实窗口测试中确认的工作项 (无需修)

- 4 个 commit 的 vitest 18/18 PASS (Day 28 sweep)
- 4 个 commit 的 pytest C-suite 174 PASS (12 PG-required errors 是 local-no-tunnel canon, tunnel 上跑全 PASS)
- camelCase 链路完整 (Day 26 抓出的 snake-vs-camel bug 已经实战验证修复)
- JSONB value 解构 (`{"v": ...}` shape) 在 cell-audit 正确渲染
- Sentinel `source_upload_id=0` 不泄露 `__sentinel__` factory_id 或 `_sentinel_manual` file_name
- Source-type 中文翻译 (`product_summary→商品汇总` / `inferred→AI 推断` / `industry_default→行业默认值`) 全在 UI
- Superseded 链 + `已替换` orange tag 在历史表正确显示
- RBAC: factory_super_admin 通过 `_require_admin` + meta.roles, JWT user_id 写入 `updatedBy=1`
- Day 27 PUT 端到端: FE camelCase body → Pydantic ProvenanceConfigBody → UPSERT → invalidate_factory_config_cache → GET 回写 updatedAt 时间戳

---

## 6. 后续行动卡

- [ ] DBA: 安排维护窗口跑 6 个 C migrations on prod_db (P0)
- [ ] Backend: Option α 实施 (Phase 1-4, ~5 工作日)
- [ ] DevOps: deploy 脚本 nits 修 (3.1 + 3.2)
- [ ] (可选) 演练: Phase 1 完成后, 在 test 跑 SMARTBI_ENABLE_PROVENANCE=1 + 真实 Excel 上传, 验证 writer → provenance → FE 端到端
- [ ] 关闭本 ADR: 全部修完后 status 改 Closed

---

## 7. 参考

- 数据织网/04-C-字段血统与继承.md v1.4 §6 + §11.5 (上线计划)
- 数据织网/implementation/C-trust-ui-startup-prompt.md (Day 23-30 启动 prompt)
- 数据织网/implementation/C-pre-prod-blockers.md (Day 17+ blockers)
- backend/python/smartbi/gold/queries.py:94 (top_products 当前实现)
- backend/python/smartbi/canonical/silver_writers/product_summary_writer.py (Phase B writer)

---

**作者**: Claude (Opus 4.7) + 数据织网 C maintainer
**审阅**: 待
