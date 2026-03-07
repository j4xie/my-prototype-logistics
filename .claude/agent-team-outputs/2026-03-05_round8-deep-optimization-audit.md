# Round 8 深度优化审计 — 最终整合报告

**日期**: 2026-03-05
**模式**: Full (3 Researchers + Analyst + Critic + Integrator)
**范围**: Python 服务 / Java 后端 / Vue 前端

---

## Executive Summary

覆盖 Java 后端、Python 服务、Vue 前端三层，共识别 23 项发现。经 Critic 代码验证后，原始 3 个 P1 均被降级：级联删除因 `@SQLDelete` 软删除机制降至 P3，长事务因低并发+缓存降至 P2，N+1 因已有 `@BatchSize` 缓解降至 P2。**最终：0 P1、6 P2、7 P3**。系统整体健壮性良好，当前用户规模下无紧急风险。

---

## Consensus Map

| 发现 | Analyst 评估 | Critic 评估 | 最终裁定 | 依据 |
|------|-------------|-------------|----------|------|
| AIEnterpriseService @Transactional 包裹 LLM 调用 | P1 (连接池耗尽) | P2 (缓存+配额+低并发) | **P2** | 缓存命中率高、配额限制、<50用户 |
| User.java 11个 CascadeType.ALL | P1 (级联误删) | P3 (@SQLDelete 软删除) | **P3** | BaseEntity@SQLDelete 确保软删除，数据不会丢失 |
| DahuaDevice/IsapiDevice/MaterialBatch N+1 | P1 (性能瓶颈) | P2 (@BatchSize 缓解) | **P2** | @BatchSize(20)已缓解，但应补@JsonIgnore |
| df.eval(formula) 注入 | P2 (代码注入) | 无风险 (死代码) | **P3** | calculate_derived_columns 无调用者 |
| exec() 沙箱 | P2 (RCE风险) | P3 (LLM生成+AST白名单) | **P3** | 有防护，输入来自LLM非用户 |
| 硬编码 secret/JWT 默认值 | P2 | 未质疑 | **P2** | 共识 |
| 4表零索引 | P2 | 未质疑 | **P2** | 共识 |
| ConcurrentMapCache 无 TTL/容量 | P2 | 未质疑 | **P2** | 共识 |
| cross_sheet del→pop | P2 | 未质疑 | **P2** | 共识 |
| chart/builder.py NaN泄漏 | P2 | 未质疑 | **P3** | 仅新版builder受影响 |
| SSE 无 AbortController | P2 | P3 | **P3** | 需进一步验证实际影响 |
| CORS ["*"] | P3 | 未质疑 | **P3** | 共识 |
| Excel 上传无大小校验 | P3 | 未质疑 | **P3** | 共识 |

---

## Final Priority & Action Plan

### P2 Issues (6 项)

| # | Issue | 文件 | 工作量 | 修复方案 |
|---|-------|------|--------|----------|
| 1 | 硬编码 internal secret | `auth_middleware.py:102`, `config.py:51` | 30min | 替换为纯环境变量，删除默认值 |
| 2 | cross_sheet 并发 KeyError | `cross_sheet_aggregator.py:103` | 5min | `del dict[k]` → `dict.pop(k, None)` |
| 3 | ConcurrentMapCache 无上限 | `CacheConfig.java:150` | 2h | 切换 Caffeine + maxSize + expireAfterWrite |
| 4 | 4表零索引 | TimeClockRecord/LineSchedule/WorkerAssignment/SchedulingPlan | 1h | ALTER TABLE 添加复合索引 |
| 5 | N+1 缺 @JsonIgnore | DahuaDevice/IsapiDevice/MaterialBatch | 1h | @OneToMany 集合加 @JsonIgnore |
| 6 | @Transactional+LLM长调用 | AIEnterpriseService/ConversationService | 3h | 拆分事务（条件性，先查日志） |

### P3 Issues (7 项)

| # | Issue | 文件 | 工作量 |
|---|-------|------|--------|
| 7 | chart/builder.py NaN清理 | `chart/builder.py` | 30min |
| 8 | df.eval 死代码 | `fixed_executor.py:1033-1069` | 15min (删除) |
| 9 | exec()沙箱补充测试 | `data_cleaner.py:751` | 1h |
| 10 | Excel上传大小校验 | `api/excel.py` | 1h |
| 11 | CORS收窄 | `config.py:60` | 30min |
| 12 | CascadeType.ALL收窄 | `User.java:119-170` | 4h |
| 13 | SSE AbortController | `SmartBIAnalysis.vue:1804` | 1h |

---

## Positive Findings (做得好的地方)

### Java 后端
- 零 `FetchType.EAGER` — 所有关系均 LAZY
- `@BatchSize(20)` 已配置 — 缓解 N+1
- Hibernate `batch_size=100` + `order_inserts/updates=true`
- HikariCP 双池隔离（主库30 + SmartBI 15）
- 30+ 缓存命名空间分级 TTL (1min ~ 7days)
- 生产慢查询日志已启用 (500ms)
- `BaseEntity` 统一软删除保护

### Python 服务
- LLM API 全链路 timeout (30-120s) + retry
- Forecast 已有期数限制 (1-24)
- 大数据集已有降采样 (10k行)
- 旧版 chart_builder 已有 NaN 清理

### Vue 前端
- 所有 setInterval 正确清理
- 所有 ECharts 正确 dispose
- addEventListener/removeEventListener 32/32 完全匹配
- 所有 v-html 经 DOMPurify.sanitize
- AIQuery.vue AbortController 教科书实现
- keep-alive 三级生命周期管理正确
- Props 全部 TypeScript 泛型定义

---

## Cross-Cutting Patterns

### 1. 长操作持有资源不释放 (Java + Vue)
- Java: @Transactional 包裹 LLM 5-30s 调用
- Vue: SSE fetch 无 AbortController
- **根因**: 外部 IO 未与资源生命周期解耦

### 2. 无界数据加载 (Python + Java)
- Python: file.read() 无大小限制
- Java: 无界 List<Entity> 返回
- **根因**: 缺少防御性边界

### 3. 缓存/并发安全 (Python + Java)
- Python: dict.del 并发 KeyError
- Java: ConcurrentMapCache 无容量限制
- **根因**: 降级路径未考虑生产负载

---

## Open Questions

1. **生产日志是否有 HikariPool leak-detection 告警？** — 决定 #6 事务拆分优先级
2. **CORS `["*"]` 的 Python 服务是否仅内网可达？** — Nginx 已限制则风险降低
3. **测试环境 ddl-auto=update 是否导致 schema 漂移？**
4. **Excel 全局单例在多 worker 部署下是否触发过竞态？**
5. **User 级联关联的孤儿记录是否累积？**

---

## Process Note

- Mode: Full
- Researchers: 3 (Python / Java / Vue)
- Total findings: 23 (10 Python + 13 Java + 7 Vue → 13 after reconciliation)
- Key disagreements: 3 resolved (Critic downgraded 2 P1s + 1 P2 with code evidence)
- Phases: Research (parallel) → Analysis → Critique → Integration → Heal
- Healer: 5/5 checks passed
