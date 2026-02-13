# S1 分类器优化 Benchmark 实测结果

**日期**: 2026-02-11
**硬件**: RTX 3060 (CUDA), 总训练时间 ~25分钟
**数据**: 19,690 样本, 179 意图类别

---

## 基座模型对比 (已有结果)

| 模型 | 参数量 | F1 | Top-1 | Top-5 | 延迟P95 |
|------|--------|-----|-------|-------|---------|
| **chinese-roberta-wwm-ext** (当前) | 102M | 86.44% | 87.00% | 97.56% | 27ms |
| chinese-macbert-base | 102M | 86.07% | 86.49% | 97.36% | 49ms |
| chinese-lert-base | 102M | 86.88% | 87.20% | 97.46% | 51ms |
| chinese-roberta-wwm-ext-large | 326M | 87.04% | 87.66% | 96.70% | 94ms |

## S1 优化策略对比 (实测)

| 实验 | Top-1 | Top-5 | F1 | Loss | Lat P95 | vs基线 |
|------|-------|-------|-----|------|---------|--------|
| A: roberta (基线) | 87.00% | 97.56% | 86.44% | 0.486 | 27ms | — |
| B: roberta + LabelSmooth(0.1) | 86.90% | **97.61%** | **86.72%** | 1.197 | 26ms | **+0.28%** |
| C: roberta + FocalLoss(γ=2) | 86.85% | 97.36% | 86.67% | 0.253 | 23ms | +0.23% |
| D: roberta + FL(γ=2)+LS(0.1) | 86.74% | 97.41% | 86.55% | 0.332 | 36ms | +0.11% |
| E: LERT + FL(γ=2)+LS(0.1) | 86.69% | 97.46% | 86.60% | 0.302 | 22ms | +0.16% |

## 最差意图分析

反复出现在 Worst-5 的意图 (across all experiments):

| ID | 意图 | 平均F1 | 问题 |
|----|------|--------|------|
| 146 | SEND_WECHAT_MESSAGE | ~0.24 | 与 NOTIFICATION_SEND_WECHAT 高度重叠 |
| 82 | NAVIGATION_NEXT_PAGE | ~0.27 | 与 PAGINATION_NEXT 高度重叠 |
| 85 | NOTIFICATION_SEND_WECHAT | ~0.28 | 与 SEND_WECHAT_MESSAGE 高度重叠 |
| 56 | HR_DELETE_EMPLOYEE | ~0.33 | 低样本+语义模糊 |
| 166 | TASK_ASSIGN_WORKER | ~0.38 | 语义模糊 |
| 86 | NOTIFICATION_WECHAT_SEND | ~0.38 | 第3个微信发送变体 |
| 96 | PAGINATION_NEXT | ~0.32 | 第2个翻页变体 |

## 核心结论

### 86.44% 是179个意图体系的天花板，不是训练策略的天花板

1. **所有S1优化改进 < 0.3%** — 远低于预期的 +1.0~2.5%
2. **FL+LS组合反而更差** — 过度正则化
3. **换LERT基座+优化策略也不超过0.3%**
4. **瓶颈是意图体系** — 有语义高度重叠的意图对:
   - 微信发送: 3个变体 (SEND_WECHAT_MESSAGE, NOTIFICATION_SEND_WECHAT, NOTIFICATION_WECHAT_SEND)
   - 翻页: 2个变体 (NAVIGATION_NEXT_PAGE, PAGINATION_NEXT)
5. **Banking77=93%, CLINC150=96%** 的高F1 — 因为它们的类别边界清晰

## 推荐行动 (ROI排序)

| 优先级 | 行动 | 预期效果 | 成本 |
|--------|------|----------|------|
| **P0** | 合并语义重复意图 (179→~160) | F1+2-4% | 半天 |
| **P1** | ONNX INT8量化 | 延迟从27ms→10-15ms | 2-3天 |
| **P2** | 保持当前模型不变 | 节省切换成本 | 0 |
| ~~P3~~ | ~~换基座模型~~ | ~~+0.28%~~ | ~~不值得~~ |
| ~~P4~~ | ~~Focal Loss/Label Smoothing~~ | ~~+0.28%~~ | ~~不值得~~ |
