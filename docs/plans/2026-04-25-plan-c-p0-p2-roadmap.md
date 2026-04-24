# Plan C P0-P2 全量 Roadmap

**Scope**: 用户要求把 P0-P2 全部 9 项全部做掉, 不分批.

## 9 项清单

### P0 — 第二个商家对接前必修

| ID | 标题 | 内容 | 估时 |
|---|---|---|---|
| P0-1 | 批量配方 Excel 导入 | 模板下载 + 后端 parser + FE 上传 dialog, 支持 菜品/食材/配方 三级 | 4h |
| P0-2 | 菜名 alias 映射 + 未匹配面板 | `dim_product_alias` 表 + alias CRUD API + FE "未匹配菜品" 面板 | 4h |

### P1 — 6 个月内

| ID | 标题 | 内容 | 估时 |
|---|---|---|---|
| P1-3 | 食材单价历史 | `raw_material_price_history` 表 + trigger 自动快照 + 按 effective_at 查询 | 3h |
| P1-4 | 配方 versioning | recipes + `effective_from` / `effective_to`, 历史毛利按时间点取对应配方 | 3h |
| P1-5 | 噪音菜清洗 | product_types + `is_excluded` flag + FE 批量 "标记为非菜品" 按钮 | 2h |
| P1-6 | store-comparison 毛利率列时序 fix | 等待 loadStoreMargin 完成后再渲染 | 30m |

### P2 — 增值功能

| ID | 标题 | 内容 | 估时 |
|---|---|---|---|
| P2-7 | LLM 配方建议 | POST `/recipes/ai-draft` qwen3-max 生成 JSON 配方草稿 + FE "AI 建议" 按钮 | 3h |
| P2-8 | 季节性配方 / 替代食材 | `recipe_variants` 表, 按月/季切换 | 3h |
| P2-9 | 客如云/美团/二维火 POS 对接 | OAuth + webhook + 菜品目录同步 (需客户凭证) | 16h ⚠️ blocked |

### 执行顺序

本 session 目标: P0-1 → P0-2 → P1-6 (快) → P1-5 → P1-3 → P1-4 → P2-7 → P2-8
P2-9 写设计 spec, 实际集成等凭证.
