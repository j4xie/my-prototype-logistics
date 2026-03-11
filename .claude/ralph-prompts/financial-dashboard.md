# SmartBI 全模块 — Ralph Loop E2E 循环指令

你是 SmartBI 智能 BI 系统的高级 QA 工程师 + UI/UX 设计师。SmartBI 共 11 个页面，按照以下 4 阶段对 **所有页面** 执行本轮迭代。

**SmartBI 页面清单** (基础 URL: `http://139.196.165.140:8086/#/smart-bi/`):

| # | 路由 | 页面名 | 核心功能 |
|---|------|--------|----------|
| 1 | `dashboard` | 经营驾驶舱 | KPI 卡片、排名表、趋势图、AI 洞察 |
| 2 | `finance` | 财务分析 | 5 模块 Tab (利润/成本/应收/应付/预算)、筛选器、动态图表 |
| 3 | `sales` | 销售分析 | 日期筛选、维度切换、KPI、排名、图表推荐 |
| 4 | `query` | AI 智能问答 | 流式聊天、模板快捷问题、图表内嵌渲染、数据源选择 |
| 5 | `query-templates` | 查询模板管理 | 模板 CRUD、分类筛选、参数配置 |
| 6 | `analysis` | 智能数据分析 | 批次选择、Sheet Tab 切换、跨 Sheet 分析、同比对比 |
| 7 | `upload` | Excel 数据导入 | 4 步向导 (上传→解析→分析→保存)、拖拽上传 |
| 8 | `data-completeness` | 数据完整度 | 模块卡片、字段级填充率表格、进度条 |
| 9 | `food-kb-feedback` | 知识库反馈 | 统计卡片、评分分布图、低分反馈表、导出 |
| 10 | `calibration` | 行为校准监控 | 校准列表、状态管理 |
| 11 | `financial-dashboard` | 财务分析看板 | 18 种图表、演示模式、书签、PPT/PDF/Excel 导出 |

---

## Phase 1: Playwright E2E 测试 (全 11 页)

使用 Playwright MCP 浏览器工具逐页面测试:

### 1.1 经营驾驶舱 (`/dashboard`)
- 导航到页面，截图整体布局
- KPI 卡片渲染检查 (趋势箭头、颜色)
- 排名表交互 (点击排名项尝试下钻)
- 趋势图 Tooltip 悬浮
- AI 洞察面板展开/折叠

### 1.2 财务分析 (`/finance`)
- 5 个 Tab 逐一切换并截图 (利润/成本/应收/应付/预算)
- 日期范围筛选器 + 维度切换 (日/周/月)
- 图表类型切换 (柱状/折线/饼图/瀑布)
- 排名表点击下钻

### 1.3 销售分析 (`/sales`)
- 日期筛选 + 维度切换
- 品类筛选下拉框
- KPI 卡片渲染
- 排名表交互
- 图表推荐功能

### 1.4 AI 智能问答 (`/query`)
- 发送测试问题 (如 "上月销售额趋势")
- 验证 SSE 流式响应逐字显示
- 快捷模板点击发送
- 数据源下拉选择切换
- 消息中图表是否正确渲染
- 清空聊天记录按钮

### 1.5 查询模板管理 (`/query-templates`)
- 搜索框输入筛选
- 分类按钮切换 (财务/销售/生产/自定义)
- 创建模板对话框 → 填写表单 → 保存
- 编辑模板 → 修改 → 保存
- 删除模板 (确认弹窗)
- "使用模板" 按钮跳转到 AI 问答

### 1.6 智能数据分析 (`/analysis`)
- 批次选择下拉框
- Sheet Tab 切换
- 数据预览表格滚动
- 跨 Sheet 分析按钮 → 弹窗
- 同比对比按钮 → 弹窗
- 洞察面板展开/折叠

### 1.7 Excel 数据导入 (`/upload`)
- 拖拽上传区域可见性
- 上传测试文件 → 解析预览
- 步骤导航 (上一步/下一步)
- 字段映射显示
- 分析结果 KPI + 图表

### 1.8 数据完整度 (`/data-completeness`)
- 汇总栏 (总完整度 %、模块数、总记录)
- 模块卡片点击 → 显示字段详情
- 字段填充率进度条和状态标签 (Good/OK/Poor)
- 刷新按钮

### 1.9 知识库反馈 (`/food-kb-feedback`)
- 统计卡片 (总量/均分/好评/差评)
- 评分分布柱状图
- 反馈类型饼图
- 低分反馈表格
- 导出功能 (日期+类型+评分筛选)

### 1.10 行为校准监控 (`/calibration`)
- 校准列表表格渲染
- 状态标签显示

### 1.11 财务分析看板 (`/financial-dashboard`)
- 期间选择器 (年/季/月)
- 18 种图表逐一截图验证 (渲染完整、无空白)
- 书签面板 (保存/加载/删除)
- 演示模式切换 (全屏幻灯片)
- 导出按钮 (PPT/PDF/Excel)
- AI 分析面板
- 条件格式设置

### 1.12 跨页面测试
- 响应式: 缩放到 768px 宽度截图 (选 3 个关键页面)
- 侧边栏菜单遍历: 逐一点击所有 SmartBI 子菜单确认路由正确

---

## Phase 2: 分析测试结果

使用 `/agent-team` 进行多角色深度评估:

```
/agent-team 分析 SmartBI 全模块 E2E 测试结果:
  - 审查所有 Phase 1 截图，识别 UI/UX 问题
  - 按页面分组汇总问题
  - 对比预期 vs 实际效果 (CODEBASE_GROUNDING=true, BROWSER_RESEARCH=true)
  - 按优先级分类:
    P0: 功能阻断 (按钮失效、渲染错误、数据不一致、路由失败)
    P1: 体验问题 (交互不流畅、响应式错位、图表空白、SSE 不流式)
    P2: 美化空间 (间距、字号、配色、动画可优化)
  - 审查上一轮修复的内容是否引入新问题
  - 输出优先级排序的问题清单和修复建议
```

---

## Phase 3: 修复问题

1. 按 agent-team 输出的 P0 → P1 → P2 顺序修复
2. **每轮最多修 5 个问题**
3. 涉及文件范围:
   - Vue 页面: `web-admin/src/views/smart-bi/*.vue`
   - Composables: `web-admin/src/views/smart-bi/composables/*.ts`
   - 组件: `web-admin/src/components/smartbi/*.vue`
   - Python 后端: `backend/python/smartbi/services/**/*.py`
   - TS 工具: `web-admin/src/utils/echarts-fmt.ts`, `echarts.ts`
   - API: `web-admin/src/api/smartbi/*.ts`
   - 路由: `web-admin/src/router/modules/smartbi.ts`
4. 修复后执行编译验证:
   ```bash
   cd web-admin && npx vite build
   ```

---

## Phase 4: 调研 + 下轮测试计划

使用 `/agent-team` 进行竞品调研和测试计划设计:

```
/agent-team SmartBI 全模块竞品调研+下轮测试计划:
  - 研究行业标杆: Power BI dashboard, Tableau, Metabase, Apache Superset UI patterns
  - 研究最佳实践: ECharts advanced tooltips, Vue 3 dashboard design, AI-powered analytics UX trends 2026
  - 浏览器探索竞品页面截图对比 (BROWSER_RESEARCH=true)
  - 对比当前 11 个页面 vs 行业标杆，找出差距
  - 审查上轮修复内容是否引入新问题
  - 输出下一轮测试重点清单:
    - 哪些页面/组件需要重点验证
    - 新发现的可优化方向
    - 上轮修复需要回归验证的点
```

---

## 完成条件

当连续一轮所有 11 个页面测试通过且无新问题时输出: `<promise>SMARTBI PERFECT</promise>`
