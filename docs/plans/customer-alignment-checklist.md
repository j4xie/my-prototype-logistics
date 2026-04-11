# 客户对齐会议议程 — 六扇门 V1.0 验收前

**日期**: 2026-04-11
**目标**: Apr 7-11 session 完成的 P0 19/19 + P1 9/9 演示 + 剩余不确定项对齐
**参会**: 张权 (客户运营) / 财务老师 / 运营同事 / 悟空 (PM) / Steven (技术)
**时长**: 约 60 min

---

## 📊 当前 V1.0 完成度 snapshot

| 范围 | 完成 | 证据 |
|---|---|---|
| **P0** (19/19) | ✅ 100% | 全部 code + unit + E2E |
| **P1** (9/9) | ✅ 100% backend ready | 7 full + 2 schema (P1-8/P1-9 service wire-up 下次) |
| **Audit** | ✅ 0 HIGH / 0 MEDIUM | 跨工厂隔离 + CI 门禁 |
| **E2E** | ✅ 6/6 PASS | Playwright real browser + backend |

---

## 🔴 必须对齐 (影响演示 / 验收)

### 1. 研发样品字段对照核对 [~10 min]

**问**: 请您打开一条**真实的研发样品追踪表**详情页, 我们现场对照系统字段一列列核对。

**为什么**: 我们按客户截图 14:09 (t014m09s_0047_s.jpg) 补齐了 ~30 字段:
- V20260407_03: sampleCode / customerName / salesperson / productLevel / storageMethod / customerExpectedPrice / productStatus / customerType / customerLatestRequirement / sampleVersion / sellingPoints / customerCode / customerLevel (共 13 字段 Round 2)
- V20260411_02 本次补: productQuotePrice / materialPrice / processingFee / mainMaterialInfo / mainMaterialYieldRate / mainMaterialImages (6 字段)

**风险**: 客户真实页面可能还有我们截图没看到的字段 (e.g. 物流信息 / 包装规格 / 保质期等), 演示时现场加补来不及。

**期望**: 客户反馈 "没有遗漏" / "还缺 XX/YY 字段" → 下次 session 补齐

---

### 2. v3 Q3 / Q4 书面确认 [~15 min]

#### Q3: V1.0 + V2.0 双阶段路线是否接受

v3 路线图:
- **V1.0** (本次交付): P0 19 项 + P1 9 项 + 硬编码 + 3 实体 schemaJson 试点, 8 周
- **V2.0** (未承诺时间): 画布编辑器 / FormTemplate 可视化 / 49 页 schemaJson 全迁移 / ToolRegistry per-factory 启用禁用 / multi-warehouse 库存 / RN 共享渲染等

**问**: 接受这个双阶段吗? 还是坚持 v2 "4 周全画布化" (已 audit 证伪, PageEditor 0 文件/Formily 0 依赖)?

#### Q4: 采购/人事/财务 P0→P2 降级书面确认

v3 §4.4 根据会议 5049-5054s 原话 "采购、人事、财务这一部分, 他不是特别紧急" 降级。

**问**: 确认这 3 个模块 V1.0 不在范围, 留 W7+ 或 V2.0? **书面签字** (避免演示后反悔)

---

### 3. P0-5 "双仓制" 真实期望 [~10 min]

**背景澄清**:
- ✅ **已做 (B1)**: 每个物料需求单 (FMR) 生成时, 自动创建 InternalTransfer **流水记账单** (备料调出 + 退料调入), 关联 transferId 提供完整追溯链
- ❌ **未做 (B2)**: MaterialBatch 按 warehouse 真实位置分区 — 发现系统从未有 warehouse 粒度库存, 做这个是 4-5 周架构重构 epic (见 `docs/plans/p0-5-b2-warehouse-dimension-adr.md`)

**问**: 您日常工作里真的需要系统告诉您 "这批带鱼现在物理上在物流仓还是鲜棉仓" 吗? 还是 "有物料需求单 + 有流水追溯" 就够?

**期望**:
- "流水够" → V1.0 ship as-is (B1 完整)
- "必须真实位置" → 启动 4-5 周 warehouse epic (独立立项)

**影响**:
- 选前者: V1.0 可立即验收
- 选后者: V1.0 推迟 4-5 周

---

### 4. P1-1 工人欠退扫码 V1.0 必要性 [~5 min]

**背景**: 客户原话 4720s "中间有员工走了, 扫一下这个员工相当于欠退". 本次已完成:
- ✅ **backend 完整**: EmployeeProcessSegment entity + service + controller + 5 Mockito tests (commit `d09b967b7`)
- ❌ **RN 扫码 UI**: QR scanner 或硬件扫码枪集成未做 (8-16h)

**问**: V1.0 演示必须有 UI 吗? 还是:
- A. 简化 "主管 Web 端手动 checkOut" (2-3h) → 演示可用
- B. 必须 RN 扫码 (8-16h) → W2+ 做
- C. V1.0 不做这个功能, 留 V2.0

---

## 🟡 建议对齐 (本 session 新 discovery)

### 5. 销售订单 3 状态 tag 枚举用词 [~5 min]

**背景**: commit `e0daca80d` 加 3 tag:
- **收款**: 待收款 / 部分收款 / 已收款
- **开票**: 待开票 / 部分开票 / 已开票
- **运输**: 待出厂 / 生产中 / 运输中 / 已发货

**问**:
- v1 §2.4.4 原文写"出铺中/生产中/已发货" 3 状态, 我加了"运输中"作为中间状态. OK 吗?
- "待收款" / "待出厂" 这些用词合您公司习惯吗? 或要换?
- 需要"已开票未收款"等**组合状态** tag 吗? 还是现在 3 个独立 tag 足够?

---

### 6. P1-6 销售订单 6 tab 命名 [~3 min]

本次 commit `528edb5e1`,tab 命名:
1. 全部订单 / 2. 未出库订单 / 3. 部分出库订单
4. 未收款订单 / 5. 部分收款订单 / 6. 已完成订单

**问**: 命名对吗? 是否还需要额外 tab (如 "已取消" / "草稿" / "待财务审核")?

---

### 7. /rd/converted 页面命名 [~2 min]

commit `fdf1d2377` 页面叫 "已转样品库" (展示 productStatus='已转报模' 的样品).

**问**: "已转样品库" 这个名字对吗? 还是 "转模产品" / "已转报模产品库" / "样品库" / 其他?

---

### 8. FactoryWarehouse 命名 [~2 min]

本次 seed 每个 factory 自动创建 2 个仓库:
- **物流仓** (code: WH-LOG, type: LOGISTICS)
- **鲜棉仓** (code: WH-WKS, type: WORKSHOP)

**问**: 这 2 个名字和 code 对吗? 您工厂实际叫什么?

---

## 🟢 可以问 (长期规划)

### 9. 演示环境 + 日期 [~3 min]

**问**:
- 演示环境: 测试 10011 / 生产 10010 / 本地?
- 用 factory F001 (白垩纪水产加工一厂) seed 数据, 还是 seed 一个"六扇门" 专属 factory?
- 是否 seed 六扇门真实客户/产品/BOM 数据?
- 具体日期 + 除张权/财务老师/运营同事外还有谁参会?

---

### 10. 钉钉 / 企业微信集成 [~3 min]

v3 P3 没列 (会议未提), 但客户原档提过组织架构同步.

**问**: 钉钉集成在您的 V1.0 / V2.0 / 不需要?

**注意**: 本 session 已提供 `NotificationService` interface, 切换到钉钉/微信只需加新 impl, 业务代码不动。

---

### 11. 49 页硬编码迁移策略 [~2 min]

**背景**: 当前 web-admin 49 页 el-form 硬编码, V1.0 只做 3 实体 schemaJson 试点 (SalesOrder / RD_SAMPLE / BOM 头部).

**问**: V1.0 验收后, 是否愿意**按需迁移**剩余页面到 schemaJson (每新客户带 1-3 页的节奏)? 还是希望一次到位?

---

## 🎯 最关键 3 个问题 (若只能问 3 个)

1. **Q1 + Q2 (研发字段对照)**: 避免演示现场被发现遗漏字段
2. **Q3 (P0-5 双仓真实期望)**: 决定是否启动 4-5 周 warehouse epic
3. **Q4 (采购/人事/财务 P2 书面确认)**: 避免后期反悔

---

## 📋 会议后输出

1. **对齐纪要**: 每个问题的客户决定 + 签字 (或邮件书面)
2. **gap 清单**: 需要 V1.0 追补的项 (如字段补齐 / 命名调整)
3. **V1.0 验收标准**: 确认后交付清单 (可以演示 + 可以 ship 的功能矩阵)
4. **V2.0 路线图**: 确认 "触发条件" 和 "承诺时间"

---

## 🔗 参考

- v3 需求文档: `docs/plans/customer-meeting-apr7-requirements-v3.md`
- v1 会议纪要: `docs/plans/customer-meeting-apr7-requirements.md`
- P0-5 B2 ADR: `docs/plans/p0-5-b2-warehouse-dimension-adr.md`
- Apr 11 session summary: memory `project_apr11_session_summary.md`
- 会议截图: `temp/meeting-transcribe/frames_all/` (292 张)
- 会议转录: `temp/meeting-transcribe/transcript.txt` (94KB, 1915 段)
