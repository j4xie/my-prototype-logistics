# Sprint 3 Track-H M-BOM-VER-1 — Marching Order

**Dispatched**: 2026-05-16
**Target chat**: fresh Claude Code session, no prior context
**Branch**: `feature/sprint3-track-h-m-bom-ver-1`
**Estimated effort**: 15 days backend major (Claude 加速 ~9d)
**Backlog**: `宏见竞品分析/06-宏见测试账号深度审计/28-CRETAS-PRIORITIZED-BACKLOG.md` §1.1 row 4 (P0 战略)
**Audit reference**: `宏见竞品分析/06-宏见测试账号深度审计/30-BACKLOG-STATUS-AUDIT.md` §2

## Goal

把 Cretas BOM 从 "配方版本" (BomRecipe.version Integer) 升级到 **工程级 PLM-Lite**, 含:

1. **BomVersion entity 独立** — 不是 BomRecipe 嵌入字段, 是独立行 (每次审批产生 1 新 row, 历史可追溯)
2. **ECN (Engineering Change Notice)** — 配方变更必填变更原因 (5 类: 客户要求 / 物料停产 / 成本优化 / 质量缺陷 / 工艺改进) + 影响范围 + 通知列表
3. **BOM 反查** — 物料 → 哪些 BOM 用了它 (物料替换/降级影响评估)
4. **批量操作 4 种** — BOM 物料批量 修改/替换/删除/新增

宏见参考: BOM 列表 12 列含 BOMID + 版本号 + 工序数 + 物料数 + 工作流状态 + ECN 历史. F006 卤制品配方迭代 (牛肉减 5g 改 195g + 盐增 1g) 不能直接覆盖, 必须 ECN 流程 + 历史可追溯.

**注意**: BomChangeLog 现有 (`entity/bom/BomChangeLog.java` 7 字段) 只是 log, 无 snapshot, **不能替代 BomVersion**. 需 net-new.

## Prerequisites done

- ✅ BomRecipe + BomItem + BomRecipeItem entity 全存在 (`entity/bom/`)
- ✅ BomController + BomRecipeController 全存在
- ✅ 6 BomRecipe Tool 全存在 (Activate / Clone / CostCalculate / CreateFromSample / CreateFromText / Query)
- ✅ BomChangeLog 现有 (但只是 log)
- ⏳ Track-E (F-VFLAG-1) + Track-F (C-LINKARRAY-1) + Track-G (S-LOCK-1) Wave 1 并行
- ⏳ Track-I (C-APPROVAL-EDITOR-1) Wave 2 同期 — ECN 审批可复用 ApprovalChainConfig (后端 ready, 前端 Track-I 提供)

## Read these files first

1. `宏见竞品分析/06-宏见测试账号深度审计/02-工程管理-deep-audit.md` — 宏见 PLM-Lite 实测 (Round 4-5)
2. `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/bom/BomRecipe.java` — 现有 entity 15 字段 (含 version Integer + isCurrent Boolean)
3. `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/bom/BomItem.java`
4. `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/bom/BomRecipeItem.java`
5. `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/bom/BomChangeLog.java` — 现有 7 字段 log
6. `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/bom/` — 6 现存 Tool 模式
7. `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/BomController.java` + `BomRecipeController.java`
8. `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/ApprovalChainConfig.java` — ECN 审批配合
9. `.claude/rules/ai-intent-tool-skill-architecture.md` / `database-entity-sync.md` / `field-naming-convention.md`

## Concrete tasks

### Day 1-3: BomVersion entity 独立化

`entity/bom/BomVersion.java` (NEW):

```java
@Entity
@Table(name = "bom_versions")
public class BomVersion extends BaseEntity {
    private String id;                       // UUID
    private String factoryId;
    private String bomRecipeId;              // FK to BomRecipe (parent)
    private Integer versionNumber;           // 1, 2, 3 (per BomRecipe sequential)
    private String snapshotJson;             // FULL snapshot of recipe + items at time of approval (Jackson serialized)
    private VersionStatus status;            // DRAFT / PENDING_APPROVAL / APPROVED / OBSOLETE
    private LocalDate effectiveFrom;
    private LocalDate effectiveTo;           // null = current effective
    private String createdBy;
    private String approvedBy;
    private Instant approvedAt;
    private String ecnId;                    // FK to EngineeringChangeNotice (null = manual version, no ECN)
}
```

Flyway: `V20260516_04__bom_version_and_ecn.sql` (协调 Wave 1+2: Track-F _01, Track-G _02, Track-E _03, Track-H _04, Track-I _05, Track-J _06).

`entity/bom/EngineeringChangeNotice.java` (NEW):

```java
@Entity
@Table(name = "engineering_change_notices")
public class EngineeringChangeNotice extends BaseEntity {
    private String id;
    private String factoryId;
    private String ecnNumber;                // "ECN-2026-0001"
    private String bomRecipeId;
    private Integer fromVersion;
    private Integer toVersion;
    private EcnReason reason;                // CUSTOMER_REQUEST / MATERIAL_DISCONTINUED / COST_OPTIMIZATION / QUALITY_DEFECT / PROCESS_IMPROVEMENT
    private String reasonDetail;             // text 详细描述
    private String impactScope;              // JSON: 哪些 SKU / 哪些客户受影响
    private String notifyRoles;              // JSON: 生产 / 采购 / 质检 / 销售
    private LocalDate effectiveDate;         // 生效日期 (历史订单仍走旧 BOM)
    private EcnStatus status;                // DRAFT / SUBMITTED / APPROVED / REJECTED / EFFECTIVE
    private String approvalChainId;          // FK ApprovalChainConfig (复用 Track-I 即将 ship 的编辑器)
    private String createdBy;
    private String approvedBy;
    private Instant approvedAt;
}
```

Flyway 含触发器: BomVersion.effectiveTo 自动 set when 新 version 生效.

### Day 4-5: BomVersionService + ECNService

`service/bom/BomVersionService.java`:

```java
public interface BomVersionService {
    BomVersion createDraft(String factoryId, String bomRecipeId, String userId);
    BomVersion submitForApproval(String versionId, String ecnId);   // 提交审批
    void approve(String versionId, String approverId);              // 审批通过 → 旧 isCurrent=false, 新 isCurrent=true
    void reject(String versionId, String reason);
    BomVersion getCurrent(String bomRecipeId);                       // 查当前生效版本
    List<BomVersion> getHistory(String bomRecipeId);                 // 查全部历史版本
    BomVersion getEffectiveAt(String bomRecipeId, LocalDate date);   // 查某历史日期的有效版本 (订单追溯用)
}
```

`service/bom/ECNService.java`:

```java
public interface ECNService {
    EngineeringChangeNotice create(EcnCreateRequest req);
    void submitForApproval(String ecnId);
    void approve(String ecnId, String approverId);    // → 自动 trigger BomVersion.approve(toVersionId)
    void notifyImpactedRoles(String ecnId);            // 推送 InAppNotification (跟 SlotFilling 现有 NotificationService 集成, May 14 R7 调研)
    EcnImpactReport calculateImpact(String bomRecipeId, BomChangeRequest changes);
}
```

### Day 6-7: BomReverseQueryService (反查)

`service/bom/BomReverseQueryService.java` (核心: 物料 → BOM list):

```java
public interface BomReverseQueryService {
    /** 反查: 哪些 BOM 用了这个物料? */
    List<BomRecipe> findRecipesByMaterial(String materialId);

    /** 反查: 哪些 BOM 用了这个物料的某规格 (含批量数据)? */
    List<BomItemUsage> findUsageByMaterial(String materialId);

    /** 替换影响: 把物料 A 换成 B, 影响哪些 BOM / 数量变化? */
    MaterialReplacementImpact analyzeReplacement(String oldMaterialId, String newMaterialId);
}
```

实现重点: SQL 优化 (扫 BomRecipeItem 表). 建议 index `(material_id, factory_id)`.

### Day 8-9: BomBatchOperationService (批量 4 种)

`service/bom/BomBatchOperationService.java`:

```java
public interface BomBatchOperationService {
    BatchResult batchModify(BatchModifyRequest req);       // 批量修改: 多 BOM 同一物料 qty 全改
    BatchResult batchReplace(BatchReplaceRequest req);     // 批量替换: 物料 A → B 跨多 BOM
    BatchResult batchDelete(BatchDeleteRequest req);       // 批量删除: 多 BOM 同一物料全删
    BatchResult batchAdd(BatchAddRequest req);             // 批量新增: 多 BOM 同时加一物料 (e.g. 全产品加个 0.5g 防腐剂)
}
```

每种批量操作要 trigger BomVersion + ECN (自动建 DRAFT 版本 + DRAFT ECN, 用户后续 submit).

### Day 10-12: AIChat Tools + Controller

5+ 新 Tool (`ai/tool/impl/bom/`):
- `BomVersionCreateTool` / `BomVersionApproveTool` / `BomVersionHistoryTool`
- `EcnCreateTool` / `EcnApproveTool`
- `BomReverseQueryTool`
- `BomBatchOperationTool`

`BomVersionController` + `EcnController` REST endpoints.

### Day 13-14: Migration + Backfill

`scripts/migrations/2026-05-16-bom-version-backfill.sh`:
- 现有 BomRecipe (每行 1 个) → 创建对应 BomVersion (version=current.version, snapshot=BomRecipe JSON serialize)
- 现有 BomChangeLog → migrate 为 EngineeringChangeNotice (DRAFT 状态, 用户后续 finalize)

### Day 15: PR + smoke + acceptance

```bash
gh pr create --title "[Sprint3-H] M-BOM-VER-1 BOM 工程级升级 (BomVersion + ECN + 反查 + 批量)" --body "..."
```

## Acceptance gates (DoD)

- [ ] V20260516_04 Flyway apply (2 表 + index + 触发器)
- [ ] BomVersion 完整 CRUD + 状态机 (DRAFT → PENDING → APPROVED → OBSOLETE)
- [ ] ECN 5 reason 枚举 + 完整审批 (复用 ApprovalChainConfig)
- [ ] BomReverseQueryService.findRecipesByMaterial 性能 ≤ 200ms for 1000 BomRecipe
- [ ] 4 批量操作单测全过 (modify/replace/delete/add)
- [ ] 7+ AIChat Tool 注册可见
- [ ] Migration script backfill 现有 BomRecipe → BomVersion 1 row, 现有 BomChangeLog → ECN DRAFT
- [ ] AIChat E2E: "把所有牛肉 BOM 的盐量加 1g" → batch tool → ECN DRAFT → 审批 → 全 BOM 新版本
- [ ] AIChat E2E: "查 BOM 反查: 哪些产品用了'昌弘鸡精'" → BomReverseQueryTool → list

## Branch + PR

```bash
git checkout -b feature/sprint3-track-h-m-bom-ver-1
gh pr create --title "[Sprint3-H] M-BOM-VER-1 BOM 工程级升级 (15d backend major)"
```

## Risks + watchouts

1. **现有 BomRecipe.version Integer 字段 不删** — 双轨过渡 (BomRecipe.version 是"快照式 latest", BomVersion 是历史追溯). 6 月过渡期后 deprecate BomRecipe.version
2. **isCurrent Boolean** — 保留, 跟 BomVersion.status=APPROVED + effectiveTo IS NULL 等价. Service 层 sync 这 2 处
3. **ECN 审批依赖 Track-I (C-APPROVAL-EDITOR)** — 后端 ApprovalChainConfig 已 ready, ECNService 可 hardcode 1 个默认 chain. Track-I ship 后用户可可视化改
4. **Migration script 风险** — 现有数千 BomRecipe 创建 BomVersion. 必先 dry-run + sample 10 验证 + 完整 backup
5. **canViewPrice RBAC** — BomVersion.snapshotJson 含 cost. 加 @PriceSensitive on snapshotJson (跟 Track-B1 C-RBAC-1 hooks 配合)
6. **Tool 命名** — grep `getToolName` 确认 `bom_version_*` / `ecn_*` / `bom_reverse_query` / `bom_batch_*` 无冲突
7. **Flyway 编号协调** — Wave 1+2 6 chat 用 V20260516_01 (F) / _02 (G) / _03 (E) / _04 (H) / _05 (I) / _06 (J)
8. **依赖 Track-F (LinkArrayService)** — BomVersion 跟业务单 link (e.g. Voucher / SalesOrder) 可用 LinkArrayService (Track-F Day 1 ship 后)

## Reference

- 宏见 deep-audit: `02-工程管理-deep-audit.md` Round 5 ECN 5 reason + BOMID + 版本号 + 反查 实测
- Memory rules: `feedback_organizer_brief_grep_before_assume.md` HARD / `feedback_concurrent_edit_safety.md` HARD

---

**Total**: 15 days backend major (~9d Claude 加速). Wave 2 最大头 backend, 跟 Track-I + Track-J frontend 完全并行. ECN 审批前端基于 Track-I 即将 ship.
