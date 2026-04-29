# YOLO 食品异物检测 6-Class Aggressive 优化设计 (Apr 17 2026)

**Status**: Spec revised 2026-04-17 (v2 - aggressive 6-class plan)
**Deadline**: 算力中心 2026-04-19 到期 (剩 ~20h)
**Baseline**: ULTRA_v1 (6-class on 36K clean data) mAP50 = 0.612 / TTA 0.647 on clean val

---

## Why (上下文)

V1 模型声称 mAP50=0.855, 但在清洁 val 上重测只有 0.557 — 之前所有数字被标注噪声污染。经过 ULTRA_v1 (丢 62K auto_VL 垃圾数据) 提升到 0.612/0.647.

Per-class 真实能力 (TTA):

| Class | AP50 (TTA) | 目标 | Gap |
|-------|-----------|------|-----|
| insect | 0.856 | ≥ 0.87 | +0.01 |
| hair | 0.788 | ≥ 0.83 | +0.04 |
| glass | 0.715 | ≥ 0.78 | +0.07 |
| bone | 0.697 | ≥ 0.75 | +0.05 |
| **color_anomaly** | 0.601 | **≥ 0.70** | +0.10 |
| **mold** | 0.228 | **≥ 0.70** | **+0.47 (extreme)** |

**激进 6-class 目标**: 4 类平均 ≥ 0.80, color/mold 各 ≥ 0.70.

---

## Key Insight: 数据金矿源 vs 垃圾源

| 源 | Yield | 状态 |
|---|------|------|
| `moldy_packaged_food` (bing) | **88%** | 🟢 未完全采集, 可扩大 |
| `expired_food_mold_complaint` (bing) | **73%** | 🟢 未完全采集 |
| `kaggle_mobilemold` | 20% + 域错 | ❌ 培养皿非食品 |
| `rf100peanutsmold` | 破 | ❌ 整袋标 |
| `labeled_v2/glass` (baidu) | 0% | ❌ 回收数据集污染 |
| `production_line/bing/bug_in_food` | 17% | 🟡 可用 |
| `production_line/bing/hair_found` | 4% | 🟡 少 |

**策略**: 识别高 yield 源, 扩量采集 + 中文 query 补 color.

---

## Architecture

```
ULTRA_v1 best.pt (6-class, v11m, mAP50=0.612)
     ↓
[P0] 扫 470K 池, 找 mold/color 金矿源
     ↓
[P1] Claude 8×subagents 筛 2000 候选 → 期望 500+ mold正, 200+ color正
     ↓
[P2] 建 ULTRA_v2 扩展数据集 (原 36K + 新清洁数据)
     ↓
[P3] v11l 训练 (更大模型, 从 COCO 起训 15 epoch)
     ↓
[P4] HNM for glass FP
     ↓
[P5] Copy-Paste: mold 40K 合成 + hair 5K 合成
     ↓
[P6] 最终 retrain 2-3 epoch + TTA + per-class conf
     ↓
V2.0 Delivery
```

---

## Goals

### Hard Targets
- 4 类 (insect/hair/bone/glass) 平均 AP50 **≥ 0.80** on clean val
- color_anomaly **≥ 0.70** (stretch +0.10)

### Stretch Target (not guaranteed)
- mold **≥ 0.70** (extreme +0.47 jump, best effort)

### Acceptable (if mold 冲不到)
- mold ≥ 0.50 (比现 0.23 翻倍即接受)

---

## Timeline (20h 满载)

| Phase | 时间 | 核心任务 |
|-------|------|---------|
| P0 | 1h | 扫 470K 池, 列未探索高潜源 |
| P1 | 3h | Claude 并行筛 2000 候选 (mold/color/hair/glass) |
| P2 | 0.5h | 建 6-class 扩展数据集 |
| P3 | 3h | v11l 训练 (6-class, COCO 起) |
| P4 | 2h | HNM for glass FP |
| P5 | 3h | Copy-Paste: mold 40K + hair 5K |
| P6 | 2h | Final retrain 2-3 epoch |
| P7 | 1h | TTA + per-class conf + ONNX export |
| P8 | 2h | 文档 + 备份 |
| Buffer | 2.5h | 应急 |

---

## Components

### Phase 0: 数据源探索 (1h)
- `tmp_p0_scan_sources.py`: 扫 `/opt/devmachine/datasets_1280/` 每个子目录
- 识别未探索的高潜源 (production_line 其他 bing/baidu 子查询, crawled/)
- 输出 `scan_report.json` 含每源图数 + 是否爬过的 tracker

### Phase 1: Claude 并行筛选 (3h)
- `tmp_p1_sample_download.py`: 从高潜源下 2000 张 thumbnail → 本地
- 8 个 subagent 并行, 每 250 张, 按 6 class + usable 标签输出 JSON
- Aggregator 收 `p1_results.json` — 最终清洁正样本列表

### Phase 2: 扩展数据集 (0.5h)
- `tmp_p2_extend_dataset.py`: 远程执行
- 输入: ULTRA 原 36K + p1_results 新正样本
- 对新正样本用 ULTRA_v1 best.pt 推理 bbox (自动标注)
- 输出 `/root/data/merged_v5_2_extended/`

### Phase 3: v11l 训练 (3h)
- `/root/train_v11l.sh`:
  ```bash
  yolo train model=/root/models/yolo11l.pt \
    data=/root/data/merged_v5_2_extended/data.yaml \
    epochs=15 imgsz=1280 batch=21 device=0,1,2,3,4,5,6 \
    optimizer=SGD lr0=0.001 lrf=0.01 warmup_epochs=1 \
    mosaic=1.0 mixup=0.1 scale=0.5 close_mosaic=5
  ```
  注: batch=21 (v11l 更大需减), lr0=0.001 (从 COCO 起比 warm-start 高)

### Phase 4: HNM (2h)
- `tmp_p4_hnm.py`:
  - 模型在 `hard_negatives_glass/` (302) + val 空标图上推理
  - 收 glass FP (conf > 0.3)
  - 作 empty-label 训练样本
- Retrain 2 epoch from P3 best.pt, lr=0.00003

### Phase 5: Copy-Paste (3h)

**For mold** (重点):
- 源: 所有确认清洁 mold 实例 (Phase 1 输出 500+ 样本)
- 策略: 每实例 × 20 variations (scale/rotation/blur/color shift) → 粘到清洁食品背景
- 目标产出: 40K+ 合成 mold 图

**For hair**:
- 源: v1_oil + v1_dmeoi (452 clean hair) + Phase 1 输出
- 每实例 × 10 → 5K 合成

### Phase 6: Final Retrain (2h)
- 合并 P5 合成 + P4 HNM → 最终训练集
- 2-3 epoch fine-tune from P4 best.pt, lr=0.00003

### Phase 7: Eval & Export (1h)
- Clean val 6-class + TTA
- Per-class conf 调优 (glass=0.05, mold=0.03, 其他=0.25)
- ONNX FP32 + FP16
- `per_class_metrics_v2.json`

### Phase 8: 交付 (2h)
- `/root/V2_delivery/`: model + ONNX + metrics + docs
- 本地备份 `C:\Users\Steve\my-prototype-logistics\models\e_final\V2\`
- 客户交付文档, 诚实能力清单

---

## Risk Management

| 风险 | 概率 | Mitigation |
|------|------|-----------|
| moldy_packaged_food 只几百张 | 40% | 扩 Chinese queries + crawled/bing/baidu 未探索源 |
| color_anomaly 好数据找不到 | 50% | Fallback: 只保 4 类, 交付 4-class 版本作为主 |
| v11l OOM at batch=21 | 20% | Retry batch=18, 或回退 v11m |
| GPU hang (如 E_FINAL) | 10% | Kill + restart, 最多损失 1h |
| Phase 1 Claude API error | 30% | 重跑失败 batch; subagent 结果存中间文件防 session loss |
| P5 Copy-Paste 效果负 (模型被合成伪影迷惑) | 25% | Mix ratio 保守 (真:合成 = 1:2), 不是纯合成 |
| 时间超支 > 2h | 50% | 砍 P4 HNM 或 P5 hair 分支, 保 mold 优先 |

---

## Success Criteria (Delivery Gates)

| Metric | Minimum (Acceptable) | Target | Stretch |
|--------|---------------------|--------|---------|
| 4-class avg AP50 | 0.75 | 0.80 | 0.85 |
| color_anomaly AP50 | 0.65 | 0.70 | 0.75 |
| mold AP50 | 0.50 | 0.65 | 0.70 |
| overall mAP50 | 0.65 | 0.73 | 0.80 |

**Delivery 决策**:
- 全达 Target → 交付 V2.0 (6-class)
- 4-class 达 Target, color/mold 未达 → 交付 V2.0 (4-class primary) + V2.1 (6-class beta)
- 4-class 未达 Target → 仅改善版 V1.1 (ULTRA + TTA 当前 0.647)

---

## Out of Scope (V2.0 仍不做)

- pHash 去重 470K (无用于产线)
- Per-instance loss 监控 (研究性)
- Curriculum learning (研究性)
- v11s baseline 对比 (无产线价值)

---

## Appendix: 当前环境

- Algo server: 180.97.68.228:46325, 剩 ~20h 到期
- GPU: 7 卡可用 (GPU 2 故障, 0/1/3/4/5/6/7)
- GPU memory: 每卡 ~10GB zombie occupied (新训练仍能启)
- ULTRA_v1 best.pt 本地: `C:\Users\Steve\my-prototype-logistics\models\e_final\E_ULTRA_v1\best.pt`
- ULTRA 数据: `/root/data/merged_v5_1_clean/` + `/root/data/merged_v5_1_ultra/`
- 470K 图池: `/opt/devmachine/datasets_1280/`
- 可用 pretrained: `/root/models/yolo11{n,s,m,l}.pt`
