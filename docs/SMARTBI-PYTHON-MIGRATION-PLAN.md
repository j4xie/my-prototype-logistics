Python 数据分析微服务迁移方案
文档位置: 计划批准后将复制到 c:\Users\Steve\my-prototype-logistics\PYTHON-MIGRATION-PLAN.md

一、项目背景
当前问题
Excel 多层表头解析失败 - Java 500+ 行代码仍无法正确解析，导致数值全为 0
复杂算法实现困难 - LinUCB、时间序列预测、特征工程等在 Java 中代码冗长
扩展性差 - 添加新算法需要修改多处代码
开发效率低 - Python 生态更成熟（Pandas、Scikit-learn、Statsmodels）
迁移原则
只迁移 Python 擅长的部分 - 数据处理、统计分析、ML 算法
保留 Java 擅长的部分 - API 路由、数据库访问、事务管理、权限控制
最小化改动 - 通过 HTTP 调用集成，不改变前端接口
二、后端现状分析
涉及数据分析的服务统计
类别	服务数量	适合 Python	优先级
SmartBI 分析	13 个	10 个	P0
AI/ML 算法	10 个	10 个	P0
数据处理	5 个	5 个	P0
意图识别/NLP	8 个	6 个	P1
报表统计	6 个	4 个	P1
调度优化	12 个	6 个	P2
其他	若干	-	P3
总计: 120+ 个服务，60% 适合 Python 处理

三、6 大核心系统 Java/Python 适合度分析
3.0 总览
系统	Java 适合度	Python 适合度	推荐方案	迁移优先级
意图识别	⭐⭐⭐⭐ (4/5)	⭐⭐ (2/5)	✅ 保持 Java	无需迁移
纠错机制	⭐⭐⭐ (3/5)	⭐⭐⭐⭐ (4/5)	🔄 迁移 Python	P1
Agent/Skill 调用	⭐⭐⭐⭐⭐ (5/5)	⭐⭐ (2/5)	✅ 保持 Java	无需迁移
SmartBI 分析	⭐⭐ (2/5)	⭐⭐⭐⭐⭐ (5/5)	🔄 迁移 Python	P0
推荐算法 (LinUCB)	⭐⭐ (2/5)	⭐⭐⭐⭐ (4/5)	🔄 迁移 Python	P1
调度系统	⭐⭐⭐⭐ (4/5)	⭐⭐⭐ (3/5)	✅ 保持 Java	无需迁移
3.1 意图识别系统 - ✅ 保持 Java
代码规模: 63,000+ 行，15+ 个 Handler，2 阶段分类

核心功能:

关键词/向量匹配意图识别
Embedding 向量化与缓存
LLM Fallback 动态推理
多租户隔离、会话上下文
为什么保持 Java:

✅ 需要数据库事务 - 频繁读写意图配置
✅ 需要实时响应 - 用户输入秒级响应
✅ 复杂业务逻辑 - 权限校验、配额管理
✅ 与后端系统集成紧密
❌ 向量匹配性能不如 Python，但影响不大
3.2 纠错机制 - 🔄 迁移 Python
代码规模: 200+ 行，定时任务

核心功能:

日汇总统计 (from intent_match_records)
6 大错误归因分类
高频失败模式识别
优化建议生成
为什么迁移 Python:

✅ 复杂数据聚合 - pandas 专长
✅ 无实时性要求 - 定时任务 (日 0 点)
✅ 统计计算 - Java 200 行 → Python 50 行
✅ 模式识别 - sklearn 易实现

# Python 版本示例
df = pd.read_sql("SELECT * FROM intent_match_records", conn)
stats = df.groupby('matched_intent_code').agg({
    'execution_status': lambda x: (x == 'EXECUTED').sum()
})
3.3 Agent/Skill 调用系统 - ✅ 保持 Java
代码规模: 300+ 行，20+ 个 Tool 实现

核心功能:

Skill/Tool 动态路由与执行
参数提取与类型映射
执行顺序控制、超时管理
为什么保持 Java:

✅ Spring 依赖注入管理 Tool 实例
✅ 反射机制实现动态路由
✅ 强类型系统防止参数错误
✅ 异常处理、超时控制完善
✅ 与现有 Spring Boot 无缝集成
3.4 SmartBI 分析系统 - 🔄 迁移 Python (最高优先级)

**代码规模**: 25 个服务文件，8000+ 行代码

### 3.4.1 SmartBI 完整功能模块清单

| 功能模块 | Java 服务 | 代码行数 | Java 适合度 | Python 适合度 | 迁移决策 |
|---------|----------|---------|------------|--------------|---------|
| **Excel 多层表头解析** | ExcelDynamicParserServiceImpl | 2127 行 | ⭐⭐ (2/5) | ⭐⭐⭐⭐⭐ (5/5) | 🔄 迁移 |
| **数据方向检测/转置** | (同上) | - | ⭐⭐ (2/5) | ⭐⭐⭐⭐⭐ (5/5) | 🔄 迁移 |
| **字段类型检测** | (同上) | - | ⭐⭐⭐ (3/5) | ⭐⭐⭐⭐⭐ (5/5) | 🔄 迁移 |
| **LLM 字段映射** | LLMFieldMappingServiceImpl | 1001 行 | ⭐⭐⭐ (3/5) | ⭐⭐⭐⭐ (4/5) | 🔄 部分迁移 |
| **指标计算 (30+)** | MetricCalculatorServiceImpl | 833 行 | ⭐⭐ (2/5) | ⭐⭐⭐⭐⭐ (5/5) | 🔄 迁移 |
| **时间序列预测** | ForecastServiceImpl | 565 行 | ⭐⭐ (2/5) | ⭐⭐⭐⭐⭐ (5/5) | 🔄 迁移 |
| **销售分析** | SalesAnalysisServiceImpl | 400+ 行 | ⭐⭐ (2/5) | ⭐⭐⭐⭐⭐ (5/5) | 🔄 迁移 |
| **财务分析** | FinanceAnalysisServiceImpl | 350+ 行 | ⭐⭐ (2/5) | ⭐⭐⭐⭐⭐ (5/5) | 🔄 迁移 |
| **图表配置生成** | DynamicChartConfigBuilder | 300+ 行 | ⭐⭐⭐ (3/5) | ⭐⭐⭐⭐ (4/5) | 🔄 迁移 |
| **数据持久化** | ExcelDataPersistenceService | 400+ 行 | ⭐⭐⭐⭐ (4/5) | ⭐⭐⭐ (3/5) | ✅ 保留 Java |
| **流程编排** | SmartBIUploadFlowService | 500+ 行 | ⭐⭐⭐⭐⭐ (5/5) | ⭐⭐ (2/5) | ✅ 保留 Java |
| **配置管理** | SmartBIConfigService | 300+ 行 | ⭐⭐⭐⭐⭐ (5/5) | ⭐⭐ (2/5) | ✅ 保留 Java |
| **缓存/配额** | SmartBIServiceImpl | 1000+ 行 | ⭐⭐⭐⭐⭐ (5/5) | ⭐⭐ (2/5) | ✅ 保留 Java |

### 3.4.2 各功能模块详细分析

#### A. Excel 解析模块 (ExcelDynamicParserServiceImpl) - 🔄 迁移

**Java 实现问题 (2127 行)**:
- 多层表头检测: 手写合并单元格处理 (~300 行)
- 数据方向检测: 复杂的启发式规则 (~200 行)
- 数据转置: 手动行列转换 (~150 行)
- 字段类型检测: 大量正则和阈值判断 (~400 行)

**Python 优势**:
```python
# 多层表头 (Java 300行 → Python 1行)
df = pd.read_excel(file, header=[0, 1, 2])

# 数据转置 (Java 150行 → Python 1行)
df_long = df.melt(id_vars=['项目'], var_name='period', value_name='value')

# 字段类型检测 (Java 400行 → Python 10行)
for col in df.columns:
    if pd.api.types.is_datetime64_any_dtype(df[col]):
        type = 'DATE'
    elif pd.api.types.is_numeric_dtype(df[col]):
        type = 'NUMERIC'
```

**代码简化**: Java 2127 行 → Python ~300 行 (减少 86%)

#### B. LLM 字段映射模块 (LLMFieldMappingServiceImpl) - 🔄 部分迁移

**Java 实现 (1001 行)**:
- LLM API 调用封装
- 响应解析与错误处理
- 字典缓存查询
- 图表角色推断

**迁移策略**:
- **迁移**: LLM 调用、响应解析、角色推断
- **保留 Java**: 字典缓存查询 (需要数据库事务)

**Python 优势**:
```python
# LLM 调用更简洁
from dashscope import Generation

response = Generation.call(
    model='qwen-turbo',
    messages=[{'role': 'user', 'content': prompt}]
)
result = json.loads(response.output.text)
```

#### C. 指标计算模块 (MetricCalculatorServiceImpl) - 🔄 迁移

**Java 实现 (833 行)**:
- 30+ 业务指标定义
- 分组聚合计算
- 趋势计算
- 预警判断

**Python 优势**:
```python
# 销售指标 (Java 50行 → Python 5行)
metrics = df.groupby('salesperson').agg({
    'amount': ['sum', 'count', 'mean'],
    'order_id': 'nunique',
    'customer': 'nunique'
})

# 目标完成率
metrics['completion_rate'] = metrics['amount_sum'] / targets * 100

# 环比增长
metrics['mom_growth'] = metrics['amount_sum'].pct_change() * 100
```

**代码简化**: Java 833 行 → Python ~150 行 (减少 82%)

#### D. 预测模块 (ForecastServiceImpl) - 🔄 迁移

**Java 实现 (565 行)**:
- 移动平均: 手动实现
- 线性趋势: 手写最小二乘法
- 指数平滑: 手动实现
- 置信区间: 手动计算标准差

**Python 优势**:
```python
# 移动平均 (Java 30行 → Python 1行)
df['ma7'] = df['value'].rolling(7).mean()

# 指数平滑 (Java 50行 → Python 3行)
from statsmodels.tsa.holtwinters import ExponentialSmoothing
model = ExponentialSmoothing(data, trend='add')
forecast = model.fit().forecast(30)

# Prophet 高级预测 (Java 无法实现)
from prophet import Prophet
model = Prophet()
model.fit(df)
future = model.predict(model.make_future_dataframe(periods=30))
```

**代码简化**: Java 565 行 → Python ~80 行 (减少 86%)

#### E. 图表配置生成 (DynamicChartConfigBuilder) - 🔄 迁移

**Java 实现 (300+ 行)**:
- 数据特征分析
- 图表类型推荐
- ECharts 配置生成

**Python 优势**:
```python
# 数据特征分析
features = {
    'has_time': df.select_dtypes('datetime').shape[1] > 0,
    'numeric_cols': df.select_dtypes('number').columns.tolist(),
    'categorical_cols': df.select_dtypes('object').columns.tolist(),
    'unique_counts': {col: df[col].nunique() for col in df.columns}
}

# 图表推荐规则
if features['has_time'] and len(features['numeric_cols']) >= 1:
    chart_type = 'line'
elif len(features['categorical_cols']) >= 1:
    chart_type = 'bar'
```

### 3.4.3 保留在 Java 的模块

| 模块 | 原因 |
|------|------|
| SmartBIUploadFlowService | 流程编排、事务管理、多步骤原子性 |
| SmartBIServiceImpl | 缓存管理、配额控制、使用记录 |
| SmartBIConfigService | 配置 CRUD、权限校验 |
| ExcelDataPersistenceService | 数据库写入、事务 |
| SmartBIIntentService | 与意图系统集成 |

### 3.4.4 代码简化效果汇总

| 模块 | Java 行数 | Python 行数 | 简化比例 |
|------|----------|------------|---------|
| Excel 解析 | 2127 | ~300 | 86% |
| 指标计算 | 833 | ~150 | 82% |
| 预测服务 | 565 | ~80 | 86% |
| LLM 映射 | 1001 | ~200 | 80% |
| 图表配置 | 300 | ~100 | 67% |
| **合计** | **4826** | **~830** | **83%**
3.5 推荐算法 (LinUCB) - 🔄 迁移 Python
代码规模: 840 行，核心矩阵运算

核心功能:

UCB 计算: UCB(a) = θ^T * x + α * sqrt(x^T * A^(-1) * x)
模型更新: Sherman-Morrison 矩阵更新
工人推荐、多样性调整
为什么迁移 Python:

✅ numpy 矩阵运算: Java 60 行 → Python 1 行
✅ 性能: Python numpy 比 Java 快 10-20x
✅ scipy.linalg.inv() 数值稳定性更好

# Python 版本
A_inv = np.linalg.inv(A)           # 矩阵求逆
theta = A_inv @ b                   # 参数向量
ucb = context @ theta + alpha * np.sqrt(context @ A_inv @ context)
性能对比:

Java 矩阵求逆 (16x16): ~5-10ms
Python numpy (16x16): ~0.2-0.5ms ✅ 快 10-20 倍
3.6 调度系统 - ✅ 保持 Java
代码规模: 500+ 行，复杂业务逻辑

核心功能:

计划生成、工人优化
约束管理 (Drools 规则)
动态重排、告警监控
为什么保持 Java:

✅ 极复杂业务逻辑 - 约束求解、规则引擎
✅ 重事务 - 批量创建需原子性
✅ Drools 规则引擎成熟
✅ 异步任务 - Spring @Async 完善
优化方案: 调度主体保留 Java，但 LinUCB 调用改为 Python 服务


SchedulingService (Java) ──HTTP──► LinUCB-Service (Python)
四、迁移服务详细清单

4.1 🔄 迁移到 Python 的服务

### P0 - SmartBI 核心功能 (立即迁移)

#### P0.1 数据解析层

| Java 服务 | 功能 | Java 行数 | Python 方案 | Python 行数 |
|----------|------|----------|------------|------------|
| ExcelDynamicParserServiceImpl | 多层表头检测 | 300+ | `pd.read_excel(header=[0,1,2])` | 10 |
| (同上) | 数据方向检测 | 200+ | `df.T` + 启发式规则 | 30 |
| (同上) | 合并单元格处理 | 200+ | `openpyxl` 自动处理 | 20 |
| (同上) | 数据转置 (宽→长) | 150+ | `pd.melt()` | 5 |
| (同上) | 字段类型检测 | 400+ | `pd.api.types` + 统计 | 50 |
| (同上) | 数据特征分析 | 300+ | `df.describe()` + 自定义 | 40 |

#### P0.2 字段识别层

| Java 服务 | 功能 | Java 行数 | Python 方案 | Python 行数 |
|----------|------|----------|------------|------------|
| LLMFieldMappingServiceImpl | LLM 字段映射 | 400+ | DashScope SDK 直接调用 | 80 |
| (同上) | 字段角色推断 | 300+ | 规则引擎 + LLM | 60 |
| (同上) | 图表轴位置推荐 | 200+ | 特征分析 + 规则 | 40 |
| FieldMappingDictionary | 标准字段匹配 | 150+ | 模糊匹配 + 同义词库 | 30 |

#### P0.3 数据处理层

| Java 服务 | 功能 | Java 行数 | Python 方案 | Python 行数 |
|----------|------|----------|------------|------------|
| MetricCalculatorServiceImpl | 30+ 业务指标 | 833 | pandas 聚合 | 150 |
| (同上) | 分组维度计算 | 200+ | `df.groupby().agg()` | 20 |
| (同上) | 趋势计算 | 100+ | `pct_change()` | 10 |
| (同上) | 预警判断 | 150+ | 阈值配置 + 规则 | 30 |

#### P0.4 分析服务层

| Java 服务 | 功能 | Java 行数 | Python 方案 | Python 行数 |
|----------|------|----------|------------|------------|
| SalesAnalysisServiceImpl | 销售 KPI、排名、趋势 | 400+ | pandas 聚合 | 80 |
| FinanceAnalysisServiceImpl | 财务指标、同环比 | 350+ | pandas + 公式 | 70 |
| DepartmentAnalysisServiceImpl | 部门排名、效率 | 300+ | pandas 聚合 | 60 |
| RegionAnalysisServiceImpl | 区域下钻、热力图 | 350+ | pandas + 地理 | 70 |

#### P0.5 预测服务层

| Java 服务 | 功能 | Java 行数 | Python 方案 | Python 行数 |
|----------|------|----------|------------|------------|
| ForecastServiceImpl | 移动平均 | 50+ | `rolling().mean()` | 3 |
| (同上) | 线性趋势 | 80+ | `scipy.stats.linregress` | 5 |
| (同上) | 指数平滑 | 60+ | `statsmodels.ExponentialSmoothing` | 5 |
| (同上) | 高级预测 | - | `prophet.Prophet` | 10 |
| (同上) | 置信区间 | 100+ | 内置于库 | 0 |

#### P0.6 LLM 分析层

| Java 服务 | 功能 | Java 行数 | Python 方案 | Python 行数 |
|----------|------|----------|------------|------------|
| SmartBIPromptService | AI 洞察生成 | 200+ | LangChain / DashScope | 50 |
| (同上) | 业务建议生成 | 150+ | Prompt Engineering | 30 |
| RecommendationServiceImpl | 预警文本生成 | 200+ | 模板 + LLM | 40 |

#### P0.7 图表生成层

| Java 服务 | 功能 | Java 行数 | Python 方案 | Python 行数 |
|----------|------|----------|------------|------------|
| DataFeatureExtractor | 数据特征提取 | 200+ | pandas 统计 | 40 |
| AdaptiveChartGenerator | 图表类型推荐 | 200+ | 规则引擎 | 50 |
| DynamicChartConfigBuilder | ECharts 配置生成 | 300+ | JSON 模板 + 数据填充 | 80 |

### P0 代码量汇总

| 层次 | Java 总行数 | Python 预估 | 简化比例 |
|------|-----------|------------|---------|
| 数据解析 | 1550+ | ~155 | 90% |
| 字段识别 | 1050+ | ~210 | 80% |
| 数据处理 | 1283+ | ~210 | 84% |
| 分析服务 | 1400+ | ~280 | 80% |
| 预测服务 | 290+ | ~23 | 92% |
| LLM 分析 | 550+ | ~120 | 78% |
| 图表生成 | 700+ | ~170 | 76% |
| **P0 总计** | **6823+** | **~1168** | **83%**
P1 - 尽快迁移 (ML 算法 + 纠错)
Java 服务	功能	Python 方案
LinUCBServiceImpl	上下文老虎机	numpy 矩阵运算
FairMABServiceImpl	公平多臂老虎机	numpy
FeatureEngineeringServiceImpl	16 维特征提取	scikit-learn
IndividualEfficiencyServiceImpl	效率分解	scipy.linalg
ErrorAttributionAnalysisServiceImpl	纠错统计	pandas 聚合
RecommendationServiceImpl	预警生成	pandas + 规则
4.2 ✅ 保留在 Java 的服务
意图识别系统 (保留 Java)
Java 服务	原因
AIIntentServiceImpl	复杂业务逻辑、实时响应、多租户隔离
IntentExecutorServiceImpl	Tool 编排、事务管理
MultiLabelIntentClassifierImpl	与意图系统紧密耦合
Agent/Skill 系统 (保留 Java)
Java 服务	原因
AgentOrchestratorService	Spring DI 管理、反射路由
SkillRouterService	强类型参数、异常处理
所有 *Tool 实现	与后端 API 紧密集成
调度系统主体 (保留 Java)
Java 服务	原因
SchedulingServiceImpl	重事务、约束求解
APSAdaptiveSchedulingServiceImpl	Drools 规则引擎
RescheduleTriggerServiceImpl	异步任务、通知推送
注意: 调度系统保留 Java，但调用 Python 的 LinUCB 服务

五、技术架构
5.1 整体架构

┌─────────────────────────────────────────────────────────────────┐
│                    前端 (React Native / Web)                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Java 后端 (Spring Boot :10010)                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Controllers - REST API 入口 (保持不变)                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌───────────────────────────┴───────────────────────────┐     │
│  │                    服务调用层                          │     │
│  │  ┌─────────────┐              ┌─────────────────────┐│     │
│  │  │ HTTP Client │──────────►  │ Python 服务 (:8081)  ││     │
│  │  │ (调用 Python)│              │ 数据处理/分析/ML    ││     │
│  │  └─────────────┘              └─────────────────────┘│     │
│  │         │                              ▲             │     │
│  │         │ Fallback                     │             │     │
│  │         ▼                              │             │     │
│  │  ┌─────────────┐                       │             │     │
│  │  │ Java 原有   │                       │             │     │
│  │  │ 实现 (备用) │                       │             │     │
│  │  └─────────────┘                       │             │     │
│  └────────────────────────────────────────│─────────────┘     │
│                              │            │                    │
│  ┌───────────────────────────┴────────────│─────────────┐     │
│  │ 数据持久化层 (JPA/MyBatis)              │             │     │
│  └─────────────────────────────────────────│─────────────┘     │
└────────────────────────────────────────────│─────────────────────┘
                                            │
                                            ▼
                              ┌─────────────────────────┐
                              │   数据库 (MySQL :3306)   │
                              └─────────────────────────┘
5.2 Python SmartBI 服务架构

```
smartbi-python-service/
├── main.py                           # FastAPI 入口
├── config.py                         # 配置 (端口、LLM Key 等)
├── requirements.txt                  # 依赖
├── Dockerfile                        # Docker 配置
│
├── api/                              # API 路由 (对应 P0 各层)
│   ├── __init__.py
│   ├── excel.py                      # P0.1 数据解析 API
│   ├── field_mapping.py              # P0.2 字段识别 API
│   ├── metrics.py                    # P0.3 数据处理 API
│   ├── analysis.py                   # P0.4 分析服务 API
│   ├── forecast.py                   # P0.5 预测服务 API
│   ├── insights.py                   # P0.6 LLM 分析 API
│   └── chart.py                      # P0.7 图表生成 API
│
├── services/                         # 业务服务
│   ├── __init__.py
│   │
│   ├── excel/                        # P0.1 数据解析
│   │   ├── parser.py                 # 核心解析逻辑
│   │   ├── header_detector.py        # 多层表头检测
│   │   ├── direction_detector.py     # 数据方向检测
│   │   └── transformer.py            # 数据转置
│   │
│   ├── field/                        # P0.2 字段识别
│   │   ├── type_detector.py          # 字段类型检测
│   │   ├── llm_mapper.py             # LLM 字段映射
│   │   ├── role_analyzer.py          # 字段角色分析
│   │   └── chart_axis_recommender.py # 图表轴推荐
│   │
│   ├── metric/                       # P0.3 数据处理
│   │   ├── calculator.py             # 指标计算引擎
│   │   ├── aggregator.py             # 分组聚合
│   │   └── alert_checker.py          # 预警判断
│   │
│   ├── analysis/                     # P0.4 分析服务
│   │   ├── sales_analysis.py         # 销售分析
│   │   ├── finance_analysis.py       # 财务分析
│   │   ├── department_analysis.py    # 部门分析
│   │   └── region_analysis.py        # 区域分析
│   │
│   ├── forecast/                     # P0.5 预测服务
│   │   ├── moving_average.py         # 移动平均
│   │   ├── exponential_smoothing.py  # 指数平滑
│   │   ├── linear_trend.py           # 线性趋势
│   │   └── prophet_wrapper.py        # Prophet 封装
│   │
│   ├── insight/                      # P0.6 LLM 分析
│   │   ├── prompt_builder.py         # Prompt 构建
│   │   ├── llm_client.py             # LLM API 封装
│   │   └── insight_generator.py      # 洞察生成
│   │
│   └── chart/                        # P0.7 图表生成
│       ├── feature_extractor.py      # 数据特征提取
│       ├── chart_recommender.py      # 图表类型推荐
│       └── echarts_builder.py        # ECharts 配置生成
│
├── models/                           # Pydantic 数据模型
│   ├── __init__.py
│   ├── excel_models.py               # Excel 相关
│   ├── field_models.py               # 字段映射相关
│   ├── metric_models.py              # 指标相关
│   ├── analysis_models.py            # 分析相关
│   ├── forecast_models.py            # 预测相关
│   └── chart_models.py               # 图表相关
│
└── utils/                            # 工具函数
    ├── __init__.py
    ├── date_utils.py                 # 日期处理
    ├── number_utils.py               # 数值格式化
    └── cache.py                      # 简单缓存
```

### 5.3 API 端点详细设计 (P0)

#### P0.1 数据解析 API

```
POST /api/excel/parse
- 输入: Excel 文件 (multipart/form-data)
- 输出: {
    headers: [[...], [...]], // 多层表头
    rows: [...],
    dataDirection: 'horizontal' | 'vertical',
    fieldFeatures: [{name, type, uniqueCount, sampleValues}]
  }

POST /api/excel/transform
- 输入: { data: [...], transformType: 'wide_to_long' | 'long_to_wide', config: {...} }
- 输出: { transformed: [...] }
```

#### P0.2 字段识别 API

```
POST /api/field/detect-types
- 输入: { columns: [{name, values}] }
- 输出: { results: [{name, type, format, confidence}] }

POST /api/field/map-with-llm
- 输入: { headers: [...], sampleRows: [...], context: '销售数据' }
- 输出: { mappings: [{original, standard, alias, role, chartAxis, confidence}] }

POST /api/field/recommend-chart-config
- 输入: { mappings: [...] }
- 输出: { xAxisField, seriesField, yAxisFields, chartType }
```

#### P0.3 数据处理 API

```
POST /api/metrics/calculate
- 输入: { data: [...], metrics: ['sales_amount', 'order_count'], fieldMappings: {...} }
- 输出: { results: [{metricCode, value, formattedValue, alertLevel}] }

POST /api/metrics/calculate-by-dimension
- 输入: { data: [...], dimensionField: 'salesperson', metrics: [...] }
- 输出: { groups: { '张三': [...], '李四': [...] } }

POST /api/metrics/trend
- 输入: { currentValue: 100, previousValue: 80 }
- 输出: { change: 20, changePercent: 25, direction: 'UP' }
```

#### P0.4 分析服务 API

```
POST /api/analysis/sales
- 输入: { data: [...], dimensions: ['date', 'salesperson'], period: '2025-01' }
- 输出: { kpis: {...}, trends: [...], rankings: [...], topProducts: [...] }

POST /api/analysis/finance
- 输入: { data: [...], metrics: ['gross_profit', 'net_margin'] }
- 输出: { profitAnalysis: {...}, costBreakdown: {...}, budgetComparison: {...} }
```

#### P0.5 预测服务 API

```
POST /api/forecast/predict
- 输入: { data: [{date, value}], algorithm: 'auto' | 'prophet' | 'ma', periods: 30 }
- 输出: { forecast: [{date, value, lower, upper}], algorithm: 'prophet', confidence: 85 }

POST /api/forecast/auto-select
- 输入: { data: [...] }
- 输出: { algorithm: 'prophet', reason: '数据有明显季节性特征' }
```

#### P0.6 LLM 分析 API

```
POST /api/insight/generate
- 输入: { analysisResult: {...}, context: '销售分析', language: 'zh' }
- 输出: { summary: '...', keyFindings: [...], recommendations: [...] }

POST /api/insight/explain-metric
- 输入: { metricName: '毛利率下降', value: -5.2, context: {...} }
- 输出: { explanation: '...', possibleCauses: [...], suggestedActions: [...] }
```

#### P0.7 图表生成 API

```
POST /api/chart/recommend
- 输入: { dataFeatures: {...} }
- 输出: { chartType: 'line', reason: '时间序列数据适合折线图' }

POST /api/chart/build-config
- 输入: { data: [...], chartType: 'bar', xField: 'date', yFields: ['sales'] }
- 输出: { echartOptions: {...} } // 完整 ECharts 配置
```

### 5.4 Java Fallback 机制设计

```java
// PythonSmartBIClient.java
@Service
@Slf4j
public class PythonSmartBIClient {

    @Value("${python-smartbi.enabled:true}")
    private boolean enabled;

    @Value("${python-smartbi.url:http://localhost:8081}")
    private String baseUrl;

    @Value("${python-smartbi.timeout:30000}")
    private int timeout;

    @Value("${python-smartbi.fallback-on-error:true}")
    private boolean fallbackOnError;

    // 原有 Java 服务 (作为 Fallback)
    @Autowired
    private ExcelDynamicParserService javaExcelParser;
    @Autowired
    private MetricCalculatorService javaMetricCalculator;
    @Autowired
    private ForecastService javaForecastService;

    private final RestTemplate restTemplate;

    // ==================== Excel 解析 ====================

    public ExcelParseResult parseExcel(MultipartFile file) {
        if (!enabled) {
            log.info("[SmartBI] Python 服务已禁用，使用 Java 实现");
            return javaExcelParser.parse(file);
        }

        try {
            // 调用 Python 服务
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename();
                }
            });

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            ResponseEntity<ExcelParseResult> response = restTemplate.exchange(
                baseUrl + "/api/excel/parse",
                HttpMethod.POST,
                requestEntity,
                ExcelParseResult.class
            );

            log.info("[SmartBI] Python Excel 解析成功");
            return response.getBody();

        } catch (Exception e) {
            log.warn("[SmartBI] Python Excel 解析失败: {}", e.getMessage());

            if (fallbackOnError) {
                log.info("[SmartBI] Fallback 到 Java 实现");
                return javaExcelParser.parse(file);
            }
            throw new SmartBIException("Excel 解析服务不可用", e);
        }
    }

    // ==================== 指标计算 ====================

    public List<MetricResult> calculateMetrics(List<Map<String, Object>> data,
                                               List<String> metrics,
                                               Map<String, String> fieldMappings) {
        if (!enabled) {
            return javaMetricCalculator.calculateAllMetrics(data, fieldMappings);
        }

        try {
            MetricCalculateRequest request = new MetricCalculateRequest();
            request.setData(data);
            request.setMetrics(metrics);
            request.setFieldMappings(fieldMappings);

            ResponseEntity<MetricCalculateResponse> response = restTemplate.postForEntity(
                baseUrl + "/api/metrics/calculate",
                request,
                MetricCalculateResponse.class
            );

            return response.getBody().getResults();

        } catch (Exception e) {
            log.warn("[SmartBI] Python 指标计算失败: {}, fallback", e.getMessage());
            return javaMetricCalculator.calculateAllMetrics(data, fieldMappings);
        }
    }

    // ==================== 预测服务 ====================

    public ForecastResult forecast(List<DataPoint> data, String algorithm, int periods) {
        if (!enabled) {
            return javaForecastService.forecastMetric(...);
        }

        try {
            ForecastRequest request = ForecastRequest.builder()
                .data(data)
                .algorithm(algorithm)
                .periods(periods)
                .build();

            ResponseEntity<ForecastResult> response = restTemplate.postForEntity(
                baseUrl + "/api/forecast/predict",
                request,
                ForecastResult.class
            );

            return response.getBody();

        } catch (Exception e) {
            log.warn("[SmartBI] Python 预测失败: {}, fallback", e.getMessage());
            return javaForecastService.forecastMetric(...);
        }
    }

    // ==================== 健康检查 ====================

    public boolean isAvailable() {
        if (!enabled) return false;

        try {
            ResponseEntity<Map> response = restTemplate.getForEntity(
                baseUrl + "/health",
                Map.class
            );
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            return false;
        }
    }
}
```

### 5.5 配置设计

```yaml
# application.yml
python-smartbi:
  enabled: true                    # 总开关
  url: http://localhost:8081       # Python 服务地址
  timeout: 30000                   # 超时时间 (ms)
  fallback-on-error: true          # 错误时是否 fallback 到 Java

  # 各模块独立开关 (可选)
  modules:
    excel-parser: true             # Excel 解析
    field-mapping: true            # 字段映射
    metric-calculator: true        # 指标计算
    forecast: true                 # 预测服务
    llm-insight: true              # LLM 洞察
    chart-builder: true            # 图表生成
```
六、API 设计
6.1 Excel 处理 API

POST /api/excel/parse
- 输入: Excel 文件 (multipart/form-data)
- 输出: 标准化 JSON (headers, rows, fieldMappings)

POST /api/excel/preview
- 输入: Excel 文件 + max_rows
- 输出: 预览数据
6.2 预测 API

POST /api/forecast/predict
- 输入: { "data": [...], "algorithm": "prophet", "periods": 12 }
- 输出: { "forecast": [...], "confidence_interval": {...} }

POST /api/forecast/auto-select
- 输入: { "data": [...] }
- 输出: { "recommended_algorithm": "prophet", "reason": "..." }
6.3 指标计算 API

POST /api/metrics/calculate
- 输入: { "metric_type": "sales", "data": [...], "dimensions": ["region", "product"] }
- 输出: { "results": [...], "aggregations": {...} }

POST /api/metrics/batch
- 输入: { "metrics": ["sales", "cost", "profit"], "data": [...] }
- 输出: { "results": { "sales": {...}, "cost": {...}, "profit": {...} } }
6.4 ML 算法 API

POST /api/ml/linucb/recommend
- 输入: { "context": [...], "arms": [...], "history": [...] }
- 输出: { "recommended_arm": 0, "ucb_values": [...] }

POST /api/ml/features/extract
- 输入: { "task": {...}, "worker": {...} }
- 输出: { "features": [...] }
6.5 分析 API

POST /api/analysis/sales
- 输入: { "factory_id": "F001", "period": "2025-01", "dimensions": [...] }
- 输出: { "kpis": {...}, "trends": [...], "rankings": [...] }

POST /api/analysis/inventory-health
- 输入: { "factory_id": "F001", "items": [...] }
- 输出: { "scores": {...}, "alerts": [...], "recommendations": [...] }
七、Java 集成方案
修改的 Java 文件
文件	修改内容
application.yml	添加 Python 服务 URL 配置
SmartBIUploadFlowServiceImpl.java	调用 Python Excel 服务
ForecastServiceImpl.java	调用 Python 预测服务
MetricCalculatorServiceImpl.java	调用 Python 指标计算
LinUCBServiceImpl.java	调用 Python LinUCB
配置示例

# application.yml
python-analytics:
  url: http://localhost:8081
  enabled: true
  timeout: 30000
  endpoints:
    excel-parse: /api/excel/parse
    forecast: /api/forecast/predict
    metrics: /api/metrics/calculate
    linucb: /api/ml/linucb/recommend
调用示例

@Service
public class PythonAnalyticsClient {

    @Value("${python-analytics.url}")
    private String pythonServiceUrl;

    private final RestTemplate restTemplate;

    public <T> T callPythonService(String endpoint, Object request, Class<T> responseType) {
        try {
            ResponseEntity<T> response = restTemplate.postForEntity(
                pythonServiceUrl + endpoint,
                request,
                responseType
            );
            return response.getBody();
        } catch (Exception e) {
            log.warn("Python 服务调用失败，使用 Java fallback: {}", e.getMessage());
            return null; // 触发 fallback
        }
    }
}
八、P0 详细实施计划

### Phase 1: 项目搭建 + Excel 解析 (1-2 天)

#### Day 1 上午: 项目初始化
```bash
# 1. 创建项目结构
mkdir -p smartbi-python-service/{api,services/{excel,field,metric,analysis,forecast,insight,chart},models,utils}

# 2. 初始化 Python 环境
cd smartbi-python-service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 3. 安装依赖
pip install fastapi uvicorn pandas openpyxl python-multipart pydantic
```

#### Day 1 下午: Excel 解析核心
- [ ] `main.py` - FastAPI 入口 + 健康检查
- [ ] `services/excel/parser.py` - 核心解析逻辑
- [ ] `services/excel/header_detector.py` - 多层表头检测
- [ ] `api/excel.py` - Excel API 路由

#### Day 2 上午: Excel 高级功能
- [ ] `services/excel/direction_detector.py` - 数据方向检测
- [ ] `services/excel/transformer.py` - 数据转置 (宽→长)
- [ ] `models/excel_models.py` - 请求/响应模型

#### Day 2 下午: 测试 + Java 集成
- [ ] 单元测试 (多层表头、数据转置)
- [ ] `PythonSmartBIClient.java` - Java 客户端
- [ ] `SmartBIUploadFlowServiceImpl.java` 修改 - 调用 Python

### Phase 2: 字段识别 + 指标计算 (2-3 天)

#### Day 3: 字段识别
- [ ] `services/field/type_detector.py` - 字段类型检测
- [ ] `services/field/llm_mapper.py` - LLM 字段映射
- [ ] `services/field/role_analyzer.py` - 字段角色分析
- [ ] `api/field_mapping.py` - 字段 API

#### Day 4: 指标计算
- [ ] `services/metric/calculator.py` - 30+ 指标实现
- [ ] `services/metric/aggregator.py` - 分组聚合
- [ ] `services/metric/alert_checker.py` - 预警判断
- [ ] `api/metrics.py` - 指标 API

#### Day 5: 测试 + 集成
- [ ] 指标计算单元测试
- [ ] Java `MetricCalculatorServiceImpl` 集成
- [ ] Fallback 机制测试

### Phase 3: 预测 + 分析服务 (3-4 天)

#### Day 6: 预测服务
- [ ] 安装 `statsmodels`, `prophet`
- [ ] `services/forecast/moving_average.py`
- [ ] `services/forecast/exponential_smoothing.py`
- [ ] `services/forecast/prophet_wrapper.py`
- [ ] `api/forecast.py`

#### Day 7-8: 分析服务
- [ ] `services/analysis/sales_analysis.py`
- [ ] `services/analysis/finance_analysis.py`
- [ ] `services/analysis/department_analysis.py`
- [ ] `api/analysis.py`

#### Day 9: 集成测试
- [ ] Java `ForecastServiceImpl` 集成
- [ ] Java `SalesAnalysisServiceImpl` 集成
- [ ] 端到端测试

### Phase 4: LLM 洞察 + 图表生成 (2-3 天)

#### Day 10: LLM 洞察
- [ ] 安装 `dashscope`
- [ ] `services/insight/llm_client.py` - LLM API 封装
- [ ] `services/insight/prompt_builder.py` - Prompt 模板
- [ ] `services/insight/insight_generator.py` - 洞察生成
- [ ] `api/insights.py`

#### Day 11: 图表生成
- [ ] `services/chart/feature_extractor.py` - 数据特征
- [ ] `services/chart/chart_recommender.py` - 图表推荐
- [ ] `services/chart/echarts_builder.py` - 配置生成
- [ ] `api/chart.py`

#### Day 12: 最终集成
- [ ] Java 端完整集成
- [ ] 所有 Fallback 测试
- [ ] 性能测试

### Phase 5: 部署 + 验证 (1-2 天)

#### Day 13: 部署
- [ ] `Dockerfile` 编写
- [ ] `docker-compose.yml`
- [ ] 服务器部署 (139.196.165.140:8081)
- [ ] systemd 服务配置

#### Day 14: 验证
- [ ] 生产环境验证
- [ ] 监控配置
- [ ] 文档更新

---

## 九、P0 验证检查清单

### 9.1 Excel 解析验证

| 测试场景 | 测试文件 | 预期结果 | 状态 |
|---------|---------|---------|------|
| 单层表头 | simple.xlsx | 正确解析 | [ ] |
| 双层表头 | header_2level.xlsx | 自动合并 | [ ] |
| 三层表头 | header_3level.xlsx | 自动合并 | [ ] |
| 横向数据 | horizontal.xlsx | 检测方向并转置 | [ ] |
| 纵向数据 | vertical.xlsx | 直接解析 | [ ] |
| 合并单元格 | merged_cells.xlsx | 正确展开 | [ ] |
| 数值全为 0 问题 | old_problem.xlsx | 数值正确 | [ ] |

### 9.2 字段识别验证

| 测试场景 | 输入 | 预期输出 | 状态 |
|---------|------|---------|------|
| 日期检测 | "2025-01-01" | type=DATE | [ ] |
| 金额检测 | "1,234.56" | type=AMOUNT | [ ] |
| 百分比检测 | "85.5%" | type=PERCENTAGE | [ ] |
| LLM 映射 | "销售金额" | standard=sales_amount | [ ] |
| 图表轴推荐 | 日期字段 | chartAxis=X_AXIS | [ ] |

### 9.3 指标计算验证

| 指标 | 公式 | 测试数据 | 预期结果 | 状态 |
|------|------|---------|---------|------|
| 销售额 | SUM(amount) | [100, 200, 300] | 600 | [ ] |
| 订单数 | COUNT(DISTINCT order_id) | 3 个订单 | 3 | [ ] |
| 客单价 | 销售额/订单数 | 600/3 | 200 | [ ] |
| 环比增长 | (本期-上期)/上期 | 120 vs 100 | 20% | [ ] |
| 目标完成率 | 实际/目标 | 85/100 | 85% | [ ] |

### 9.4 预测验证

| 算法 | 输入数据 | 预测天数 | 验证点 | 状态 |
|------|---------|---------|-------|------|
| 移动平均 | 30 天销售 | 7 | 趋势合理 | [ ] |
| 指数平滑 | 30 天销售 | 7 | 趋势合理 | [ ] |
| Prophet | 90 天销售 | 30 | 置信区间合理 | [ ] |

### 9.5 Fallback 机制验证

| 场景 | 操作 | 预期行为 | 状态 |
|------|------|---------|------|
| Python 服务正常 | 正常请求 | 使用 Python 结果 | [ ] |
| Python 服务超时 | 设置 1ms 超时 | Fallback 到 Java | [ ] |
| Python 服务宕机 | 停止 Python | Fallback 到 Java | [ ] |
| 配置禁用 Python | enabled=false | 直接使用 Java | [ ] |
| 部分模块禁用 | modules.excel=false | 该模块用 Java | [ ] |

### 9.6 性能验证

| 场景 | 数据量 | Python 耗时 | Java 耗时 | 目标 |
|------|-------|-----------|----------|------|
| Excel 解析 | 1000 行 | < 2s | ~5s | Python 更快 |
| 指标计算 | 10000 行 | < 1s | ~3s | Python 更快 |
| 预测 (Prophet) | 365 天 | < 5s | N/A | 可用 |

---

## 十、依赖清单 (更新)
## 十一、依赖清单 (P0 完整版)

```txt
# requirements.txt - SmartBI Python Service

# === 核心框架 ===
fastapi==0.109.0
uvicorn==0.27.0
pydantic==2.5.3
python-multipart==0.0.6      # 文件上传

# === 数据处理 (P0.1-P0.3) ===
pandas==2.1.4
numpy==1.26.3
openpyxl==3.1.2              # Excel 读取

# === 统计与预测 (P0.5) ===
statsmodels==0.14.1          # 指数平滑、ARIMA
scipy==1.12.0                # 统计计算
prophet==1.1.5               # 高级时间序列预测

# === LLM 集成 (P0.2, P0.6) ===
dashscope==1.14.0            # 阿里云 LLM API
httpx==0.26.0                # HTTP 客户端

# === 可选依赖 ===
# scikit-learn==1.4.0        # ML 算法 (P1)
# redis==5.0.1               # 缓存 (可选)
```

### 依赖说明

| 依赖 | 用途 | P0 模块 | 是否必需 |
|------|------|--------|---------|
| pandas | 数据处理核心 | P0.1-P0.4 | ✅ 必需 |
| openpyxl | Excel 解析 | P0.1 | ✅ 必需 |
| statsmodels | 预测算法 | P0.5 | ✅ 必需 |
| prophet | 高级预测 | P0.5 | ⚠️ 可选 |
| dashscope | LLM API | P0.2, P0.6 | ✅ 必需 |
| scipy | 统计计算 | P0.3, P0.5 | ✅ 必需 |
十、验证检查清单
Excel 解析
 单层表头 Excel 正常解析
 多层表头 Excel 正常解析
 数值字段不再是 0
 字段映射正确
预测服务
 移动平均正确
 Prophet 预测正确
 置信区间正确
集成验证
 Java 后端能调用 Python 服务
 Python 服务不可用时 fallback 正常
 数据正确存入数据库
部署验证
 Docker 运行正常
 服务器端口 8081 可访问
 日志正常记录
十一、风险与缓解
风险	缓解措施
Python 服务不可用	保留 Java fallback
性能问题	添加缓存、异步处理
部署复杂度增加	使用 Docker 简化
数据格式不兼容	统一 JSON schema
十二、Python 对 ML/算法的优势详解
11.1 当前 Java 实现的复杂度
功能	Java 代码行数	问题
LinUCB 矩阵运算	120+ 行	手写 dotProduct, outerProduct, matrixAdd, invertMatrix
高斯-约旦消元	60 行	数值稳定性差，需自己处理奇异矩阵
特征工程	767 行	大量冗余代码
预测算法	200+ 行	移动平均、指数平滑需手动实现
11.2 Python 的简化效果

# LinUCB 核心计算 (Java 120行 → Python 5行)
import numpy as np

A_inv = np.linalg.inv(A)           # 矩阵求逆
theta = A_inv @ b                   # 参数向量
expected = context @ theta          # 期望奖励
confidence = np.sqrt(context @ A_inv @ context)  # 置信宽度
ucb = expected + alpha * confidence # UCB 值

# 预测 (Java 200行 → Python 10行)
from statsmodels.tsa.holtwinters import ExponentialSmoothing
model = ExponentialSmoothing(data, trend='add', seasonal='add')
forecast = model.fit().forecast(12)
11.3 Python 确实更好的原因
方面	Java	Python	优势
矩阵运算	手动实现，效率低	NumPy C底层，高效	性能 10x+
算法库	需引入第三方	sklearn/scipy 原生	生态完整
数值稳定性	自己处理边界	库已优化	更可靠
开发效率	100行=10行	代码简洁	10x 开发效率
算法更新	改多处代码	换个库/参数	易于迭代
十三、服务架构与维护策略
12.1 Python 服务定位
作为独立微服务，不是模块嵌入


┌─────────────────────────────────────────────────────────────┐
│                    Java Backend (:10010)                     │
│                                                              │
│   ┌────────────────────────────────────────────────────┐    │
│   │ Business Logic Layer (保留在 Java)                  │    │
│   │ - Controller (API 入口)                             │    │
│   │ - 权限验证、事务管理                                │    │
│   │ - 数据库 CRUD (JPA)                                │    │
│   │ - 缓存管理 (Redis)                                 │    │
│   └────────────────────────────────────────────────────┘    │
│                         │                                    │
│                         │ HTTP/JSON                          │
│                         ▼                                    │
│   ┌────────────────────────────────────────────────────┐    │
│   │ Python Client (Java 中的适配层)                     │    │
│   │ - PythonAnalyticsClient.java (100行)               │    │
│   │ - 调用 Python 服务，处理响应                        │    │
│   │ - Fallback 到 Java 原有实现                        │    │
│   └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ HTTP/JSON (内网)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               Python Analytics Service (:8081)               │
│                                                              │
│   ┌──────────────────┐  ┌──────────────────┐                │
│   │ Excel 处理模块   │  │ 预测/统计模块     │                │
│   │ - 多层表头解析   │  │ - 时间序列预测   │                │
│   │ - 数据转换      │  │ - 指标计算       │                │
│   └──────────────────┘  └──────────────────┘                │
│                                                              │
│   ┌──────────────────┐  ┌──────────────────┐                │
│   │ ML 算法模块      │  │ 分析服务模块     │                │
│   │ - LinUCB         │  │ - 销售分析       │                │
│   │ - 特征工程       │  │ - 财务分析       │                │
│   │ - MAB 算法       │  │ - 库存分析       │                │
│   └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
12.2 维护策略
版本管理

python-analytics-service/
├── VERSION                    # 当前版本号 (1.0.0)
├── CHANGELOG.md               # 变更日志
├── requirements.txt           # 锁定依赖版本
└── requirements-dev.txt       # 开发依赖
部署方式

# docker-compose.yml
services:
  python-analytics:
    image: cretas/python-analytics:1.0.0
    ports:
      - "8081:8081"
    environment:
      - LOG_LEVEL=INFO
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8081/health"]
    restart: unless-stopped
监控与日志
健康检查: /health 端点
日志: 统一输出到 /var/log/python-analytics/
监控: Prometheus metrics /metrics
更新流程

# 1. 本地测试
pytest tests/

# 2. 构建新镜像
docker build -t cretas/python-analytics:1.1.0 .

# 3. 推送到服务器
docker push cretas/python-analytics:1.1.0

# 4. 服务器更新 (无缝切换)
docker-compose pull
docker-compose up -d --no-deps python-analytics
12.3 Fallback 机制

// PythonAnalyticsClient.java
@Service
public class PythonAnalyticsClient {

    @Value("${python-analytics.enabled:true}")
    private boolean pythonEnabled;

    @Value("${python-analytics.url}")
    private String pythonUrl;

    public LinUCBResult computeLinUCB(LinUCBRequest request) {
        if (!pythonEnabled) {
            // 直接使用 Java 实现
            return javaLinUCBService.compute(request);
        }

        try {
            // 优先使用 Python
            return callPython("/api/ml/linucb", request, LinUCBResult.class);
        } catch (Exception e) {
            log.warn("Python 服务不可用，fallback 到 Java: {}", e.getMessage());
            // Fallback 到 Java
            return javaLinUCBService.compute(request);
        }
    }
}
12.4 渐进式迁移策略
阶段	状态	Python 角色	Java 角色
Phase 1	当前	只处理 Excel	其他保持不变
Phase 2	验证后	+ 预测/指标	保留 fallback
Phase 3	稳定后	+ LinUCB/特征	减少 fallback
Phase 4	成熟后	所有计算	只保留 API/DB
关键点: 每个阶段都保留 Java fallback，确保服务可用性

十四、关键文件清单
新建文件

python-analytics-service/
├── main.py
├── config.py
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── api/*.py
├── services/*.py
└── models/*.py
修改文件

backend-java/
├── src/main/resources/application.yml
├── src/main/java/.../client/PythonAnalyticsClient.java  # 新建
├── src/main/java/.../service/smartbi/impl/SmartBIUploadFlowServiceImpl.java
├── src/main/java/.../service/smartbi/impl/ForecastServiceImpl.java
├── src/main/java/.../service/smartbi/impl/MetricCalculatorServiceImpl.java
└── src/main/java/.../service/impl/LinUCBServiceImpl.java