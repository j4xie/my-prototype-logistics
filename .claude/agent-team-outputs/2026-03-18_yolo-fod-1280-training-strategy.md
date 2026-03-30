# YOLO FOD imgsz=1280 高分辨率训练方案深度研究

**日期**: 2026-03-19
**研究主题**: YOLO 食品异物检测从 640 升级到 1280 的完整方案设计
**论文覆盖**: 55+ 篇论文/技术文档

---

## Executive Summary

**不要直接训练/部署 1280 模型。** 优先运行已有的 DIAG_A 诊断实验(10 epoch)确认 1280 对当前数据是否有效——项目已两次尝试 1280 均回归(V2.5 -7.4%)且根因未诊断。SAHI 推理优化(调参+glass FP 修复)是低成本高确定性方案。蒸馏方案(1280教师→640学生)理论最优但 Ultralytics 无原生支持，短期不可行。

**Confidence**: Low-Medium — 1280方案建立在未验证假设上

---

## 核心共识

1. **1280 直接部署不可行** (CPU ONNX ~180ms, 是640的4×) — 全员共识 ★★★★★
2. **DIAG_A 诊断实验是最高优先级** (配置已存在config.py但从未运行) — ★★★★★
3. **SAHI 需要 glass FP 专项修复** (SAHI-320 产生117个glass FP) — ★★★★★
4. **蒸馏短期不可行** (Ultralytics无原生KD, 需自定义代码) — ★★★★☆
5. **数据质量 > 架构改动** — ★★★★☆

## 核心分歧

- **1280训练是否有效**: VisDrone +9 mAP vs 项目V2.5回归7.4% — **需DIAG_A验证**
- **YOLOv11在1280的收益**: GitHub#17007称无额外收益(C2PSA已补偿) — **未定论**

---

## 方案对比矩阵

| 方案 | 收益预期 | 置信度 | CPU推理延迟 | 实现复杂度 | 推荐 |
|------|---------|--------|-----------|----------|------|
| **A: SAHI参数优化** | +3-5% | Low-Med | ~1.6s(SAHI) | 极低 | ✅ 本周做 |
| **DIAG_A: 10ep诊断** | 确认1280可行性 | ★★★★★ | N/A | 极低 | ✅ **立即做** |
| B: 1280直接训练 | +3-9% | Low | 180ms | 低 | ⚠️ 等DIAG_A |
| C: 1280→640蒸馏 | +3-8% | Very Low | 45ms | 极高 | ❌ 短期不做 |
| D: 640粗检+1280精检 | +5-8% | Med | 45-135ms | 高 | ⚠️ 等DIAG_A |
| P2检测头(stride=4) | +1.6-1.8% | Med | +10-15% | 中 | ⚠️ V6考虑 |
| SPD-Conv | +7-11% | Low | 未知 | 中 | ⚠️ 需验证 |

---

## 推荐执行路径

### 立即执行（1-2天）

1. **运行 DIAG_A 诊断实验** — `python 06_train.py --diag-a`
   - 配置已在 config.py 第367-392行
   - 10 epoch, batch=8, imgsz=1280, V2 base
   - 耗时约 2-4 小时
   - **决策点**: mAP > V4(0.893) → 继续1280路线; mAP < V4 → 放弃1280

2. **SAHI glass FP 修复**
   - SAHI-640 比 SAHI-320 好很多(glass 9 vs 117)
   - 在 SAHI 模式下 glass 阈值提高到 0.55
   - `_filter_implausible()` 增加 tile 检测的全图面积约束

### 本周（基于DIAG_A结果）

3. **若 DIAG_A 成功(mAP > 0.893)**:
   - 继续训练 30-50 epoch
   - batch=8 + gradient_accumulation=4 (等效batch=32)
   - lr0=0.0003, freeze=10, mosaic=0.2, warmup=5
   - 导出 640 ONNX 用于部署

4. **若 DIAG_A 失败(mAP ≤ 0.893)**:
   - 放弃 1280 路线
   - 专注 640 数据质量改善(bone深度清洗, 合成数据增强)
   - SAHI-640 推理优化

### 中长期（V6+）

5. 蒸馏方案（等 Ultralytics 原生支持或社区成熟方案）
6. P2 检测头（与 1280 组合时边际收益更大）
7. OpenVINO 替代 ONNX Runtime（CPU 推理加速 2-3×）

---

## 关键风险

| 风险 | 概率 | 缓解 |
|------|------|------|
| 1280复现V2.5回归 | 60% | DIAG_A先验证10ep |
| batch=8 BN不稳定 | 50% | GA=4等效batch=32 |
| INT8比FP32慢(ORT已知bug) | 50% | 暂不量化,用FP32 |
| SAHI延迟>2s | 80% | 用SAHI-640非320 |
| 蒸馏实现>3周 | 70% | 短期不做 |

---

## 研究来源（55+ papers/docs）

### 高分辨率训练
- VisDrone YOLO11/v12 1280 讨论 (Ultralytics Community)
- GitHub #17007: YOLOv11 1280无额外收益
- GitHub #18849: 1280训练OOM问题
- Ultralytics 官方配置文档

### 小目标架构
- CPDD-YOLOv8 P2检测头 (PMC 2025)
- YOLO11-4K 四尺度检测 (arXiv 2512.16493)
- SMA-YOLO SimAM注意力 (MDPI 2025)
- SPD-YOLOv8 (J.Supercomputing 2024)
- BiFPN-YOLO (Pattern Recognition 2024)
- DCNv4 (CVPR 2024)
- FSO-YOLO 药液异物检测 (J.RTIP 2025)
- YOLOv12 Area Attention (NeurIPS 2025)

### 迁移策略+数据
- Layer-Freezing Analysis (arXiv:2509.05490)
- Fine-Tuning Without Forgetting (arXiv:2505.01016)
- Copy-Paste Augmentation (CVPR 2021)
- Select-Mosaic (arXiv:2406.05412)
- SAHI Fine-Tuning (arXiv:2202.06934)
- Small Object Detection Survey (arXiv:2503.20516)

### 蒸馏+推理
- YolovN-CBi 蒸馏 (arXiv:2512.18046)
- SBP-YOLO BCKD (arXiv:2508.01339)
- SDM-D 基础模型蒸馏 (arXiv:2411.16196)
- Deformable DETR (ICLR 2021)
- RT-DETR (arXiv:2304.08069)
- Lite DETR (CVPR 2023)
- ONNX Runtime INT8 issues (#20052, #14439)
- OpenVINO YOLO benchmarks (Lenovo Press)

---

### Process Note
- Mode: Full
- Researchers deployed: 3 (55+ sources total)
- Key disagreements: 3 resolved (蒸馏不可行, SAHI需调参, 1280不可直接部署), 2 unresolved (1280是否有效, Copy-Paste@1280收益)
- Phases completed: Research → Analysis → Critique → Integration
- Fact-check: Pending (to be run separately)
- Healer: 1 fix applied (和牛标注矛盾 reconciled with user's red-circle annotated images)
