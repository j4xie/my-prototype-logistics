# YOLO V2.3 Final Push 设计 (Apr 18 2026)

**Status**: Approved 2026-04-18 (post-audit w/ user refinements)
**Deadline**: Shanghai Compute expires Apr 19 23:59 (~6h remaining)
**Baseline**: V2.2 (ULTRA 0.689 / P1 holdout 0.155)

---

## Why

- V2.1 和 V2.2 已是"无客户数据能到的实质天花板"
- 真实产线数据 (透明盒装和牛 + 10px 异物) 在任何公开数据池**零精确匹配**
- 今天做 V2.3 边际收益 +5-10%, 不是翻倍
- 价值在于: **更接近用户场景 + Acid Test 可视化证据 + tri-version defensive delivery**

## Goals

**Success criteria**:
1. Overall mAP50 ≥ V2.2 (no regression)
2. P1 holdout ≥ 0.18 (+0.025 over V2.2)
3. Acid Test hit rate **visibly improves** over V2.2 (n=3, 信号定性)
4. Tri-version artifacts: V2.1 / V2.2 / V2.3 全打包
5. V2.4 fine-tune guide (客户收到立马能跑)

**Non-goals**:
- 不承诺真产线 > 60% 命中
- 不改 6 类 schema (兼容 V2.0/V2.1/V2.2)
- 不等客户真实数据 (今天搞不到)

---

## Architecture (6-Phase Pipeline)

```
Phase 0 (20min): Acid Test 冻结 + 基线 snapshot
Phase 1 (1.5h cap): 数据下载 并行 6 线
Phase 2 (45min): Schema normalize + QC filter
Phase 3 (1.5h): Z3b + Z3c 合成数据
Phase 4 (2.5h): V2.3 训练 (含 warmup)
Phase 5 (40min): 三路 Eval + Acid Test 可视化
Phase 6 (45min): Tri-version 交付包
```

---

## Components

### Phase 0: Acid Test 冻结 (20min)

- **随机选 3 张** (from 17 真实产线图) 作永不训练 acid test
- 剩余 14 张保留训练/val 池
- **披露**: "visual-inspection holdout (not cross-validation strict)"
- V2.2 在 3 张上的 baseline 推理结果保存

### Phase 1: 数据采集 (1.5h 硬 cap)

6 线并行, 超时即砍:

| 线 | 数据 | 目标 | 时间 |
|---|------|------|------|
| D1 | PearSurfaceDefects 13.9K + 66K bbox | 直训 (remap) | 30min |
| D2 | Bread Contamination 280 | 直训 | 5min |
| D3 | Peanuts Mold ~500 | 直训 | 5min |
| D4 | Tomato Bad/Good 500 | 直训 | 10min |
| D5 | scidb 火锅肉 10K 子集 | Z3c bg 主力 | 15min 硬 cap (需 curl -I 探测) |
| D6 | TenebrioVision worms | insect patch 单源 | 20min |

**跳过**: IP102 (Tenebrio 单源避免视觉方差污染), FruitVision (SAM 转换 ROI 低), Zenodo HSI (格式).

### Phase 2: Normalize + QC (45min)

**Schema remap 规则** (确定性, 无视觉判断):
- Pear spot/crack/rot → `color_anomaly` (cls 1)
- **Bread Contamination 全 → `mold` (cls 5)** (规则化, 不视觉分)
- Peanuts Mold → `mold` (cls 5)
- Tomato "bad" → `color_anomaly` (cls 1)
- Tenebrio worm → `insect` (cls 0)

**QC**:
- V2.2 pseudo-verify: 推理每张新图, 若 V2.2 认为标注 ≤ 30% 一致 → drop
- Bbox area 过滤: 保留 area < 5% (对齐小目标)
- 生成 `/root/data/merged_v6/data.yaml`

### Phase 3: 合成 (1.5h)

**Z3b Real-Meat-Kaggle** (30min):
- bg: Kaggle 12K (Fresh + Spoiled)
- patch: ULTRA 小目标 bone/color/hair + Tenebrio worms
- 12K × 1 variant = 12K

**Z3c Hot-Pot-Meat** (1h):
- bg: scidb 10K 火锅肉 (视觉 1:1, 如 D5 失败则回退 Kaggle 扩至 × 3)
- patch: **只用 Tenebrio** (单源, 视觉一致)
- 10K × 2 variant = 20K

**合成总**: 32K (含 Poisson seamlessClone)

### Phase 4: V2.3 训练 (2.5h 含 warmup)

**数据**:
```
ULTRA workable ........ 23K
P1 732 ................ 732
Z1 pseudo mold ........ 4010
Z3 原 synth (17 bg) .. 3400
Pear + Bread + Peanut + Tomato ≈ 15K
Canned Food Defect .... 5471
Z3b Kaggle synth ..... 12K
Z3c Hot-Pot-Meat ..... 20K (或 Kaggle × 3 回退)
----------
Total: ~83K
```

**配置**:
- `model=V2.2 best.pt` warm-start
- `epochs=4`, `imgsz=1280`, `batch=32`, 8 GPU (若 GPU 4 挂 → 7 GPU batch=28)
- `lr0=0.00012, lrf=0.01`
- `mosaic=1.0, mixup=0.15, scale=0.3, erasing=0.25`
- **close_mosaic=1** (最后 1 epoch 关, 不是 2)
- `optimizer=SGD, momentum=0.937`
- Save each epoch for rollback

**Warmup 策略**:
- Epoch 1 结束 → check 时间 + ULTRA val mAP50
- 若 epoch 1 已低于 V2.2 (< 0.65): stop, 交付 V2.2
- 若 ≥ 0.65: 继续 epoch 2-4

### Phase 5: Eval (40min)

4 路:
1. **ULTRA val 3216** (同分布基线)
2. **P1 holdout 732** (域外真实图)
3. **Bread Contam val** (第三意见)
4. **Acid Test 3 张** ⭐ (客户场景, 可视化 bbox)

对比 V2.1 / V2.2 / V2.3 (per-epoch V2.3 四条曲线).

### Phase 6: Tri-Version 交付 (45min)

**`models/e_final/V2.3/` 结构**:
```
V2.1_baseline/   ← 完整复制 V2.1 所有文件
V2.2_stable/     ← 完整复制 V2.2 所有文件
V2.3_experimental/
  ├─ V2.3_primary_fp16.onnx
  ├─ V2.3_primary_fp32.onnx
  ├─ V2.3_primary_best.pt
  ├─ V2.3_inference_config.yaml
  ├─ V2.3_per_class_conf_thresholds.json
  ├─ V2.3_x1_metrics.json
  ├─ V2.3_acid_test_results/   (3 张 bbox 可视化)
  └─ V2.3_DELIVERY_REPORT.md
V2.4_FINETUNE_GUIDE.md  ← 客户 300 张数据后的路径
README.md        ← "V2.3 recommended for new deployments; V2.2 remains production-grade fallback."
```

---

## Risk Management

| 风险 | 概率 | Mitigation |
|------|------|-----------|
| D5 scidb 需登录 | 80% | 15min cap, 回退 Kaggle × 3 |
| GPU 4 再挂 (历史) | 40% | 检测 + 7 GPU batch=28 |
| V2.3 epoch 1 < V2.2 | 25% | 立即停, 交付 V2.2 |
| Z3c Tenebrio patches 质量差 | 15% | V2.2 pre-eval 过滤低质 |
| Phase 1 超 1.5h | 30% | 砍 D5, 保其他 5 |
| 训练 OOM at batch=32 | 10% | 退 batch=24 |

## Success Gates

- [x] Phase 0 Acid Test 冻结 ✓ 基线记录
- [x] Phase 1 ≥ 4 个数据集下好
- [x] Phase 2 merged_v6 干净
- [x] Phase 3 合成 ≥ 15K
- [ ] Phase 4 epoch 1 不退化
- [ ] Phase 5 V2.3 ≥ V2.2 (任一 metric)
- [ ] Phase 6 tri-version artifacts 完整

---

## Out of Scope (明确不做)

- FruitVision 81K SAM 转 bbox
- IP102 (Tenebrio 单源代替)
- PKU-GoodsAD (零售异常 pattern 正交)
- IoT Meat (分类标签对齐不上)
- MVTec AD / Real-IAD / VisA (非食品 transfer)
- 爬小红书/淘宝投诉 (合规风险)
- Schema 扩展到 plastic/paper/metal (V3.0 再做)
- 邮件联系作者数据集 (赶不上 deadline)

---

## Appendix: User Audit Mods Accepted

- 5 → **3** Acid Test (保训练数据)
- scidb **15min 硬 cap** (不陷注册)
- Bread Contamination 规则化 → **全 mold** (避免主观分类)
- **Tri-version** 交付 (V2.1/V2.2/V2.3)
- **close_mosaic=1** (不是 2, aug 信号保留)
- Train budget **2h → 2.5h** (warmup 估计 realistic)
- **Tenebrio 单源** (不混 IP102, 视觉方差污染 insect 类)
