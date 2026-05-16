# 多公司账套 / 多租户 — Archive (Tier 3, 推测能力, 浅 audit)

## 入口
推测: 顶部 header "宏见演示苏州李" (公司名) + login 公司编号 lyh01 → 多公司体系

## 一句话定义
一个 Hongjian 平台支持多公司 (子公司/分公司/合资企业) 独立账套 + 集团合并.

## 实测证据
- 顶部 header 显示 "宏见演示苏州李" (动态公司名)
- login 必填"公司编号" lyh01 (跟账号绑定)
- 不同公司编号 → 不同 schema / 不同数据隔离 (推测)

## 主要功能 (推测)
- 公司档案 (主公司 + N 子公司)
- 各公司独立: BOM / 产品 / 客户 / 库存 / 凭证 / 报表
- 集团合并报表 (推测有, 财务报表管理)
- 多公司间内部交易 (内部转销售/调拨)
- 多账套并存 (中国会计准则 + IFRS)
- 跨公司权限 (集团 admin 可看所有, 子公司 admin 只看自己)

## 跟 Cretas 的潜在关联
Cretas 当前是 Factory 实体 (单工厂模型). FactoryFeatureConfig 已 ship (C-FEATURE-1) 但没有"集团 + 子公司"层级:
- Cretas Factory = 宏见公司 (1:1)
- 多 Factory 之间没有"集团"父级
- 没有跨 Factory 报表合并

## 未来场景假设
- 食品集团: 总部 + N 个工厂 (六扇门 + 后续 1-2 工厂)
- 餐饮集团: 总部 + N 个门店 (QHJ 已有"门店管理"子菜单)
- 上市公司 (合并报表必需)

## Cretas 相关能力
- ✅ FactoryFeatureConfig (Cretas C-FEATURE-1) — 各工厂独立 feature flag
- ✅ JWT 含 factory_id (跨工厂数据隔离)
- ❌ 缺集团父级实体 (Group)
- ❌ 缺跨工厂报表合并

## 升级路径 (Sprint 7+ if 大集团客户)
- 加 Group 实体 (1 集团 → N Factory)
- 集团级 admin 角色
- 跨 Factory 报表 SmartBI 数据源 (合并)
- 多账套支持 (中国 GAAP + IFRS) → 跟复式记账 (P2) 配套

## 备注
- F006 单工厂, 不需要
- Cretas 长期 (Sprint 7+) 大集团客户场景
- 标 P3 / Archive
- 跟 长期待摊 / 汇率管理 / 复式记账 一组 (集团/上市公司 features)
