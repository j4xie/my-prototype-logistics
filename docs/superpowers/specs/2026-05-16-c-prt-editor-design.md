# C-PRT-EDITOR-1 — 打印模板可视化设计器 Design Doc

**Sprint**: 3 Track-J  **Branch**: `feature/sprint3-track-j-c-prt-editor-1`
**Author**: organizer (Day 1)  **Date**: 2026-05-16  **Status**: ✅ **Steve sign-off 2026-05-16** (4/4 decisions approved + cross-service integration follow-up)

---

## 0. TL;DR — 关键决策

| 决策点 | 结论 | 理由 |
|---|---|---|
| **Reuse PageEditor?** | ❌ **新建独立模块** (~25% pattern reuse, ~0% code reuse) | 不同 paradigm — PageEditor 是 form-FIELD 配置 (linear field list, FieldPalette → `DynamicField` API), Print 是 **layout** (absolute-positioned canvas, 任意位置任意元素). FormCanvas/FieldPalette 全部不可复用. 复用的只是 3-pane 布局**外形**. **Brief 写的 ~60% 复用是高估**, 实测 PageEditor 只 130 行薄壳, 实际 canvas 渲染在 FormCanvas (linear `<draggable>` 字段表) — 跟 print 完全不同 |
| **存储 schema?** | ✅ **复用 FormTemplate.schemaJson + uiSchemaJson** | 现存 entity + 版本管理 + CRUD 全 ready. 改 1 处: `entityType` 用 `PRINT_*` 前缀避免 collision (见 ⚠️ §3.1) |
| **PDF 渲染?** | ✅ **server-side via Python reportlab**, 前端只做视觉预览 (HTML+CSS) | Python 已有 `printing/services/pdf_renderer.py` (reportlab + 中文字体 + qrcode). 不重新引入 pdf-lib (brief 说"pdf-lib 现存依赖" — **不准确**, 实测 web-admin 装的是 jspdf 4.1.0, 后端是 reportlab). 前后端双引擎维护成本高, 走 server-side |
| **Editor 内 preview?** | ✅ **HTML/CSS canvas 实时拖拽** + "Preview PDF" button → server-side render | 拖拽响应 < 16ms 必须本地, PDF 字节精度走服务端 |
| **Field binding 引擎?** | ✅ Python 端是 source-of-truth, 前端用相同模板字符串只解析 mock data 用于编辑预览 | Avoid double-maintain. 实际打印 100% 走 Python |
| **AIChat Tool?** | `PrintTemplateCreateFromAITool` (后端) — input: entityType + prompt → AI gen schemaJson → save FormTemplate (factoryId 隔离 + RBAC 已由 FormTemplateController 兜底) | Tool 名 `print_template_create_from_ai` (grep 无冲突 ✓) |

---

## 1. 现状 Grep verify (10 facts)

1. ✅ `entity/config/FormTemplate.java` — 10 字段 (factoryId / name / entityType / schemaJson / uiSchemaJson / version / isActive / createdBy / source / sourcePackageId)
2. ✅ `entity/config/FormTemplateVersion.java` — 完整版本快照 entity
3. ✅ `controller/FormTemplateController.java` — 14 endpoint (CRUD + version history + rollback + compare + statistics + entity-types). **可直接复用, 0 改动**
4. ✅ `controller/PrintController.java` — 5 endpoint proxy Python `/api/printing/{type}`. 价格脱敏走 `PriceMaskResolver`. **新加 1 endpoint `/preview`** (§3.4)
5. ✅ `ai/tool/impl/print/PrintDocumentTool.java` — 现存 print_document tool, 仅返回 downloadUrl. 新建 sibling `PrintTemplateCreateFromAITool`
6. ✅ `ai/tool/impl/canvas/CanvasApplyTemplateTool.java` — 行业模板应用 (FOOD_PROCESSING/RESTAURANT), 跟本 feature 无关 (concept 不同), 不冲突
7. ✅ `web-admin/src/views/platform/canvas-editor/PageEditor.vue` — 130 行薄壳, 委托给 `FormCanvas` (linear `<draggable>` 字段表) + `FieldPalette` + `FieldPropertyDrawer` + `TabLayoutEditor`. **0 absolute-positioning, 0 拖拽到自由位置**
8. ✅ `backend/python/printing/services/pdf_renderer.py` — reportlab + 5 hardcoded renderer + 中文字体 (wqy-zenhei / NotoSansCJK / Win msyh fallback)
9. ⚠️ `service/impl/FormTemplateServiceImpl.SUPPORTED_ENTITY_TYPES` 是 **whitelist** — 8 个: QUALITY_CHECK / MATERIAL_BATCH / PROCESSING_BATCH / SHIPMENT / EQUIPMENT / DISPOSAL_RECORD / RAW_MATERIAL_TYPE / **PURCHASE_ORDER**. 含 PURCHASE_ORDER — collision 见 §3.1
10. ✅ web-admin deps: `jspdf ^4.1.0` + `qrcode ^1.5.4` 已装. **pdf-lib 未装** (brief 提到的是误)

---

## 2. 架构 (3 层)

```
Frontend (web-admin)               Backend Java                Backend Python
─────────────────────              ──────────────              ──────────────
PrintTemplateEditor.vue            FormTemplateController     printing/api/print.py
  ├ ElementPalette (左)              (现存, 0 改动)              + POST /render-template (新)
  ├ FormCanvas (中)                ─────────────────                ↓
  │   ↑ 7 components               PrintController                printing/services/
  │     - TextElement                + GET /preview (新)          template_renderer.py (新)
  │     - FieldElement                  ↓ proxy                    ├ schema → reportlab
  │     - TableElement                                              ├ field-binding {{}}
  │     - QrCodeElement                                             ├ canViewPrice mask
  │     - BarcodeElement                                            └ Chinese font
  │     - ImageElement
  │     - StampElement              ai/tool/impl/print/
  ├ PropertyPanel (右)               + PrintTemplateCreateFromAITool (新)
  └ EntityFieldTree (左下)             ↓ generate schemaJson
                                       ↓ POST /form-templates
                                       (走现存 FormTemplateController)
```

---

## 3. 关键 spec 决策

### 3.1 ⚠️ entityType collision 解决 — `PRINT_` 前缀

**问题**: FormTemplate.SUPPORTED_ENTITY_TYPES 已含 `PURCHASE_ORDER` (form schema for editing PO, ship 2026-05-07). Print template 不能复用同名 (语义冲突 + 同 factoryId 同 entityType 只能 1 个活跃).

**方案**: print template entityType 用 `PRINT_` 前缀:
- `PRINT_SALES_ORDER` / `PRINT_PURCHASE_ORDER` / `PRINT_QUOTATION` / `PRINT_PRODUCTION_TASK` / `PRINT_MATERIAL_REQUISITION` / **`PRINT_WEIGHING_SLIP`** (称重单 ⭐, F006 食品行业刚需)

**Day 8 改动** (FormTemplateServiceImpl.java:40):
```java
SUPPORTED_ENTITY_TYPES.addAll(List.of(
    "PRINT_SALES_ORDER", "PRINT_PURCHASE_ORDER", "PRINT_QUOTATION",
    "PRINT_PRODUCTION_TASK", "PRINT_MATERIAL_REQUISITION", "PRINT_WEIGHING_SLIP"
));
```

### 3.2 ⚠️ validateSchemaJson() shape — bypass for PRINT_*

**问题**: `FormTemplateServiceImpl.validateSchemaJson()` 要求 `{type, properties}` (Formily convention). Print schema 是 `{canvas: {width, height}, elements: [...], dataBindings: ...}`.

**方案**: 改 validate 跳过 PRINT_* 前缀, 或 print schema **包一层** Formily-friendly shape:
```json
{
  "type": "object",
  "properties": {
    "_printSchema": {
      "canvas": {"width": 595, "height": 842, "orientation": "portrait"},
      "elements": [
        {"type": "text", "x": 50, "y": 50, "text": "白垩纪食品 — {{factoryName}}", "fontSize": 20},
        {"type": "field", "x": 50, "y": 100, "binding": "{{order.orderNumber}}", "fontSize": 14},
        {"type": "table", "x": 50, "y": 200, "width": 495, "binding": "{{order.items}}", "columns": [...]},
        {"type": "qr", "x": 450, "y": 50, "size": 80, "content": "PO:{{factoryId}}:{{order.id}}"}
      ]
    }
  }
}
```

**选择: 包一层** (Day 1 决定) — 避免改 validate 逻辑, 后续清理代价低.

### 3.3 7 元素 schema 形状

```ts
type Element =
  | { type: 'text';    x: number; y: number; text: string; fontSize?: number; bold?: boolean; color?: string; align?: 'left'|'center'|'right' }
  | { type: 'field';   x: number; y: number; binding: string; fontSize?: number; format?: 'currency'|'date'|'percent' }
  | { type: 'table';   x: number; y: number; width: number; binding: string; columns: { header: string; binding: string; width: number; align?: string }[] }
  | { type: 'qr';      x: number; y: number; size: number; content: string }      // content 含 {{}} 模板
  | { type: 'barcode'; x: number; y: number; width: number; height: number; content: string; format?: 'CODE128'|'EAN13' }
  | { type: 'image';   x: number; y: number; width: number; height: number; src: string }   // src: data URI 或 url
  | { type: 'stamp';   x: number; y: number; size: number; stampId: string }      // stampId → FactorySetting.stampUrl
```

坐标系: A4 portrait 595×842 pt, origin (0,0) 左上角.

### 3.4 PDF preview endpoint 设计

新加 Java endpoint:
```
POST /api/mobile/{factoryId}/print/preview-template
Body: { "templateId": "uuid" | null,
        "inlineSchemaJson": "..." | null,   // 编辑实时预览不存盘
        "entityId": "..." | null,
        "entityType": "PRINT_SALES_ORDER",
        "mockData": {...} | null }           // 编辑 mock; 实打印 null
Returns: application/pdf bytes (with canViewPrice masking applied)
@RequirePermission system:read (任何登入用户可预览自己工厂模板, 实际打印走原 5 endpoint)
```

**注**: endpoint 命名 `preview-template` (不是 `/preview`) 以跟未来 entity-specific preview 区分. 见 §3.7 跨服务集成. Java proxy → Python `POST /api/printing/render-template` (factoryId path param + body).

### 3.5 Field binding 语法

| 语法 | 解析为 |
|---|---|
| `{{entity.field}}` | 直接字段 (order.orderNumber) |
| `{{entity.items[]}}` | 数组 binding (用于 table.binding) |
| `{{format.currency(field)}}` | ¥1,234.56 (跟 Python `_fmt_money` 一致) |
| `{{format.date(field, 'YYYY-MM-DD')}}` | 格式化日期 |
| `{{computed.totalAmount}}` | 由 ServerSide 计算 |

Resolver: Python `template_renderer._resolve_binding()`, 单一 source-of-truth. 前端 PreviewPanel 用 mock data + 同样语法做 client-side resolve 仅用于编辑预览 (实际打印走服务端).

### 3.6 RBAC + 价格脱敏

- 编辑 print template: `factory_admin` 或 `system:read_write` (沿用 FormTemplateController 现有装饰器)
- 预览/打印: 沿用原 5 endpoint 装饰器 (`sales:read` / `procurement:read` etc.)
- **价格字段在 PDF 渲染时按角色 mask**: PrintController.applyPriceMask 已有, render-template 调用前一并跑

### 3.7 跨服务集成模式 — Java owns entity, Python owns render (Steve 2026-05-16 sign-off)

**模式**: 跟 SmartBI 现状一致 — Java 拥有 entity (CRUD + RBAC), Python 拥有 render (reportlab + 模板解析). Python 通过 `smartbi_user` asyncpg pool 直接读 Cretas DB FormTemplate 表 (template schema), Java 负责 entity 数据 fetch (调 SalesOrderService 等). 参考 `reference_smartbi_rls_via_auth_middleware_guc.md` (memory).

**RLS scope**: `/api/mobile/{factoryId}/print/preview-template` factoryId 是 path param → Java 校验 → 传给 Python → Python `set_config('app.factory_id', $1, true)` per request → smartbi_user pool 自动应用 RLS (Cretas DB form_templates 表也启 RLS).

**Day 4 实施**:
```python
# template_renderer.py
async def render_from_template_id(factory_id: str, template_id: str, entity_data: dict) -> bytes:
    async with get_smartbi_pool().acquire() as conn:
        # set_config 已 by auth_middleware setup callback set 过, 再 set 一次防 sentinel
        await conn.execute("SELECT set_config('app.factory_id', $1, true)", factory_id)
        row = await conn.fetchrow(
            "SELECT schema_json, ui_schema_json FROM form_templates WHERE id = $1 AND factory_id = $2 AND is_active = true",
            template_id, factory_id
        )
        if not row:
            raise HTTPException(404, "template not found or not active")
        schema = json.loads(row["schema_json"])
        return render_schema_to_pdf(schema, entity_data, factory_id)
```

**Java 侧 (`PrintController.printPreviewTemplate`)**:
- 解析 body 拿 templateId (or inlineSchemaJson) + entityType + entityId/mockData
- 如果 entityId: 调 SalesOrderService.getById(factoryId, entityId) → flatten to dict (沿用 PrintController.buildSalesOrderPayload pattern)
- 应用 PriceMaskResolver (跟现有 5 endpoint 一致)
- POST 给 Python `/api/printing/render-template`, body 含 `factoryId / templateId or inlineSchemaJson / entityData`

**跟 C-PRT-1 (#659) 共存**: 原 5 endpoint (hardcoded 5 单据) 不动, 新加 `/preview-template` (schema-driven). 两个 endpoint 走两条 path:
- 原 5 单据 hardcoded → Python `/api/printing/{type}` (reportlab hardcoded renderer)
- 新 schema-driven → Python `/api/printing/render-template` (Day 4 新加 template_renderer.py)

未来可选 Day 11+ 让原 5 endpoint 也走 schema-driven (deprecate hardcoded renderer), 不在本 PR scope.

---

## 4. 文件清单 (Day 2-10)

### 新建 (frontend, ~12 files)
```
web-admin/src/views/platform/print-template-editor/
├ PrintTemplateEditor.vue              (~250L 主页面, 3-pane layout)
├ composables/usePrintEditor.ts         (~80L dirty/selected/save)
├ components/
│  ├ ElementPalette.vue                 (~100L 左侧 7 元素卡片)
│  ├ FormCanvas.vue                     (~200L 中间 canvas, 绝对定位 + 拖拽)
│  ├ PropertyPanel.vue                  (~150L 右侧动态属性表)
│  ├ EntityFieldTree.vue                (~120L 左下字段树, 拖到画布即绑定)
│  ├ PrintTemplateToolbar.vue           (~80L 保存/预览/导出/版本)
│  └ elements/
│     ├ TextElement.vue                 (~50L 每个 ~50-80L)
│     ├ FieldElement.vue
│     ├ TableElement.vue
│     ├ QrCodeElement.vue
│     ├ BarcodeElement.vue
│     ├ ImageElement.vue
│     └ StampElement.vue
└ utils/
   ├ printSchemaTypes.ts                (TS interfaces matching §3.3)
   ├ templateRenderer.ts                (~100L mock-data resolver, edit preview only)
   └ a4Coords.ts                        (pt ↔ px 换算)
```

### 新建 (backend, ~3 files)
```
backend/python/printing/services/
└ template_renderer.py                  (~250L schema → reportlab)
backend/python/printing/api/print.py    (+1 endpoint /render-template, ~30L)

backend/java/.../ai/tool/impl/print/
└ PrintTemplateCreateFromAITool.java    (~150L AI gen schemaJson)

backend/java/.../controller/
└ PrintController.java                  (+1 method printPreview, ~40L)
```

### 修改
- `FormTemplateServiceImpl.java:40` SUPPORTED_ENTITY_TYPES 加 6 个 PRINT_*
- `FormTemplateServiceImpl.validateSchemaJson()` 跳过 PRINT_* 严格校验 (或 schema 包 `_printSchema` 一层)
- `web-admin/src/router/index.ts` 加 1 route `/print-templates/:entityType?` (⚠️ 跟 Track-I 都加 route, 后到的 PR rebase 3 行)
- Migration / seed: `V20260516_01__seed_print_templates.sql` 插入 5+1 默认模板

---

## 5. Day 计划 (refined)

| Day | 任务 | 输出 | 验证 |
|---|---|---|---|
| 1 (今日) | **本 doc + grep verify** | design doc | Steve review ✓ |
| 2-3 | 7 元素 + Palette + PropertyPanel + EntityFieldTree + FormCanvas (拖拽 + 选中 + 删除) | 12 .vue + 3 .ts | `npx vite build` ✓ + 手动拖 5 元素到 canvas |
| 4 | template_renderer.py (Python) + render-template endpoint + Java /preview proxy | 3 file 新加 / 改 | curl POST mock schema → PDF 字节非零 |
| 5-6 | PreviewPanel 接 /preview + 保存 / 加载完整循环 | 闭环可工作 | 拖 → 预览 → 保存 → 重载 → 编辑 → 再预览 |
| 7 | PrintTemplateCreateFromAITool + intent binding | 1 tool 新建 | AIChat "设计销售单含 logo+table+二维码" → 模板生成 |
| 8 | 5+1 单据 seed (含 PRINT_WEIGHING_SLIP ⭐) + FormTemplateServiceImpl SUPPORTED 改 + validate 改 | 1 .sql + 2 .java | seed 后 `GET /form-templates` 见 6 PRINT_* row |
| 9 | E2E (Playwright, ~5 scenario) + regression (5 原 hardcoded PDF 仍工作) | spec.ts ✓ | E2E 100% pass |
| 10 | `npx vite build` + `npx vitest run` + `mvn test` + PR | green CI + PR | PR opened, CI green |

---

## 6. Risks (top 5)

1. **Schema validate 改动影响范围**: `validateSchemaJson()` 11 处 call. 选包一层 `_printSchema` 后 validate **不动**, 风险 0.
2. **PDF preview 性能**: 编辑时拖一次 → 调一次 server (~500ms-1s)? 用 debounce 1s + 只在 button 触发, 不实时. 拖拽视觉用纯前端 HTML/CSS, 0 server round-trip.
3. **称重单 (PRINT_WEIGHING_SLIP) 表格行数动态**: F006 卤制品每箱 weighing data 不同行. TableElement.binding 用 array → render 时 row count = `entityData[binding].length`. 已包含在 §3.3 table schema.
4. **canViewPrice 在 PDF 文本字符串**: 价格字段在 PDF 是 rendered 文本 (不是 JSON byte[]), 必须在 Python render 前 mask payload — 跟现有 PrintController.applyPriceMask 同 pattern. **Day 4 template_renderer.py 必须复用 applyPriceMask 逻辑** (or 暴露 helper).
5. **跟 Track-I C-APPROVAL-EDITOR 并行**: 都改 `router/index.ts`. 后 PR 的 rebase ~3 行. 不阻塞.

---

## 7. Steve sign-off log (2026-05-16)

1. **`PRINT_` 前缀 + 包 `_printSchema` 一层** (§3.1, §3.2) — ✅ approved (namespace 干净)
2. **Editor 内 HTML/CSS 实时 preview + Server-side PDF button** (§3.4) — ✅ approved (标准 UX 切分)
3. **Field binding 单引擎 Python** (§3.5) — ✅ approved (避免双引擎 parity)
4. **`PRINT_WEIGHING_SLIP` (称重单 ⭐) 含 in 6** (§3.1) — ✅ approved (F006 食品刚需)

**Follow-up (Steve 2026-05-16)**: §3.7 新加跨服务集成模式. Python 通过 smartbi_user pool 读 Cretas DB form_templates 表 (跟 SmartBI 跨服务模式一致, 参 memory `reference_smartbi_rls_via_auth_middleware_guc.md`). Endpoint 命名 `preview-template`. PR body 必须写清楚 Java/Python 责任切分 + 跟 C-PRT-1 (#659) 共存关系.

**Day 1 deliverable**: 本 doc + worktree branch ready.
**Day 2 start**: 7 元素 + Palette + PropertyPanel + EntityFieldTree + FormCanvas (frontend).
