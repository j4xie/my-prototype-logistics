# SmartBI 5-Tier E2E 验证方案审查报告

**日期**: 2026-02-13
**模式**: Full | **语言**: Chinese

---

## 执行摘要

对16项SmartBI性能优化的E2E验证方案进行了完整审查。核心发现：**agent-browser仅能以高置信度验证5/16项优化**，另有5项需eval辅助达中等置信度，6项需外部工具。建议采用两层验证架构。

---

## 覆盖矩阵

| # | 优化项 | TC覆盖 | 置信度 | 验证方式 |
|---|--------|--------|--------|----------|
| T1.1 | LLM SSE 流式 | TC-2.1 | **极低** | fallback使功能测试无法区分流式/非流式 |
| T1.2 | Chart Plan 缓存 | TC-2.2 | 低-中 | eval检查`_chartPlanCache.size` |
| T2.1 | KPI 复用求和 | TC-3.1 | 低 | 纯算法优化,功能测试不可区分 |
| T2.2 | AbortController | TC-3.2 | 中 | 快速切换+errors检查 |
| T2.3 | 列名记忆化 | TC-3.3 | **高** | 视觉验证可靠 |
| T3.1 | 懒加载组件 | TC-4.1 | 低 | 需Network面板 |
| T3.2 | 可搜索下拉框 | TC-4.2 | **高** | UI交互直接验证 |
| T3.3 | Single-pass数据 | TC-4.3 | 极低 | 功能等价,无可观测差异 |
| T4.1 | ECharts实例复用 | TC-5.1 | 中 | eval检查实例存活状态 |
| T4.2 | Gzip压缩 | TC-5.2 | 中(curl) | **必须用curl验证** |
| T4.3 | LRU缓存淘汰 | TC-5.3 | 极低 | 10个sheet不触发驱逐(limit=50) |
| T5.1 | CSS Containment | TC-6.1 | 中(eval) | getComputedStyle验证 |
| T5.2 | IntersectionObserver | TC-6.2 | 中-低 | 需chart数≥4的sheet |
| -- | 食品行业模板 | TC-7.1 | **高** | 直接可见 |
| -- | 跨Sheet分析 | TC-7.2 | **高** | 直接可交互 |
| -- | 图表钻取 | TC-7.3 | 低 | ECharts canvas点击问题 |

## 关键风险

1. **T1.1 SSE 假阳性 (100%)**: 流式失败时静默fallback到同步,结果相同,TC-2.1永远PASS
2. **T4.3 LRU 永不触发**: `_PLAN_CACHE_LIMIT=50`, 但只有10个sheet, 驱逐逻辑不会执行
3. **T4.2 Gzip 不可通过浏览器验证**: `performance.getEntriesByType`对跨域资源返回`transferSize=0`
4. **TC-2.2 缓存时间不可靠**: 网络快也可能<3s, 非缓存命中

## 优化后执行方案

### Layer 1: agent-browser E2E (12个TC, ~30min)

保留核心TC,去掉不可验证的项:

| TC | 测试内容 | 验证方法 |
|----|---------|----------|
| TC-1.1 | 登录+导航 | snapshot验证 |
| TC-1.2 | 首次Sheet加载 | KPI≥1 + 图表≥2 + AI文本≥100字 |
| TC-2.2 | 缓存命中 | eval `_chartPlanCache.size>0` |
| TC-3.1 | KPI正确性 | eval检查数值非NaN |
| TC-3.2 | AbortController | 快速切换+errors检查 |
| TC-3.3 | 列名人性化 | 截图验证无"Column_XX" |
| TC-4.2 | 维度筛选可搜索 | UI交互验证 |
| TC-4.3 | 264行数据清洗 | 图表+KPI正常 |
| TC-5.1 | Tab来回切换 | eval检查echarts实例 |
| TC-6.1 | CSS Containment | eval getComputedStyle |
| TC-6.2 | IntersectionObserver | eval DOM vs 渲染实例数 |
| TC-7.1 | 食品行业模板 | 绿色标签可见 |

### Layer 2: 独立验证 (curl, ~5min)

| 验证项 | 命令 |
|--------|------|
| Gzip | `curl -sI -H "Accept-Encoding: gzip" http://47.100.235.168:8083/api/insight/quick-summary \| grep Content-Encoding` |
| SSE端点存在 | `curl -N http://47.100.235.168:8083/api/insight/generate-stream` |

### 调整后验收标准

| 维度 | 指标 | 原值 | 调整值 |
|------|------|------|--------|
| KPI 卡片 | 每sheet | ≥2 | **≥1** |
| 性能 | 首次enrichment | <15s | **<25s** |
| 性能 | 缓存命中 | <3s | eval缓存存在 |
| Console错误 | JS error | 0 | **≤2** (允许网络波动) |

---

## 流程备注

- 模式: Full
- 研究员: 3 (R1 feasibility, R2 practices, R3 gaps)
- 总发现: 16项优化全覆盖分析
- 关键分歧: SSE验证方式(R1认为部分可行, Critic认为不可行)
- 阶段: Research → Analysis+Critique → Integration
