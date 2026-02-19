# ONNX 意图分类器 F1 优化路线图：从 87% 到 92%+

**分析日期**: 2026-02-18
**分析师**: Analyst Agent
**目标**: 将 chinese-roberta-wwm-ext 分类器从当前 F1 ~87-90% 提升到 92%+

---

## 一、现状诊断（关键发现）

### 1.1 训练数据概况

| 指标 | 值 | 评价 |
|------|-----|------|
| 总样本数 | 19,177 | 偏少（177类，平均108样本/类） |
| 类别数 | 177（label_mapping 实际 177，非 170） | 仍有未合并的重复意图 |
| 类别不平衡比 | 1.5:1（100~150/类） | **看似均衡，实则人为截断** |
| 文本长度均值 | 7.9 字符 | **严重偏短** |
| <10 字符占比 | 80.5% | **与真实用户输入分布严重不匹配** |
| 最大文本长度 | 30 字符 | **缺少长句训练样本** |
| 有冲突标签的文本 | 688 条 | **严重问题：同一文本被标注为不同意图** |
| 重复文本 | 1,242 条 | 存在冗余 |
| 模板化噪声 | ~1,278 条（"了没"/"什么时候好"等） | 数据为人工/LLM批量生成，非真实用户日志 |

### 1.2 标签体系缺陷

**仍存在的重复意图组**（前一轮 179→170 合并不彻底）：

| 重复组 | 意图列表 | 应合并为 |
|--------|----------|----------|
| HR 删除员工 | `HRM_DELETE_EMPLOYEE`, `HR_DELETE_EMPLOYEE`, `HR_EMPLOYEE_DELETE` | `HR_DELETE_EMPLOYEE` |
| 导航城市 | `NAVIGATE_TO_CITY`, `NAVIGATION_TO_CITY` | `NAVIGATE_TO_CITY` |
| 导航地点 | `NAVIGATE_TO_LOCATION`, `NAVIGATION_TO_LOCATION` | `NAVIGATE_TO_LOCATION` |
| 翻页 | `NAVIGATION_NEXT_PAGE`, `PAGINATION_NEXT` | `PAGINATION_NEXT` |
| 微信通知 | `NOTIFICATION_SEND_WECHAT`, `NOTIFICATION_WECHAT_SEND`, `SEND_WECHAT_MESSAGE` | `NOTIFICATION_SEND_WECHAT` |
| 排除已选 | `EXCLUDE_SELECTED`, `FILTER_EXCLUDE_SELECTED`, `SYSTEM_FILTER_EXCLUDE_SELECTED`, `UI_EXCLUDE_SELECTED` | `EXCLUDE_SELECTED` |
| 订单修改 | `ORDER_MODIFY`, `ORDER_UPDATE` | `ORDER_UPDATE` |

**合并后可从 177 类减至 ~165 类**，直接消除 12 个类的混淆。

### 1.3 缺失的关键意图

- **`FOOD_KNOWLEDGE_QUERY`** 不在 label_mapping 中——分类器完全无法识别食品知识查询意图
- 这是系统依赖 `IntentDisambiguationService` (LLM 消歧) 做 fallback 的根本原因

### 1.4 模型与训练配置

| 参数 | 当前值 | 评价 |
|------|--------|------|
| 基础模型 | `hfl/chinese-roberta-wwm-ext` | 合理但非最优 |
| Epochs | 5 | 偏少 |
| Batch Size | 32 | 合理 |
| Learning Rate | 2e-5 | 标准值 |
| Max Length | 64 | 合理（训练数据最长仅30字） |
| Loss | CrossEntropyLoss（HF Trainer 默认） | **无类别权重/Focal Loss** |
| 数据增强 | 无 | **严重缺失** |
| Label Smoothing | 无 | 缺失 |
| 量化 | QUInt8 动态量化 | 合理（F1 仅损 0.14%） |
| 推理延迟 | 10.8ms (INT8) | 优秀 |

### 1.5 路由管线现状

```
Layer 0: 短语匹配 (HashMap, ~200短语)          → 精确但覆盖稀疏
Layer 1: ONNX 分类器 (177类, 阈值 0.70/0.85)   → 主力层，高置信直接返回
Layer 2: 语义路由器 (Embedding, 阈值 0.75/0.92) → 中置信补充
Layer 3: LLM Fallback (qwen-turbo)              → 低置信兜底
Layer 5: 消歧层 (LLM, 食品vs工厂)              → 冲突修正
```

**核心矛盾**: 分类器(Layer 1)的高置信阈值在生产环境降到了 0.70（`application-pg-prod.properties`），意味着许多低质量预测也被直接采用。

---

## 二、Impact vs Effort 矩阵

### Quick Win（高收益/低成本，1-3天）

| # | 优化项 | 预估 F1 增益 | 工作量 | 风险 |
|---|--------|-------------|--------|------|
| QW1 | 第二轮类别合并（177→165） | +1.5~2.0% | 0.5天 | 低 |
| QW2 | 清理 688 条冲突标签数据 | +1.0~1.5% | 1天 | 低 |
| QW3 | 添加 FOOD_KNOWLEDGE_QUERY 到分类器 | +0.5~1.0% | 0.5天 | 低 |
| QW4 | Label Smoothing (ε=0.1) | +0.3~0.5% | 0.1天 | 极低 |
| QW5 | 生产环境阈值从 0.70 调回 0.85 | +0%（提高精度不提F1） | 0.1天 | 中 |

### Strategic Investment（中等收益/中等成本，1-2周）

| # | 优化项 | 预估 F1 增益 | 工作量 | 风险 |
|---|--------|-------------|--------|------|
| SI1 | 数据增强（同义词替换+回译+长句生成） | +2.0~3.0% | 3天 | 低 |
| SI2 | Focal Loss + 类别权重 | +0.5~1.0% | 0.5天 | 低 |
| SI3 | 超参搜索（Optuna, LR/Epochs/WarmUp） | +0.5~1.0% | 1天 | 低 |
| SI4 | 置信度校准（Temperature Scaling） | +0.5~1.0%（端到端） | 1天 | 低 |
| SI5 | 短语匹配扩展至 500+ 条 | +1.0~1.5%（端到端） | 2天 | 低 |
| SI6 | 领域预训练（Continue Pre-training） | +1.0~2.0% | 3天 | 中 |
| SI7 | 分层分类（Domain→Intent 两级） | +1.5~2.5% | 5天 | 中 |

### Nice-to-Have（低收益或高成本，>2周）

| # | 优化项 | 预估 F1 增益 | 工作量 | 风险 |
|---|--------|-------------|--------|------|
| NH1 | 换用 ERNIE 3.0 / MacBERT | +0.5~1.5% | 3天 | 中（兼容性） |
| NH2 | 知识蒸馏（大模型→小模型） | +0.5~1.0% | 5天 | 中 |
| NH3 | 对比学习（SimCSE/Supervised Contrastive） | +0.5~1.0% | 3天 | 中 |
| NH4 | 多任务学习（+NER 辅助任务） | +0.5~1.0% | 5天 | 高 |
| NH5 | A/B 测试框架 | 0%（度量提升） | 5天 | 低 |
| NH6 | BiLSTM/Attention 层叠加 | +0.3~0.5% | 2天 | 中 |

---

## 三、分阶段实施路线图

### Phase 1：数据清洗与标签修复（预计 +3.0~4.5% F1）

**时间**: 2-3天
**预期结果**: F1 从 ~87-90% 提升到 ~91-93%

#### 1A. 第二轮类别合并

**修改文件**: `scripts/finetune/data/label_mapping.json`, `scripts/finetune/data/full_training_data.jsonl`

合并规则（共减少 12 个类）：

```python
MERGE_MAP = {
    # HR 删除员工 (3→1)
    'HRM_DELETE_EMPLOYEE': 'HR_DELETE_EMPLOYEE',
    'HR_EMPLOYEE_DELETE': 'HR_DELETE_EMPLOYEE',

    # 导航 (4→2)
    'NAVIGATION_TO_CITY': 'NAVIGATE_TO_CITY',
    'NAVIGATION_TO_LOCATION': 'NAVIGATE_TO_LOCATION',

    # 翻页 (2→1)
    'NAVIGATION_NEXT_PAGE': 'PAGINATION_NEXT',

    # 微信通知 (3→1)
    'NOTIFICATION_WECHAT_SEND': 'NOTIFICATION_SEND_WECHAT',
    'SEND_WECHAT_MESSAGE': 'NOTIFICATION_SEND_WECHAT',

    # 排除已选 (4→1)
    'FILTER_EXCLUDE_SELECTED': 'EXCLUDE_SELECTED',
    'SYSTEM_FILTER_EXCLUDE_SELECTED': 'EXCLUDE_SELECTED',
    'UI_EXCLUDE_SELECTED': 'EXCLUDE_SELECTED',

    # 订单修改 (2→1)
    'ORDER_MODIFY': 'ORDER_UPDATE',
}
```

**Java 侧同步修改**:
- `IntentKnowledgeBase.java`: 在等价意图组中添加旧→新映射
- `IntentCompositionConfig.java`: 合并后移除冗余映射
- `IntentExecutorServiceImpl.java`: `resolveHandlerCategory()` 方法确认新映射

**预估增益**: +1.5~2.0%（直接消除类间混淆）

#### 1B. 清理冲突标签

688 条同一文本对应多个意图的样本必须处理。策略：

1. **自动去重**: 对每条冲突文本，保留最合理的一个标签（基于文本与意图描述的语义相似度）
2. **人工审核**: 对无法自动判断的 top-100 冲突样本，人工标注
3. **移除无法判断的**: 删除剩余无法确定的冲突样本

```python
# scripts/finetune/clean_conflicts.py (建议新增)
# 1. 读取所有 (text, label) 对
# 2. 对同一 text 有多个 label 的，用 embedding 相似度选最佳
# 3. 输出清洗后的 full_training_data_clean.jsonl
```

**预估增益**: +1.0~1.5%（消除训练噪声）

#### 1C. 添加 FOOD_KNOWLEDGE_QUERY 意图

当前分类器完全缺失食品知识查询意图，导致所有食品知识类查询被误分类到其他意图，然后依赖 LLM 消歧修正。

1. 在 `label_mapping.json` 中添加 `FOOD_KNOWLEDGE_QUERY` 类
2. 在 `full_training_data.jsonl` 中添加 100-150 条食品知识样本：
   - "大肠杆菌超标的原因和预防措施"
   - "酸奶的生产工艺要注意什么"
   - "HACCP 体系包含哪些关键控制点"
   - "冷链运输温度标准是多少"
   - 等

3. 同步 Java `IntentExecutorServiceImpl.java` 添加 FOOD_KNOWLEDGE 处理分支

**预估增益**: +0.5~1.0%（减少 LLM 消歧调用）

#### 1D. 训练配置快速优化

修改 `scripts/finetune/finetune_full.py`：

```python
# 1. 启用 Label Smoothing
training_args = TrainingArguments(
    ...
    label_smoothing_factor=0.1,  # 新增
    ...
)

# 2. 增加 Epochs
EPOCHS = 8  # 从 5 增加到 8，配合 early_stopping_patience=3

# 3. 学习率微调
LEARNING_RATE = 3e-5  # 略微增大（177 类需要更多梯度）
WARMUP_RATIO = 0.06   # 减少 warmup 让模型更快进入训练
```

**预估增益**: +0.3~0.5%

---

### Phase 2：数据增强与高级训练策略（预计额外 +2.0~3.5% F1）

**时间**: 5-7天
**预期结果**: F1 达到 93-95%

#### 2A. 中文数据增强管线

当前训练数据最大缺陷是**缺少多样化表达**。需要新建一个数据增强脚本。

**建议新增文件**: `scripts/finetune/augment_data.py`

```python
"""
三层数据增强策略：
1. 同义词替换（使用 jieba + 同义词词典）
2. 长句生成（在短句基础上添加口语化修饰）
3. LLM 回译（中→英→中，使用 qwen-turbo）
"""

# 策略 1: 同义词替换
# "查看今天的生产批次" → "看一下今天的生产批次"
# "查看今天的生产批次" → "查询今天的加工批次"

# 策略 2: 长句扩展（解决 80% 样本 < 10 字符的问题）
EXPANSION_TEMPLATES = [
    "帮我{verb}一下{noun}",
    "能不能{verb}{time}{noun}",
    "我想要{verb}{factory_context}{noun}",
    "{time}的{noun}{verb}情况怎么样",
    "请帮我把{noun}的{verb}结果显示出来",
]

# 策略 3: LLM 回译 / 同义改写
# 调用 qwen-turbo: "请用 5 种不同的说法改写以下意图查询：..."
```

**目标**: 每类从 100-150 条扩增至 300-500 条，总训练数据达 50,000-80,000 条。

**重点扩增长句样本**——当前 30+ 字符的样本仅 1 条（占 0.005%），真实用户 20-50 字符的查询非常常见。

**预估增益**: +2.0~3.0%

#### 2B. Focal Loss 替代 CrossEntropy

虽然类别分布看似均衡（100-150/类），但**类内难度差异很大**——部分意图有明确的触发词（"打卡" → CLOCK_IN），部分意图语义模糊（"查看设备" → EQUIPMENT_LIST or EQUIPMENT_DETAIL or EQUIPMENT_STATUS_QUERY）。

修改 `scripts/finetune/finetune_full.py`：

```python
import torch.nn.functional as F

class FocalLoss(torch.nn.Module):
    def __init__(self, gamma=2.0, alpha=None):
        super().__init__()
        self.gamma = gamma
        self.alpha = alpha  # 可选类别权重

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

**预估增益**: +0.5~1.0%

#### 2C. 超参搜索

使用 Optuna 对关键超参进行自动搜索：

```python
# scripts/finetune/hparam_search.py (建议新增)
import optuna

def objective(trial):
    lr = trial.suggest_float("learning_rate", 1e-5, 5e-5, log=True)
    batch_size = trial.suggest_categorical("batch_size", [16, 32, 64])
    warmup = trial.suggest_float("warmup_ratio", 0.03, 0.15)
    weight_decay = trial.suggest_float("weight_decay", 0.001, 0.1, log=True)
    epochs = trial.suggest_int("epochs", 5, 12)
    label_smoothing = trial.suggest_float("label_smoothing", 0.0, 0.2)
    # ... train and return val F1

study = optuna.create_study(direction="maximize")
study.optimize(objective, n_trials=30)
```

搜索空间：
- Learning Rate: 1e-5 ~ 5e-5
- Batch Size: 16 / 32 / 64
- Warmup Ratio: 0.03 ~ 0.15
- Weight Decay: 0.001 ~ 0.1
- Epochs: 5 ~ 12
- Label Smoothing: 0.0 ~ 0.2

**预估增益**: +0.5~1.0%

---

### Phase 3：模型与管线架构优化（预计额外 +1.0~2.0% F1）

**时间**: 1-2周
**预期结果**: 端到端路由准确率达 94-96%

#### 3A. 领域预训练（Domain-Adaptive Pre-Training）

在 fine-tuning 之前，先在食品溯源领域语料上继续预训练 (Masked Language Modeling)：

**语料来源**：
1. 系统内所有 AI 意图描述文本（`intent_names` 中的 177 条中文描述）
2. 食品安全法规文档（HACCP 标准、GB 国标文本）
3. 系统已有的用户查询日志
4. 食品加工行业术语词典

```python
# scripts/finetune/domain_pretrain.py (建议新增)
from transformers import AutoModelForMaskedLM, DataCollatorForLanguageModeling

model = AutoModelForMaskedLM.from_pretrained("hfl/chinese-roberta-wwm-ext")
# Continue MLM pre-training on domain corpus for 3-5 epochs
# Then use this checkpoint as base for classification fine-tuning
```

**预估增益**: +1.0~2.0%（让模型理解"批次"、"溯源"、"冷链"等领域术语）

#### 3B. 置信度校准（Temperature Scaling）

当前分类器输出的 softmax 概率未校准——0.85 置信度的预测实际可能只有 72% 准确。

在 Java 推理侧添加温度缩放：

```java
// ClassifierIntentMatcher.java 修改
private double calibrationTemperature = 1.5;  // 通过验证集拟合

public ClassifierResult classify(String input) {
    float[] logits = onnxInference(input);
    // 温度缩放
    for (int i = 0; i < logits.length; i++) {
        logits[i] /= calibrationTemperature;
    }
    float[] probs = softmax(logits);
    // ... 返回结果
}
```

温度参数通过验证集上的 NLL 最小化来拟合。校准后置信度阈值可以更精确地设置。

**预估增益**: +0.5~1.0%（端到端，通过更准确的阈值决策）

#### 3C. 短语匹配扩展

当前 Layer 0 仅约 200 条短语。建议扩展到 500-800 条，重点覆盖：
1. **高频混淆对**的明确短语（从冲突数据中提取）
2. **食品知识**的触发短语（"XXX的注意事项"、"XXX工艺流程"）
3. **口语化变体**（"看一下"、"帮我查"、"能不能"等前缀）

修改文件: `IntentKnowledgeBase.java` 中的 `phraseToIntentMapping`

**预估增益**: +1.0~1.5%（端到端，高置信短路减少分类器错误传播）

#### 3D. 级联阈值优化

当前系统对分类器和语义路由器使用固定阈值。建议改为分级级联：

```
分类器 confidence ≥ 0.90 → 直接返回（当前 0.85/0.70 太低）
分类器 confidence 0.70~0.90 → 语义路由器验证
分类器 confidence 0.50~0.70 → LLM reranking（仅 top-3 候选）
分类器 confidence < 0.50 → 完整 LLM 流程
```

修改文件: `AIIntentServiceImpl.java` (第 739 行区域)

**预估增益**: +0.5~1.0%（减少低置信错误传播）

---

### Phase 4：进阶优化（可选，长期收益）

#### 4A. 分层分类架构

将 165 个平面意图拆为两级分类：

**Level 1（领域分类，~12 类）**:
MATERIAL / SHIPMENT / ORDER / ATTENDANCE / EQUIPMENT / QUALITY / PROCESSING / ALERT / SUPPLIER / CUSTOMER / FOOD / SYSTEM

**Level 2（域内意图分类，每域 5-20 类）**:
例：MATERIAL 域下 → BATCH_QUERY / BATCH_CREATE / ADJUST_QUANTITY / EXPIRED_QUERY / LOW_STOCK_ALERT / FIFO_RECOMMEND ...

- Level 1 准确率可达 98%+（12 类分类问题很简单）
- Level 2 准确率在域内可达 95%+（类数大幅减少）
- **组合准确率**: 98% × 95% = 93.1%，优于平面 165 类的 ~89%

**工作量**: 5 天（需要两个模型 + 推理管线改造）
**预估增益**: +1.5~2.5%

#### 4B. 模型替换评估

考虑用以下模型替代 `chinese-roberta-wwm-ext`：

| 模型 | 优势 | 劣势 | 建议 |
|------|------|------|------|
| ERNIE 3.0-base | Baidu 对中文 NLU 优化，知识增强 | 需 PaddlePaddle 生态 | **值得尝试**，如果可以转 ONNX |
| MacBERT | 同义词 MLM，中文理解更好 | 与 RoBERTa 差异不大 | 次优选择 |
| ChineseBERT | 字形+拼音嵌入 | 参数量更大，推理更慢 | 不推荐（ONNX 推理增加延迟） |
| MiniLM/TinyBERT | 6层，推理快 3x | F1 可能降 1-2% | 不推荐（当前延迟已足够好） |

**建议**: 先在 Phase 1-3 的数据改进上获得收益，再考虑模型替换。数据质量 > 模型架构。

#### 4C. 对比学习（Contrastive Learning）

使用 Supervised Contrastive Loss 作为辅助目标：

```python
# 同意图的样本嵌入应该靠近，不同意图应该远离
# 特别适合处理 "排除已选" vs "系统排除" 这类重叠意图
```

**预估增益**: +0.5~1.0%
**工作量**: 3 天

---

## 四、F1 增益叠加预测

| Phase | 优化项 | 单项增益 | 累计 F1（从 89% 基线） |
|-------|--------|---------|----------------------|
| **1A** | 类别合并 177→165 | +1.5~2.0% | 90.5~91.0% |
| **1B** | 冲突标签清理 | +1.0~1.5% | 91.5~92.5% |
| **1C** | 添加 FOOD_KNOWLEDGE 意图 | +0.5~1.0% | 92.0~93.5% |
| **1D** | Label Smoothing + 超参 | +0.3~0.5% | 92.3~94.0% |
| **2A** | 数据增强（同义词+长句+回译） | +2.0~3.0% | **93.5~95.0%** |
| **2B** | Focal Loss | +0.5~1.0% | 94.0~95.5% |
| **2C** | Optuna 超参搜索 | +0.5~1.0% | 94.5~96.0% |
| **3A** | 领域预训练 | +1.0~2.0% | 95.0~96.5% |
| **3B-D** | 管线优化（校准+短语+级联） | +1.0~2.0% | **端到端 95.5~97.0%** |

> **注意**: 以上增益存在边际递减效应。实际叠加不会简单相加。保守估计 Phase 1+2 完成后可达 92-94%，Phase 1+2+3 可达 94-96%。

---

## 五、风险评估

### 高风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 类别合并后 Java Handler 映射断裂 | 运行时 500 错误 | 合并前检查 `IntentExecutorServiceImpl.resolveHandlerCategory()` 所有路由 |
| 数据增强引入噪声 | F1 反降 | 增强后先在验证集验证，保留原始数据作为 baseline |
| ONNX 模型更新后 Java 端不兼容 | 推理失败 | 保持相同 tokenizer + input schema，更新前回归测试 |
| 生产阈值调高导致更多查询走 LLM | LLM 延迟增加/成本增加 | 监控 LLM fallback 率，逐步调整 |

### 中风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 领域预训练不充分 | 无效果或轻微降低 | 小规模实验先验证，使用独立验证集 |
| Focal Loss γ 参数不当 | 过度关注难样本 | 搜索 γ ∈ {1.0, 1.5, 2.0, 3.0} |
| 分层分类增加推理延迟 | 总延迟从 10ms→20ms | 两个小模型可以并行推理 |

### 低风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Label Smoothing 过大 | 轻微降低峰值准确率 | ε=0.1 是经验安全值 |
| 超参搜索耗时 | GPU 时间 | 限制 30 trials，使用 TPE 采样 |

---

## 六、实施优先级总结

```
第 1 周（必做，预计 +3.5~5.0%）:
  ├── Day 1-2: 类别合并 + 冲突数据清理 + FOOD_KNOWLEDGE 意图添加
  ├── Day 3:   Label Smoothing + Epochs 调整 → 重新训练 → 验证
  └── Day 4-5: 数据增强脚本开发 + 第一轮增强数据生成

第 2 周（推荐，预计额外 +1.5~3.0%）:
  ├── Day 1-2: Focal Loss 实现 + Optuna 超参搜索
  ├── Day 3-4: 领域预训练实验
  └── Day 5:   ONNX 重新量化 + Java 端部署 + E2E 验证

第 3 周（可选，预计额外 +1.0~2.0%）:
  ├── 置信度校准 (Temperature Scaling)
  ├── 短语匹配扩展至 500+
  ├── 级联阈值优化
  └── 端到端 150 条 E2E 测试验证
```

---

## 七、验证与度量方案

### 离线验证

```python
# 每次训练后运行以下验证：
# 1. 整体 F1 (weighted)
# 2. Per-class F1（重点关注 bottom-10 类）
# 3. 混淆矩阵热力图（重点关注历史冲突对）
# 4. Top-1 / Top-3 / Top-5 准确率
# 5. 不同文本长度段的 F1（<10 / 10-20 / 20-40 / >40 字符）
```

### 在线验证

使用现有 E2E 测试脚本 `tests/intent-routing-e2e-150.py`：
- 150 条真实场景测试用例
- 覆盖 咨询/查询/写入 三大类
- 验证端到端路由准确率（不仅是分类器 F1）

### 关键 KPI

| 指标 | 当前值 | Phase 1 目标 | Phase 2 目标 | Phase 3 目标 |
|------|--------|-------------|-------------|-------------|
| 分类器 F1 (weighted) | ~89% | 92% | 94% | 95%+ |
| E2E 路由准确率 | ~90% | 93% | 95% | 96%+ |
| LLM Fallback 率 | ~15-20% | <10% | <5% | <3% |
| 平均推理延迟 | 10.8ms | <15ms | <15ms | <20ms |
| ONNX 模型大小 | 103MB (INT8) | <110MB | <110MB | <120MB |

---

## 八、核心结论

**最大收益的前三项优化**（务必优先执行）：

1. **数据清洗**（清理 688 条冲突标签 + 12 类合并）——这是当前 F1 天花板的根本原因。分类器在矛盾标签上永远无法学好。预计 +2.5~3.5%。

2. **数据增强**（长句生成 + 同义词替换 + LLM 改写）——80% 训练样本不足 10 字符，与真实用户输入严重脱节。这是泛化能力差的根本原因。预计 +2.0~3.0%。

3. **添加 FOOD_KNOWLEDGE 意图到分类器**——当前完全缺失这个关键类别，导致系统性能依赖昂贵的 LLM 消歧层。预计 +0.5~1.0%（并减少 LLM 调用成本）。

> **"数据质量 > 模型架构 > 训练技巧"** —— 在当前数据存在 688 条冲突标签、80% 样本过短、关键意图缺失的情况下，任何模型架构改进都无法充分发挥作用。Phase 1 的数据修复是所有后续优化的前提条件。

---

## 并行工作建议

### Subagent 并行: ✅ 推荐

| 并行任务 A | 并行任务 B | 说明 |
|-----------|-----------|------|
| 类别合并脚本 | 数据增强脚本 | 独立模块，无冲突 |
| Python 训练优化 | Java 路由阈值调整 | 前后端独立 |
| Focal Loss 实验 | Optuna 超参搜索 | 可共享 GPU，但逻辑独立 |

### 多Chat窗口并行: ✅ 推荐

| Chat A | Chat B | 冲突风险 |
|--------|--------|----------|
| Python 训练脚本修改 | Java IntentKnowledgeBase 短语扩展 | 无冲突 |
| 数据清洗 + 重训练 | E2E 测试脚本增强 | 无冲突 |
| 领域预训练实验 | 前端 AI 交互优化 | 无冲突 |
