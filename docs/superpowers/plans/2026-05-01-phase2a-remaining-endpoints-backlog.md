# Phase 2A 剩余 endpoints backlog map

> 给后续 chat 提供 Phase 2A SmartBI Java→Python port 的**剩余工作清单**, 避免重新探索.
>
> **写作日期**: 2026-05-01
> **最后更新**: 2026-05-02 (after PR #59, 30+ Phase 2A PRs shipped 2026-05-01 → 2026-05-02)
> **当前 main HEAD**: `a3b166909` (PR #59 T6 nginx cutover spec merged)
> **Phase 2A 范围锁定** (`project_apr30_tool_skill_stays_java.md`): 仅 SmartBI analysis/ops endpoints byte-shape Python port. 不含 337 tools / 16 Skill / AIIntentService — 全留 Java.
>
> **Phase 2A 范围 update (2026-05-01)**: `/datasource/{id}/preview` 因 Java 端是 stub (`SmartBiSchemaServiceImpl.previewSchemaChanges` line 96-105 永远返 `noChanges` envelope, 不读 input, 不调 LLM; 此前 LLM-coupled 描述基于 `SchemaChangePreview` DTO 字段名假设错误) 移到 §2.4 deferred (跟 PR #37 quality/production 同模式). 见 §2.4 "/preview" 子节.
>
> **Phase 2A 范围 update (2026-05-02)**: `POST /datasource/upload` (multipart) 因 Java 端是 stub (`SmartBiSchemaServiceImpl.uploadAndDetectSchema` line 57-93 三个 TODO: Excel 解析 + Schema 比较 + LLM 字段推断, 实际只返 `SchemaChangePreview.noChanges` 或 `autoApplicable(empty, [])`) 移到 §2.4 deferred. 见 §2.4 "/upload" 子节.
>
> **Phase 2A 范围 update (2026-05-01, third)**: `POST /datasource/apply` 因 Java 端是 bookkeeping-stub (`SmartBiSchemaServiceImpl.applySchemaChanges` line 107-147 包装一个 TODO core: line 120-123 "执行实际的 Schema 变更 / 验证确认的映射 / 更新字段定义 / 执行 DDL"; 仅做 schema_version bump + history row write with hardcoded `'{}'` schemas; helper `serializeCurrentSchema` line 337-341 也是 stub 返回 `"{}"`) 移到 §2.4 deferred. 见 §2.4 "/apply" 子节.

---

## 1. Phase 2A scope 范围

**In scope** (port to Python):
- `SmartBIAnalysisController` (`/api/mobile/{factoryId}/smart-bi/*`) — 26 endpoint
- `SmartBIDashboardController` (`/api/mobile/{factoryId}/smart-bi/dashboard*` + `/data-date-range`) — 11 endpoint, 部分

**Out of scope** (留 Java):
- `SmartBIConfigController` (41 endpoint, 配置管理 + reload, 不是分析逻辑)
- `SmartBIUploadController` (13 endpoint, Excel 解析已有独立 Python `/api/excel/*` 路由)
- `SmartBIPublicDemoController` (10 endpoint, demo 站, 数据非生产)
- `IntentAnalysisController` (27 endpoint, AI 意图入口, 留 Java per Phase 2B 锁定)

**Counting 标准**: 每个 endpoint 计为 1, 但 `analysisType` 参数路径每个 sub-type 计为 1 (因为 byte-shape gate 是 per-type 录制 goldens).

---

## 2. SmartBIAnalysisController endpoints inventory (26 endpoints)

### 2.1 ✅ 已 ship 到 main (Phase 2A 已完成 ~32 endpoints + sub-types, ~80% in-scope)

| # | Java endpoint | Python ported | PR | 备注 |
|---|---|---|---|---|
| 1 | `GET /analysis/finance` (composite) | ✅ | #13 | `analysisType=null` → composite |
| 2 | `GET /analysis/finance?analysisType=payable` | ✅ | #18 (PR-A) + #51 (PR-B) | per-type + arithmetic depth tests |
| 3 | `GET /analysis/finance?analysisType=profit` | ✅ | #21 + #22 | per-type + sales fallback |
| 4 | `GET /analysis/finance?analysisType=cost` | ✅ | #25 (PR-A) + #28 (PR-B) | per-type + arithmetic depth tests |
| 5 | `GET /analysis/finance?analysisType=receivable` | ✅ | #42 (PR-A) + #46 (PR-B) | per-type + arithmetic depth tests |
| 6 | `GET /analysis/finance?analysisType=budget` | ✅ | #38 (PR-A) + #44 (PR-B) | per-type + arithmetic depth tests |
| 7 | `GET /analysis/finance/budget-achievement` | ✅ | #32 | sub-endpoint |
| 8 | `GET /analysis/finance/yoy-mom?periodType=MONTH/QUARTER` | ✅ | #32 | sub-endpoint, 4 sub-impl |
| 9 | `GET /analysis/finance/category-comparison?year=&compareYear=` | ✅ | #32 | sub-endpoint |
| 10 | `GET /analysis/sales` (foundation) | ✅ | #14 | foundation only |
| 11 | `GET /analysis/sales?analysisType=gold` | ✅ | #14 | gold layer |
| 12 | `GET /analysis/sales?analysisType=overview` | ✅ | #15 | overview |
| 13 | `GET /analysis/sales?analysisType=rankings` | ✅ | #20 | top-10 ranking |
| 14 | `GET /analysis/sales?analysisType=trend` | ✅ | #20 | DAY bucketing only |
| 15 | `GET /alerts` | ✅ | #14 | 4 alert types (sales/finance/dept/aggregator) |
| 16 | `GET /recommendations` | ✅ | (batch) | |
| 17 | `GET /query-templates` (GET) | ✅ | (batch) | |
| 18 | `POST /query-templates` (CREATE) | ✅ | #48 | RLS-aware, T6 hijack defense |
| 19 | `PUT /query-templates/{id}` (UPDATE) | ✅ | #48 | |
| 20 | `DELETE /query-templates/{id}` (DELETE) | ✅ | #48 | soft-delete |
| 21 | `GET /datasource/list` | ✅ | (batch) | |
| 22 | `GET /datasource/{id}/fields` | ✅ | #39 | Wave 2 Tier 1 |
| 23 | `GET /datasource/{id}/history` | ✅ | #39 | Wave 2 Tier 1 |
| 24 | `GET /data-date-range` (Dashboard) | ✅ | (batch) | dashboard.py |
| 25 | `GET /incentive-plan/{targetType}/{targetId}` | ✅ | #43 | Tier 1 metric query |
| 26 | `GET /analysis/department` (composite) | ✅ | #52 (PR-A) + #57 (PR-B) | composite + 4 sub-services + 21 arithmetic tests |
| 27 | `GET /analysis/inventory` (4 modes) | ✅ | #53 (PR-A0+PR-A) + #54 (PR-B) | 4 modes + DashboardResponse default mode |
| 28 | `GET /analysis/region` (per-type, PR-A) | 🚧 PR-A ✅ | #56 | PR-A shipped; PR-B (default mode) + PR-C (depth) in flight |

**Spec 已 ship (impl in flight):**
- `GET /analysis/procurement` per-type + default mode — spec PR #40 merged 2026-05-01; impl in flight (Chat 4 PR-A)
- `GET /analysis/inventory` per-type spec PR #47 merged → impl shipped #53/#54

**Rules graduated:**
- Rule 8 (`Map.of(N)` Jackson hash order) — PR #35 merged 2026-05-01
- Rule 9 (Lombok + Jackson serialization quirks) — PR #55 merged 2026-05-02

### 2.2 🚧 Sister chat in-flight (5 active chats as of 2026-05-02)

| Chat | Task | Worktree / Branch | Status |
|---|---|---|---|
| Chat 1 | `/analysis/inventory` PR-C (arithmetic depth) | `.worktrees/phase2a-inventory-impl` (`phase2a/inventory-pr-b` branch carries WIP) | 🚧 in flight, post-#54 ship |
| Chat 2 | `/analysis/region` PR-B (default mode DashboardResponse) + PR-C (depth) | `.worktrees/phase2a-region-impl` | 🚧 in flight, post-#56 PR-A ship |
| Chat 3 | `/drill-down` spec | `.worktrees/phase2a-spec-drill-down` | 🚧 spec audit cycle 2+, no PR yet |
| Chat 4 | `/analysis/procurement` PR-A (per-type 3 modes + foundation) | `.worktrees/phase2a-procurement-impl` (locked) | 🚧 in flight, no PR yet (spec #40 merged) |
| Chat 5 (this map's writer) | `/analysis/procurement` PR-B (standby) | `.worktrees/phase2a-procurement-pr-b` ready | ⏸️ standby until Chat 4 PR-A merges |

> **不要碰其他 chat 的 worktree**. 如果 Chat 4 PR-A 比预期晚, organizer 会 redistribute work.

### 2.3 ❌ 未开始的 backlog (剩余真实未启动)

剩余 truly-未启动 端点 (排除 in-flight + deferred):

| # | Java endpoint | sub-types | 风险 | 状态 |
|---|---|---|---|---|
| 29 | `POST /query` | NL→SQL 通用查询 | **VERY HIGH** | 建议 out of scope (依赖 LLM + Tool-Skill, 跟 Phase 2B AI 系统耦合) |
| 30 | `POST /drill-down` | 钻取分析 | HIGH | spec in flight (Chat 3); impl gated on spec |

**Strikethrough 历史 (已 ship 或 deferred)**:
- ~~`/analysis/finance` 5 sub-types~~ → all ✅ in §2.1
- ~~`/analysis/department`~~ → ✅ #52 + #57
- ~~`/analysis/inventory`~~ → ✅ #53 + #54
- ~~`/analysis/region` PR-A~~ → ✅ #56 (PR-B/C in flight)
- ~~`/analysis/procurement`~~ → spec ✅ #40, impl in flight
- ~~`/analysis/quality`~~ → ⏸️ deferred §2.4
- ~~`/analysis/production`~~ → ⏸️ deferred §2.4
- ~~`POST /datasource/upload`~~ → ⏸️ deferred §2.4
- ~~`GET /datasource/{id}/preview`~~ → ⏸️ deferred §2.4
- ~~`POST /datasource/apply`~~ → ⏸️ deferred §2.4
- ~~`/datasource/{id}/fields`~~ → ✅ #39
- ~~`/datasource/{id}/history`~~ → ✅ #39
- ~~`POST /query-templates`~~ → ✅ #48
- ~~`PUT /query-templates/{id}`~~ → ✅ #48
- ~~`DELETE /query-templates/{id}`~~ → ✅ #48
- ~~`/incentive-plan/{targetType}/{targetId}`~~ → ✅ #43

### 2.4 ⚠️ Deferred — Java mock-only / stub-only services (不在 Phase 2A scope)

| # | Java endpoint | 状态 | 阻塞原因 |
|---|---|---|---|
| 23 | `/analysis/quality` | ⏸️ deferred | Java `QualityAnalysisServiceImpl` 全 mock (`generateMockQualityData`, `Random(factoryId.hashCode())` LCG seed). Java 注释 line 401-402 自己说 "实际实现时应从 QualityInspection/ReworkRecord/DisposalRecord 实体查询", 真实 entity 未实现 |
| 22 | `/analysis/production` | ⏸️ deferred | 同上, `generateMockProductionData` 同模式, 0 repository 注入 |
| 30 | `GET /datasource/{id}/preview` | ⏸️ deferred | Java `SmartBiSchemaServiceImpl.previewSchemaChanges` (line 96-105) 是 stub: `return SchemaChangePreview.noChanges(...)` 永远返同 envelope, 不读 input, 不调 LLM, 不读临时 schema 变更存储. 真实 impl pending Java 实现 "实现从临时存储获取待应用的变更" (TODO line 100). DTO `SchemaChangePreview` 有 LLM-shaped fields (`suggestedMappings` / `warningMessage` / `affectedReportsCount`) 但 stub 永远不 set. Class doc 自身 line 38: "注意：当前为 Stub 实现，部分方法返回模拟数据。" |
| 29 | `POST /datasource/upload` (multipart) | ⏸️ deferred | Java `SmartBiSchemaServiceImpl.uploadAndDetectSchema` (line 57-93) 是 stub: 3 TODO 全部未实现 (line 61-65 "Excel 解析", line 74-76 "Schema 比较", line 88 "使用 LLM 推断字段含义"). 实际行为: existing datasource (`factoryId+name`) → `SchemaChangePreview.noChanges`; new → `autoApplicable(emptyReport, [])`. **不读 MultipartFile bytes, 不调 LLM, 不计算 schema diff**. 跟 `/preview` (line 96-105) 同 stub 模式. |
| 31 | `POST /datasource/apply` | ⏸️ deferred | Java `SmartBiSchemaServiceImpl.applySchemaChanges` (line 107-147) 是 bookkeeping-stub: 仅 bump `schema_version` + write `smart_bi_schema_history` row with hardcoded `change_type='FIELD_UPDATE'` / `old_schema='{}'` / `new_schema='{}'` / `is_reversible=true` / `is_applied=true`. 核心业务逻辑全在 TODO line 120-123: "执行实际的 Schema 变更 / 1. 验证确认的映射 / 2. 更新字段定义 / 3. 执行 DDL". helper `serializeCurrentSchema` line 337-341 也是 stub (fetch fields list 但 never used, `return "{}"; // Stub 实现`). `request.executeDbMigration` flag 仅 read 进 log line 110-111, 从不分支. Class doc 自身 line 38: "注意：当前为 Stub 实现，部分方法返回模拟数据。" |

#### 阻塞解除条件 (针对 quality + production)

**Java backend 必须先实现以下 real entity + repository**:
- `QualityInspection` + `QualityInspectionRepository` (质检记录)
- `ReworkRecord` + `ReworkRecordRepository` (返工记录)
- `DisposalRecord` + `DisposalRecordRepository` (报废处置记录)
- 类似 production 域 entity (TBD)

#### 阻塞解除条件 (针对 /preview)

**Java backend 必须先实现**:
- 临时 schema 变更存储读取逻辑 (currently TODO `SmartBiSchemaServiceImpl.previewSchemaChanges` line 100 "实现从临时存储获取待应用的变更")
- 真实 LLM mapping suggestions 调用路径 (currently TODO `uploadAndDetectSchema` line 88 "使用 LLM 推断字段含义", 不在 `previewSchemaChanges` path 里)
- `SchemaChangePreview` DTO 各 factory method 真实使用 — 当前仅 `noChanges(...)` 被调; `requiresApproval(...)` 与 `autoApplicable(...)` 工厂从未触发
- `SmartBiSchemaServiceImpl` `@RequiredArgsConstructor` 仅注入 3 个 repository (line 49-51), 真实 LLM-coupled 实现需新增 `DashScopeClient` / `LLMFieldMappingService` 注入

#### 阻塞解除条件 (针对 /upload)

**Java backend 必须先实现**:
- Excel 文件解析逻辑 (Apache POI / EasyExcel, line 61-65 TODO "实现 Excel 解析逻辑 — 1. 使用 Apache POI 或 EasyExcel 解析文件; 2. 提取表头和数据样本; 3. 推断字段类型")
- Schema 比较逻辑 (字段 added / removed / type-changed, line 74-76 TODO "实现 Schema 比较逻辑 — 当前返回模拟的无变更结果")
- LLM 字段含义推断 (DashScope call, line 88 TODO "使用 LLM 推断字段含义" — 跟 /preview 同一 LLM 路径)
- `SchemaChangePreview` DTO 真实使用 `suggestedMappings` / `warningMessage` / `affectedReportsCount` / `affectedReportNames` / `estimatedMigrationTime` 字段 (currently 全 default empty/null)
- `MultipartFile` 实际读取 (currently 接收参数但只读 `getOriginalFilename()` 写日志, 不读 bytes)

#### 阻塞解除条件 (针对 /apply)

**Java backend 必须先实现**:
- `SchemaApplyRequest.confirmedMappings` 验证逻辑 (currently TODO `applySchemaChanges` line 120-121 "1. 验证确认的映射")
- `smart_bi_field_definitions` 行真实 update — 当前仅 bump `schema_version`, 不写 field-level 变更 (TODO line 122 "2. 更新字段定义")
- DDL 执行真实业务 — 表结构变更对底层 Excel/SQL datasource 的实际应用 (TODO line 123 "3. 执行 DDL（如果需要）")
- `request.executeDbMigration` flag 真实分支 — 当前仅 read 进 log line 110-111, 从不影响行为
- `serializeCurrentSchema` helper 真实 Jackson 序列化 (currently TODO line 339 + return literal `"{}"`)
- `SmartBiSchemaHistory` 写入字段非 hardcoded — 当前 `change_type` 写死 `FIELD_UPDATE`, `is_reversible` 写死 `true`, `is_applied` 写死 `true`

#### 为什么 mock 不能 byte-port (针对 quality + production)

- Java `Random(seed)` 用 Linear Congruential Generator (JLS specified): `seed = (seed * 0x5DEECE66DL + 0xBL) & ((1L << 48) - 1)`
- Python `random.Random` 用 Mersenne Twister, 算法完全不同, 同 seed 不同 sequence
- 强行 port 意味着在 Python 复刻 Java LCG (~80 LOC `JavaRandom` class), 但 port 的是 stub 不是 real impl, 长期债 (Java 改 mock generator 必须 Python 同步)
- Phase 2A goal 是 byte-shape parity port real Java impl, mock-port 违反此目标

#### 为什么 stub 不 byte-port (针对 /preview + /upload)

- Java 永远返 `noChanges(datasource.name, datasource.schemaVersion)` 或 `autoApplicable(emptyReport, [])` — 都是 deterministic envelope, *理论*可 byte-port
- 但 byte-port 一个永远固定的 stub 没有 byte-shape parity 价值 — Phase 2A goal 是 port real impl, port 一个 hard-coded `noChanges` / 永远空 `suggestedMappings` 的输出不验证任何业务逻辑等价
- 真实 Java impl 落地后 (临时存储 + Excel 解析 + LLM mapping) 必须重写 spec — 现在 port 只是无谓 churn (跟 mock-port 同一论)
- /upload 跟 /preview 是同一 service class (`SmartBiSchemaServiceImpl`) 同一组 TODO, 解 stub 时大概率同一波 Java commit 一起实现 — defer + 真实 impl 一起 port 比 stub-port + 重写 ROI 高

#### 为什么 bookkeeping-stub 不 byte-port (针对 /apply)

- Bookkeeping 部分 (version bump + history row) 理论可 port, 但测试 surface 只是 repository invariants 不是 business logic
- Apply 操作的实际业务 (field definitions / DDL / mapping validation) 在 Java 端永远 no-op, byte-port 到 Python 同样 no-op — 没有等价行为可验证
- Hardcoded history fields (`change_type='FIELD_UPDATE'` / `'{}'` schemas / `is_reversible=true`) 锁住 Python 端必须复制相同假数据, 真实 Java impl 落地后必须 unwind 整个 port
- PR #45 已为 sister 端点 /preview 设立 "stub-only → defer" 先例; /apply 是更进一步的 bookkeeping-stub 变种, 同决策更适用

#### 何时重新派 chat

- **quality / production**: Java backend 实现 real entity + Repository 后, 派新 chat 走完整 spec (brainstorm → 4-cycle audit → impl) 流程, 估时 8-12h per endpoint (跟其他 Tier 2 同档)
- **/preview**: Java backend 实现真实 schema 临时存储读取 + LLM mapping 调用后, 派新 spec chat. 估时 8-12h
- **/upload**: Java backend 实现 Excel 解析 + Schema 比较 + LLM 字段推断 (3 个 TODO 全填) 后, 派新 spec chat. /upload 跟 /preview 是同一 service class — 推荐两个端点合并到一个 spec chat 一起 port (估时 12-16h 总).
- **/apply**: Java backend 实现真实 `applySchemaChanges` (含 DDL execution + mapping validation + field definition updates) 后, 派新 spec chat. /preview + /upload + /apply 是同一 service class — 推荐三个端点合并到一波 spec/impl 一起做 (总估时 16-22h, 含跨端点 transaction + DDL 共享逻辑).

**发现 chat**:
- `phase2a/spec-quality` (Chat 4, 2026-05-01) — quality + production deferral, brainstorm Round 1 grep Java 源码时 surface mock pattern
- `phase2a/spec-preview` (Chat 5, 2026-05-01) — /preview deferral, prereq grep Java service impl 时 surface stub pattern (`@RequiredArgsConstructor` 仅 repo 注入 + 方法体仅 `findById` + `noChanges` return)
- `phase2a/datasource-upload` (Chat 2, 2026-05-02) — /upload deferral, brainstorm round 1 grep `SmartBiSchemaServiceImpl.uploadAndDetectSchema` line 57-93 surface 3 个 TODO + 8 个设计决策全 skip (Excel parse / LLM / schema diff / file validation / permission / size limit / temp file / virus scan), stopped + 改派 deferral PR. 跟 /preview (PR #45) 是同一 service class 同一波 TODO.
- `phase2a/datasource-apply` (Chat 5 follow-up, 2026-05-01) — /apply deferral, mock-check grep 通过但读 method body 发现 4 处 TODO + helper `serializeCurrentSchema` 也 stub + class doc 显式 "当前为 Stub 实现". 同 chat 在 /preview defer 后立即应用 organizer 升级后的 process rule (PR #45 Process rule 教训 §) 抓到 bookkeeping-stub 变种

#### Process rule 教训

派 spec chat 前, organizer 必须先 grep Java service impl 30 秒确认是 real DB query / 真 LLM call 还是 mock / stub — 防 quality/production/preview 同模式重蹈覆辙:

```bash
# Mock 检测 (quality / production 模式)
grep -nE "@Autowired|generateMock|Random\(|Math\.random|TODO.*实际实现" \
  backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/{Service}AnalysisServiceImpl.java

# Stub 检测 (preview 模式) — 检查方法体是否仅含 unconditional default-envelope return
grep -nE "@Autowired|@RequiredArgsConstructor|TODO.*实现|TODO.*从.*获取|return.*\.noChanges\(|当前.*Stub" \
  backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/{Service}ServiceImpl.java
```

判断标准:
- 看到 `private final XxxRepository` 或 `@Autowired XxxRepository` (真 DB) **以及** 方法体含真实 query/聚合逻辑 → real, 派 spec chat OK
- 看到 `generateMockXxxData(...)` 或 `Random(factoryId.hashCode())` → mock, 加入本 §2.4 deferred
- 看到方法体仅 `findById(...)` + `return XxxDTO.defaultFactory(...)` 无业务计算 → stub, 加入本 §2.4 deferred
- 看到方法体含真实 `save(...)` 但核心业务逻辑被 TODO 注释覆盖 (e.g. `// TODO: 执行实际的 ...` 包住主路径) → bookkeeping-stub, 加入本 §2.4 deferred. 真实 save 部分是 scaffolding, 不是 port 价值
- 看到 helper / 私有方法 `return "{}"` 或 `return null` 配 `// Stub 实现` → 此 service 内多个 endpoint 可能共用 stub, 二次评估同 service 其他方法
- 看到 hardcoded literal (e.g. `change_type='FIELD_UPDATE'` 写死 / `is_reversible=true` 写死) 在写库路径里 → 是 stub fallback, 真实 impl 应该从 request/diff 推导
- 看到 `TODO 实际实现时应从 ... 查询` 或 `当前为 Stub 实现` 注释 → 即使非 mock 也要二次评估
- 看到 `@RequiredArgsConstructor` 后字段全是 repository (无 `DashScopeClient`/`LlmService`) 但 task 描述说 "LLM-coupled" → 不一致, 必须停手 ping organizer
- 看到 request DTO 字段 (e.g. `executeDbMigration` flag) 仅 read 进 log line 不被分支 → 业务逻辑未实现的强信号

---

**SmartBIDashboardController (10 endpoint, 部分 in scope)**:

| # | Java endpoint | 状态 | 备注 |
|---|---|---|---|
| 37 | `GET /dashboard` | ❌ | 主 dashboard 数据 |
| 38 | `GET /dashboard/executive` | ❌ | 执行级 dashboard |
| 39 | `GET /dashboard/executive/insights` | ❌ | LLM 洞察 (Java 已实现) |
| 40 | `GET /dashboard/executive/insights/custom` | ❌ | 自定义 |
| 41 | `GET /dashboard/executive/insights/custom/stream` | ❌ | SSE 流式 (Python SSE 较新, 风险 MED) |
| 42 | `GET /dashboard/executive/custom` | ❌ | |
| 43 | `GET /analysis/dynamic` | ❌ | 动态分析 |
| 44 | `GET /analysis/dynamic/kpis` | ❌ | KPI |
| 45 | `POST /generate-adaptive-charts` | ❌ | 适应性图表 |
| 46 | `POST /generate-chart` | ❌ | 单图表 |

总计 Dashboard: ~10 endpoints 未 port (按需评估, Phase 2A+1 候选).

---

## 3. 优先级 + 工作量 (post-2026-05-02 update)

### Tier 1 (LOW risk, 高 ROI) — ✅ DONE

所有 Tier 1 端点全 ship 或 deferred:
- ~~/finance per-type (5 sister)~~ ✅
- ~~/datasource/{id}/fields/history~~ ✅ #39 (preview deferred §2.4)
- ~~/query-templates POST/PUT/DELETE~~ ✅ #48
- ~~/incentive-plan~~ ✅ #43
- ~~datasource list / data-date-range / recommendations~~ ✅ batch

**Tier 1 残余**: 0.

### Tier 2 (MED risk) — 75% DONE

| 端点 | 状态 | 估时 |
|---|---|---|
| ~~/analysis/department~~ | ✅ #52 + #57 | DONE |
| ~~/analysis/inventory (4 modes)~~ | ✅ #53 + #54 (PR-C in flight) | DONE except depth tests |
| /analysis/region | 🚧 PR-A ✅ #56, PR-B/C in flight | ~6-10h remaining |
| /analysis/procurement | 🚧 PR-A in flight (Chat 4), PR-B standby (me), PR-C TBD | ~10-15h remaining |

**Tier 2 残余**: ~16-25h across region PR-B/C + procurement PR-A/B/C.

### Tier 3 (HIGH risk, 大工程)

| 端点 | 状态 | 估时 |
|---|---|---|
| /analysis/inventory | ✅ shipped (Tier 2 reclassified post-impl) | DONE |
| /drill-down | 🚧 spec in flight (Chat 3 cycle 2+); impl gated | spec ~3-4h to ship + impl ~15-25h |

**Tier 3 残余**: ~18-29h for drill-down spec + impl.

### Tier 4 (VERY HIGH risk, out-of-scope)

| 端点 | 决定 |
|---|---|
| /query (NL→SQL) | **out of scope**, 留 Java (Phase 2B AI 系统耦合) |
| /dashboard/executive/insights/custom/stream (SSE) | 视需求评估, Phase 2A+1 candidate |

### Dashboard 子集

按需评估, 多数为 Phase 2A+1 候选 (T6 nginx cutover spec PR #59 §2.2 列为 out-of-scope 留 Java).

---

## 4. 推荐 sequence (post-2026-05-02 status)

**Wave 1** (finance 子域 5/5) — ✅ DONE
- payable / profit / cost / receivable / budget 全程 PR-A + PR-B 全 ship

**Wave 2** (Tier 1 收尾) — ✅ DONE
- /datasource/{fields,history} (#39) + /query-templates CRUD (#48) + /incentive-plan (#43) + sub-endpoints (#32)
- 5 个 deferral PRs (#37 quality+production, #45 preview, #49 upload, #50 apply)

**Wave 3** (Tier 2, 平行) — 75% DONE
- ✅ /analysis/department (#52 + #57)
- ✅ /analysis/inventory (#53 + #54, PR-C in flight)
- 🚧 /analysis/region (PR-A #56 ✅; Chat 2 PR-B/C in flight)
- 🚧 /analysis/procurement (Chat 4 PR-A in flight; me PR-B standby; PR-C TBD)

**Wave 4** (Tier 3, 串行) — IN FLIGHT
- 🚧 /drill-down (Chat 3 spec audit cycle 2+); impl gated on spec ship

**T6 nginx cutover** — ✅ spec shipped #59
- 4-stage rollout (T6.1 dryrun → T6.2 canary → T6.3 50% → T6.4 100%) + 7d soak
- Execution gated on Phase 2A 100% in-scope completion (~5-10 working days)

**Out of scope / Phase 2A+1**:
- /query NL→SQL: **out of scope**
- Dashboard endpoints (按需评估)
- /query-templates CRUD 中的 PUT/DELETE: 业务收益评估

---

## 5. 各端点推荐 spec 模板

复用 `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-cost-design.md` 模板:
- §1 Java side reference (controller method + service method 完整签名)
- §2 Java JSON shape (录 F999 + F001 goldens)
- §3 Python side spec (path + body shape + sub-types)
- §4 Helpers + algorithm (per-period bucketing, growth rate 等)
- §5 Test plan (byte gates + arithmetic depth)
- §6 Risks + 边界 (NULL handling, NaN, date boundary)
- §7 4 轮 audit (self-review / spec reviewer / cross-spec / final impl reviewer)

For DashboardResponse-emitting endpoints (default mode of inventory / region / procurement):
- 必读 Rule 9 §9.2 (DTO 无 `@JsonInclude(NON_NULL)` → 全 emit nulls — 16 fields)
- 必读 Rule 9 §9.1 (Lombok getter naming — `xAxisField` → `xaxisField` lowercase 'a')
- 模板: inventory PR-B (#54) `_build_empty_dashboard` 16-key shape + AIInsight 5-key

---

## 6. 已知 patterns + rules

(参考 `.claude/rules/python-java-port.md` 9 rules — Rule 9 入 main 2026-05-02 PR #55)

- **Rule 1**: Null fallback 用 `is not None` 三元 (不 `or`)
- **Rule 2**: WEEK period key 用 calendar year `d.year` (不 `isocalendar()[0]`)
- **Rule 3**: Function signature 1:1 mirror Java
- **Rule 4**: `_decimal_to_number` helper for BigDecimal serialization
- **Rule 5**: 共享 SQL helpers `SELECT *`
- **Rule 6**: 输入边界 None-check (新 helper 强制)
- **Rule 7**: 浮点阈值用 `Decimal` 比较
- **Rule 8**: `Map.of(N)` Jackson hash order — 录 golden 反推, 跨 JVM SALT32L flip 风险
- **Rule 9**: Lombok + Jackson 序列化 quirks (字段名 / null emit / 派生 getter 全 mirror golden) — `@Data` no-`@JsonInclude` → 全字段 emit; `xAxisField` → `xaxisField` lowercase

特别注意 (跨 chat 通用):
- Python 3.8 compat: `_to_thread` shim (不要 `asyncio.to_thread`)
- Concurrent edit safety: `git commit -m "..." -- <paths>` (concurrent-edit rule 5b, `safe-commit.sh`)
- Decimal serialization: FastAPI 默认 Decimal→str, 用 `_decimal_to_number` helper
- Golden-first workflow: spec 凭源码假设字段顺序经常错 (Rule 9 §9.3) — 永远先录 F999 golden, dict literal 严格 mirror

---

## 7. Phase 2A 整体进度估算 (2026-05-02)

### 7.1 数字总览

| 类别 | 数量 | 备注 |
|---|---|---|
| ✅ 已 ship 到 main | **~32 endpoints + sub-types** | 含 finance 5 sister × (PR-A + PR-B) + sub-endpoints + sales 5 + ops endpoints + Tier 2 (department/inventory) + region PR-A |
| 🚧 in-flight (5 chats) | **~6 endpoints + depth tests** | procurement (PR-A/B/C) + region (PR-B/C) + inventory PR-C + drill-down spec |
| ⏸️ deferred §2.4 | **5 endpoints** | quality + production (mock) + /preview + /upload + /apply (stub) |
| ❌ true backlog | **2 endpoints** | /query (out-of-scope) + /drill-down (spec→impl gated) |
| Dashboard subset | ~10 endpoints | Phase 2A+1 candidates |

### 7.2 PR ship velocity

**2026-05-01 + 2026-05-02 cumulative**: 30+ Phase 2A PRs merged (impl + specs + deferrals + rules + cosmetic patches).

Notable subset:
- 12 impl PRs (finance 5 sister × PR-A+PR-B + sub-endpoints + sales + alerts + datasource fields/history + query-templates CRUD + incentive-plan + department + inventory + region PR-A)
- 5 spec-only PRs (#33 receivable spec, #34 budget, #36 department, #40 procurement, #41 region, #47 inventory)
- 5 deferral PRs (#37 quality+production, #45 preview, #49 upload, #50 apply)
- 3 rules PRs (#30 calendar-year fix, #35 Rule 8, #55 Rule 9)
- 2 cosmetic / refactoring PRs (#58 sister Rule 9 cosmetic patches, #31 backlog map original)
- 1 ops spec (#59 T6 nginx cutover)

### 7.3 剩余工作量估算

| 类别 | 估时 | 状态 |
|---|---|---|
| Region PR-B + PR-C (Chat 2) | ~6-10h | in flight |
| Procurement PR-A (Chat 4) | ~5-7h | in flight |
| Procurement PR-B (me, gated on PR-A) | ~3-4h | standby |
| Procurement PR-C (TBD) | ~3-5h | gated on PR-B |
| Inventory PR-C (Chat 1) | ~3-4h | in flight |
| Drill-down spec (Chat 3) | ~3-4h | spec audit cycle 2+ |
| Drill-down impl PR-A/B/C (gated on spec) | ~15-25h | not started |

**Phase 2A 100% 完整收尾估时**: ~38-59h 剩余, 跨 5 个并行 chat. 实际墙钟 ~3-5 个工作日 (假设 Chat 4 procurement PR-A ship 后 Wave 3 顺利 cascade).

**T6 nginx cutover 触发条件** (per PR #59 §9.1):
- Phase 2A 100% in-scope endpoints ship 到 main
- Each endpoint contract test ✅ via `_strip_volatile` byte-shape gate
- Each endpoint F001 manual smoke logged
- Rule 8 + Rule 9 audited per endpoint
- Java baseline 1-week stable + Python baseline 48h stable

执行: 4-stage rollout per #59 §6 (T6.1 dryrun → T6.2 10% canary → T6.3 50% → T6.4 100% + 7d soak).

---

## 8. 给下一个 chat 的 marching order (post-2026-05-02 status)

### 8.1 Active chat assignments (ongoing, do not interfere)

- **Chat 1**: inventory PR-C (arithmetic depth tests post-#54 ship). Worktree `phase2a-inventory-impl`. Gated on Chat 1's own discretion.
- **Chat 2**: region PR-B (default mode DashboardResponse, post-#56 ship) + PR-C (depth tests). Worktree `phase2a-region-impl`. Apply Rule 9 §9.2 16-field DashboardResponse + AIInsight 5-key from inventory PR-B template.
- **Chat 3**: drill-down spec audit cycle 2+. Worktree `phase2a-spec-drill-down`. Impl gated on spec PR ship.
- **Chat 4**: procurement PR-A (per-type 3 modes + foundation). Worktree `phase2a-procurement-impl` (locked). 4-6h ship estimate from start of chat.
- **Chat 5 (this map's writer)**: procurement PR-B standby. Worktree `phase2a-procurement-pr-b` ready. 10-task plan locked, golden-first workflow per Rule 9 §9.2.

### 8.2 Next chat dispatch (post-Wave 3 cascade)

After current 5 chats complete their work, remaining dispatch:

```
派 chat for: drill-down impl (PR-A + PR-B + PR-C)

1. cd 到主 worktree
2. git pull origin main --rebase  (含 drill-down spec PR + Wave 3 全 ship)
3. git worktree add .worktrees/phase2a-drilldown-impl -b phase2a/drilldown-impl origin/main
4. cd .worktrees/phase2a-drilldown-impl
5. 读 drill-down spec (post-Chat-3 ship)
6. brainstorm 1-2 round 找 hierarchy + 多表 join 边界
7. spec 4-cycle audit 已 done in spec PR
8. plan ~14 tasks
9. impl PR-A (foundation + base path) → push → PR
10. impl PR-B (default mode if applicable) → PR
11. impl PR-C (arithmetic depth) → PR

参考已 ship Tier 2 模板 (department / inventory). 估时 15-25h.
```

### 8.3 Phase 2A 100% 收尾后的 next phase

- T6 nginx cutover execution per PR #59 plan (4 stages, 24h soak per stage, 7d post-soak)
- Phase 2A+1 candidate work: Dashboard endpoints (按需评估), /query NL→SQL (Phase 2B coupling)
- Java backend decommission (T6.4 + 30 days) — deletion of obsolete SmartBI service classes; tracked separately

### 8.4 Deferred re-spec triggers (Phase 2A+1 candidates)

When Java backend implements real entity / impl for these, dispatch new spec chat:
- quality + production (real entity + Repository)
- /preview (临时 schema 存储 + LLM mapping)
- /upload (Excel parse + Schema diff + LLM)
- /apply (DDL + mapping validation + field updates)

详见 §2.4 各阻塞解除条件子节.
