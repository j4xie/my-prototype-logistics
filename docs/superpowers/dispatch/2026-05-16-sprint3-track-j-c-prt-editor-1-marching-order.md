# Sprint 3 Track-J C-PRT-EDITOR-1 — Marching Order

**Dispatched**: 2026-05-16
**Target chat**: fresh Claude Code session, no prior context
**Branch**: `feature/sprint3-track-j-c-prt-editor-1`
**Estimated effort**: **6-10 days frontend major** (原估 10d, grep 发现 PageEditor 现存 + FormTemplate ready, 下调)
**Backlog**: `宏见竞品分析/06-宏见测试账号深度审计/28-CRETAS-PRIORITIZED-BACKLOG.md` §1.1 row 6 (P0 战略)
**Audit reference**: `宏见竞品分析/06-宏见测试账号深度审计/30-BACKLOG-STATUS-AUDIT.md` §2

## Goal

实现 **打印模板可视化设计器**. C-PRT-1 后端 (#659 Track-C 已 ship) 提供 5 单据 PDF 打印能力, 但模板是 hardcoded. 客户自服务能力 — 不用找开发改 PDF 模板, 可视化拖拽设计:

- 5+ 单据类型: 销售单 / 采购单 / 报价单 / 生产任务 / 领料单 (再加 称重单 ⭐, 宏见 print 20 模板分类含称重 — 食品行业刚需)
- 拖拽组件: 文本 / 字段绑定 / 表格 / 二维码 / 条码 / 图片 / 章
- 模板 JSON-Schema 化, 保存到现存 `FormTemplate.schemaJson` + `uiSchemaJson` 字段
- 预览: 实际渲染 + PDF 导出
- 版本管理: 跟 FormTemplateVersion 配合 (已有 entity)

宏见参考: `print.hongjian.com` — 20 模板分类 + 25+ 具体模板 (含 **称重模板** ⭐⭐).

⭐ **Cretas 现状 (grep verify)**:
- FormTemplate + FormTemplateVersion + FactoryTemplate entity 全 ready
- FormTemplate fields: `id / factoryId / name / entityType / schemaJson / uiSchemaJson / version / isActive` — JSON-Schema 化 ready
- PrintController + FormTemplateController + TemplatePackageController 全 ready
- PrintDocumentTool (AI Tool) 已 ship
- CanvasApplyTemplateTool — 现存 canvas-based template apply
- **PageEditor.vue 现存** (Sprint 1 Track-A ship), 可复用 ~60%

**这意味着 10d 估算 高估了 2-4d**. 实际 6-10d 含: 3-4d 拖拽组件库 + 2d 字段绑定 + 2d PDF preview + 2-3d acceptance.

## Prerequisites done

- ✅ Backend 100% ready: FormTemplate + Version + Controller + Print + Tool 全栈
- ✅ PageEditor.vue (Sprint 1 Track-A) canvas 编辑器基础
- ✅ jsPDF / pdf-lib (现存依赖, Phase IIa 用过) 可做 preview
- ✅ C-PRT-1 后端已 ship 5 单据 PDF (Track-C #659)
- ⏳ Track-I (C-APPROVAL-EDITOR) 同期 ship — 共享 PageEditor 改造经验

## Read these files first

1. `宏见竞品分析/06-宏见测试账号深度审计/02-系统管理-deep-audit.md` Round 7-8 print.hongjian.com 20 模板
2. `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/FormTemplate.java` — 10 字段 verified
3. `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/FormTemplateVersion.java`
4. `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/FormTemplateController.java`
5. `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/PrintController.java` — 现存 endpoints
6. `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/print/PrintDocumentTool.java` — Tool 模式
7. `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/canvas/CanvasApplyTemplateTool.java` — canvas template apply
8. `web-admin/src/views/platform/canvas-editor/PageEditor.vue` — Sprint 1 ship canvas editor (复用基础)
9. `web-admin/src/views/platform/canvas-editor/components/FormCanvas.vue`

## Concrete tasks

### Day 1: 评估 PageEditor 复用度 + 设计

打开 PageEditor.vue 看 canvas 架构. 决定:

- **方案 A (推荐)**: 新建 `PrintTemplateEditor.vue` (类比 PageEditor) + 复用 canvas/拖拽/serialize 基础
- **方案 B**: 跟 PageEditor 共享 base canvas component, 组件类型 plug-in (form fields vs print elements)

写 design doc `docs/superpowers/specs/2026-05-16-c-prt-editor-design.md` (~100 lines).

### Day 2-3: 拖拽组件库

`web-admin/src/views/platform/print-template-editor/`:

```
PrintTemplateEditor.vue           (主页面)
components/
  TextElement.vue                 (静态文本 + 样式)
  FieldElement.vue                (字段绑定 {{order.orderNumber}})
  TableElement.vue                (表格 - row from collection)
  QrCodeElement.vue               (二维码)
  BarcodeElement.vue              (条码)
  ImageElement.vue                (图片 - 含 logo / 印章)
  StampElement.vue                (电子章 ⭐)
sidebar/
  ElementPalette.vue              (左侧拖拽组件库)
  PropertyPanel.vue               (右侧属性: font/color/size/binding/...)
  EntityFieldTree.vue             (左下: 当前 entityType 的字段树, 拖到画布即绑定)
toolbar/
  PrintTemplateToolbar.vue        (保存/预览/PDF导出/版本切换)
```

### Day 4: 字段绑定引擎

字段绑定语法: `{{entity.field}}` / `{{entity.subItems[].field}}` / `{{computed.totalAmount}}` / `{{format.currency(field)}}` / `{{date(field, 'YYYY-MM-DD')}}`.

实现 `templateRenderer.ts` (前端 + 后端 mirror) — 接 entityData JSON + template schema, 输出 渲染后 JSON.

### Day 5-6: PDF preview + export

集成 `pdf-lib` (现存依赖, Phase IIa 用过). PrintTemplateEditor 顶部 "Preview PDF" button:
- 输入: 当前 template + mock entity data
- 输出: PDF blob → preview in modal + download button

PDF 渲染逻辑可复用 backend C-PRT-1 (#659) 的 server-side 渲染 (调 `/api/mobile/{factoryId}/print/preview` endpoint, 输入 templateId + entityId, 返回 PDF stream).

### Day 7: AIChat Tool 集成

`PrintTemplateCreateFromAITool.java` (后端):
- 输入: entityType + AI prompt ("帮我设计一个销售单 PDF, 顶部 logo + 订单号大字体 + 客户信息 + 物料 table + 二维码")
- AI 生成 template schema JSON + uiSchema → 保存 FormTemplate
- 前端 PrintTemplateEditor 可继续编辑

### Day 8-9: Acceptance + 5+1 单据模板 seed

E2E:
1. Login admin → 进 PrintTemplateEditor → entityType="SalesOrder"
2. 拖 4 元素 (Logo + 订单号 + 客户 + 物料 table)
3. 字段绑定 `{{order.orderNumber}}` / `{{order.customerName}}` / `{{order.items[]}}`
4. Preview PDF → 实际销售单数据填充
5. 保存 → POST /api/mobile/{factoryId}/form-templates → FormTemplate row created
6. 重新加载 → 模板还在 (反序列化 OK)
7. 实际销售单 → 打印 → 走新 template

Seed 5+1 默认模板:
- 销售单 / 采购单 / 报价单 / 生产任务 / 领料单 / **称重单** (F006 食品行业刚需, 宏见有)

### Day 10: PR

```bash
gh pr create --title "[Sprint3-J] C-PRT-EDITOR-1 打印模板可视化设计器 (PrintTemplateEditor + 7 组件 + PDF preview)"
```

## Acceptance gates (DoD)

- [ ] PrintTemplateEditor.vue 7 元素全可拖
- [ ] EntityFieldTree.vue 显示当前 entityType 字段, 拖即绑定
- [ ] PDF preview 跟实际打印一致
- [ ] 5+1 单据 seed 默认模板存在 (含称重单)
- [ ] FormTemplate.schemaJson + uiSchemaJson 可序列化 ↔ 反序列化
- [ ] 不破坏 C-PRT-1 (#659) 现有打印逻辑 (regression: 已 ship 5 单据仍正常打)
- [ ] AIChat: "设计一个销售单 PDF, 含 logo + table + 二维码" → AI 调 PrintTemplateCreateFromAITool → 模板生成
- [ ] RBAC: 只 factory_admin / role:print-template:edit 可编辑
- [ ] Vue build + vitest 全过 (HARD rule)

## Branch + PR

```bash
git checkout -b feature/sprint3-track-j-c-prt-editor-1
gh pr create --title "[Sprint3-J] C-PRT-EDITOR-1 打印模板可视化设计器"
```

## Risks + watchouts

1. **PageEditor 复用度 Day 1 关键** — 跟 Track-I 同样 risk. 设计 doc 必先出
2. **Field binding 引擎前后端一致** — 前端 preview 用 JS template engine, 后端 PDF 渲染用 Java engine, 两个必须 mirror (否则 preview ≠ actual print). 推荐: 前端调 backend `/api/mobile/{factoryId}/print/preview` (复用 backend renderer), 避免双重维护
3. **PDF 中文字体** — pdf-lib 默认无中文, 需 embed font (NotoSansSC 等). 注意 PDF size (font ~5MB)
4. **Print 性能** — 1 销售单 1 PDF 走 server-side render ~1-2s 可接受. 批量 100 PDF 要考虑 async + queue
5. **称重单模板 schema** — F006 卤制品 weighed 数据每箱不同, table 行数动态. EntityFieldTree 需支持 array 字段拖拽
6. **跟 C-CANVAS Tool 冲突?** — CanvasApplyTemplateTool 现存 (Track-A). PrintTemplateEditor 跟它共存? Day 1 决定 (推荐 keep 2 separate: CanvasApplyTemplateTool 服务 form layout, PrintTemplateEditor 服务 PDF print)
7. **Migration**: 现有 5 hardcoded PDF 模板要 seed 到 FormTemplate 表 (Day 8 seed script)
8. **Tool 命名** — grep 确认 `print_template_create_from_ai` 无冲突
9. **canViewPrice RBAC** — 模板字段绑定可能含价格, 渲染时按角色隐藏 (跟 Track-B1 C-RBAC-1 hooks 配合)

## Reference

- 宏见 deep-audit: `02-系统管理-deep-audit.md` Round 7-8 print.hongjian.com 20 模板分类 + 称重模板 ⭐
- C-PRT-1 ship: Track-C #659 (5 单据 PDF backend + AIChat Tool)
- PageEditor reference: Sprint 1 Track-A `c0127f6cd / ad73f3b93`

---

**Total**: 6-10 days frontend major (~4-6d Claude 加速). Wave 2 最小头 frontend, 跟 Track-H + Track-I 完全并行. Cretas 客户自服务能力跟宏见拉平.
