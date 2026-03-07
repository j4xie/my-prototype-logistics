# Round 9 深度审计 — API安全、React Native质量、生产可观测性

**日期**: 2026-03-05
**模式**: Full (3 Researchers + Analyst + Critic + Integrator)

## Executive Summary

- **建议**: 立即修复 `/api/mobile/auth/reset-password` 无认证漏洞和 `passwordHash` 字段泄露，同步部署数据库自动备份
- **置信度**: 高 — 3位研究员共识，8项代码验证确认核心发现
- **核心风险**: reset-password 端点允许任意密码重置（已代码验证：auth路径在公开白名单内，无JWT校验）
- **时间线**: Sprint 0（安全热修复）1-3天，Sprint 1（基础设施加固）1周

## Consensus & Disagreements

| 主题 | 研究员 | 分析师 | 评审员 | 最终判定 |
|------|--------|--------|--------|----------|
| A1: reset-password无认证 | P0 | Sprint 0修复 | 概率降为"中"（需猜factoryId） | **P0确认** |
| A2: @PreAuthorize失效 | P1，129处 | "安全从未实施" | 自研@RequirePermission体系存在(119处) | **P1确认但重新表述** |
| A4: passwordHash泄露 | P1 | Sprint 0修复 | 未质疑 | **P1确认** |
| B1: Token存AsyncStorage | P1 | Sprint 1修复 | 未质疑 | **P1确认** |
| C1: 无数据库自动备份 | P0 | Sprint 0部署 | 需SSH确认，宝塔可能已配 | **P0有条件** |
| C2: 凭证在Git中 | P0 | Sprint 0轮换 | Private repo下降为P1 | **P1（从P0降级）** |
| /api/internal/公网暴露 | 评审员补充 | 未提及 | P1 | **P1新增** |

## Confidence Assessment

| 结论 | 置信度 | 依据 |
|------|--------|------|
| reset-password无认证（A1） | ★★★★★ | 代码验证：isPublicEndpoint白名单 |
| @PreAuthorize无效（A2） | ★★★★★ | pom.xml无spring-security依赖 |
| passwordHash可能泄露（A4） | ★★★★★ | User.java第50行无@JsonIgnore |
| Token存储不安全（B1） | ★★★★★ | tokenManager.ts使用AsyncStorage |
| /api/internal/公网暴露 | ★★★★★ | JwtAuthInterceptor白名单 |
| 数据库无自动备份（C1） | ★★★☆☆ | 未SSH现场确认 |
| "安全从未实施" | ★☆☆☆☆ | 评审员推翻：自研体系覆盖119处 |

## Actionable Recommendations

### Immediate (Sprint 0, 1-2天)

1. **A1**: `JwtAuthInterceptor.isPublicEndpoint()` — 精确化auth白名单为login/register/refresh
2. **A4**: `User.java` passwordHash 加 `@JsonIgnore`
3. **Internal**: 移除 `/api/internal/` 白名单或加共享密钥验证

### Short-term (Sprint 1, 1周)

4. **C1**: SSH确认并部署pg_dump每日cron + OSS异地备份
5. **C2**: `git filter-repo`清洗凭证 + 轮换AccessKey/密码
6. **B1**: tokenManager.ts AsyncStorage → expo-secure-store
7. **C5**: Python日志rotation (TimedRotatingFileHandler)
8. **C6**: 生产环境关闭Swagger (docs_url=None)

### Conditional (Sprint 2-3)

9. 清理129处无效@PreAuthorize，统一为@RequirePermission
10. 清理159处as any（按模块优先级：auth > api > screens）
11. 列表页ScrollView → FlatList迁移
12. 引入Sentry + Prometheus + Grafana

## Open Questions

1. 宝塔面板是否已有PostgreSQL定时备份？
2. `http://47.100.235.168:10010/swagger-ui.html` 是否可公网访问？
3. gRPC 9090端口是否绑定localhost？
4. change-password也在auth路径下，是否有类似风险？

## Code Verification Summary

| # | 声明 | 状态 | 校正 |
|---|------|------|------|
| A1 | reset-password被白名单放行 | 确认 | 机制为auth前缀匹配 |
| A2 | @PreAuthorize完全失效 | 确认 | SecurityAutoConfiguration被排除 |
| A4 | passwordHash无@JsonIgnore | 确认 | User.java:50 |
| B1 | Token双重存储 | 确认 | tokenManager + Zustand persist |
| B3 | 283处as any | 校正 | 实际约159处 |
| C5 | Python日志无rotation | 确认 | 无RotatingFileHandler |

## Process Note
- Researchers: 3 (API Security, React Native, Production Observability)
- Total findings: 29
- Code verifications: 8 (6 confirmed, 1 corrected, 1 overturned)
- Key disagreements resolved: 3 (A2定性, C2级别, Sprint 0时间线)
- Healer: All checks passed
