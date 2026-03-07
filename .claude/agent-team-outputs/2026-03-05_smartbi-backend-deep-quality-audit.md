# SmartBI 后端代码深度质量评估报告

**日期**: 2026-03-05
**评估范围**: Python FastAPI (`backend/python/smartbi/`) + Java Spring Boot (`backend/java/cretas-api/`) SmartBI模块
**方法**: Agent Team (3 Researcher + Analyst + Critic + Integrator)，代码实证验证

---

## Executive Summary

对SmartBI后端（Python + Java）进行深度质量评估，共发现24项问题。经交叉验证后，**真正P0仅1项**（SmartBIPublicDemoController CORS `*` + F001硬编码），**P1有3项**（/api/admin/拦截缺失、exec()执行LLM代码、RTSP SSRF）。系统作为原型项目，实际流量极低（7个测试账号），多数问题可通过配置级修改解决，无需大规模重构。核心建议：立即修复PublicDemo端点，本周补全JWT拦截路径，本月统一线程池和清理死代码。

---

## Consensus & Disagreements

| # | 问题 | 分析师 | 批评者 | 最终 | 理由 |
|---|------|--------|--------|------|------|
| 1 | SmartBIPublicDemoController CORS * + F001 | P0 | P0 | **P0** | 公开端点返回真实工厂数据，共识 |
| 2 | /api/admin/ 不在JWT拦截范围 | P0 | P1 | **P1** | Nginx不转发该路径，需直连47:10010 |
| 3 | exec()执行LLM生成代码 | P0 | P1 | **P1** | AST白名单+builtins置空+属性检查三重防护 |
| 4 | _sheet_data_cache 无界泄漏 | P0 | P2 | **P2** | 原型系统低并发，泄漏速度极慢 |
| 5 | DataFrame就地修改 | P0 | P3 | **P3** | 功能正确性问题非安全问题 |
| 6 | RTSP SSRF | P1 | P1 | **P1** | 共识，需验证内网拓扑 |
| 7 | Excel无大小限制 | P1 | P2 | **P2** | Nginx client_max_body_size已限制 |
| 8 | 7个无界线程池 + 6处裸Thread | P1 | P2 | **P2** | 低并发场景风险有限 |
| 9 | 16,300行死代码 | P2 | P2 | **P2** | 共识，维护负担非运行时风险 |
| 10 | excel.py 3100行God文件 | P2 | P2 | **P2** | 共识，架构腐化 |
| 11 | 510处except Exception | P2 | P3 | **P3** | 多数有日志记录 |
| 12 | 硬编码internal secret | P1 | P2 | **P2** | 内部通信非公开暴露 |
| 13 | 无Spring Security | P0 | P2 | **P2** | 补全addPathPatterns一行即可 |
| 14 | Java->Python统一30s超时无断路器 | P2 | P3 | **P3** | 低流量无级联风险 |

---

## Final Priority Matrix

| 优先级 | 问题 | 修复成本 | 可利用性 | 置信度 |
|--------|------|----------|----------|--------|
| **P0** | SmartBIPublicDemoController CORS * + F001 | 低 | **高** | 95% |
| **P1** | /api/admin/ JWT拦截缺失 | 极低(1行) | 中 | 85% |
| **P1** | exec()执行LLM代码 | 中 | 低 | 75% |
| **P1** | RTSP SSRF | 低 | 中 | 70% |
| **P2** | _sheet_data_cache无界 | 极低 | 低 | 90% |
| **P2** | 线程池统一 | 中 | 低 | 85% |
| **P2** | 16,300行死代码 | 中 | 无 | 90% |
| **P2** | 硬编码secret | 低 | 低 | 85% |
| **P3** | DataFrame修改/except收窄/超时断路器 | 各低-中 | 极低 | 80% |

---

## Actionable Recommendations

### 今天可做 (< 2小时)

| # | 修复项 | 时间 | 文件 |
|---|--------|------|------|
| 1 | **SmartBIPublicDemoController**: `F001`→`F_DEMO` + CORS改域名白名单 | 30min | `SmartBIPublicDemoController.java:27,41` |
| 2 | **补全JWT拦截路径**: addPathPatterns加`"/api/admin/**"` | 10min | `WebMvcConfig.java:41` |
| 3 | **验证安全组**: 确认47服务器10010端口是否对公网开放 | 15min | 阿里云控制台 |

### 本周 (1-3天)

| # | 修复项 | 时间 | 说明 |
|---|--------|------|------|
| 4 | RTSP地址白名单校验 | 2h | 禁止file://和内网IP |
| 5 | exec()替换方案评估 | 4h | 评估pandas.eval()或预定义函数映射 |
| 6 | _sheet_data_cache加TTL+maxsize | 30min | `cachetools.TTLCache(maxsize=50, ttl=3600)` |

### 本月 (1-4周)

| # | 修复项 | 时间 | 说明 |
|---|--------|------|------|
| 7 | 线程池统一 | 1-2天 | 7个无界池→共享有界池，6处裸Thread消除 |
| 8 | 死代码清理 | 2-3天 | 删除16,300行零引用代码 |
| 9 | 硬编码凭证迁移 | 1天 | internal secret→环境变量 |
| 10 | 场景检测去重 | 1天 | 4处重复逻辑合并 |

---

## Key Findings Detail

### P0: SmartBIPublicDemoController (攻击链B)

**文件**: `SmartBIPublicDemoController.java`
- Line 27: `@CrossOrigin(origins = "*")` — 允许任意域名跨域调用
- Line 41: `DEMO_FACTORY_ID = "F001"` — 硬编码真实工厂ID
- 路径 `/api/public/smart-bi` 在 `isPublicEndpoint()` 中被放行，无需任何认证

**注意**: 分析师混淆了两个Controller:
- `AIPublicDemoController` — 已正确使用 `F_DEMO` + 域名限定CORS (安全)
- `SmartBIPublicDemoController` — 使用 `F001` + CORS * (危险)

### P1: /api/admin/ 认证缺失 (攻击链A)

**文件**: `WebMvcConfig.java:41`
```java
registry.addInterceptor(jwtAuthInterceptor)
    .addPathPatterns("/api/mobile/**", "/api/platform/**")
```

受影响Controller:
- `SmartBIConfigController` → `/api/admin/smartbi-config` (意图配置CRUD)
- `BehaviorCalibrationController` → `/api/admin/calibration`
- `SyntheticDataController` → `/api/admin/synthetic`

**缓解因素**: Nginx 139网关不转发 `/api/admin/` 路径，需直连47:10010。

**新发现**: 项目无Spring Security，`@PreAuthorize`注解不会生效。但修复只需在addPathPatterns加一行。

### P1: exec() 执行LLM代码 (攻击链C)

**文件**: `data_cleaner.py:751`
```python
exec(code, safe_globals, local_namespace)
```

三重防护:
1. AST白名单: ~40种允许节点，import/importFrom被禁
2. `__builtins__ = {}`: 断绝标准逃逸路径
3. `_`前缀属性禁止: 堵住 `__class__.__subclasses__()` 链

**批评者评估**: 绕过难度高，但exec本质上不安全，应有长期替换计划。

### P1: RTSP SSRF (攻击链E)

**文件**: `multi_stream_sampler.py:197-212`
```python
cmd = [self._ffmpeg_cmd, "-i", rtsp_url, ...]  # rtsp_url未验证
subprocess.run(cmd, ...)
```
使用list形式(非shell=True)降低了注入风险，但ffmpeg支持file://协议可读本地文件。

---

## Architecture Findings

### 死代码清单 (16,300行，零import确认)

| 目录 | 行数 | 判定 |
|------|------|------|
| `services/excel/` | 2,598 | 死代码 |
| `services/field/` | 2,096 | 死代码 |
| `services/structure/` | 4,560 | 死代码 |
| `services/cache/` | 1,714 | 死代码 |
| `services/insight/` | 2,057 | 死代码 |
| `services/ml/` | 1,455 | 死代码 |
| `services/archive/` | 1,820 | 死代码 |
| **合计** | **16,300** | — |

成因: 曾尝试将flat文件重构为模块化子目录，中途放弃，保留flat版本作为实际运行代码。

### 缓存实现分散 (5套)

| 实现 | 位置 | TTL | Max Size | 淘汰 |
|------|------|-----|----------|------|
| 文件系统缓存 | `analysis_cache.py` | 无 | 500MB | 无 |
| PG数据库缓存 | `analysis_persistence.py` | 无 | 无限 | 无 |
| 内存dict | `schema_cache.py` | 无 | 无限 | 无 |
| 内存dict+LRU | `scenario_detector.py` | 无 | 100条 | access_count |
| Java PG表 | `smart_bi_analysis_cache` | 无 | 无限 | 手动 |

---

## Open Questions

1. **安全组配置**: 47服务器10010端口是否对公网开放？决定攻击链A的实际风险级别
2. **exec()触发频率**: 查看日志确认LLM代码执行路径的实际使用率
3. **RTSP功能状态**: DahuaDeviceController是否在用？废弃则直接禁用
4. **缓存命中率**: 5套缓存是否有监控？可能存在数据不一致
5. **原型→生产时间线**: 决定P2/P3问题的修复紧迫度

---

### Process Note
- Mode: Full
- Researchers deployed: 3 (Python安全性能 / Java架构线程 / 跨语言架构)
- Browser explorer: OFF
- Total findings: 31 (researchers) → 24 (analyst deduplicated) → 14 (final prioritized)
- Key disagreements: 8 resolved (Analyst偏保守, Critic基于实际部署架构降级)
- Phases completed: Research (3 parallel) → Analysis → Critique → Integration → Heal
- Fact-check: disabled (codebase-grounded, no external claims)
- Healer: all structural checks passed
- Initial audit vs final: P0从8项降至1项, P1从12项降至3项 (批评者基于Nginx/安全组/流量现实降级)
