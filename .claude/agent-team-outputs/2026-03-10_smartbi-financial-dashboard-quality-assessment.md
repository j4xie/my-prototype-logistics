# SmartBI Financial Dashboard 全面质量评估报告

**日期**: 2026-03-10
**模式**: Full (3 Researchers + Analyst + Critic + Integrator)
**评估范围**: Python 后端 9 个 Builder + DataNormalizer + API + 前端 Vue 组件 + PPT 导出 + 架构

---

## Executive Summary

- **建议**: 立即修复 upload_id IDOR 漏洞(移出白名单+添加 factory_id 隔离)，并在1周内清理 Builder 边界异常和前端 ECharts 资源泄漏
- **置信度**: 高 -- 三组研究者独立发现核心问题且已代码验证
- **关键风险**: `/api/smartbi/financial-dashboard/` 在 auth 白名单中，任意用户可通过遍历 upload_id 读取其他工厂数据
- **时间线影响**: P0 安全修复约 0.5 天；P1 运行时异常修复约 2-3 天

---

## 问题优先级总览

### P0 — 立即修复 (0.5天)

| # | 问题 | 文件:行号 | 修复方案 |
|---|------|----------|---------|
| 1 | upload_id IDOR: 无 factory_id 隔离，可枚举 ID 获取他厂数据 | `auth_middleware.py:61`, `financial_dashboard.py:64-67` | 移除白名单前缀 + SQL 添加 `AND factory_id = :factory_id` |
| 2 | `variance_analysis.py` analysisContext 输出 "达成率None%" | `variance_analysis.py:264` | `achievement_rate if achievement_rate is not None else "N/A"` |

### P1 — 本周修复 (2-3天)

| # | 问题 | 文件:行号 | 修复方案 |
|---|------|----------|---------|
| 3 | 主组件缺 onUnmounted，generic charts ECharts 实例泄漏 | `FinancialDashboardPBI.vue` (无 onUnmounted) | 添加 onBeforeUnmount 遍历 chartDomRefs 调用 dispose() |
| 4 | `__FMT__` 魔法字符串在 FinancialDashboardPBI 未处理 | `FinancialDashboardPBI.vue` + `cost_flow_sankey.py:181,218` | 从 SmartBIAnalysis.vue 提取 processEChartsOptions 为共享 util |
| 5 | API 层 catch 返回 fallback 违反"禁止降级处理"原则 | `financial-dashboard.ts:104,129` | 改为 throw，由调用方处理错误 |
| 6 | `gross_margin_trend.py` 空列表 IndexError | `gross_margin_trend.py:104-113` | 添加 `if not current_margins: return empty_result` |
| 7 | `cost_flow_sankey.py` net_profit==0 悬空节点 | `cost_flow_sankey.py:124-129` | 添加 `elif net_profit == 0` 分支 |
| 8 | `GrossMarginTrendChart.vue` 无零尺寸容器检测 | `GrossMarginTrendChart.vue:198` | 与 ExpenseYoYBudgetChart 一致，添加 clientWidth/Height 检测 |
| 9 | `start_month > end_month` 无参数校验 | `financial_dashboard.py:27-28` | `Field(ge=1, le=12)` + API 层校验 |

### P2 — 下迭代改进

| # | 问题 | 文件:行号 |
|---|------|----------|
| 10 | DataNormalizer PERIOD_COL_KEYWORDS 精确匹配 → 改子字符串 | `financial_data_normalizer.py:78` |
| 11 | DataNormalizer "去年实际" 误分类(elif 优先级) | `financial_data_normalizer.py:83-91` |
| 12 | DataNormalizer data_layout 阈值 >=3 误判 2 月列 | `financial_data_normalizer.py:110` |
| 13 | PPT 缺 cost_flow_sankey/variance_analysis 中文名映射 | `ppt_generator.py:11-19` |
| 14 | PPT 空 base64 图像无占位提示 | `ppt_generator.py:95,105` |
| 15 | str(e) 信息泄露(内部工具场景降级) | `financial_dashboard.py:103,124,165,207` |
| 16 | `DashboardResponse` 接口重名 | `financial-dashboard.ts:54` vs `common.ts:229` |
| 17 | watch(charts, {deep:true}) 性能浪费 | `FinancialDashboardPBI.vue:369` |
| 18 | requestAnalysis 缺 loading 重复提交防护 | `FinancialDashboardPBI.vue:220` |
| 19 | URL.revokeObjectURL 同步调用 Safari 兼容 | `FinancialDashboardPBI.vue:323` |
| 20 | 重复函数合并 getExpenseEchartsOption/getMarginEchartsOption | `FinancialDashboardPBI.vue:338-346` |
| 21 | 错误响应格式不统一(HTTPException vs success:false) | `financial_dashboard.py` |
| 22 | _load_data 多 sheet Excel 仅取首个 | `financial_dashboard.py:75-77` |
| 23 | PresentationMode 缺 ARIA role/焦点管理 | `PresentationMode.vue:193` |
| 24 | 通用图表高度硬编码 340px | `FinancialDashboardPBI.vue:767` |

### 正面发现 (设计优良)

| 方面 | 评价 | 文件 |
|------|------|------|
| Builder 自动发现机制 | 插件式注册，新增图表只需 1 个文件 | `registry.py:102-127` |
| SQL 注入防护 | SQLAlchemy 命名参数绑定，无拼接 SQL | `financial_dashboard.py:64-66` |
| 配置管理 | pydantic-settings + lru_cache 单例 | `config.py` |
| ECharts tree-shaking | 正确按需引入，减少 ~500KB | `echarts.ts` |
| 子组件生命周期 | ExpenseYoYBudgetChart 等 4 个子组件有完整 dispose | 各组件 onUnmounted |
| 测试覆盖 | 30 个用例覆盖 9 种 Builder | `test_financial_dashboard.py` |

---

## Consensus & Disagreements

| 主题 | 最终裁定 | 说明 |
|------|---------|------|
| upload_id IDOR | **P0 确认** | 3 组一致，代码验证 |
| ECharts 泄漏范围 | **P1(范围缩小)** | Critic 发现 4 个子组件有独立 dispose，仅 generic charts 路径泄漏 |
| str(e) 严重性 | **P2 降级** | 内部工具场景，Critic 判断合理 |
| __FMT__ 处理 | **P1** | SmartBIAnalysis.vue 已有机制，FinancialDashboardPBI 未复用 |
| 空 DataFrame 归零 | **P2** | fillna(0) 在财务图表中是合理默认值 |

---

## Open Questions

1. `smart_bi_dynamic_data` 表是否有 `factory_id` 列？若无需先加列
2. `start_month > end_month` (如 10→3 跨年) 是否为合法业务场景？
3. PPT 导出是否需要请求体大小限制？
4. DataNormalizer 的真实 Excel 输入中英文月份出现频率如何？

---

## Process Note

- Mode: Full
- Researchers deployed: 3
- Total findings: 39 (13+13+13)
- Key disagreements: 3 resolved (str(e) severity, ECharts leak scope, auth fix strategy)
- Phases completed: Research → Analysis → Critique → Integration → Heal
- Healer: All checks passed ✅
