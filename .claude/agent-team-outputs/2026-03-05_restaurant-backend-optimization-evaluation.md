# 餐饮运营分析后端优化评估

**日期**: 2026-03-05
**模式**: Full (3 Researcher + Analyst + Critic + Integrator)
**目标文件**: `backend/python/smartbi/services/restaurant_analyzer.py`, `backend/python/smartbi/api/restaurant_analytics.py`

---

## 执行摘要

11 项优化（Round 6: 6项 + Round 7: 5项）**全部正确落地**，综合评分 **6.5/10**（优化前约 3/10）。核心改进：N+1 查询消除、共享预计算、ORM 列精简、np.select 向量化。剩余两个 **P1 问题**需立即修复：`async def` + 同步 DB 阻塞事件循环；餐饮分析路由跳过 JWT 认证。

---

## 共识发现（三方一致，置信度 >= 90%）

| # | 发现 | 置信度 | 代码位置 |
|---|------|--------|----------|
| 1 | N+1 -> 批量 IN + set 查找正确 | 95% | `restaurant_analytics.py:111-123` |
| 2 | store_disc_df 共享预计算消除重复 groupby | 95% | `restaurant_analyzer.py:132-139` |
| 3 | SELECT 单列 row_data 减少 ORM 开销 | 95% | `restaurant_analytics.py:38-43` |
| 4 | np.select 向量化替代 apply | 90% | `restaurant_analyzer.py:187-191` |
| 5 | df.copy() 防 caller 被修改 | 95% | `restaurant_analyzer.py:109` |
| 6 | 死代码/死导入已清除 | 95% | 两文件均确认 |
| 7 | fillna(0) 正确处理 NaN（驳回 NaN 泄漏说） | 95% | `restaurant_analyzer.py:114` |
| 8 | 除零保护正确 | 95% | `restaurant_analyzer.py:139,243` |
| 9 | **async def + sync DB 阻塞事件循环** | 90% | `restaurant_analytics.py:95,211,232` |
| 10 | **认证绕过（PUBLIC_PREFIXES）存在隐患** | 85% | `auth_middleware.py:56` |

---

## 分歧裁定

| 分歧点 | 立场 A | 立场 B | 裁定 | 理由 |
|--------|--------|--------|------|------|
| OOM 风险严重程度 | P2 (300-400MB) | P3 (40-80MB) | **P3** | 典型餐饮 POS 数据 1k-5k 行，5 万行约 40-80MB |
| 安全风险等级 | P0/P1 | P1 | **P1** | 数据为聚合指标非 PII，upload_id 不可枚举 |
| consistencyScore 语义 | Bug | 合理指标 | **P3 文档修复** | per-product revenue CV 衡量菜品营收分布稳定性，有业务意义 |
| 综合评分 | 6/10 | 6.5-7/10 | **6.5/10** | 11 项正确但两个 P1 尚存 |

---

## 置信度评估

| 维度 | 置信度 | 说明 |
|------|--------|------|
| 11 项优化正确性 | **95%** | 源码逐行验证，三方无异议 |
| async/sync 阻塞影响 | **85%** | uvicorn 单事件循环下确认的生产性能瓶颈 |
| 安全风险评估 | **75%** | 确实存在未授权访问，但影响因数据类型而有限 |
| OOM 风险 | **30%** | 典型场景下极不可能触发 |
| 性能提升幅度 | **80%** | N+1 消除和 SELECT 精简对列表页有显著提升 |

---

## 建议优先级

### P1 立即执行

1. **修复 async/sync 不匹配** — 将 3 个 `async def` 改为 `def`
   - 文件：`restaurant_analytics.py:95,211,232`
   - FastAPI 自动在线程池执行同步函数，不阻塞事件循环
   - **Critic 评价**：比所有 Round 6+7 优化加起来对并发性能影响更大

2. **修复认证绕过** — 从 `PUBLIC_PREFIXES` 移除餐饮分析路由
   - 文件：`auth_middleware.py:56`
   - 改为要求 JWT 认证

### P2 短期执行 (1-2周)

3. **添加 upload_id 归属校验**（IDOR 防护）
4. **添加缓存 TTL**（24h 过期）

### P3 条件执行

5. **consistencyScore 注释修正** — `restaurant_analyzer.py:387`
6. **_fallback_product_col 改用正则** — `restaurant_analyzer.py:406`
7. **汇总行过滤增强** — `restaurant_analyzer.py:120`

---

## 开放问题

1. 为何选择 PUBLIC_PREFIXES 而非 JWT？是否有公开分享链接需求？
2. `_store_comparison:255` 和 `_category_breakdown:288` 仍使用 iterrows，是否也应向量化？
3. 缓存失效策略：同一 Excel 重新上传后旧缓存如何清理？

---

## 已完成优化清单 (11/11 verified)

### Round 6 (6 fixes)
1. N+1 -> batch IN 查询 (P1 性能)
2. 共享 store_disc_df 预计算 (P1 性能)
3. 死导入清理: BaseModel, List, exists (P3 代码质量)
4. numpy 导入清理 (P3 代码质量) — 后在 Round 7 恢复用于 np.select
5. df.copy() 防止 caller 被修改 (P2 正确性)
6. 参数精简 (P3 代码质量)

### Round 7 (5 fixes)
1. ORM SELECT 单列 row_data (P1 性能)
2. np.select 向量化 + zip 构建字典 (P2 性能)
3. 死导入 detect_restaurant_chain (P3 代码质量)
4. exclude set 过滤 None (P3 正确性)
5. _dianping_gaps 参数精简 (P3 代码质量)

---

### Process Note
- Mode: Full | Language: Chinese
- Researchers: 3 (parallel) | Analyst: 1 | Critic: 1 | Integrator: 1
- Total codebase evidence items: ~28
- Disagreements: 3 resolved, 0 unresolved
- Healer: 5/5 checks passed
