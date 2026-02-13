# 嵌入模型Benchmark对比报告

**日期**: 2026-02-11
**模式**: Full (5 agents)
**研究主题**: 对比 Qwen3-Embedding-0.6B、BGE-M3、gte-multilingual-base 与当前 GTE-base-zh

---

## Executive Summary

在8C/16GB CPU服务器、DJL+ONNX技术栈、PostgreSQL向量存储的约束下，经过多角色深度研究（3研究员+分析师+批评者），**原始推荐(gte-multilingual-base)被批评者推翻**。最终结论：

1. **BGE-M3 (INT8 ONNX)** — 最佳工程可行性选择 (置信度 75%)
2. **Qwen3-Embedding-0.6B (INT8)** — 性能最强但适配复杂 (置信度 75%)
3. **保持GTE-base-zh** — 零风险，需先确认是否真有瓶颈 (置信度 80%)
4. ~~gte-multilingual-base~~ — ONNX生态支持最差，不推荐 (置信度 25%)

---

## 关键发现

### 维度一致性谬误 (团队共识)
- 不同模型的768维向量空间**不兼容**
- 无论选哪个新模型，都必须**重新生成全量embedding**
- 因此768→1024维度变更的增量成本很低

### gte-multilingual-base被推翻
- 使用非标准"NewModel"架构，HF Optimum无法ONNX导出
- transformers.js报"Unknown model class"错误
- 四个候选方案中**DJL/ONNX生态支持最差**
- 无公开C-MTEB中文专项得分

### BGE-M3被重新评估
- yuniko-software/bge-m3-onnx 提供**完整Java原生ONNX实现**
- MMTEB 59.56，encoder架构(XLM-RoBERTa)与当前系统兼容
- INT8量化: 2272→571MB (75%压缩)，精度损失<1%
- CPU延迟<30ms，支持Matryoshka维度截断(1024→768)

---

## 对比矩阵

| 维度 | GTE-base-zh (当前) | BGE-M3 | Qwen3-0.6B | gte-multilingual |
|------|-------------------|--------|------------|-----------------|
| MMTEB得分 | 基准 | 59.56 | **64.33 No.1** | 无公开数据 |
| 架构 | Encoder (BERT) | Encoder (XLM-RoBERTa) | **Decoder-only** | Encoder (NewModel) |
| 向量维度 | 768 | 1024 | 1024 | 768 |
| FP32大小 | 440MB | 2.2GB | 2.4GB | 1.2GB |
| INT8大小 | ~110MB | ~571MB | ~600MB | ~300MB |
| CPU延迟 | ~10-15ms | <30ms | ~40-60ms | ~20-30ms |
| ONNX成熟度 | ★★★★★已生产 | ★★★★★Java实现 | ★★★第三方 | ★★导出失败 |
| DJL兼容性 | ★★★★★ | ★★★★ | ★★需重写 | ★★★未验证 |
| 迁移成本 | 零 | 中(维度+Translator) | 高(架构重写) | 高(ONNX导出问题) |
| 最终置信度 | **80%** | **75%** | **75%** | **25%** |

---

## 推荐行动

### 立即执行 (P0)
1. 确认当前GTE-base-zh是否已成为质量瓶颈
2. 统计三张向量表数据量
3. 确认服务器CPU指令集 (`lscpu | grep avx`)

### 条件执行

**若确认需要升级:**
- 数据量小(<100K): BGE-M3 + INT8 (1-2天改动 + 1天重建)
- 数据量中等: Qwen3 + INT8 (2-3天Translator重写 + 2-3天重建)
- 数据量大(>1M): 保持现状或渐进迁移

**若无明确瓶颈:**
- 保持GTE-base-zh，不做迁移

---

## 开放问题
1. 当前embedding质量是否满足业务需求？
2. 三张向量表数据量？
3. 服务器CPU是否支持AVX2/VNNI？
4. BGE-M3 Matryoshka截断到768维的精度损失？
5. 是否可以shadow测试(新旧模型并行)？

---

## Process Note
- Mode: Full
- Researchers deployed: 3 (Benchmark / Performance / Migration)
- Total sources found: 50+
- Key disagreements: 2 resolved (gte-multilingual推翻, BGE-M3提升), 1 unresolved (是否需要升级)
- Phases completed: Research → Analysis → Critique → Integration
