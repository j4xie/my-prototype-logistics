# SmartBI Architecture

**Version**: 2.0
**Updated**: 2026-01-27

## Overview

SmartBI 是一个 LLM 驱动的智能数据分析服务，提供零代码 Excel 解析、自动场景识别、智能图表推荐和业务洞察生成。

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           SmartBI Service                                │
│                         (Python + FastAPI)                               │
│                           Port: 8083                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Excel File                                                             │
│       │                                                                  │
│       ▼                                                                  │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    Unified Analyzer (核心)                        │   │
│   │  ┌─────────────┬─────────────┬─────────────┬─────────────────┐  │   │
│   │  │ Phase 0     │ Phase 1     │ Phase 2     │ Phase 3-4       │  │   │
│   │  │ Cache Check │ Data Extract│ LLM Detect  │ Parallel Analyze│  │   │
│   │  └─────────────┴─────────────┴─────────────┴─────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│       │                                                                  │
│       ▼                                                                  │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    Analysis Cache (完整缓存)                       │   │
│   │           Data (JSON/CSV/MD) + Analysis Results                  │   │
│   │                    加速: 18000x                                   │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
smartbi/
├── main.py                          # FastAPI 入口
├── config.py                        # 配置 (LLM, 缓存, 数据库)
├── ARCHITECTURE.md                  # 本文档
│
├── api/                             # API 路由层 (13 个路由器)
│   ├── excel.py                     # Excel 解析与导出
│   ├── field.py                     # 字段检测
│   ├── metrics.py                   # 指标计算
│   ├── forecast.py                  # 预测服务
│   ├── insight.py                   # 洞察生成
│   ├── chart.py                     # 图表构建
│   ├── analysis.py                  # 领域分析 (财务/销售/部门/区域)
│   ├── chat.py                      # 对话式分析
│   ├── classifier.py                # 意图分类
│   ├── ml.py                        # 机器学习
│   ├── linucb.py                    # LinUCB 算法
│   └── db_analysis.py               # 数据库分析
│
├── services/                        # 核心服务层 (37+ 服务)
│   │
│   │  ═══════════════════════════════════════════════════════════
│   │  核心分析引擎 (Unified Analyzer)
│   │  ═══════════════════════════════════════════════════════════
│   ├── unified_analyzer.py          # 统一分析器 (主入口)
│   ├── analysis_cache.py            # 完整缓存管理器
│   │
│   │  ═══════════════════════════════════════════════════════════
│   │  Layer 1: 数据提取
│   │  ═══════════════════════════════════════════════════════════
│   ├── excel_parser.py              # Excel 解析
│   ├── raw_exporter.py              # 原始数据导出
│   ├── structure_detector.py        # 结构检测 (表头/合并单元格)
│   ├── data_cleaner.py              # 数据清洗
│   │
│   │  ═══════════════════════════════════════════════════════════
│   │  Layer 2: LLM 字段检测
│   │  ═══════════════════════════════════════════════════════════
│   ├── field_detector_llm.py        # LLM 字段检测 (带缓存)
│   ├── field_detector.py            # 兼容层
│   ├── data_feature_analyzer.py     # 数据特征分析
│   │
│   │  ═══════════════════════════════════════════════════════════
│   │  Layer 3: LLM 场景识别
│   │  ═══════════════════════════════════════════════════════════
│   ├── scenario_detector.py         # LLM 场景检测
│   ├── smart_analyzer.py            # 兼容层
│   ├── semantic_mapper.py           # 语义映射
│   │
│   │  ═══════════════════════════════════════════════════════════
│   │  Layer 4: LLM 分析生成
│   │  ═══════════════════════════════════════════════════════════
│   ├── metric_calculator.py         # 指标计算
│   ├── chart_recommender.py         # 图表推荐
│   ├── chart_builder.py             # 图表构建
│   ├── insight_generator.py         # 洞察生成
│   ├── forecast_service.py          # 预测服务
│   │
│   │  ═══════════════════════════════════════════════════════════
│   │  Layer 5: 领域分析
│   │  ═══════════════════════════════════════════════════════════
│   ├── analysis/
│   │   ├── base.py                  # 基础分析服务
│   │   ├── finance_analysis.py      # 财务分析
│   │   ├── sales_analysis.py        # 销售分析
│   │   ├── department_analysis.py   # 部门分析
│   │   └── region_analysis.py       # 区域分析
│   │
│   │  ═══════════════════════════════════════════════════════════
│   │  支持服务
│   │  ═══════════════════════════════════════════════════════════
│   ├── context_extractor.py         # 上下文提取
│   ├── llm_mapper.py                # LLM 映射
│   ├── intent_classifier.py         # 意图分类
│   ├── schema_cache.py              # Schema 缓存
│   ├── data_exporter.py             # 数据导出
│   └── ...
│
├── database/                        # PostgreSQL 集成 (可选)
│   ├── connection.py
│   ├── models.py
│   └── repository.py
│
└── tests/                           # 测试文件
    ├── test_e2e_unified_analyzer.py # E2E 测试
    └── ...
```

---

## Core Architecture: Unified Analyzer

### Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         UnifiedAnalyzer.analyze()                           │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Phase 0: Cache Check                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  检查完整缓存 (数据 + 分析结果)                                        │   │
│  │                                                                       │   │
│  │  ├── 完整缓存命中 → 直接返回 (3ms)                                    │   │
│  │  │                                                                    │   │
│  │  ├── 仅数据缓存 → 跳过 Phase 1, 执行 Phase 2-4                        │   │
│  │  │                                                                    │   │
│  │  └── 完全未命中 → 执行完整流程                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  Phase 1: Data Extraction                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  RawExporter → DataFrame → DataCleaner                               │   │
│  │  提取原始数据，转换为 DataFrame，清洗数据                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  Phase 2: LLM Detection (并行)                                              │
│  ┌────────────────────────────────┬────────────────────────────────────┐   │
│  │   LLMFieldDetector             │    LLMScenarioDetector             │   │
│  │   字段检测                      │    场景识别                         │   │
│  │   - data_type                  │    - scenario_type                 │   │
│  │   - semantic_type              │    - confidence                    │   │
│  │   - chart_role                 │    - dimensions/measures           │   │
│  └────────────────────────────────┴────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  Phase 3: Parallel Analysis                                                 │
│  ┌─────────────┬─────────────┬─────────────┬─────────────────────────┐     │
│  │ Metrics     │ Charts      │ Insights    │ Predictions (可选)      │     │
│  │ Calculator  │ Recommender │ Generator   │ ForecastService        │     │
│  │             │             │             │                         │     │
│  │ LLM 推断    │ LLM 推荐    │ LLM 生成    │ 时间序列预测            │     │
│  │ 动态指标    │ 最佳图表    │ 业务洞察    │                         │     │
│  └─────────────┴─────────────┴─────────────┴─────────────────────────┘     │
│                              │                                              │
│                              ▼                                              │
│  Phase 4: LLM Enhancement (可选)                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  如果有用户问题，使用 LLM 增强洞察                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  Phase 5: Cache Save (异步)                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  保存完整缓存: 数据 + 分析结果                                          │   │
│  │  cache/{hash}/                                                        │   │
│  │  ├── data.json          # 原始数据结构                                 │   │
│  │  ├── data.csv           # DataFrame                                   │   │
│  │  ├── context.md         # Markdown (LLM 上下文)                        │   │
│  │  ├── analysis.json      # 完整分析结果                                 │   │
│  │  └── metadata.json      # 缓存元信息                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│                    UnifiedAnalysisResult                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  {                                                                    │   │
│  │    success: true,                                                     │   │
│  │    sheet_name: "销售明细",                                             │   │
│  │    fields: [...],         // 字段信息                                  │   │
│  │    scenario: {...},       // 场景识别结果                               │   │
│  │    metrics: [...],        // 计算指标                                  │   │
│  │    charts: [...],         // 图表配置                                  │   │
│  │    insights: [...],       // 业务洞察                                  │   │
│  │    predictions: [...],    // 预测结果                                  │   │
│  │    from_cache: false,                                                 │   │
│  │    processing_time_ms: 45000                                          │   │
│  │  }                                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

### Multi-Sheet Parallel Processing

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    analyze_all_sheets()                                   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Excel File (5 sheets)                                                    │
│       │                                                                   │
│       ├─────────────┬─────────────┬─────────────┬─────────────┐          │
│       │             │             │             │             │          │
│       ▼             ▼             ▼             ▼             ▼          │
│   ┌───────┐    ┌───────┐    ┌───────┐    ┌───────┐    ┌───────┐         │
│   │Sheet 0│    │Sheet 1│    │Sheet 2│    │Sheet 3│    │Sheet 4│         │
│   │       │    │       │    │       │    │       │    │       │         │
│   │Cache? │    │Cache? │    │Cache? │    │Cache? │    │Cache? │         │
│   │  ✓    │    │  ✓    │    │  ✗    │    │  ✓    │    │  ✗    │         │
│   └───┬───┘    └───┬───┘    └───┬───┘    └───┬───┘    └───┬───┘         │
│       │            │            │            │            │              │
│       ▼            ▼            ▼            ▼            ▼              │
│   ┌───────┐    ┌───────┐    ┌───────┐    ┌───────┐    ┌───────┐         │
│   │ Load  │    │ Load  │    │Analyze│    │ Load  │    │Analyze│         │
│   │ Cache │    │ Cache │    │ (LLM) │    │ Cache │    │ (LLM) │         │
│   │ 3ms   │    │ 3ms   │    │ 45s   │    │ 3ms   │    │ 45s   │         │
│   └───────┘    └───────┘    └───────┘    └───────┘    └───────┘         │
│       │            │            │            │            │              │
│       └────────────┴────────────┴────────────┴────────────┘              │
│                              │                                            │
│                              ▼                                            │
│                   MultiSheetAnalysisResult                                │
│                   {                                                       │
│                     total_sheets: 5,                                      │
│                     success_count: 5,                                     │
│                     cache_hit_count: 3,                                   │
│                     sheet_results: [...]                                  │
│                   }                                                       │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Cache Architecture

### Cache Structure

```
smartbi_cache/
├── cache_index.json                 # 缓存索引
│
├── {hash1}/                         # Sheet 1 缓存
│   ├── data.json                    # 原始数据 + 统计
│   ├── data.csv                     # 清洗后 DataFrame
│   ├── context.md                   # Markdown (LLM 上下文)
│   ├── analysis.json                # 完整分析结果
│   │   ├── fields                   #   字段检测结果
│   │   ├── scenario                 #   场景识别结果
│   │   ├── metrics                  #   指标计算结果
│   │   ├── charts                   #   图表配置
│   │   ├── insights                 #   洞察结果
│   │   └── predictions              #   预测结果
│   └── metadata.json                # 缓存元信息
│
├── {hash2}/                         # Sheet 2 缓存
│   └── ...
│
└── ...
```

### Cache Key Generation

```python
cache_key = MD5(file_bytes + sheet_index)
```

### Cache Hit Logic

```
检查缓存
    │
    ├── 检查 analysis.json 存在?
    │       │
    │       ├── Yes → 完整缓存命中
    │       │         直接返回 (3ms)
    │       │
    │       └── No → 检查 data.json 存在?
    │                   │
    │                   ├── Yes → 数据缓存命中
    │                   │         加载数据，执行 LLM 分析
    │                   │
    │                   └── No → 完全未命中
    │                             执行完整流程 (~50s)
```

### Performance

| 场景 | 时间 | 说明 |
|------|------|------|
| 冷缓存 (首次) | ~50秒 | 完整 LLM 分析 |
| 完整缓存命中 | 3-5ms | 直接加载 |
| 加速比 | **18000x** | |

---

## LLM Configuration

### Models

| Model | Purpose | Config Key |
|-------|---------|------------|
| `qwen-plus` | 默认文本模型 | `llm_model` |
| `qwen-vl-max` | 视觉模型 (Excel 结构) | `llm_vl_model` |
| `qwen-turbo` | 快速操作 | `llm_fast_model` |
| `qwq-32b` | 深度推理 | `llm_reasoning_model` |

### API Endpoint

```
https://dashscope.aliyuncs.com/compatible-mode/v1
```

### LLM + Cache Pattern

所有 LLM 模块都使用 "LLM + Cache" 模式:

```python
async def detect(self, data):
    # 1. 检查缓存
    cache_key = generate_key(data)
    if cached := cache.get(cache_key):
        return cached

    # 2. LLM 调用
    result = await llm.call(prompt)

    # 3. 保存缓存
    cache.set(cache_key, result)

    return result
```

---

## API Endpoints Summary

### Core APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/excel/parse` | POST | 解析 Excel |
| `/api/excel/auto-parse` | POST | 零代码自动解析 |
| `/api/excel/smart-analyze` | POST | 智能分析 |
| `/api/excel/export/batch` | POST | 批量导出 |

### Analysis APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analysis/finance/*` | GET/POST | 财务分析 |
| `/api/analysis/sales/*` | GET/POST | 销售分析 |
| `/api/analysis/department/*` | GET/POST | 部门分析 |
| `/api/analysis/region/*` | GET/POST | 区域分析 |

### Recommendation APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chart/recommend/llm` | POST | LLM 图表推荐 |
| `/api/insight/generate` | POST | 洞察生成 |
| `/api/forecast/predict` | POST | 时间序列预测 |

### Utility APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/field/detect` | POST | 字段检测 |
| `/api/metrics/calculate` | POST | 指标计算 |
| `/api/chat/general-analysis` | POST | 对话式分析 |

---

## Integration with Java Backend

### Call Pattern

```java
// 1. 检查 Python 服务可用性
if (pythonClient.isAvailable()) {
    // 2. 尝试 Python 调用
    Optional<Response> result = pythonClient.analyze(file);
    if (result.isPresent() && result.get().isSuccess()) {
        return result.get();
    }
}
// 3. Fallback 到 Java 实现 (如果有)
return javaImplementation(file);
```

### Port Configuration

| Service | Port |
|---------|------|
| SmartBI Python | 8083 |
| Cretas Java Backend | 10010 |

---

## Testing

### E2E Test

```bash
cd smartbi
python tests/test_e2e_unified_analyzer.py
```

### Test Coverage

| Test | Description |
|------|-------------|
| Multi-Sheet Parallel | 多 Sheet 并行处理 |
| Cache Hit Behavior | 缓存命中验证 |
| Cache File Content | 缓存文件内容验证 |
| Force Refresh | 强制刷新验证 |
| LLM Integration | LLM 模块集成验证 |
| Single Sheet Analysis | 单 Sheet 分析验证 |

---

## Configuration

### Environment Variables

```bash
# LLM
LLM_API_KEY=sk-xxx
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LLM_MODEL=qwen-plus

# Zero-Code
STRUCTURE_DETECTION_CONFIDENCE_THRESHOLD=0.7
SEMANTIC_MAPPING_CONFIDENCE_THRESHOLD=0.8

# Service
PORT=8083
HOST=0.0.0.0
DEBUG=false

# Cache
CACHE_TTL_SECONDS=3600
SCHEMA_CACHE_ENABLED=true
```

---

## Quick Start

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 设置 LLM_API_KEY

# 3. 启动服务
uvicorn main:app --host 0.0.0.0 --port 8083

# 4. 测试
curl http://localhost:8083/health
```

---

## Statistics

- **Python Files**: 75+
- **API Routers**: 13
- **API Endpoints**: 100+
- **Core Services**: 37+
- **Domain Analysis Modules**: 4
