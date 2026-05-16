# Sprint 3 Track-F C-LINKARRAY-1 — Marching Order

**Dispatched**: 2026-05-16
**Target chat**: fresh Claude Code session, no prior context
**Branch**: `feature/sprint3-track-f-c-linkarray-1`
**Estimated effort**: 2 days (backend quick win)
**Backlog**: `宏见竞品分析/06-宏见测试账号深度审计/28-CRETAS-PRIORITIZED-BACKLOG.md` §1.1 row 2 (P0 战略)
**Audit reference**: `宏见竞品分析/06-宏见测试账号深度审计/30-BACKLOG-STATUS-AUDIT.md` §2

## Goal

实现宏见 ERP 的 **linkListArray 8 类跨业务关联** 机制. 客户做业务追溯 (e.g. "这张采购单源自哪张销售单 + 哪个生产工单 + 哪笔库存调拨") 时, 通用 BusinessLinkArray 一次查全部. 现状 Cretas 各业务单各自有 hard-coded link (ReturnOrder → SalesOrder; ProductionPlan → SalesOrder; SplitOrderTool 等), **无统一查询入口**.

宏见参考: 8 类 link 维度 = `sale` / `sample` / `request` / `produce` / `outsource` / `stock` / `project` / `free` — 每业务单可挂 N 个 link.

## Prerequisites done

- ✅ Sprint 1 + Sprint 2 已 ship: Track-A through D2 + Sprint2-E through J (含 S-MRP-1 销售→采购自动分流 #682 已 ship, 提供 link 触发场景)
- ✅ ReturnOrder + ProductionPlan + SplitOrderTool 现有 link 模式可参考
- ⏳ Track-E (F-VFLAG-1) Track-G (S-LOCK-1) 并行进行, 不互相 block

## Read these files first

1. `宏见竞品分析/06-宏见测试账号深度审计/30-BACKLOG-STATUS-AUDIT.md` — Sprint 3 全局 context
2. `宏见竞品分析/06-宏见测试账号深度审计/02-销售管理-deep-audit.md` — 宏见 linkListArray 原始 audit (Round 5)
3. `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/inventory/SalesOrder.java` — 第一个目标 entity
4. `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/inventory/ReturnOrder.java` — 现存 link 模式参考
5. `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/production/CreateProductionPlanRequest.java` — 现存 link 模式参考
6. `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/returnorder/ReturnOrderCreateTool.java` — Tool 集成参考
7. `.claude/rules/ai-intent-tool-skill-architecture.md` — 添加 Tool 规范
8. `.claude/rules/database-entity-sync.md` — JPA 实体 + Flyway 迁移规范
9. `.claude/rules/field-naming-convention.md` — camelCase entity / snake_case DB

## Concrete tasks

### Task 1 — 设计 BusinessLink schema (Day 1 上午)

`backend/java/cretas-api/src/main/java/com/cretas/aims/entity/common/BusinessLink.java`:

```java
@Embeddable  // 或独立 @Entity 含 owner_id + link_type FK
public class BusinessLink {
    private String linkType;     // sale / sample / request / produce / outsource / stock / project / free
    private String targetType;   // 目标业务单类型: SALES_ORDER / PURCHASE_ORDER / PRODUCTION_PLAN / RETURN_ORDER / INVENTORY_TRANSACTION / ...
    private String targetId;     // 目标 UUID
    private String description;  // 可选: 关联备注
    private Instant linkedAt;
    private String linkedBy;     // userId
}
```

**Decision**: 用 JSONB column `business_links` (List<BusinessLink>) 还是独立 `business_link` table?

推荐 **独立 table** (避免 JSONB 索引慢 + 支持反查 "谁 link 了我"):
- 表名: `business_links`
- 主键: id (UUID)
- 字段: `id, owner_type, owner_id, link_type, target_type, target_id, description, linked_at, linked_by, factory_id`
- 唯一 index: `(owner_type, owner_id, target_type, target_id)`
- 反查 index: `(target_type, target_id)`

Flyway: `backend/java/cretas-api/src/main/resources/db/migration/V20260516_01__business_links.sql`

### Task 2 — `LinkArrayService` 实现 (Day 1 下午)

`backend/java/cretas-api/src/main/java/com/cretas/aims/service/LinkArrayService.java`:

```java
public interface LinkArrayService {
    void link(String ownerType, String ownerId, String linkType, String targetType, String targetId, String description, String userId);
    void unlink(String ownerType, String ownerId, String targetType, String targetId);
    List<BusinessLink> getOutboundLinks(String ownerType, String ownerId);  // 我 link 了谁
    List<BusinessLink> getInboundLinks(String targetType, String targetId);  // 谁 link 了我
    List<BusinessLink> getByType(String factoryId, String linkType, int page, int size);  // 按 linkType 查
}
```

实现 `LinkArrayServiceImpl` + `LinkArrayRepository` (Spring Data JPA).

### Task 3 — 迁移现有 link 模式 (Day 2 上午)

把现有硬编码 link 迁移到统一 service:

- `ReturnOrderCreateTool` (entity/inventory/ReturnOrder.java line ?, sourceSalesOrderId 字段):
  - 创建 ReturnOrder 时 call `linkArrayService.link("RETURN_ORDER", returnOrderId, "sale", "SALES_ORDER", sourceSalesOrderId, "退货源单", userId)`
  - **保留** ReturnOrder.sourceSalesOrderId 字段 (向后兼容), 但加新调用统一 service

- `ProductionPlanController` 创建 plan 时 (源自 SalesOrder 的 production):
  - `linkArrayService.link("PRODUCTION_PLAN", planId, "sale", "SALES_ORDER", sourceSalesOrderId, "生产源单", userId)`

- `SplitOrderTool` 拆单时 (1 销售单 → N 采购单):
  - 对每张拆出的采购单 link 回原销售单

### Task 4 — Tool 集成 (Day 2 下午)

`backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/common/BusinessLinkQueryTool.java`:

```java
@Component
public class BusinessLinkQueryTool extends AbstractBusinessTool {
    @Autowired
    private LinkArrayService linkArrayService;

    @Override
    public String getToolName() { return "business_link_query"; }

    @Override
    public String getDescription() {
        return "查询业务单跨域关联. 输入 ownerType + ownerId, 返回 outbound (我 link 了谁) + inbound (谁 link 了我) 完整 list. 支持 8 类 link: sale/sample/request/produce/outsource/stock/project/free.";
    }

    @Override
    protected Map<String, Object> doExecute(...) {
        var outbound = linkArrayService.getOutboundLinks(ownerType, ownerId);
        var inbound = linkArrayService.getInboundLinks(ownerType, ownerId);
        return buildSimpleResult("查询成功", Map.of("outbound", outbound, "inbound", inbound));
    }
}
```

### Task 5 — Acceptance tests

1. **Create + Query**: 创建 ReturnOrder linked to SalesOrder → query outbound returns 1 link, query inbound (from SalesOrder side) returns 1 link
2. **Multi-link**: 1 SalesOrder → 3 PurchaseOrder (拆单) → query outbound from 1 SalesOrder returns 3 links
3. **Type filter**: factory-level `getByType("sale")` returns all "sale" type links
4. **Unlink**: link + unlink → outbound/inbound both 0
5. **factoryId isolation**: factory A 的 link 不可见到 factory B
6. **AIChat**: "查这张销售单 SO-2026-0123 的所有关联" → AI 调用 `business_link_query` Tool, 返回完整 list

## Acceptance gates (DoD)

- [ ] `business_links` 表 Flyway V20260516_01 在 prod + test schema 全 apply
- [ ] LinkArrayService 单测 ≥ 6 cases (Task 5 上述 6 项)
- [ ] 至少 3 处现有 hard-coded link 迁移 (ReturnOrder + ProductionPlan + SplitOrderTool)
- [ ] BusinessLinkQueryTool 在 `ToolRegistry` 启动日志可见 `✅ 注册工具: name=business_link_query`
- [ ] AIChat 端到端: "查 SO-XXX 关联" 返回 JSON
- [ ] Vue Web list view 可点 link 跳转 (优先级低, 可留 Track-F 后续 PR)

## Branch + PR

```bash
git checkout -b feature/sprint3-track-f-c-linkarray-1
# Day 1-2 work
git push -u origin feature/sprint3-track-f-c-linkarray-1
gh pr create --title "[Sprint3-F] C-LINKARRAY-1 跨业务关联 (business_links + LinkArrayService + Tool)" --body "Backlog: 28-CRETAS-PRIORITIZED-BACKLOG.md §1.1 row 2 (P0 战略, 2d)..."
```

## Risks + watchouts

1. **JSONB vs 独立 table**: 推荐独立 table (可索引 + 反查). 若 spec 改为 JSONB, 注意 PG 13+ JSONB GIN 索引开销
2. **现有 sourceSalesOrderId 字段**: 不要删, 双轨过渡 (新调 LinkArrayService + 老字段保留 6 个月)
3. **factoryId 隔离**: 所有 query 必走 factory_id WHERE (RLS 或 application-level)
4. **AIChat Tool**: 跟现 337+ Tool 命名冲突? grep `getToolName` 确认 "business_link_query" 不重复
5. **Memory rule**: `feedback_organizer_brief_grep_before_assume.md` — 写 entity 前 grep 真实 BomItem / SalesOrder / ReturnOrder 字段名 (不假设 ERP convention)

## Reference

- 宏见 deep-audit: `宏见竞品分析/06-宏见测试账号深度审计/02-销售管理-deep-audit.md` Round 4 linkListArray
- Memory rules: `feedback_organizer_brief_grep_before_assume.md` HARD / `feedback_gh_pr_search_before_dispatch_outstanding.md` HARD

---

**Total**: 2 days backend quick win. Independent — 可跟 Track-E (F-VFLAG-1) + Track-G (S-LOCK-1) 完全并行.
