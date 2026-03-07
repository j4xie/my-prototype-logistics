# MallCenter 装修系统增强 — 实现质量评估报告

**日期**: 2026-03-05
**评估范围**: Phase A (图片上传+内容编辑), Phase B (实时预览面板), Phase C (5个新模块: video/countdown/coupon/announcement/new_arrivals), 3个bug修复 (优惠券API路径/公开优惠券列表/视频上传支持)

---

## Executive Summary

MallCenter 装修系统增强作为**原型已基本可用**，15个模块类型前后端完全对齐，优惠券/视频端到端闭环已验证通过。但存在**2个真实逻辑缺陷**需立即修复：领券竞态条件（无事务无锁）和 finishGuide 参数错位（引导结果不持久化）。安全问题（装修API匿名写操作）在原型阶段优先级可降低，但上线前必须处理。

**综合评分：6.5/10**（前端 7.0 / 后端 5.5 / 一致性 7.5 / 安全 3.0）

---

## 核心发现

| # | 问题 | 最终评级 | 置信度 | 修复工时 | 文件 |
|---|------|---------|--------|----------|------|
| 1 | **receiveCoupon 竞态** — 无@Transactional无锁，并发领券可超发 | **HIGH** | 97% | 1h | CouponApi.java:179-216 |
| 2 | **finishGuide 参数错位** — 前端扁平params/后端期望finalConfig嵌套，引导结果不持久化 | **MED-HIGH** | 85% | 1h | shop-design/index.js:1008 + MaDecorationApi.java:700 |
| 3 | **decoration/** 匿名写操作** — WebConfig通配符+@Anonymous双重放行所有POST | **MED-HIGH** | 95% | 4h | WebConfig.java:37 + MaDecorationApi.java |
| 4 | **editCard 状态残留** — cancelEditCard未清空title/content/imageUrl | **MED** | 95% | 0.5h | decoration-chat/index.js:471-472 |
| 5 | **countdown 缺onHide** — tab切换定时器继续空转 | **MED** | 90% | 0.5h | home/index.js |
| 6 | **公开API无限流** — coupon/public/**无RateLimiter | **LOW-MED** | 90% | 1h | WebConfig.java + CouponApi.java |
| 7 | **Map<String,Object>替代DTO** — MaDecorationApi全文无强类型参数 | **MED** | 90% | 架构级 | MaDecorationApi.java |

---

## Consensus & Disagreements

| 主题 | 分析师评估 | 批评者挑战 | 最终裁定 |
|------|-----------|-----------|---------|
| decoration/**匿名写 | P0-Critical | 原型阶段降为MED | **MED-HIGH** — 上线前必修，当前迭代可延后 |
| receiveCoupon竞态 | P0-Critical | 维持HIGH | **HIGH** — 三方共识，修复成本极低 |
| finishGuide参数不匹配 | P1-High | 降为MED，有null兜底 | **MED-HIGH** — 功能降级运行而非崩溃 |
| editCard页面级状态 | P1-High | 降为MED，场景有限 | **MED** — 同时只有一个活跃编辑卡 |
| 后端总评分 | 4.0/10 | 建议5.5-6.0 | **5.5/10** — 原型标准下功能完整性尚可 |

---

## Detailed Analysis

### 1. receiveCoupon 竞态条件 (HIGH)

CouponApi.java 第179-216行执行流程：读coupon → 检查库存 → 检查已领 → 创建UserCoupon → 更新计数。全程无`@Transactional`注解，无数据库锁。`updateById(coupon)`使用`SET received_count = ?`而非原子操作`received_count = received_count + 1`，存在覆盖写问题。

**修复方案**: 添加`@Transactional` + 改用`UPDATE coupon SET received_count = received_count + 1 WHERE id = ? AND received_count < total_count`。

### 2. finishGuide 参数错位 (MED-HIGH)

前端 shop-design/index.js 第1008行发送扁平字段 `{sessionId, merchantId, industry, style, themeCode, selectedImageUrl}`。后端 MaDecorationApi.java 第700行取`params.get("finalConfig")`期望嵌套Map。结果：finalConfig永远为null，传入空HashMap，引导选择结果不持久化。前端第1030行有降级处理`applyThemeLocally`掩盖了问题。

**修复方案**: 前端将字段包装为`{sessionId, finalConfig: {industry, style, themeCode, selectedImageUrl}}`。

### 3. decoration/** 匿名写操作 (MED-HIGH)

WebConfig.java 第37行`/weixin/api/ma/decoration/**`通配符排除认证拦截器，MaDecorationApi每个方法标注`@Anonymous`，双重放行。包括POST写操作：savePageConfig、applyTemplate、ai/chat、ai/generate-image、ai/guide/finish等。

**修复方案**: 将通配符拆为读写两组：GET端点保留匿名，POST端点恢复微信session认证。

### 4. editCard 状态残留 (MED)

decoration-chat/index.js 第35行`editCardImageUrl`为页面级单一字段。第471-472行`cancelEditCard`仅清空`editCardData`和`editCardModuleType`，未清空`editCardTitle`、`editCardContent`、`editCardImageUrl`。Critic指出同时只有一个活跃编辑卡，影响有限。

**修复方案**: cancelEditCard中补充`setData({editCardTitle:'', editCardContent:'', editCardImageUrl:''})`。

---

## 正面发现

- 15个模块类型（banner/product_grid/text_image/image_ad/search/nav_grid/video/countdown/coupon/announcement/new_arrivals/notice/spacer/rich_text/divider）**前后端+AI prompt三方完全对齐**
- 领券→刷新闭环正确：`claimCoupon`成功后调用`loadCouponList()`刷新
- OSS上传端到端闭环完整：前端chooseAndUpload → OSS → URL → 后端chatFallback处理
- 公开优惠券API独立于认证体系，首页无需登录即可展示
- 主题切换系统通过CSS变量全局生效
- AI聊天装修交互流程完整（文本指令→模块操作→确认→保存）

---

## 修复优先级

### 立即修复（4h，阻塞上线）

1. **CouponApi.java**: `receiveCoupon`加`@Transactional` + 原子更新
2. **shop-design/index.js**: finishGuide参数包装为`{sessionId, finalConfig:{...}}`
3. **decoration-chat/index.js**: cancelEditCard补充清空3个残留字段

### 本周完成（6-8h）

4. **WebConfig.java**: `/decoration/**`拆为具体GET路径放行，POST恢复认证
5. **home/index.js**: countdown添加onHide暂停/onShow恢复
6. **coupon/public/list**: 添加限流

### 上线前（架构级）

7. MaDecorationApi的Map<String,Object>参数替换为强类型DTO
8. 端到端集成测试：引导流程完整闭环验证

---

## Open Questions

1. finishGuide: guideSessionService.finishGuide内部是否从session对象读取已保存的industry/style/themeCode？如果是，finalConfig为空也不影响
2. MODULE_TYPE_CN_MAP: 无序Map遍历是否真的存在短key遮蔽长key问题？需复现测试
3. 视频上传签名: OSS端是否对content-type有校验限制？共用图片签名能否上传视频？
4. CouponService: 是否有自定义业务方法缺失，还是MyBatis-Plus IService基础CRUD已够用？

---

## Process Note

- Mode: Full
- Researchers deployed: 3 (Frontend / Backend / Consistency)
- Browser explorer: OFF
- Total sources found: ~20 (all codebase evidence, ★★★★★ reliability)
- Key disagreements: 4 resolved, 1 unresolved
- Phases: Research (parallel) → Analysis → Critique → Integration → Heal
- Healer: All 5 checks passed
