# V3 训练方案评估报告

## Executive Summary

**建议**: 暂停V3新策略叠加，先诊断V2→V2.5的7.4%回归原因，回退到V2(mAP=0.922)作为V3基线。

**核心发现**: Critic指出V2(mAP=0.922)→V2.5(mAP=0.854)回归了7.4%，且原因未诊断（模型n→s + 分辨率640→1280 + epoch不足30同时变化）。在错误基线上叠加更多优化有浪费风险。

---

## 最终推荐方案

### 第一步：诊断回归（今天，2-3小时）

| 实验 | 配置 | 目的 |
|------|------|------|
| A | V2 best.pt + imgsz=1280 + 10ep | 隔离分辨率影响 |
| B | V2 best.pt + imgsz=640 + 合成和牛数据 + 10ep | 隔离合成数据效果 |

对比A/B结果决定V3方向。

### 第二步：V3训练（基于诊断结果）

**如果A显示1280不回归**：
```
V3 = V2 best.pt + imgsz=1280 + freeze=10 + copy_paste=0.3 + 合成数据8K
```

**如果A确认1280是回归主因**：
```
V3 = V2 best.pt + imgsz=640 + 合成数据8K + SAHI仅推理
```

### 关键配置变更（vs当前）

| 参数 | 当前V2.5 | V3推荐 | 文献依据 |
|------|---------|--------|---------|
| 基线模型 | V2-1280 best.pt | **V2 best.pt** | Critic: 回退到最高性能基线 |
| freeze | null | **10** | TFA论文: few-shot冻结backbone +2-20点 |
| copy_paste | 0.0 | **0.3** | Copy-Paste CVPR2021: AP+10 |
| mosaic | 0.3 | **0.2** | 防止缩小微小目标 |
| close_mosaic | 10 | **10** | 保持 |
| scale | 0.5 | **0.3** | 降低随机缩放幅度保护小目标 |
| 合成数据占比 | ~5% | **10-15%** | 文献共识: tiny需占10-20% |
| 合成scale | 0.5-2.0x | **0.1-0.5x** | 匹配和牛异物0.02-0.33%面积 |

---

## 置信度评估

| 结论 | 置信度 |
|------|--------|
| V2→V2.5回归需优先诊断 | ★★★★★ |
| 回退V2作为V3基线 | ★★★★☆ |
| Copy-Paste合成可提升mAP | ★★★☆☆ |
| freeze=10对少样本有效 | ★★★☆☆ |
| 三阶段方案达≥3/5和牛检出 | ★★☆☆☆ |

---

## 被否决的方案

| 方案 | 否决原因 |
|------|---------|
| P2检测头 | +60% FLOPs仅+0.4% mAP，预训练权重不匹配 |
| AFPN/SPD-Conv | 需自定义代码，YOLOv11集成无官方教程 |
| Repeat Factor Sampling | YOLOv5实测mAP降-0.9 |
| Grounding DINO | 推理200ms不满足产线要求 |
| multi_scale | batch=8+imgsz=1600峰值OOM |

---

### Process Note
- Mode: Full
- Researchers deployed: 3
- Total sources found: 41+
- Key disagreements: 3 resolved, 2 unresolved
- Phases: Research → Analysis → Critique → Integration
- Fact-check: skipped (internal technical analysis)
- Healer: All checks passed
