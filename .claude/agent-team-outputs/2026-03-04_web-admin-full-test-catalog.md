# Web-Admin 全站 E2E 测试目录

**生成日期**: 2026-03-04
**适用系统**: 白垩纪食品溯源系统 - Web Admin 全模块
**目标 URL**: `http://139.196.165.140:8086` (Web-Admin)
**后端 API**: `http://47.100.235.168:10010` (Java 后端)
**Python API**: `http://47.100.235.168:8083` (Python 服务)
**测试账号**: `factory_admin1 / 123456` (factoryId: F001)

---

## 总览

| 维度 | 数量 |
|------|------|
| 路由页面总数 | **71** |
| 有效测试页面 | **62** (排除 5 个 stub 页面 + 4 个错误页面) |
| 测试用例总数 | **~580** |
| ECharts 图表实例 | **28** (含4个scheduling实例) |
| SSE/流式接口 | **2** |
| API 端点 | **~180+** |

### 模块分布

| # | 模块 | 页面数 | 用例数 | 图表数 | 状态 |
|---|------|--------|--------|--------|------|
| 1 | 餐饮管理 (Restaurant) | 5 | 92 | 0 | 完整 CRUD + 审批流 |
| 2 | SmartBI 智能分析 | 10 | 85 | 12+ | 上传+SSE+图表+AI聊天 |
| 3 | 数据分析 (Analytics) | 6 | 32 | 6 | 图表+KPI+告警 |
| 4 | 生产分析 (Prod Analytics) | 2 | 16 | 8 | 4图表/页 |
| 5 | Dashboard | 2 | 12 | 2 | 角色路由+统计卡片 |
| 6 | 生产管理 (Production) | 5 | 58 | 0 | 批次+计划+BOM+转换率 |
| 7 | 仓储管理 (Warehouse) | 3 | 38 | 0 | 原料+出货+盘点 |
| 8 | 调拨管理 (Transfer) | 2 | 22 | 0 | 6步工作流 |
| 9 | 质量管理 (Quality) | 2 | 16 | 0 | 质检+废弃审批 |
| 10 | 采购管理 (Procurement) | 4 | 42 | 0 | 订单+供应商+价格表 |
| 11 | 销售管理 (Sales) | 4 | 40 | 0 | 订单+发货+成品+客户 |
| 12 | 人事管理 (HR) | 4 | 32 | 0 | 员工+考勤+白名单+部门 |
| 13 | 设备管理 (Equipment) | 3 | 20 | 0 | 设备+维护(stub)+告警 |
| 14 | 财务管理 (Finance) | 3 | 22 | 0 | 成本(stub)+报表+应收应付 |
| 15 | 系统管理 (System) | 8 | 52 | 0 | 用户+角色(stub)+日志+设置+AI意图+产品+功能开关+POS |
| 16 | 智能调度 (Scheduling) | 7 | 62 | 3 | 计划+实时+人员+告警+甘特图 |
| 17 | 行为校准 (Calibration) | 2 | 28 | 2 | 会话+雷达图+趋势图 |

### Stub 页面 (仅占位，无交互)

| 页面 | 路由 | 状态 |
|------|------|------|
| 成本分析 | `/finance/costs` | el-empty "功能开发中" |
| 角色管理 | `/system/roles` | el-empty "功能开发中" |
| 维护记录 | `/equipment/maintenance` | el-empty "功能开发中" |
| 批次详情 | `/production/batches/:id` | el-empty "功能开发中" |

---

## 一、SmartBI 智能分析 (10 页面, ~85 用例)

### 1.1 经营驾驶舱 (`/smart-bi/dashboard`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-SBI-001 | 驾驶舱页面加载 | 导航至 `/smart-bi/dashboard` | 4 张 KPI 卡片 + 销售趋势图 + 饼图 + AI 洞察 + 快问按钮 | P0 |
| TC-SBI-002 | 销售趋势图渲染 | 等待 `trendChartRef` 初始化 | ECharts line 图渲染，有 series 数据，canvas 高度 >0 | P0 |
| TC-SBI-003 | 产品类别饼图渲染 | 等待 `pieChartRef` 初始化 | ECharts pie 图渲染，有 legend + data | P0 |
| TC-SBI-004 | KPI 卡片数据 | 检查 4 张 KPI 卡片 | 显示本月销售额/利润/订单数/客户数，含趋势箭头 | P1 |
| TC-SBI-005 | 数据源切换 | 从"系统数据"切换到已上传文件 | 显示"来自上传数据"标签，KPI+图表数据更新 | P1 |
| TC-SBI-006 | 刷新数据 | 点击"刷新数据"按钮 | loading 动画 → 数据重新加载 | P1 |
| TC-SBI-007 | AI 洞察面板 | 检查 AI 洞察区域 | 显示至少 1 条洞察，带 tag 类型 (success/warning/danger/info) | P1 |
| TC-SBI-008 | 快问按钮跳转 | 点击任一快问按钮如"本月销售额如何?" | 跳转至 `/smart-bi/query`，query 参数预填 | P1 |
| TC-SBI-009 | AI 问答入口 | 点击"AI 问答"按钮 | 跳转至 `/smart-bi/query` | P2 |
| TC-SBI-010 | 部门/区域排行 | 检查排行列表 | 部门业绩排行 + 区域销售排行 正确渲染 | P2 |

### 1.2 财务分析 (`/smart-bi/finance`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-SBI-011 | 财务分析页面加载 | 导航至页面 | 5 个分析 tab + KPI 卡片 + 主图表 | P0 |
| TC-SBI-012 | 主图表渲染 (利润分析) | 默认 profit tab | ECharts 图表渲染 (line/bar)，有 series 数据 | P0 |
| TC-SBI-013 | 切换分析维度 | 点击 cost/receivable/payable/budget tab | 图表类型和 KPI 切换对应，无报错 | P1 |
| TC-SBI-014 | 日期范围筛选 | 选择"最近一月" shortcut | 数据重新加载，图表更新 | P1 |
| TC-SBI-015 | 数据源切换到上传文件 | 切换 selectedDataSource | DynamicChartRenderer 替换 legacy chart | P1 |
| TC-SBI-016 | 探索图表展示 | 等待 explorationCharts | 最多 4 张推荐图表渲染 | P1 |
| TC-SBI-017 | 图表类型切换 | ChartTypeSelector 切换图表类型 | 图表重新构建，类型正确 | P2 |
| TC-SBI-018 | 查看原始数据 | 点击"查看原始数据" | 弹窗显示表格 + 分页，数据正确 | P2 |

### 1.3 销售分析 (`/smart-bi/sales`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-SBI-019 | 销售分析页面加载 | 导航至页面 | 趋势图 + 饼图 + 销售员排行表 | P0 |
| TC-SBI-020 | 销售趋势图渲染 | 等待 `sales-trend-chart` | ECharts line 多 series 图，有 area fill | P0 |
| TC-SBI-021 | 产品类别饼图渲染 | 等待 `sales-pie-chart` | ECharts pie 图渲染 | P0 |
| TC-SBI-022 | 销售员排行表 | 检查排行表 | 有排名/销售员/销售额列，数据正确 | P1 |
| TC-SBI-023 | 日期范围+类别筛选 | 选日期+选类别"冷冻肉类" | 图表+表格数据筛选更新 | P1 |
| TC-SBI-024 | 导出报表 | 点击"导出报表" | 触发下载 | P2 |
| TC-SBI-025 | 数据源动态切换 | 切换到上传文件 | DynamicChartRenderer 替换 | P2 |

### 1.4 AI 问答 (`/smart-bi/query`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-SBI-026 | AI 问答页面加载 | 导航至页面 | 显示模板卡片 + 输入框 + 发送按钮 | P0 |
| TC-SBI-027 | 发送文本查询 | 输入"本月销售额是多少"，点击发送 | SSE 流式响应，逐字显示 AI 回复 | P0 |
| TC-SBI-028 | 回复中图表渲染 | AI 返回含图表数据的回复 | 消息区内 ECharts 图表正确渲染 | P0 |
| TC-SBI-029 | 模板分类筛选 | 点击"销售分析"分类 chip | 仅显示该分类的模板卡片 | P1 |
| TC-SBI-030 | 使用模板发送 | 点击"销售趋势分析"模板卡片 | 自动填充 query 并发送 | P1 |
| TC-SBI-031 | 数据源选择器 | 切换已上传文件作为分析上下文 | 后续查询基于该文件数据 | P1 |
| TC-SBI-032 | 清空对话 | 点击"清空对话" | 聊天历史清除，回到初始界面 | P1 |
| TC-SBI-033 | 表格数据展示 | AI 返回表格型数据 | 消息中显示 el-table，有 stripe 和 border | P2 |
| TC-SBI-034 | SSE 中断恢复 | 网络中断后重试 | 自动 fallback 到 REST 接口 | P2 |
| TC-SBI-035 | Enter 键发送 | 输入框按 Enter | 触发发送（非换行） | P2 |

### 1.5 智能数据分析 + 上传 (`/smart-bi/analysis`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-SBI-036 | 上传区域展示 | 导航至页面 | 显示拖拽上传区域，支持 .xlsx/.xls | P0 |
| TC-SBI-037 | Excel 上传 + SSE 解析 | 上传测试 Excel | SSE 进度条显示，per-sheet 状态更新 | P0 |
| TC-SBI-038 | 多 Sheet Tab 切换 | 上传含多 sheet 文件 | el-tabs 显示每个 sheet，切换内容正确 | P0 |
| TC-SBI-039 | 图表渲染 (DynamicChartRenderer) | 每个 sheet 的图表区域 | 至少 1 张图表正确渲染 | P0 |
| TC-SBI-040 | 综合分析 (跨 Sheet) | 点击"综合分析" | 跨 sheet 分析弹窗，结果正确 | P1 |
| TC-SBI-041 | 同比分析 | 点击"同比分析" | YoY 比较结果展示 | P1 |
| TC-SBI-042 | 因果分析 | 点击"因果分析" | 统计分析结果展示 | P1 |
| TC-SBI-043 | 分享功能 | 点击"分享" → 生成链接 | 分享 token 生成，链接可复制 | P1 |
| TC-SBI-044 | 图表类型切换 | ChartTypeSelector 切换 | 图表重建，类型正确 | P1 |
| TC-SBI-045 | 全局筛选 | 选择 globalFilterDimension + values | 所有图表联动过滤 | P2 |
| TC-SBI-046 | 换一批图表 | 点击"换一批图表" | 推荐算法重新生成图表 | P2 |
| TC-SBI-047 | 导出 Excel/PDF | 点击导出下拉 | 文件下载成功 | P2 |
| TC-SBI-048 | 上传新文件重置 | 点击"上传新文件" | 清除当前分析，回到上传区域 | P2 |

### 1.6 Excel 分步上传 (`/smart-bi/upload`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-SBI-049 | 4 步向导展示 | 导航至页面 | 显示 4 步: 上传→解析→分析→保存 | P0 |
| TC-SBI-050 | Step 1: 数据预览 | 上传 Excel 后 | 表格显示前 5 行样本数据 | P1 |
| TC-SBI-051 | Step 2: 图表+KPI+AI 洞察 | 进入分析步骤 | KPI 卡片 + 图表 + AI 洞察面板 | P1 |
| TC-SBI-052 | Step 3: 保存结果 | 点击"保存分析结果" | 成功保存，显示后续操作按钮 | P1 |

### 1.7 查询模板管理 (`/smart-bi/query-templates`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-SBI-053 | 模板列表展示 | 导航至页面 | 显示模板卡片列表 + 分类筛选 | P1 |
| TC-SBI-054 | 新增自定义模板 | 点击"新增模板" → 填写表单 → 确定 | 新模板出现在列表中 | P1 |
| TC-SBI-055 | 编辑模板 | 点击自定义模板的"编辑" | 弹窗预填数据，修改后保存 | P1 |
| TC-SBI-056 | 删除模板 | 点击自定义模板的"删除" | 确认后模板从列表移除 | P1 |
| TC-SBI-057 | 使用模板 | 点击"使用模板" | 跳转 AI 问答并预填 query | P2 |
| TC-SBI-058 | 添加/删除参数 | 在表单中添加参数配置 | 参数行增减正确 | P2 |

### 1.8 其他 SmartBI 页面

| ID | 用例名称 | 路由 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|------|---------|---------|--------|
| TC-SBI-059 | 数据完整度页面 | `/smart-bi/data-completeness` | 导航 → 等待 | 模块卡片 + 字段完整度表格 | P2 |
| TC-SBI-060 | 知识库反馈页面 | `/smart-bi/food-kb-feedback` | 导航 → 等待 | 统计卡片 + 评分条形图 + 反馈类型饼图 | P1 |
| TC-SBI-061 | 评分分布图表渲染 | 检查 `ratingChartRef` | ECharts bar 图 (1-5 分布) | P1 |
| TC-SBI-062 | 反馈类型饼图渲染 | 检查 `typeChartRef` | ECharts pie 图 (显式/隐式/专家) | P1 |
| TC-SBI-063 | 导出 JSON | 设置筛选 → 点击"导出 JSON" | 导出结果表格显示 | P2 |
| TC-SBI-064 | 分享视图 (public) | 访问 `/smart-bi/share/:token` | 只读表格 (前 100 行)，无需登录 | P1 |

---

## 二、数据分析 (Analytics, 6 页面, ~32 用例)

### 2.1 数据分析中心 (`/analytics/overview`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-ANA-001 | 概览页面加载 | 导航至页面 | 6 组统计卡片 (生产/质量/仓储/设备/销售/成本) | P0 |

### 2.2 趋势分析 (`/analytics/trends`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-ANA-002 | 趋势页面加载 | 导航至页面 | 3 张 ECharts 图表渲染 | P0 |
| TC-ANA-003 | 生产趋势图 | 检查 `production-chart` | Line 图 + area fill (蓝色) | P0 |
| TC-ANA-004 | 质量趋势图 | 检查 `quality-chart` | Line 图 + area fill (绿色), y-max=100 | P0 |
| TC-ANA-005 | 成本趋势图 | 检查 `cost-chart` | Bar 图 (黄色) | P1 |
| TC-ANA-006 | 时间段切换 | 选择近7天/30天/90天 | 3 张图表数据同步更新 | P1 |
| TC-ANA-007 | 刷新按钮 | 点击"刷新" | loading → 数据重新加载 | P2 |

### 2.3 AI 分析报告 (`/analytics/ai-reports`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-ANA-008 | 报告列表展示 | 导航至页面 | 报告表格 + 异常列表 | P1 |
| TC-ANA-009 | 生成新报告 | 点击"生成新报告" | API 调用 → 新报告出现在列表 | P1 |
| TC-ANA-010 | 查看报告详情 | 点击行"查看" | 弹窗显示报告标题+摘要+AI分析(HTML)+建议 | P1 |
| TC-ANA-011 | 异常列表展示 | 检查异常区域 | severity tag + 异常描述 | P2 |

### 2.4 KPI 看板 (`/analytics/kpi`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-ANA-012 | KPI 看板加载 | 导航至页面 | 5 个 OEE/良品率/FPY/交付率/缺陷率 进度条 + 4 组 KPI 卡片 | P0 |
| TC-ANA-013 | 进度条状态色 | 检查各 el-progress | 达标=success, 接近=warning, 未达=exception | P1 |
| TC-ANA-014 | 刷新数据 | 点击"刷新数据" | loading → 数据更新 | P2 |

### 2.5 车间生产报表 (`/analytics/production-report`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-ANA-015 | 生产报表加载 | 导航至页面 | 横向 bar 图 + 3 张汇总卡片 | P0 |
| TC-ANA-016 | 产品产量柱状图 | 检查 `production-bar-chart` | 横向 bar 图，绿色渐变，每产品一条 | P0 |
| TC-ANA-017 | 时间段切换 | 选择今日/本周/本月/自定义 | 图表+汇总数据更新 | P1 |
| TC-ANA-018 | 自定义日期范围 | 选"自定义" → 选日期范围 | 显示 daterange picker → 数据筛选 | P2 |

### 2.6 生产异常预警 (`/analytics/alert-dashboard`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-ANA-019 | 预警看板加载 | 导航至页面 | 4 张汇总卡片 + 告警表格 + 筛选 | P0 |
| TC-ANA-020 | 手动检测 | 点击"手动检测" | API POST → 新告警出现 | P1 |
| TC-ANA-021 | 状态+级别筛选 | 选择筛选条件 | 表格过滤更新 | P1 |
| TC-ANA-022 | 确认告警 | 点击行"确认" | 状态变为"已确认" | P1 |
| TC-ANA-023 | 解决告警 | 点击行"解决" → 输入原因 | 弹窗 → 状态变为"已解决" | P1 |
| TC-ANA-024 | 告警详情抽屉 | 点击"详情" | 抽屉显示完整信息 + AI 分析 (markdown) | P2 |

---

## 三、生产分析仪表板 (2 页面, ~16 用例)

### 3.1 生产分析 (`/production-analytics/production`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-PA-001 | 生产分析页面加载 | 导航至页面 | KPI 卡片 + 4 张图表 + 产品明细表 | P0 |
| TC-PA-002 | 日产出趋势图 | 检查 `trendChartRef` | Multi-series line (产出/良品/不良) + area fill | P0 |
| TC-PA-003 | 良率趋势图 | 检查 `yieldChartRef` | Line + markLine(目标95%) + markPoint(max/min) | P0 |
| TC-PA-004 | 产品产出柱状图 | 检查 `productChartRef` | Vertical bar (紫色渐变), x-axis 30° | P1 |
| TC-PA-005 | 工序分布饼图 | 检查 `processChartRef` | Donut 饼图 (35%-65% radius) | P1 |
| TC-PA-006 | 日期范围切换 | 选择近7日/30日 | 4 图表 + KPI + 表格同步更新 | P1 |
| TC-PA-007 | 产品明细表 | 检查数据表 | 列: 产品/总产出/良品/不良/良率/报工数 | P2 |

### 3.2 人效分析 (`/production-analytics/efficiency`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-PA-008 | 人效分析页面加载 | 导航至页面 | KPI + 4 张图表 + 排名表 | P0 |
| TC-PA-009 | 人效趋势图 | 检查 `trendChartRef` | Line + area (紫色) + markLine(avg) | P0 |
| TC-PA-010 | 员工排名柱状图 | 检查 `rankingChartRef` | 横向 bar Top15, 三色分段 | P0 |
| TC-PA-011 | 产品工时柱状图 | 检查 `hoursChartRef` | Vertical bar (粉红渐变) | P1 |
| TC-PA-012 | 员工×工序热力图 | 检查 `heatmapChartRef` | Heatmap, visualMap 色阶 | P1 |
| TC-PA-013 | 日期范围切换 | 切换时间段 | 4 图 + KPI + 表同步更新 | P1 |
| TC-PA-014 | 员工排名表 | 检查数据表 | 列: 排名/姓名/产出/工时/人效/良率/出勤 | P2 |

---

## 四、Dashboard (2 组件, ~12 用例)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-DASH-001 | Dashboard 角色路由 | 以 factory_admin1 登录 → /dashboard | 根据 factoryType 加载对应 Dashboard 组件 | P0 |
| TC-DASH-002 | 餐饮 Dashboard 加载 | RESTAURANT 类型工厂 | 4 统计卡片 + 8 快捷操作 + 经营驾驶舱按钮 | P0 |
| TC-DASH-003 | 统计卡片点击跳转 | 点击"今日领料单"卡片 | 跳转 `/restaurant/requisitions` | P1 |
| TC-DASH-004 | 快捷操作导航 | 依次点击 8 项快捷操作 | 各自跳转正确路由 | P1 |
| TC-DASH-005 | 经营驾驶舱按钮 | 点击"经营驾驶舱" | 跳转 `/smart-bi/dashboard` | P1 |

---

## 五、生产管理 (5 页面, ~58 用例)

### 5.1 生产批次 (`/production/batches`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-PROD-001 | 批次列表加载 | 导航至页面 | 表格 8 列 + 搜索 + 状态筛选 + 分页 | P0 |
| TC-PROD-002 | 按批次号搜索 | 输入批次号 → 搜索 | 过滤结果正确 | P1 |
| TC-PROD-003 | 按状态筛选 | 选"生产中" → 搜索 | 仅显示 IN_PROGRESS | P1 |
| TC-PROD-004 | 分页切换 | 翻页 + 改 pageSize | 数据正确切换 | P1 |
| TC-PROD-005 | 状态标签颜色 | 检查各状态行 | 待生产=info, 生产中=warning, 已完成=success, 已取消=danger | P2 |

### 5.2 生产计划 (`/production/plans`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-PROD-006 | 计划列表加载 | 导航至页面 | 表格 + 多操作按钮 (下载模板/导入/导出/AI创建/新建) | P0 |
| TC-PROD-007 | 新建生产计划 | 点击"新建计划" → 填表 → 确定 | 弹窗 → 选产品/填数量/选日期 → 创建成功 | P0 |
| TC-PROD-008 | 导入 Excel | 点击"导入Excel" → 选文件 | 文件上传成功，计划列表刷新 | P1 |
| TC-PROD-009 | 下载模板 | 点击"下载模板" | 文件下载 | P1 |
| TC-PROD-010 | 导出 Excel | 点击"导出Excel" | 文件下载 | P1 |
| TC-PROD-011 | 开始计划 | 行内"开始" (PLANNED→IN_PROGRESS) | 确认弹窗 → 状态更新 | P0 |
| TC-PROD-012 | 完成计划 | 行内"完成" → 输入实际产量 | prompt → 状态更新 | P0 |
| TC-PROD-013 | 取消计划 | 行内"取消" → 输入原因 | prompt → 状态更新 | P1 |
| TC-PROD-014 | 转为批次 | 行内"转为批次" | 确认 → 调用 API | P1 |
| TC-PROD-015 | AI 对话创建 | 点击"AI对话创建" → 抽屉打开 → 输入消息 | 发送消息 → AI 回复 → 操作按钮 | P1 |
| TC-PROD-016 | 来源类型标签 | 检查 sourceType 列 | Excel导入=warning, AI创建=success, 手动=default | P2 |

### 5.3 转换率配置 (`/production/conversions`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-PROD-017 | 转换率列表加载 | 导航至页面 | 表格 + 搜索 + 分页 | P0 |
| TC-PROD-018 | 新增转换率 | 点击"新增配置" → 选原料+产品+填转换率 → 确定 | 弹窗 → 创建成功 | P0 |
| TC-PROD-019 | 编辑转换率 | 行内"编辑" → 修改 → 确定 | 数据更新 | P1 |
| TC-PROD-020 | 删除转换率 | 行内"删除" → 确认 | 行从表格移除 | P1 |

### 5.4 BOM 成本管理 (`/production/bom`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-PROD-021 | BOM 页面加载 | 导航至页面 | 产品选择器 + 3 个表格 (原料/人工/均摊) + 成本汇总 | P0 |
| TC-PROD-022 | 选择产品 | 选择一个产品 | 3 表 + 成本汇总加载 | P0 |
| TC-PROD-023 | 添加 BOM 原料 | 点击 BOM 表"添加" → 填表 → 确定 | 行新增到 BOM 表 | P0 |
| TC-PROD-024 | 编辑 BOM 原料 | 行内"编辑" → 修改 → 确定 | 数据更新 | P1 |
| TC-PROD-025 | 删除 BOM 原料 | 行内"删除" → 确认 | 行移除 | P1 |
| TC-PROD-026 | 添加人工费用 | 人工表"添加" → 填工序+单价 → 确定 | 创建成功 | P1 |
| TC-PROD-027 | 添加均摊费用 | 均摊表"添加" → 填名称+价格 → 确定 | 创建成功 | P1 |
| TC-PROD-028 | 成本汇总计算 | 添加数据后 | 原料成本+人工成本+均摊=总成本 | P1 |

---

## 六、仓储管理 (3 页面, ~38 用例)

### 6.1 原料批次 (`/warehouse/materials`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-WH-001 | 原料列表加载 | 导航至页面 | 表格 9 列 + 搜索 + 分页 | P0 |
| TC-WH-002 | 搜索原料 | 输入批次号/名称 → 搜索 | 过滤正确 | P1 |
| TC-WH-003 | 状态标签 | 检查各状态 | 可用=success, 已预留=warning, 已耗尽=info, 已过期=danger | P2 |

### 6.2 出货管理 (`/warehouse/shipments`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-WH-004 | 出货列表加载 | 导航至页面 | 表格 + 搜索 + 状态筛选 | P0 |
| TC-WH-005 | 新建出货 | 点击"新建出货" → 选客户+批次+填数量 → 确定 | 弹窗 → 创建成功 | P0 |
| TC-WH-006 | 查看出货详情 | 行内"查看" | 抽屉显示 10 项描述 | P1 |
| TC-WH-007 | 发货操作 | 行内"发货" (PENDING) | 确认 → 状态变"运输中" | P0 |
| TC-WH-008 | 送达确认 | 行内"送达" (SHIPPED) | 确认 → 状态变"已送达" | P0 |
| TC-WH-009 | 取消出货 | 行内"取消" → 输入原因 | prompt → 状态变"已取消" | P1 |
| TC-WH-010 | 完整出货流程 | 新建→发货→送达 | 状态: 待发货→运输中→已送达 | P0 |

### 6.3 库存盘点 (`/warehouse/inventory`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-WH-011 | 库存页面加载 | 导航至页面 | 4 统计卡片 + 表格 + 9 种状态筛选 | P0 |
| TC-WH-012 | 统计卡片 | 检查 4 张卡片 | 批次总数/库存总量/低库存预警(黄)/即将过期(红) | P0 |
| TC-WH-013 | 导出报告 | 点击"导出报告" | Excel 文件下载 | P1 |
| TC-WH-014 | 调整库存 | 行内"调整" → 填数量+原因 → 确定 | 库存数量更新 | P0 |
| TC-WH-015 | 查看批次详情 | 行内"查看" | 弹窗显示 13 字段 + 调整历史子表 | P1 |
| TC-WH-016 | 过期日期颜色 | 检查过期日期列 | 已过期=红, ≤30天=橙, ≤60天=灰 | P2 |
| TC-WH-017 | 多状态筛选 | 选择各状态值 | 表格过滤正确 (9 种状态) | P1 |

---

## 七、调拨管理 (2 页面, ~22 用例)

| ID | 用例名称 | 路由 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|------|---------|---------|--------|
| TC-TF-001 | 调拨列表加载 | `/transfer/list` | 导航至页面 | 表格 + 方向/状态 tag + 分页 | P0 |
| TC-TF-002 | 方向标签 | 列表 | 检查方向列 | 调出=danger, 调入=success | P1 |
| TC-TF-003 | 8 种状态标签 | 列表 | 检查状态列 | 草稿/已申请/已批准/已驳回/已发运/已签收/已确认/已取消 | P1 |
| TC-TF-004 | 进入详情 | 行"详情" | 跳转 `/transfer/:id`，显示步骤条+描述+物品表 | P0 |
| TC-TF-005 | 6 步工作流 | 详情页 | el-steps 显示 6 步状态 | P0 |
| TC-TF-006 | 提交申请 | DRAFT → 点"提交申请" | 确认 → 状态变 REQUESTED | P0 |
| TC-TF-007 | 审批通过 | REQUESTED → 点"审批通过" | 确认 → 状态变 APPROVED | P0 |
| TC-TF-008 | 驳回 | REQUESTED → 点"驳回" | 确认 → 状态变 REJECTED | P1 |
| TC-TF-009 | 确认发运 | APPROVED + 调出方 → 点"确认发运" | 确认 → 状态变 SHIPPED | P1 |
| TC-TF-010 | 确认签收 | SHIPPED + 调入方 → 点"确认签收" | 确认 → 状态变 RECEIVED | P1 |
| TC-TF-011 | 确认入库 | RECEIVED + 调入方 → 点"确认入库" | 确认 → 状态变 CONFIRMED | P1 |
| TC-TF-012 | 完整调拨流程 | 详情页 | 草稿→申请→批准→发运→签收→确认 | P0 |
| TC-TF-013 | 物品表展示 | 详情页 | 类型 tag + 品名 + 数量 + 单价 + 小计 | P2 |

---

## 八、质量管理 (2 页面, ~16 用例)

| ID | 用例名称 | 路由 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|------|---------|---------|--------|
| TC-QA-001 | 质检列表加载 | `/quality/inspections` | 导航至页面 | 表格 8 列 + 搜索 + 结果筛选 | P0 |
| TC-QA-002 | 按结果筛选 | 选"合格" → 搜索 | 仅 PASSED 行 | P1 |
| TC-QA-003 | 结果标签 | 检查 result 列 | 合格=success, 不合格=danger | P1 |
| TC-QA-004 | 废弃列表加载 | `/quality/disposals` | 导航至页面 | 表格 + 搜索 + 状态筛选 | P0 |
| TC-QA-005 | 新建废弃申请 | 点击"新建申请" → 选批次+类型+填数量+原因 → 提交 | 弹窗 → 创建成功 | P0 |
| TC-QA-006 | 批准废弃 | 行内"批准" (PENDING) | 确认 → 状态变"已批准" | P0 |
| TC-QA-007 | 拒绝废弃 | 行内"拒绝" → 输入原因 | prompt → 状态变"已拒绝" | P1 |
| TC-QA-008 | 废弃类型标签 | 检查 disposalType 列 | 过期/损坏/质量问题/其他 | P2 |

---

## 九、采购管理 (4 页面, ~42 用例)

### 9.1 采购订单 (`/procurement/orders`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-PO-001 | 采购订单列表加载 | 导航至页面 | 表格 + 状态筛选 + 分页 | P0 |
| TC-PO-002 | 新建采购订单 | 点击"新建" → 选供应商+类型+添加行项 → 创建 | 弹窗 720px → 创建成功 | P0 |
| TC-PO-003 | 动态行项添加/删除 | 添加行 → 删除行 | 行增减正确，最少保留 1 行 | P1 |
| TC-PO-004 | 提交采购订单 | 行内"提交" (DRAFT) | 确认 → 状态变"已提交" | P0 |
| TC-PO-005 | 审批采购订单 | 行内"审批" (SUBMITTED) | 确认 → 状态变"已审批" | P0 |
| TC-PO-006 | 取消采购订单 | 行内"取消" (DRAFT/SUBMITTED) | 确认 → 状态变"已取消" | P1 |
| TC-PO-007 | 进入订单详情 | 行"详情" | 跳转详情页 | P1 |

### 9.2 采购订单详情 (`/procurement/orders/:id`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-PO-008 | 详情页加载 | 导航至页面 | 描述区 + 行项表 + 收货记录表 | P0 |
| TC-PO-009 | 收货操作 | 点击"收货" → 填各行收货数量 → 创建收货单 | 弹窗 640px → 收货单创建成功 | P0 |
| TC-PO-010 | 确认入库 | 收货记录行"确认入库" (DRAFT) | 确认 → 收货状态更新 | P1 |
| TC-PO-011 | 完整采购流程 | 创建→提交→审批→收货→确认入库 | 全流程状态正确 | P0 |

### 9.3 供应商管理 (`/procurement/suppliers`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-PO-012 | 供应商列表加载 | 导航至页面 | 表格 + 搜索 + 分页 | P0 |
| TC-PO-013 | 搜索供应商 | 输入关键词 → 搜索 | 过滤正确 | P1 |
| TC-PO-014 | 状态标签 | 检查状态列 | 合作中=success, 已停用=info | P2 |

### 9.4 价格表 (`/procurement/price-lists`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-PO-015 | 价格表列表加载 | 导航至页面 | 表格 (可展开) + 分页 | P0 |
| TC-PO-016 | 新建价格表 | 点击"新建" → 填名称+类型+日期+添加行 → 创建 | 弹窗 720px → 创建成功 | P0 |
| TC-PO-017 | 展开行查看明细 | 点击展开图标 | 子表显示品名/单位/标准价/最低价/最高价 | P1 |
| TC-PO-018 | 删除价格表 | 行"删除" → 确认 | 从表格移除 | P1 |

---

## 十、销售管理 (4 页面, ~40 用例)

### 10.1 销售订单 (`/sales/orders`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-SALE-001 | 销售订单列表加载 | 导航至页面 | 表格 + 状态筛选 + 分页 | P0 |
| TC-SALE-002 | 新建销售订单 | 点击"新建" → 选客户+产品行+数量+价格 → 创建 | 弹窗 720px → 创建成功 | P0 |
| TC-SALE-003 | 确认销售订单 | 行"确认" (DRAFT) | 确认 → 状态变"已确认" | P0 |
| TC-SALE-004 | 取消销售订单 | 行"取消" | 确认 → 状态变"已取消" | P1 |

### 10.2 销售订单详情 (`/sales/orders/:id`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-SALE-005 | 详情页加载 | 导航至页面 | 描述区 + 产品表 + 发货记录表 | P0 |
| TC-SALE-006 | 创建发货单 | 点击"发货" → 填发货数量+物流 → 创建 | 弹窗 640px → 发货单创建 | P0 |
| TC-SALE-007 | 发货操作 | 发货记录"发货" (DRAFT/PICKED) | 确认 → 状态变"已发货" | P0 |
| TC-SALE-008 | 签收确认 | 发货记录"签收" (SHIPPED) | 确认 → 状态变"已签收" | P1 |
| TC-SALE-009 | 完整销售流程 | 创建→确认→发货→发运→签收 | 全流程正确 | P0 |

### 10.3 成品库存 (`/sales/finished-goods`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-SALE-010 | 成品列表加载 | 导航至页面 | 表格 + 可用数量计算 + 分页 | P0 |
| TC-SALE-011 | 库存状态标签 | 检查各行 | 已售罄=danger, 库存低=warning, 充足=success | P1 |
| TC-SALE-012 | 可用数量计算 | 检查 available 列 | = 生产量 - 已发 - 预留, ≤0 红色 | P1 |

### 10.4 客户管理 (`/sales/customers`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-SALE-013 | 客户列表加载 | 导航至页面 | 表格 + 搜索 + 分页 | P0 |
| TC-SALE-014 | 搜索客户 | 输入关键词 → 搜索 | 过滤正确 | P1 |

---

## 十一、人事管理 (4 页面, ~32 用例)

### 11.1 员工管理 (`/hr/employees`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-HR-001 | 员工列表加载 | 导航至页面 | 表格 + 14 种角色 tag + 分页 | P0 |
| TC-HR-002 | 角色标签展示 | 检查各行 | 14 种角色 tag 正确映射 | P1 |

### 11.2 考勤记录 (`/hr/attendance`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-HR-003 | 考勤页面加载 | 导航至页面 | 4 统计卡片 + 表格 + 搜索+日期+状态筛选 | P0 |
| TC-HR-004 | 统计卡片 | 检查 4 张卡片 | 总记录/正常出勤(绿)/迟到早退(黄)/缺勤(红) | P0 |
| TC-HR-005 | 日期范围筛选 | 选择日期范围 → 搜索 | 过滤正确 | P1 |
| TC-HR-006 | 状态筛选 | 选"迟到" → 搜索 | 仅显示迟到记录 | P1 |
| TC-HR-007 | 考勤状态标签 | 检查状态列 | 10 种状态各自颜色 tag | P2 |

### 11.3 白名单管理 (`/hr/whitelist`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-HR-008 | 白名单页面加载 | 导航至页面 | 3 统计卡片 + 表格 + 搜索 | P0 |
| TC-HR-009 | 添加白名单 | 点击"添加白名单" → 填手机号+姓名+角色 → 确定 | 弹窗 500px → 创建成功 | P0 |
| TC-HR-010 | 编辑白名单 | 行内"编辑" (未使用) → 修改 → 确定 | 数据更新，手机号不可改 | P1 |
| TC-HR-011 | 删除白名单 | 行内"删除" (未使用) → 确认 | 从表格移除 | P1 |
| TC-HR-012 | 状态标签 | 检查各行 | 已使用=success, 已过期=danger, 待使用=info | P2 |

### 11.4 部门管理 (`/hr/departments`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-HR-013 | 部门列表加载 | 导航至页面 | 表格 + 搜索 + 分页 | P0 |
| TC-HR-014 | 新建部门 | 点击"新建部门" → 填名称+编码+选上级+选负责人 → 确定 | 弹窗 500px → 创建成功 | P0 |
| TC-HR-015 | 编辑部门 | 行内"编辑" → 修改 → 确定 | 数据更新 | P1 |
| TC-HR-016 | 删除部门 | 行内"删除" → 确认 | 从表格移除 | P1 |

---

## 十二、设备管理 (3 页面, ~20 用例)

| ID | 用例名称 | 路由 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|------|---------|---------|--------|
| TC-EQ-001 | 设备列表加载 | `/equipment/list` | 导航至页面 | 表格 + 搜索 + 4 种状态 tag + 分页 | P0 |
| TC-EQ-002 | 搜索设备 | 列表 | 输入设备号/名称 → 搜索 | 过滤正确 | P1 |
| TC-EQ-003 | 状态标签 | 列表 | 检查各行 | 运行中=success, 空闲=info, 维护中=warning, 故障=danger | P2 |
| TC-EQ-004 | 维护记录页面 | `/equipment/maintenance` | 导航 | 显示 el-empty "功能开发中" | P2 |
| TC-EQ-005 | 告警页面加载 | `/equipment/alerts` | 导航至页面 | 4 统计卡片 + 表格 + 搜索+严重度+状态筛选 | P0 |
| TC-EQ-006 | 统计卡片 | 告警页 | 检查 4 卡片 | 总告警(蓝)/严重(红)/警告(黄)/已处理(绿) | P0 |
| TC-EQ-007 | 确认告警 | 告警页 | 行内"确认" (ACTIVE) | 确认 → 状态变"已确认" | P0 |
| TC-EQ-008 | 处理告警 | 告警页 | 行内"处理" → 输入描述 | prompt → 状态变"已处理" | P0 |
| TC-EQ-009 | 告警类型展示 | 告警页 | 检查类型列 | 6 种: 温度异常/振动异常/电力异常/设备故障/维护到期/其他 | P2 |
| TC-EQ-010 | 严重度+状态筛选 | 告警页 | 组合筛选 → 搜索 | 过滤正确 | P1 |

---

## 十三、财务管理 (3 页面, ~22 用例)

| ID | 用例名称 | 路由 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|------|---------|---------|--------|
| TC-FIN-001 | 成本分析页面 | `/finance/costs` | 导航 | 显示 el-empty "功能开发中" | P2 |
| TC-FIN-002 | 财务报表加载 | `/finance/reports` | 导航至页面 | 4 统计卡片 + 成本分解表 + 日期筛选 + 导出 | P0 |
| TC-FIN-003 | 日期范围选择 | 报表页 | 选择"最近一月" shortcut | 数据重新加载 | P1 |
| TC-FIN-004 | 导出报表 | 报表页 | 点击"导出报表" | 文件下载 | P1 |
| TC-FIN-005 | 成本分解表 | 报表页 | 检查表格 | 类型/金额/占比(el-progress) 正确显示 | P1 |
| TC-FIN-006 | 应收应付页加载 | `/finance/ar-ap` | 导航至页面 | 4 tabs + 统计卡片 + 刷新 | P0 |
| TC-FIN-007 | 财务概览 tab | ar-ap 页 | 检查默认 tab | 4 卡片: 应收/应付/净额/逾期 | P0 |
| TC-FIN-008 | 应收账款 tab | ar-ap 页 | 切换到"应收账款" | 交易明细表 + 分页，type tag 正确 | P1 |
| TC-FIN-009 | 应付账款 tab | ar-ap 页 | 切换到"应付账款" | 交易明细表 + 分页 | P1 |
| TC-FIN-010 | 账龄分析 tab | ar-ap 页 | 切换到"账龄分析" | 应收/应付 radio 切换 + 账龄表格，>180天红色 | P1 |
| TC-FIN-011 | 账龄类型切换 | ar-ap 页 | 切换应收↔应付 | 表格数据切换 | P2 |
| TC-FIN-012 | 交易分页 | ar-ap 页 | 翻页 + 改 pageSize | 正确切换 | P2 |

---

## 十四、系统管理 (8 页面, ~52 用例)

### 14.1 用户管理 (`/system/users`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-SYS-001 | 用户列表加载 | 导航至页面 | 表格 + 搜索+角色筛选 + 分页 | P0 |
| TC-SYS-002 | 添加用户 | 点击"添加用户" → 填用户名/密码/姓名/角色 → 确认创建 | 弹窗 500px → 创建成功 | P0 |
| TC-SYS-003 | 用户名校验 | 输入不合法用户名 (如中文/特殊字符) | 校验失败提示 (3-20位字母数字下划线) | P1 |
| TC-SYS-004 | 启用/禁用 switch | 切换用户状态 switch | 调用 activate/deactivate API | P0 |
| TC-SYS-005 | 按角色筛选 | 选择角色 → 搜索 | 过滤正确 (14 种角色) | P1 |
| TC-SYS-006 | 按用户名搜索 | 输入用户名 → 搜索 | 过滤正确 | P1 |

### 14.2 操作日志 (`/system/logs`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-SYS-007 | 日志列表加载 | 导航至页面 | 表格 + 4 维筛选 (类型/级别/日期/关键词) | P0 |
| TC-SYS-008 | 日志类型筛选 | 选"ERROR" → 搜索 | 仅显示 ERROR 类型 | P1 |
| TC-SYS-009 | 日期范围筛选 | 选日期范围 → 搜索 | 过滤正确 | P1 |
| TC-SYS-010 | 状态码标签 | 检查 responseStatus 列 | <400=success, ≥400=danger | P2 |
| TC-SYS-011 | 慢请求标记 | 检查 executionTime 列 | >3000ms 红色 .slow class | P2 |

### 14.3 系统设置 (`/system/settings`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-SYS-012 | 设置页面加载 | 导航至页面 | 4 tabs: 基础/通知/安全/系统状态 | P0 |
| TC-SYS-013 | 保存基础设置 | 修改工厂名称 → 保存 | 保存成功提示 | P1 |
| TC-SYS-014 | 通知 switch 切换 | 切换邮件/短信/告警通知 | switch 状态改变 | P1 |
| TC-SYS-015 | 安全设置保存 | 修改密码最小长度 → 保存 | 保存成功 | P1 |
| TC-SYS-016 | 系统状态展示 | 切换到"系统状态" tab | 版本/状态/备份/DB大小 正确显示 | P2 |

### 14.4 AI 意图配置 (`/system/ai-intents`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-SYS-017 | AI 意图列表加载 | 导航至页面 | 表格 + 4 维筛选 + 启用 switch | P0 |
| TC-SYS-018 | 启用/禁用意图 | 切换意图 switch | API 调用 toggle | P1 |
| TC-SYS-019 | 查看意图详情 | 行内"详情" | 抽屉 500px: 基本信息+关键词 tag+负向关键词+角色 | P1 |
| TC-SYS-020 | 按分类筛选 | 选择分类 → 搜索 | 过滤正确 | P1 |
| TC-SYS-021 | 敏感度标签 | 检查列 | LOW=success, MEDIUM=warning, HIGH=danger, CRITICAL=紫色 | P2 |

### 14.5 产品管理 (`/system/products`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-SYS-022 | 产品列表加载 | 导航至页面 | 5 分类 tab + 表格 + 搜索 + 分页 | P0 |
| TC-SYS-023 | 新增产品 | 点击"新增产品" → 填编号/名称/类别/单位 → 确定 | 弹窗 600px → 创建成功 | P0 |
| TC-SYS-024 | 分类 tab 切换 | 切换成品/原料/包辅材/调味品/客户自带 | 表格数据按类别刷新 | P1 |
| TC-SYS-025 | 编辑产品 | 行内"编辑" → 修改 → 确定 | 数据更新，编号不可改 | P1 |
| TC-SYS-026 | 删除产品 | 行内"删除" → 确认 | 从表格移除 | P1 |
| TC-SYS-027 | 图片预览 | 点击表格中图片 | 全屏预览 (el-image preview) | P2 |

### 14.6 功能开关 (`/system/features`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-SYS-028 | 功能开关页面加载 | 导航至页面 | 10 模块卡片 + 启用 switch | P0 |
| TC-SYS-029 | 启用/禁用模块 | 切换模块 switch | API toggle 调用 | P1 |
| TC-SYS-030 | 配置详情抽屉 | 点击"配置详情" | 抽屉 480px: 禁用屏幕+快捷操作+报表 checkbox | P1 |
| TC-SYS-031 | 保存配置 | 修改 checkbox → 保存 | 保存成功 | P1 |
| TC-SYS-032 | 初始化默认配置 | 无配置时点击"初始化默认配置" | 确认 → 10 模块卡片出现 | P2 |

### 14.7 POS 连接 (`/system/pos`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-SYS-033 | POS 连接页面加载 | 导航至页面 | 连接卡片列表 + 新建按钮 | P0 |
| TC-SYS-034 | 新建 POS 连接 | 点击"新建连接" → 选品牌+填 AppKey+Secret+门店ID → 创建 | 弹窗 520px → 创建成功 | P0 |
| TC-SYS-035 | 测试连接 | 卡片"测试连接" | loading → 测试结果 | P1 |
| TC-SYS-036 | 手动同步 | 卡片"手动同步" | loading → 同步结果 | P1 |
| TC-SYS-037 | 启用/停用 | 切换连接 switch | API toggle | P1 |
| TC-SYS-038 | 删除连接 | 卡片"删除" → 确认 | 从列表移除 | P1 |
| TC-SYS-039 | POS 品牌标签 | 检查卡片 | 客如云/二维火/银豹/美团/哗啦啦 颜色 tag | P2 |

---

## 十五、智能调度 (7 页面, ~62 用例)

### 15.1 调度 Dashboard (`/scheduling/overview`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-SCH-001 | 调度 Dashboard 加载 | 导航至页面 | 4 统计卡片 + 今日排程 + 告警 + 快捷操作 | P0 |
| TC-SCH-002 | 统计卡片数据 | 检查 4 张卡片 | 今日计划/到岗工人/活跃产线/未处理告警 | P0 |
| TC-SCH-003 | 告警脉冲动画 | 存在未处理告警 | 告警卡片 pulse 动画 | P2 |
| TC-SCH-004 | 快捷操作导航 | 点击 4 张快捷操作卡片 | 跳转正确路由 | P1 |
| TC-SCH-005 | 30 秒自动刷新 | 等待 30 秒 | 数据静默刷新 | P2 |

### 15.2 调度计划列表 (`/scheduling/plans`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-SCH-006 | 计划列表加载 | 导航至页面 | 表格 + 日期+状态筛选 + 分页 | P0 |
| TC-SCH-007 | 确认计划 | 行"确认" (draft) | 确认 → 状态变 confirmed | P0 |
| TC-SCH-008 | 取消计划 | 行"取消" → 输入原因 | prompt → 状态变 cancelled | P1 |
| TC-SCH-009 | 完成概率颜色 | 检查概率列 | ≥90%=绿, ≥70%=黄, ≥50%=红, <50%=灰 | P2 |

### 15.3 创建调度计划 (`/scheduling/plans/create`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-SCH-010 | 创建页面加载 | 导航至页面 | 日期选择 + 手动/AI 模式 + 批次选择 | P0 |
| TC-SCH-011 | 手动模式创建 | 选日期+手动模式+选批次 → 创建 | 调度计划创建成功 | P0 |
| TC-SCH-012 | AI 智能生成 | 选 AI 模式 → 选优化目标 → 创建 | AI 生成调度计划 | P1 |
| TC-SCH-013 | AI 优化选项 | AI 模式下 | 显示: 优化目标 radio + 临时工 switch + 概率 slider | P1 |
| TC-SCH-014 | 批次全选/清空 | 点击全选/清空 | 所有批次选中/取消 | P2 |
| TC-SCH-015 | 禁止选过去日期 | 尝试选择昨天 | 日期不可选 | P2 |

### 15.4 计划详情 (`/scheduling/plans/:id`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-SCH-016 | 详情页加载 | 导航至页面 | 概览卡片 + 甘特图 + 排程表 | P0 |
| TC-SCH-017 | 甘特图渲染 | 检查 `ganttContainer` | ECharts custom 图 (400px)，有 bar + legend | P0 |
| TC-SCH-018 | 甘特图点击交互 | 点击 bar | selectedSchedule 更新 | P1 |
| TC-SCH-019 | 开始排程 | 排程表行"开始" (pending) | 确认 → 状态变 in_progress | P0 |
| TC-SCH-020 | 更新进度 | 行"更新进度" → 填完成数量 → 确定 | 弹窗 400px → 进度更新 | P1 |
| TC-SCH-021 | 完成排程 | 行"完成" → 输入数量 | prompt → 状态变 completed | P1 |
| TC-SCH-022 | 概率仪表盘 | 检查概览卡片 | 彩色圆形概率 gauge | P2 |
| TC-SCH-023 | 60 秒自动刷新 | 等待 60 秒 | 数据静默更新 | P2 |

### 15.5 实时监控 (`/scheduling/realtime`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-SCH-024 | 实时监控页面加载 | 导航至页面 | 计划选择器 + 统计卡片 + 进度图 + 概率图 | P0 |
| TC-SCH-025 | 进度图渲染 | 检查 `progressContainer` | ECharts 横向 bar (dark theme) | P0 |
| TC-SCH-026 | 概率分布图渲染 | 检查 `probabilityContainer` | ECharts pie/donut | P0 |
| TC-SCH-027 | 切换计划 | 选择不同计划 | 数据刷新 | P1 |
| TC-SCH-028 | 15 秒自动刷新 | 等待 15 秒 | 数据静默更新 | P2 |

### 15.6 人员分配 (`/scheduling/workers`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-SCH-029 | 人员分配页加载 | 选择计划 | 排程卡片 + 工人列表 | P0 |
| TC-SCH-030 | 添加工人 | 卡片"添加工人" → 勾选 → 确定分配 | 弹窗 600px → 分配成功 | P0 |
| TC-SCH-031 | 工人签到 | 点击工人行"签到" | 状态变 checked_in | P0 |
| TC-SCH-032 | 工人签退 | 点击"签退" → 输入评分 (1-100) | prompt → 状态变 checked_out | P1 |
| TC-SCH-033 | 移除工人 | 点击"移除" → 确认 | 工人从排程移除 | P1 |
| TC-SCH-034 | AI 优化分配 | 点击"AI 优化分配" → 选目标+设 slider → 开始 | 弹窗 500px → 优化结果 | P1 |
| TC-SCH-035 | 临时工标签 | 检查工人列表 | 临时工显示 warning tag | P2 |

### 15.7 调度告警 (`/scheduling/alerts`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-SCH-036 | 告警列表加载 | 导航至页面 | 告警卡片列表 + 筛选 + 分页 | P0 |
| TC-SCH-037 | 确认告警 | 未确认告警"确认告警" | 显示确认时间 | P0 |
| TC-SCH-038 | 解决告警 | 未解决告警"解决告警" → 输入笔记 | prompt → 显示已解决 tag + 解决时间 | P0 |
| TC-SCH-039 | 严重度+类型筛选 | 组合筛选 → 搜索 | 过滤正确 | P1 |
| TC-SCH-040 | 已解决告警样式 | 检查已解决卡片 | opacity 0.7 + 已解决 success tag | P2 |

---

## 十六、行为校准 (2 页面, ~28 用例)

### 16.1 校准列表 (`/calibration/list`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-CAL-001 | 校准列表加载 | 导航至页面 | 4 统计卡片 + 表格 + 4 维筛选 + 分页 | P0 |
| TC-CAL-002 | 新建校准会话 | 点击"新建校准" → 填名称+类型+指标 → 创建 | 弹窗 500px → 创建成功 | P0 |
| TC-CAL-003 | 开始校准 | 行"开始" (pending) | 确认 → 状态变 in_progress | P0 |
| TC-CAL-004 | 完成校准 | 行"完成" (in_progress) | 确认 → 状态变 completed | P0 |
| TC-CAL-005 | 取消校准 | 行"取消" (pending/in_progress) | 确认 → 状态变 cancelled | P1 |
| TC-CAL-006 | 删除校准 | 行"删除" (completed/cancelled/failed) | 确认 → 从表格移除 | P1 |
| TC-CAL-007 | 按状态筛选 | 选"进行中" → 搜索 | 过滤正确 | P1 |
| TC-CAL-008 | 得分颜色 | 检查得分列 | ≥90=绿, ≥70=黄, ≥50=红 | P2 |
| TC-CAL-009 | 工厂选择器 | platform_admin 切换工厂 | 列表+统计刷新 | P2 |

### 16.2 校准详情 (`/calibration/:id`)

| ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| TC-CAL-010 | 详情页加载 | 导航至页面 | 基本信息 + 得分+雷达图+趋势图 + 问题表 + 时间线 | P0 |
| TC-CAL-011 | 雷达图渲染 | 检查 `radarContainer` | ECharts radar (4 维度, 280px) | P0 |
| TC-CAL-012 | 趋势图渲染 | 检查 `trendContainer` | ECharts line (7 天 area, 280px) | P0 |
| TC-CAL-013 | 执行评估 | 点击"执行评估" (in_progress) | 确认 → API 调用 | P1 |
| TC-CAL-014 | 问题表展示 | 检查问题 table | 列: 类型/严重程度(tag)/描述/影响工具(tags)/建议 | P1 |
| TC-CAL-015 | 操作历史时间线 | 检查 timeline | el-timeline 按时间排列 | P1 |
| TC-CAL-016 | 30 秒自动刷新 | status=in_progress 时 | 数据静默更新 | P2 |

---

## 十七、餐饮管理 (已有详细目录)

餐饮模块 92 个测试用例 (TC-REST-001 ~ TC-REST-092) 详见:
`.claude/agent-team-outputs/2026-03-04_restaurant-web-admin-test-catalog.md`

---

## 附录

### A. ECharts 图表实例汇总 (24 个)

| # | 页面 | Ref/Container | 图表类型 | 数据源 |
|---|------|---------------|----------|--------|
| 1 | SmartBI Dashboard | `trendChartRef` | Line (趋势) | dashboard API |
| 2 | SmartBI Dashboard | `pieChartRef` | Pie (分类占比) | dashboard API |
| 3 | Finance Analysis | `finance-main-chart` | Line/Bar/Waterfall/Pie | finance API |
| 4 | Finance Analysis | `mainDynamicConfig` | 动态 (DynamicChartRenderer) | Python |
| 5 | Finance Analysis | `explorationCharts[]` ×4 | 推荐类型 | Python batch-build |
| 6 | Sales Analysis | `sales-trend-chart` | Line 多 series + area | sales API |
| 7 | Sales Analysis | `sales-pie-chart` | Pie | sales API |
| 8 | AI Query | `chart-{messageId}` | Line/Bar/Pie (per 消息) | SSE stream |
| 9 | FoodKB Feedback | `ratingChartRef` | Bar (1-5 评分) | stats API |
| 10 | FoodKB Feedback | `typeChartRef` | Pie (反馈类型) | stats API |
| 11 | Trends | `production-chart` | Line + area (蓝) | trends API |
| 12 | Trends | `quality-chart` | Line + area (绿) | trends API |
| 13 | Trends | `cost-chart` | Bar (黄) | trends API |
| 14 | Production Report | `production-bar-chart` | 横向 Bar (绿渐变) | production API |
| 15 | Alert Dashboard | — | (无 ECharts) | — |
| 16 | Production Analysis | `trendChartRef` | Line 3-series + area | dashboard API |
| 17 | Production Analysis | `yieldChartRef` | Line + markLine + markPoint | dashboard API |
| 18 | Production Analysis | `productChartRef` | Bar (紫渐变) | dashboard API |
| 19 | Production Analysis | `processChartRef` | Donut Pie | dashboard API |
| 20 | Efficiency Analysis | `trendChartRef` | Line + area (紫) + markLine | efficiency API |
| 21 | Efficiency Analysis | `rankingChartRef` | 横向 Bar Top15 三色 | efficiency API |
| 22 | Efficiency Analysis | `hoursChartRef` | Bar (粉红渐变) | efficiency API |
| 23 | Efficiency Analysis | `heatmapChartRef` | Heatmap (员工×工序) | efficiency API |
| 24 | Calibration Detail | `radarContainer` | Radar (4 维) | calibration API |
| 25 | Calibration Detail | `trendContainer` | Line + area (7 天) | calibration API |
| 26 | Scheduling Detail | `ganttContainer` | Custom (甘特图) | scheduling API |
| 27 | Scheduling Realtime | `progressContainer` | 横向 Bar (dark) | realtime API |
| 28 | Scheduling Realtime | `probabilityContainer` | Pie/Donut | realtime API |

### B. SSE/流式接口

| 端点 | 页面 | 机制 |
|------|------|------|
| `POST /{factoryId}/smart-bi/upload-batch-stream` | SmartBIAnalysis | fetch + ReadableStream |
| `POST /api/smartbi/analysis/chat-stream` | AIQuery | chatAnalysisStream() + AbortController |

### C. Stub 页面清单 (无交互可测)

| 路由 | 页面 | 内容 |
|------|------|------|
| `/finance/costs` | 成本分析 | el-empty "功能开发中" |
| `/system/roles` | 角色管理 | el-empty "功能开发中" |
| `/equipment/maintenance` | 维护记录 | el-empty "功能开发中" |
| `/production/batches/:id` | 批次详情 | el-empty "功能开发中" |

### D. 未接线按钮清单 (UI 存在但无 handler)

| 页面 | 按钮 | 状态 |
|------|------|------|
| 供应商管理 | 新增/查看/编辑/删除 | 无 @click handler |
| 客户管理 | 新增/查看/编辑/删除 | 无 @click handler |
| 员工管理 | 添加/查看/编辑 | 无 @click handler |
| 设备管理 | 添加/查看/维护/编辑 | 无 @click handler |
| 质检列表 | 新建质检/查看详情 | 无 @click handler |
| 废弃列表 | 查看 | 无 @click handler |
| 生产批次 | 创建批次(stub)/查看/编辑 | ElMessage.info / 无 handler |
| BOM 管理 | 3 个导出按钮 | ElMessage.info (stub) |
| 考勤记录 | 导出/详情 | ElMessage.info / 无 handler |

### E. 测试优先级说明

| 优先级 | 含义 | 用例数 |
|--------|------|--------|
| P0 | 冒烟: 页面加载、核心 CRUD、图表渲染、关键工作流 | ~150 |
| P1 | 核心: 筛选、分页、表单验证、状态流转、次要功能 | ~260 |
| P2 | 边界: 样式、自动刷新、stub 页面、标签颜色、防重复 | ~170 |

### F. 测试文件规划

```
tests/e2e-webadmin/
├── playwright.config.ts
├── fixtures/
│   └── auth.setup.ts                         # 登录 fixture
├── tests/
│   ├── 01-dashboard.spec.ts                   # TC-DASH-*
│   ├── 02-smartbi-dashboard.spec.ts           # TC-SBI-001~010
│   ├── 03-smartbi-finance.spec.ts             # TC-SBI-011~018
│   ├── 04-smartbi-sales.spec.ts               # TC-SBI-019~025
│   ├── 05-smartbi-ai-query.spec.ts            # TC-SBI-026~035
│   ├── 06-smartbi-analysis-upload.spec.ts     # TC-SBI-036~052
│   ├── 07-smartbi-templates-misc.spec.ts      # TC-SBI-053~064
│   ├── 08-analytics-trends.spec.ts            # TC-ANA-001~007
│   ├── 09-analytics-reports-kpi.spec.ts       # TC-ANA-008~014
│   ├── 10-analytics-production-alerts.spec.ts # TC-ANA-015~024
│   ├── 11-production-analytics.spec.ts        # TC-PA-001~014
│   ├── 12-production-batches.spec.ts          # TC-PROD-001~005
│   ├── 13-production-plans.spec.ts            # TC-PROD-006~016
│   ├── 14-production-bom-conversions.spec.ts  # TC-PROD-017~028
│   ├── 15-warehouse.spec.ts                   # TC-WH-001~017
│   ├── 16-transfer.spec.ts                    # TC-TF-001~013
│   ├── 17-quality.spec.ts                     # TC-QA-001~008
│   ├── 18-procurement.spec.ts                 # TC-PO-001~018
│   ├── 19-sales.spec.ts                       # TC-SALE-001~014
│   ├── 20-hr.spec.ts                          # TC-HR-001~016
│   ├── 21-equipment.spec.ts                   # TC-EQ-001~010
│   ├── 22-finance.spec.ts                     # TC-FIN-001~012
│   ├── 23-system-users.spec.ts                # TC-SYS-001~006
│   ├── 24-system-settings.spec.ts             # TC-SYS-007~016
│   ├── 25-system-products-features.spec.ts    # TC-SYS-017~032
│   ├── 26-system-pos.spec.ts                  # TC-SYS-033~039
│   ├── 27-scheduling-dashboard.spec.ts        # TC-SCH-001~005
│   ├── 28-scheduling-plans.spec.ts            # TC-SCH-006~023
│   ├── 29-scheduling-realtime-workers.spec.ts # TC-SCH-024~035
│   ├── 30-scheduling-alerts.spec.ts           # TC-SCH-036~040
│   ├── 31-calibration.spec.ts                 # TC-CAL-001~016
│   └── 32-restaurant/                         # TC-REST-001~092 (已有)
│       ├── recipes-crud.spec.ts
│       ├── requisitions-crud.spec.ts
│       ├── stocktaking-crud.spec.ts
│       ├── wastage-crud.spec.ts
│       ├── approval-workflow.spec.ts
│       ├── filter-pagination.spec.ts
│       └── edge-cases.spec.ts
└── reports/
    └── results.json
```

---

## 附录 G. 代码审计发现与优化建议 (2026-03-04 Agent-Team 评估)

> 完整报告: `.claude/agent-team-outputs/2026-03-04_web-admin-three-findings-evaluation.md`

### G1. ECharts 图表审计结论

**发现 28 个图表实例（修正原计 24 个）**，核心问题：

| 问题 | 影响范围 | 置信度 | 优先级 |
|------|----------|--------|--------|
| `useChartResize` composable 零采用，31处手写 `window.addEventListener` | 全部图表 | 95% | P3 |
| `trends/index.vue` 三重缺陷：getElementById + 无onUnmounted + listener泄漏 | 3个图表 | 95% | P2 |
| `ProductionAnalysis` + `EfficiencyAnalysis` 无resize + 全量echarts导入 | 8个图表 | 95% | P2 |
| 所有SmartBI组件用 `ref` 而非 `shallowRef` | 15个组件 | 90% | P3 |
| `MapChart.vue` 依赖外网CDN `geo.datav.aliyun.com` | 地图图表 | 95% | P-条件 |
| `DynamicChartRenderer` 在 el-dialog 内 nextTick 时序问题 | dialog内图表 | 80% | P3 |

### G2. 工作流状态审计结论

**5条核心工作流存在 6 个已确认缺陷 + 2 个全局问题：**

| 工作流 | 问题 | 置信度 | 优先级 |
|--------|------|--------|--------|
| 调拨 | REJECTED/CANCELLED → el-steps 显示"草稿"(step 0) | **95%** | **P0** |
| 采购 | 收货单 PENDING_QC 质检步骤被前端跳过 | **95%** | **P0** |
| 销售 | PICKED 状态孤立（无拣货按钮） | 85% | P1 |
| 领料 | 审批量硬编码 `actualQuantity = requestedQuantity` | **95%** | P1 |
| 领料vs损耗 | 重提交逻辑不一致 | 85% | P1 |
| 排产 | 前后端状态大小写可能不一致 | 60% | P-条件 |
| **全局** | **5工作流均无防重提交** | **90%** | **P0** |
| **全局** | **API success=false 时静默失败** | **90%** | **P0** |

### G3. Stub/未接线审计结论

**4 个 Stub 修正为 3 个纯 Stub + 1 个半完成：**

| 页面 | 实际状态 | 后端API | 修复量 | 优先级 |
|------|---------|---------|--------|--------|
| 设备维护 | 纯stub (17行) | **完整**(3个API) | 1.5天 | P1 |
| 角色管理 | 纯stub (17行) | 部分 | 3-5天 | P3 |
| 批次详情 | 轻度stub (20行) | 完整 | 1天 | P2 |
| 成本分析 | **半完成**(186行,含API+卡片) | 无专用controller | 0.5天(补图表) | P3 |

**9 组未接线按钮中 7 组后端 API 已就绪：**

| 页面 | 按钮数 | 后端就绪 | 优先级 |
|------|--------|---------|--------|
| 供应商管理 | 4 | ✅ | P1 |
| 客户管理 | 4 | ✅ | P1 |
| 设备管理 | 3 | ✅ | P1 |
| 质检记录 | 2 | ✅ | P1 |
| 员工管理 | 3 | ✅ | P2 |
| 原材料批次 | 3 | ✅ | P2 |

### G4. 总修复工作量估算

```
P0 (立即, 3-4天)     ████████░░  调拨REJECTED + 防重 + 静默失败 + 采购QC
P1 (短期, 3-5天)     ██████░░░░  按钮接线(6模块) + 审批量 + 损耗统一 + PICKED
P-条件 (验证后)      ████░░░░░░  排产大小写 + MapChart CDN
P3 (渐进, 3天)       ███░░░░░░░  useChartResize迁移 + trends重构 + 全量导入
                     ─────────────────────────────────────
                     总计: 12-17人天
```

### G5. 开放问题

1. 排产 status 在生产 DB 中大写还是小写？→ `SELECT DISTINCT status FROM scheduling_plans`
2. 6 模块按钮未接线是设计选择还是遗漏？→ 需产品确认
3. 后端工作流 API 是否已有幂等性保护？→ 检查 Controller 层
4. MapChart CDN 在内网是否可访问？→ 目标环境测试
5. 销售 PICKED 是已废弃状态？→ 检查 DB 中 PICKED 记录数
