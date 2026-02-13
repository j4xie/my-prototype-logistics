# 意图分类器增量微调

## 概述

本目录包含增量微调意图分类器的脚本和数据，用于解决 CLASSIFIER 层的混淆问题。

## 问题意图

| 混淆对 | 说明 |
|--------|------|
| PROCESSING_BATCH_LIST ↔ MATERIAL_BATCH_QUERY | "在产批次" vs "原料批次" |
| CLOCK_IN ↔ ATTENDANCE_TODAY | "打卡/签到" vs "今日出勤" |
| SHIPMENT_STATS ↔ MATERIAL_BATCH_QUERY | "发货统计" vs "原料查询" |

## 文件结构

```
scripts/finetune/
├── README.md                          # 本文档
├── generate_training_data.py          # 生成增量训练数据
├── incremental_finetune.py            # 增量微调脚本
├── data/
│   ├── incremental_training_data.jsonl  # 生成的训练数据 (JSON Lines)
│   └── incremental_training_data.csv    # 生成的训练数据 (CSV)
└── models/
    └── incremental/                   # 微调后的模型 (训练后生成)
```

## 防止灾难性遗忘的策略

| 策略 | 参数 | 说明 |
|------|------|------|
| 低学习率 | `--lr 5e-6` | 比初始训练低 10-20 倍 |
| 数据回放 | `--replay-ratio 0.5` | 混入 50% 旧数据 |
| 冻结早期层 | `--freeze-layers 8` | 只训练最后 4 层 |
| 少量 epoch | `--epochs 2` | 避免过拟合 |
| 小批次 | `--batch-size 8` | 稳定梯度更新 |
| 早停 | 内置 | 验证集无提升时停止 |

## 使用方法

### 1. 生成训练数据

```bash
cd scripts/finetune
python generate_training_data.py
```

输出:
- `data/incremental_training_data.jsonl` - JSON Lines 格式
- `data/incremental_training_data.csv` - CSV 格式

### 2. 执行增量微调

```bash
# 基本用法
python incremental_finetune.py \
    --new-data data/incremental_training_data.jsonl \
    --model-path models/chinese-roberta-wwm-ext-classifier/final \
    --output-path models/incremental

# 完整参数
python incremental_finetune.py \
    --new-data data/incremental_training_data.jsonl \
    --old-data data/original_training_data.jsonl \
    --model-path models/chinese-roberta-wwm-ext-classifier/final \
    --output-path models/incremental \
    --epochs 2 \
    --batch-size 8 \
    --lr 5e-6 \
    --replay-ratio 0.5 \
    --freeze-layers 8
```

### 3. 部署新模型

```bash
# 复制到服务器
scp -r models/incremental/final root@47.100.235.168:/www/wwwroot/python-services/models/chinese-roberta-wwm-ext-classifier/

# 重启 Python 服务
ssh root@47.100.235.168 "systemctl restart python-services"
```

## 训练数据格式

### JSON Lines (推荐)
```jsonl
{"text": "查看在产批次", "label": "PROCESSING_BATCH_LIST"}
{"text": "帮我打卡", "label": "CLOCK_IN"}
{"text": "发货统计", "label": "SHIPMENT_STATS"}
```

### CSV
```csv
user_input,intent_code
查看在产批次,PROCESSING_BATCH_LIST
帮我打卡,CLOCK_IN
发货统计,SHIPMENT_STATS
```

## 添加新训练样本

编辑 `generate_training_data.py` 中的 `TRAINING_SAMPLES` 字典:

```python
TRAINING_SAMPLES = {
    "YOUR_INTENT": [
        "样本1",
        "样本2",
        "变体表达...",
    ],
}
```

## 验证微调效果

```bash
cd tests/ai-intent
python comprehensive_test.py 500 12345
```

## 注意事项

1. **不要过度微调**: 2-3 个 epoch 足够，过多会导致过拟合
2. **保持数据平衡**: 各意图样本数量应大致相等
3. **保留旧数据**: 始终混入旧数据防止遗忘
4. **验证后再部署**: 先在测试环境验证效果
5. **备份原模型**: 部署前备份原有模型

## 环境依赖

```bash
pip install torch transformers scikit-learn
```

## 常见问题

### Q: 微调后其他意图准确率下降了怎么办?
A: 增加 `--replay-ratio` (如 0.7-0.8) 或减少 `--epochs`

### Q: 微调效果不明显怎么办?
A: 增加训练样本数量，或减少 `--freeze-layers` (如 6)

### Q: GPU 内存不足怎么办?
A: 减小 `--batch-size` (如 4) 或增加 `--freeze-layers`
