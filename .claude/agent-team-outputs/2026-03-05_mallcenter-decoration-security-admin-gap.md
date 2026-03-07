# MallCenter 装修系统深度分析 — 安全隔离 + Admin UI 缺失

**生成日期**: 2026-03-05
**模式**: Full (3 Researchers + Analyst + Critic + Integrator)

---

## 一、执行摘要

装修系统存在 **P0 安全漏洞**：小程序 API 白名单将含 DB 写入的端点（ai/chat、versions/rollback、guide/finish）排除在鉴权之外，且 merchantId=null 可绕过归属校验实现跨商户篡改。Admin 后台已有管理页面框架但缺少多轮 Chat 和版本管理功能，修复安全问题优先于功能补齐。

---

## 二、安全问题分析

### 2.1 攻击路径

```
POST /weixin/api/ma/decoration/ai/chat
Body: {"message":"用生鲜模板","merchantId":任意ID}
→ SecurityConfig.java:114 — /weixin/api/** permitAll（Spring Security放行）
→ WebConfig.java:47 — /ai/chat 在 excludePathPatterns 中（拦截器放行）
→ MaDecorationApi.java:324 — @Anonymous（双重保险放行）
→ DecorationAiServiceImpl handleChatAction → applyTemplate 写入DB
→ 目标商户首页被篡改
```

### 2.2 三个已确认的 P0 漏洞

| # | 漏洞 | 代码位置 | 利用方式 |
|---|------|---------|---------|
| 1 | 白名单过度放行写入端点 | WebConfig.java:47-51 + SecurityConfig.java:114 | 无需任何认证即可调用 /ai/chat、/versions/rollback |
| 2 | merchantId=null 绕过归属校验 | DecorationAiServiceImpl.java:2665 | 传 merchantId=null 跳过 `if (merchantId != null && ...)` |
| 3 | ThirdSession 无权限校验 | ThirdSessionInterceptor.java:36-57 | 即使有 session，用户A可操作商户B的数据 |

### 2.3 白名单端点分类

**应移除的写入端点（从 excludePathPatterns 移除）**:
- `/weixin/api/ma/decoration/ai/chat` — 可触发 applyTemplate 等写入
- `/weixin/api/ma/decoration/ai/guide/**` — guide/finish 写入配置
- `/weixin/api/ma/decoration/versions/rollback` — 版本回滚

**应保留的只读端点（供小程序公开页面渲染）**:
- `/weixin/api/ma/decoration/page` — GET 读取页面配置
- `/weixin/api/ma/decoration/css-variables` — GET CSS变量
- `/weixin/api/ma/decoration/themes` — GET 主题列表
- `/weixin/api/ma/decoration/templates` — GET 模板列表
- `/weixin/api/ma/decoration/versions` — GET 版本列表
- 其他只读资源: layouts, images, icons, fonts, component-styles

---

## 三、架构一致性分析

### 3.1 两套 Controller 对比

| 维度 | Admin (DecorationController) | 小程序 (MaDecorationApi) |
|------|-----|------|
| 路径 | `/mall/decoration/*` | `/weixin/api/ma/decoration/*` |
| 认证 | Spring Security JWT + @PreAuthorize | ThirdSessionInterceptor (部分白名单) |
| AI 模式 | analyze() 单轮 | decorationChat() 多轮12种action |
| 版本管理 | **缺失** | getVersionHistory + rollbackToVersion |
| 数据表 | merchant_page_config (共享) | merchant_page_config (共享) |

### 3.2 后端 Service 复用分析

| Service 方法 | Admin 调用 | 小程序调用 | Admin 可直接复用 |
|---|---|---|---|
| analyze() | ✅ | ❌ | — |
| decorationChat() | ❌ | ✅ | ✅ |
| generateImage() | ❌ | ✅ | ✅ |
| getVersionHistory() | ❌ | ✅ | ✅ |
| rollbackToVersion() | ❌ | ✅ | ✅ |
| applyTemplate() | ❌ | ✅ | ✅ |

---

## 四、共识与分歧

### 全员共识
- 安全漏洞真实存在且为 P0
- 后端 Service 方法已就绪，Admin 端复用成本低
- 数据模型已统一（共享 merchant_page_config 表）

### 关键分歧（已解决）

| 议题 | 分析师 | 批评者 | 最终结论 |
|------|--------|--------|---------|
| 写入端点数量 | 7个 | 3-4个 | **3-4个**（/ai/chat, /guide/finish, /versions/rollback） |
| Admin 升级工期 | 12-16天(方案B) | 3-5天核心需求 | **分层：安全修复2天 + 核心功能3-5天 + 全功能可选12-16天** |
| 修复优先级 | 白名单清理优先 | Service层IDOR优先 | **并行：白名单+IDOR同时修** |

---

## 五、实施路线图

### Phase 0: 紧急安全修复（1-2天，立即执行）

**S1. WebConfig 白名单清理** (0.5天)
- 文件: `WebConfig.java:47-51`
- 从 excludePathPatterns 移除: `/ai/chat`, `/ai/guide/**`, `/versions/rollback`
- 保留只读 GET 端点

**S2. merchantId=null 绕过修复** (0.5天)
- 文件: `DecorationAiServiceImpl.java:2665`
- 改为: `if (merchantId == null || !merchantId.equals(version.getMerchantId()))`
- 同样检查 savePageConfig、decorationChat 中的 merchantId 校验

**S3. ThirdSession 提取 merchantId** (1天)
- 从 `ThirdSessionHolder.getThirdSession()` 获取用户归属 merchantId
- 写入端点强制用 session merchantId，不信任客户端传入
- 创建公共方法 `validateMerchantAccess(merchantId)`

### Phase 1: Admin 版本管理 + 预览（3-5天）

- DecorationController 新增 `GET /versions` + `POST /versions/rollback`
- 新建 `versions.vue` — el-timeline 版本历史 + 回滚按钮
- ai-design.vue 增加预览面板 — el-drawer + 模块列表可视化
- 统一模板数据源（让小程序 `getPageTemplates()` 读 DB 而非硬编码）

### Phase 2: Admin Chat 升级（可选，12-16天）

如产品需求确认 Admin 端需要多轮 Chat 交互：
- 新建 `views/mall/decoration/chat/` 目录
- 8-10 个 Vue 组件（ChatPanel, PreviewPanel, EditCard, ImageUploader 等）
- DecorationController 新增 `/ai/chat` 路由（附加 @PreAuthorize）

### Phase 3: 架构加固（长期，3-5天）

- MyBatis-Plus TenantLineInnerInterceptor
- 统一安全模型（废弃 MVC 拦截器白名单，迁移到 Spring Security Filter）
- 操作审计日志

---

## 六、开放问题

| # | 问题 | 验证方式 |
|---|------|---------|
| Q1 | Nginx 是否对 `/weixin/api/` 有额外 WAF/IP 过滤？ | 检查 Nginx 配置 |
| Q2 | ThirdSession 实体是否包含 merchantId 字段？ | 检查 ThirdSession.java |
| Q3 | merchantId 是 Long 自增还是 UUID？ | 查看 merchant 表 DDL |
| Q4 | Admin ai-design.vue 是否有实际用户使用？ | 查看 AI 会话统计 |

---

## Process Note

- Mode: Full
- Researchers deployed: 3 (安全隔离 / 架构一致性 / 实现成本)
- Browser explorer: OFF
- Total sources found: 28 codebase evidence findings
- Key disagreements: 3 resolved (写入端点数量, Admin升级工期, 修复优先级)
- Phases completed: Research → Analysis → Critique → Integration → Heal
- Fact-check: disabled (codebase-grounded analysis)
- Healer: All checks passed ✅
- Competitor profiles: N/A
