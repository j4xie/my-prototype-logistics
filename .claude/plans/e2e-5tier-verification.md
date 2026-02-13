# SmartBI 5-Tier 优化 E2E 验证方案

## 目标
使用 agent-browser 自动化验证所有 16 项性能优化（5 个 Tier）是否正常工作，覆盖功能正确性、性能指标、回归检测。

## 测试环境
- URL: http://47.100.235.168:8088/
- 账号: factory_admin1 / 123456
- 目标页面: 智能BI → 智能数据分析
- 测试数据: Test.xlsx (11 sheets, 2213 rows)

---

## Phase 1: 基础功能验证 (Sanity Check)

### TC-1.1: 登录 + 导航到 SmartBI
```
1. agent-browser open http://47.100.235.168:8088/
2. 填写 factory_admin1 / 123456 → 登录
3. 导航到 /smart-bi/analysis
4. 验证: 11 个 sheet tab 可见
5. screenshot → screenshots/e2e-tier/01-landing.png
```

### TC-1.2: 首次 Sheet 加载 (收入及净利简表)
```
1. 点击 "收入及净利简表" tab
2. 等待 10s enrichment
3. 验证:
   - KPI 卡片 ≥ 2 个可见
   - 图表区域 ≥ 2 个图表
   - AI 分析文本非空
   - 食品行业模板栏 (绿色标签) 可见
4. screenshot --full → screenshots/e2e-tier/02-first-sheet.png
```

---

## Phase 2: Tier 1 验证 (LLM Streaming + Chart Plan Cache)

### TC-2.1: AI 分析流式输出 (T1.1)
```
1. 在 "收入及净利简表" tab 上
2. 点击 "刷新分析" 按钮 (强制重新 enrichment)
3. 观察 AI 分析区域:
   - 文本应该逐步出现 (流式)，而不是一次性加载
4. 等待 15s 完成
5. 验证: AI 分析文本 > 100 字符
6. screenshot → screenshots/e2e-tier/03-ai-streaming.png
```

### TC-2.2: Chart Plan 缓存命中 (T1.2)
```
1. 切换到 "24年返利明细" tab, 等待 8s
2. 切换回 "收入及净利简表" tab
3. 记录时间: 图表应在 <3s 内出现 (缓存命中)
4. 验证: 图表数量与首次加载一致
5. screenshot → screenshots/e2e-tier/04-cache-hit.png
```

---

## Phase 3: Tier 2 验证 (KPI Reuse + Abort + Memo)

### TC-3.1: KPI 卡片正确性 (T2.1)
```
1. 在 "收入及净利简表" tab 上
2. 检查 KPI 卡片:
   - 至少 2 个 KPI 卡片可见
   - 数值非 NaN, 非 undefined
   - 卡片有 sparkline 或趋势指示
3. screenshot → screenshots/e2e-tier/05-kpi-cards.png
```

### TC-3.2: 快速切换 Tab 取消 (T2.2 AbortController)
```
1. 快速连续点击 3 个不同的 sheet tab (间隔 <1s)
2. 等待 5s
3. 验证:
   - 最后点击的 tab 内容正确加载
   - 无 console error 关于 aborted requests
   - 页面无卡死
4. agent-browser errors → 检查无异常
5. screenshot → screenshots/e2e-tier/06-fast-switch.png
```

### TC-3.3: 列名人性化显示 (T2.3)
```
1. 在任意数据 sheet 上
2. 检查图表标题、X 轴标签:
   - "2025-01-01" 应显示为 "1月" 等人性化格式
   - 不应出现 "Column_XX" 原始名
3. 检查 KPI 卡片标签也应使用人性化名称
```

---

## Phase 4: Tier 3 验证 (Lazy Load + Filter + Single Pass)

### TC-4.1: 页面初始加载性能 (T3.1 Lazy Load)
```
1. 刷新页面 (F5)
2. 记录: 从导航到页面可交互的时间
3. 验证: 页面 <5s 内可交互
4. Network tab: 确认 SmartBIAnalysis chunk 与 DashboardBuilder chunk 分开加载
```

### TC-4.2: 维度筛选可搜索 (T3.2)
```
1. 在有图表的 sheet 上
2. 点击 "维度筛选" 下拉框
3. 验证: 下拉框有搜索输入框 (filterable)
4. 输入搜索文本 → 验证列表过滤
5. screenshot → screenshots/e2e-tier/07-filter-search.png
```

### TC-4.3: 数据清洗正确性 (T3.3)
```
1. 切换到 "2025年江苏分部利润表" (264行)
2. 等待 enrichment 完成
3. 验证:
   - 图表数据不含 NaN 或 null 异常
   - KPI 数值合理 (非全零)
   - AI 分析提到具体数字
4. screenshot → screenshots/e2e-tier/08-data-clean.png
```

---

## Phase 5: Tier 4 验证 (ECharts Reuse + Gzip + LRU)

### TC-5.1: Tab 来回切换不闪烁 (T4.1 Instance Reuse)
```
1. 从 sheet A 切换到 sheet B
2. 再从 sheet B 切换回 sheet A
3. 验证:
   - 图表出现无明显闪烁/白屏
   - 切换速度 < 2s
4. 重复 3 次来回切换
5. agent-browser errors → 无 ECharts dispose/init 错误
6. screenshot → screenshots/e2e-tier/09-tab-reuse.png
```

### TC-5.2: Gzip 压缩验证 (T4.2)
```
1. 通过 eval 在浏览器执行:
   performance.getEntriesByType('resource')
     .filter(r => r.name.includes('smartbi-api') || r.name.includes('/api/chart'))
     .map(r => ({ url: r.name.split('/').pop(), transferSize: r.transferSize, decodedSize: r.decodedBodySize }))
2. 验证: transferSize < decodedBodySize (说明启用了压缩)
3. 或者用 curl 检查 Content-Encoding: gzip header
```

### TC-5.3: 多 Sheet 遍历无内存泄漏 (T4.3 LRU)
```
1. 依次点击所有 10 个数据 sheet tab (每个等待 3s)
2. 返回第一个 sheet
3. 验证:
   - 页面仍然流畅
   - 无 "out of memory" 或性能降级
   - console 无异常
4. screenshot → screenshots/e2e-tier/10-all-sheets.png
```

---

## Phase 6: Tier 5 验证 (CSS Containment + IntersectionObserver)

### TC-6.1: 图表卡片布局稳定 (T5.1 CSS Containment)
```
1. 在有 4+ 图表的 sheet 上
2. 调整浏览器窗口大小 (resize)
3. 验证:
   - 图表不会因其他图表的 resize 而抖动
   - 布局保持 2 列 grid
4. screenshot → screenshots/e2e-tier/11-css-containment.png
```

### TC-6.2: 滚动懒加载图表 (T5.2 IntersectionObserver)
```
1. 在有 4+ 图表的 sheet 上
2. 页面顶部: 第一个图表 (hero) 应已渲染
3. 快速滚动到页面底部
4. 验证: 底部图表在滚入视口后 ~200ms 内渲染
5. 通过 eval 检查:
   document.querySelectorAll('[id^="chart-"]').length (DOM 数量)
   vs 实际已渲染的 ECharts 实例数
6. screenshot → screenshots/e2e-tier/12-lazy-render.png
```

---

## Phase 7: 回归检测 + 综合验证

### TC-7.1: 食品行业模板功能 (P1)
```
1. 验证绿色模板标签栏可见
2. 点击一个模板标签
3. 验证: 图表类型是否按模板预设生成
```

### TC-7.2: 跨 Sheet 分析 (综合分析按钮)
```
1. 点击 "综合分析" 按钮
2. 等待对话框加载
3. 验证: 综合分析图表 + AI 总结正确显示
4. screenshot → screenshots/e2e-tier/13-cross-sheet.png
```

### TC-7.3: 图表交互 (钻取 + 筛选)
```
1. 点击某个柱状图的数据点 → 验证钻取抽屉打开
2. Ctrl+Click 数据点 → 验证跨图表筛选生效
3. screenshot → screenshots/e2e-tier/14-interactions.png
```

### TC-7.4: Console 错误汇总
```
1. agent-browser errors → 收集所有页面错误
2. agent-browser console → 检查 warning/error 日志
3. 期望: 0 个 error, 0 个未捕获异常
```

---

## 验收标准

| 维度 | 指标 | 期望值 |
|------|------|--------|
| 功能完整性 | 所有 TC PASS 率 | ≥ 95% |
| KPI 卡片 | 每个数据 sheet 至少 2 个 | 20/20+ |
| 图表渲染 | 每个数据 sheet 至少 2 个 | 40/40+ |
| AI 分析 | 每个数据 sheet 有分析文本 | 10/10 |
| Console 错误 | JS error 数量 | 0 |
| Tab 切换 | 无白屏或卡死 | 0 次异常 |
| 性能 | 首次 enrichment 体感 | <15s |
| 性能 | 缓存命中 tab 切换 | <3s |

## 输出
- screenshots/e2e-tier/ 目录下 14+ 张截图
- 最终报告: PASS/FAIL 汇总 + 问题列表
