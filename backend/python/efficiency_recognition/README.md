# 人效识别模块 (Efficiency Recognition)

基于阿里云 Qwen VL 模型的工厂人效自动识别和数据采集系统。

**与 SmartBI 模块完全独立**，专注于视觉识别和人效数据采集。

## 系统架构

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  摄像头/视频     │────▶│  Python服务      │────▶│  Java后端       │
│  图片输入        │     │  (VL识别+处理)   │     │  (数据存储)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  阿里云 Qwen VL  │
                        │  qwen-vl-max     │
                        └──────────────────┘
```

## 模块结构

```
efficiency_recognition/
├── __init__.py              # 模块入口
├── README.md                # 本文档
├── api/
│   ├── __init__.py
│   └── routes.py            # FastAPI 路由
└── services/
    ├── __init__.py
    ├── video_analyzer.py    # VL 视频/图片分析器
    └── data_collector.py    # 数据采集和后端对接
```

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/smartbi/efficiency/analyze-frame` | POST | 分析单帧图片 (Base64) |
| `/api/smartbi/efficiency/analyze-frame-upload` | POST | 分析上传的图片文件 |
| `/api/smartbi/efficiency/analyze-video-upload` | POST | 分析上传的视频 (异步) |
| `/api/smartbi/efficiency/task/{task_id}` | GET | 获取异步任务结果 |
| `/api/smartbi/efficiency/batch-analyze` | POST | 批量分析多帧 |
| `/api/smartbi/efficiency/build-efficiency-record` | POST | 转换为后端请求格式 |
| `/api/smartbi/efficiency/workstation-mapping` | GET/POST | 摄像头-工位映射 |
| `/api/smartbi/efficiency/health` | GET | 健康检查 |

## 可识别的数据

| 数据项 | 后端字段 | 说明 |
|--------|----------|------|
| 工人数量 | `worker_count` | 画面中检测到的工人总数 |
| 活跃工人 | `active_workers` | 正在工作的工人数 |
| 空闲工人 | `idle_workers` | 等待/休息的工人数 |
| 完成动作 | `pieceCount` | 检测到的完成动作次数 |
| 工序类型 | `processStageType` | 自动识别 (包装/灌装/化料等) |
| 效率评分 | `efficiency_score` | 0-100 分 |
| 安全装备 | `safety_gear` | 工作服、帽子、手套等 |
| 安全问题 | `safety_issues` | 检测到的安全隐患 |

## 对接后端 API

```
POST /api/mobile/{factoryId}/wage/efficiency/record

{
    "workerId": 101,
    "pieceCount": 15,
    "workMinutes": 60,
    "processStageType": "PACKAGING",
    "workDate": "2026-01-28",
    "workstationId": "WS_PACKAGING_01",
    "qualifiedCount": 15,
    "notes": "VL自动识别 | 效率分:78 | 在岗:2/3"
}
```

## 工序类型枚举

- `RECEIVING` - 收货
- `SLAUGHTER` - 屠宰
- `CUTTING` - 分割
- `PROCESSING` - 加工
- `PACKAGING` - 包装
- `COLD_STORAGE` - 冷藏
- `SHIPPING` - 发货
- `QUALITY_CHECK` - 质检
- `CLEANING` - 清洗
- `MIXING` - 混合/化料
- `FILLING` - 灌装

## 配置

在项目根目录 `.env` 或 `smartbi/.env` 中配置：

```
LLM_API_KEY=sk-xxx                    # 阿里云 DashScope API Key
LLM_VL_MODEL=qwen-vl-max              # VL 模型
BACKEND_BASE_URL=http://xxx:10010     # 后端地址
DEFAULT_FACTORY_ID=F001               # 默认工厂ID
```

## 使用示例

### Python 直接调用

```python
from efficiency_recognition.services import VideoEfficiencyAnalyzer, EfficiencyDataCollector

# 分析图片
analyzer = VideoEfficiencyAnalyzer()
result = analyzer.analyze_frame(image_base64, frame_index=0)

# 采集数据
collector = EfficiencyDataCollector()
data = collector.convert_vl_result_to_efficiency_data(result_dict)
request = collector.build_efficiency_record_request(data, worker_id=101)
```

### HTTP API 调用

```bash
# 分析图片
curl -X POST "http://localhost:8083/api/smartbi/efficiency/analyze-frame-upload" \
  -F "file=@frame.jpg" \
  -F "camera_id=CAM_01"

# 分析视频
curl -X POST "http://localhost:8083/api/smartbi/efficiency/analyze-video-upload" \
  -F "file=@factory.mp4" \
  -F "interval_seconds=5" \
  -F "max_frames=10"
```

## 与 SmartBI 的关系

本模块**完全独立**于 SmartBI：

| 模块 | 职责 |
|------|------|
| SmartBI | Excel 解析、数据分析、图表、预测 |
| Efficiency Recognition | VL 视觉识别、人效数据采集 |

两者共享同一个 FastAPI 服务 (端口 8083)，但代码完全分离。
