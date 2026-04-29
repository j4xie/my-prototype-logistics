# qhj SmartBI RAG Polish — Next Session Handoff (2026-04-24)

**状态**: Apr 24 session 交付 25 bugs + 2 UX 方向 + 3 重大数据修。全部 prod live。19 commits on `e2e/v1-framework` (`a85d863d1` → `2b560fca3`) pushed to origin.

## 当前生产状态(admin.cretaceousfuture.com)

| 模板 | 状态 |
|---|---|
| store_performance | ✅ Top1 青花椒大丸百货店 ¥9.5M / 8 真门店 |
| staff_performance | ✅ Top1 服务员杨生 ¥2.83M / 17,179 单 |
| dish_sales_top_n | ✅ 招牌青花椒鱼 21,517 份 ¥1.48M / 603 菜品 |
| dish_slow_movers | ✅ 最末鸡丝笋子米粉 1 份 / 45 个月售<3 |
| store_performance 新建 | ✅ sim=1.0 |
| monthly_trend | ✅ 累计 36.18M / 峰值 2025-09-29 / 按周聚合 |
| monthly_anomaly | ✅ 异常月 4 个 / 最大波动 2025-05 +59.6% |
| weekday_weekend_pattern | ✅ 周末营收 37.22% / 客单价 199.96 vs 171.20 |
| channel_analysis | ✅ 堂食 44.47% 外卖 15.80% 人均 87.55/52.28 元 |
| payment_method_mix | ⚠️ 总计 88.6M(含券面值,非实收) |
| promotion_impact | ⚠️ 均优惠 ¥2,670.95(券面值) |
| reverse_checkout_stats | ✅ 1,020 笔 0.51% / 高发日月光店 |
| combo_usage_rate | ✅ 33,579 单 16.79% / Top 招牌青花椒鱼可乐套餐 |
| time_slot_revenue | ✅ 高峰宵夜大厅 ¥12.83M |
| dish_by_table_type | ✅ 3 桌型 大厅/外卖/散客 |
| revenue_management_report | ✅ 29.5M / 主导堂食晚市 46% (修前 122M) |
| profit_loss_statement | ✅ 毛 35.6M / 实 29.5M / 到账率 82.68% (修前 150M) |

## Deferred work(按优先级)

### P0 — 架构改动(~1-2 天)
**Direction 1 — 智能路由(N/freq/role 意图感知)**

当前痛点:
- `畅销品 Top 5` → template hardcoded Top 20 (用户看到 20 条)
- `营收最高的月` → 自动 weekly (200K 行 < 400天),答非所问
- `收银员绩效` → 返服务员杨生(template 固定优先 服务员 col)

方案:
1. 改 `AnalysisTemplate.compute()` 签名增加 `query: Optional[str] = None` param
2. 35 templates 都要更新(大部分 no-op)
3. Router 在 intent detect 时把 query 原文 passthrough
4. 关键模板实施:
   - dish_sales_top_n: parse `Top (\d+)` → 动态截断 ranking
   - monthly_trend: detect 月/周/日 意图 → override freq
   - staff_performance: detect 服务员/销售员/收银员 → choose role_col

**Direction 4 — 反馈环 promotion pipeline**

- 👎 feedback 自动 cluster by similarity → propose sample_queries
- 高频 LLM query cluster → propose new template
- Admin UI: `/smart-bi/feedback-proposals` 审批页
- 需要:backend API + Vue page + cron job
- 参考现有 FallbackLogAdmin.vue

### P1 — 领域校准(需与 qhj 确认)
- **payment_method_mix 88.6M vs 29.5M**: 代金券面值 vs 实收。选项:
  - 改 label:"总计" → "券面值合计"
  - 或加实收折算:美团券 × 商家实收率(qhj 需提供 per-channel 折算表)
- **菜品归一化**: `招牌青花椒鱼(微麻微辣)(一吃）` / `(二吃)` / `(二吃特价)` 被分为独立菜品。qhj 需要:
  - 提供菜品 SKU → 基础名映射表,或
  - 启用 dish_name regex 去除 `(*做法*)` 后缀统一
- **channel_analysis 客单价 87.55/52.28 元**: 可能是 revenue/customer_count 而非 /order_count。需确认定义。

### P2 — LLM 安全
- **幻觉 guardrail**: 2 次观察到 `Top5 合计 3.4 亿元`(实际 36M 总营收,10× 夸大)。修:
  - prompt 加硬约束:"Every number in your answer MUST be traceable to agg_meta. Do NOT multiply/extrapolate."
  - 或 post-process:regex 查 `\d+.*亿` 与 total_revenue 做 sanity check

### P2 — 持续优化
- 新建模板: turnover(翻台率)/reviews_external(外部评论)/single_store_detail(单店深度)
- qhj 23 个 field_defs 的 category 修正(少数 misclassified)
- agg_meta prompt 压缩(当前给 LLM 的 context 中有冗余维度列表)

## 快速接力命令

```bash
# 当前分支
cd C:/Users/Steve/my-prototype-logistics && git status
# Branch: e2e/v1-framework
# HEAD: 2b560fca3 fix(smartbi-rag): time_slot_revenue — add 5 query variants

# 部署流程
./scripts/deploy/deploy-smartbi-python.sh --env prod

# 每次 sample_queries 改动后必须重建 embeddings
ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_prod_db -c 'TRUNCATE smart_bi_template_embeddings;' && systemctl restart cretas-python"

# 每次模板 compute 逻辑改动后必须重 materialize upload 4169
# 在浏览器 console 执行(有 JWT):
# fetch('/api/smartbi/analytics/materialize/4169', {method:'POST', headers:{'Authorization':'Bearer '+localStorage.getItem('cretas_access_token')}})

# 查 RAG 路由日志
ssh root@47.100.235.168 "grep '\[hybrid-rag\]' /www/wwwroot/cretas/python-prod.log | tail -10"

# 查 LLM fallback 数据
ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_prod_db -c \"SELECT created_at, LEFT(query, 60), LEFT(answer, 100) FROM smart_bi_llm_fallback_log ORDER BY created_at DESC LIMIT 20;\""
```

## 关键学习点

1. **Sentinel row 通用模式**: qhj 每个 export 文件里含 1 行 桌位=null + revenue=全库累积。用 `rev > 10M` 哨兵过滤,3 模板都生效。
2. **Embedding populate 启动栅栏**: count < 1 时才运行。改 sample_queries 后必须 TRUNCATE + restart 才会更新。
3. **classify_table regex 是常被忽略的 calibration 点**: 不同连锁用不同桌号格式。目前支持 A1/B11 + 纯数字 + 包厢 + 外卖 4 类。下次新客户接入前先跑 `_DBG_OTHER_SAMPLES` 诊断。
4. **UX presets 影响发现率**: 8 preset buttons 替换掉后用户直接能看到餐饮相关问法,降低"系统不懂我"的感觉。autocomplete ⚡秒回 tag 视觉暗示"这些会快"。
5. **相关追问跨维度**: 每 template 配 3 条 *其他* 维度问题(不是同 template 变体)。避免用户 Q&A 卡在单维度视角。
