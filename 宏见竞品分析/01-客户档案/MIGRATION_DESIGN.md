# Cretas 产品导入助手设计 (Onboarding Wizard)

**目标**: 让新客户 (六扇门 / QHJ / 同类) 在 **30 分钟内** 把现有钉钉 + WPS Excel 数据导入 Cretas, 顺便培训关键概念.

**核心要求**: 客户第一天从 Excel 上传到看到 AIChat 主动推荐, 全程 **≤ 1 小时不需要培训师**.

**版本**: v1.0 (2026-05-14)
**作者**: Onboarding 体验设计师
**素材**: `01-客户档案/六扇门第一/二/三/四次.md` + `研发样品至财务回款全流程文档.md` + `能力拆分表.md` + 现有 Cretas Entity

---

## §0 设计原则 (Why)

### 0.1 客户痛点 (来自 4 次会议)

| 客户原话 | 引发设计 |
|---|---|
| "用过金蝶 ERP 3-4 次, 没一个用起来" (六扇门第二次) | 不能搞传统 ERP 那种"字段超严谨, 录入超繁琐" |
| "做仓管的他年纪都比较大, 文化素质很低, 你不能太伪赖他们" (六扇门第三次) | 老员工友好, 极简 UI (2-3 字段, 大按钮) |
| "钉钉 + WPS Excel + 线下数据, 数据孤岛" (六扇门第二次) | Excel 是客户母语, 不要让他重学 |
| "每天要为 100 盒产品维护 30-40 种辅料, 浪费大量时间" (六扇门第二次) | BOM 一次配好, 后续自动算用量 |
| "希望钉钉端跟系统打通" (六扇门第二次) | 不强迫客户立刻换工具, 钉钉数据可以一键带过来 |

### 0.2 三条铁律

1. **Excel 是客户母语** — 客户已经在 WPS 里管理客户/供应商/产品, 我们的模板必须**长得像他们的表**, 不要逼他们重新整理
2. **30 分钟 < 半天培训** — Wizard 自上而下, 每步只问一个问题, 不让客户迷路
3. **导入完立刻看到价值** — 上传完成后, AIChat 必须在 30 秒内推送"今天有 3 个客户下了订单, 您的库存够吗?"这类 Insight, **让客户立刻感觉"系统活了"**

---

## §1 总体流程 (Wizard 7 步骤)

### 1.1 Wizard 入口

新客户开通账号后, 首次登录自动弹出 **"欢迎来到 Cretas"** Wizard, 跳过按钮藏在右下角 (避免误关).

```
┌─────────────────────────────────────────────────────────────┐
│  欢迎来到 Cretas 食品溯源系统                          [跳过] │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│        ▢ ▢ ▢ ▢ ▢ ▢ ▢                                       │
│        1  2  3  4  5  6  7                                  │
│                                                             │
│   第 1 步: 欢迎 + 下载模板 (1 分钟)                          │
│   ...                                                       │
└─────────────────────────────────────────────────────────────┘
```

进度条 7 个圆点, 完成的填实色, 当前的加边框.

### 1.2 Step 1: 欢迎 + 30 秒视频 + 下载模板 (1 分钟)

```
┌─────────────────────────────────────────────────────────────┐
│  欢迎您, 张总!                                              │
│                                                             │
│  ┌─────────────────────────┐                                │
│  │                         │  您将通过 4 个 Excel 表格       │
│  │   [▶ 30 秒视频]         │  把现有数据导入到 Cretas:       │
│  │                         │                                │
│  │   "为什么要导入数据?"   │  ① 客户档案                    │
│  └─────────────────────────┘  ② 供应商档案                  │
│                              ③ 产品档案                     │
│  共 4 步, 约 5 分钟        ④ 原料/BOM 档案                  │
│                                                             │
│  [↓ 下载全部 4 个模板 (一键打包)]                            │
│                                                             │
│  [我已有 WPS 表格, 跳过下载]    [开始第一步 →]              │
└─────────────────────────────────────────────────────────────┘
```

**视频脚本** (30 秒):
> "您好张总, 欢迎使用 Cretas. 我们知道您现在用 WPS Excel 管理客户、供应商、产品和原料配方. 接下来 5 分钟, 我们会把这 4 个表格直接复制到 Cretas. 您不需要重学任何东西, 只需要把您手上现有的表格按我们的模板格式整理一下, 上传即可. 您原来录的数据, 系统会自动建立联系, 比如哪个客户买哪个产品, 哪个产品用哪些原料. 来, 我们开始吧."

**关键设计**:
- 一键下载所有 4 个模板 (zip 打包, 文件名 `Cretas导入模板_六扇门_F006.zip`)
- 模板内**预填客户工厂 ID** (避免客户搞错)
- 提供 "我已有 WPS 表格" 入口, 跳到 Step 2 直接上传

### 1.3 Step 2-5: 上传 4 个 Excel (每个 1-2 分钟)

每个 Step 流程**完全一致**, 降低学习成本:

```
┌─────────────────────────────────────────────────────────────┐
│  第 2 步: 上传客户档案                            ▢▣▢▢▢▢▢   │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                                                         ││
│  │           [选择文件] customers.xlsx                     ││
│  │                                                         ││
│  │           或拖拽文件到这里                              ││
│  │                                                         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ✅ 预览前 5 行                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 客户名 | 联系人 | 电话       | 类型  | 业务员       ││
│  │ 山姆   | 张总   | 13800...   | 商超  | 李四        ││
│  │ 盒马   | 王经理 | 13900...   | 商超  | 李四        ││
│  │ ...                                                     ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  📊 校验报告                                                │
│  ✅ 5 行数据全部合法                                         │
│  ⚠️  第 3 行: 电话格式不对 (应该是 11 位数字)                 │
│  ❌ 第 7 行: 客户名为空                                      │
│                                                             │
│  [← 返回]  [修正错误后重新上传]  [继续 - 跳过 7 行错误 →]    │
└─────────────────────────────────────────────────────────────┘
```

**关键设计**:
- **三档处理**: 全部合法 → 直接绿色"继续"; 部分错误 → 黄色"修正后重新上传 / 跳过错误继续"; 全部错误 → 红色"必须修正"
- **错误信息说人话**: 不说 "Validation failed: NotBlank", 说 "第 7 行: 客户名为空"
- **跳过错误**: 允许客户把有问题的行**先跳过**, 后续在系统里手动补
- **实时预览**: 上传后 < 2 秒显示前 5 行, 让客户**立刻知道格式对不对**

### 1.4 Step 6: 总览 + 确认导入 (1 分钟)

```
┌─────────────────────────────────────────────────────────────┐
│  第 6 步: 确认导入                            ▢▢▢▢▢▣▢      │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  您即将导入以下数据:                                          │
│                                                             │
│   📋 客户            45 条 (✓ 全部合法)                      │
│   🏭 供应商          23 条 (⚠ 跳过 2 条错误)                  │
│   📦 产品            128 条 (✓ 全部合法)                     │
│   🧾 BOM (原料-产品) 387 条 (✓ 全部合法)                     │
│                                                             │
│  📌 系统将自动建立关联:                                       │
│   • 128 个产品 ↔ 45 个客户 (基于"主要客户"字段)              │
│   • 387 条 BOM 记录 ↔ 128 个产品 (基于"产品编码")            │
│   • 387 条 BOM 记录 ↔ 56 种原料 (基于"原料编码")             │
│                                                             │
│  [← 返回上一步]                  [一键确认导入 ✓]            │
│                                                             │
│  ⚠️ 此操作不可撤销. 如需删除请联系客服.                       │
└─────────────────────────────────────────────────────────────┘
```

**关键设计**:
- **关联预告**: 在确认前**告诉客户"系统会自动帮您建立关联"**, 客户原来在 Excel 里维护这些关系很辛苦, 现在自动做了, 这是核心价值点
- **不可撤销警告**: 但不至于吓人, 留客服兜底
- **进度反馈**: 确认后显示进度条 "正在导入 387 条 BOM..." (后端事务 < 30 秒完成)

### 1.5 Step 7: 完成 + 引导 (1 分钟)

```
┌─────────────────────────────────────────────────────────────┐
│  🎉 恭喜! 您的数据已成功导入                                │
│                                                             │
│  导入摘要:                                                  │
│   • 45 个客户                                                │
│   • 23 个供应商                                              │
│   • 128 个产品                                               │
│   • 387 条 BOM 配方                                          │
│                                                             │
│  🤖 系统刚刚发现了一些值得您关注的事情:                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 💡 您的"卤猪蹄 200g"产品 BOM 里, 主料"猪蹄"目前没有库存  ││
│  │    建议: 立即下采购单                  [查看详情 →]      ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 💡 "山姆"是您 3 个产品的主要客户, 已自动建立优先关系     ││
│  │                                       [查看客户档案 →]    ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 💡 30 分钟培训视频已为您准备好, 7 章节随时可看           ││
│  │                                       [观看视频 →]        ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  [进入首页]              [立即跟 AIChat 对话 💬]            │
└─────────────────────────────────────────────────────────────┘
```

**关键设计 — 这是 30 分钟内"系统活了"的关键时刻**:
- 弹出 **3 张 AIInsight Card** (基于刚导入的数据自动生成)
- 第一张: **真实的业务建议** (基于 BOM + 库存对比), 让客户感受到"系统已经在帮我"
- 第二张: **关系发现** (基于产品-客户关联), 让客户感受到"系统懂我的业务"
- 第三张: **温和地推** 培训视频, 不强制

---

## §2 4 个 Excel 模板详细设计

### 2.1 模板 1: 客户档案 (`customers.xlsx`)

**Sheet 名**: `客户档案` (单 sheet)
**首行**: 字段说明 (灰色背景, 不参与导入)
**第 2 行**: 表头
**第 3 行起**: 数据

| 列号 | 表头 | 类型 | 必填 | 校验规则 | 映射到 Entity 字段 | 示例 |
|---|---|---|---|---|---|---|
| A | **客户名** | 文本 | ✅ | 非空, 长度 ≤ 100 | `Customer.name` | 山姆会员店 |
| B | **客户编码** | 文本 | ⚠️ 选填 | 字母数字, 工厂内唯一; 留空系统自动生成 | `Customer.code` / `customerCode` | C-SAM-001 |
| C | **联系人** | 文本 | ⚠️ | 长度 ≤ 50 | `Customer.contactName` / `contactPerson` | 张总 |
| D | **电话** | 文本 | ⚠️ | 11 位数字; 支持带"-"分隔 | `Customer.contactPhone` / `phone` | 13800138000 |
| E | **邮箱** | 文本 | ⚠️ 选填 | 含 @ | `Customer.email` | zhangzong@sams.cn |
| F | **地址** | 文本 | ⚠️ | 长度 ≤ 200 | `Customer.shippingAddress` | 上海市浦东新区... |
| G | **类型** | 单选 | ⚠️ | 必须是: 商超 / B端 / C端 / 餐饮 / 经销商 / 其他 | `Customer.type` / `businessType` | 商超 |
| H | **行业** | 文本 | ⚠️ 选填 | 长度 ≤ 100 | `Customer.industry` | 零售连锁 |
| I | **账期** | 文本 | ⚠️ 选填 | 自由文本 (月结30/月结60/现结) | `Customer.paymentTerms` | 月结30 |
| J | **业务员** | 文本 | ⚠️ 选填 | 长度 ≤ 50; 如果填了, 系统会查 User 表, 没找到则保留为备注 | `Customer.notes` (附加) | 李四 |
| K | **评级** | 数字 | ⚠️ 选填 | 1-5 整数 | `Customer.rating` | 5 |
| L | **备注** | 文本 | ⚠️ 选填 | 长度 ≤ 500 | `Customer.notes` | VIP, 月销售 30 万 |

**示例数据行**:
```
山姆会员店 | C-SAM-001 | 张总   | 13800138000 | zhangzong@sams.cn | 上海市浦东 | 商超 | 零售 | 月结30 | 李四 | 5 | VIP
盒马鲜生   | C-HMA-001 | 王经理 | 13900139000 |                   | 上海市闵行 | 商超 |     | 月结60 | 李四 | 4 |
```

**校验失败错误提示** (示例):
- 第 3 行: "客户名" 为空, 请填写客户名称
- 第 5 行: "电话" 格式不对, 应为 11 位数字 (您填的是: 138001380)
- 第 7 行: "类型" 必须是 [商超/B端/C端/餐饮/经销商/其他] 之一 (您填的是: 大型超市)
- 第 9 行: "客户编码" C-SAM-001 与第 3 行重复

---

### 2.2 模板 2: 供应商档案 (`suppliers.xlsx`)

**Sheet 名**: `供应商档案`

| 列号 | 表头 | 类型 | 必填 | 校验规则 | 映射到 Entity | 示例 |
|---|---|---|---|---|---|---|
| A | **供应商名** | 文本 | ✅ | 非空 | `Supplier.name` | 海洋食品有限公司 |
| B | **供应商编码** | 文本 | ⚠️ | 字母数字, 工厂内唯一; 留空自动生成 | `Supplier.code` / `supplierCode` | S-HY-001 |
| C | **联系人** | 文本 | ⚠️ | | `Supplier.contactName` / `contactPerson` | 李厂长 |
| D | **电话** | 文本 | ⚠️ | 11 位数字 | `Supplier.contactPhone` / `phone` | 13700137000 |
| E | **地址** | 文本 | ⚠️ | | `Supplier.address` | 山东省青岛市 |
| F | **主要原料** | 文本 | ⚠️ 选填 | 多个原料用顿号分隔 (如: 带鱼、黄花鱼、基围虾) | `Supplier.suppliedMaterials` | 牛肉、猪蹄 |
| G | **评级** | 数字 | ⚠️ 选填 | 1-5 | `Supplier.rating` | 4 |
| H | **账期** | 文本 | ⚠️ 选填 | 自由文本 | `Supplier.paymentTerms` | 月结45 |
| I | **交货周期(天)** | 数字 | ⚠️ 选填 | 整数 | `Supplier.deliveryDays` | 3 |
| J | **质检证书** | 文本 | ⚠️ 选填 | 多个用顿号分隔 | `Supplier.qualityCertificates` | HACCP、ISO22000 |
| K | **备注** | 文本 | ⚠️ 选填 | | `Supplier.notes` | 长期合作, 质量稳定 |

**示例**:
```
海洋食品有限公司 | S-HY-001 | 李厂长 | 13700137000 | 青岛 | 带鱼、黄花鱼 | 5 | 月结30 | 3 | HACCP | 长期合作
顺通肉业        | S-ST-002 | 王经理 | 13600136000 | 河南 | 牛肉、猪蹄   | 4 | 月结45 | 5 |       |
```

---

### 2.3 模板 3: 产品档案 (`products.xlsx`)

**Sheet 名**: `产品档案`

| 列号 | 表头 | 类型 | 必填 | 校验规则 | 映射到 Entity | 示例 |
|---|---|---|---|---|---|---|
| A | **产品编码** | 文本 | ✅ | 非空, 工厂内唯一, 字母数字 | `ProductType.code` | P-ZT-200 |
| B | **产品名称** | 文本 | ✅ | 非空 | `ProductType.name` | 卤猪蹄 |
| C | **规格** | 文本 | ⚠️ | 如 "200g*42盒/箱" 或 "抄码品" | `ProductType.specification` / `packageSpec` | 200g*42盒/箱 |
| D | **单位** | 文本 | ✅ | 如 kg / g / 盒 / 箱 / 份 | `ProductType.unit` | 盒 |
| E | **类别** | 文本 | ⚠️ | 自由文本, 系统按此分组 | `ProductType.category` / `productCategory` | 卤制品 |
| F | **品牌** | 文本 | ⚠️ 选填 | | `ProductType.brand` | 六扇门 |
| G | **温区** | 单选 | ⚠️ 选填 | 常温 / 冷藏 / 冷冻 | `ProductType.temperatureZone` | 冷冻 |
| H | **保质期(天)** | 数字 | ⚠️ 选填 | 整数 | `ProductType.shelfLifeDays` | 90 |
| I | **箱规系数** | 数字 | ⚠️ 选填 | 如 "10kg/箱"填 10; **"抄码品"留空** | `ProductType.boxConversionCoefficient` | 8.4 |
| J | **售价** | 数字 | ⚠️ 选填 | 含税单价, 保留 2 位小数 | `ProductType.taxIncludedUnitPrice` / `unitPrice` | 23.50 |
| K | **起订量** | 数字 | ⚠️ 选填 | | `ProductType.minimumOrderQuantity` | 50 |
| L | **库存预警** | 数字 | ⚠️ 选填 | 低于此值告警 | `ProductType.inventoryWarningThreshold` | 100 |
| M | **主要客户** | 文本 | ⚠️ 选填 | 客户名 (从客户档案中匹配); 多个用顿号分隔 | `ProductType.relatedCustomer` / `customerId` (匹配后填入) | 山姆会员店 |
| N | **结算方式** | 文本 | ⚠️ 选填 | 月结/现结/预付 | `ProductType.settlementMethod` | 月结30 |
| O | **备注** | 文本 | ⚠️ 选填 | | `ProductType.notes` | 客户独家定制 |

**示例**:
```
P-ZT-200 | 卤猪蹄    | 200g*42盒/箱 | 盒 | 卤制品 | 六扇门 | 冷冻 | 90 | 8.4 | 23.50 | 50 | 100 | 山姆会员店 | 月结30 | 主打产品
P-NR-500 | 五香牛肉  | 500g*20盒/箱 | 盒 | 卤制品 | 六扇门 | 冷冻 | 60 |     | 38.00 |    | 80  | 盒马鲜生   |       |
P-CH-CM  | 嚼皮五花  | 抄码品       | kg | 半成品 | 六扇门 | 冷冻 | 30 |     |       |    |     | 盒马鲜生   |       | 抄码品, 每箱重量不一
```

**特别提示**:
- "抄码品"识别: 规格字段精确匹配 `=== '抄码'` 或包含 "抄码品", 系统采购单不显示箱数 (per `reference_abaca_term.md`)
- 主要客户匹配: 上传时**先要求 Step 2 客户档案已上传**, 否则提示 "主要客户'山姆会员店'在客户档案中找不到, 是否跳过此关联?"

---

### 2.4 模板 4: 原料/BOM 档案 (`materials_bom.xlsx`)

**Sheet 名**: `原料BOM` (单 sheet, 多行平铺)

这是**最关键的表**, 决定了 BOM 自动算成本 + 库存预警的能力. 客户用 Excel 时通常做成"一行一个原料-产品-工序"的扁平结构.

| 列号 | 表头 | 类型 | 必填 | 校验规则 | 映射到 Entity | 示例 |
|---|---|---|---|---|---|---|
| A | **产品编码** | 文本 | ✅ | 必须在 `products.xlsx` 中存在 | `BomItem.productTypeId` (匹配后填入) | P-ZT-200 |
| B | **产品名称** | 文本 | ⚠️ 选填 | 不强制对应, 用于人工核对 | `BomItem.productName` (冗余) | 卤猪蹄 |
| C | **工序** | 单选 | ✅ | 按预设清单: **拆包 / 分割 / 卤制 / 抛骨 / 分切 / 装盒 / 装筐 / 前处理 / 加工 / 其他** (per 第四次会议) | `ProductWorkProcess.processName` 或独立字段 | 卤制 |
| D | **原料编码** | 文本 | ✅ | 工厂内唯一; 不存在则**自动创建原料类型** | `RawMaterialType.code` → `BomItem.materialTypeId` | M-ZT-RAW |
| E | **原料名称** | 文本 | ✅ | | `RawMaterialType.name` / `BomItem.materialName` | 猪蹄(生) |
| F | **原料类别** | 单选 | ⚠️ 选填 | 原料 / 辅料 / 包材 (per BomItem.materialCategory) | `BomItem.materialCategory` (RAW/AUXILIARY/PACKAGING) | 原料 |
| G | **用量(成品含量)** | 数字 | ✅ | > 0, 保留 4 位小数; 每单位**成品**所需**原料** | `BomItem.standardQuantity` | 250 |
| H | **用量单位** | 文本 | ✅ | 必须跟原料的"采购单位"一致, 系统自动校验 | `BomItem.unit` | g |
| I | **出成率(%)** | 数字 | ⚠️ 选填 | 0-100, 默认 100; 客户原话: "200克我的出成率是58%" | `BomItem.yieldRate` | 58 |
| J | **采购单位** | 文本 | ⚠️ 选填 | 如 kg, 跟"用量单位"可能不同 (会自动 g↔kg 1:1000 换算, per D3) | `RawMaterialType.unit` | kg |
| K | **参考单价** | 数字 | ⚠️ 选填 | 不含税, 保留 4 位小数 | `BomItem.unitPrice` | 32.50 |
| L | **税率(%)** | 数字 | ⚠️ 选填 | 默认 0 | `BomItem.taxRate` | 13 |
| M | **储存方式** | 单选 | ⚠️ 选填 | 鲜品(fresh) / 冷冻(frozen) / 干货(dry) | `RawMaterialType.storageType` | 冷冻 |
| N | **保质期(天)** | 数字 | ⚠️ 选填 | | `RawMaterialType.shelfLifeDays` | 365 |
| O | **主要供应商** | 文本 | ⚠️ 选填 | 供应商名 (从 `suppliers.xlsx` 匹配, 不在则提示) | (建立 `Supplier.suppliedMaterials` 关联) | 顺通肉业 |
| P | **备注** | 文本 | ⚠️ 选填 | | `BomItem.remark` | 主料 |

**示例 (一个产品多原料多工序)**:
```
P-ZT-200 | 卤猪蹄 | 拆包 | M-ZT-RAW  | 猪蹄(生)     | 原料 | 250   | g  | 58 | kg | 32.50 | 13 | 冷冻 | 365 | 顺通肉业 | 主料
P-ZT-200 | 卤猪蹄 | 卤制 | M-JY      | 酱油         | 辅料 | 5     | g  |    | L  | 8.50  | 13 | 常温 |     | 海天     | 调味
P-ZT-200 | 卤猪蹄 | 卤制 | M-XL      | 香料包       | 辅料 | 2     | g  |    | g  | 120.0 | 13 | 干货 |     | 五星调料 |
P-ZT-200 | 卤猪蹄 | 装盒 | M-PKG-BOX | PE真空袋     | 包材 | 1     | 个 |    | 个 | 0.35  | 13 |      |     | 印记包装 | 200g 规格
P-ZT-200 | 卤猪蹄 | 装筐 | M-PKG-CR  | 周转筐       | 包材 | 0.024 | 个 |    | 个 | 12.00 |    |      |     | 周转箱厂 | 42盒/筐
P-NR-500 | 五香牛肉 | 拆包 | M-NR-RAW | 牛腩(冻)    | 原料 | 600   | g  | 75 | kg | 58.00 | 13 | 冷冻 | 540 | 美牛公司 |
```

**校验规则 (按顺序检查)**:
1. **产品编码必须在产品档案中** — "第 X 行: 产品编码 P-XX 在 products.xlsx 中不存在"
2. **同一产品+原料+工序组合不能重复** — "第 5 行与第 3 行 BOM 项重复: 同产品+同原料+同工序"
3. **用量必须 > 0** — "第 7 行: 用量为 0 或负数, 必须 > 0"
4. **出成率范围 0-100** — "第 9 行: 出成率 120 超出 0-100 范围"
5. **原料类别枚举** — "第 11 行: 原料类别'添加剂'不在 [原料/辅料/包材] 中"
6. **工序枚举** — "第 13 行: 工序'切丝'不在预设清单中, 系统会自动创建工序 (用户确认后)"
7. **单位一致性** — "第 15 行: 用量单位 g, 但原料 M-ZT 的采购单位是 kg. 系统将自动 1:1000 换算" (info-level, 不阻塞)

**自动衍生**:
- **原料类型自动创建**: 如果 `M-ZT-RAW` 在系统中不存在, 自动创建 `RawMaterialType` 记录 (用 D-N 列字段)
- **供应商-原料关联**: 如果 O 列填了供应商名, 自动 append 到该供应商的 `suppliedMaterials`
- **产品工序自动创建**: 如果产品没有 ProductWorkProcess 记录, 按 BOM 中的工序顺序创建

---

## §3 后端导入逻辑 (Spring Boot)

### 3.1 API 设计

继承现有 `CustomerController.importCustomersFromExcel` 模式 (line 419-460, `controller/CustomerController.java`).

**新增 4 个 Controller endpoints + 1 个 Wizard 编排 endpoint**:

```java
// 单表导入 (4 个, 复用现有 pattern)
POST /api/mobile/{factoryId}/onboarding/import/customers
POST /api/mobile/{factoryId}/onboarding/import/suppliers
POST /api/mobile/{factoryId}/onboarding/import/products
POST /api/mobile/{factoryId}/onboarding/import/bom

// 模板下载 (一键打包 zip)
GET  /api/mobile/{factoryId}/onboarding/templates/all.zip

// Wizard 编排 (统一接收 4 个 multipart file, 事务级回滚)
POST /api/mobile/{factoryId}/onboarding/wizard/import-all
  Body: multipart/form-data {
    customers: File,
    suppliers: File,
    products: File,
    bom: File,
    skipErrors: boolean (default false)
  }
  Returns: ImportSummary {
    customers: ImportResult<CustomerDTO>,
    suppliers: ImportResult<SupplierDTO>,
    products: ImportResult<ProductDTO>,
    bom: ImportResult<BomItemDTO>,
    relationships: {
      productCustomerLinks: 128,
      bomProductLinks: 387,
      bomMaterialLinks: 56,
      supplierMaterialLinks: 23
    },
    totalDurationMs: 4523
  }

// 校验预览 (Step 2-5 中 "预览 + 校验报告" 用)
POST /api/mobile/{factoryId}/onboarding/validate/{type}
  Path: {type} ∈ [customers, suppliers, products, bom]
  Body: multipart with single file
  Returns: ValidationReport {
    preview: List<RowDTO>,    // 前 5 行
    totalRows: 200,
    validRows: 195,
    errors: List<RowError>,   // 每行错误 (行号 + 字段 + 原因)
    warnings: List<RowWarning>
  }
```

### 3.2 OnboardingWizardService 主流程

```java
@Service
@Slf4j
public class OnboardingWizardServiceImpl implements OnboardingWizardService {

    @Autowired private CustomerService customerService;
    @Autowired private SupplierService supplierService;
    @Autowired private ProductTypeService productTypeService;
    @Autowired private BomService bomService;
    @Autowired private RawMaterialTypeService materialTypeService;
    @Autowired private AIInsightService aiInsightService;  // Step 7 推送 Insight

    /**
     * Wizard 一键导入 — 4 个 Excel 同时处理, 严格事务.
     *
     * 设计要点 (per CLAUDE.md):
     * - "禁止降级处理" — 失败必须明确返回错误, 不返假数据
     * - 单事务 — 任一表全部失败则整体回滚
     * - 部分失败 (skipErrors=true) — 跳过错误行, 不阻塞整体
     * - 关联建立顺序: customers → suppliers → materials → products → bom
     *   (避免外键引用未存在的 entity)
     */
    @Transactional(rollbackFor = Exception.class)
    public ImportSummary importAll(
            String factoryId,
            MultipartFile customers,
            MultipartFile suppliers,
            MultipartFile products,
            MultipartFile bom,
            boolean skipErrors) throws Exception {

        long t0 = System.currentTimeMillis();
        ImportSummary summary = new ImportSummary();

        // 1. 客户 (无依赖)
        ImportResult<CustomerDTO> cr = customerService.importFromExcel(
            factoryId, customers.getInputStream(), skipErrors);
        if (!skipErrors && !cr.getIsFullSuccess()) {
            throw new BusinessException(400, "客户导入有错误, 请修正后重试");
        }
        summary.setCustomers(cr);

        // 2. 供应商 (无依赖)
        ImportResult<SupplierDTO> sr = supplierService.importFromExcel(
            factoryId, suppliers.getInputStream(), skipErrors);
        if (!skipErrors && !sr.getIsFullSuccess()) {
            throw new BusinessException(400, "供应商导入有错误");
        }
        summary.setSuppliers(sr);

        // 3. 解析 BOM Excel 提取原料 (BOM 隐含创建原料)
        BomParseResult bomParsed = bomService.parseExcel(bom.getInputStream());
        // 3a. 自动创建原料类型
        Set<MaterialDTO> autoCreatedMaterials =
            materialTypeService.bulkCreateOrUpdate(factoryId, bomParsed.getMaterials());

        // 4. 产品 (依赖客户 — 主要客户字段)
        ImportResult<ProductDTO> pr = productTypeService.importFromExcel(
            factoryId, products.getInputStream(), cr.getSuccessData(), skipErrors);
        if (!skipErrors && !pr.getIsFullSuccess()) {
            throw new BusinessException(400, "产品导入有错误");
        }
        summary.setProducts(pr);

        // 5. BOM (依赖产品 + 原料)
        ImportResult<BomItemDTO> br = bomService.bulkImport(
            factoryId, bomParsed.getBomItems(), pr.getSuccessData(),
            autoCreatedMaterials, skipErrors);
        summary.setBom(br);

        // 6. 关联统计
        summary.setRelationships(buildRelationshipStats(cr, sr, pr, br));

        // 7. 触发 AIInsight 推送 (异步, 不阻塞)
        aiInsightService.triggerInsightsAfterOnboarding(factoryId);

        summary.setTotalDurationMs(System.currentTimeMillis() - t0);
        return summary;
    }
}
```

### 3.3 单表导入 Service (示例: CustomerService.importFromExcel)

```java
@Service
public class CustomerServiceImpl {

    public ImportResult<CustomerDTO> importFromExcel(
            String factoryId, InputStream excelStream, boolean skipErrors) {

        ImportResult<CustomerDTO> result = ImportResult.create(0);

        try (Workbook workbook = WorkbookFactory.create(excelStream)) {
            Sheet sheet = workbook.getSheetAt(0);
            // 跳过第 1 行 (字段说明) 和第 2 行 (表头)
            int totalRows = sheet.getLastRowNum() - 1;
            result.setTotalCount(totalRows);

            Set<String> seenCodes = new HashSet<>();

            for (int i = 2; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null || isEmptyRow(row)) continue;

                try {
                    CreateCustomerRequest req = parseRow(row, factoryId);

                    // 校验
                    validateCustomer(req, seenCodes, i + 1);

                    // 创建
                    Customer customer = customerService.create(req);
                    seenCodes.add(req.getCode());
                    result.addSuccess(toDTO(customer));

                } catch (ValidationException ve) {
                    result.addFailure(i + 1, ve.getMessage(), rowToJson(row));
                    if (!skipErrors) break;  // strict 模式: 第一个错就停
                } catch (Exception e) {
                    result.addFailure(i + 1, "未知错误: " + e.getMessage(), rowToJson(row));
                    if (!skipErrors) break;
                }
            }
        }
        return result;
    }

    private void validateCustomer(CreateCustomerRequest req, Set<String> seenCodes, int rowNum) {
        if (StringUtils.isBlank(req.getName())) {
            throw new ValidationException("\"客户名\" 为空, 请填写客户名称");
        }
        if (StringUtils.isNotBlank(req.getPhone()) && !req.getPhone().matches("^1[3-9]\\d{9}$")) {
            throw new ValidationException("\"电话\" 格式不对, 应为 11 位数字 (您填的是: " + req.getPhone() + ")");
        }
        if (req.getCode() != null && seenCodes.contains(req.getCode())) {
            throw new ValidationException("客户编码 " + req.getCode() + " 在此文件内重复");
        }
        if (req.getCode() != null && customerRepository.existsByFactoryIdAndCode(req.getFactoryId(), req.getCode())) {
            throw new ValidationException("客户编码 " + req.getCode() + " 在系统中已存在");
        }
        // ... 其他校验
    }
}
```

### 3.4 事务与 Rollback 策略

| 场景 | 策略 |
|---|---|
| `skipErrors=false` 严格模式 | 任一行失败 → 整个事务回滚 (所有 4 表都不导入) |
| `skipErrors=true` 宽松模式 | 跳过错误行, 成功的导入. 但**单表内部**仍是事务, 失败的行不污染成功的行 |
| BOM 引用不存在的产品 (即使产品在同次 wizard 中导入) | 因为先导入产品后导入 BOM, 此时产品已 commit, BOM 查询能找到. 用 `@Transactional(propagation = REQUIRES_NEW)` 分隔 4 个子事务 |
| 重复运行 (客户重复上传) | `INSERT ... ON CONFLICT DO NOTHING` (PostgreSQL) 跳过已存在的 code; 或返回明确错误 "已导入过, 请使用客户管理页面手动编辑" |

### 3.5 性能要求

| 数据量 | 期望耗时 |
|---|---|
| 100 客户 + 50 供应商 + 200 产品 + 500 BOM (~六扇门规模) | < 10 秒 |
| 1000 客户 + 500 供应商 + 2000 产品 + 5000 BOM (大客户) | < 60 秒 |
| 10000+ 行 | 异步处理 + WebSocket 进度推送 (Phase 2) |

**优化技巧**:
- POI Streaming API (SXSSF) 读取大 Excel
- 批量插入: `repository.saveAll()` + `entityManager.flush()` 每 100 行
- 校验前批量预查 (一次性 `SELECT code FROM customers WHERE factory_id = ? AND code IN (?)`)

---

## §4 培训视频脚本 (7 章节, 共 ~25 分钟)

**核心原则**:
- 用客户语言 ("销售单"、"采购单"), 不用技术术语 ("Entity"、"DTO")
- 每章节 < 5 分钟, 留意力窗口
- 演示 > 讲解, 每章节都有屏幕录制
- 七章可独立观看, 不强迫线性

### 4.1 章 1 (3 min): Cretas 与传统 ERP 的差异

**画面**: 左侧金蝶/用友传统 ERP 操作界面 (录入采购单要点 8 次), 右侧 Cretas AIChat 一句话搞定

**台词**:
> "您好张总. 我知道您之前试过 3-4 套 ERP, 都没用起来. 这是为什么呢?
>
> 传统 ERP 要求您每个字段都填得**特别规范**: 产品编码必须输对, 客户必须先建档, 单位必须选下拉, 一不小心错一个字, 整条数据就报错.
>
> Cretas 不是这样. 我们引入了 AI 中台 (画面: AIChat 对话框), 您说: 「今天山姆下单 800 箱牛肉, 3 天交货」, 系统自动:
> - 在客户档案里找到"山姆会员店"
> - 在产品里找到"五香牛肉"
> - 计算 800 箱 = 多少公斤 = 多少成本
> - 生成销售订单, 推到生产排程
>
> 您只说了一句话, 系统帮您做了 8 步.
>
> 但底层呢, 我们的数据库还是标准的, 财务能算账, 仓库能盘库. 这就是 AI 中台的意思 — **AI 在上面帮您, 严谨的 ERP 在底下支撑**. 这是我们花了 3 年时间打磨的核心.
>
> 接下来 6 个章节, 我会演示一些具体场景, 您选您感兴趣的看."

### 4.2 章 2 (5 min): AIChat 一句话操作演示

**画面**: 屏幕录制, 从空白界面开始, 完整演示一个销售订单全流程

**台词**:
> "我打开 AIChat. (输入: 「山姆今天下了卤猪蹄 200 盒, 月底前要到货」)
>
> 看, 系统识别出:
> - 客户: 山姆会员店 ✓
> - 产品: 卤猪蹄 (P-ZT-200) ✓
> - 数量: 200 盒 ✓
> - 期望交货日期: 2026-05-31 ✓
> - 单价: 23.50 元/盒 (从产品档案带出来)
> - 总金额: 4700 元
>
> 它问我: 「确认创建这个销售订单吗?」 我点确认.
>
> 系统接下来自动做了:
> 1. 创建销售订单 SO-2026-001
> 2. 触发 BOM 核算 — 200 盒卤猪蹄需要 50kg 猪蹄, 1kg 酱油, 0.4kg 香料 (BOM 自动展开)
> 3. 检查库存 — 哎, 猪蹄当前库存只有 30kg, 缺 20kg
> 4. 弹出建议: 「建议立即向顺通肉业采购 25kg 猪蹄, 3 天可到, 来得及」
>
> 我点 "采纳建议", 系统自动生成采购订单 PO-2026-005, 推送给采购员审批.
>
> 整个过程 30 秒, 比传统 ERP 录入快 10 倍. 而且数据是**严谨的, 可追溯的, 财务能审计的**.
>
> 您不需要记住任何快捷键, 不需要找哪个按钮, 直接说就行."

### 4.3 章 3 (5 min): 食品溯源 — 给商超审计直接出数据

**画面**: 山姆/盒马审计员场景, 扫码看完整溯源链

**台词**:
> "盒马、山姆这些商超, 每 3 个月会来一次审计. 他们最关心的是:
> - 这箱卤猪蹄的原料从哪里来?
> - 哪家供应商? 哪个批次?
> - 生产过程有没有冷链断链?
> - 质检报告在哪?
>
> 传统做法: 仓库翻一上午台账, 找出 5 张纸, 还可能找不全.
>
> Cretas 做法: 我打开产品溯源页面 (画面演示), 输入这箱产品的批次号 B-2026-0501-A, 一秒钟出来:
>
> 📍 原料来源:
>    - 猪蹄: 顺通肉业 (批次 M-ST-0428), 4 月 28 日入库, 检验合格
>    - 酱油: 海天 (批次 M-HT-0420), 质检证书 #HT-2026-04-20
>
> 📍 生产过程:
>    - 拆包: 5 月 1 日 8:00, 操作员张三, 拆包 80kg
>    - 卤制: 5 月 1 日 10:30, 卤制 4 小时, 温度 95°C (设备记录)
>    - 装盒: 5 月 1 日 16:00, 装盒 280 盒, 质检合格率 99.6%
>
> 📍 冷链监控:
>    - 全程冷链 -18°C, 没有断链 (IoT 设备记录每分钟温度)
>
> 📍 出货:
>    - 5 月 2 日 09:00 发至山姆上海仓
>
> 审计员看完, 说"OK", 走人. 30 秒搞定.
>
> 这不是给您看的, 是给**您的客户**看的. 山姆审计通过, 您的订单稳了."

### 4.4 章 4 (3 min): 仓管员扫码入库 (老员工友好)

**画面**: 手机扫码界面, 大按钮, 大字体

**台词**:
> "您之前提到, 您的仓管师傅年纪大了, 文化程度低, 系统要简单. 我们做了一个**极简版仓管 App**.
>
> 仓管师傅一打开 App, 看到的就是这个界面 (画面: 一个大按钮 "📱 扫码入库").
>
> 他点这个按钮, 拿手机扫送货单上的二维码 (这个二维码是您采购员之前发给供应商的, 供应商打印出来给送货员).
>
> 扫完, 屏幕上就显示这次到货的明细: "猪蹄, 100kg, 顺通肉业, 您下了 100kg, 实际到 X kg".
>
> 仓管师傅只需要填**两个字段**:
> - 实际收了多少 (默认带 100, 他改成实际数字)
> - 生产日期 (从送货单上读, 他输入或用日历选)
>
> 然后**拍一张照** (送货单签字版的照片, 留底), 点 "✓ 确认".
>
> 完了. 整个过程 30 秒, 不需要打字, 不需要选下拉, 不需要记编码.
>
> 价格? 他不需要看, 也不应该看 — 仓管员的权限不包括价格. 这是系统给您把关.
>
> 而且支持超收 (比如下了 100kg, 来了 110kg, 系统允许超收 30% 内自动收, 超过就警告). 您之前提到的: 「不能太为难他们」, 我们做到了."

### 4.5 章 5 (3 min): 摄像头辅助 — 异物识别 (PoC 标注)

**画面**: 流水线视频, 摄像头标红一块异物

**台词**:
> "您之前问过, 流水线上的金属探测器, 能不能再加一个**摄像头识别异物**.
>
> 我们做了一个**试点功能 (30 天试用)**. 在金属探测器旁边装一个摄像头, AI 实时分析画面.
>
> 看这个视频 (画面: 卤猪蹄经过, 一块小塑料片混在里面). AI 自动标红, 报警: 「检测到疑似异物, 位置 X, 建议人工复核」.
>
> 这个功能的特点:
> - **自学习** — 您们前 30 天的"误报"和"漏报", 我们都会标注, AI 会越来越准
> - **不替代金探** — 金探查金属, 摄像头查所有可见异物 (塑料、纸屑、毛发)
> - **可关闭** — 觉得没用随时关
>
> 30 天试用免费. 之后看效果再决定是否继续. 这是 PoC, 我们也想看实际数据."

### 4.6 章 6 (3 min): 数据查询 — SmartBI 一句话

**画面**: SmartBI 对话框, 输入问题, 出图表

**台词**:
> "您之前提到, 您每个月要花一天时间, 从钉钉报销、WPS 表格里翻数据. 这事在 Cretas 里就一句话.
>
> 我打开 SmartBI (画面: 输入框), 问: 「本月山姆订单多少件, 跟上月对比」.
>
> 系统 3 秒钟出来:
> - 本月山姆订单: 12 个, 总额 32 万元
> - 上月: 9 个, 总额 25 万元
> - 同比: +33%, 同期金额 +28%
>
> 还自动生成柱状图 (画面: 两个月柱状图对比).
>
> 再问: 「为什么涨了?」, 系统分析:
> - 主要是「卤猪蹄」涨了 5 单 (新品上架)
> - 「五香牛肉」涨了 2 单
> - 客户回头率 100% (12 个订单都是回头客)
>
> 再问: 「按客户排, 谁买得最多」, 立即出表格.
>
> 您不需要学 Excel 公式, 不需要做透视表, 直接说就行."

### 4.7 章 7 (3 min): 异常推送 — 主动告诉你

**画面**: 钉钉消息 + Cretas 首页 AIInsight Card

**台词**:
> "前面 6 章您都要主动问. 这一章是系统**主动告诉您**.
>
> 系统每天会扫一遍数据, 发现 3 类问题, 给您推消息:
>
> 1. **库存预警** (画面: AIInsight Card): 「猪蹄当前库存 25kg, 低于安全线 50kg, 建议立即补货」 — 点击直接生成采购单
>
> 2. **价格异常** (画面: 三价对比): 「牛肉本周到货价 65 元/kg, 比往期均价 58 元高 12%. 您要不要复核一下?」 — 点击看历史价格曲线
>
> 3. **质检异常** (画面): 「今天质检发现 3 条不合格记录, 都是「卤猪蹄」批次 B-0512-A, 建议追溯」 — 点击直接打开追溯页面
>
> 这些消息会推到:
> - Cretas 首页 (画面: 卡片)
> - 您的钉钉 (画面: 钉钉群消息)
> - 您的手机 (画面: App 推送)
>
> 您不需要主动看, 重要的事系统会找您.
>
> 好, 7 章就讲完了. 我们今天上午导入了 4 张表, 您现在可以试一试: 直接对 AIChat 说一句话, 看系统能不能听懂. 有问题随时找我或 AI 客服. 祝您用得顺!"

---

## §5 客服与帮助

### 5.1 错误处理常见原因 + 解决方案

| 错误现象 | 常见原因 | 解决方案 (Wizard 内提示) |
|---|---|---|
| 客户名为空 | Excel 第 1 列漏填 | 提示具体行号; 提供"打开模板示例"链接 |
| 电话格式不对 | 11 位数字不对; 含特殊字符 | 实时显示正确格式: "138-1234-5678 或 13812345678 (均可)" |
| 客户编码重复 | 同文件内重复 / 系统中已存在 | 提示前者就用 row diff; 后者建议"是否要更新现有客户?" (V2 功能) |
| 产品编码在 BOM 里但不在产品档案 | BOM 文件先于产品文件做的 | 提示"请先上传产品档案, 或在产品档案中加入此编码" |
| 主要客户在客户档案找不到 | 拼写不一致 ("山姆" vs "山姆会员店") | 提供模糊匹配建议: "您填的'山姆', 系统找到了'山姆会员店', 是否匹配?" |
| 单位不一致 | BOM 用 g, 原料采购单位 kg | 自动 1:1000 换算 (per D3 决策), info 提示, 不阻塞 |
| 出成率超出范围 | 客户填了 120% | 强制 0-100, 提示"出成率不能超过 100%, 您填的是 120" |
| 抄码品规格 | 规格列填了"抄码"但箱规系数也填了 | 自动忽略箱规系数, 标记为抄码品, 提示"识别为抄码品, 箱数将按实际称重计算" |
| Excel 文件超过 10MB | 数据量太大 | 提示分批上传 + 异步处理选项 (Phase 2) |
| Excel 文件格式不对 (.xls) | 客户用了老版 Office | 提示"请用 .xlsx 格式 (WPS 默认是 .xlsx)" + 一键转换工具链接 |

### 5.2 中文/英文双语 (i18n)

- 模板内的字段说明: 中文为主 + 英文括注 (例如: "客户名 (Customer Name)")
- 错误信息: 跟随用户 UI 语言设置 (`Accept-Language` header)
- 视频脚本: 中文为主, 提供英文字幕版 (Phase 2)

### 5.3 客服按钮 (优先 AI 客服, 再人工)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   遇到问题? 我们这里有 3 种帮助方式:                          │
│                                                             │
│   1. 🤖 AI 客服 (24/7, 立即响应)         [立即对话]          │
│      → 处理 80% 常见问题 (格式错误/字段含义/校验失败)         │
│                                                             │
│   2. 📞 人工客服 (工作日 9:00-18:00)     [发起通话]          │
│      → AI 客服解决不了的, 自动转人工                          │
│                                                             │
│   3. 📧 邮件留言                          [写邮件]           │
│      → 非紧急问题, 24 小时内回复                              │
└─────────────────────────────────────────────────────────────┘
```

**AI 客服核心场景** (复用 Cretas AIChat 能力):
- "我的客户编码冲突了怎么办?" → 自动定位错误行 + 给方案
- "什么是抄码品?" → 调 `foodknowledge` Skill 给定义 + 示例
- "BOM 怎么填?" → 跳出动图教程 + 模板示例
- "导入慢怎么办?" → 检查文件大小 + 提供异步导入选项

---

## §6 双行业差异化 (餐饮 vs 食品厂)

基于 `能力拆分表.md` 67% 共享 / 19% 餐饮专属 / 9-18% 食品厂专属的事实, 模板**主体共享**, 增加可选 sheet 应对差异.

### 6.1 共享模板 (4 个核心 Excel 不变)

`customers.xlsx`, `suppliers.xlsx` 完全通用. `products.xlsx` 和 `materials_bom.xlsx` **基础字段通用**, 但提供行业附加字段.

### 6.2 食品厂专属字段 (在 `products.xlsx` 加列, 选填)

| 附加列 | 含义 | 映射 |
|---|---|---|
| **批号规则** | 如 "yyMMdd-HH-3位序号" (六扇门用) | 系统配置 ProductionBatch.batchNumberPattern |
| **失效期天数** | 默认从生产日 +N 天 | `ProductType.shelfLifeDays` (已在主模板) |
| **抄码品标志** | 是否抄码 (是/否) | 系统识别 `=== '抄码'` |
| **HACCP 等级** | A/B/C | (新增 ProductType.haccpLevel 字段) |
| **冷链要求** | -18°C 冷冻 / 0-4°C 冷藏 / 常温 | `ProductType.temperatureZone` (已在主模板) |
| **追溯码起始** | 如 "TR-2026-" 前缀 | (新增 ProductType.traceCodePrefix 字段) |

**对应 BOM 模板加列**:
| 附加列 | 含义 | 映射 |
|---|---|---|
| **HACCP CCP 点** | 此原料是否为关键控制点 | (新增 BomItem.isCcp 字段) |
| **抽检比例** | 0-100% | (新增 BomItem.qcSampleRate 字段) |

### 6.3 餐饮专属字段 (在 `products.xlsx` 加列, 选填)

| 附加列 | 含义 | 映射 |
|---|---|---|
| **菜品分类** | 凉菜/热菜/汤/主食/饮品/甜品 | `ProductType.category` (已在主模板) |
| **套餐?** | 是/否 | (新增 ProductType.isCombo 字段; 配合 SkuAssembleTool) |
| **桌位编号** | 适用桌位 (如包间/散桌/吧台) | (新增 StoreSeatConfig 关联) |
| **餐期** | 早餐/午餐/晚餐/下午茶/夜宵 | (新增 ProductType.mealPeriod 字段) |
| **辣度** | 不辣/微辣/中辣/重辣 | (新增 ProductType.spicyLevel 字段) |
| **预计出餐时间(分钟)** | | (新增 ProductType.cookTimeMinutes 字段) |

**额外 sheet**: `restaurant_table_layout.xlsx` (桌台布局, 餐饮 only):

| 列 | 含义 | 映射 |
|---|---|---|
| 桌台编号 | T01, T02, ... | `StoreSeatConfig.seatCode` |
| 区域 | 大厅/包间/吧台 | `StoreSeatConfig.zone` |
| 座位数 | 4-12 | `StoreSeatConfig.capacity` |
| 类型 | 圆桌/方桌/卡座 | `StoreSeatConfig.seatType` |

### 6.4 Wizard 选择路径

Step 0 (Wizard 启动前): 询问"您的行业是?"

```
┌─────────────────────────────────────────────────────────────┐
│  请选择您的主要业务类型:                                     │
│                                                             │
│   ○ 🏭 食品加工厂 (如肉制品/水产/烘焙/方便食品)              │
│       → 4 个标准模板 + 食品厂附加字段 (HACCP/抄码/追溯)      │
│                                                             │
│   ○ 🍽️ 餐饮 (如餐厅/中央厨房/连锁)                          │
│       → 4 个标准模板 + 餐饮附加字段 (桌台/套餐/餐期)         │
│                                                             │
│   ○ ⚙️ 综合 (兼有工厂和餐饮)                                 │
│       → 4 个标准模板, 附加字段全部可见                       │
└─────────────────────────────────────────────────────────────┘
```

后续 Wizard 步骤**不变**, 只是 Step 2-5 的模板和校验规则按行业切换.

### 6.5 后端处理

`OnboardingWizardService` 接收 `industryType` 参数:
- 食品厂: 跳过餐饮附加字段, 校验 HACCP/抄码/追溯字段
- 餐饮: 跳过工厂附加字段, 解析桌台 sheet, 校验菜品分类
- 综合: 全部解析

业务逻辑分发到现有 Tool/Skill (per `ai-intent-tool-skill-architecture.md`):
- 食品厂场景调用 `processing/`, `traceability` Skill 等专属 Tool
- 餐饮场景调用 `restaurant/`, `restaurant-operations` Skill 等专属 Tool
- 共享层 Tool (`crm/`, `material/`, `finance/`) 两行业都用

---

## §7 与 Sprint 1 的关系

### 7.1 战略定位 — ASAP 末交付 = "客户上手关键工具"

根据 `能力拆分表.md §7.1` Week 1 P0 清单, 当前优先级在:
- P0-1: 研发样品全流程
- P0-3: ProcessingBatch 17 Tool 深度测试
- P0-4: 溯源 UI 极简化
- P0-7: production-oee Skill
- P0-8: BOM 成本核算

**Onboarding Wizard 是这些功能的"入门票"** — 没有数据导入, 上述功能都是空架子.

### 7.2 实施时间线

| Phase | 任务 | 工时 | 交付物 |
|---|---|---|---|
| **Sprint 1 - Week 1** | 4 个 Excel 模板生成器 (POI) + 单表导入 endpoint (复用 CustomerController pattern) | 3 天 | 4 个 endpoint 可用, Postman 验证 |
| **Sprint 1 - Week 2** | Wizard 编排 endpoint + 关联建立逻辑 + AIInsight 触发 | 2 天 | E2E 跑通 ImportAll → AIChat 推送 |
| **Sprint 1 - Week 2** | 前端 Wizard 7 步 UI (Vue, 复用 web-admin 组件库) | 4 天 | 完整 Wizard 可用, 跳过培训师独立完成 |
| **Sprint 1 - Week 3** | 7 章节培训视频录制 (用真实数据演示) | 3 天 | 30 分钟视频, 章节独立可看 |
| **Sprint 1 - Week 3** | AI 客服训练 (Onboarding 场景的 80% Q&A) | 2 天 | AI 客服解决 80% 导入问题 |
| **Sprint 1 - Week 4** | 双行业差异化字段 + 客户验证 (六扇门真实数据跑通) | 3 天 | 六扇门可独立完成 onboarding |

**总计**: ~17 人天 (2-3 人并行 → 1-1.5 周交付)

### 7.3 验收标准

| 标准 | 验收方式 |
|---|---|
| 客户 30 分钟内完成数据导入 | 真实客户 (六扇门 张总) 计时测试 |
| 不需要培训师 | 客户独立完成, 仅看视频 + 用 AI 客服 |
| 导入完成后立即看到 AIInsight | Step 7 完成后 ≤ 30 秒, 推送 ≥ 3 张 Card |
| 错误信息易懂 | 客户能根据错误提示自己修正 (≥ 80% 错误自助解决) |
| 数据准确性 | 导入后, 抽样 50 行核对原 Excel, 0 错误 |
| BOM 自动算成本 | 导入后, AIChat 问"卤猪蹄成本多少", 1 秒内出答案 |

### 7.4 跟现有 PR 关联

| Onboarding 需求 | 现有 PR / 状态 |
|---|---|
| Excel 导入 POI 库使用 | 已有 (CustomerController.importCustomersFromExcel line 419) |
| `ImportResult<T>` DTO | 已有 (`dto/common/ImportResult.java`) |
| BOM 抄码品识别 | PR #173 P1-3 已 ship |
| 一二级单位 1:1000 换算 | PR #297 (D3) 已 ship |
| 关联自动建立 | 现有 Service 层支持, Wizard 编排即可 |
| AIInsight 推送 | `service/skill/impl/SkillRegistryImpl` 16 Skill 已注册 |
| PDF 模板下载 (Step 1) | 已有 (CustomerController.downloadCustomerTemplate line 392) |

**所有底层能力已就绪, Wizard 只是编排层**. 这是 ASAP 末交付的可行性保证.

### 7.5 风险与缓解

| 风险 | 缓解措施 |
|---|---|
| 客户的 Excel 字段命名跟我们模板不一致 | Wizard 提供"字段映射"步骤 (V2 功能); V1 强制使用我们的模板 |
| 客户数据量超出 10MB | 提示分批导入; Phase 2 提供异步导入 + WebSocket 进度 |
| 错误率过高导致客户放弃 | AI 客服兜底; 提供"导出已修正的 Excel"功能让客户在本地修 |
| 视频录制不够清晰 | 用真实六扇门数据录制, 客户认同感强; 关键步骤加字幕 |
| 培训师场景 (有些客户需要现场) | Wizard 不替代培训师, 而是降低培训门槛; 培训师场景仍可用作 follow-up |

---

## §8 一句话总结

> **Onboarding Wizard 是 Cretas 客户的"第一印象关键 30 分钟"**: 7 步骤完成数据导入 + 30 秒后看到 AIInsight Card (系统活了的瞬间) + 7 章节 25 分钟视频覆盖核心功能. 实现路径: 复用现有 `CustomerController.importCustomersFromExcel` pattern, 增加 Wizard 编排 + 4 个标准 Excel 模板 + 双行业差异化, 总计 17 人天可在 Sprint 1 末交付. 这不是新功能, 是把 Cretas 已有的 337 Tool / 16 Skill / 326 Entity 通过 Excel + 视频 + AIChat 三件套**翻译成客户母语**, 让 60 岁老员工能用, 30 分钟上手.

---

## 附录 A: 4 个 Excel 模板下载链接 (待生成)

- `customers.xlsx` — 客户档案模板
- `suppliers.xlsx` — 供应商档案模板
- `products.xlsx` — 产品档案模板 (含食品厂/餐饮可选附加列)
- `materials_bom.xlsx` — 原料 BOM 档案模板

打包: `Cretas导入模板_{factoryName}_{factoryId}.zip` (动态生成)

## 附录 B: Entity 映射对照表 (开发参考)

| 模板字段 | Java Entity | Repository | Service |
|---|---|---|---|
| 客户名 | `Customer.name` | `CustomerRepository` | `CustomerService` |
| 供应商名 | `Supplier.name` | `SupplierRepository` | `SupplierService` |
| 产品编码 | `ProductType.code` | `ProductTypeRepository` | `ProductTypeService` |
| 原料编码 | `RawMaterialType.code` | `RawMaterialTypeRepository` | `RawMaterialTypeService` |
| BOM 用量 | `BomItem.standardQuantity` | `BomItemRepository` | `BomService` |
| 出成率 | `BomItem.yieldRate` | 同上 | 同上 |
| 抄码品 | `ProductType.specification === '抄码'` (per `reference_abaca_term.md`) | 同上 | 同上 |
| 工序 | `ProductWorkProcess.processName` | `ProductWorkProcessRepository` | `ProductWorkProcessService` |

## 附录 C: 培训视频拍摄清单

- 拍摄设备: 1080p 屏幕录制 + 麦克风 (无背景噪声)
- 演示账号: F006 六扇门测试数据 (已脱敏)
- 视频时长: 每章 3-5 分钟, 共 ~25 分钟
- 字幕: 中文为主, 英文字幕版 Phase 2
- 分发: 1) Wizard Step 7 内嵌; 2) Cretas 帮助中心; 3) AI 客服触发推送
