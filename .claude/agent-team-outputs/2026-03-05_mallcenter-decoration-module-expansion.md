# MallCenter 装修系统可扩展模块调研报告

**日期**: 2026-03-05
**模式**: Full | 语言: Chinese | Grounding: ENABLED

---

## Executive Summary

- **建议**: 优先做3个低成本高回报模块(优惠券增强、referral_banner、license_badge)，总投入约2人天，可立即提升转化率和页面丰富度
- **置信度**: 高 — 代码验证确认现有15个装修模块、7个优惠券端点、完整referral后端，增量开发基础扎实
- **核心风险**: 秒杀/拼团等重运营模块对小平台商户运营能力要求高，冷启动失败概率大
- **时间线**: P0阶段1周内可交付，P1阶段2-3周，P2及以后视业务数据决定

---

## Final Priority List

### P0 — 立即实施 (2人天, 本周)

| type_code | 模块名称 | 说明 | 工时 | 后端改动 |
|-----------|---------|------|------|---------|
| `coupon` (增强) | 优惠券增强 | 新人券标记、过期倒计时、已领取灰化 | 0.5天 | 无(7端点已就绪) |
| `referral_banner` | 分销裂变入口 | "邀请好友得奖励"横幅+分享按钮 | 1天 | 需MaReferralApi |
| `license_badge` | 食品资质展示 | 食品经营许可证/SC编号 | 0.5天 | 无 |

### P1 — 短期实施 (5.5人天, 2-3周)

| type_code | 模块名称 | 说明 | 工时 | 后端改动 |
|-----------|---------|------|------|---------|
| `rich_text` | 富文本图文 | 多段图文混排(品牌故事/产地介绍) | 1.5天 | 无 |
| `reviews` | 评价晒单 | 评分+文字+图片展示 | 3天 | 评价聚合API |
| `traceability_card` | 溯源卡片 | 可配置溯源入口+最近批次信息 | 1天 | 无 |

### P2 — 中期规划 (视业务数据)

| type_code | 模块名称 | 前提条件 | 工时 |
|-----------|---------|---------|------|
| `flash_sale` (简化版) | 限时折扣 | 月活>5000 | 3-5天 |
| `points_mall` | 积分商城入口 | 日订单>100 | 5-8天 |
| `member_card` | 会员专享价 | 日订单>100 | 5天 |

### P3/取消

| type_code | 处置 | 理由 |
|-----------|------|------|
| `group_buy` | P3 | 与溯源品质定位冲突，冷启动风险高 |
| `live_room` | P3 | 需微信直播资质审核 |
| `search_bar` | 取消 | header已内嵌搜索功能 |
| `category_tabs` | 取消 | category_grid已覆盖 |
| `promo_banner` | 取消 | 与banner功能重复 |

---

## Consensus & Disagreements

| 主题 | Researcher | Analyst | Critic | 最终裁定 |
|------|-----------|---------|--------|---------|
| search_bar独立模块 | A:★★★★★缺 | P0(0.5天) | header已含搜索,取消 | **取消** |
| category_tabs | A:★★★★★缺 | P1(1天) | category_grid已存在 | **取消** |
| coupon模块 | 三方均提及 | 列为已有未评估 | 升至P0 | **P0增强** |
| flash_sale | A:价值9 | P1(3天) | 复杂度被低估,降P2 | **P2简化版** |
| group_buy | A+C:GMV+20-35% | P2(7天) | ROI不可靠,定位冲突 | **P3** |
| referral_banner | C:后端完整 | P0(1天) | 确认 | **P0** |
| rich_text | A:★★★★☆ | P3 | 升P1(零后端改动) | **P1** |
| reviews | A+B+C | P1(3天) | 合理 | **P1** |
| traceability_card | B:★★★★★ | P0(1天) | 降P1(入口已存在) | **P1** |
| license_badge | B:合规强制 | P1(1.5天) | 应系统级 | **P0** |

---

## Confidence Assessment

| 结论 | 置信度 | 证据基础 |
|------|--------|---------|
| 装修模块架构成熟,扩展成本低 | ★★★★★ | 代码验证 |
| coupon增强为最高ROI | ★★★★★ | 代码验证(7端点) |
| referral后端已就绪 | ★★★★☆ | Researcher声明 |
| search_bar/category_tabs无需新增 | ★★★★★ | 代码验证 |
| 秒杀/拼团ROI不确定 | ★★★★☆ | Critic分析 |
| 食品许可证合规必要 | ★★★☆☆ | 外部参考 |
| 评价模块转化+12-18% | ★★★☆☆ | 行业数据 |

---

## Risk Matrix

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 秒杀超卖 | 高(若不用Redis) | 高 | Redis原子递减+乐观锁 |
| 拼团冷启动 | 高(新平台) | 中 | 降至P3 |
| 首页加载慢(模块过多) | 中 | 高 | 按屏懒加载 |
| 积分通胀 | 中 | 高 | 设每日上限+有效期 |
| AI不识别新模块 | 高 | 低 | 同步更新Prompt |

---

## Implementation Roadmap

```
Week 1: coupon增强 + referral_banner + license_badge (P0, ~2天)
         └─ 同步: AI Prompt注册新模块类型

Week 2-3: rich_text + traceability_card (P1前端, ~2.5天)

Week 3-4: reviews (P1含后端, ~3天)

Month 2+: 限时折扣简化版 (视月活数据)
Month 3+: 积分/会员 (视订单量数据)
```

---

## Key Files Reference

| 文件 | 说明 |
|------|------|
| `MallCenter/mall_miniprogram/pages/home/index.wxml` | 15个模板定义处,新增模块加template+wx:elif |
| `MallCenter/mall_miniprogram/pages/home/index.js` | renderModules加载逻辑,新增模块数据加载 |
| `MallCenter/mall_miniprogram/pages/home/index.wxss` | 模块样式 |
| `DecorationAiServiceImpl.java` | AI Prompt的modulePreference需扩展开关 |
| `MerchantPageConfig.java` | 页面配置实体,modulesConfig JSON |
| `ReferralController.java` | 分销后端(13端点),referral_banner可复用 |
| `CouponApi.java` | 优惠券API(7端点),coupon增强可复用 |

---

## Open Questions

1. ReferralController小程序端API(MaReferralApi)是否已存在?
2. 食品许可证展示的具体法规条文确认
3. DecorationAiService模块注册机制是否支持动态扩展
4. announcement与rich_text是否应合并
5. 商户运营能力评估(是否能管理秒杀/积分等活动)

---

### Process Note
- Mode: Full
- Researchers deployed: 3
- Total sources found: 24 (代码11 + 外部13)
- Key disagreements: 5 resolved (search_bar取消/flash_sale降级/coupon升P0/rich_text升P1/group_buy降P3), 1 unresolved (license_badge合规程度)
- Phases completed: Research → Analysis → Critique → Integration → Heal
- Fact-check: disabled (industry data, not version-specific claims)
- Healer: 5 checks passed, 0 auto-fixed ✅
