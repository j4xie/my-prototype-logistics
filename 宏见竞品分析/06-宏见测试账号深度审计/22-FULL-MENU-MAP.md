# 22 — Round 5 完整菜单 681 项 + 1591 RBAC 点

> 🎯 **重大发现**: 通过 `menu.jsp?m=X` JS 变量 `sMenu2Array` 提取真实菜单, 发现:
> - 之前 audit 报告 **259 子菜单** = **严重低估 2.6×**
> - 真实 **681 二级页面 + URL + RBAC code**
> - **160 一级分组** + **12 顶层模块**
> - **1591 个 RBAC 权限点** (f_no, 在 `jsonArray`) — 4× Cretas 现有 404 Tool

---

## 1. 真实数字 vs 之前 audit

| 模块 | 之前 audit | **真实 (sMenu2Array)** | 倍率 |
|---|---|---|---|
| production (生产) | 31 | **109** | **3.5×** |
| oa (办公自动化) | 30 | **93** | **3.1×** |
| hr (人力) | 27 | **89** | **3.3×** |
| sale (销售) | 25 | **78** | **3.1×** |
| finance (财务) | 21 | **68** | **3.2×** |
| client (客户) | 18 | **50** | **2.8×** |
| system (系统) | 16 | **45** | **2.8×** |
| entrust (委外) | 22 | **41** | **1.9×** |
| warehourse (仓库) | 27 | **36** | 1.3× |
| buy (采购) | 18 | **33** | 1.8× |
| quality (品质) | 10 | **24** | 2.4× |
| engineering (工程/BOM) | 14 | **15** | 1.1× |
| **合计** | **259** | **681** | **2.6×** |

> ⚠️ **方法论问题**: 之前 audit 只看 **顶层 + 第一级可见 sub-menu**, 真实**深层菜单 + 报表 + admin 配置** 全部漏报.

> 📂 完整数据: `screenshots/hongjian-full-menu-681.json` + `screenshots/hongjian-menu1-160.json`

---

## 2. 11 大重磅新发现 (之前未捕获)

### 2.1 APS 高级排产 (6 项, production/aps) ⭐⭐⭐
- 自动排产 / 自动排产历史
- 自动排产 / 排产明细
- 设备工时 / 派工任务
- **Cretas 完全没有 APS 模块** — F006 食品厂未来如多产线必需
- 工时: 长期 P2 (15d+)

### 2.2 模具完整生命周期 (13 项, production/mould) ⭐⭐
- 模具管理 / 模具备件管理 / 领取记录 / 模具盘点 / 模具部位 / 关联产品 / 模具备件出库 / 模具维修管理 / 模具备件入库 / 模具借出 / 模具点检 / 模具寿命 / 模具变更
- 跟 设备生命周期 同等深度
- F006 卤制品无模具, 但**电子/注塑/服装** 行业刚需 (长期 Cretas 客户扩展)

### 2.3 车辆管理 (10 项, oa/car) ⭐
- 用车申请 / 车辆信息 / 个人公司车辆 / 驾驶员信息 / 个人行程管理 / 司机行程管理 / 车辆保险 / 车辆事故管理 / + 2
- Cretas 完全没有
- 物流密集型客户场景

### 2.4 销售 7 种业绩报表 + 6 种月结统计 + 14 种统计报表 (sale/achievements + sale/month + sale/report) ⭐⭐⭐
**业绩**: 业绩管理 / 业绩年度报表 / 业绩统计口径 / 未发提成统计表 / 提成类型 / 提成方案 / 我的业绩
**月结**: 销售月结对账单 / 销售月结统计表 / 销售月结对账异常 / 客户欠款统计
**统计**: 销售统计总表 / 按客户 / 按业务员 / 按产品 / 按类别 / 按国家 / 出库统计 ×6 / 出货及时率 / 销售附加费用 / 年度客户分析 / 销售综合月报表
**利润**: 客户毛利 / 订单毛利 / 发货毛利 / 员工毛利 / 销售利润 / 产品出货

**Cretas SmartBI 对照**: SmartBI NL Query 替代但**预置报表** Cretas 缺 — 加 30+ 预置报表模板

### 2.5 工资管理 11 项 (hr/wage) ⭐⭐
- 工资管理 / 工资发放记录 / 年度工资统计表 / 薪资记录 / 工资发放 / 社保管理 / 专项扣除 / 计件管理 / + 3
- Cretas 仅 M-WAGE-1 (计件), 缺 7+ 项 (工资发放/社保/专项扣除/年度统计)

### 2.6 考勤管理 11 项 (hr/attendance) ⭐⭐
- 考勤月报 / 考勤日报 / 考勤流水查询 / 考勤修改记录 / 考勤分析 / 高级排班 / 考勤机管理 / 考勤排班记录 / + 3
- Cretas H-ATT-1 仅含矩阵 + 月报, 缺 6+ 项

### 2.7 客户管理 12 一级分组 (client) ⭐⭐
新发现:
- **clientsetup** (6 项): CRM 参数设置 / 资料定义 / 常用枚举维护 / 标准枚举维护 / 客户重复信息列表 / 客户特殊授权列表
- **chance** (3 项, 商机管理): 商业机会管理 / 商业机会漏斗 / 商业机会分析
- **report** (6 项): 客户跟踪记录 / 跟踪记录统计 / 新增客户统计表 / 客户来源统计表 / 邀请平台记录 / 国市客户统计表
- **query** (3 项): 客户查询 (按订单/按手机/按微信)
- Cretas S-CRM-1 仅含跟踪记录, 缺 11 项

### 2.8 BOM 工程级 8 子操作 (engineering/bom) ⭐⭐⭐
- BOM列表 / BOM审核 / BOM反查 / BOM导入 / BOM物料批量修改 / BOM物料批量替换 / BOM物料批量删除 / BOM物料批量新增
- 第 9 项: ECN变更明细 (engineering/ecn)
- 完美对应 Round 1 已确认 M-BOM-1 升级 P0

### 2.9 工序管理 (engineering/process) ⭐
- 全局工序设置 / **工序条件设置** ⭐ / **工序条件预判** ⭐
- "工序条件" 是 Cretas 没有的概念 — 条件路由 (e.g. "如果材质=不锈钢, 走工序 A; 否则工序 B")
- 跟 BOM 多版本配套

### 2.10 委外 (entrust 41 项, 5 一级) 完整业务
- entrust (17): 委托生产/预备/库存查询/收货/入库/出库/汇总发料/批量退货 等
- **entrusted** (11, 受托方视角!): 受托生产 / 库存查询 / 委外领料单 / 成品入库单 / 出库退回单 / 批量出库 / 批量退货 等
- entrustonline (4): 在线委托接单 / 委外发料单 / 成品入库单 / 出库退回单
- entrustsetup (1): 委外参数设置
- singentrust (8): 派单列表 / 库存查询 / 单件加工收货列表 / 单件加工出库列表 / 单件加工新建 / 单件应付账款 / 委托公司列表
- **关键**: 宏见有"受托方" + "委托方" 双向视角 + 单件加工 (跟批量加工区分)

### 2.11 财务 (finance 68 项, 17 一级) 完整法定会计
- **finance** (5): 凭证管理 / 科目管理 / 帐套管理 / 凭证模板 / 凭证号
- finance_check (2): 结账 / 结账纸
- **fixed** (9): 固定资产管理 / 借用记录 / 折旧 / 报废 / 位置 / 盘点 / 调拨 / 批量修改 / 关联
- **invoice** (7): 已开发票管理 / 已收发票管理 / 已开发票统计 / 未开发票统计 / 已收发票统计 / 未收发票统计 / 发票号申请
- **payable** (5): 应收账款 / 应付账款 / 应收应付统计报表 / 付款申请单 / 退款申请单
- **reimbursementfee** (5): 费用报销 / 借款报销 / 差旅费报销 / 我的费用报销 / 我的差旅费报销
- **report** (4): 资产负债表 / 利润表 / 现金流量表 / 自定义报表 ⭐⭐⭐ — **法定财务三表实装**!
- **sheet** (5): 明细表 / 借贷方明细表 / 帐簿 / 凭证汇总表 / 科目余额

### 2.12 系统管理 (system 45 项, 9 一级) — 配置中台核心
- **system** (12): 系统参数设置 / 高端key管理 / 系统预警 / 操作日志 / 系统体检设置 / 体验查询 / 体验设置 / 系统更新 等
- **printmanager** (3): 动态打印 ⭐ / **打印模板** ⭐⭐ (C-PRT-EDITOR-1!) / 字体管理
- **workflow** (6): 待处理工作流 / 我的工作流 / 工作流配置 / 流转规则配置 / 我创建的工作流 / 我参与的工作流
- **screen** (2): 看板账号 / 看板配置 ⭐
- **store** (5): 门店补货列表 / 店面管理 / 店面入库管理 / 店面库存 / 店面出库
- **product** (8): 产品管理 / 单据修改 / 全局工序设置 / 计量单位设置 / 单据删除 / 税务产品管理 / 国家区域设置 / 产品参数设置
- **thirdext** (2): 第三方账单 / 第三方授权
- **weixin** (2): 微信服务号配置 / 微信公众号授权
- **complaint** (3): 投诉管理 / 投诉处理 / 我的投诉
- **parameter** (2): 编号规则设置 ⭐ / 财务规则设置

---

## 3. 1591 RBAC 权限点分析

完整 RBAC `f_no` list 在 `window.jsonArray` (1591 项). Sample 50:

```
wechat_manager / smstemplatequery / recinvoice / reportclientstateadd / filedel / 
productionassortedbox / servicepartstockoutprice / proceduresingfinishedexcel / 
repairpartexport / supplierproductexcel / attendance_time_delete / sale_back_indetail / 
filesetup / fixeddeletephysic / tendermanager / productionfeeapporttion / materialstcoutok / 
customedit_client_success_add / outsourcingapplystatemodify / attendanceoutside / 
customedit_linkman_add / vacationmanagerlistexcel / reportachieveyear / saleouttype / 
warehouse_write / deliverprofitmonth / custom_company_export / partnerprofitrelease / 
outsourcingstock / supplieronline / stockborrowoutdelete / sale_stock_out_detail / ...
```

**Cretas 对照**:
- Cretas RBAC = 角色 × Module/Screen 大致粒度
- **宏见 RBAC = 1591 个细粒度 f_no** — 每个操作都独立权限
- 例: 销售单 "查看" = saledetail / "修改" = ? / "出库" = sale_stock_out / "出库明细" = sale_stock_out_detail / "退货" = sale_back_indetail
- **CheckPower(true, "f_no_X", this)** JS function 是统一权限检查

**Cretas 借鉴 (战略级)**:
- **C-CHECKPOWER-1** (已加 P0): RBAC 权限检查统一函数, 工时 3d
- **C-RBAC-GRANULAR-1 (新)**: 1591 fine-grained 权限点 — 长期 P2 (Sprint 6+ 大客户场景)

---

## 4. 关键 URL Pattern Map

| 模块 | 子域 | URL pattern 示例 |
|---|---|---|
| 销售 | sale.hongjian.com | /sale/list/salelistroute_pc.jsp |
| 采购 | buy.hongjian.com | (推测) |
| 库存 | stock.hongjian.com / stockwork.hongjian.com | /stockwork/...|
| 财务 | finance.hongjian.com | /finance/account/accountrunningroute.jsp |
| 生产 | production.hongjian.com | (推测) |
| 工程 | bom.hongjian.com | /bom/productbomcheckinglist.jsp |
| 委外 | (子域待确认) | /entrust/... |
| 客户 | crm.hongjian.com | /crm/custom/clientroute.jsp |
| 人力 | hr.hongjian.com | /hr/attendance/monthemployeelist.jsp |
| 办公 | oa.hongjian.com | /oa/contract/contractmanager/... |
| 系统 | main.hongjian.com | /system/* |
| 工作流 | workflow.hongjian.com | /workflow/workflowlist.jsp |
| 销售需求 | need.hongjian.com ⭐ NEW | /need/needtotal_simple_temp.jsp |
| 项目 | project.hongjian.com ⭐ NEW | /project/projectclient/... |
| 产品 | product.hongjian.com | /tree/tree.jsp?type=needtotal |
| 报警 | warn.hongjian.com | /warn/warneasylist.jsp |
| 帮助 | help.hongjian.com | (文档) |
| 安全 | security.hongjian.com | (密码 + key) |

**总 17+ 子域** (比之前估 15 多 2 个 — need + project)

---

## 5. Cretas 借鉴战略级修正

### 5.1 数字修正
- 之前 audit 报告 "宏见 280+ 子菜单" → 实际 **681**
- 之前 audit 报告 "Cretas 工时增量 +132d → +141.5d" → 实际**应该更多** (因为很多新发现)

### 5.2 Round 5 新增 P0 (战略级)
| 编号 | 项 | 工时 |
|---|---|---|
| **C-RBAC-FNO-1** | 细粒度 f_no 权限点 (跟随 C-CHECKPOWER-1, 数百个) | 长期 P2 (15d+) |
| **F-3REPORT-1** (升级) | 法定财务三表 (资产/损益/现金流) — Round 5 实测确认 invoice 7 项 + payable 5 项 + 完整科目体系 | 升 P1 (12d) |
| **C-MENU-ENGINE-1 (NEW)** | menu.jsp?m=X 配置驱动菜单架构 (Cretas 当前是 hardcoded routing) | 长期 P3 (8d) |

### 5.3 Round 5 新增 P1
| 编号 | 项 | 工时 | 来源 |
|---|---|---|---|
| **S-REPORTS-PRESETS** | 销售 14+ 预置报表模板 (按客户/业务员/产品/类别/国家/出库/利润 等) | 8d | sale/report 14 项 |
| **H-WAGE-FULL** | 工资管理 11 项 (社保/专项扣除/年度统计 等) | 10d | hr/wage 11 项 |
| **H-ATT-FULL** | 考勤管理 11 项 (高级排班/异常分析/考勤机管理 等) | 10d | hr/attendance 11 项 |
| **C-CRM-FULL** | 客户 50 项含商机管理 3 / 报表 6 / 资料定义 6 | 15d | client 50 项 |
| **S-ACHIEVE-1** | 业绩管理 + 提成方案 (sale/achievements 7 项) | 8d | 已含部分 S-PERF-1 升级 |
| **C-PRINTER-FONT-1** | 字体管理 + 动态打印 (system/printmanager 3 项) | 3d | 配 C-PRT-EDITOR-1 |
| **C-BOARD-1** | 看板账号 + 看板配置 (system/screen 2 项) | 5d | 跟 Cretas SmartBI 看板对照 |

### 5.4 Round 5 新增 P2
| 编号 | 项 | 工时 | 说明 |
|---|---|---|---|
| **M-APS-1** | APS 高级排产 (6 子项) | 15d | 大型工厂多产线 |
| **M-MOULD-1** | 模具完整生命周期 (13 子项) | 12d | 注塑/电子/服装行业 |
| **C-CAR-1** | 车辆管理 (10 子项) | 8d | 物流密集型 |
| **C-STORE-1** | 门店管理 (5 子项, 餐饮 QHJ) | 5d | 餐饮主线 |
| **W-SCRAP-FULL** | 报废 + 库存调拨完整 (warehourse 36 项) | 10d | |

---

## 6. Round 5 总数字

### 6.1 新增 MUST_COPY (Round 5)
- P0 升级: 1 (F-3REPORT-1)
- P0 新: 2 (C-RBAC-FNO-1, C-MENU-ENGINE-1)
- P1 新: 7 项 (S-REPORTS / H-WAGE / H-ATT / C-CRM / S-ACHIEVE / C-PRINTER-FONT / C-BOARD)
- P2 新: 5 项 (M-APS / M-MOULD / C-CAR / C-STORE / W-SCRAP-FULL)

**Round 5 工时增量**: ~115d (P1=59d, P2=50d, P0=15d-长期)

### 6.2 累计工时 (Round 1+2+3+4+5)
| Round | 工时增量 |
|---|---|
| Round 1 | +132d |
| Round 2 | +9.5d |
| Round 3 | 0d (新截图) |
| Round 4 | +41d (G1-G6 关键) |
| **Round 5** | **+115d (681 完整菜单后)** |
| **合计** | **+297.5d** vs 原 MUST_COPY 84d = **总 ~381d** |

**Cretas Sprint 0-6 计划严重低估** — 真实工时 ~381d, 12-18 个月单人 (含 Claude 加速).

---

## 7. 完整功能 evidence — 681 项 List Highlights

完整 list 见 `screenshots/hongjian-full-menu-681.json`. 这里列每模块 top items:

### sale (78) 主分组
- order (9): 销售订单/销售出库列表/交货日期查询/销售产品需求表/发票申请/回款计划/销售预测单/在线订单/销售合同
- quotation (2): 报价单/**报价试算** ⭐
- goodssend (3): 待送货列表/车辆安排列表/送货完成列表
- goodsreturn (2): 销售退货入库/客户退货入库
- projectclient (2): 客户项目/我参与的客户项目
- projectdevelop (2): 研发项目/我参与的研发项目
- achievements (7): 业绩管理/年度报表/统计口径/未发提成统计/提成方案/提成类型/我的业绩
- month (4): 销售月结对账单/月结统计表/月结对账异常/客户欠款统计
- report (14): 14 种销售/出库统计报表
- profit (6): 客户毛利/订单毛利/发货毛利/员工毛利/销售利润/产品出货
- consignment (5): 寄卖单/退货/统计/退货 / 寄卖月统计
- rent (7): 租赁订单/出库/归还/产品/仓库/查询/报表
- sample (3): 样品单/出库/退货
- lend (2): 借出单/借出归还
- service (6): 售后服务/我的售后服务/服务人员/服务退货/服务报表
- wxshop (2): 微信用户/微信网店配置
- salesetup (3): 销售/采购/产品参数设置

### system (45) 主分组
- system (12): 系统/高端key/预警/日志/体检/查询/设置/更新/...
- product (8): 产品/单据修改/全局工序/计量单位/单据删除/税务/国家/参数
- workflow (6): 待处理/我的/配置/流转规则/我创建/我参与
- store (5): 门店补货/店面/入库/库存/出库
- printmanager (3): 动态打印/打印模板/字体管理
- complaint (3): 投诉/处理/我的投诉
- thirdext (2): 第三方账单/授权
- weixin (2): 服务号/公众号
- screen (2): 看板账号/看板配置
- parameter (2): 编号规则/财务规则

---

## 8. 完成度 — Round 5

✅ **真实菜单数: 681** (vs 之前估 259, 翻 2.6×)
✅ 12 模块 × 160 一级分组 全提取
✅ 1591 RBAC f_no 全提取
✅ 17+ 子域 URL pattern 整理
✅ 11 大新发现 (APS/模具/车辆/13 种报表/工资 11/考勤 11/CRM 50/BOM 8 子/工序条件/委外双向 41/财务三表)
✅ Cretas Round 5 增量: P0 升级 1 + P0 新 2 + P1 新 7 + P2 新 5 = **+115d 工时**
✅ 累计工时修正: 原 84d → **真实 ~381d (4.5× 原估)**

**结论**: Cretas Sprint 0-6 计划基于错误数字, **必须重估**. 30 周 → **52-78 周 (1-1.5 年单人)**.
