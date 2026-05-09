# T6.5 Phase C Sub-Q — SmartBI 子模块 entity/dto orphan sweep 审计

**Date**: 2026-05-10
**Branch**: `ops-t6-5-phase-c-sub-q-entity-orphan-sweep`
**Owner**: chat1 reuse (Round 3 Sub-Q)
**Predecessors**: PR #227 (Phase C MO), PR #248 (Sub-E template, v3 protocol),
PR #178 (Phase A audit), PR #236 (Sub-A), PR #243 (Sub-B), PR #244 (Sub-C),
PR #245 (Sub-D), PR #246 (Sub-F), PR #242 (Sub-G), Sub-K (chat5, in flight on `SmartBiQueryTemplate`).

---

## 1. 任务范围 (Scope)

**目标**：扫描 `entity/smartbi/*` + `dto/smartbi/*` 全部 .java，找出**没有 alive consumer** 的 orphan，单 PR 删除。

**Out of scope**：
- `repository/smartbi/*` ← 仅删除作为 entity 删除 collateral 的 dead Repository（不删除 Repository 本身就活着的）。
- `entity/smartbi/SmartBiQueryTemplate.java` ← Sub-K (chat5) 单独处理。
- 其他 service / controller / Python 端代码。

---

## 2. 方法 (v3 protocol — 含 internal self-reference 检查)

### 2.1 步骤

1. **枚举**：`find entity/smartbi dto/smartbi -name "*.java"` → **102 files** total。
2. **外部 grep**：每个 class 在整个 `backend/java/cretas-api/src` 范围 grep `\b<ClassName>\b`，排除 self-file，统计 `ExtRefs` 命中文件数。
3. **0-ExtRef 候选**：直接候选 DELETE，但要验证 self-file 内的方法不是公开 API 假装 dead（factory `of()` 等）。
4. **1-ExtRef 候选 (dead-chain 风险)**：若唯一 consumer 是 Repository / 同包 DTO，递归追 consumer 的 consumer，确认链路全 dead 才 DELETE。
5. **Internal self-reference grep (v3 必须)**：被删 entity 的 import 列表 — 防止漏删 dead-chain 配套 enum / Repository。
6. **Test grep**：`src/test` 单独再 grep 一次，避免漏 test consumer。
7. **Resource / FQN 字符串 grep**：`grep -r "com.cretas.aims..."` 防 reflection / Spring config 引用。

### 2.2 v3 protocol — internal self-reference

参考 PR #248 v3 修订经验。本次扫描的 dead-chain 链路：

| 入口 | Internal imports | 链路 |
|---|---|---|
| `SmartBiAnalysisConfig` | `BaseEntity`, `AnalysisConfigType` | entity → enum (AnalysisConfigType) → Repository |
| `SmartBiShareToken` | `BaseEntity` | entity → Repository |
| `AnalysisRequest` | (none) | standalone |
| `DrillDownResponse` | (none) | standalone |

`BaseEntity` 是项目基类，任何被删 entity 都会引用，不影响别的 entity → 不在 collateral 范围。

---

## 3. 审计结果汇总

### 3.1 全 102 文件统计 (ExtRef 分布)

```
ExtRefs=0   :  3 files
ExtRefs=1   :  7 files (其中 2 是 dead-chain)
ExtRefs=2-5 : 35 files (KEEP — service / repo / controller / sister-DTO 引用)
ExtRefs>=6  : 57 files (KEEP — 高度复用的核心 DTO/entity)
```

### 3.2 DELETE list (7 files, -760 LOC)

| # | File | LOC | 类型 | DELETE 依据 |
|---|---|---:|---|---|
| 1 | `dto/smartbi/AnalysisRequest.java` | 211 | DTO | 0 ext refs；只有 self-file factory 方法引用自身类型 (`of()` / `thisMonth()` 等返回 `AnalysisRequest`) |
| 2 | `dto/smartbi/DrillDownResponse.java` | 169 | DTO | 0 ext refs；同上模式 (`of()` / `bottomLevel()` 返回自身) |
| 3 | `entity/smartbi/SmartBiAnalysisConfig.java` | 125 | Entity | 唯一 ext ref 是 `SmartBiAnalysisConfigRepository`，Repository 自身 0 ext ref → 整链 dead |
| 4 | `entity/smartbi/enums/AnalysisConfigType.java` | 35 | Enum | 仅被 `SmartBiAnalysisConfig` + `SmartBiAnalysisConfigRepository` 引用，两者均 dead → enum 也 dead |
| 5 | `repository/smartbi/SmartBiAnalysisConfigRepository.java` | 142 | Repository | 0 ext refs；entity 删除强制 collateral |
| 6 | `entity/smartbi/SmartBiShareToken.java` | 58 | Entity | 唯一 ext ref 是 `SmartBiShareTokenRepository`，Repository 自身 0 ext ref → 整链 dead |
| 7 | `repository/smartbi/SmartBiShareTokenRepository.java` | 20 | Repository | 0 ext refs；entity 删除强制 collateral |

**总计**：-760 LOC，2 个 entity dead-chain (含 1 个 enum + 2 个 Repository) + 2 个 standalone DTO orphan。

### 3.3 DEFER list (1 file, Sub-K territory)

| File | 转交对象 | 备注 |
|---|---|---|
| `entity/smartbi/SmartBiQueryTemplate.java` | Sub-K (chat5) | 0 ext refs，但 marching order §1 明确划归 Sub-K，本 PR 不动 |

### 3.4 KEEP rationale (95 files)

样本 spot-check：

| File | ExtRefs | 主要 consumer |
|---|---:|---|
| `DashboardResponse.java` (DTO) | 29 | composite chain — Java SmartBI controller / service / `/analysis/*` 全链 |
| `ActionType.java` (enum) | 25 | 全 Phase 2A audit log + Tool-Skill ActionType 引用 |
| `MetricResult.java` (DTO) | 24 | analysis 5 子域 (sales/finance/department/region/inventory) 共用 |
| `ChartConfig.java` (DTO) | 24 | Phase 2A byte-shape parity 依赖；Lombok+Jackson Rule 9 baseline |
| `RankingItem.java` (DTO) | 22 | finance 应收 / 销售客户排行等多处 |
| `SmartBiSalesData.java` (entity) | 12 | 销售 Bronze/Silver 表，Restaurant Plan C alive |
| `SmartBiFinanceData.java` (entity) | 11 | 财务 Bronze/Silver 表，Phase 2A 50 endpoint 大量直接 query |

仅展示 high-ref 样例 — full table 见 `/tmp/sub-q-audit/audit-table.txt`（103 行 raw）。

### 3.5 Low-ExtRef KEEP (2-3 ref 但不 dead-chain)

| File | ExtRefs | Consumer 全 alive？ | 决策 |
|---|---:|---|---|
| `SkuComplexity.java` | 2 | `SkuUpdateComplexityTool` (alive) + Repository (alive) | KEEP |
| `SmartBiAnalysisCache.java` | 2 | `SmartBIServiceImpl` (alive) + Repository | KEEP |
| `SmartBiBillingConfig.java` | 2 | `SmartBIServiceImpl` (alive) + Repository | KEEP |
| `RegionOpportunityScore.java` | 2 | `RegionAnalysisService` + impl (alive) | KEEP |
| `IncentivePlan.java` / `IncentiveLevel.java` | 2 | `RecommendationServiceImpl` (alive) + impl-internal | KEEP |
| `SchemaApplyRequest.java` / `SchemaChangePreview.java` | 2 | `SmartBiSchemaService` + impl (alive) | KEEP |
| `DataSourceDTO.java` | 2 | `SmartBIConfigController` (alive) + `DataSourceRegistryService` | KEEP |

**1-ext-ref alive 例**：

- `AggregationType` ← `SmartBiFieldDefinition` (alive)
- `ConfirmMappingRequest` ← `SmartBIUploadController` (alive)
- `DataOrientation` ← `ExcelDynamicParserServiceImpl` (alive)
- `FieldChange` ← `SchemaChangeReport` (alive sister DTO)
- `TableDataResponse` ← `SmartBIUploadController` (alive)

→ 全部 KEEP，consumer 自身在主链路上。

---

## 4. 验证 (verification)

### 4.1 Reflection / FQN 字符串 grep

```bash
grep -rE "com\.cretas\.aims\.(entity|dto|repository)\.smartbi\.(SmartBiAnalysisConfig|SmartBiShareToken|AnalysisRequest|DrillDownResponse|enums\.AnalysisConfigType)" backend/java/cretas-api/src 2>&1
```

结果：仅 dead-chain 内部 `import` 语句相互引用，无 Spring config / reflection 字符串引用。

### 4.2 资源文件 (yml/properties) grep

```bash
grep -rE "(SmartBiAnalysisConfig|SmartBiShareToken|AnalysisRequest|DrillDownResponse|AnalysisConfigType)" backend/java/cretas-api/src/main/resources 2>&1
```

结果：（空）。

### 4.3 SQL migration

`smart_bi_analysis_config` 和 `smart_bi_share_token` 表在历史 migrations 中存在
(`V2026_01_18_10__smartbi_schema_metadata.sql`, `V0002__create_update_triggers.sql`)。

**不删 migrations** — 历史 migrations 是已 applied state，DB 表保留。本 PR 仅删 Java code，DB schema 留待后续 deprecation phase 决定。

### 4.4 mvn limited gate

待 commit 前 `mvn clean compile -DskipTests` PASS，详见下文 §6。

---

## 5. 风险 + 边界 case

### 5.1 已识别风险

| 风险 | 评估 | 缓解 |
|---|---|---|
| 删了 entity 后 Hibernate `@EntityScan` 启动失败 | 低 — `@EntityScan` 扫整包，不依赖单个类存在 | mvn 验证 |
| Python 端通过 SmartBI Java REST 间接依赖 dead entity 的 schema | 极低 — Python 直连 PG，不通过 Java entity | 无 Python 代码引用 dead entity FQN |
| Sub-K (chat5) 处理 `SmartBiQueryTemplate` 时遇到 enum 联动 | 不影响 — `SmartBiQueryTemplate` 不引用本批 dead-chain | DEFER 显式划分边界 |
| Spring Bean wiring 失败 | 0 — Repository 接口未在任何 `@Autowired` / `@Resource` 字段出现（grep 验证） | mvn 验证 |

### 5.2 已 explicit out-of-scope

- DB 表删除 (smart_bi_analysis_config / smart_bi_share_token)
- DB schema migration (drop tables)
- Frontend / Python service 端清理
- Other Phase C sub-batches (B/C/D/E/F/G — 已 ship；H/I/J/K/L/M/N — 各 chat 各自负责)

---

## 6. 测试计划 (test plan)

- [ ] `mvn clean compile -DskipTests` BUILD SUCCESS — 无 missing-symbol / unresolved-import 报错
- [ ] `mvn package -DskipTests` BUILD SUCCESS
- [ ] `mvn test -Dtest=SmartBIRestaurantRoutingTest` 6/6 PASS（与 Sub-E 同 sanity test）
- [ ] Reviewer spot-check 3 个 deleted FQN：`grep -rE "<FQN>" backend/java/cretas-api/src` → 期望 0 hit
- [ ] Reviewer 确认 `SmartBiQueryTemplate.java` 仍在 (Sub-K territory)
- [ ] Steve approves before admin merge

---

## 7. Diff stats (预估)

```
backend/java/cretas-api/src/main/java/com/cretas/aims/dto/smartbi/AnalysisRequest.java                | 211 ----------
backend/java/cretas-api/src/main/java/com/cretas/aims/dto/smartbi/DrillDownResponse.java              | 169 ----------
backend/java/cretas-api/src/main/java/com/cretas/aims/entity/smartbi/SmartBiAnalysisConfig.java       | 125 ----------
backend/java/cretas-api/src/main/java/com/cretas/aims/entity/smartbi/SmartBiShareToken.java           |  58 -----
backend/java/cretas-api/src/main/java/com/cretas/aims/entity/smartbi/enums/AnalysisConfigType.java    |  35 ----
backend/java/cretas-api/src/main/java/com/cretas/aims/repository/smartbi/SmartBiAnalysisConfigRepository.java | 142 ----------
backend/java/cretas-api/src/main/java/com/cretas/aims/repository/smartbi/SmartBiShareTokenRepository.java |  20 ----
docs/qa-audits/2026-05-10-t6-5-phase-c-sub-q-entity-orphan-sweep-audit.md  | NEW (~280 LOC)

Total: 8 files changed, ~280 insertions(+), 760 deletions(-)
```

---

## 8. v3 protocol 经验记录

本次审计应用 PR #248 (Sub-E) 总结的 v3 internal self-reference 协议：

1. **首轮外部 grep** 找到 3 个 0-ExtRef 候选 (AnalysisRequest / DrillDownResponse / SmartBiQueryTemplate)。
2. **dead-chain 追溯** 找出 2 个 Repository-only entity (SmartBiAnalysisConfig / SmartBiShareToken)。
3. **enum 联动** — AnalysisConfigType 仅在 dead-chain 内引用，必须同删，否则留 orphan enum。
4. **Repository 必须 collateral 删除** — 否则 mvn 编译失败 (Repository 引用已删 entity)。

经验：审 entity orphan **必须**同时审对应 Repository 和 enum，三者经常构成完整 dead-chain。仅删 entity / 仅删 DTO 是 partial fix，会引入 compile failure。

---

## 9. Predecessors / 关联文档

- PR #150 — T6.5 spec (§C entity-level cleanup)
- PR #178 — Phase A audit v3.1 (entity scope subset)
- PR #227 — Phase C MO (8-chat parallel, Sub-Q dispatch source)
- PR #236 — Sub-A (controller body delete + orphan repo precedent — 1-file delete pattern)
- PR #248 — Sub-E (v3 protocol baseline + audit doc 模板)
- chat5 Sub-K — `SmartBiQueryTemplate` orphan (DEFER, parallel branch)
