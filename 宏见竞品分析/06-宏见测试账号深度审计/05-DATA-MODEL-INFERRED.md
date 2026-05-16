# 05 — 反推数据模型 (Inferred Data Model)

> Phase 4 输出. 基于实测的 URL 路径 / 字段命名 / 关联关系 推断后端数据模型.

---

## 1. 子域 → 后端服务 map (12 个)

| 子域 | 用途 | 推测语言 |
|---|---|---|
| login.hongjian.com | 登录 + 公司编号验证 | Java/JSP |
| main.hongjian.com | 主框架 + dashboard | Java/JSP |
| crm.hongjian.com | 客户/CRM | Java |
| sale.hongjian.com | 销售 | Java |
| buy.hongjian.com | 采购 | Java |
| stockwork.hongjian.com | 仓库/库存 | Java |
| production.hongjian.com | 生产 | Java |
| product.hongjian.com | 产品/物料 + 工程 | Java |
| bom.hongjian.com | BOM 工程 | Java (独立子域显示重要性) |
| hr.hongjian.com | 人力资源 | Java |
| finance.hongjian.com | 财务 | Java |
| oa.hongjian.com | 办公自动化 + 合同 | Java |
| workflow.hongjian.com | 工作流引擎 | Java (独立服务) |
| security.hongjian.com | 安全 + 密码 | Java |
| resource.hongjian.com | 静态资源 (jquery.js, 图片) | CDN |
| help.hongjian.com | 在线帮助文档 | 静态 |

15+ 子域 (类似 microservices 拆分, 但实际是单 monolith 多 vhost).

---

## 2. 核心实体推断 (按域)

### 2.1 销售域 (sale.)

**SalesOrder (销售订单)**
```java
class SalesOrder {
    String bno;                // 单号 (00000060), 8 位
    String clientNo;           // 客户编号
    Date saleDate;             // 销售日期
    Date deliveryDate;         // 交货日期 (可单据级 vs 行级)
    Currency currency;         // 32 选枚举
    BillState billState;       // 5 状态
    BState bstate;             // 14 出库状态
    CheckState checkState;     // 3 审核状态
    PayMoneyState payMoney;    // 8 收款状态
    BillFlag billFlag;         // 5 开票标识
    PayType payType;           // 14 支付方式
    LType ltype;               // 5 产品类型
    DeliveryType delType;      // 5 送货方式
    InstallType installType;   // 3 安装方式
    String operSales;          // 销售员
    String operTrac;           // 跟单人
    String departmentNo;       // 部门
    BigDecimal numTotal;       // 数量小计
    BigDecimal priceTotal;     // 金额合计
    BigDecimal freight;        // 运费
    BigDecimal extraFee;       // 其他费用
    BigDecimal invoiceMoney;   // 发票金额
    String bRemark;            // 备注 (max 3900)
    MomeFlag momeFlag;         // 7 色标记
    SaleSource source;         // 下单渠道 (3 选)
    Long stockUpStatus;        // 备货状态 (5 选)
    String[] linkListArray;    // 关联类型 + 单号 JSON (8 类)
    Long lockQty;              // 锁定库存
    Long stockUpQty;           // 备货数量
    Long shortageQty;          // 缺口数量 = 未出库 - 锁定 - 备货
}
```

**SalesOrderItem (销售订单明细)**
```java
class SalesOrderItem {
    String orderBno;           // FK SalesOrder
    Integer seq;               // 序号
    String productNo;          // 产品编号
    String productName;        // 产品名称
    String norms;              // 规格
    BigDecimal qty;            // 销售数量
    BigDecimal preTaxPrice;    // 税前单价
    BigDecimal postTaxPrice;   // 税后单价
    BigDecimal taxRate;        // 发票税率
    BigDecimal totalPrice;     // 总价 (auto)
    Date deliveryDate;         // 行级交货日期
    String remark;             // 行级备注
}
```

### 2.2 采购域 (buy.)

**PurchaseOrder (采购订单)**
- 字段类似 SalesOrder, 加 `supplierNo` (供应商), `buyType` (3 选: 正常/进口), 关联 8 类
- 三价对比 DTO 关联

### 2.3 库存域 (stockwork.)

**StockOut (出库单)**
```java
class StockOut {
    String no;
    String warehouseNo;        // 仓库 (10 分类)
    Date date;                 // 出库日期
    String departmentNo;       // 部门
    Iflag iflag;               // 出库状态 (3 选)
    Vflag vflag;               // 凭证生成状态 (4 选: 不限/无需生成/未生成/已生成)
    String voucherList;        // 关联凭证 list (JSON)
    String linkListarray;      // 关联 source 单据
}
```

### 2.4 财务域 (finance.)

**Voucher (会计凭证)** ⭐⭐⭐
```java
class Voucher {
    String word;               // 凭证字 (记/收/付/转 等)
    Integer wordNumber;        // 字号 (auto)
    Date date;                 // 凭证日期
    Integer billCount;         // 附单据张数
    String summary;            // 摘要
    List<VoucherEntry> entries; // 复式分录 (借/贷)
    String factoryNo;          // 公司
    Period period;             // 期间 (2026-05)
}

class VoucherEntry {
    Integer seq;
    String summary;
    String subjectName;        // 会计科目 (popup picker)
    BigDecimal qty;            // 数量
    Currency currency;         // 币别
    String[] auxAccounting;    // 辅助核算 (部门/项目/客户/产品)
    BigDecimal debitAmount;    // 借方金额 (亿/千 列组)
    BigDecimal creditAmount;   // 贷方金额
}
```

**Receivable / Payable (应收应付)**
```java
class Receivable {
    String bno;
    String linkBno;            // 源销售单
    String clientNo;
    Currency currency;
    BigDecimal totalAmount;
    BigDecimal paidAmount;
    BigDecimal remainAmount;   // = total - paid
    AgingBucket aging;         // 6 桶 (30/60/90/120/180/180+)
    Date dueDate;
}
```

### 2.5 BOM/工程域 (bom.) ⭐⭐⭐

**ProductBOM**
```java
class ProductBOM {
    String bomId;              // ⭐ 独立 ID
    String productNo;
    String productName;
    String norms;
    Integer version;           // ⭐ 版本号
    BomType bomType;           // 工程/工艺/销售 (推测)
    BomState bomState;         // 状态: 草稿/待审核/已生效/历史
    Integer processCount;      // 工序数 (列汇总)
    Integer materialCount;     // 物料数 (列汇总)
    String createOper;
    Date createDate;
    String[] workflowState;    // 工作流状态
    List<BomItem> items;
    List<BomProcess> processes;
}

class BomItem {
    String bomId;
    Integer seq;
    String materialNo;
    BigDecimal qty;
    BigDecimal lossRate;       // 损耗率
    BigDecimal yieldRate;      // 出成率 (M-BOM-2 已 ship in Cretas)
    String unit;               // g/kg (M-UNIT-1)
}

class BomProcess {
    String bomId;
    Integer seq;
    String processNo;
    BigDecimal stdTime;        // 标准工时
}

class ECN {                    // Engineering Change Notice
    String ecnNo;
    String bomId;
    Integer fromVersion;       // v1
    Integer toVersion;         // v2
    String reason;             // 5 选 (客户要求/物料停产/成本/质量/工艺)
    String impactScope;        // 影响范围
    String[] notifyList;       // 通知列表 (生产/采购/质检/销售)
    Date effectiveDate;        // 生效日期
    String[] approvalChain;    // 审批链
    EcnState state;
}
```

### 2.6 工作流域 (workflow.)

**WorkflowDefinition**
```java
class WorkflowDefinition {
    String workNo;             // 流程定义编号 (sale, buy, ...)
    String workName;
    List<WorkflowNode> nodes;
    List<WorkflowEdge> edges;
    List<RoutingRule> rules;   // 流转规则 (金额阈值, 部门, 角色)
}

class WorkflowInstance {
    String instanceId;
    String workNo;
    String primaryKey;         // 关联单据单号
    String currentNode;
    String[] history;          // 节点历史 + 操作人 + 时间
    InstanceState state;       // 进行中/已完成/已驳回/已撤销
}

class WorkflowOpinion {
    String instanceId;
    String nodeId;
    String operator;
    Date date;
    String opinion;            // 默认"同意", 可选模板
    Boolean approved;
}
```

### 2.7 人力域 (hr.)

**Employee**
```java
class Employee {
    String empNo;
    String name;
    String departmentNo;
    String position;
    Date hireDate;
    Date leaveDate;            // 离职 (可空)
    EmployeeType type;         // 离职/在职
    String[] roleNos;
    String stamp;              // 印章签名 (实测子菜单)
}

class AttendanceMonth {
    String empNo;
    String month;              // 2026-05
    Map<Integer, WeekData> weeks; // 6 周
    BigDecimal workHours;      // 工作时长
    BigDecimal overtimeHours;  // 加班时长
    BigDecimal totalHours;
    String summary;            // 出勤汇总
}
```

---

## 3. 跨域关联 (linklistarray 8 类)

JSON 数组存关联 source:
```json
[
  {"LINK_TYPE": "sale", "LINK_NO": "00000060"},
  {"LINK_TYPE": "produce", "LINK_NO": "P0001"}
]
```

LINK_TYPE 8 类枚举:
- sale (销售单)
- sample (样品单)
- request (请购单)
- produce (生产单)
- outsource (委外单)
- stock (备货单)
- project (项目)
- (free / 自由)

**SQL 反查示例**:
```sql
-- 这个采购单的源销售单是哪些
SELECT * FROM PurchaseOrder
WHERE JSON_CONTAINS(linkListArray, '"sale"', '$.LINK_TYPE')
  AND JSON_CONTAINS(linkListArray, '"00000060"', '$.LINK_NO')
```

---

## 4. 单据编号规则 (实测)

| 单据 | 编号格式 | 备注 |
|---|---|---|
| 销售单 | 00000060 (8 位) | auto + **可手填覆盖** |
| 采购单 | 00000038 (8 位) | 同 |
| 客户 | 00000014 (8 位) | 同 |
| 凭证 | 字号 (auto) + 凭证字 | "记 1" "收 2" |
| ECN | (推测 ECN-2026-001) | |

---

## 5. Cretas 数据模型增量 (从宏见反推应该加)

| 优先级 | 增量 | 工时 | 说明 |
|---|---|---|---|
| **P0** | SalesOrder + 8 状态字段 (vs 当前 1 status) | 1d | billState/bstate/checkState/payMoney/billFlag/payType/momeFlag |
| **P0** | linkListArray 跨业务关联 (8 类) | 2d | 跨业务追溯 |
| **P0** | StockOut.vflag (4 状态) | 1d | F-VOUCHER-HOOK-1 基础 |
| **P0** | ProductBOM.version + ECN | 5d | M-BOM-VER-1 升级 |
| **P0** | Voucher + VoucherEntry (复式记账) | 8d | 法定财务 |
| **P1** | Lock/StockUp/Shortage 3 字段 + 公式 | 1d | 行内显示 |
| **P1** | 仓库 10 分类 enum | 1d | |
| **P1** | WorkflowDefinition + Instance + Opinion | 10d | C-APPROVAL-1 配套 |
| **P1** | AttendanceMonth + 6 周矩阵 | 2d | H-ATT-1 |

---

## 6. 完成度
✅ 12+ 子域 → 后端服务 map
✅ 7 域核心实体推断 (销售/采购/库存/财务/BOM/工作流/人力)
✅ linklistarray 8 类关联 + SQL 反查示例
✅ 单据编号规则
✅ Cretas 数据模型增量 9 项 (P0/P1 优先级)
