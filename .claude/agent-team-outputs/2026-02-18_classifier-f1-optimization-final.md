# ONNX 意图分类器 F1 优化 — 最终实施方案

**日期**: 2026-02-18
**基于**: Analyst 分析报告 + Critic 审查修正
**目标**: 分类器 F1 从 89.91% 提升到 91.5-92.5%，端到端路由准确率从 97% 提升到 98%+

---

## 一、已验证基线（修正后）

| 指标 | 值 | 来源 |
|------|-----|------|
| 分类器类数 | **170**（生产模型），177（原始 label_mapping.json） | `merged-classifier/final/training_metrics.json` |
| 分类器 F1 (weighted) | **89.91%** | 同上 |
| Top-1 准确率 | 90.30% | 同上 |
| Top-5 准确率 | 97.66% | 同上 |
| 训练样本 | 17,721 (train) + 1,969 (val) | 同上 |
| 端到端路由准确率 | **97%** (112/115) | `test-v21.1-results.txt` |
| 短语匹配数量 | **2,954 条**（非分析师声称的 200 条） | `IntentKnowledgeBase.java` grep count |
| 其中 FOOD_KNOWLEDGE 短语 | **254 条** | 同上 |
| ONNX 模型大小 | 103MB (INT8) / 410MB (FP32) | 部署记录 |
| 推理延迟 | 10.8ms (INT8) | 量化测试 |
| 训练时间 | 6.1 分钟 (GPU) | training_metrics.json |
| Early Stopping | patience=2, epochs=5 | `finetune_full.py` 第 171 行 |

### 关键事实修正

1. **label_mapping.json（177 类）与生产模型（170 类）不同步**。上一轮已合并 9 个意图（179->170），包括 `HR_EMPLOYEE_DELETE->HR_DELETE_EMPLOYEE`、`ORDER_MODIFY->ORDER_UPDATE`、`NAVIGATION_NEXT_PAGE->PAGINATION_NEXT`、4 个 ALERT 合并、2 个 NOTIFICATION 合并。但 `label_mapping.json` 仍保留着 177 类的旧版本。

2. **短语层已覆盖 2,954 条映射**，包括 254 条 FOOD_KNOWLEDGE_QUERY 短语。分类器仅处理短语层遗漏的长尾查询。提升分类器 F1 对端到端的边际贡献是递减的。

3. **EQUIVALENT_INTENTS 机制已存在**，覆盖约 30+ 个等价意图组。如果将等价组纳入评估，有效 F1 可能已超过 92%。

4. **E2E 97% 远高于分类器 F1 89.91%**。核心路由管线（短语 2,954 条 + 语义路由 + LLM Fallback + 消歧层）已非常完善，分类器优化的主要价值在于**减少 LLM Fallback 调用**（降低延迟和成本），而非大幅提升用户体验。

---

## 二、现实目标设定

| 指标 | 当前值 | 目标值 | 说明 |
|------|--------|--------|------|
| 分类器 F1 (val set) | 89.91% | **91.5-92.5%** | +1.6~2.6%，合理可达 |
| E2E 路由准确率 | 97% | **98%+** | 从 3 个错误减少到 2 个以内 |
| LLM Fallback 率 | ~15-20% | **<10%** | 主要收益点 |
| 推理延迟 | 10.8ms | **<15ms** | 允许少量增加 |
| ONNX 模型大小 | 103MB | **<110MB** | 基本不变 |

> **不追求 94%+ 的分类器 F1**。当前数据分布（80.5% 样本 <10 字符）和 val set 与 train 同分布的现实，决定了 val F1 突破 93% 需要根本性的数据变革。而端到端已经 97%，边际收益有限。

---

## 三、Phase 1：快速清洗与训练（单次工作会话，4-6 小时）

**预期收益**: 分类器 F1 +1.0~2.0%，达到 ~91-92%

### 1A. 同步 label_mapping.json 到 170 类基线

**前提条件，必须最先执行**

| 项目 | 详情 |
|------|------|
| 文件 | `scripts/finetune/data/label_mapping.json` |
| 操作 | 删除已合并的 7 个旧标签（见下方列表），将 `num_labels` 从 177 改为 170，重新编号 `label_to_id` / `id_to_label` |
| 工时 | 0.5h |
| 风险 | **低** |

已在上一轮合并的标签（从 label_mapping.json 中移除）：
- `ALERT_ACKNOWLEDGE` (id:0) -> 已合并到 `EQUIPMENT_ALERT_ACKNOWLEDGE`
- `ALERT_LIST` (id:5) -> 已合并到 `EQUIPMENT_ALERT_LIST`
- `ALERT_RESOLVE` (id:6) -> 已合并到 `EQUIPMENT_ALERT_RESOLVE`
- `ALERT_STATS` (id:7) -> 已合并到 `EQUIPMENT_ALERT_STATS`
- `HR_EMPLOYEE_DELETE` (id:57) -> 已合并到 `HR_DELETE_EMPLOYEE`
- `NAVIGATION_NEXT_PAGE` (id:82) -> 已合并到 `PAGINATION_NEXT`
- `NOTIFICATION_WECHAT_SEND` (id:86) -> 已合并到 `NOTIFICATION_SEND_WECHAT`
- `ORDER_MODIFY` (id:92) -> 已合并到 `ORDER_UPDATE`
- `SEND_WECHAT_MESSAGE` (id:146) -> 已合并到 `NOTIFICATION_SEND_WECHAT`

注意：177 - 9 = 168，但生产模型是 170 类。差额 2 可能是 `EQUIPMENT_ALERT_*` 系列有新标签。需以 `merged-classifier/final/` 下的实际 label_mapping 为准（如果存在的话）。

**具体操作**：
```python
# 建议写一个脚本同步，而非手动编辑
# scripts/finetune/sync_label_mapping.py
import json

# 从 merged-classifier 的训练记录获取 merge_map
merge_map = {
    "NOTIFICATION_WECHAT_SEND": "NOTIFICATION_SEND_WECHAT",
    "HR_EMPLOYEE_DELETE": "HR_DELETE_EMPLOYEE",
    "SEND_WECHAT_MESSAGE": "NOTIFICATION_SEND_WECHAT",
    "NAVIGATION_NEXT_PAGE": "PAGINATION_NEXT",
    "ALERT_ACKNOWLEDGE": "EQUIPMENT_ALERT_ACKNOWLEDGE",
    "ALERT_LIST": "EQUIPMENT_ALERT_LIST",
    "ALERT_RESOLVE": "EQUIPMENT_ALERT_RESOLVE",
    "ALERT_STATS": "EQUIPMENT_ALERT_STATS",
    "ORDER_MODIFY": "ORDER_UPDATE",
}

# 1. 加载旧 label_mapping
# 2. 移除 merge_map 中的 key 标签
# 3. 重新编号
# 4. 同时更新 full_training_data.jsonl 中的标签
```

### 1B. 第二轮类别合并（剩余 6-7 个重复类）

| 项目 | 详情 |
|------|------|
| 文件 | `scripts/finetune/data/label_mapping.json`, `scripts/finetune/data/full_training_data.jsonl` |
| 操作 | 合并剩余重复意图（见下方），预计 170->163 类 |
| 工时 | 1h |
| 风险 | **低**（这些意图在 IntentKnowledgeBase 和 handler 路由中均无显式引用） |
| 预期增益 | **+0.3~0.8%** F1 |

合并映射（排除已完成的）：

```python
MERGE_MAP_V2 = {
    # HR 删除（仍有 1 个残留重复）
    'HRM_DELETE_EMPLOYEE': 'HR_DELETE_EMPLOYEE',       # id:55 -> id:56

    # 导航城市（2->1）
    'NAVIGATION_TO_CITY': 'NAVIGATE_TO_CITY',          # id:83 -> id:80

    # 导航地点（2->1）
    'NAVIGATION_TO_LOCATION': 'NAVIGATE_TO_LOCATION',  # id:84 -> id:81

    # 排除已选（4->1）
    'FILTER_EXCLUDE_SELECTED': 'EXCLUDE_SELECTED',     # id:53 -> id:49
    'SYSTEM_FILTER_EXCLUDE_SELECTED': 'EXCLUDE_SELECTED',  # id:162 -> id:49
    'UI_EXCLUDE_SELECTED': 'EXCLUDE_SELECTED',         # id:170 -> id:49
}
```

减少 6 个类：170 -> 164 类。

### 1C. 删除无关意图类

| 项目 | 详情 |
|------|------|
| 文件 | `scripts/finetune/data/label_mapping.json`, `scripts/finetune/data/full_training_data.jsonl` |
| 操作 | 移除与食品溯源系统完全无关的意图类 |
| 工时 | 0.5h |
| 风险 | **低**（这些意图在 IntentKnowledgeBase.java 中无任何短语映射，handler 中也无路由） |
| 预期增益 | **+0.2~0.5%** F1（减少类数直接降低分类难度） |

待删除的无关意图：

| 意图 | ID | 理由 |
|------|----|------|
| `NAVIGATE_TO_CITY` | 80 | 地图导航，食品溯源系统不需要 |
| `NAVIGATE_TO_LOCATION` | 81 | 地图导航 |
| `MEDIA_PLAY` | 77 | 媒体播放 |
| `MEDIA_PLAY_MUSIC` | 78 | 媒体播放 |
| `SHOPPING_CART_CLEAR` | 154 | 购物车（属于 mall 系统） |
| `OPEN_CAMERA` | 87 | 打开相机（与 EQUIPMENT_CAMERA_START 重复或无关） |

注意：合并后再删除。`NAVIGATE_TO_CITY` 在 1B 合并中已成为目标类，需要在合并完成后一并删除（或直接在 1B 中将 NAVIGATION_TO_CITY 映射到一个新的"ignore"标记然后一起删除）。

**最终类数**: 164 - 6 = **~158 类**

### 1D. 清理冲突标签数据

| 项目 | 详情 |
|------|------|
| 文件 | `scripts/finetune/data/full_training_data.jsonl` |
| 操作 | 处理 688 条同一文本对应多标签的冲突数据 |
| 工时 | 1.5h |
| 风险 | **低** |
| 预期增益 | **+0.5~1.0%** F1 |

**策略（采纳 Critic 的修正）**：

1. 约 348 条冲突涉及刚完成的合并对象 -> 合并后自然消除
2. 对剩余 ~340 条非合并冲突：
   - **>3 个不同标签的文本（~150 条）**: **直接删除**。这些是信息量不足的短文本（如 7 字符被标注为 10 个 EQUIPMENT_* 意图），任何 "智能选择" 都只是引入新噪声
   - **2-3 个标签的文本（~190 条）**: 保留标签 ID 较低的（更常见的意图），删除多余重复行
3. 去除完全重复的 1,242 条样本（保留一条）

```python
# scripts/finetune/clean_training_data.py（建议新增）
import json
from collections import defaultdict

# 读取所有 (text, label) 对
text_labels = defaultdict(set)
for line in open('data/full_training_data.jsonl'):
    d = json.loads(line)
    text_labels[d['text']].add(d['label'])

# 处理冲突
to_remove = set()
for text, labels in text_labels.items():
    if len(labels) > 3:
        to_remove.add(text)  # 极端冲突，直接删除
    elif len(labels) > 1:
        # 保留第一个标签（按字母序），删除其他
        pass

# 输出清洗后的数据
```

### 1E. 训练配置优化

| 项目 | 详情 |
|------|------|
| 文件 | `scripts/finetune/finetune_full.py` |
| 操作 | 修改训练超参 |
| 工时 | 0.3h |
| 风险 | **极低** |
| 预期增益 | **+0.1~0.3%** F1 |

具体修改（`finetune_full.py`）：

```python
# 第 53-59 行，修改超参
EPOCHS = 8           # 从 5 增加到 8（配合 patience=4）
BATCH_SIZE = 32      # 不变
LEARNING_RATE = 2e-5 # 不变（标准值已足够好）
WEIGHT_DECAY = 0.01  # 不变
WARMUP_RATIO = 0.1   # 不变
MAX_LENGTH = 64      # 不变

# 第 142 行，TrainingArguments 中添加 label_smoothing_factor
training_args = TrainingArguments(
    ...
    label_smoothing_factor=0.1,  # 新增
    ...
)

# 第 171 行，增加 early stopping patience
callbacks=[EarlyStoppingCallback(early_stopping_patience=4)],  # 从 2 改为 4
```

### 1F. 添加 FOOD_KNOWLEDGE_QUERY 到分类器

| 项目 | 详情 |
|------|------|
| 文件 | `scripts/finetune/data/label_mapping.json`, `scripts/finetune/data/full_training_data.jsonl` |
| 操作 | 在分类器训练数据中添加 FOOD_KNOWLEDGE_QUERY 意图 |
| 工时 | 1h |
| 风险 | **中**（可能与短语层的 254 条 FOOD_KNOWLEDGE 映射产生竞争） |
| 预期增益 | 分类器 F1 **+0.0~0.2%**（新类不改善旧类 F1），端到端 **+0.5~1.0%** LLM Fallback 减少 |

**注意事项（采纳 Critic 修正）**：
- 短语层已有 254 条 FOOD_KNOWLEDGE 映射，大部分高频查询已被短语层截获
- 分类器的价值在于覆盖**短语层未覆盖的长尾表达**
- 训练样本应专注于**长句、口语化、间接表达**，避免与短语层重叠

推荐训练样本类型（100-150 条）：
```
# 短语层不会命中的长尾表达
"酸奶的生产过程中最关键的温度控制点在哪里"
"做肉松的时候炒制温度和时间应该怎么把控"
"牛肉干的水分活度控制在多少才能延长保质期"
"冷冻水饺解冻后重新冷冻会不会有安全问题"
"HACCP 体系里关键控制点怎么确定"
"果汁饮料的巴氏杀菌和超高温杀菌有什么区别"
```

**Java 侧无需修改**：`FoodKnowledgeIntentHandler.java` 和 `AIIntentServiceImpl.java` 中已有完整的 FOOD_KNOWLEDGE_QUERY 处理逻辑。

### Phase 1 完成后操作

1. 重新训练：`python scripts/finetune/finetune_full.py`（~6-8 分钟 GPU）
2. ONNX 导出 + INT8 量化：`python scripts/finetune/quantize_only.py`
3. 部署验证：`python tests/intent-routing-e2e-150.py`
4. 对比基线 F1 和 E2E 结果

---

## 四、Phase 2：数据增强与高级训练（第二次工作会话，4-8 小时）

**前提**: Phase 1 完成后 F1 未达 92%
**预期额外收益**: +0.5~1.5%，累计达到 ~92-93%

### 2A. 长句数据增强（最高优先级）

| 项目 | 详情 |
|------|------|
| 文件 | 新建 `scripts/finetune/augment_data.py` |
| 操作 | 将短文本扩展为自然口语长句 |
| 工时 | 2-3h |
| 风险 | **低**（保留原始数据，增强数据是增量） |
| 预期增益 | **+1.0~2.0%** F1（最有价值的单项优化） |

核心问题：80.5% 训练样本 <10 字符（如"查看订单"、"设备状态"），但真实用户输入通常 15-40 字符。这导致分类器在长句上泛化差。

**注意**：val set 也来自同一短文本分布，所以数据增强可能在 val F1 上体现不充分。**真正的收益在端到端和真实场景中**。建议同时构建一个 50-100 条真实长句的 held-out 测试集来衡量实际增益。

增强策略（按优先级）：

```python
# scripts/finetune/augment_data.py

# 策略 1：模板扩展（最快、最稳定）
TEMPLATES = [
    "帮我{verb}一下{noun}",
    "能不能{verb}最近的{noun}",
    "我想要{verb}一下{time}{noun}",
    "{time}的{noun}{verb}情况怎么样",
    "请帮我把{noun}的{verb}信息显示出来",
    "麻烦{verb}下{department}的{noun}",
]

# 策略 2：LLM 同义改写（质量最高，但需要 API 成本）
# 调用 qwen-turbo: "请用 5 种不同的自然口语说法改写以下意图查询，
# 保持意图不变，长度 15-40 字：{original_text}"

# 策略 3：上下文前缀/后缀添加
PREFIXES = ["帮我看看", "我想了解", "查一下", "能不能帮我查"]
SUFFIXES = ["的详细信息", "怎么样了", "有什么更新", "最新情况"]
```

**目标**：每类增加 50-100 条长句样本（15-40 字符），总数据量从 ~19,000 增加到 ~30,000-35,000。

### 2B. Focal Loss 实现（条件执行）

| 项目 | 详情 |
|------|------|
| 文件 | `scripts/finetune/finetune_full.py` |
| 操作 | 替换默认 CrossEntropyLoss 为 Focal Loss |
| 工时 | 0.5h |
| 风险 | **低** |
| 预期增益 | **+0.0~0.5%**（当前类别分布 100-150/类，很均衡，Focal Loss 的边际价值有限） |

**仅在 Phase 1 训练结果显示特定类别 F1 远低于平均时执行**。如果 per-class F1 分布比较均匀，跳过此步。

```python
# 添加到 finetune_full.py

import torch.nn.functional as F

class FocalLoss(torch.nn.Module):
    def __init__(self, gamma=2.0):
        super().__init__()
        self.gamma = gamma

    def forward(self, inputs, targets):
        ce_loss = F.cross_entropy(inputs, targets, reduction='none')
        pt = torch.exp(-ce_loss)
        focal_loss = ((1 - pt) ** self.gamma) * ce_loss
        return focal_loss.mean()

class FocalLossTrainer(Trainer):
    def compute_loss(self, model, inputs, return_outputs=False, **kwargs):
        labels = inputs.pop("labels")
        outputs = model(**inputs)
        logits = outputs.logits
        loss = FocalLoss(gamma=2.0)(logits, labels)
        return (loss, outputs) if return_outputs else loss
```

### 2C. Optuna 超参搜索（条件执行）

| 项目 | 详情 |
|------|------|
| 文件 | 新建 `scripts/finetune/hparam_search.py` |
| 操作 | 自动搜索最优超参组合 |
| 工时 | 1h 编码 + 2-3h GPU 运行（30 trials x 6min = 3h） |
| 风险 | **低** |
| 预期增益 | **+0.3~0.8%** |

**仅在 Phase 1 + 2A 训练后 F1 仍未达 92% 时执行**。

搜索空间：
- Learning Rate: 1e-5 ~ 5e-5 (log scale)
- Batch Size: 16 / 32 / 64
- Warmup Ratio: 0.03 ~ 0.15
- Weight Decay: 0.001 ~ 0.1 (log scale)
- Label Smoothing: 0.0 ~ 0.2
- Epochs: 5 ~ 12 (配合 patience=4)

---

## 五、Phase 3：管线级优化（第三次工作会话，可选）

**前提**: Phase 1+2 完成后需要进一步提升端到端准确率或降低 LLM 调用率
**预期收益**: E2E +0.5~1.0%，LLM Fallback 率进一步降低

### 3A. 置信度校准（Temperature Scaling）

| 项目 | 详情 |
|------|------|
| 文件 | Java 推理侧（ONNX 推理代码） |
| 操作 | 在 softmax 前对 logits 做温度缩放 |
| 工时 | 2h |
| 风险 | **中**（需要在验证集上拟合温度参数，参数不当可能降低性能） |
| 预期增益 | 端到端 **+0.3~0.5%** |

```python
# 先用 Python 在验证集上拟合最优温度
from scipy.optimize import minimize_scalar
import torch.nn.functional as F

def nll_with_temperature(temperature, logits, labels):
    scaled_logits = logits / temperature
    loss = F.cross_entropy(torch.tensor(scaled_logits), torch.tensor(labels))
    return loss.item()

result = minimize_scalar(nll_with_temperature, bounds=(0.5, 5.0), args=(val_logits, val_labels))
optimal_temperature = result.x  # 典型值 1.2-2.0
```

### 3B. 级联阈值优化

| 项目 | 详情 |
|------|------|
| 文件 | `backend-java/src/main/resources/application-pg-prod.properties` |
| 操作 | 调整生产环境分类器置信度阈值 |
| 工时 | 0.5h |
| 风险 | **中**（阈值调高会增加 LLM Fallback 率，但提高精度） |

当前生产阈值 `python-classifier.high-confidence-threshold=0.70` 偏低。建议在 Phase 1 重训后，根据校准后的置信度分布，调整为 0.80-0.85。

### 3C. 错误日志与反馈循环

| 项目 | 详情 |
|------|------|
| 文件 | Java 侧路由代码 |
| 操作 | 记录分类器低置信度和 LLM Fallback 的 case |
| 工时 | 2h |
| 风险 | **低** |

长期价值最高的优化。记录每次 LLM Fallback 的：
- 原始用户输入
- 分类器 Top-3 预测和置信度
- LLM 最终判定的意图
- 是否与分类器一致

这些数据可以：
1. 发现分类器的系统性弱点
2. 筛选出高质量的新训练样本
3. 构建真实分布的测试集

---

## 六、不建议做的事项

| 建议项 | 原因 | 来源 |
|--------|------|------|
| 短语匹配扩展到 500+ | 已有 2,954 条，分析师低估了 15 倍 | Critic 修正 |
| 追求分类器 F1 95%+ | E2E 已 97%，分类器 95% 的边际 E2E 收益极小 | Critic 修正 |
| 换用 ERNIE 3.0 / MacBERT | 数据质量是瓶颈，不是模型架构。ROI 低 | 分析师+Critic 共识 |
| 分层分类（两级模型） | 工作量 5+ 天，需维护两套 ONNX + 推理管线，复杂度高 | Critic 修正 |
| 领域预训练 (Continue Pre-training) | 训练文本平均仅 7.9 字符，MLM 在极短文本上学不到领域知识 | Critic 修正 |
| 知识蒸馏 / 对比学习 / 多任务学习 | 当前延迟 10.8ms 已优秀，复杂度/收益比差 | 分析师+Critic 共识 |
| 对冲突数据 "用语义相似度选最佳标签" | >3 标签的极端冲突本质是文本信息量不足，不是标注错误，智能选择只是引入新噪声 | Critic 修正 |

---

## 七、实施 Checklist（按顺序执行）

### Phase 1（4-6 小时，1 个会话）

- [ ] **1A**: 同步 `label_mapping.json` 到 170 类基线（对齐生产模型）
- [ ] **1B**: 第二轮合并（HRM_DELETE, NAVIGATION_TO_*, EXCLUDE_SELECTED 系列）→ 164 类
- [ ] **1C**: 删除无关意图（NAVIGATE_*, MEDIA_*, SHOPPING_CART, OPEN_CAMERA）→ ~158 类
- [ ] **1D**: 清理冲突标签数据（删除 >3 标签冲突 ~150 条，去重 1,242 条）
- [ ] **1E**: 修改 `finetune_full.py`（label_smoothing=0.1, epochs=8, patience=4）
- [ ] **1F**: 添加 100-150 条 FOOD_KNOWLEDGE_QUERY 长尾训练样本
- [ ] 重新训练 → ONNX 导出 → INT8 量化
- [ ] 运行 E2E 测试验证
- [ ] 记录新 F1、E2E 准确率、LLM Fallback 率

### Phase 2（4-8 小时，仅在 Phase 1 后 F1 < 92% 时执行）

- [ ] **2A**: 长句数据增强脚本（模板扩展 + LLM 改写）
- [ ] 重新训练并验证
- [ ] **2B**: 如 per-class F1 分散严重，尝试 Focal Loss
- [ ] **2C**: 如仍未达目标，Optuna 超参搜索

### Phase 3（可选，长期优化）

- [ ] **3A**: 置信度校准（Temperature Scaling）
- [ ] **3B**: 生产阈值从 0.70 调整到 0.80-0.85
- [ ] **3C**: 错误日志收集系统

---

## 八、F1 增益叠加预测（修正后，保守估计）

| Phase | 优化项 | 单项增益 | 累计 F1 |
|-------|--------|---------|---------|
| **1A-1C** | 同步基线 + 合并 + 删无关类（170->~158） | +0.5~1.3% | 90.4~91.2% |
| **1D** | 冲突标签清理（删除 ~150 极端冲突 + 去重） | +0.5~1.0% | 90.9~92.2% |
| **1E** | Label Smoothing + Epochs + Patience | +0.1~0.3% | 91.0~92.5% |
| **1F** | 添加 FOOD_KNOWLEDGE_QUERY | +0.0~0.2% (val F1) | 91.0~92.7% |
| **2A** | 长句数据增强 | +0.5~1.5% (val F1) | 91.5~93.5% |
| **2B-2C** | Focal Loss + 超参搜索 | +0.3~0.8% | 91.8~93.8% |

**保守结论**：Phase 1 完成后预计 F1 达到 **91.0~92.5%**（最可能值 91.5%）。加上 Phase 2 数据增强，可达 **92.0~93.0%**。

**端到端**：因短语层已覆盖 2,954 条高频查询，分类器 F1 从 89.91% 提升到 91.5-92.5% 对 E2E 的贡献预计为 +0.5~1.0%，即 E2E 从 97% 提升到 **97.5~98%**。

---

## 九、GPU 资源与时间预算

| 操作 | 预计时间（GPU） | 预计时间（CPU） |
|------|---------------|---------------|
| Phase 1 训练（8 epochs, ~19K 样本） | ~8-10 分钟 | ~2-3 小时 |
| Phase 2 训练（8 epochs, ~30K 样本） | ~15-20 分钟 | ~4-6 小时 |
| ONNX 导出 + INT8 量化 | ~5 分钟 | ~10 分钟 |
| Optuna 30 trials | ~4-5 小时 | ~2-3 天（不推荐） |
| E2E 测试 | ~5 分钟 | ~5 分钟 |

**建议使用 GPU 环境**。如果只有 CPU，跳过 Optuna（Phase 2C），其他操作仍可接受。

---

## 十、并行工作建议

### Subagent 并行: 推荐

| 任务 A | 任务 B | 说明 |
|--------|--------|------|
| 数据清洗脚本（1A-1D） | 编写 FOOD_KNOWLEDGE 训练样本（1F） | 独立数据操作，无冲突 |
| Python 训练配置修改（1E） | 真实场景测试集构建 | 独立文件 |

### 多 Chat 窗口并行: 有限推荐

| Chat A | Chat B | 冲突风险 |
|--------|--------|----------|
| Python 训练数据清洗+重训 | Java 错误日志系统（3C） | 无冲突 |
| 不建议同时修改 label_mapping.json 和训练脚本 | — | 强依赖，必须串行 |
