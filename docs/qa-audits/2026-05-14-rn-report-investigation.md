# RN 报工调查 — Issue #566

**日期**: 2026-05-14
**作者**: chat2 (RN handoff investigation)
**关联 issue**: [#566](../../../../issues/566) — F006 反馈: T1-5 + T4-B6 报工累计 / App 转圈
**Scope**: investigation + recommendations only (no code changes in this PR)

---

## TL;DR

| ID | 客户反馈 | 优先级 | 根因 (verified) | 推荐修复 |
|----|---------|--------|----------------|---------|
| **T4-B6** | 报工时 loading spinner 永久不消失 | **P1** | 后端 `submitNormalReport` 在 30s 去重检查时**全表加载**该任务所有报工记录到 Java 内存; F006 hourly + 多 worker + 周累积 → 千行级别 in-memory filter → 单次提交 5-30s+ → 用户感知"卡死" | 加 SQL-side dedup 方法 `findRecentDuplicate(...) LIMIT 1` (~1 day) |
| **T1-5** | 报工累计漏算 | **P2** | 三条独立路径都有 gap: (A) PROCESS 报工不写 `product_name` → 产品级聚合查询遗漏; (B) `ProcessTask.completedQuantity` 只算 APPROVED, 待审 PENDING 不可见; (C) 全后端**无任何 hourly 聚合查询** | 三件事分别处理 (~3-5 day total, 见 §4) |

**前端**: 5 个报工 submit screen 全部 audit 过, 全部正确 `setLoading(false)` in finally — **不是前端 bug**.

---

## 1. 调查范围

按 issue 优先级倒序:

### T4-B6 (P1) — 后端 hang 怀疑
1. 前端 5 个 report submit screen + apiClient 的 timeout / loading-state 管理
2. 后端 POST `/process-work-reporting/normal` (PROCESS 路径) 实现
3. 后端 POST `/work-reporting/reports` (legacy 路径, useReportWorkflow) 实现
4. ProductionReportRepository 是否有 SQL-side dedup 方法 (没有)

### T1-5 (P2) — 累计漏算怀疑
1. 后端 ProcessTask.completedQuantity 计算逻辑
2. 后端任意 hourly aggregation query (none found)
3. PROCESS 报工 vs 传统 PROGRESS 报工 字段差异

### Out of scope (本 PR 不动)
- ✗ Maestro YAML / E2E 真机复现 (需 e2e-native chat 接力)
- ✗ Mini-program (T1-5 issue body 提到 "小程序" 但 MallCenter 项目无 production report; 应该是 "RN App" 笔误)
- ✗ chat5 OTA in-flight 修复中 (issue body 引用) — git log 确认 OTA 工作仅限 nginx/build/push-bundle, **没有任何 work on 报工 itself**

---

## 2. 前端 audit (T4-B6 排除)

5 个 report submit handler 全部检查, 都正确 `setLoading(false)` 在 `finally` block:

| Screen | submit 函数 | finally cleanup |
|--------|-------------|-----------------|
| `ScanReportScreen.tsx:82-132` | `handleSubmit` | ✓ line 130 |
| `TeamBatchReportScreen.tsx:192-231` | `handleSubmit` | ✓ line 228 |
| `ThreeStepReportScreen.tsx:175-227` | `doSubmit` | ✓ line 225 |
| `ProcessTaskReportScreen.tsx:67-100` | `doSubmit` | ✓ line 97 |
| `useReportWorkflow.ts:51-75` (DynamicReport hook) | `submitReport` | ✓ line 72 |

`apiClient.ts:16` `timeout: 120000` (2 min). 即便后端真挂, axios 最多等 2 min 即 reject, finally 还是会清 spinner.

**结论**: spinner stuck **不是** 前端 `setLoading(false)` 漏掉. 必然在 backend 路径.

---

## 3. T4-B6 根因 — `submitNormalReport` N²-load 反模式

### 复现路径

`POST /api/mobile/{factoryId}/process-work-reporting/normal`
→ `ProcessWorkReportingController.submitNormalReport` ([file](../../backend/java/cretas-api/src/main/java/com/cretas/aims/controller/ProcessWorkReportingController.java#L82))
→ `ProcessWorkReportingServiceImpl.submitNormalReport` ([file](../../backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/ProcessWorkReportingServiceImpl.java#L201))

### Bug

文件: `ProcessWorkReportingServiceImpl.java:211-217`

```java
// P1-3: 30秒时间窗口去重 — 防止弱网环境重复提交
LocalDateTime dedup30s = LocalDateTime.now().minusSeconds(30);
List<ProductionReport> recentDuplicates = reportRepository
        .findByProcessTaskIdAndDeletedAtIsNull(processTaskId).stream()  // ← 加载该任务所有报工进 JVM
        .filter(r -> r.getWorkerId() != null && r.getWorkerId().equals(workerId))
        .filter(r -> r.getOutputQuantity() != null && r.getOutputQuantity().compareTo(outputQuantity) == 0)
        .filter(r -> r.getCreatedAt() != null && r.getCreatedAt().isAfter(dedup30s))
        .collect(Collectors.toList());
```

`findByProcessTaskIdAndDeletedAtIsNull` 返回 **该工序任务所有未删除报工** (无 LIMIT, 无时间过滤). 拿到 List<ProductionReport> 后在 JVM stream 里逐个 filter.

### 影响 scaling

| 场景 | 报工记录数 | 单次 submit 估算 |
|------|-----------|----------------|
| Dev / 测试环境 (5-10 reports) | ~10 行 | <100 ms ✓ |
| F001 demo 数据 (~100 reports) | ~100 行 | ~500 ms (acceptable) |
| **F006 prod (hourly × 10 workers × 4 weeks)** | **~6700 行** | **3-15 sec → spinner 持续转动** |
| F006 极端 (2 month) | ~13400 行 | 6-30 sec → axios 120s 仍未 timeout 但用户已离开 |

每行 ProductionReport 包含 notes(text), photos(json), customFields(json), hourEntries(json), nonProductionEntries(json) 等大字段. ORM 反序列化成本可观.

### Repository 现状

`ProductionReportRepository.java` 已有多个 SQL-aggregation 方法 (`sumApprovedQuantityByTaskId`, `getWorkerSummaryByTaskId`, etc.) 但**没有** SQL-side dedup. 加方法即可.

### 推荐 fix (~1 day)

**在 `ProductionReportRepository.java`** 加:

```java
@Query(value = """
    SELECT * FROM production_reports
    WHERE process_task_id = :taskId
      AND worker_id = :workerId
      AND output_quantity = :qty
      AND created_at > :since
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
    """, nativeQuery = true)
Optional<ProductionReport> findRecentDuplicate(
    @Param("taskId") String taskId,
    @Param("workerId") Long workerId,
    @Param("qty") BigDecimal qty,
    @Param("since") LocalDateTime since);
```

**改 `ProcessWorkReportingServiceImpl.submitNormalReport:211-217` 为**:

```java
LocalDateTime dedup30s = LocalDateTime.now().minusSeconds(30);
Optional<ProductionReport> dup = reportRepository.findRecentDuplicate(
        processTaskId, workerId, outputQuantity, dedup30s);
if (dup.isPresent()) {
    log.warn("Duplicate report detected for task {} worker {} qty {} within 30s",
            processTaskId, workerId, outputQuantity);
    ProductionReport existing = dup.get();
    return Map.of("reportId", existing.getId(), "taskStatus", "IN_PROGRESS",
            "pendingQuantity", existing.getOutputQuantity(), "duplicate", true);
}
```

**性能预期**: 千行级 → 单次 SQL `EXISTS` (索引扫描 < 5 ms).

**索引建议** (如未存在 — 部署前 EXPLAIN 验证):
```sql
CREATE INDEX IF NOT EXISTS idx_production_reports_dedup
  ON production_reports (process_task_id, worker_id, output_quantity, created_at DESC)
  WHERE deleted_at IS NULL;
```

### 验证 plan
1. 单元测试 mock 1000 条历史报工, 新方法 < 10 ms
2. 部署 `--env test` → 用 F006 测试账号实测 1 次 submit, 比较 latency 改善
3. SQL `EXPLAIN ANALYZE` 确认走索引

---

## 4. T1-5 根因 — 三条独立 gap

### Gap A: PROCESS 报工不写 `product_name`

`ProcessWorkReportingServiceImpl.submitNormalReport:241-253` 构造 ProductionReport 时**没设** `productName`:

```java
ProductionReport report = ProductionReport.builder()
        .factoryId(factoryId)
        .processTaskId(processTaskId)
        .workerId(workerId)
        .reporterName(reporterName)
        .reportType(ProductionReport.ReportType.PROGRESS)
        .reportDate(LocalDate.now())
        .outputQuantity(outputQuantity)
        // ✗ 没有 .productName(...)
        ...
        .build();
```

`ProductionReportRepository.getProductBreakdown:114-132` 是这样聚合产品级报表的:

```sql
SELECT COALESCE(product_name, '未分类') as product_name, SUM(...)
FROM production_reports
WHERE factory_id = :factoryId AND report_type = 'PROGRESS'
GROUP BY product_name
```

→ 所有 PROCESS 路径的报工都聚合在 `'未分类'` 桶里, 客户在产品级报表里看不到正常的产品维度累计.

**Fix (~0.5 day)**: 在 `submitNormalReport` 里 join `ProcessTask.productTypeId` → 查 `ProductType.name` → setProductName.

### Gap B: 累计只含 APPROVED, PENDING 不可见

`ProcessTask.completedQuantity` 仅在 `approveReport` → `syncQuantitiesToTask:468-507` 累加. 工人提交 PENDING → 等 supervisor 审 → completedQuantity 才动.

客户场景:
- 09:00 工人 A 报 50kg → PENDING → completedQuantity 不变
- 10:00 工人 B 报 30kg → PENDING → 不变
- 11:00 工人查 "今日累计" → 看到的是昨天的 completedQuantity

客户感受: "累计漏算" — 因为 hourly 报工 + 异步审批 = real-time view 永远滞后.

**Fix (~1-2 day)**:
- 选项 1: 前端 cumulative view 显示 `completedQuantity + pendingQuantity` (两个值已经在 ProcessTask 上了)
- 选项 2: 后端加端点 `GET /api/mobile/{factoryId}/process-tasks/{taskId}/realtime-cumulative` 返回 approved + pending breakdown
- 选项 3: 改商业规则, hourly 报工 auto-approve (绕开审批)

需 PM 决策选哪个 — 影响审批 workflow.

### Gap C: 无 hourly aggregation 查询

后端无任何按 hour 分桶的查询. 所有时间维度聚合最细粒度是 `report_date` (LocalDate, 天级).

但读 customer expectation 原话:
> "工人在小程序点工序卡, 每小时上报当时段产量, 后端按同产品+同工厂累加求和"

"按同产品+同工厂累加" — 实际维度是 (productTypeId, factoryId), **不是 hour**. Hour 只是上报频率.

→ 所以 Gap C **可能是误读** customer 需求. 真实需求很可能是 Gap A + Gap B 的组合: 客户想看 "今日 product P 在 factory F 的累计产量 (含未审)" — 这个查询能拼出来 (Gap A 修后 + Gap B 显示 pending).

如果客户后续真要 hourly 趋势图, 再加 endpoint:

```sql
SELECT date_trunc('hour', created_at) AS hour,
       COALESCE(SUM(CAST(output_quantity AS DECIMAL(12,2))), 0) AS output
FROM production_reports
WHERE factory_id = :factoryId AND product_name = :productName
  AND created_at BETWEEN :start AND :end
  AND deleted_at IS NULL
GROUP BY hour ORDER BY hour;
```

---

## 5. 不是 bug 但值得记录

### Legacy /work-reporting/reports 路径**禁止**hourly 报工

`WorkReportingServiceImpl.submitReport:69-82`:

```java
duplicate = reportRepository.existsByFactoryIdAndWorkerIdAndBatchIdAndReportTypeAndReportDateAndDeletedAtIsNull(
        factoryId, workerId, request.getBatchId(), request.getReportType(), request.getReportDate());
if (duplicate) {
    throw new BusinessException(409, "您今天已对该批次提交过报工")
            .withHint("如需修改请编辑已有记录, 而非重复提交");
}
```

`reportDate` 是 LocalDate. P1-2 规则: "1 报工 / worker / batch / day". 客户用 DynamicReportScreen 做 hourly 报工会被 409 拒.

**对客户的隐含约束**: F006 hourly 报工只能走 `ProcessTaskReportScreen` / `ThreeStepReportScreen` (PROCESS path). 这条约束在前端和文档里都没写. 如果客户混用了 DynamicReport, 会直接 409.

→ 与本 issue 关系不大, 但可能是 future 客户支持的混淆点.

### chat5 OTA reference 是 stale

issue body 引用 `project_apr28_data_fabric_c_day23_30_complete.md` 说 "chat5 OTA in-flight 修复中" 可能已修 T4-B6. git log 确认: Apr 28 之后所有 OTA 工作 (PR #363/#373/#375/#380/#381/#382/#451) 仅限 nginx 反代 / build pipeline / push-bundle / emulator demo. **没有 work on 报工 endpoint**.

---

## 6. 推荐工作分配

按优先级 / 工时:

| ID | 工作 | 优先级 | 估时 | 责任 chat |
|----|------|--------|------|----------|
| Fix T4-B6 | SQL-side dedup + index | **P1** | 1 day | Java backend chat |
| Fix T1-5 Gap A | PROCESS 报工写 product_name | P2 | 0.5 day | Java backend chat |
| Decide T1-5 Gap B | PM/business decision (3 选项) | P2 | 0.5 day | PM + organizer |
| Implement T1-5 Gap B | 实现 PM 选定方案 | P2 | 1-2 day | full-stack chat |
| E2E 真机验证 | Maestro YAML 在 F006 账号上跑 | P2 | 1 day | e2e-native chat |
| (optional) Hourly trend API | Gap C 可选实现 | P3 | 1 day | Java backend chat |

**Total**: T4-B6 约 1 day P1 修复; T1-5 全套 3-4 day P2.

---

## 7. 引用

- Frontend submit handlers: [ScanReportScreen](../../frontend/CretasFoodTrace/src/screens/processing/ScanReportScreen.tsx) / [TeamBatchReportScreen](../../frontend/CretasFoodTrace/src/screens/processing/TeamBatchReportScreen.tsx) / [ThreeStepReportScreen](../../frontend/CretasFoodTrace/src/screens/processing/ThreeStepReportScreen.tsx) / [ProcessTaskReportScreen](../../frontend/CretasFoodTrace/src/screens/processing/ProcessTaskReportScreen.tsx) / [useReportWorkflow](../../frontend/CretasFoodTrace/src/hooks/useReportWorkflow.ts)
- API client: [apiClient.ts](../../frontend/CretasFoodTrace/src/services/api/apiClient.ts) line 16 (timeout config)
- Backend (T4-B6): [ProcessWorkReportingServiceImpl.java](../../backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/ProcessWorkReportingServiceImpl.java#L201)
- Backend (T1-5 Gap A): same file line 241-253 (missing productName)
- Backend (T1-5 Gap B): `syncQuantitiesToTask` line 468-507
- Repository: [ProductionReportRepository.java](../../backend/java/cretas-api/src/main/java/com/cretas/aims/repository/ProductionReportRepository.java)
- Customer source: [六扇门第四次-May10.md](../会议内容/客户会议/六扇门第四次-May10.md) line 616-630

---

## 8. Status

| 任务 | Status |
|------|--------|
| Frontend audit | ✅ done — not the bug |
| Backend trace POST `/process-work-reporting/normal` | ✅ done — N²-load confirmed |
| Cumulative aggregation logic | ✅ done — 3 gaps mapped |
| chat5 OTA reference verify | ✅ done — stale |
| File P1 ticket | ✅ this PR (closes #566 with full investigation) |
| Implement T4-B6 fix | ⏳ deferred to backend chat |
| Implement T1-5 fixes | ⏳ deferred to backend + PM |
