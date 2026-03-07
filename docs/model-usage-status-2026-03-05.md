# AI 模型使用状况记录

> 记录日期：2026-03-05
> 记录目的：测试阶段切换至免费额度模型，降低开发成本

---

## 一、当前 API 用量（过去一天 / 过去一周）

### 过去一天用量

| 模型 | 调用次数 | Token 总数 | 输入 Token | 输出 Token | 估算费用 |
|------|---------|-----------|-----------|-----------|---------|
| qwen3.5-plus | 4,741 | 8,904,412 | 8,301,517 | 762,691 | ~8 元 |
| qwen3.5-flash | 2,524 | 1,560,158 | 1,444,414 | 92,915 | <0.5 元 |
| qwen3.5-35b-a3b | 708 | 1,496,155 | 195,389 | 1,320,089 | ~3 元 |
| qwen3.5-27b | 12 | 38,082 | 23,661 | 14,421 | 免费额度 |
| qwen-turbo | 7 | 196 | 182 | 14 | 极少 |
| qwen3.5-flash-0223 | 1 | 3,732 | 3,731 | 1 | 极少 |
| **日合计** | **~8,000** | **~1,200 万** | | | **~12 元** |

### 过去一周用量

| 模型 | 调用次数 | Token 总数 | 输入 Token | 输出 Token |
|------|---------|-----------|-----------|-----------|
| qwen3.5-35b-a3b | 3,935 | 10,225,579 | 1,238,448 | 9,175,997 |
| qwen3.5-flash | 4,350 | 6,616,322 | 5,619,473 | 940,671 |
| qwen3.5-plus | 1,733 | 3,529,578 | 3,393,861 | 280,784 |
| qwen3.5-flash-0223 | 77 | 320,297 | 255,483 | 64,814 |
| qwen3.5-27b | 53 | 169,488 | 96,328 | 73,160 |
| qwen-plus | 75 | 53,646 | 19,881 | 33,765 |
| glm-5 | 1 | 31,966 | 1,641 | 38 |
| MiniMax-M2.5 | 1 | 18,671 | 155 | 100 |
| kimi-k2.5 | 3 | 15,535 | 15,390 | 145 |
| qwen-turbo-latest | 11 | 6,093 | 4,365 | 1,728 |
| qwen-turbo | 11 | 308 | 286 | 22 |
| **周合计** | **~10,500** | **~2,090 万** | | |

**周费用估算**: ~25 元（日均 ~3-4 元）

**关键特征**:
- 纯文本模型消耗，无视觉模型 (VL) 调用
- qwen3.5-plus 和 qwen3.5-35b-a3b 为主力消耗模型
- qwen3.5-flash 高频低量，用于意图分类/简单判断
- 用量整体处于开发测试阶段，远未达到生产规模

---

## 二、免费额度剩余

| 模型 | 免费额度 | 已用 | 剩余 | 状态 |
|------|---------|------|------|------|
| qwen3.5-27b | 1,000,000 | ~302K | 698,190 | 部分使用 |
| qwen3.5-122b-a10b | 1,000,000 | 0 | 1,000,000 | 未使用 |
| qwen3.5-397b-a17b | 1,000,000 | 0 | 1,000,000 | 未使用 |
| qwen3-coder-next | 1,000,000 | 0 | 1,000,000 | 未使用 |
| kimi-k2.5 | 1,000,000 | ~16K | 984,465 | 少量使用 |
| glm-5 | 1,000,000 | ~32K | 968,034 | 少量使用 |
| glm-4.7 | 1,000,000 | 0 | 1,000,000 | 未使用 |
| qwen3-max-2026-01-23 | 1,000,000 | 0 | 1,000,000 | 未使用 |
| **qwen3-vl-plus-2025-12-19** | 1,000,000 | 0 | 1,000,000 | **未使用（唯一免费VL模型）** |
| qwen-flash-character | 1,000,000 | 0 | 1,000,000 | 未使用 |

**免费额度总计**: ~969 万 token 可用

---

## 三、模型切换方案（付费 → 免费）

### 切换映射表

| 用途 | 切换前（付费） | 切换后（免费） | 配置位置 |
|------|------------|------------|---------|
| 主文本模型 | qwen3.5-plus / qwen3.5-plus-2026-02-15 | **qwen3-max-2026-01-23** | config.py, DashScopeConfig.java |
| 快速模型 | qwen3.5-flash | **qwen3.5-flash**（本身极低价） | 保持不变 |
| 纠错模型 | qwen-turbo | **qwen3.5-27b** | DashScopeConfig.java |
| VL 实时分析 | qwen-vl-plus | **qwen3-vl-plus-2025-12-19** | vl_client.py |
| VL 高精度 | qwen-vl-max | **qwen3-vl-plus-2025-12-19** | vl_client.py, config.py |
| VL 深度推理 | qwen-vl-max | **qwen3-vl-plus-2025-12-19** | vl_client.py |
| 文本生成 | qwen3.5-plus-2026-02-15 | **qwen3-max-2026-01-23** | vl_client.py |
| 推理模型 | qwen3.5-397b-a17b | **qwen3.5-397b-a17b**（已是免费） | 保持不变 |
| 图表推荐 | qwen3.5-27b | **qwen3.5-27b**（已是免费） | 保持不变 |
| 映射模型 | qwen3.5-122b-a10b | **qwen3.5-122b-a10b**（已是免费） | 保持不变 |
| 脚本 NER | qwen-plus | **qwen3.5-122b-a10b** | scripts/ |
| 脚本标注 | qwen3.5-plus | **qwen3-max-2026-01-23** | scripts/ |

### 不变的配置
- `qwen3.5-flash`: 本身几乎免费，保持不变
- `qwen3.5-397b-a17b`: 已有免费额度，保持不变
- `qwen3.5-27b`: 已有免费额度，保持不变
- `qwen3.5-122b-a10b`: 已有免费额度，保持不变

---

## 四、配置文件变更清单

| 文件 | 变更项 | 旧值 | 新值 |
|------|-------|------|------|
| `backend/python/smartbi/config.py` | llm_model | qwen3.5-plus-2026-02-15 | qwen3-max-2026-01-23 |
| `backend/python/smartbi/config.py` | llm_vl_model | qwen-vl-max | qwen3-vl-plus-2025-12-19 |
| `backend/python/common/vl_client.py` | REALTIME_ANALYSIS | qwen-vl-plus | qwen3-vl-plus-2025-12-19 |
| `backend/python/common/vl_client.py` | BATCH_ANALYSIS | qwen-vl-plus | qwen3-vl-plus-2025-12-19 |
| `backend/python/common/vl_client.py` | HIGH_PRECISION | qwen-vl-max | qwen3-vl-plus-2025-12-19 |
| `backend/python/common/vl_client.py` | DEEP_REASONING | qwen-vl-max | qwen3-vl-plus-2025-12-19 |
| `backend/python/common/vl_client.py` | TEXT_GENERATION | qwen3.5-plus-2026-02-15 | qwen3-max-2026-01-23 |
| `backend/python/common/vl_client.py` | default_model | qwen-vl-max | qwen3-vl-plus-2025-12-19 |
| `backend/java/.../DashScopeConfig.java` | model | qwen3.5-plus | qwen3-max-2026-01-23 |
| `backend/java/.../DashScopeConfig.java` | correctionModel | qwen-turbo | qwen3.5-27b |
| `scripts/food-kb/auto_annotate_ner.py` | DEFAULT_MODEL | qwen-plus | qwen3.5-122b-a10b |
| `scripts/finetune/shadow_adjudicate.py` | LLM_MODEL | qwen3.5-plus | qwen3-max-2026-01-23 |
| `scripts/finetune/zpd_label_batch.py` | LLM_MODEL | qwen3.5-plus | qwen3-max-2026-01-23 |
| `scripts/finetune/gen_v7_synthetic.py` | model | qwen3.5-plus | qwen3-max-2026-01-23 |

---

## 五、注意事项

1. **免费额度有限**: 每个模型 100 万 token，用完后会自动转为计费
2. **恢复方式**: 生产上线时将模型名改回原值即可
3. **qwen3.5-flash 不变**: 该模型本身定价极低（输入 0.0001 元/千 token），无需替换
4. **VL 模型**: qwen3-vl-plus 精度略低于 qwen-vl-max，测试阶段足够
5. **qwen3-max vs qwen3.5-plus**: qwen3-max 是 qwen3 系列最强模型，能力不弱于 qwen3.5-plus

---

## 六、算力平台试用（待定）

- **平台**: 上海数据局算力调度平台
- **联系人**: 刘杰
- **可选资源**: 8×4090 或 910B
- **试用期**: 7 天免费
- **建议选择**: 4090（CUDA 生态兼容性好）
- **主要验证目标**: 开源 Qwen-VL 模型推理/微调，替代 API 调用降低长期成本
