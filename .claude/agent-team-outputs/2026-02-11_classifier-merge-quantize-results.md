# 分类器意图合并 + INT8量化 实测结果

**日期**: 2026-02-11
**硬件**: RTX 3060 (训练), 8C/16GB 阿里云 (量化+推理)

---

## 意图合并 (179 → 170 类)

### 合并映射 (9个)

| 旧意图 | 新意图 | 类型 |
|--------|--------|------|
| NOTIFICATION_WECHAT_SEND | NOTIFICATION_SEND_WECHAT | 词序重复 |
| HR_EMPLOYEE_DELETE | HR_DELETE_EMPLOYEE | 词序重复 |
| SEND_WECHAT_MESSAGE | NOTIFICATION_SEND_WECHAT | 语义重复 |
| NAVIGATION_NEXT_PAGE | PAGINATION_NEXT | 语义重复 |
| ALERT_LIST | EQUIPMENT_ALERT_LIST | 通用→具体 |
| ALERT_STATS | EQUIPMENT_ALERT_STATS | 通用→具体 |
| ALERT_ACKNOWLEDGE | EQUIPMENT_ALERT_ACKNOWLEDGE | 通用→具体 |
| ALERT_RESOLVE | EQUIPMENT_ALERT_RESOLVE | 通用→具体 |
| ORDER_MODIFY | ORDER_UPDATE | UPDATE/MODIFY重叠 |

### 训练结果

| 指标 | 合并前 (179类) | 合并后 (170类) | 变化 |
|------|---------------|---------------|------|
| **F1 weighted** | 86.44% | **89.91%** | **+3.47%** |
| **Top-1 Accuracy** | 87.00% | **90.30%** | **+3.30%** |
| **Top-5 Accuracy** | 97.56% | **97.66%** | +0.10% |
| 训练时间 | 6.7 min | 6.1 min | -0.6 min |
| 类别数 | 179 | 170 | -9 |

---

## ONNX INT8 量化

### QInt8 vs QUInt8

| 量化方式 | F1 | 大小 | 延迟 P95 | vs FP32 |
|----------|-----|------|----------|---------|
| FP32 (baseline) | 89.86% | 410 MB | 29.5ms | — |
| **QInt8** | 81.22% | 103 MB | 11.1ms | **F1 -8.63%** |
| **QUInt8** | **89.71%** | **103 MB** | **11.1ms** | **F1 -0.14%** |

> QInt8 对此模型过于激进 (F1 降8.6%), QUInt8 几乎无损 (F1 降0.14%)

### 最终性能 (QUInt8)

| 指标 | FP32 ONNX | INT8 ONNX | 变化 |
|------|-----------|-----------|------|
| F1 | 89.86% | 89.71% | **-0.14%** |
| Agreement | — | 96.95% | — |
| 模型大小 | 410 MB | 103 MB | **-75%** |
| 推理延迟均值 | 28.8ms | 10.8ms | **2.67x快** |
| 推理延迟P95 | 29.5ms | 11.1ms | **2.66x快** |

---

## 端到端改进总结 (vs 原生产模型)

| 指标 | 原生产模型 | 优化后 | 变化 |
|------|-----------|--------|------|
| F1 | 87.09% (178类) | **89.71%** (170类, INT8) | **+2.62%** |
| Top-1 | 87.78% | **90.30%** | **+2.52%** |
| 类别数 | 178 | 170 | -8 |
| 模型大小 | 410 MB | **103 MB** | **-75%** |
| 推理延迟 | ~28ms | **~11ms** | **2.5x快** |

---

## Java 代码变更

1. **IntentExecutorServiceImpl**: 添加 `resolveHandlerCategory()` — EQUIPMENT_ALERT_* 路由到 ALERT handler
2. **AlertIntentHandler**: 添加 EQUIPMENT_ALERT_* 为额外 switch case
3. **ResultFormatterServiceImpl**: 添加 EQUIPMENT_ALERT_* 格式化支持
4. **AIIntentServiceImpl**: 添加 EQUIPMENT_ALERT_ACKNOWLEDGE/RESOLVE 写→读 fallback
5. **IntentKnowledgeBase**: 修复 HACCP 重复元素

## 文件位置

| 文件 | 位置 |
|------|------|
| 合并训练数据 | `scripts/finetune/data/merged_training_data.jsonl` |
| 合并 label_mapping | `scripts/finetune/data/merged_label_mapping.json` |
| PyTorch 模型 | 服务器 `/www/wwwroot/python-services/models/.../final/` |
| ONNX FP32 | 服务器 `.../final/onnx/model.onnx` (410 MB) |
| ONNX INT8 | 服务器 `.../final/onnx/model-int8.onnx` (103 MB) |
| 训练脚本 | `scripts/finetune/merge_retrain_quantize.py` |
| 量化脚本 | `scripts/finetune/quantize_only.py` |
