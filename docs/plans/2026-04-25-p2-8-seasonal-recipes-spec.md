# P2-8 季节性配方 / 替代食材 — Spec

## 问题

同一菜品在不同季节使用不同主料:
- "时蔬沙拉" 夏天用黄瓜+番茄, 冬天用胡萝卜+白菜
- "炖汤" 春天用鲜竹笋, 秋冬用冬笋
- 部分食材季节性缺货, 老板用替代品但忘了改配方 → 成本计算失真

## Schema

```sql
-- 扩展 recipes 表: 加 variant_tag 支持多个版本并存
ALTER TABLE recipes ADD COLUMN variant_tag VARCHAR(50);  -- 'default' / 'summer' / 'winter' / 'emergency'
ALTER TABLE recipes ADD COLUMN priority INT DEFAULT 0;  -- 高 priority 优先生效

-- 或单独表 recipe_variants (更干净, 不改 recipes 语义):
CREATE TABLE recipe_variants (
  id BIGSERIAL PRIMARY KEY,
  recipe_id VARCHAR(191) REFERENCES recipes(id),
  variant_tag VARCHAR(50),  -- 'summer' / 'winter' / 'lunar-spring' ...
  ingredient_substitutes JSONB,  -- [{from: 'rm_001', to: 'rm_002', qty_ratio: 1.0}]
  effective_from DATE,
  effective_to DATE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## ETL 改动

`materialize_agg_product_cost` 在 SELECT recipe 时按 `NOW()::DATE BETWEEN effective_from AND effective_to` 匹配 variant.
如多个 variant 匹配, priority DESC 取最高.

## UI 改动

- 配方管理页加 tab "季节性配方"
- 每道菜支持 "添加季节版" 按钮 → fork 当前配方, 改食材, 设 effective_from/to
- 日期到期自动失效

## 估时

- DB schema + ETL 改动: 2h
- FE variant UI: 3h

---

# P2-9 客如云 / 美团 / 二维火 POS 对接 — Spec

## 问题

当前客户要手动导出 POS xlsx 再上传. 第三方 POS (客如云 / 美团外卖 / 二维火 / 哗啦啦) 有 OpenAPI, 可直接对接自动同步, 省掉"每日手动导出"环节.

## 阻塞

**需要凭证** — 每家 POS 厂商要在客户商家后台申请 OAuth app_id + secret. 我们不能直接做, 必须客户授权.

## 架构

```
商家 POS (客如云 etc.)
    ↓ (OAuth 授权一次)
我们的 POS 适配器 (Python service)
    ↓ (每小时 pull + webhook)
fact_pos_transaction + fact_pos_item (smartbi_prod_db)
```

### 关键设计

1. **OAuth 授权流** — 商家在 Web 端点 "连接客如云" → 跳 POS 授权页 → 回调 → 存 refresh_token
2. **菜品映射** — POS 厂商菜品 id ≠ 我们 dim_product.name. 首次同步时弹出 "菜品名映射" 向导, 客户确认字段映射.
3. **增量同步** — 按 `updated_at > last_sync_at` 拉, 避免全量. Webhook 订阅 "订单完成" 事件做实时.
4. **失败重试** — 最近 1 小时失败的单次重试, 永久失败入死信队列 + 告警.

### 3 家厂商差异

| 厂商 | OAuth | 菜品接口 | 订单接口 | 日访问限制 |
|---|---|---|---|---|
| 客如云 | v1 | GET /dish/list | GET /order/list | 10000 |
| 美团 | v2 | POS API (需单独申请) | /v1/orders (外卖 only) | 5000 |
| 二维火 | v1 | /v2/categories | /v2/orders/list | 不公开 |
| 哗啦啦 | v1 | /api/dishes | /api/orders | 3000 |

## 估时

- Adapter 框架 + OAuth 2h
- 客如云 POC (最大 POS): 6h
- 美团: 4h
- 二维火: 4h
- 哗啦啦: 留后

## 建议

**先做 1 家 (客如云)**, 跑通流程后复制到其他. 避免 4 家同时做.
对接前需要客户给授权凭证, 这是外部依赖.
