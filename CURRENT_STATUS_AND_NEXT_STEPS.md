# 当前系统状态和下一步计划

## ✅ 当前已有功能清单

### 1. 数据库表（已完成）

#### 基础数据表 ✅
- **Factory** - 工厂信息
- **User** - 用户管理（8个角色）
- **Merchant** - 商家/供应商管理 ✅
  - 已有数据: 海鲜批发市场、大润发超市

#### 原材料相关 ✅
- **RawMaterialType** - 原材料类型
  - 已有数据: 鲈鱼、带鱼、黄花鱼、大虾、扇贝、黄鱼
- **MaterialBatch** - 原材料批次 ✅ 新增
  - 含供应商、单价、保质期、状态管理

#### 产品相关 ✅
- **ProductType** - 产品类型（SKU）⭐ 关键
  - 已有数据:
    - 鱼片 (代码: YP001) - 鱼肉制品
    - 鱼头 (代码: YT001) - 鱼肉制品
    - 鱼骨 (代码: YG001) - 鱼副产品
  - **code字段** = SKU编码
  - **name字段** = SKU名称

#### 转换率配置 ✅
- **MaterialProductConversion** - 原材料→产品转换率
  - 例如: 鲈鱼 → 鱼片 = 50%转换率

#### 生产管理 ✅
- **ProductionPlan** - 生产计划
  - 关联: 商家(客户)、产品类型(SKU)
- **ProductionPlanBatchUsage** - 批次使用记录 ✅ 新增
- **DailyProductionRecord** - 每日生产记录 ✅ 新增
- **MaterialConsumption** - 原材料消耗记录
- **ShipmentRecord** - 成品出货记录

---

## 🎯 SKU (产品类型) 理解确认

### SKU 概念
```
SKU = Stock Keeping Unit (库存量单位)
每个工厂根据自己的产品线定义SKU

例如: 白垩纪水产加工厂的SKU:

主产品类 (鱼肉制品):
├─ YP001 - 鱼片 (主要销售产品)
├─ YT001 - 鱼头 (副产品)
├─ YG001 - 鱼骨 (副产品)
├─ YJ001 - 鱼胶 (可能的副产品)
└─ YR001 - 鱼肉粒 (副产品)

细分SKU (根据规格):
├─ YP001-L - 大片鱼片 (200g+)
├─ YP001-M - 中片鱼片 (100-200g)
├─ YP001-S - 小片鱼片 (<100g)
└─ YP001-F - 冷冻鱼片包装

不同鱼种的SKU:
├─ YP-LY-001 - 鲈鱼片
├─ YP-DY-001 - 带鱼段
├─ YP-HHY-001 - 黄花鱼片
└─ ...
```

### ProductType 表设计确认

```prisma
model ProductType {
  id          String  // UUID
  factoryId   String  // 工厂ID
  name        String  // SKU名称: 鲈鱼片、带鱼段
  code        String  // SKU代码: YP-LY-001
  category    String  // 分类: 鱼肉制品、副产品
  description String  // 描述

  // 每个工厂可以自定义SKU
  @@unique([factoryId, code])  // 同工厂内SKU代码唯一
}
```

---

## 📋 完整业务流程（最终确认版）

### 流程图

```
第1步: 原材料入库 (管理员)
       ┌─────────────────────────┐
       │ 原材料类型: 鲈鱼        │ ← MaterialTypeSelector
       │ 供应商: 陈老板          │ ← MerchantSelector ⭐
       │ 数量: 1000kg            │
       │ 单价: ¥5/kg             │
       │ 保质期: 7天后           │
       │ [提交入库]               │
       └─────────────────────────┘
       ↓
       生成批次: MAT-20251001-001
       记录: 1000kg鲈鱼，供应商陈老板

第2步: 创建生产计划 (管理员)
       ┌─────────────────────────┐
       │ 商家(客户): 王老板      │ ← 客户选择器
       │ 产品类型(SKU): 鲈鱼片   │ ← ProductTypeSelector ⭐
       │ 代码: YP-LY-001         │   (选择出货产品SKU)
       │ 计划产量: 500kg         │
       │                         │
       │ 系统自动计算:           │
       │ 预估消耗: 1050kg鲈鱼    │
       │                         │
       │ 选择原材料批次:         │ ← MaterialBatchSelector ⭐
       │ • 批次A: 1000kg         │   (选择原材料批次)
       │   供应商: 陈老板        │
       │   单价: ¥5/kg           │
       │ [创建计划]               │
       └─────────────────────────┘
       ↓
       计划#2025051已创建
       产品SKU: YP-LY-001 (鲈鱼片)
       使用批次: MAT-20251001-001

第3步: 员工每日记录 (员工)
       每天记录生产的SKU数量
       例如: 今天生产了100kg鲈鱼片(YP-LY-001)

第4步: 库存盘点 (管理员)
       盘点原材料批次剩余

第5步: AI分析 (管理员)
       分析成本、效率、优化建议
```

---

## 🔍 关键概念确认

### 1. 原材料类型 vs 原材料批次

```
原材料类型 (RawMaterialType):
- 概念: 原材料的种类
- 例如: 鲈鱼、带鱼、大虾
- 用途: 分类管理
- 使用: MaterialTypeSelector

原材料批次 (MaterialBatch):
- 概念: 某次入库的具体批次
- 例如: MAT-20251001-001 (10月1日入库的1000kg鲈鱼)
- 包含: 供应商、单价、保质期
- 用途: 追溯、成本核算、先进先出
- 使用: MaterialBatchSelector
```

### 2. 产品类型(SKU) vs 商家(客户)

```
产品类型 (ProductType) = SKU:
- 概念: 工厂生产的出货产品
- 例如: 鲈鱼片 (YP-LY-001)
- code字段: 就是SKU编码
- 用途: 定义工厂能生产什么产品
- 使用: ProductTypeSelector

商家 (Merchant) - 有双重含义:
1. 作为供应商 (Supplier):
   - 原材料入库时: 记录从谁那里采购的
   - 例如: 陈老板供应鲈鱼

2. 作为客户 (Customer):
   - 生产计划时: 记录卖给谁
   - 例如: 王老板订购鲈鱼片
```

---

## 📊 当前已实现的功能

### 前端组件 ✅

#### 1. MaterialTypeSelector ✅ 完成
```typescript
位置: src/components/processing/MaterialTypeSelector.tsx
功能:
  ✅ 显示原材料类型列表
  ✅ 搜索功能
  ✅ 快捷添加新原材料类型
  ✅ 自动选中

使用场景:
  • 原材料入库时选择类型
  • 转换率配置时选择原材料

测试状态: ✅ 已测试通过
```

#### 2. MerchantSelector ✅ 完成
```typescript
位置: src/components/common/MerchantSelector.tsx
功能:
  ✅ 显示供应商/客户列表
  ✅ 搜索功能（名称、代码、联系人）
  ✅ 快捷添加新供应商
  ✅ 显示联系方式

使用场景:
  • 原材料入库时选择供应商
  • 生产计划时选择客户

测试状态: ✅ 组件已创建
```

#### 3. ProductTypeSelector ❓ 需要确认
```typescript
位置: 应该在某个地方存在
功能: 选择产品类型(SKU)
使用场景: 创建生产计划时选择出货产品

需要确认:
  - 是否已存在？
  - 是否支持快捷添加？
```

### 后端API ✅

#### 原材料类型API ✅
```javascript
✅ GET  /api/mobile/materials/types
✅ POST /api/mobile/materials/types
```

#### 商家/供应商API ✅
```javascript
✅ GET  /api/mobile/merchants
✅ POST /api/mobile/merchants
✅ GET  /api/mobile/merchants/:id
✅ PUT  /api/mobile/merchants/:id
✅ DELETE /api/mobile/merchants/:id
```

#### 产品类型(SKU)API ❓
```javascript
需要确认是否存在:
? GET  /api/mobile/product-types
? POST /api/mobile/product-types
```

#### 生产计划API ✅ 部分完成
```javascript
✅ GET  /api/mobile/production-plans
✅ GET  /api/mobile/production-plans/:id
✅ POST /api/mobile/production-plans
需要增强: 批次选择和自动计算逻辑
```

### 数据库 ✅

```
✅ 基础表都已存在
✅ MaterialBatch等新表已添加
✅ Prisma Client已生成
✅ 数据库迁移成功
```

---

## 🚧 待实现的核心功能

### 高优先级

#### 1. MaterialBatchSelector 组件 ⭐ 最核心
```
功能: 选择原材料批次（创建生产计划时用）
显示:
  - 批次列表（按入库日期排序）
  - 每个批次显示: 数量、单价、供应商⭐、保质期
  - 多选 + 输入使用数量
  - 自动汇总总量和总成本
  - 智能推荐（先进先出/成本最优）
```

#### 2. 批次管理后端API
```javascript
POST /api/mobile/material-batches           // 创建批次（入库）
GET  /api/mobile/material-batches           // 查询批次
GET  /api/mobile/material-batches/available // 查询可用批次（供选择器用）
POST /api/mobile/material-batches/reserve   // 预留批次
GET  /api/mobile/material-batches/recommendations // 智能推荐
```

#### 3. 生产计划自动计算
```javascript
POST /api/mobile/production-plans/estimate  // 预估原材料消耗
// 输入: productTypeId, plannedQuantity
// 查询: MaterialProductConversion转换率
// 计算: 预估消耗量
// 返回: 需要的原材料类型和数量
```

#### 4. ProductTypeSelector 确认/创建
```typescript
确认是否存在，如不存在则创建
功能: 选择产品类型(SKU) + 快捷添加
```

### 中优先级

#### 5. 每日生产记录界面
```typescript
位置: src/screens/processing/DailyProductionRecordScreen.tsx
功能:
  - 员工记录当日产量
  - 显示累计进度
  - 流程问题记录
```

#### 6. 原材料入库界面完善
```typescript
确保连接到正确的API:
  - 使用 MaterialTypeSelector
  - 使用 MerchantSelector ⭐
  - 调用批次创建API
```

---

## 🎯 SKU (产品类型) 详细说明

### SKU的作用

#### 1. 定义工厂的产品线
```
每个工厂根据业务定义SKU:

白垩纪水产加工厂的SKU体系:

一级分类: 鱼种
├─ 鲈鱼系列
│  ├─ YP-LY-001 - 鲈鱼片
│  ├─ YT-LY-001 - 鲈鱼头
│  └─ YG-LY-001 - 鲈鱼骨
│
├─ 带鱼系列
│  ├─ YD-DY-001 - 带鱼段
│  └─ YP-DY-001 - 带鱼片
│
└─ 黄花鱼系列
   ├─ YP-HHY-001 - 黄花鱼片
   └─ YT-HHY-001 - 黄花鱼头

二级分类: 规格
├─ YP-LY-001-L - 大片鲈鱼片 (200g+)
├─ YP-LY-001-M - 中片鲈鱼片 (100-200g)
└─ YP-LY-001-S - 小片鲈鱼片 (<100g)

三级分类: 包装
├─ YP-LY-001-F500 - 500g冷冻包装鲈鱼片
├─ YP-LY-001-F1000 - 1kg冷冻包装鲈鱼片
└─ YP-LY-001-FRESH - 鲜品散装鲈鱼片
```

#### 2. 生产计划中的SKU使用

```
创建生产计划界面:

┌──────────────────────────────┐
│ 新建生产计划          [关闭] │
├──────────────────────────────┤
│ 商家(客户) *                 │
│ 王老板 ✓                     │
│                              │
│ 产品类型(SKU) * ⭐           │
│ ┌──────────────────────────┐ │
│ │ 选择产品SKU ▼            │ │ ← ProductTypeSelector
│ └──────────────────────────┘ │
└──────────────────────────────┘

点击后弹出ProductTypeSelector:
┌──────────────────────────────┐
│ 选择产品类型          [取消] │
├──────────────────────────────┤
│ 🔍 搜索产品/SKU...           │
├──────────────────────────────┤
│ 🐟 鱼肉制品                  │
├──────────────────────────────┤
│ • 鲈鱼片 (YP-LY-001)      ✓  │ ← 选择
│ • 带鱼段 (YD-DY-001)         │
│ • 黄花鱼片 (YP-HHY-001)      │
│                              │
│ 🦴 副产品                    │
├──────────────────────────────┤
│ • 鱼头 (YT-001)              │
│ • 鱼骨 (YG-001)              │
│                              │
│ ↓ 滚动到底部 ↓              │
├──────────────────────────────┤
│ ➕ 找不到？点击添加新产品SKU │ ← 快捷添加
└──────────────────────────────┘

如果需要添加新SKU:
┌──────────────────────────────┐
│ 添加新产品SKU                │
├──────────────────────────────┤
│ SKU名称 *                    │
│ ┌──────────────────────────┐ │
│ │ 石斑鱼片                 │ │
│ └──────────────────────────┘ │
│                              │
│ SKU代码 *                    │
│ ┌──────────────────────────┐ │
│ │ YP-SBY-001               │ │
│ └──────────────────────────┘ │
│                              │
│ 分类                         │
│ [鱼肉制品] [副产品] [其他]  │
│                              │
│ [取消]  [保存]               │
└──────────────────────────────┘
```

#### 3. SKU与原材料的转换关系

```
配置转换率界面:

┌──────────────────────────────┐
│ 转换率配置                   │
├──────────────────────────────┤
│ 原材料类型 *                 │
│ 鲈鱼 ✓                       │ ← MaterialTypeSelector
│                              │
│ 产品SKU *                    │
│ 鲈鱼片 (YP-LY-001) ✓         │ ← ProductTypeSelector
│                              │
│ 转换率 (%) *                 │
│ 50                           │
│                              │
│ 损耗率 (%)                   │
│ 5                            │
│                              │
│ [保存配置]                    │
└──────────────────────────────┘

保存后:
✅ 配置已保存
✅ 创建计划时自动计算:
   - 需要500kg鲈鱼片(YP-LY-001)
   - 系统查询转换率: 50%
   - 自动计算: 需要1000kg鲈鱼原材料
   - 含损耗5%: 需要1050kg
```

---

## 📋 选择器组件总结

### 当前系统需要4个选择器

| 选择器 | 用途 | 选择对象 | 状态 |
|--------|------|----------|------|
| **MaterialTypeSelector** | 原材料入库 | 原材料类型(鲈鱼、带鱼) | ✅ 已完成 |
| **MerchantSelector** | 原材料入库 | 供应商(陈老板、王采购) | ✅ 已完成 |
| **ProductTypeSelector** | 生产计划 | 产品SKU(YP-LY-001鲈鱼片) | ❓ 需确认 |
| **MaterialBatchSelector** | 生产计划 | 原材料批次(MAT-xxx) | 🚧 待创建 |

### 使用流程图

```
原材料入库:
  MaterialTypeSelector → 选择"鲈鱼"
  MerchantSelector → 选择"陈老板" ⭐
  ↓
  生成批次 MAT-20251001-001

创建生产计划:
  MerchantSelector → 选择客户"王老板"
  ProductTypeSelector → 选择SKU"鲈鱼片(YP-LY-001)" ⭐
  系统计算 → 需要1050kg鲈鱼
  MaterialBatchSelector → 选择批次MAT-20251001-001 ⭐
  ↓
  创建计划 #2025051
```

---

## 🎯 需要你确认的问题

### 问题1: ProductTypeSelector是否已存在？
```
我需要检查:
  - src/components/**/*ProductTypeSelector*
  - src/components/**/*ProductSelector*
  - src/components/**/*SKUSelector*

如果不存在，需要创建（类似MaterialTypeSelector）
```

### 问题2: SKU快捷添加是否需要？
```
场景: 创建计划时发现需要新SKU"石斑鱼片"

是否需要快捷添加？
  ✅ 需要: 在ProductTypeSelector底部添加
  ❌ 不需要: SKU由管理员预先配置，不允许随意添加
```

### 问题3: 原材料入库界面现状
```
你说"原材料入库界面已经做好了"

需要确认:
  - 界面文件路径？
  - 是否已集成MaterialTypeSelector？
  - 是否已集成MerchantSelector？
  - 是否连接到后端API？
```

---

## 🚀 下一步行动计划

### 立即要做（按顺序）:

#### Step 1: 确认ProductTypeSelector
```bash
# 搜索是否存在
find frontend/CretasFoodTrace/src -name "*ProductType*" -o -name "*SKU*"

# 如果不存在，创建ProductTypeSelector组件
```

#### Step 2: 创建产品类型(SKU)后端API
```javascript
// backend/src/controllers/productTypeController.js
✅ 已存在: GET, POST, PUT, DELETE
需要确认: createProductType是否支持快捷创建
```

#### Step 3: 创建MaterialBatchSelector组件
```
最复杂的组件:
- 多选批次
- 输入数量
- 显示供应商
- 计算成本
- 智能推荐
```

#### Step 4: 实现批次管理后端API
```javascript
// backend/src/controllers/materialBatchController.js
- 创建批次(入库)
- 查询可用批次
- 预留/释放批次
- 智能推荐算法
```

#### Step 5: 生产计划界面集成
```
- 集成ProductTypeSelector
- 集成MaterialBatchSelector
- 自动计算预估消耗
- 显示批次成本
```

---

## 📊 进度总结

### 已完成 ✅
1. ✅ 数据库设计 (100%)
2. ✅ MaterialTypeSelector (100%)
3. ✅ MerchantSelector (100%)
4. ✅ 商家API (100%)
5. ✅ 原材料类型API (100%)

### 进行中 🚧
6. 🚧 ProductTypeSelector (需确认)
7. 🚧 产品类型API (需确认)

### 待开始 ⏳
8. ⏳ MaterialBatchSelector
9. ⏳ 批次管理API
10. ⏳ 生产计划集成
11. ⏳ 每日记录功能
12. ⏳ AI分析集成

**总体进度**: 约35%

---

## 🎬 能够演示的功能

### 现在就可以测试:

#### 1. 原材料类型管理 ✅
```bash
# 启动系统
cd backend && npm run dev
cd frontend/CretasFoodTrace && npx expo start

# 测试:
# 找到任何使用MaterialTypeSelector的页面
# 测试快捷添加功能
```

#### 2. 商家数据查询 ✅
```bash
# 访问Prisma Studio
http://localhost:5555

# 查看merchants表
# 看到: 海鲜批发市场、大润发超市
```

#### 3. 产品类型(SKU)数据 ✅
```bash
# Prisma Studio → product_types表
# 看到: 鱼片(YP001)、鱼头(YT001)、鱼骨(YG001)
```

---

## ❓ 需要你回答的问题

### 问题1: ProductTypeSelector
**存在吗？在哪里？是否需要快捷添加功能？**

### 问题2: 原材料入库界面
**文件路径？是否已经连接API？**

### 问题3: SKU编码规则
**是否需要遵循特定规则？**
- 例如: YP-LY-001 (类别-鱼种-序号)
- 还是自由编码？

### 问题4: 快捷添加SKU
**是否允许员工/操作员快捷添加新SKU？**
- 允许 → 类似MaterialTypeSelector
- 不允许 → 仅管理员预先配置

---

**回答这些问题后，我可以继续实现剩余的70%功能！**
