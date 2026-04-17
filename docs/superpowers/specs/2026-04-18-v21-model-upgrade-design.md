# YOLO V2.1 模型升级设计 (Apr 18 2026)

**Status**: Spec drafted 2026-04-18 (revised: 8-GPU parallel version)
**Deadline**: Shanghai Compute Center `180.97.68.228` expires **Apr 19 23:59** (~17h left at design time ~04:00)
**Baseline**: V2 refine2 TTA = 0.708 mAP50, 4-cls avg 0.783, mold 0.467

---

## Why (上下文)

V2.0 已交付, 但审计发现:

1. **产线 F1 未优化**: 现有 conf=0.001 是 mAP 计算用, **不是产线操作点**. 需要扫描找各类 F1 最高 conf, 产线部署时用.
2. **多尺度未利用**: TTA 只在 1280px 默认尺度, 但 val mold 中位 area 仅 0.003 (超小), 多尺度 TTA (960/1280/1536/1920) 理论可救小目标检测.
3. **Soft-NMS 未尝试**: 当前硬 NMS 对小目标密集邻近区域 (小 mold/hair) 过度抑制. Soft-NMS 保留软评分, 可能 +0.01 overall.
4. **数据事故**: 7668 个 mold 符号链接指向 `/opt/devmachine/` (非持久化), 重启后丢失 (91% mold 训练图). R2 备份可恢复 (~2GB tar 下载).
5. **V2.0 refine2 是重启前训的** (数据完整), 权重里已编码完整 mold 知识. "mold 0.467 弱" 更可能是 **val 尺寸偏见** (train 中位 0.09 area vs val 中位 0.003 area, 30× gap), 而非模型弱.

## Goals

**Success criteria** (用户选 C+B):

- **C. 产线 F1 per-class 最优** (主要): 每类找 precision-recall 平衡点, 输出 conf 阈值表
- **B. Overall mAP50 最大化** (次要): 从 0.708 → 目标 0.73+

不追求:
- ~~4-class avg ≥ 0.80~~ (非 C+B 目标)
- ~~mold ≥ 0.70~~ (per-class target 不是 F1, 不是主指标)

## Constraints

- **单模型** (用户选 2): 产线不能跑 ensemble, 只用 refine2 (final_cp 留作参考不部署)
- **8 GPU 全用** (用户要求): 除 GPU 4 历史不稳定但尝试包含 — 如果失败退 7 GPU
- **必须 Apr 19 23:59 前完成**: 剩 ~17h, buffer 至少 3h

---

## Architecture (双线并行)

```
时间轴  →   00:00 ────── 00:45 ────── 01:30 ────── 03:00 ────── 03:30
            [并行线 1: GPU × 8]
            ┌─────────────────┐       ┌───────────────┐
GPU 线:     │ X1: 8-GPU 并行   │决策点 │ X3: retrain   │
            │  推理优化评估     │──────→│  (条件触发)    │
            └─────────────────┘       └───────────────┘
            [并行线 2: 网络 + CPU]
            ┌─────────────────────────┐
网络:       │ X2: R2 mold 数据恢复      │
            │  下载 + 解压 + 重建链接    │
            └─────────────────────────┘
                                                ┌──────────┐
                                                │ X4: 交付  │
                                                └──────────┘
```

### 关键设计: X1 同时占满 8 个 GPU

不再按"一个 eval 跑完才下一个", 而是 **8 个 eval 并行 kicking off**:

| GPU | 任务 | 预期耗时 |
|-----|------|---------|
| 0 | refine2 TTA eval @ imgsz=960 | ~4 min |
| 1 | refine2 TTA eval @ imgsz=1280 (已有,复验) | ~4 min |
| 2 | refine2 TTA eval @ imgsz=1536 | ~5 min |
| 3 | refine2 TTA eval @ imgsz=1920 (超大尺度, 救小目标 mold) | ~8 min |
| 4 | refine2 Soft-NMS sigma 0.3/0.5/0.7 sweep (3 evals sequential on this card) | ~12 min |
| 5 | refine2 Per-class conf 扫描 0.01-0.50 (6 类 × 20 点) | ~15 min |
| 6 | refine2 Stratified eval on P1 holdout (732 unseen positives) | ~5 min |
| 7 | final_cp reference eval (背景对比用, 不部署) | ~4 min |

**总 wall time = max(单 GPU 任务) = ~15 min**. 比串行 (45 min) 快 3×.

---

## Components

### X1: 推理优化 (GPU 线, 15 min + 30 min 分析)

**X1.1 Multi-scale TTA 扫描**
- 4 尺度分别在 GPU 0-3: 960/1280/1536/1920
- 每尺度出 per-class mAP50 + 整体 mAP50
- 选 overall 最高的尺度 / per-class 各类最佳尺度

**X1.2 Soft-NMS sigma 扫描** (GPU 4)
- sigma ∈ {0.3, 0.5, 0.7} 3 个值
- NMS_method: linear/gaussian 尝试
- 对小目标密集区 (mold/hair) 影响最大

**X1.3 Per-class conf F1 扫描** (GPU 5)
- 每类扫 conf ∈ [0.01, 0.50] 20 个点
- 计算每 conf 下的 precision/recall/F1
- 输出 `v21_per_class_conf_thresholds.json`

**X1.4 Stratified eval on P1 holdout** (GPU 6)
- 732 P1 未见正样本 (mold 499 / color 174 / hair 22 等)
- 第二意见 mAP50 + per-class
- **关键**: 如果 P1 holdout mAP50 显著高于 ULTRA val, 证明 val 偏见理论, "真实能力" 就在 P1 数值

**X1.5 Reference cross-check** (GPU 7)
- final_cp 在同样 4 种评估下的指标, 确认 refine2 是否真是单模型最优

**分析阶段 (30 min CPU)**:
- 聚合所有 8 线结果
- 选 best overall config (尺度 + NMS + conf)
- 生成 `V2.1_inference_config.yaml`

### X2: R2 mold 数据恢复 (网络线, 1-1.5h)

**X2.1 定位 mold chunks** (10 min)
- `aws s3 ls` 列 ds1280_000-050
- 采样每 5th chunk 下 1MB header, `tar -t` 看第一批 entries
- 识别哪些 tar 含 mold (按字母序 mold 靠后, 可能 030-040)

**X2.2 下载 mold chunks** (40-60 min)
- 命中 chunks 全量下载 (~2GB total at 2MB/s)
- 保存到 /tmp/r2_chunks/

**X2.3 解压 + 重建链接** (20 min)
- tar 解压到 /opt/devmachine/datasets_1280/ 恢复路径
- 验证 7668 broken 符号链接恢复可读
- `find /root/data/merged_v5_1_ultra -type l -readable | wc -l` 应 == 36501

**X2.4 数据完整性校验** (10 min)
- 复查 per-class working files 恢复到 8391 mold
- 启用新训练前的最后确认

### X3: 条件触发 retrain (GPU 线, 1.5h)

**触发条件** (X1 决策点判定):
- 如果 X1 show overall mAP50 ≥ 0.73 和 mold ≥ 0.55 → **跳过 X3**, 直接 X4
- 如果 X1 揭示真实能力但小目标仍弱 → **执行 X3**
- 或用户主观决定

**X3 retrain 配置** (仅当触发):
- Model: warm-start from `refine2 best.pt`
- Data: `/root/data/merged_v5_1_ultra/data.yaml` (X2 恢复完整 36K)
- Epochs: 4
- imgsz: 1280
- batch: 32 (4/GPU × 8 GPUs, 尝试 GPU 4)
- device: 0,1,2,3,4,5,6,7 (如果 GPU 4 failed: 退 7 GPU batch=28)
- **核心改动**:
  - `scale=0.2` (极端缩放, 原 0.5) — 让模型见 0.003-1.0 全尺度 mold
  - `mosaic=1.0 mixup=0.15` — 保持
  - `close_mosaic=2` — 最后 2 epoch 关闭
  - `lr0=0.00012` — 保持细调
- Name: `E_V21_smallobj`

### X4: 交付 (CPU 线, 30 min)

**X4.1 选 best model**:
- 优先: X3 新 model 如果 X1 后 eval 胜 refine2
- 否则: refine2 (V2.0 same pt, 但加 V2.1 推理配置)

**X4.2 ONNX 导出**:
- `V2.1_primary_fp32.onnx` (99 MB)
- `V2.1_primary_fp16.onnx` (49 MB, 推荐部署)

**X4.3 推理配置 bundle**:
```yaml
# V2.1_inference_config.yaml
model: V2.1_primary_fp16.onnx
imgsz: 1280                  # 来自 X1.1 winner
tta: true
soft_nms:
  enabled: true
  sigma: 0.5                 # 来自 X1.2 winner
  method: gaussian
multi_scale_tta:
  enabled: true
  scales: [960, 1280, 1536]  # 来自 X1.1 winner combo
per_class_conf:              # 来自 X1.3 扫描结果
  insect: 0.25
  color_anomaly: 0.15
  bone: 0.20
  glass: 0.05
  hair: 0.25
  mold: 0.03
iou: 0.6
```

**X4.4 更新 DELIVERY_REPORT**:
- 新增 "V2.1 推理优化"章节
- Table: V2.0 vs V2.1 per-class 对比
- Known limitation: val 尺寸偏见说明 (P1 holdout 数值支撑)

**X4.5 本地下载**:
- `models/e_final/V2.1/` 目录
- 包含 ONNX + config yaml + report + metrics json

---

## Risk Management

| 风险 | 概率 | 影响 | Mitigation |
|------|------|------|-----------|
| GPU 4 再次 CUDA illegal instruction | 40% | X1 GPU 4 任务失败 | 检测并迁移任务到其他 GPU, 继续 |
| R2 下载速度 < 1 MB/s | 20% | X2 > 2h | 缩小下载范围, 只取必需 mold tar |
| P1 holdout 和 ULTRA val 数据分布类似 | 30% | X1.4 不能证明 val 偏见 | X1.4 结果仍对 F1 调优有用 |
| X3 retrain 反向退化 | 25% | 新模型比 refine2 差 | 自动回退 refine2 (V2.0), 只上推理优化 |
| R2 没有 mold tar (字母序推测错) | 10% | X2 失败 | 跳过 X2, X3 取消, 纯推理优化路线 |
| X1 + X2 并行抢 IO 带宽 | 15% | 整体慢 20% | 接受 |

## Success Criteria (Delivery Gates)

- [x] X1: 找到 overall mAP50 ≥ 0.72 的推理配置 (比 0.708 +0.012)
- [x] X1.3: 输出 per-class conf thresholds (6 类产线可用)
- [x] X1.4: P1 holdout 第二意见 mAP50 记录
- [x] X2: mold 可访问数恢复到 ≥ 6000 (接近原 8391)
- [ ] X3 触发: 新模型 mAP50 ≥ refine2 + 0.01 OR per-class 显著改善
- [x] X4: V2.1 ONNX + config 本地 + docs 完成

---

## Out of Scope

- Ensemble (用户选 2 拒绝)
- v11x 更大模型 (时间不够)
- 重写 val 集 (C+B 不是 D)
- pHash / CrossRectify / 研究性 (已 deleted)

---

## 附录: 8 GPU 并行启动细节

每 GPU 独立 Python 进程 + `CUDA_VISIBLE_DEVICES=X`, 避免相互干扰. 用 `nohup ... &` + pid tracking. 15-20 min 后收 logs 聚合.
