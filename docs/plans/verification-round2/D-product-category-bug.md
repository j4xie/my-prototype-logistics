# P0-2 产品大类隔离 bug — 深度核对

**核对时间**: 2026-04-07
**关联 commit**: 4c03b9d4 (未修复)

---

## 1. 客户原话 + 复现步骤

来源: `temp/meeting-transcribe/transcript.txt` 行 403-410, 418-436, 547-551

### 关键原话 (1500s 附近, 客户演示)
> [1500.5s] "这边的话我看你是搬到我之前那个截图"
> [1503.2s] "但是你这边好像没有做做拆分"
> [1505.5s] "**就是成品原料 包辅材调油品 他好像就是通子的（通着的）**"
> [1510.0s] "**就是算我选择是原料 但我的成品里面还是能看见的**"

### 后续语境 (1531s)
> [1531.5s] "现在产品里面是吧"
> [1535.3s] "对现在产品产品编号 ok 没问题"
> [1538.6s] "然后产品名称 **产品大类**"
> [1540.4s] "对这产品大类就刚刚说的"

### 设计期望 (1565s)
> [1565.4s] "你看选选那个产品大类的时候 如果是成品的话 这个下面其实不需要展示的 选择原辅料的话再展示吧"
> （即下方 BOM/原料明细字段需要根据大类动态显隐）

### 复现步骤 (推断)
1. 进入 `web-admin > 系统管理 > 产品管理` (`/system/products`)
2. 顶部点击 Tab "原料"，新增一条记录 productCategory=RAW_MATERIAL
3. 切换到 Tab "成品" — **bug**: 刚才创建的"原料"记录依然出现在"成品"列表里
4. 客户期望: 4 个 Tab (成品/原料/包材调油品/客户物料) 数据完全隔离

---

## 2. 当前代码状态

### 后端 — `ProductType` 实体
**文件**: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/ProductType.java`

存在 **两个** 大类字段 (历史遗留):
- `category` (line 53-54, `category VARCHAR(50)`) — 旧字段，自由字符串
- `productCategory` (line 161-162, `product_category VARCHAR(50)`) — 新字段，约定值: `FINISHED_PRODUCT / RAW_MATERIAL / PACKAGING / SEASONING / CUSTOMER_MATERIAL`

枚举: 没有 Java enum，全部用 String。

### 后端 — Repository
**文件**: `repository/ProductTypeRepository.java:45`
```java
List<ProductType> findByFactoryIdAndCategory(String factoryId, String category);
```
注意: 这个方法查的是旧 `category` 字段，**没有** `findByFactoryIdAndProductCategory`。

### 后端 — Service 层 (核心 bug)
**文件**: `service/impl/ProductTypeServiceImpl.java:218-240`

```java
public PageResponse<ProductTypeDTO> getProductTypes(String factoryId, PageRequest pageRequest) {
    Page<ProductType> page = productTypeRepository.findByFactoryId(factoryId, pageable);
    // ❌ 完全忽略 productCategory 过滤参数
}
```

Controller 应该也没有透传 productCategory 参数到 Service (Service 签名根本没接收)。

### 前端 — `web-admin/src/views/system/products/index.vue`
- line 532-540: 4 个 Tab 切换 `activeTab` (`PRODUCT_CATEGORIES`)
- line 196-208: `loadData()` 调用 `GET /${factoryId}/product-types?productCategory=${activeTab}`
- line 582-585: 列表显示 `row.productCategory || row.category` (兼容两个字段)

**前端是对的，按 activeTab 把 productCategory 当 query 参数发了，是后端忽略了它。**

---

## 3. 真正的 bug 在哪里

**后端 Service 完全不消费前端传的 `productCategory` 过滤参数。**

定位:
1. `ProductTypeController.getProductTypes()` 的方法签名缺少 `@RequestParam(required=false) String productCategory`
2. `ProductTypeServiceImpl.getProductTypes(String factoryId, PageRequest pageRequest)` 重载缺少 productCategory 参数
3. `ProductTypeRepository` 缺少 `findByFactoryIdAndProductCategory(...)` 和 `findByFactoryIdAndProductCategoryAndKeyword(...)` 方法

附加问题:
- 历史遗留两个字段 (`category` / `productCategory`)，老数据可能写到 `category`，新数据写到 `productCategory`，列表显示时用 `||` 兜底，但**过滤时只能选一个字段查**，需要决定主字段。
- `getProductCategories()` 第 287 行返回的是旧 `category` 字段的 distinct，也不一致。

---

## 4. 修复方案 (设计)

### Step 1: 统一字段 (主字段 = `productCategory`)
- 写一个 SQL migration: `UPDATE product_types SET product_category = category WHERE product_category IS NULL AND category IS NOT NULL;`
- 把客户已有的中文字符串 ("成品"/"原料"/"包材"/"调油品") 映射到约定枚举值:
  - "成品" → `FINISHED_PRODUCT`
  - "原料" / "原材料" → `RAW_MATERIAL`
  - "包材" → `PACKAGING`
  - "调油品" / "辅料" → `SEASONING`
  - "客户物料" → `CUSTOMER_MATERIAL`
- 老 `category` 字段保留只读但不再写入 (后续 Phase 3 删除)。

### Step 2: 后端加 productCategory 过滤
- `ProductTypeRepository` 加方法:
  ```java
  Page<ProductType> findByFactoryIdAndProductCategory(String factoryId, String productCategory, Pageable pageable);
  // + 带 keyword 模糊搜索的版本，建议直接用 Specification 或 @Query
  ```
- `ProductTypeService.getProductTypes()` 签名加 `String productCategory` 参数，分支:
  - productCategory 为空 → 旧逻辑 `findByFactoryId`
  - 非空 → 新方法
- `ProductTypeController` `@RequestParam(required=false) String productCategory` 透传

### Step 3: 创建/更新时强制写入 productCategory
- DTO/Entity 转换确保 `productCategory` 必填 (前端已经默认 `formData.productCategory = activeTab.value`)
- 后端 `@NotBlank` 校验 `productCategory`

### Step 4 (可选, 客户也提到): 表单按大类动态显隐字段
- 选 "成品" → 隐藏 BOM/原料明细 sub-form
- 选 "原料/辅料" → 显示 BOM 明细 sub-form
- 这块属于 Sprint 2 的 customSchemaOverrides 机制，已有半成品基础，但当前 `index.vue` 没用上。本轮只修过滤 bug，动态字段单独立项。

### 是否需要 enum?
**建议加** 一个 `ProductCategoryEnum` (Java enum)，避免拼写漂移。但为了向后兼容，DB 列继续用 VARCHAR + 应用层校验。

---

## 5. 评分: 2/10 (修复成熟度)

理由:
- 实体字段已经埋好 (`product_category` 列存在) → +2
- 前端 Tab 已经传参 → +0 (本就该传)
- 后端 Service/Repository **完全没接** → 致命
- 历史脏数据 (老 `category` 字段) 没清理 → 数据迁移风险
- 没有 enum，没有 unit test，没有数据校验

距离"客户演示能用"差: Service 改造 + Repository 新方法 + 数据迁移脚本 + E2E 验证。

---

## 6. 工时估算

| 任务 | 工时 |
|------|------|
| Repository 加 `findByFactoryIdAndProductCategory` + keyword 组合查询 | 0.5h |
| Service `getProductTypes` 签名改造 + 分支逻辑 | 0.5h |
| Controller `@RequestParam` 透传 | 0.2h |
| 数据迁移 SQL (老 `category` → `productCategory` 中→英映射) | 1h |
| 创建/更新时校验 `@NotBlank` + DTO | 0.3h |
| `getProductCategories()` 改用 productCategory 字段 | 0.2h |
| ProductCategoryEnum (可选) | 0.3h |
| 单元测试 + E2E (4 Tab 隔离验证) | 1.5h |
| 部署 + 客户环境验证 | 0.5h |
| **合计** | **~5h (0.6 人日)** |

如果客户老数据混乱需要人工核对映射: 再加 2-4h。

**总计: 5-9 工时, 1-1.5 人日**
