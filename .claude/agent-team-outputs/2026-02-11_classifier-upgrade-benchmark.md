# 分类器模型升级 Benchmark 评估报告

**日期**: 2026-02-11
**研究主题**: chinese-roberta-wwm-ext (F1=86.44%, 179类) 分类器升级策略

---

## Executive Summary

**核心结论：模型不是瓶颈，训练策略和数据质量才是。**

当前 F1=86.44% 不是 BERT-base 的理论上限（Banking77达93%, CLINC150达96%），而是**当前训练配置+数据不均衡**的天花板。通过 Focal Loss + Label Smoothing + 长尾类回译增强，预期可推至 89-91%。模型替换（LERT +0.44%, Large +0.60%）的ROI远低于训练策略优化。

---

## 服务器硬件诊断 (Part A)

| 项目 | 值 | 意义 |
|------|-----|------|
| CPU | AMD EPYC 8C | AVX-512 + VNNI + avx512_bf16 |
| 内存 | 14GB total, 12GB available | 足够运行任何base模型 |
| 磁盘 | 79GB free | 充足 |
| GPU | 无 | 推理依赖CPU, ONNX是关键 |
| 指令集 | AVX-512 + VNNI | INT8量化理想硬件, 预期2-3x加速 |

## 训练数据分析

| 指标 | 值 |
|------|-----|
| 总样本 | 19,690 |
| 类别数 | 179 |
| 平均/类 | 110 |
| 最大/类 | 181 (QUALITY_STATS) |
| 最小/类 | 35 (WAGE_REPORT) |
| <50样本的类 | 1 |
| <80样本的类 | ~30-40 (需增强目标) |

## 模型对比 (已有benchmark数据)

| 模型 | 参数量 | F1 (加权) | Top-1 Acc | Top-5 Acc | 推理延迟P95 |
|------|--------|-----------|-----------|-----------|------------|
| **chinese-roberta-wwm-ext** (当前) | 102M | 86.44% | 87.00% | 97.56% | 27ms |
| chinese-macbert-base | 102M | 86.07% | 86.49% | 97.36% | 49ms |
| chinese-lert-base | 102M | **86.88%** | 87.20% | 97.46% | 51ms |
| chinese-roberta-wwm-ext-large | 326M | 87.04% | 87.66% | 96.70% | 94ms |

## 优化路径 ROI 排序

| 优先级 | 路径 | 预期F1提升 | 成本 | ROI |
|--------|------|-----------|------|-----|
| **S1** | Focal Loss + Label Smoothing | +1.0~2.5% | 1天 | ★★★★★ |
| **S2** | 长尾类回译增强 (<80样本) | +0.5~2.0% | 2-3天 | ★★★★ |
| **S3** | 换LERT-base | +0.44% (已验证) | 改一行 | ★★★★ |
| **S4** | DeBERTa-v2-97M测试 | +0~1.5% (未验证) | 改一行+跑benchmark | ★★★ |
| **S5** | ONNX INT8量化 | 0% F1, 2-3x加速 | 2-3天 | ★★★★ |
| **S6** | 超参网格搜索 | +0.3~1.0% | 半天 | ★★★ |
| **S7** | 换Large模型 | +0.60% | 改一行 | ★★ |
| **S8** | 增加数据至30K | +1.0~3.0% | 高 | ★★★ |

## 执行计划

### 第一阶段 (1-2天, 预期F1: 87.5~89%)
1. **Label Smoothing**: `TrainingArguments(label_smoothing_factor=0.1)` — 改一行
2. **Focal Loss**: 自定义Trainer覆写compute_loss, gamma=2, alpha=0.25
3. **LERT-base**: 改 `BASE_MODEL = "hfl/chinese-lert-base"` — 改一行

### 第二阶段 (3-5天, 预期F1: 89~90%)
4. **长尾类回译增强**: 中→英→中, 将<80样本的类扩充至100+
5. **DeBERTa-v2-97M测试**: 添加到benchmark候选列表

### 第三阶段 (部署优化, 2-3天)
6. **ONNX INT8量化**: S8S8+QDQ, reduce_range=False, 预期推理10-15ms

## Critic 关键发现

1. **F1=86%不是BERT-base天花板** — Banking77(77类)达93%, CLINC150(150类)达96%。瓶颈是类别粒度和数据均衡性
2. **数据增强对长尾类仍然有效** — 仅全量增强边际递减，定向增强<80样本类预期+5-15% recall
3. **突破90%的关键** — 可能需要审视179个意图的类别体系，合并语义距离过近的类别对
4. **预期最终目标**: F1 = 89-91%, 推理延迟从27ms降至10-15ms

---

### Process Note
- Mode: Full (modified — server diagnostics + 2 researchers + analyst-critic combo)
- Researchers deployed: 2
- Total sources found: 16+
- Key disagreements: "86% ceiling" challenged successfully with counter-examples
- Phases completed: Server Diagnostics → Research (parallel) → Analysis+Critique
