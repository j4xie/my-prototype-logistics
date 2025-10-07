# 供应商和客户分离实施方案

**创建时间**: 2025-10-06
**优先级**: 🔴 高优先级
**状态**: 📋 待实施

---

## 🎯 核心问题

### 当前问题
```
Merchant表混用:
├─ MaterialBatch.merchantId → 实际是供应商（上游）
└─ ProductionPlan.merchantId → 实际是客户（下游）

导致:
❌ 数据属性混淆
❌ 管理界面混在一起
❌ 数据分析困难
❌ 业务逻辑不清晰
```

### 解决方案
```
分离为两个独立表:
├─ Supplier表 - 供应商（提供原材料）
└─ Customer表 - 客户（购买成品）

优势:
✅ 数据结构清晰
✅ 业务逻辑明确
✅ 管理界面分离
✅ 数据分析准确
```

---

## 📊 数据库设计

### Supplier表 - 供应商
```prisma
model Supplier {
  id              String   @id @default(uuid())
  factoryId       String   @map("factory_id")
  name            String   // 供应商名称
  code            String   // 供应商代码: SUP001
  contactPerson   String?  @map("contact_person")
  contactPhone    String?  @map("contact_phone")
  address         String?  @db.Text

  // 供应商特有字段
  supplierType    String?  @map("supplier_type")    // 批发商/养殖场/码头/进口商
  creditRating    String?  @map("credit_rating")    // A/B/C
  paymentTerms    String?  @map("payment_terms")    // 现金/月结/季结
  deliveryDays    Int?     @map("delivery_days")    // 平均交货天数
  minOrderAmount  Decimal? @map("min_order_amount") @db.Decimal(10, 2)

  // 质量评估
  qualityRating   Decimal? @map("quality_rating") @db.Decimal(3, 2)  // 1.00-5.00
  onTimeRate      Decimal? @map("on_time_rate") @db.Decimal(5, 2)    // 0-100%
  defectRate      Decimal? @map("defect_rate") @db.Decimal(5, 2)     // 0-100%

  // 统计数据
  totalPurchases  Int      @default(0) @map("total_purchases")       // 总采购次数
  totalAmount     Decimal? @map("total_amount") @db.Decimal(12, 2)   // 总采购金额

  isActive        Boolean  @default(true) @map("is_active")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  createdBy       Int?     @map("created_by")

  factory         Factory         @relation(fields: [factoryId], references: [id], onDelete: Cascade)
  creator         User?           @relation("SupplierCreator", fields: [createdBy], references: [id])
  materialBatches MaterialBatch[] // 供应的原材料批次

  @@unique([factoryId, code])
  @@index([factoryId, isActive])
  @@index([supplierType])
  @@index([creditRating])
  @@map("suppliers")
}
```

### Customer表 - 客户
```prisma
model Customer {
  id              String   @id @default(uuid())
  factoryId       String   @map("factory_id")
  name            String   // 客户名称
  code            String   // 客户代码: CUS001
  contactPerson   String?  @map("contact_person")
  contactPhone    String?  @map("contact_phone")
  address         String?  @db.Text

  // 客户特有字段
  customerType    String?  @map("customer_type")      // 超市/餐厅/批发商/电商/出口
  creditLevel     String?  @map("credit_level")       // A/B/C
  paymentMethod   String?  @map("payment_method")     // 预付/货到付款/月结
  deliveryAddress String?  @map("delivery_address") @db.Text
  taxNumber       String?  @map("tax_number")         // 税号

  // 业务统计
  totalOrders     Int      @default(0) @map("total_orders")        // 总订单数
  totalAmount     Decimal? @map("total_amount") @db.Decimal(12, 2) // 总交易额
  averageOrder    Decimal? @map("average_order") @db.Decimal(10, 2) // 平均订单金额

  isActive        Boolean  @default(true) @map("is_active")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  createdBy       Int?     @map("created_by")

  factory         Factory          @relation(fields: [factoryId], references: [id], onDelete: Cascade)
  creator         User?            @relation("CustomerCreator", fields: [createdBy], references: [id])
  productionPlans ProductionPlan[] // 生产计划
  shipmentRecords ShipmentRecord[] // 出货记录

  @@unique([factoryId, code])
  @@index([factoryId, isActive])
  @@index([customerType])
  @@index([creditLevel])
  @@map("customers")
}
```

### MaterialBatch表更新
```prisma
model MaterialBatch {
  // ... 保持原有字段

  // 修改: merchantId → supplierId
  supplierId  String @map("supplier_id")

  // 修改: merchant → supplier
  supplier    Supplier @relation(fields: [supplierId], references: [id])

  @@index([supplierId])
}
```

### ProductionPlan表更新
```prisma
model ProductionPlan {
  // ... 保持原有字段

  // 修改: merchantId → customerId
  customerId  String @map("customer_id")

  // 修改: merchant → customer
  customer    Customer @relation(fields: [customerId], references: [id])

  @@index([customerId])
}
```

---

## 🔧 前端组件

### SupplierSelector组件
```typescript
快捷添加表单:
┌──────────────────────────┐
│ 添加新供应商             │
├──────────────────────────┤
│ 名称: [___]              │
│ 代码: [SUP003]           │
│ 联系人: [___]            │
│ 电话: [___]              │
│                          │
│ 供应商类型               │
│ [批发商][养殖场][码头]  │
│ [进口商][其他]           │
│                          │
│ 信用评级                 │
│ [A级][B级][C级]         │
│                          │
│ [保存]                    │
└──────────────────────────┘
```

### CustomerSelector组件
```typescript
快捷添加表单:
┌──────────────────────────┐
│ 添加新客户               │
├──────────────────────────┤
│ 名称: [___]              │
│ 代码: [CUS003]           │
│ 联系人: [___]            │
│ 电话: [___]              │
│                          │
│ 客户类型                 │
│ [超市][餐厅][批发商]    │
│ [电商][出口][其他]      │
│                          │
│ 付款方式                 │
│ [预付][货到付款][月结]  │
│                          │
│ 配送地址: [___]          │
│ 税号: [___]              │
│                          │
│ [保存]                    │
└──────────────────────────┘
```

---

## 📱 界面更新

### CreateBatchScreen (原材料入库)
```
修改前:
供应商 ▼  ← MerchantSelector

修改后:
供应商 ▼  ← SupplierSelector ⭐
```

### ProductionPlanManagementScreen (生产计划)
```
修改前:
目标商家 ▼  ← MerchantSelector

修改后:
目标客户 ▼  ← CustomerSelector ⭐
```

---

## 🗂️ 管理界面

### 供应商管理页面 (新增)
```
供应商管理
┌─────────────────────────────┐
│ [+ 添加供应商]              │
├─────────────────────────────┤
│ 📦 海鲜批发市场 (SUP001)    │
│ 陈老板 138****0001          │
│ 批发商 • 信用A级            │
│ 质量评分: 4.8 准时率: 95%   │
│ 采购10次 总额¥50000         │
│ [查看] [编辑]               │
├─────────────────────────────┤
│ 📦 大润发超市 (SUP002)      │
│ ...                         │
└─────────────────────────────┘
```

### 客户管理页面 (新增)
```
客户管理
┌─────────────────────────────┐
│ [+ 添加客户]                │
├─────────────────────────────┤
│ 🏪 王老板超市 (CUS001)      │
│ 王经理 139****0001          │
│ 超市 • 信用A级 • 月结       │
│ 订单20次 总额¥100000        │
│ 平均利润率: 15%             │
│ [查看] [编辑]               │
├─────────────────────────────┤
│ 🏪 海鲜餐厅 (CUS002)        │
│ ...                         │
└─────────────────────────────┘
```

---

## 📋 实施步骤检查清单

### 数据库 (4项)
- [ ] 创建Supplier表
- [ ] 创建Customer表
- [ ] 更新MaterialBatch关联
- [ ] 更新ProductionPlan关联
- [ ] 数据迁移（Merchant → Supplier/Customer）

### 后端API (6项)
- [ ] SupplierController
- [ ] CustomerController
- [ ] 更新MaterialBatchController
- [ ] 更新ProductionPlanController
- [ ] Supplier路由配置
- [ ] Customer路由配置

### 前端组件 (4项)
- [ ] SupplierSelector组件
- [ ] CustomerSelector组件
- [ ] Supplier API Client
- [ ] Customer API Client

### 界面更新 (4项)
- [ ] CreateBatchScreen使用SupplierSelector
- [ ] ProductionPlanManagementScreen使用CustomerSelector
- [ ] SupplierManagementScreen (管理界面)
- [ ] CustomerManagementScreen (管理界面)

**总计**: 18项任务

---

## 🎯 预期效果

### 业务流程清晰
```
采购流程 (上游):
  供应商陈老板 → 提供鲈鱼 → 入库批次A

生产流程:
  批次A → 加工 → 鲈鱼片

销售流程 (下游):
  客户王老板 → 订购鲈鱼片 → 生产计划#001
```

### 数据追溯完整
```
产品质量问题:
  产品: 鲈鱼片
  ↓ 追溯客户
  客户: 王老板超市 (CUS001)
  ↓ 追溯批次
  批次: MAT-20251001-001
  ↓ 追溯供应商
  供应商: 海鲜批发市场 (SUP001)

完整的上下游追溯链条！
```

---

**下一步**: 开始实施数据库设计和迁移
**预计完成**: 本方案需要4天完成
