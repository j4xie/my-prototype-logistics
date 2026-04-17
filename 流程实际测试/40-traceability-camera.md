# 40. 溯源 + 摄像头 + 视觉识别

> **🟡 R18 QA Smoke API (2026-04-17 07:06)**: GET /F001/traceability/batch/PB20260212002 返回完整 trace data (production/batchNumber/productName 香酥鱼柳). UI 路由 `/trace/query` 404 (可能路径不同). API 可用, UI 路径需查. 摄像头/视觉识别未测 (camera SDK 禁用).

**来源**: R3 Agent 1
**耗时**: 25 min

---

## 40.1 产品溯源 (`/api/mobile/{fid}/traceability/**`)

### 40.1.1 产品初始化注册
1. 生产完工入库后, 每成品批次应**自动注册**到溯源链
2. API: `POST /traceability/register`
3. 生成 QR 码 (每包装一个, 含批次+时间+工厂)

### 40.1.2 批次信息更新
- `POST /traceability/update`
- 运输节点 / 仓储节点 / 销售节点
- 每节点时间 + 操作人 + 位置 + 照片

### 40.1.3 溯源查询
- 消费者扫 QR → 公开 URL
- 显示完整链: 原料 → 生产 → 出厂 → 物流 → 门店
- 关键: 每节点时间戳 + 可选照片

### 40.1.4 导出报告
- `GET /traceability/export`
- PDF 格式 (可给政府监管)

---

## 40.2 摄像头 (`/api/camera/**`)

### 40.2.1 图片上传分析
- `POST /api/camera/upload`
- 前端: 选照片 → 上传 → 后端 VL 分析
- 返回: 识别结果 (场景/物体/异常)

### 40.2.2 批量分析
- `POST /api/camera/batch-analyze`
- 上传多张一次处理

### 40.2.3 可用模型
- `GET /api/camera/models`
- 返回: Qwen2.5-VL / YOLO 列表

### 40.2.4 Dahua 摄像头集成
- `/api/mobile/{fid}/dahua/devices/**`
- 注册/管理多路 NVR
- 拉流实时预览

---

## 40.3 人效识别 (`/api/efficiency/**`)

### 40.3.1 视频分析
- `POST /efficiency/analyze-video-upload`
- 分析车间视频, 识别员工动作/时长

### 40.3.2 帧分析
- `POST /efficiency/analyze-frame`
- 单帧快速分析

### 40.3.3 报表
- 每员工工时 / 动作频率 / 异常标记

---

## 40.4 Checklist (12 项)

| # | 项 | 勾选 |
|---|---|------|
| 1 | 批次注册溯源 | ☐ |
| 2 | QR 生成 + 扫描 | ☐ |
| 3 | 节点更新 | ☐ |
| 4 | 公开查询 URL | ☐ |
| 5 | 溯源报告 PDF 导出 | ☐ |
| 6 | 摄像头上传分析 | ☐ |
| 7 | 批量分析 | ☐ |
| 8 | 模型列表 | ☐ |
| 9 | Dahua 设备注册 | ☐ |
| 10 | 实时预览 | ☐ |
| 11 | 人效视频分析 | ☐ |
| 12 | 人效报表 | ☐ |
