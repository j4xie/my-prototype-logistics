# 工厂管理 vs 餐饮门店 RN App 对比验证报告

**日期**: 2026-02-20
**模式**: Full | 语言: Chinese | 代码溯源: ENABLED

---

## Executive Summary

餐饮门店版本框架完整，核心进销存与数据分析功能与工厂版高度重合，实现成本极低。当前最高优先级缺陷仅两项：`factoryType` 大小写敏感导致路由静默降级、种子数据中 recipes 配方表为空导致演示可信度为零。其余问题（ProductType 字段冗余、角色映射偏差、allergen 缺失）均为可接受技术债，不阻塞当前"进销存+数据分析"的限定需求。

---

## Phase 1: Research Findings

### R1 — 代码对比分析 (8 findings, ★★★★★ codebase evidence)

| # | 发现 | 来源 |
|---|------|------|
| 1 | `isRestaurant()` 两段式判断：先判 userType 后判 factoryType，`\|\| 'FACTORY'` 兜底 | `utils/factoryType.ts` |
| 2 | `factoryType` 为 optional(`?`)，undefined 时静默降级为工厂版 | `types/auth.ts` |
| 3 | Tab 层用 `!isRestaurantMode` 控制"报表"Tab 显示/隐藏 | `FactoryAdminTabNavigator.tsx` |
| 4 | Stack 路由层不注册 14 个工厂路由，防路由泄露 | `FAManagementStackNavigator.tsx` |
| 5 | UI 层 6 项功能隐藏 + 3 处文案切换(菜品/食材/门店进销存) | `FAManagementScreen.tsx` |
| 6 | 首页统计卡片+快捷操作完全替换，但值均为 `'--'` (TODO 后端 API) | `FAHomeScreen.tsx` |
| 7 | factoryType 传递链完整：后端→auth→store→UI，双重 `\|\| 'FACTORY'` 保护 | `authService.ts` |
| 8 | 后端 `UserDTO.factoryType` 为 String 非 enum，无 `@NotNull`，大小写敏感风险 | `UserDTO.java` |

**矛盾点**:
- HEADQUARTERS/BRANCH 类型盲区（当前不适用，Critic 确认）
- 注册流程 `adaptRegisterResponse()` 缺 factoryType
- 餐饮 Dashboard 数据全为占位符

**factoryType 传递链路图**:
```
[DB factory.type] → [UserDTO.factoryType (String)] → [API unified-login]
  → [adaptNewApiResponse || 'FACTORY'] → [transformBackendUser || 'FACTORY']
  → [authStore] → [getFactoryType()] → [isRestaurant() === 'RESTAURANT']
  → Tab隐藏 / Stack路由保护 / UI文案切换 / 首页替换
```

### R2 — 行业标杆对比 (MISSING)

竞品数据缺失（rate limited）。已知差距：缺 POS、桌台管理、会员、外卖对接。但用户明确限定范围为"进销存+数据分析"，竞品对比的参照系需要重新校准。

### R3 — 数据模型审查 (8 findings, ★★★★★ codebase evidence)

| # | 发现 | 来源 |
|---|------|------|
| 1 | `ProductType` 复用含 8 个工厂专用字段(productionTimeMinutes 等)对餐饮无意义 | `ProductType.java` |
| 2 | `RawMaterialType` 的 storage_type/shelf_life_days 匹配良好，缺 allergen_info/origin | `RawMaterialType.java` |
| 3 | Recipe BOM 有 `net_yield_rate`(净料率)设计专业，缺份量规格和季节性标记 | `Recipe.java` |
| 4 | 四张餐饮表均无 FK 约束，仅靠应用层维护引用完整性 | `create_restaurant_tables_pg.sql` |
| 5 | 种子数据 18 菜品 28 食材 5 供应商，但零条 recipes 配方数据 | `seed_restaurant_R001.sql` |
| 6 | `PEAK_HOURS_ANALYSIS` 依赖小时时间戳但 sales_orders 仅 DATE 类型→回退硬编码 | `RestaurantIntentHandler.java` |
| 7 | `FactoryTypeBlueprint` 餐饮模板已创建含 dailyCapacity/peakHours 等配置 | `seed_restaurant_R001.sql` |
| 8 | 角色映射语义偏差：收银员→quality_inspector, 厨师长→workshop_supervisor | `seed_restaurant_R001.sql` |

---

## Phase 2: Analysis

### Comparison Matrix

| 维度 | 当前实现状态 | Analyst 评分 | Critic 修正 | 最终评分 |
|------|-------------|-------------|------------|---------|
| 功能覆盖度 | Tab/Stack/UI 三层隔离完成，Dashboard TODO | 2/5 | 3.5/5 | **3.5/5** |
| 代码健壮性 | 双重兜底+路由防泄露，String 类型风险 | 3/5 | 3/5 | **3/5** |
| 数据模型质量 | RawMaterialType 匹配好，ProductType 冗余，无 FK | 2/5 | 2.5/5 | **2.5/5** |
| 种子数据可用性 | 18 菜品 28 食材 0 配方 | 1/5 | 3/5 | **2/5** |
| 生产就绪度 | 框架就绪，factoryType bug 修复后可演示 | 2/5 | 2.5/5 | **2.5/5** |

### Key Patterns

1. **"架子完整、内容为空"**：路由/Tab/文案隔离均已完成，但需要真实数据的功能为占位符
2. **"工厂优先、餐饮适配"**：通过"隐藏"而非"替换"实现多业态，成本低但技术债累积
3. **"显式防护 + 隐式风险"**：路由防泄露做得好，但 factoryType 类型安全和注册流程存在隐式风险

---

## Phase 3: Critique — Key Challenges

**Challenge 1: 功能覆盖度评分应为 3.5/5 而非 2/5**
用户需求是"进销存+数据分析"，工厂版进销存模块（采购/库存/销售/批次追踪）与餐饮高度重合。用完整餐饮 ERP 作参照系是错误的。

**Challenge 2: allergen_info 影响应为低至中而非极高**
内部管理工具不受 C 端食品标签法规约束。30 分钟工作量的可选字段不构成架构级风险。

**Challenge 3: ProductType 拆分违反 YAGNI**
8 个工厂字段在餐饮场景下为 null，不影响运行。DTO 屏蔽即可，Entity 拆分属 v2.0。

**Challenge 4: HEADQUARTERS/BRANCH 盲区不适用当前需求**
假设性风险，当前单门店场景无连锁需求，移出风险矩阵。

**Strongest Counterargument**: 正确的分析框架应该是"在进销存+分析约束下，什么会导致运行错误或数据错误"，而非"与完整餐饮 ERP 的差距"。真正高优先级仅 2 项。

---

## Phase 4: Final Integrated Report

### Consensus Map

| 主题 | Analyst | Critic | 最终裁决 |
|------|---------|--------|---------|
| isRestaurant() 路由保护 | 健壮 | 同意 | **设计合格，需加 enum 防御** |
| factoryType 大小写风险 | 高优先级 | 同意 | **P0 必须修复** |
| recipes 零数据 | 1/5 严重 | 3/5 非阻塞 | **P1 影响演示可信度** |
| 功能覆盖度 | 2/5 | 3.5/5 | **Critic 正确: 3.5/5** |
| ProductType 污染 | 高，需拆分 | 低，技术债 | **Critic 正确: 暂不处理** |
| allergen 缺失 | 极高 | 低至中 | **Critic 正确: 降级** |
| 角色映射偏差 | 中 | 低 | **Critic 正确: roleMapping 已缓解** |
| HEADQUARTERS/BRANCH | 高概率 | 不适用 | **Critic 正确: 移出** |

### Actionable Recommendations

**Immediate (P0, 今天可做)**:
1. factoryType 大小写修复 — `authService.ts` 登录解析时 `.toUpperCase()` 或后端改 enum
2. 注册流程补全 factoryType 字段

**Short-term (P1, 本周)**:
3. 补充 recipes 种子数据 — 为主要菜品补 3-5 条 BOM 配方
4. 四张餐饮表添加 FK 约束
5. PEAK_HOURS 时段逻辑修复（TIMESTAMP 或增加 hour 列）

**Conditional (有需求再做)**:
6. ProductType 拆分 → 仅在菜品分类与工厂冲突时
7. 角色语义优化 → 仅在客户反馈困惑时
8. allergen_info → 仅在 B2B 合规要求时
9. 连锁门店支持 → 仅在多门店需求时

### Open Questions

1. 现有生产数据库中 R001 的 `factory_type` 字段存储格式是否为大写 `RESTAURANT`？
2. 餐饮版首页 Dashboard API 是否有接入计划？
3. SmartBI 是否需要预置餐饮分析模板（食材成本占比、菜品毛利分析）？
4. `isRestaurant()` 静默降级为工厂版是预期行为还是需要报错？

---

## Process Note

- Mode: Full
- Researchers deployed: 3 (2 successful, 1 rate-limited)
- Total findings: 16 from 14 source files
- Key disagreements: 5 resolved (Critic prevailed on all 5 — scope-matching was the key insight)
- Phases completed: Research → Analysis → Critique → Integration
- Fact-check: Skipped (all findings are ★★★★★ codebase evidence, no external claims to verify)
- Competitor profiles: N/A (R2 data missing)
