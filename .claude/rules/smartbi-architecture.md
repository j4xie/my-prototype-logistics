# SmartBI 模块架构规范

**最后更新**: 2026-02-03

---

## 1. 模块概览

SmartBI 是一个 **Zero-Code 数据分析平台**，用户上传 Excel 后自动完成表结构检测、字段映射、图表推荐和 AI 洞察。

### 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                 Frontend (React Native + Expo)               │
│  screens/smartbi/ (18屏幕) + components/smartbi/ (20组件)    │
└─────────────────────────────┬───────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                 Java Backend (Port 10010)                    │
│  SmartBIController → SmartBIUploadFlowService               │
│  认证、业务逻辑、数据持久化                                    │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                 Python Backend (Port 8083)                   │
│  api/ (13路由) → services/ (80+服务)                         │
│  LLM处理、Excel解析、图表推荐、分析引擎                        │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL (JSONB)                        │
│  smart_bi_dynamic_data (动态数据存储)                        │
└─────────────────────────────────────────────────────────────┘
```

### 核心服务分工

| 层级 | 职责 | 关键文件 |
|------|------|---------|
| Python API | Excel 解析、LLM 检测、图表推荐 | `backend/python/smartbi/api/` |
| Python Services | 字段检测、语义映射、分析引擎 | `backend/python/smartbi/services/` |
| Java Controller | API 网关、认证、业务编排 | `controller/SmartBIController.java` |
| Java Services | 持久化、图表生成、上传流程 | `service/smartbi/` (73个文件) |
| Frontend | 动态渲染、维度切换、KPI展示 | `screens/smartbi/`, `components/smartbi/` |

---

## 2. LLM 字段检测逻辑

### 多层次检测架构

```
Excel 数据
    ↓
Layer 1: 基础类型检测 (_analyze_basic_types)
    → string / integer / float / date / boolean
    ↓
Layer 2: 缓存检查 (FieldDetectionCache)
    → 命中则直接返回
    ↓
Layer 3: LLM 语义检测 (_detect_with_llm)
    → 识别 semantic_type + chart_role
    ↓
Layer 4: 规则降级 (_detect_with_rules)
    → LLM 失败时使用模式匹配
```

### 核心服务职责

| 服务 | 文件 | 职责 |
|------|------|------|
| LLM 字段检测 | `field_detector_llm.py` | 缓存、异步、规则降级 |
| 语义映射 | `semantic_mapper.py` | 3层映射、宽表处理 |
| LLM 映射器 | `llm_mapper.py` | Sheet 分析、图表推荐 |
| 结构检测 | `structure_detector.py` | 4层检测 (Rule→LLM→VL→投票) |

### 字段类型定义

```python
# 基础数据类型 (data_type)
DataType = ["string", "integer", "float", "date", "datetime", "boolean"]

# 业务语义类型 (semantic_type)
SemanticType = [
    "amount",      # 金额 (销售额、收入、成本)
    "quantity",    # 数量 (件数、个数)
    "percentage",  # 百分比/比率
    "date",        # 日期维度
    "category",    # 分类维度
    "geography",   # 地理维度
    "product",     # 产品维度
    "customer",    # 客户维度
    "id", "name", "text", "unknown"
]

# 图表角色 (chart_role)
ChartRole = [
    "dimension",   # 维度 (X轴、分组)
    "measure",     # 度量 (Y轴、计算)
    "time",        # 时间轴
    "series",      # 系列分组
    "tooltip"      # 辅助信息
]
```

### 置信度阈值

| 场景 | 阈值 | 说明 |
|------|------|------|
| 结构检测 | 0.7 | 低于此值触发多模型投票 |
| 语义映射 | 0.7 | 低于此值进入 Layer 3 |
| 字段检测 | 0.6 | LLM 最低可接受置信度 |
| 学习缓存 | 0.7+ | 高置信度自动保存 |

### 宽格式数据处理

检测模式：
```python
# 满足以下任一条件视为宽格式：
- 3+ 列匹配月份模式: r'(1[0-2]|[1-9])月'
- 3+ 列匹配数值月份: r'\d{4}[-_]?\d{2}'
- 3+ 列匹配年月模式: r'\d{4}年(1[0-2]|[1-9])月'
```

宽格式映射规则：
```
"2025年1月_预算数" → "budget_amount_202501"
"2025年1月_实际数" → "actual_amount_202501"
"去年同期" → "last_year_actual_YYYYMM"
```

---

## 3. 图表推荐算法

### 支持的图表类型 (22种)

**基础图表 (13种)**：
- `line` 折线图 - 时间序列趋势
- `bar` 柱状图 - 分类对比
- `pie` 饼图 - 占比分析
- `area` 面积图 - 累积趋势
- `scatter` 散点图 - 关联分析
- `heatmap` 热力图 - 分布矩阵
- `waterfall` 瀑布图 - 增量变化
- `radar` 雷达图 - 多维对比
- `funnel` 漏斗图 - 转化分析
- `gauge` 仪表盘 - KPI 展示
- `treemap` 树图 - 层级占比
- `sankey` 桑基图 - 流向分析
- `combination` 组合图 - 柱状+折线

**高级图表 (9种)**：
- `sunburst` 旭日图
- `pareto` 帕累托图
- `bullet` 子弹图
- `dual_axis` 双Y轴图
- `bar_horizontal` 水平柱状图
- `donut` 环形图
- `nested_donut` 嵌套环形图
- `matrix_heatmap` 矩阵热力图
- `slope` 斜率图

### 推荐流程

```
数据分析 → 特征提取 → 缓存检查 → LLM推荐 → 结果缓存
              ↓
          DataProfile
          - has_time_dimension
          - has_category_dimension
          - measure_columns
          - is_composition_analysis
          - is_ranking_analysis
```

### 推荐规则优先级

| 优先级 | 条件 | 推荐图表 |
|--------|------|---------|
| 1 | 时间维度 + 度量 | 折线图 |
| 2 | 分类维度 + 度量 | 柱状图 |
| 3 | 占比分析 (≤6类) | 环形图 |
| 4 | 占比分析 (>6类) | 矩形树图 |
| 5 | 层级结构 | 旭日图 |
| 6 | 2+ 度量 | 散点图 |
| 7 | 排名 (≤10类) | 漏斗图 |
| 8 | 多维评分 | 雷达图 |

### 缓存策略

```python
# 缓存Key生成 (基于数据结构签名)
signature = hash(
    column_names[:20] +
    data_types[:20] +
    time_columns[:5] +
    scenario +
    user_intent
)

# 缓存配置
ttl_seconds = 3600      # 1小时
max_entries = 500       # 最多500条
eviction = "LRU"        # 淘汰策略
```

---

## 4. Java-Python 通信机制

### 通信配置

| 项目 | 值 |
|------|-----|
| Python 服务地址 | `http://localhost:8083` |
| HTTP 客户端 | OkHttp3 |
| 连接超时 | 5000 ms |
| 读写超时 | 30000 ms |
| 最大重试 | 2 次 |
| 健康检查间隔 | 30000 ms |

### 核心端点

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/excel/auto-parse` | POST | Excel 解析 + 字段检测 |
| `/api/field/detect` | POST | 字段类型检测 |
| `/api/field/map-with-llm` | POST | LLM 字段映射 |
| `/api/chart/recommend` | POST | 图表推荐 |
| `/health` | GET | 健康检查 |

### 健康检查机制

```java
// 缓存策略: 30秒内不重复检查
if (now - lastCheck < healthCheckInterval) {
    return serviceAvailable.get();  // 返回缓存状态
}
// 超过30秒则重新检查 /health 端点
```

### 重试策略

```
请求失败 → 等待 1秒 → 重试1
         → 等待 2秒 → 重试2
         → 标记服务不可用
```

### 降级处理

**SmartBI 已完全禁用 Java Fallback**：
```java
// PythonSmartBIConfig.java
fallbackOnError = false;

// 任何 Python 服务不可用都直接抛异常
if (!pythonClient.isAvailable()) {
    throw new RuntimeException("Python SmartBI 服务不可用");
}
```

---

## 5. 前端动态渲染

### 核心组件

| 组件 | 位置 | 职责 |
|------|------|------|
| DynamicChartRenderer | `components/smartbi/` | 根据 chartType 选择图表 |
| DynamicAnalysisScreen | `screens/smartbi/` | 主容器和状态管理 |
| KPICardGrid | `components/smartbi/` | KPI 卡片网格 |
| MetricCardGrid | `components/smartbi/` | 指标卡片网格 |
| SheetTabBar | `components/smartbi/` | Sheet 选项卡导航 |
| ChartDimensionSwitcher | `components/smartbi/` | 维度切换器 |

### 图表类型映射

```typescript
// DynamicChartRenderer 中的类型映射
LINE          → MobileLineChart
BAR           → MobileBarChart
BAR_HORIZONTAL → MobileBarChart (水平模式)
PIE / DONUT   → MobilePieChart
AREA          → MobileLineChart (fillShadow: true)
GAUGE         → MobileGaugeChart
RADAR         → MobileRadarChart
FUNNEL        → MobileFunnelChart
WATERFALL     → MobileWaterfallChart
其他          → UnsupportedChart 占位符
```

### 动态配置结构

```typescript
interface DynamicChartConfig {
  chartType: ChartType;
  title: string;
  xAxis: AxisConfig;
  yAxis: AxisConfig[];
  series: SeriesConfig[];
  alternativeXAxis: AlternativeDimension[];    // 可切换X轴
  alternativeSeries: AlternativeDimension[];   // 可切换系列
  alternativeMeasures: AlternativeDimension[]; // 可切换度量
  rawData: Record<string, unknown>[];
}
```

### 维度切换流程

```
用户点击维度芯片
    ↓
onDimensionChange(fieldName)
    ↓
调用 switchChartDimension API
    ↓
后端重新聚合数据
    ↓
返回新的 DynamicChartConfig
    ↓
setState 更新状态 (Immutable)
    ↓
DynamicChartRenderer 重新渲染
```

### 颜色系统

```typescript
CHART_COLORS = {
  primary:   '#3B82F6',  // 蓝色
  secondary: '#10B981',  // 绿色 (正向)
  warning:   '#F59E0B',  // 琥珀 (中立)
  danger:    '#EF4444',  // 红色 (负向)
  series: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']
}
```

### 性能优化

```typescript
// 所有数据提取使用 useMemo
const labels = useMemo(() => extractLabels(chartConfig), [chartConfig]);

// 回调使用 useCallback
const handleDimensionChange = useCallback((fieldName) => {
  onDimensionChange?.(fieldName);
}, [onDimensionChange]);

// 状态更新使用 Immutable 方式
setMultiSheetResult((prev) => ({
  ...prev,
  sheetResults: newResults
}));
```

---

## 6. 关键文件路径

### Python 服务
```
backend/python/smartbi/
├── main.py                          # FastAPI 入口
├── config.py                        # 全局配置
├── api/
│   ├── excel.py                     # Excel 解析 API (auto-parse 在 1510 行)
│   ├── chart.py                     # 图表推荐 API
│   └── db_analysis.py               # 数据库分析 API
└── services/
    ├── field_detector_llm.py        # LLM 字段检测
    ├── semantic_mapper.py           # 语义映射
    ├── structure_detector.py        # 结构检测
    ├── chart_recommender.py         # 图表推荐
    └── chart_builder.py             # 图表构建
```

### Java 服务
```
backend/java/cretas-api/src/main/java/com/cretas/aims/
├── controller/SmartBIController.java
├── client/PythonSmartBIClient.java
├── config/smartbi/PythonSmartBIConfig.java
└── service/smartbi/impl/
    ├── SmartBIUploadFlowServiceImpl.java
    └── DynamicDataPersistenceServiceImpl.java
```

### 前端
```
frontend/CretasFoodTrace/src/
├── types/smartbi.ts                 # 类型定义
├── services/api/smartbi.ts          # API 客户端
├── screens/smartbi/
│   └── DynamicAnalysisScreen.tsx    # 主屏幕
└── components/smartbi/
    ├── DynamicChartRenderer.tsx     # 动态渲染
    ├── KPICardGrid.tsx
    ├── MetricCardGrid.tsx
    ├── SheetTabBar.tsx
    └── Mobile*Chart.tsx             # 各图表组件
```

---

## 7. 开发规范

### 添加新图表类型

1. **Python**: 在 `chart_recommender.py` 添加推荐规则
2. **Python**: 在 `chart_builder.py` 添加构建逻辑
3. **TypeScript**: 在 `types/smartbi.ts` 的 `ChartType` 添加类型
4. **前端**: 在 `DynamicChartRenderer.tsx` 添加映射
5. **前端**: 创建 `Mobile{Name}Chart.tsx` 组件

### 添加新语义类型

1. **Python**: 在 `field_detector_llm.py` 的 SYSTEM_PROMPT 添加定义
2. **Python**: 在 `semantic_mapper.py` 添加 category 映射
3. **TypeScript**: 在 `types/smartbi.ts` 更新 `SemanticType`

### 错误处理原则

```
禁止:
- 返回假数据
- 静默失败
- catch (error: any)

必须:
- 明确的错误消息
- 完整的异常堆栈日志
- 用户友好的错误提示
```

---

## 8. 调试技巧

### 检查 Python 服务

```bash
# 健康检查
curl http://localhost:8083/health

# 查看日志
tail -f backend/python/smartbi/logs/smartbi.log
```

### 检查 Java 调用

```java
// 关键日志标记
log.info("调用 Python SmartBI 解析 Excel");
log.warn("Python SmartBI 请求失败，重试");
log.error("字段检测失败");
```

### 前端调试

```typescript
// 查看图表配置
console.log('ChartConfig:', JSON.stringify(chartConfig, null, 2));

// 查看数据提取结果
console.log('Labels:', labels);
console.log('Values:', values);
```

---

## 9. 常见问题

### Python 服务不可用

```
原因: 服务未启动或端口冲突
解决:
1. cd backend/python/smartbi
2. uvicorn main:app --port 8083
```

### 字段检测置信度低

```
原因: 列名不规范或数据样本不足
解决:
1. 检查列名是否包含中文关键词
2. 确保数据行数 ≥ 10 行
3. 检查是否为宽格式数据
```

### 图表显示 "Unsupported"

```
原因: chartType 未在前端映射
解决:
1. 检查 DynamicChartRenderer.tsx 的 switch 语句
2. 确认 chartType 大小写一致
```
