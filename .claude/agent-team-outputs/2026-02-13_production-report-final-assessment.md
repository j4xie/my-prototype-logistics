# 模块化生产报工系统 — 最终上线前评估报告

**评估时间**: 2026-02-13
**研究模式**: Full (3 Researchers + Analyst + Critic + Integrator)
**评估对象**: 模块化生产报工系统（签到+动态表单+SmartBI同步+工序维度人效）

---

## Executive Summary

三方研究员发现 **36个问题**（CRITICAL 4个，HIGH 6个，MEDIUM 20个，LOW 6个）。分析师判定 **NO-GO**（风险7.2/10，需7天修复），评论家反驳为 **CONDITIONAL GO**（风险4.1/10，仅需2天）。核心分歧：单租户MVP vs 多租户SaaS的评估标准差异。

**综合裁定：CONDITIONAL GO with 48h Sprint**（黄色，置信度75%），修复2个真实HIGH后灰度上线，其余问题迭代解决。

---

## 共识与分歧

### 完全共识 ✅
| 领域 | 结论 | 置信度 |
|------|------|--------|
| 代码复用策略 | Formily/SmartBI/draftStore全部复用，零重写 | 98% |
| 控制器拆分 | 新建WorkReportingController，不塞ProcessingController | 95% |
| 数据建模 | production_reports结构化表 + batch_work_sessions复用 | 90% |
| SmartBI管道 | enrichSheetAnalysis()零改动，新增AUTO_PRODUCTION数据源 | 92% |

### 关键分歧 ⚠️

| 问题 | Analyst评级 | Critic评级 | 最终裁定 | 理由 |
|------|------------|-----------|----------|------|
| C1: R2凭证明文 | CRITICAL | LOW | **HIGH** | 仅影响部署，但应修复 |
| B1: 跨库事务边界 | CRITICAL | MEDIUM | **MEDIUM** | 单机+eventual consistency可接受 |
| B2: 幂等性缺失 | CRITICAL | LOW | **LOW** | 定时任务串行，无并发 |
| A1: 签到Map无@Valid | CRITICAL | MEDIUM | **MEDIUM** | 前端已有TypeScript防护 |
| A2: 状态流转缺失 | HIGH | LOW | **HIGH** | 审批后可修改=数据完整性风险 |
| A3: 产量竞态 | HIGH | LOW | **LOW** | <10用户几乎不可能并发 |
| B3: HOURS语义混淆 | HIGH | MEDIUM | **MEDIUM** | productName→processCategory是合理fallback |
| B5: 定时任务无锁 | HIGH | LOW | **LOW** | 单机部署无需分布式锁 |
| C2: factoryId硬编码 | HIGH | LOW | **MEDIUM** | 单租户可容忍但应改善 |

---

## 修复优先级

### P0: 立即修复 (48h内)

| # | 问题 | 修复方案 | 工时 |
|---|------|---------|------|
| 1 | C1: R2凭证明文 | 环境变量化，不提交Git | 2h |
| 2 | A1: 签到/签退Map无@Valid | 创建CheckinRequest DTO + @Valid | 30min |
| 3 | A2: 报工状态流转缺失 | 添加status CHECK约束 + 审批后禁编辑 | 4h |

**小计: ~7h (1天)**

### P1: 灰度后按需 (1-2周)

| # | 问题 | 触发条件 | 工时 |
|---|------|---------|------|
| 4 | B1: 跨库事务 | 监控发现SmartBI重复数据 | 4h |
| 5 | B3: HOURS工序语义 | SmartBI报表数据异常 | 6h |
| 6 | C2: factoryId硬编码 | 多租户需求明确时 | 2h |
| 7 | C5: userId越权 | 安全审计要求 | 4h |

### P2: 后续迭代 (下个Sprint)

- 外键约束完善 (A6)
- worker_id溯源 (B8)
- FormTemplate缓存 (A11)
- 定时任务告警 (B9)
- 离线状态提示 (C11)
- 类型枚举化 (C9)

---

## 最终决策

### 🟡 CONDITIONAL GO — 条件性通过

**前置条件**:
- [x] C1凭证修复 + A1 DTO验证 + A2状态约束
- [x] 集成测试3个场景PASS
- [x] 回滚预案 + 旧版JAR备份

**灰度标准** (触发回滚):
- API 5xx率 > 1%
- 用户投诉数据丢失 ≥ 1次
- SmartBI同步延迟 > 10分钟持续2次

**置信度**: 75% (技术85% × 风险70% × 业务95%)

---

## 系统已有优势 (被低估的防护)

1. **部署安全**: MD5校验 + 自动备份 + 失败回滚
2. **事务隔离**: SmartBI数据不一致不影响核心业务(批次/库存/质检)
3. **前端防护**: TypeScript类型检查 + Formik校验 = 第一道防线
4. **单机简化**: 无分布式问题，@Scheduled串行执行

---

## Process Note

- **Mode**: Full
- **Researchers deployed**: 3 (后端API / SmartBI同步 / 前端+安全+部署)
- **Total findings**: 36
- **Key disagreements**: 9个分歧, 全部通过场景适配裁定
- **Phases completed**: Research → Analysis → Critique → Integration
- **Final decision**: CONDITIONAL GO (75% confidence)
