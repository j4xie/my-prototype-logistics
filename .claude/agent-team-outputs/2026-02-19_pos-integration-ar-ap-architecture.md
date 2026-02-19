# POS集成 + AR/AP 会计模块 架构调研报告

> 生成日期: 2026-02-19 | 模式: Full | 语言: Chinese

---

## Executive Summary

- **建议**: 分两阶段推进 -- 先在现有 `Customer`/`Supplier` 实体上增加轻量级交易记录表（ar_ap_transactions），后期按需引入 POS 适配器层。不建议现阶段引入完整 Invoice 模型。
- **置信度**: 中等 -- 三方分析员在方向上一致（Adapter模式），但工期、商务可行性和模型选择存在重大分歧。
- **核心风险**: 项目处于 82-85% 原型阶段，过早引入 ERP 级 AR/AP 模型可能导致范围膨胀。POS 厂商半数无公开 API。
- **工期影响**: 轻量版 AR/AP 约 2-3 周；POS 集成首批约 4-6 周，但需先完成商务签约。

---

## POS系统集成能力对比

| 评估维度 | 二维火 | 客如云 | 银豹 | 美团收银 | 哗啦啦 |
|----------|--------|--------|------|----------|--------|
| **API开放度** | REST + 沙箱 + ISV | REST + OAuth2 + 开放平台 | REST + 开发者中心 | 无公开API，需签约SDK | 私有API，需商务获取 |
| **认证机制** | appKey + SHA1签名 | OAuth2.0 机构授权 | appId + HMAC-SHA256 | 商务SDK分配 | 私有token + 集团ID |
| **数据同步** | 商品/订单/库存/会员 | 门店/商品/订单/库存/会员 | 商品/订单/库存/会员/报表 | 外卖/团购间接 | 门店/菜品/订单/库存 |
| **Webhook支持** | 有 (SHA1验签) | 有 (OAuth验签) | 有 (HMAC-SHA256) | 不明确 | 不明确 |
| **接入难度** | 低 (文档完善) | 中 (需机构资质) | 低 (文档完善,需年费) | 高 (商务门槛) | 高 (无公开文档) |
| **集成优先级** | 第1批 | **首选试点** | 第1批 | 观望 | 观望 |

---

## 架构决策

### POS集成: Adapter模式 (无CDM)

**决策**: 采用 `PosAdapter` 接口 + 每品牌实现类，**直接映射到已有的 `SalesOrder`/`PurchaseOrder` 实体**，不引入中间CDM层。

**理由**:
- CDM被业界越来越视为反模式 (Stefan Tilkov, INNOQ)，会导致"God Object"
- 项目已有成熟的 `SalesOrder`/`PurchaseOrder` 实体，字段已足够丰富
- 参照项目已有的 `IntentHandler` 接口 + 24个Handler的模式

**接口设计**:
```java
public interface PosAdapter {
    String getBrand(); // "KERUYUN", "POSPAL", "ERHUO"
    boolean testConnection(PosConnectionConfig config);
    List<SalesOrder> syncOrders(PosConnectionConfig config, LocalDateTime since);
    void handleWebhook(String payload, String signature);
}
```

### AR/AP: 轻量交易记录方案

**决策**: 新建 `ar_ap_transactions` 表记录应收应付明细，保留 `Customer.currentBalance`/`Supplier.currentBalance` 作为汇总字段。**不引入完整 Invoice 模型**。

**理由**:
- 82-85% 完成度原型不应引入完整Invoice模型 (Critic核心论点)
- `Customer.currentBalance`/`Supplier.currentBalance` 已在多个Controller中使用
- 轻量方案可在2-3周完成，完整Invoice需4-6周
- 远期如需Invoice模型，transaction_log可平滑升级为payment_applications

### 放弃的设计

| 方案 | 放弃原因 |
|------|----------|
| CDM统一数据模型 | 反模式风险，项目已有足够丰富的领域实体 |
| 完整Invoice模型 | 过度设计，82-85%原型阶段工期不可控 |
| sourceType+sourceId多态关联 | SQL反模式，无法建外键，与项目@JoinColumn一致性冲突 |
| 美团/哗啦啦POS集成 | 无公开API，商务不确定，哗啦啦资金风险 |

---

## Confidence Assessment

| 结论 | 置信度 | 依据 |
|-----|--------|------|
| Adapter模式适合POS集成 | ★★★★☆ | 3位分析员一致；项目已有IntentHandler先例 |
| 放弃CDM，直接映射到已有Entity | ★★★★☆ | Critic论点有力；SalesOrder/PurchaseOrder已足够 |
| 轻量transaction_log优于完整Invoice | ★★★★☆ | currentBalance已在生产使用 |
| 客如云为最佳首批POS品牌 | ★★★☆☆ | OAuth2标准，阿里生态，文档公开 |
| 二维火/银豹可直接开发 | ★★☆☆☆ | 商务门槛和年费问题 |
| 美团/哗啦啦短期可集成 | ★☆☆☆☆ | 无公开API，商务不确定 |

---

## Actionable Recommendations

### 立即执行

1. **新建AR/AP交易记录表** (ar_ap_transactions)
   - 字段: id, factory_id, transaction_type[AR/AP], counterparty_type[CUSTOMER/SUPPLIER], counterparty_id, sales_order_id, purchase_order_id, amount, balance_after, transaction_date, due_date, remark
   - Service层: 每次创建交易记录时同步更新currentBalance
   - 账龄分析: PostgreSQL窗口函数实现6桶分析

2. **验证POS集成的业务需求**
   - 确认目标客户下游是B端经销商还是C端门店
   - B端 → POS降级，考虑金蝶/用友CSV对接
   - C端 → 优先联系客如云获取sandbox账号

### 短期 (确认需求后)

3. **设计POS Adapter接口**
   - `PosAdapter`接口 + `pos_connections`配置表
   - 首个实现: `KeruyunPosAdapter` (客如云, OAuth2)

### 有条件执行

4. **完整AR/AP升级** — 仅当客户明确要求发票管理/核销
5. **Spring Boot升级** — 单独排期，不与本次工作捆绑

---

## Open Questions

1. 目标客户的下游渠道是B端还是C端？
2. 客如云开发者账号申请周期？
3. currentBalance是否有并发写入风险？
4. 是否需要对接金蝶/用友？
5. POS订单同步频率（实时Webhook vs 定时拉取）？

---

### Process Note
- Mode: Full
- Researchers deployed: 3
- Total sources found: 30
- Key disagreements: 3 resolved (CDM/Invoice/工期), 2 unresolved (POS商务/Spring Boot升级)
- Phases completed: Research → Analysis → Critique → Integration
