# SmartBI + Web-Admin 深度代码质量审计 Round 7

**日期**: 2026-03-05
**模式**: Full (3 Researchers + Analyst + Critic + Integrator)
**范围**: Java 后端安全 + Python 后端剩余 HIGH + Vue 前端非 SmartBI 页面 + XSS + API 一致性

---

## Executive Summary

本轮审计共发现 **26 项原始问题**，经 Critic 代码验证后 **6 项为误报**（v-html XSS 主题全面失效），最终确认 **20 项有效发现**。

关键结论：
1. **v-html XSS 主题不成立** — 全部 9 处 v-html 均已有 DOMPurify 保护
2. **Python `exec()` RCE 是唯一 P0** — `data_cleaner.py:741` 黑名单可绕过
3. **df.eval() 风险被高估** — 无外部调用链，P0→P2
4. **JWT 白名单 `contains("/upload")` 确认高危** — P1
5. **硬编码凭证 4 处** — 测试密码 123456、设备 admin/admin、Internal Key

---

## 最终优先级表 (20 项有效发现)

| # | 来源 | 发现 | 优先级 | 文件 |
|---|------|------|--------|------|
| 1 | R2-F1 | `exec()` 执行 LLM 生成代码，黑名单可绕过 | **P0** | data_cleaner.py:741 |
| 2 | R1-F7 | JWT 白名单 `contains("/upload")` 过宽 | **P1** | JwtAuthInterceptor.java:178 |
| 3 | R1-F8 | SSRF — `/probe` 端点 IP+端口无校验 | **P1** | DahuaDeviceController.java:87-109 |
| 4 | R1-F1 | 硬编码密码 `123456` | **P1** | UserIntentHandler.java:115, UserServiceImpl.java:667 |
| 5 | R1-F3 | AI 公开演示端点查 F001 真实数据 (LOW 过滤) | **P1** | AIPublicDemoController.java:58-62 |
| 6 | R1-F5 | 40+ 处 `e.getMessage()` 直接返回客户端 | **P1** | 多个 Controller |
| 7 | R1-F2 | 大华设备 `admin/admin` 硬编码 | **P2** | DahuaDeviceController.java:101-102 |
| 8 | R1-F4 | Internal API Key 硬编码 `cretas-internal-2026` | **P2** | OnboardingController.java:44 |
| 9 | R1-F6 | CORS `origins="*"` 全开放 | **P2** | AIPublicDemoController.java:49 |
| 10 | R2-F2 | `df.eval(formula)` 无验证 (无外部调用) | **P2** | fixed_executor.py:1060 |
| 11 | R2-F5 | CrossSheetCache 无并发锁 | **P2** | cross_sheet_aggregator.py:109 |
| 12 | R2-F6 | NaN 传播进 LLM prompt | **P2** | cross_sheet_aggregator.py:608-609 |
| 13 | R2-F7 | chart 5 万行无采样 | **P2** | chart/builder.py:408-432 |
| 14 | R1-F9 | OutputStream 无 try-with-resources | **P3** | ProductionPlanController, TimeClockController |
| 15 | R1-F10 | 内部接口无 IP 白名单 | **P3** | OnboardingController |
| 16 | R2-F3 | forecast ADF 检验 except:pass | **P3** | forecast_service.py:138-139 |
| 17 | R2-F4 | 旧版 forecast 无 NaN 保护 | **P3** | ml/forecast.py:105-120 |
| 18 | R2-F8 | batch_forecast 无请求量/periods 限制 | **P3** | api/forecast.py:188-209 |
| 19 | R3-F3 | ai-reports null 崩溃 | **P3** | ai-reports/index.vue:218 |
| 20 | R3-F4 | ProductionAnalysis setInterval 泄漏 | **P3** | ProductionAnalysis.vue:31 |

## 已删除的误报 (6 项)

| 来源 | 原发现 | 删除原因 |
|------|--------|---------|
| R3-F1 | CrossSheetPanel v-html XSS | 行 123 已有 DOMPurify.sanitize() |
| R3-F2 | SmartBIAnalysis v-html XSS | 行 2982 已有 DOMPurify.sanitize() |
| R3-F5 | plans/list renderMarkdown 降级 | 行 385 已有 DOMPurify.sanitize() |
| R3-F6 | CrossSheetPanel catch 静默 | 低影响代码风格问题 |
| R3-F7 | plans/list as any | TypeScript 风格问题 |
| R3-F8 | AIQuery renderMarkdown 降级 | 行 43 已有 DOMPurify.sanitize() |

---

## 修复行动计划

### Sprint 1 — P0 紧急 (1-2 天)

| 任务 | 文件 | 方案 |
|------|------|------|
| 替换 exec() 为 AST 白名单 | data_cleaner.py:741 | ast.parse() + NodeVisitor 白名单，或 RestrictedPython，或移除 LLM 代码生成 |
| JWT 白名单精确匹配 | JwtAuthInterceptor.java:178 | contains("/upload") → equals 或 startsWith 精确路径 |

### Sprint 2 — P1 高优 (1 周)

| 任务 | 文件 | 方案 |
|------|------|------|
| SSRF 防护 | DahuaDeviceController.java | 私有 IP 段白名单，拒绝 127.0.0.1/169.254.x |
| 清理硬编码密码 | UserIntentHandler/UserServiceImpl | 随机生成 + 强制改密 |
| AI 演示端点加固 | AIPublicDemoController.java | Mock 数据替代真实查询 + 速率限制 |
| 统一异常返回 | 40+ Controller | @ControllerAdvice 全局处理，隐藏 e.getMessage() |

### Sprint 3 — P2 中优 (2 周)

设备凭证迁移配置、Internal Key 环境变量化、CORS 收紧、df.eval 防御、CrossSheetCache 加锁、NaN 清洗、大数据集采样

### Sprint 4 — P3 按需

OutputStream、IP 白名单、forecast 异常处理、batch 限制、null 安全、setInterval 清理

---

## 开放问题

1. data_cleaner.py 的 LLM 规则生成是否在生产环境启用？若未启用可直接禁用
2. JWT 白名单完整审计 — 是否还有类似 contains() 过宽匹配
3. SSRF /probe 需要哪些角色权限？@PreAuthorize 情况
4. 40+ 处 e.getMessage() 中哪些会返回 SQL 异常信息
5. .env 配置优先级是否影响 data_cleaner 和 forecast 模块

---

## Critic 验证总结

| Analyst 声明 | 验证结果 |
|-------------|---------|
| CrossSheetPanel v-html 无 DOMPurify | ❌ 错误 — 行 123 已有 |
| df.eval() 是 P0 RCE | ❌ 夸大 — 无外部调用链 |
| AIPublicDemoController 完全数据泄露 | ⚠️ 部分 — 有 LOW 敏感度过滤 |
| exec() 黑名单可绕过 | ✅ 确认 — 字符串子串匹配 |
| JWT contains("/upload") 过宽 | ✅ 确认 |
| SmartBIAnalysis v-html 无防护 | ❌ 错误 — 行 2982 已有 DOMPurify |

**研究员准确率**: R1-Java 100% | R2-Python 87.5% | R3-Vue 25% (6/8 误报)

---

## Process Note
- Mode: Full (3 researchers + analyst + critic + integrator)
- Researchers deployed: 3
- Browser explorer: OFF
- Total findings: 26 raw → 20 valid (6 false positives removed by Critic)
- Key disagreements: 3 resolved (df.eval降级, demo endpoint降级, v-html主题失效)
- Phases: Research (parallel) → Analysis → Critique → Integration → Heal
- Fact-check: disabled (codebase grounding mode)
- Healer: All checks passed ✅
