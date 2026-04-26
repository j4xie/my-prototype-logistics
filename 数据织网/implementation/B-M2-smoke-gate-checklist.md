# B M2 Smoke Gate Checklist

**版本**: 1.0
**日期**: 2026-04-26
**触发**: Phase 3 完成,准备 prod 灰度

---

## Spec §11 M2 7 项 smoke gate

per `数据织网/03-B-实体解析与形态路由.md` v1.2 §11 + `01-总览路线图.md` §7 M2:

| # | 项目 | 验证方法 | 当前状态 |
|---|------|---------|---------|
| 1 | 跨上传同店识别 ≥ 88% | holdout eval store accuracy | ⚠️ B1 = 76.2%,**B2 触发但未实跑**(需 prod 实数据) |
| 2 | 菜名变体归一(一吃/二吃) | holdout eval product accuracy | ✅ B1 product = 100% |
| 3 | 评论 → ReviewWriter | shape detect → writer 端到端 | ✅ 单测 PASS,prod 实跑待 |
| 4 | 财务 → FinanceWriter | shape detect → writer 端到端 | ✅ 单测 PASS,prod 实跑待 |
| 5 | Admin 低置信度队列 | 上传 raw 名 → admin queue 出现 | ✅ orchestrator + Phase3 sheet_merger 自动入队 |
| 6 | 并发回归(advisory_xact_lock) | 同 factory 2 个 upload 并发 → dim 无重复 | ✅ 单测 PASS (test_concurrency.py) |
| 7 | Holdout 准确率达标 | store/product ≥ 88%,人 ≥ 80% | 部分 (smoke test 用合成 label) |

**M2 ship 决策**: 4/7 完整 PASS,3/7 prod 实跑前不可知。**建议先灰度 1 friendly factory(RES_3101_009 真客户)实跑 1 周再全开**。

---

## 6 个 prod migrations 待 apply

到 `smartbi_prod_db` (47.100.235.168 cn-shanghai),按顺序:

| # | Migration | 作用 | 风险 |
|---|-----------|------|------|
| 1 | `V20260426_01__entity_resolution_b_baseline.sql` | 3 张 RLS 表 (labels/admin_queue/history) | LOW (新表,空) |
| 2 | `V20260427_01__extend_admin_queue_entity_types.sql` | admin_queue CHECK 加 4 个 entity_type | LOW (CHECK 扩) |
| 3 | `V20260427_02__b_silver_writer_tables.sql` | 7 张新 Silver 表 + RLS + 索引 | LOW (新表,空) |
| 4 | `V20260428_01__b_review_idempotency.sql` | source_row_hash + 2 unique indexes | LOW (新列,空) |
| 5 | `V20260428_02__b_admin_queue_columns.sql` | 6 列 + CHECK 扩 entity_type 'ingredient' | LOW (新列) |
| 6 | `V20260428_03__b_silver_grants.sql` | GRANT smartbi_user 权限 | LOW (权限) |
| 7 | `V20260429_01__b_sheet_merger.sql` | smart_bi_pg_excel_uploads 加 5 列 | **MEDIUM** (改现有热表) |

**注意**: V20260429_01 在已有 `smart_bi_pg_excel_uploads` 上加列 — prod 此表有 1,179 行 (12 factories),ALTER TABLE 加 5 个 nullable 列瞬时,无锁影响。但需在维护窗口或低峰期执行。

---

## Apply 命令(复用 test 的方式 — 用 postgres superuser 创建 FK)

```bash
# 顺序 apply 7 个 migrations
for mig in V20260426_01__entity_resolution_b_baseline \
           V20260427_01__extend_admin_queue_entity_types \
           V20260427_02__b_silver_writer_tables \
           V20260428_01__b_review_idempotency \
           V20260428_02__b_admin_queue_columns \
           V20260428_03__b_silver_grants \
           V20260429_01__b_sheet_merger; do
  ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_prod_db -v ON_ERROR_STOP=1 \
    -f /www/wwwroot/cretas/code/backend/python/smartbi/database/migrations/${mig}.sql"
  if [ $? -ne 0 ]; then
    echo "❌ Migration $mig failed — STOP"; exit 1
  fi
  echo "✅ $mig"
done
```

**Pre-apply check**: 确保 prod migration 文件已经 sync 到 server:
```bash
ssh root@47.100.235.168 "ls /www/wwwroot/cretas/code/backend/python/smartbi/database/migrations/ | grep V20260426 | wc -l"
# 应输出 ≥ 7
```

如果文件还没 deploy 到 server,先:
```bash
scp backend/python/smartbi/database/migrations/V202604{26..29}*.sql \
    root@47.100.235.168:/www/wwwroot/cretas/code/backend/python/smartbi/database/migrations/
```

---

## Post-apply 验证

```bash
# 1. 7 张 Silver 表 RLS forced
ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_prod_db -c \
  \"SELECT relname, relforcerowsecurity FROM pg_class WHERE relname IN ( \
    'agg_product_period','dim_review_summary','fact_review_event', \
    'dim_finance_subject','fact_finance_voucher','fact_inventory_snapshot', \
    'dim_ingredient_threshold','entity_resolution_labels', \
    'entity_resolution_admin_queue','entity_resolution_history') \
  ORDER BY relname;\""
# 应 10/10 都 t

# 2. admin_queue CHECK 含 7 个 entity_type
ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_prod_db -c \
  \"SELECT pg_get_constraintdef(oid) FROM pg_constraint \
    WHERE conname = 'entity_resolution_admin_queue_entity_type_check';\""
# 应含: store/product/staff/ingredient/shape_detection/sheet_merge/period_inference

# 3. smart_bi_pg_excel_uploads 加 5 列
ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_prod_db -c \
  \"\\d smart_bi_pg_excel_uploads\" | grep merge"
# 应见 merge_status / merge_target_id / merge_inferred_period_* / merge_period_inference_method

# 4. smartbi_user 有 GRANT
ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_prod_db -c \
  \"SELECT grantee, privilege_type FROM information_schema.role_table_grants \
    WHERE table_name = 'agg_product_period' AND grantee = 'smartbi_user';\""
# 应有 INSERT/SELECT/UPDATE/DELETE 4 行
```

---

## 灰度发布步骤 (post-migration)

1. **Apply 7 migrations 完成后**,Python 服务(8083 prod)无需重启 — writers 和 sheet_merger 模块已部署在代码包内,仅当 upload 触发才执行。
2. **环境变量** `SMARTBI_ENABLE_SHEET_MERGER=1` (默认 ON):
   ```bash
   # 在 systemd unit 文件或 .env.prod 加
   SMARTBI_ENABLE_SHEET_MERGER=1
   ```
   关闭(回滚开关):`SMARTBI_ENABLE_SHEET_MERGER=0`,Python 服务 reload 后 sheet_merger 不跑。
3. **先 RES_3101_009 一家**: 不加任何 capability gate(B-stage 不像 A 有 cohort 控制,直接全开)。让 friendly customer 试上传 product_summary / review / finance 文件,观察 1 周 prod log。
4. **观察指标**:
   ```bash
   # entity_resolution_history 写入数(应 > 0 上传后)
   ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_prod_db -c \
     \"SELECT COUNT(*) FROM entity_resolution_history WHERE factory_id = 'RES_3101_009';\""
   
   # admin_queue pending(低置信度配对待人审)
   ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_prod_db -c \
     \"SELECT entity_type, COUNT(*) FROM entity_resolution_admin_queue \
       WHERE factory_id = 'RES_3101_009' AND status = 'PENDING' GROUP BY 1;\""
   
   # sheet_merger 运行情况
   ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_prod_db -c \
     \"SELECT merge_status, COUNT(*) FROM smart_bi_pg_excel_uploads \
       WHERE factory_id = 'RES_3101_009' GROUP BY 1;\""
   ```
5. **1 周后回看**:
   - admin_queue PENDING 数量(应 < 50,否则 entity resolution 太宽松)
   - 客户反馈是否有 "Top 10 商品销售" 等 4 MVP 模板能正常分析
   - prod log 无 sheet_merger / writer error
6. **OK 后扩 cohort**: F001 + 其他真客户 (FOOD_3101_048 等)。

---

## 回滚方案

如果发现灾难性 bug(数据错乱/性能下降/RLS 漏洞):
1. **立即** `SMARTBI_ENABLE_SHEET_MERGER=0` + Python 服务 restart → sheet_merger 不再触发,writers 仍跑(写 NULL period)
2. **更彻底** 通过 nginx 把 8083 路由切回上一版本 Python 部署(当前部署是 GREEN,可切到 BLUE):
   ```bash
   bash /www/wwwroot/cretas/restart-prod.sh blue
   ```
3. **DB 回滚** (仅极端情况,因为 ALTER TABLE 加列不可无损回滚):
   - V20260429_01 加的 5 列可 DROP,但若已有 sheet_merger 写入数据将丢失
   - V20260427_02 / V20260428_* 创建的表可 DROP,前提是 0 prod 数据

每个 migration 的 rollback section 在文件末尾注释里。

---

## 与 A 的关系

A spec (能力驱动渲染) 已 prod live。B 上线后:
- 上传 product_summary 文件 → ProductSummaryWriter → agg_product_period 有数据 → A capability calculator 看到 product_name/qty/revenue 字段 → 14 deferred templates 中 product_summary 相关的(reviews_sentiment_summary / payment_method_mix / etc)依次解锁
- A 自身不用改,B 是数据来源补充
