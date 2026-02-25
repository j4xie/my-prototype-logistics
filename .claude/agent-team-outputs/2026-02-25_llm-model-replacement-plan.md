# LLM 模型替换方案分析报告

**日期**: 2026-02-25
**主题**: 免费额度模型最佳替换方案

## Executive Summary

项目当前使用 3 个模型（qwen-plus-2025-12-01、deepseek-v3.2、qwen3-omni-flash-2025-12-01），分布在 4 个角色（主推理、快速/纠错、推理、视觉）。推荐用 qwen3.5-plus 替换主推理，qwen3.5-flash 替换快速/纠错，视觉模型暂保留不变（无免费替代）。

## 当前模型使用全景

| 角色 | 模型 | Java 配置 | Python 配置 | 使用场景 |
|------|------|----------|------------|---------|
| 主推理 | qwen-plus-2025-12-01 | cretas.ai.dashscope.model | LLM_MODEL | SmartBI分析、意图路由、RAG、钻取 |
| 纠错 | deepseek-v3.2 | cretas.ai.dashscope.correction-model | — | Java端纠错 |
| 快速推理 | deepseek-v3.2 | — | LLM_FAST_MODEL | 图表推荐、快速摘要 |
| 推理 | deepseek-v3.2 | — | LLM_REASONING_MODEL | 复杂推理 |
| 视觉 | qwen3-omni-flash-2025-12-01 | cretas.ai.dashscope.vision-model | LLM_VL_MODEL | 人效识别(图片/视频帧) |
| 硬编码 | qwen-plus | IntentKnowledgeBase.java | — | 意图路由 |

## 可用免费模型

| 模型 | 额度 | 过期 | 定位 |
|------|------|------|------|
| qwen3.5-flash | 100万 | 05/23 | 快速轻量 |
| qwen3.5-plus | 100万 | 05/15 | 中高端平衡 |
| qwen3.5-flash-2026-02-23 | 100万 | 05/23 | flash指定版本 |
| qwen3.5-plus-2026-02-15 | 100万 | 05/15 | plus指定版本 |
| qwen3.5-35b-a3b | 100万 | 05/23 | MoE 35B/3B激活 |
| qwen3.5-27b | 100万 | 05/23 | 密集27B |
| qwen3.5-122b-a10b | 100万 | 05/22 | MoE 122B/10B激活 |
| qwen3.5-397b-a17b | 100万 | 05/15 | MoE旗舰397B/17B激活 |
| qwen3-coder-next | 100万 | 05/02 | 代码专用 |
| kimi-k2.5 | 100万 | 04/29 | Moonshot(非DashScope) |

## 最终推荐替换方案

| 角色 | 当前 | → 替换为 | 理由 | 置信度 |
|------|------|---------|------|--------|
| 主推理 | qwen-plus-2025-12-01 | qwen3.5-plus | 同定位升级版 | 高 |
| 快速推理 | deepseek-v3.2 | qwen3.5-flash | 快速低延迟 | 高 |
| 纠错 | deepseek-v3.2 | qwen3.5-flash | 纠错不需最强 | 高 |
| 推理 | deepseek-v3.2 | qwen3.5-plus | 复杂推理需强模型 | 中 |
| 视觉 | qwen3-omni-flash-2025-12-01 | ⚠️ 暂不替换 | 无视觉替代 | 风险 |

### 不推荐使用

- kimi-k2.5: 不走DashScope，集成成本高，最早过期(04/29)
- qwen3-coder-next: 代码专用，非本项目场景，早过期(05/02)
- qwen3.5-35b-a3b: 3B激活参数太小
- qwen3.5-397b-a17b: 旗舰但过期早(05/15)

### 备选升级路径

如 qwen3.5-plus 质量不足，主推理可升级为 qwen3.5-122b-a10b（10B激活，过期05/22）

## 操作步骤

### 服务器 (47.100.235.168)

1. restart-prod.sh: 替换3处模型名
2. restart-test.sh: 替换3处模型名

### 本地代码

3. deploy-smartbi-python.sh: 替换 LLM_MODEL 等
4. IntentKnowledgeBase.java: 替换硬编码的 "qwen-plus"

### 具体替换值

```
qwen-plus-2025-12-01        →  qwen3.5-plus
deepseek-v3.2                →  qwen3.5-flash
qwen3-omni-flash-2025-12-01 →  保持不变
```

## Token 预算规划

| 模型 | 额度 | 预估日均消耗 | 可用天数 |
|------|------|------------|---------|
| qwen3.5-plus | 100万 | ~2-5万 | ~20-50天 |
| qwen3.5-flash | 100万 | ~1-3万 | ~33-100天 |

## 风险评估

| 风险 | 严重度 | 缓解措施 |
|------|--------|---------|
| 视觉模型无免费替代 | 高 | 保留付费模型或暂停人效识别 |
| Token额度耗尽 | 中 | 监控用量，高频用flash |
| 质量未验证 | 中 | 先测试环境验证 |
| 硬编码需改代码 | 低 | 修改+重新部署 |

---

### Process Note
- Mode: Full
- Researchers deployed: 3
- Total sources: codebase + web
- Phases: Research → Analysis → Critique → Integration
- Healer: All checks passed ✅
