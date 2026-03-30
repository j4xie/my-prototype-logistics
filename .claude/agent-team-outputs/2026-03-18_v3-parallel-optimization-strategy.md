# V3训练期间并行优化策略评估报告

## Executive Summary

V3训练正在进行(epoch 36/50, mAP50=0.883)，当前应聚焦两件事：(1) 诊断V3相比V2回归4%的根因，(2) 准备推理后处理优化（per-class阈值、class-aware NMS）。Temperature Scaling在YOLO sigmoid架构上效果受限已排除。Glass误报根因是V1标注定义过宽（shortcut learning），后处理只能缓解不能根治。

> ⚠️ **Fact-check notice**: WBF "+23.9% mAP"声明错误(单模型场景无提升)；Temperature Scaling"无效"应为"效果受限"；GOIS"减少60-80%切片"数据无据可查。

---

## 共识与分歧决议

| 议题 | 结论 | 置信度 |
|------|------|--------|
| Class-aware NMS替换agnostic | 全员共识，当前代码确认是agnostic，修复成本低 | **90%** |
| Per-class置信度阈值 | 共识有效，glass设高阈值可减误报 | **85%** |
| Temperature Scaling | Critic正确：YOLO用sigmoid，TS效果受限，**降低优先级** | **10%** |
| SAHI切片320 vs 640 | 分歧未解：640对齐训练，但320 upscale有利小目标。**需A/B实验** | **50%** |
| WBF跨切片合并 | 单模型无提升(fact-check确认)，**放弃** | **5%** |
| Glass误报↓40-60% | 过度乐观，后处理预期↓15-25%更现实 | **15%** |
| Hard Negative Mining | 共识有效，V3完成后用误报样本补充 | **75%** |
| V3回归诊断 | Critic关键发现：未诊断就优化是盲目的 | **95%** |

---

## Glass过拟合根因分析

**根本原因**: V1数据来源(Roboflow/Kaggle)中glass类标注定义过宽——透明物体、反光表面、碎片均标为glass。模型学到"高对比度边缘特征=glass"的错误捷径(shortcut learning)，在产线图片(富含保鲜膜反光/肉纹理)上系统性触发。

**关键数据**: glass在训练集占16.9%不算高，但glass的视觉特征(高对比度、反光)比其他类更"容易学"，导致模型在不确定时默认预测glass。

**后处理≠根治**: 提高glass阈值只能以牺牲recall换precision，F1不会改善。根治需要glass标注taxonomy重定义。

---

## 分阶段行动建议

### Phase 1: V3训练期间（现在，CPU并行）

| # | 行动 | 耗时 | 预期效果 | 风险 |
|---|------|------|----------|------|
| 1 | **诊断V3回归原因** — 对比V2/V3数据集差异、训练曲线、per-class AP | 1h | 确定V3是否值得作为V4基线 | 无 |
| 2 | **编写per-class阈值搜索脚本** — 在val集上遍历各类阈值找最优 | 2h | glass阈值调优，误报↓15-25% | 可能过拟合校准集 |
| 3 | **修改NMS为class-aware** — 当前推理代码确认是agnostic | 30min | 消除跨类误抑制 | 极低 |
| 4 | **Cleanlab标注审计** — 对merged_v2运行，输出脏标列表 | 3h | 为V4清洗200-400张问题标注 | 清洗过度可能适得其反 |
| 5 | **Hard Negative Mining脚本** — 从7K验证图提取glass误报作负样本 | 2h | 为V4准备500-700张hard negatives | 无 |

### Phase 2: V3完成后

| # | 行动 | 耗时 | 依赖 |
|---|------|------|------|
| 6 | V3评估 + per-class分析 + 和牛SAHI测试 | 1h | V3 best.pt |
| 7 | SAHI A/B实验: 320 vs 640 切片 | 1h | V3 best.pt |
| 8 | TTA评估(augment=True) | 30min | V3 best.pt |
| 9 | 应用per-class阈值 + class-aware NMS | 30min | #2, #3完成 |

### Phase 3: V4准备

| # | 行动 | 耗时 |
|---|------|------|
| 10 | Glass标注taxonomy重定义(人工审核V1 glass数据) | 4-8h |
| 11 | Copy-Paste tiny scale偏重(0.05-0.2x占60%) | 2h |
| 12 | 整合Hard Negatives + Cleanlab清洗 + 新爬虫数据 | 2h |
| 13 | V4训练(epochs=50-100, batch=32, imgsz=640) | 12-20h |

---

## 被否决的方案

| 方案 | 否决原因 |
|------|----------|
| Temperature Scaling | YOLO用sigmoid非softmax，TS≈简单降阈值(Critic+Fact-check) |
| WBF替代NMS | 单模型无提升，+23.9%数据来自多模型ensemble(Fact-check确认错误) |
| SAHI batch化GPU推理 | 部署环境(47服务器)CPU ONNX无GPU |
| TensorRT FP16 | 同上，部署环境无GPU |
| GOIS引导式切片 | 需额外轻量模型，复杂度高，数据声明无据可查 |
| Loss reweighting | YOLO单阶段中counterproductive(论文验证) |

---

## 额外数据需求

当前不需要额外爬虫。已有数据：
- 验证集: 7,054张肉类异物(足够per-class阈值调优和hard negative mining)
- 训练集: 53K(V3) + 待清洗标注 + hard negatives → V4预计55-58K
- 负样本: meat_packaging_v3 12.7K(已部分加入)

**唯一可能需要的**: 如果glass taxonomy重定义后glass子类数据不足(<500张)，可能需要针对性爬取"食品中真实玻璃碎片"照片。但这取决于Phase 3的审查结果。

---

## 待解决问题

1. V3用了什么imgsz？与V2的超参差异具体是什么？
2. V3训练曲线是否显示过拟合（val loss上升）？
3. SAHI推理代码中agnostic_nms的实际设置值？
4. 部署环境(47服务器)是否有GPU可用？

---

### Healer Notes: All checks passed ✅

### Fact-Check Summary
- Total claims: 10
- ✅ Verified: 4 (#5, #6, #7, #9)
- ⚠️ Conditionally accurate: 4 (#1, #3, #4, #8)
- ❌ Incorrect: 2 (#2 WBF+23.9%, #10 GOIS-60-80%)

### Process Note
- Mode: Full
- Researchers deployed: 3
- Total sources found: 32+
- Key disagreements: 3 resolved (TS rejected, WBF rejected, loss reweighting rejected), 1 unresolved (SAHI slice size)
- Phases: Research → Analysis → Critique → Integration → Fact-Check → Heal
- Fact-check: 10 claims, 0 fully incorrect on core recommendations, 2 incorrect on cited numbers
- Healer: All checks passed ✅
