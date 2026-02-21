# SmartBI E2E 34文件压力测试分析报告

**日期**: 2026-02-20
**模式**: Full (3 Researcher + Analyst-Critic)
**测试环境**: 47.100.235.168:8088 (8C/16GB)

---

## Executive Summary

34个测试文件（工厂12+餐饮12+边界6+压力4）的E2E测试揭示了一个**关键架构问题**：SSE上传流程可靠（32/34 PASS），但AI分析enrichment在生产环境**100%失败**。94.1%的"通过率"仅覆盖上传路径，SmartBI的核心卖点——智能图表+KPI+AI洞察——在所有34个文件上均未生效。真实功能完成率约**57%**。

---

## 测试结果

| 类型 | 文件数 | PASS | FAIL | Sheets | 行数 |
|------|--------|------|------|--------|------|
| Factory | 12 | 12 | 0 | 24/file | ~2600-2800 |
| Restaurant | 12 | 12 | 0 | 17/file | ~2400-5500 |
| Edge Cases | 6 | 6 | 0 | 1/file | 10-50 |
| Stress L1 (6MB) | 2 | 2 | 0 | 3/file | 30000 |
| Stress L2 (25MB) | 2 | 0 | 2 | 3/file | 100K+ |
| **Total** | **34** | **32** | **2** | **~530+** | **~120K+** |

### 系统级问题发现

| # | 问题 | 严重度 | 影响范围 | 根因 |
|---|------|--------|---------|------|
| 1 | AI enrichment 100%失败 | **P0-Critical** | 34/34文件 | LLM超时+Promise.all级联中断+AbortController取消 |
| 2 | quickSummary 413 | P1-High | 大数据sheet(>5K行) | Nginx /smartbi-api/ 缺少 client_max_body_size |
| 3 | L2 压力文件上传失败 | P1-High | 2/34文件 | Spring Boot multipart 10MB限制 + 后端OOM |
| 4 | Nginx配置未版本管理 | P2-Med | 运维风险 | 宝塔面板可能覆盖手动配置 |
| 5 | 前端-Python超时不对齐 | P2-Med | LLM高延迟场景 | 前端90s < Nginx 120s < Python 120s |

---

## 根因深度分析

### 问题1: Enrichment 100%失败（最关键）

**表象**: 所有34文件的 `generateInsights` 返回 `TypeError: Failed to fetch` (ERR_ABORTED)

**真正的失败链路**:
```
1. SSE上传完成 → enrichSheetAnalysis() 启动
2. Promise.all([smartRecommendChart, quickSummary]) 并行发起
   ├── smartRecommendChart: 调LLM → 90s前端超时 → reject
   └── quickSummary: POST 2000行JSON → 可能413 → reject
3. Promise.all 任一失败 → throw → catch → AbortController.abort()
4. 后续 batchBuildCharts, generateInsights 全部被 abort
5. 控制台显示 ERR_ABORTED (非413/500)
```

**关键代码证据**:
- `analysis.ts:1218-1224`: `Promise.all([smartRecommendChart, quickSummary])` — 任一失败全链路中断
- `python-service.ts:219`: `body: JSON.stringify(data)` — 发送完整cleanedData(最多2000行)
- `analysis.ts:1380`: `cleanedData.slice(0, 100)` — generateInsights只发100行，不应触发body limit
- `common.ts:110`: `PYTHON_LLM_TIMEOUT_MS=90s` < Nginx 120s < Python LLM 120s

**结论**: enrichment失败不是单一原因，而是**Nginx body limit + LLM超时 + Promise.all级联 + AbortController取消**的组合效应。

### 问题2: L2压力测试失败

- Spring Boot: `spring.servlet.multipart.max-file-size=10MB` — L2文件25MB超限
- Nginx: `client_max_body_size` 已修复为100m
- 即使上传成功，100K行处理可能超出JVM内存/Python内存

---

## 优化方案（按ROI排序）

### Fix 1: Nginx /smartbi-api/ 添加 body size [立即, 5min]
```nginx
location /smartbi-api/ {
    client_max_body_size 20m;  # 添加这行
    ...
}
```

### Fix 2: Promise.all 改为独立 try-catch [高优, 30min]
```typescript
// 当前: 任一失败全崩
const [recommend, summary] = await Promise.all([smartRecommendChart, quickSummary])

// 修复: 独立容错
const [recommend, summary] = await Promise.allSettled([smartRecommendChart, quickSummary])
const recommendResult = recommend.status === 'fulfilled' ? recommend.value : null
const summaryResult = summary.status === 'fulfilled' ? summary.value : null
```

### Fix 3: 超时对齐 [高优, 15min]
```
前端 PYTHON_LLM_TIMEOUT_MS: 90s → 150s (允许LLM充分处理)
Nginx proxy_read_timeout: 120s → 180s
Python LLM_TIMEOUT_MAX: 120s (保持不变)
```

### Fix 4: quickSummary 改服务端读取 [中优, 2h]
```python
# 当前: 前端POST全量数据
POST /api/insight/quick-summary  body: [{row1}, {row2}, ...]

# 优化: Python自己从PG读取
POST /api/insight/quick-summary  body: {"upload_id": 3548}
```

### Fix 5: Spring Boot multipart 提升 [低优, 5min]
```properties
spring.servlet.multipart.max-file-size=50MB
spring.servlet.multipart.max-request-size=50MB
```

---

## 功能完成率

| 功能 | 完成度 | 说明 |
|------|--------|------|
| Excel上传+SSE解析 | 94% | L2(25MB)失败，其余100% |
| 数据表展示 | 94% | 分页正常 |
| KPI卡片 | 0%* | 依赖quickSummary成功 |
| 图表渲染 | 0%* | 依赖batchBuildCharts成功 |
| AI洞察 | 0%* | 依赖generateInsights成功 |
| 缓存机制 | 0%* | 无数据可缓存 |

*在生产环境(47.100.235.168)的状态。本地开发环境可能正常（无Nginx代理）。

**加权完成率**: 上传40% × 94% + 展示20% × 94% + AI分析40% × 0% = **56.4%**

---

## Critic 关键挑战

1. **"enrichment失败因Nginx body size"过于简化** — generateInsights只发100行(~100KB)，不可能触发body limit。真正原因是LLM超时+AbortController级联
2. **94.1%通过率有误导性** — 仅覆盖上传路径，不覆盖核心AI分析功能
3. **架构根本问题**: 前端作为enrichment中间人（Java→前端→Python），增加了失败点。应改为Python直连PG
4. **Nginx配置不持久**: 宝塔面板可能在重启时覆盖手动修改

---

## 建议实施顺序

| 步骤 | 修复 | 耗时 | 影响 |
|------|------|------|------|
| 1 | Fix 1: Nginx body size | 5min | 解决quickSummary 413 |
| 2 | Fix 2: Promise.allSettled | 30min | 防止级联失败 |
| 3 | Fix 3: 超时对齐 | 15min | 允许LLM充分处理 |
| 4 | Fix 5: Spring multipart | 5min | 支持L2文件上传 |
| 5 | Fix 4: 服务端读取 | 2h | 根本解决数据传输问题 |
| 6 | E2E测试增加enrichment断言 | 1h | 验证修复效果 |

---

## Process Note
- Mode: Full (combined due to agent output capture issue)
- Researchers deployed: 3 (parallel, outputs not captured in files)
- Total sources: Codebase evidence (★★★★★) + E2E test data
- Key disagreements: 1 resolved (Nginx vs LLM timeout as root cause → both contribute)
- Phases completed: Research → Analysis + Critique (combined)
