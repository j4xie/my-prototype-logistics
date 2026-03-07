# MallCenter 多租户装修系统 — 三端统一设计验证报告

**日期**: 2026-03-04
**模式**: Full | 中文 | Codebase Grounding

---

## 执行摘要

经三端代码验证，多租户隔离修复比预估更简单。**不需要** TenantContextHolder、is_system_default 迁移、或 TenantLineInnerInterceptor。核心问题是 **11 处 null 硬编码 + 2 个前端未传 merchantId**，直接替换即可。总工时约 1 个工作日。

---

## 三端架构全景

```
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  mall_admin_ui   │   │  mall_miniprogram │   │  mall_miniprogram │
│  (Vue3 管理后台)  │   │  (商家端 Chat)     │   │  (C端首页展示)     │
│  /mall/decoration│   │  decoration-chat  │   │  pages/home      │
└────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
         │                      │                      │
         │ @PreAuthorize        │ 需 JWT               │ @Anonymous (读)
         └──────────┬───────────┴──────────────────────┘
                    ▼
         ┌──────────────────────┐
         │  Java 后端 (8080)     │
         │  DecorationController │  ← 管理端 API
         │  MaDecorationApi      │  ← 小程序端 API
         │  DecorationAiService  │  ← 共享业务逻辑
         └──────────────────────┘
```

---

## 多租户隔离现状

| 层级 | 状态 | 详情 |
|------|------|------|
| Entity (MerchantPageConfig) | ✅ | merchantId Long 字段存在 |
| SQL Mapper | ✅ | WHERE 正确区分 null vs 非 null |
| 全局租户拦截器 | ❌ | 无 TenantLineInnerInterceptor（**不需要加**） |
| DecorationAiServiceImpl | ❌ | **11 处 hardcode null** |
| 小程序 decoration-chat 前端 | ❌ | 所有 API 调用不传 merchantId |
| mall_admin_ui ai-design.vue | ❌ | useRouter 未读 URL 的 merchantId 参数 |
| C 端首页 | ✅ | 不传 merchantId = 正确设计（单商户模式） |
| merchant_staff 关联表 | ✅ | 已存在 (merchant_id, user_id, role) |
| MerchantUserHelper | ✅ | WxUser→merchantId 映射完整可用 |

---

## Sprint 0 实施方案

### P0 — 核心修复（4-5h）

**1. DecorationAiServiceImpl.java — 消除 11 处 null**

| 方法 | 行号 | null 调用 |
|------|------|-----------|
| applyChatTheme() | 1981 | selectByMerchantAndPageType(null, "home") |
| addModule() | 2208, 2239 | getCurrentModules(null) + saveModulesConfig(null, ...) |
| removeModule() | 2252, 2267 | 同上 |
| updateModule() | 2281, 2296 | 同上 |
| toggleModule() | 2308, 2320 | 同上 |
| reorderModules() | 2333, 2351 | 同上 |

修复方式：所有 private 方法增加 `Long merchantId` 参数，从 `decorationChat()` 一路传递。

**2. DecorationAiService.java 接口** — 第 75 行签名改为 `decorationChat(sessionId, message, merchantId)`

**3. MaDecorationApi.java** — `decorationChat()` 从 requestBody 解析 merchantId 传入 service

**4. decoration-chat/index.js** — onLoad 读 `app.globalData.merchantId`，所有 API 调用带上（参照 shop-design/index.js:82）

### P1 — 加固（1-2h）

**5. ai-design.vue** — `useRoute()` 替换 `useRouter`，读 `route.query.merchantId`

**6. 唯一索引 DDL**
```sql
CREATE UNIQUE INDEX uq_mpc_merchant_pagetype
ON merchant_page_config (COALESCE(merchant_id, -1), page_type);
```

### 不做

| 方案 | 理由 |
|------|------|
| TenantContextHolder (ThreadLocal) | 调用链仅 3 层，直接传参即可 |
| is_system_default 迁移 | null 行天然是默认配置，C 端 fallback 自动命中 |
| TenantLineInnerInterceptor | 仅 1 张表需隔离，手动 WHERE 足够 |
| 现有数据迁移 | null 行保留不动，新数据各商户各自行 |

---

## 验证结论

| 质疑 | 结论 |
|------|------|
| C 端需不需要传 merchantId？ | 当前不需要 — 单商户模式 |
| 并发竞态？ | 修复后自动消除 — 每商户各自行 |
| 现有 null 数据？ | 保留不动 — C 端 fallback |
| 需要数据库迁移？ | 仅加唯一索引 |

---

## 修复后完整 Sprint 计划

| Sprint | 内容 | 工时 |
|--------|------|------|
| **Sprint 0** | 多租户隔离修复（本报告） | **1 天** |
| Sprint 1 | G3 预览修复 + G1 重排补全 | 1.5 天 |
| Sprint 2 | G4 店铺信息 + G2 属性编辑器 | 5-7 天 |
| Sprint 3 | G5 AI 生图 + G6 模板扩展 | 5-7 天 |
| Sprint 4 | G7 版本历史 | 4-5 天 |

---

## Process Note
- Mode: Full
- Researchers: 3 (auth infra, three-client flow, DB isolation)
- Sources: ~24 (all codebase ★★★★★)
- Key disagreements: 3 resolved (ThreadLocal/is_system_default/C-side)
- Phases: Research (×3) → Analysis+Critique → Heal
- Healer: All checks passed ✅
