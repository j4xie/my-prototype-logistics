# YOLO 食品异物检测 4-Class 优化设计 (Apr 17 2026)

**Status**: Spec approved 2026-04-17
**Deadline**: 算力中心 2026-04-19 到期 (剩 ~20h)
**Previous work**: E_ULTRA_v1 (6-class on 36K clean data) achieved mAP50 = 0.612 / TTA 0.647 on clean val

---

## Why (上下文)

V1 模型声称 mAP50=0.855, 但在清洁 val 上重测只有 0.557 — 之前所有数字被标注噪声污染。经过 ULTRA_v1 (丢 62K auto_VL 垃圾数据) 提升到 0.612/0.647. Per-class 真实能力:

| Class | AP50 (TTA) | 可用性 |
|-------|-----------|-------|
| insect | 0.856 | ✅ 产线 |
| hair | 0.788 | ✅ 产线 |
| glass | 0.715 | ✅ 可用 |
| bone | 0.697 | ✅ 可用 |
| color_anomaly | 0.601 | ❌ 概念错 |
| mold | 0.228 | ❌ 域失配 |

color/mold 问题是**数据根源**不是模型, 20h 内无法修复。决策: **砍掉 color/mold, 专做 4 类 MVP V2.0**。

---

## Goals / Success Criteria

主线: 4 类平均 AP50 从 0.764 → **≥ 0.80** on clean val (4-class subset)

Per-class 目标:
- insect: 0.856 → **≥ 0.87** (轻微提升)
- hair: 0.788 → **≥ 0.83** (主攻 Copy-Paste)
- glass: 0.715 → **≥ 0.78** (主攻 HNM)
- bone: 0.697 → **≥ 0.75**

副线 (不阻塞主线): 爬取中文 query 真实 hair/glass 数据, 如果 ≥ 50 清洁样本, 注入 Copy-Paste 池。

---

## Architecture

```
ULTRA_v1 best.pt (6-class, v11m)
      ↓ 类 ID 重映射 + drop color/mold 标签
ULTRA_4cls dataset
      ├─ train: ~36K imgs, 28K bbox (insect/bone/glass/hair)
      └─ val:   ~3200 imgs, 2800 instances in 4 classes
      ↓ warm-start retrain (Ultralytics 自动适配 6→4 输出 head)
Model_4cls_v1 (15 epochs, SGD lr=0.0001)
      ↓ HNM: 扫 hard_negatives_glass + val backgrounds 收 glass FP
Model_4cls_v2 (2-3 epoch HNM fine-tune)
      ↓ Copy-Paste hair 合成 (主类 hair 1903 + 合成 ~5K)
Model_4cls_v3 (3 epoch CP fine-tune)
      ↓ TTA + per-class conf 调优
V2.0 Delivery: best.pt + ONNX(FP32+FP16) + docs
```

---

## Components

### 1. Dataset Builder (`tmp_build_4cls_dataset.py`)

- 读 ULTRA labels, 删 class_id=1 (color) 和 5 (mold)
- 剩余 class_id 重映射: 0→0, 2→1, 3→2, 4→3
- 输出 `/root/data/merged_v5_1_4cls/` 镜像结构
- 生成 `data.yaml` with `nc: 4`
- 统计并打印 per-class instance counts

**接口**:
```bash
python3 /root/build_4cls_dataset.py
# stdout: per-class counts before/after
# exit 0 if valid (train & val non-empty, 4 classes present)
```

### 2. Phase 2 Training Script (`train_4cls.sh`)

```bash
CUDA_VISIBLE_DEVICES=0,1,3,4,5,6,7 yolo train \
    model=/root/runs/E_ULTRA_v1/weights/best.pt \
    data=/root/data/merged_v5_1_4cls/data.yaml \
    epochs=15 imgsz=1280 batch=28 device=0,1,2,3,4,5,6 \
    project=/root/runs name=E_4CLS_v1 \
    optimizer=SGD lr0=0.0001 lrf=0.1 momentum=0.937 \
    warmup_epochs=0 mosaic=1.0 mixup=0 copy_paste=0 \
    scale=0.3 close_mosaic=5 patience=10 \
    exist_ok=true verbose=true
```

**关键**: Ultralytics 会因 data.yaml nc=4 vs model 6 自动 resize detect head (backbone 继承, head 重新训)。

### 3. HNM Pipeline (`hnm_collect.py` + `train_hnm.sh`)

- 用 Model_4cls_v1 在 `/opt/devmachine/datasets_1280/hard_negatives_glass/` (302 张无异物背景) + val 空标图 推理
- 记录所有 conf > 0.3 的 glass 预测 → 这些是 FP
- 对应图片加入训练集, 空标签文件 (no bbox = negative sample)
- 2-epoch fine-tune from Model_4cls_v1 best.pt, 更低 lr=0.00003

### 4. Copy-Paste for Hair (`copy_paste_hair.py` + retrain)

输入源:
- 干净 hair 实例: `v1_dmeoi` (163 instances) + `v1_oil` (289 instances) = 452 clean hair bbox
- 背景池: ULTRA 原始 negative samples (来自被过滤的 auto_VL images, 食物无异物)

Pipeline:
1. 从干净 hair 源 crop 出 452 bbox → 透明背景 PNG (用原 bbox coord 作 mask)
2. 选 2000 张 food 背景图
3. 每张背景随机贴 1-3 根 hair (随机 scale/rotation/translation)
4. 生成对应 YOLO label (hair class=3)
5. 输出 `/root/data/cp_hair/` (~2000 合成图 + labels)
6. 合并到 ULTRA_4cls train, retrain 3 epoch from Model_4cls_v2

### 5. Final Export & Eval (`final_eval.py`)

- Model_4cls_v3 on clean val 4-class
  - Default conf
  - TTA (augment=True)
  - TTA + per-class conf (glass=0.05, others=0.25)
- Export ONNX FP32 + FP16
- Generate per_class_metrics.json
- Copy all artifacts to /root/V2_delivery/

### 6. Parallel Data Collection (`crawl_chinese.py`)

**副线**, 异步 subagent 工作, 不碰 GPU:

1. 列 `/opt/devmachine/datasets_1280/crawled/baidu/*/` 子目录
2. 挑未探索的 hair/glass 相关目录 (之前只审过 labeled_v2 + production_line/bing)
3. 采样 500-1000 张 → 本地 → Claude subagents 分类
4. Yield 目标: ≥ 50 真实 hair-in-food 或 glass-in-food 图 → 注入 Copy-Paste 源

---

## Data Flow

```
[/opt/devmachine/datasets_1280/]
  └─ merged_v5_1_clean/ (36K ULTRA)
       └─ [P1] filter → merged_v5_1_4cls/ (36K, 4 classes)

[Model 迭代]
  ULTRA_v1/best.pt (6-class)
       └─ [P2 train] → E_4CLS_v1/weights/best.pt
              └─ [P3 HNM collect] + [P4 retrain] → E_4CLS_v2/weights/best.pt
                     └─ [P5 CP] + retrain → E_4CLS_v3/weights/best.pt

[Eval & Export]
  E_4CLS_v3/best.pt
       ├─ [P6 val] clean val 4-class → metrics.json
       ├─ [P6 TTA val] → metrics_tta.json
       └─ [P6 ONNX export] → best_fp32.onnx, best_fp16.onnx

[Delivery Package]
  /root/V2_delivery/
       ├─ best.pt, best_fp32.onnx, best_fp16.onnx
       ├─ class_map.txt
       ├─ per_class_metrics.json
       ├─ inference_guide.md
       ├─ customer_delivery.md
       └─ post_apr19_data_plan.md

[Local Backup]
  C:\Users\Steve\...\models\e_final\E_4CLS_v3\ (local copy of V2_delivery)
```

---

## Error Handling / Risks

| 风险 | Mitigation |
|------|-----------|
| GPU hang (如 E_FINAL 事件) | Phase 间检查 procs, kill 残留 + restart |
| Ultralytics head resize 失败 | Fallback: 从 yolo11m.pt COCO 重训, 不 warm-start |
| HNM 找不到 FP (模型已很 conservative) | Fallback: 直接用 labeled_v2/glass PACKAGING_ONLY 作 hard neg |
| Copy-Paste 效果负 (hair AP 反降) | 只用 CP 生成的 1/3, 保守混入训练集 |
| 副线爬图全是垃圾 | 忽略, 不注入 CP, 不影响主线 |
| 时间超支 | Phase 5 可跳过 (CP 效果不确定), 直接交付 P4 结果 |

---

## Testing

### 单元测试
- Phase 1: 验证 4-class 数据集 class ID 正确, val/train 非空
- Phase 2: 验证 train 起步 loss 合理 (<2.5), epoch 1 mAP50 ≥ 0.70 (warm-start 应 immediate 达 V1 水平)

### 回归 / 对比测试
- 主指标: 4 类平均 AP50 on clean val
- Per-class: insect/hair/bone/glass 都不能比 ULTRA_v1 baseline 低 > 0.02

### 验收测试
- Final TTA eval: avg AP50 ≥ 0.78 (相对 ULTRA_v1 baseline 0.764 +0.02) = 最低可接受
- Target: avg AP50 ≥ 0.80

---

## Deliverables

**Technical**:
- Model files: best.pt (40MB), best_fp32.onnx (77MB), best_fp16.onnx (39MB)
- Metrics: per_class_metrics.json (P/R/AP50/AP50-95 for each class, with/without TTA)
- Code: build_4cls_dataset.py, hnm_collect.py, copy_paste_hair.py

**Documentation**:
- `inference_guide.md`: API 使用, TTA 推荐, per-class conf 推荐
- `customer_delivery.md`: V2.0 能力诚实清单 + 已知限制
- `post_apr19_data_plan.md`: mold/color 需要什么数据才能做好, 时间/成本估算

**Backup**:
- Complete copy to `C:\Users\Steve\my-prototype-logistics\models\e_final\E_4CLS_v3\`
- Critical source data also backed up from algo server before expiry

---

## Timeline (18h 主线, 6h 副线)

| 时间 (h) | 主线 | 副线 |
|----------|------|------|
| 0-0.5 | P1 Build 4-class dataset | 开始探索 crawled/ 目录 |
| 0.5-2.5 | P2 Train 4-class base | Subagents 筛 300 图 |
| 2.5-3.5 | P3 HNM collect | — |
| 3.5-4.5 | P4 HNM retrain | Phase S3: 核对 bbox 提案 |
| 4.5-6.5 | P5 Copy-Paste for hair | 注入 CP 池 (if yield 够) |
| 6.5-7.5 | P6 Final eval + TTA + ONNX | — |
| 7.5-11.5 | P7 Docs + Backup | — |
| 11.5-18 | Buffer / 应急处理 | — |

---

## Out of Scope (V2.0 不做)

- color_anomaly 改进 (需全新数据, 2-3 周工作)
- mold 改进 (需真实食品霉变数据, 非 petri dish, 2-3 周)
- v11l 大模型 (+2-3 点不值得 3h 训练风险)
- Per-instance loss 脏标注检测 (研究性)
- pHash 去重 (对产线无意义)
- Curriculum learning (研究性)

---

## Appendix: 当前环境状态

- Algo server: 180.97.68.228:46325, 剩 ~20h
- GPU: 7 卡可用 (GPU 2 故障永久 disabled)
- GPU memory: 每卡 ~10GB 被 zombie 占 (新训练仍可起)
- ULTRA best.pt 已下载: `C:\Users\Steve\my-prototype-logistics\models\e_final\E_ULTRA_v1\best.pt`
- V1 best.pt 已下载: `C:\Users\Steve\my-prototype-logistics\models\e_final\best.pt`
- Ultra clean dataset: `/root/data/merged_v5_1_clean/` (保留, 会派生 4cls)
- Critical backup 本地已 ~1.5GB (labels, jsons, diagnostic data)
