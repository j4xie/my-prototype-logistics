# YOLO FOD V4/V5 执行计划

**更新日期**: 2026-03-18
**当前状态**: V3 训练中 (epoch 40/50), V4 数据集已构建, Phase 2 就绪

---

## 背景

- **V2** (mAP50=0.922) 是当前最佳模型
- **V3** (mAP50=0.883) 回归 4%, 根因: batch=16 导致梯度噪声
- **Glass 误报严重**: V1 标注定义过宽 → shortcut learning → 所有类 top 检出都是 glass
- **数据质量问题**: Cleanlab 全量审计发现 18.8% 脏标 (8078/42956)
  - bone: 39.2% 脏标率（最严重）
  - hair: 28.5%, color_anomaly: 28.3%
  - micro_* 合成数据: 100% 无效（模型完全无法检测）

---

## Phase 1: 优化基础设施 ✅ 完成

| 任务 | 脚本 | 状态 |
|------|------|------|
| V3 回归诊断 | `V3_REGRESSION_DIAGNOSIS.md` | ✅ batch=16 是根因 |
| Per-class 阈值搜索 | `16_optimize_thresholds.py` | ✅ 6 类最优阈值 |
| Class-aware NMS | `yolo_detector.py` | ✅ 含 SAHI merge |
| Cleanlab 全量审计 | `17_audit_labels.py` | ✅ 8078 脏标 |
| Hard negative 挖掘 | `18_hard_negative_mining.py` | ✅ 390 张 glass FP |

## Phase 2: V4 训练 🔄 就绪

### 2.1 V4 数据集 ✅ 已构建 (49,086 张)

| 操作 | 数量 |
|------|------|
| 起始 (merged_v2) | 53,696 |
| 移除 micro_* 噪声 | -4,999 |
| 移除 Cleanlab 脏标 | -1 |
| 新增 glass hard negatives | +390 |
| **V4 总计** | **49,086** |

### 2.2 V3 完成后执行顺序

```bash
# Step 1: V3 最终评估 (GPU)
python 21_eval_with_sahi.py --model v3 --device 0

# Step 2: 启动 V4 训练 (GPU, ~8-10h)
python 06_train.py --v4

# Step 3: V4 完成后评估 + V2 对比 (GPU)
python 21_eval_with_sahi.py --model v2 --model2 v4 --device 0

# Step 4: V4 阈值重搜 (CPU/GPU)
python 16_optimize_thresholds.py --model v4 --device 0

# Step 5: ONNX 导出 + 部署
python 20_export_and_deploy.py --model v4 --deploy

# Step 6: 公平对比（V4 模型跑 V2 val，决定 V5 方向）
python 16_optimize_thresholds.py --model path/to/v4/best.pt --val-dir merged_v2/images/val

# Step 7: 更新 yolo_detector.py 中 PER_CLASS_THRESHOLDS 为 V4 值
```

### 2.3 V4 训练配置

| 参数 | V4 值 | V3 值 (回归) | 说明 |
|------|-------|-------------|------|
| model | V2 best.pt | V2 best.pt | 同 |
| **batch** | **32** | 16 | **V3 回归根因修复** |
| **cache** | **disk** | False | 加速训练 |
| imgsz | 640 | 640 | 同 |
| epochs | 50 | 50 | 同 |
| lr0 | 0.0005 | 0.0005 | 同 |

### 2.4 V4 公平对比（计划外新增）

V4 的 val 集和 V2 不同（去掉了 micro_，重新 shuffle split），mAP50 不能直接比。需额外验证：

```bash
# 用 V4 模型跑 V2 的 val 集（公平对比）
python 16_optimize_thresholds.py --model v4 --val-dir merged_v2/images/val

# 用 V2 模型跑 V4 的 val 集（反向验证）
python 16_optimize_thresholds.py --model v2 --val-dir merged_v4/images/val
```

**判断逻辑**：
- V4 在 V2 val 上 ≥0.920 → 数据清洗无损，V5 继续清洗方向
- V4 在 V2 val 上 0.910-0.920 → 少了 4600 张有轻微损失，V5 需补充高质量数据
- V4 在 V2 val 上 <0.910 → 清洗过度，V5 需回退部分数据

### 2.5 和牛标注修正（2026-03-18 Claude 视觉审核）

**重大发现：6 张和牛图中 5 张是正常无异物包装，之前的标签大部分是错的。**

| 图片 | 旧标签 | 新标签 | 说明 |
|------|--------|--------|------|
| wagyu_01 | bone | **空（负样本）** | 误标，没有异物 |
| wagyu_01_with_hair | 无 | **hair** | 新增：中间有合成灰色异物 |
| wagyu_02 | glass | **保留** | 右下有微小蓝色点 |
| wagyu_03 | hair | **空（负样本）** | 误标，没有异物 |
| wagyu_04 | color_anomaly | **空（负样本）** | 误标，没有异物 |
| wagyu_05 | hair | **空（负样本）** | 误标，没有异物 |

**评估逻辑反转**：
- ❌ 旧理解：检出率越高越好（以为图里有异物）
- ✅ 新理解：**和牛图上检出越少越好**（大部分是正常包装，检出 = 误报）
- 唯一应该检出的：wagyu_01_with_hair (hair) 和 wagyu_02 (glass)

### 2.6 V4 成功标准（修正版）

| 指标 | V3 baseline | V4 目标 | 说明 |
|------|------------|---------|------|
| mAP50 (val) | 0.884 | ≥0.920 | 恢复 V2 水平 |
| 和牛标准推理误报数 | 5（全是FP） | ≤1 | 正常图不应检出 |
| 和牛 SAHI-320 glass FP | 114 | <30 | glass 误报大幅减少 |
| 和牛 SAHI-640 glass FP | 6 | ≤2 | 同上 |
| wagyu_01_with_hair 检出 | ✓ hair | ✓ hair | 唯一真正异物，不能丢 |
| wagyu_02 检出 | 未检出 | ✓ glass | 微小蓝色点，可选 |

---

## 数据质量警告（2026-03-18 Claude 视觉审核确认）

**爬虫数据（meat_anomaly_validation + sorted/defect + complaint_v2）整体不可用：**
- meat_anomaly_validation: 97% 图里看不到异物（按搜索关键词分类，不是按实际内容）
- verified_anomalies (4,573张): 抽查发现大量垃圾图（科普漫画、法律视频截图、零食广告），模型 agreement 虚高（glass 误报导致）
- **结论**: 自动筛选无法解决爬虫数据质量问题，不应加入训练集
- **可靠数据源**: V1 Roboflow/Kaggle + V2 合成数据仍是最优
- **未来方向**: 产线实拍 > 人工标注投诉照片 > 爬虫数据

## Phase 3: V5 深度清洗 (V4 完成后)

### 3.1 Per-class 深度清洗

```bash
# 预览分析
python 22_deep_clean_by_class.py --classes bone hair color_anomaly --stats-only

# 执行清洗 → merged_v5
python 22_deep_clean_by_class.py --classes bone hair color_anomaly --threshold 0.1
```

**目标清洗量**:
- bone: ~2700 张 (39% of 7102)
- hair: ~730 张 (28% of 2578)
- color_anomaly: ~2150 张 (28% of 7600)

### 3.2 重新生成合成数据

`15_synthetic_paste.py` 已更新 scale 分布 (60% tiny 0.05-0.2x, 40% large 0.2-0.5x)。
但不要重蹈 micro_ 覆辙——需验证新 scale 下模型能检测到合成目标。

```bash
# 生成少量预览
python 15_synthetic_paste.py --preview 20

# 验证合成图是否可检测
python 16_optimize_thresholds.py --val-dir synthetic_v3/images --model v4
```

### 3.3 V5 训练

基于 V4 best.pt fine-tune, merged_v5 数据集。

---

## 被否决的方案

| 方案 | 原因 |
|------|------|
| Temperature Scaling | YOLO sigmoid ≠ softmax, 等价于简单降阈值 |
| WBF 替代 NMS | 单模型无提升 (fact-check 确认) |
| Loss reweighting | YOLO 单阶段 counterproductive |
| SAHI batch GPU | 部署环境 CPU-only |
| 全删 8078 脏标 | 太激进 (18.8%), 分阶段清洗更安全 |

---

## 关键脚本索引

| 脚本 | 用途 |
|------|------|
| `06_train.py --v4` | V4 训练 |
| `16_optimize_thresholds.py` | Per-class 阈值搜索 |
| `17_audit_labels.py` | Cleanlab 标注审计 |
| `18_hard_negative_mining.py` | Glass hard negative 挖掘 |
| `19_prepare_v4_data.py` | V4 数据集构建 |
| `20_export_and_deploy.py` | ONNX 导出 + 服务器部署 |
| `21_eval_with_sahi.py` | 综合评估 (标准 + SAHI A/B) |
| `22_deep_clean_by_class.py` | Per-class 深度清洗 (V5) |
