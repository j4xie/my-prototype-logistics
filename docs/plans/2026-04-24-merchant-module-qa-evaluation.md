# 6 商家真实数据模块测评报告

**测试时间**: 2026-04-24
**测试者**: Claude (Opus 4.7, qa-prompt v2.4)
**测试范围**: 6 商家 × 10 核心模块 = 60 个测试点
**数据源**: 大众点评真实餐饮连锁数据 (`smartbi维度分析/大众点评/真实餐饮连锁数据/`)
**环境**: test (139.196.165.140:8097)

---

## 1. 商家与数据摘要

| 商家 | 账号 | 工厂ID | 菜系 | 记录数 | 数据特点 |
|------|------|--------|------|-------:|---------|
| 桂满陇 | guimanlong_admin | R_GML | 江浙菜连锁 | **29,089** | 132 门店/1558 菜品 — 超大连锁,数据最富 |
| 不二君 | buerjun_admin | R_BEJ | 中餐连锁 | 1,081 | 6 个月营业数据,但 0 门店解析 |
| IL TEATRO | ilteatro_admin | R_ITE | 西餐 | 524 | 2 月商品销量 (测试中遇部署抖动) |
| 唏嘛香 | ximaxiang_admin | R_XMX | 快餐/面食 | 524 | 单店 2 月销量 |
| 御九井 | yujiujing_admin | R_YJJ | 日料 | 436 | 单店 2 月销量 |
| 上马火锅 | shangma_admin | R_SMH | 火锅 | 252 | 单店 2 月销量 — 最小样本 |

**账号创建**: SQL seed 6 factories (type=RESTAURANT) + 6 users (role=factory_super_admin, password=123456). 全部登录 OK.

**上传**: 6/6 upload-and-analyze 成功 (auto_confirm=true). 旧 .xls 格式需先走 xlsx_converted/ 的 xlsx 版本,新 .xlsx 和 CSV 直接可用.

---

## 2. 模块测评矩阵

✅ = 有数据/可用 · ⚠️ = 部分 · ❌ = 空/错误 · 🐛 = bug

| 模块 | 桂满陇 | 不二君 | IL TEATRO | 唏嘛香 | 御九井 | 上马火锅 |
|------|--------|--------|-----------|--------|--------|----------|
| 经营驾驶舱 (Dashboard) | ❌ big empty | ❌ empty | (restart) | ❌ empty | ❌ empty | ❌ empty |
| 财务数据分析 | 🐛 0值 | 🐛 0值 | (restart) | 🐛 0值 | 🐛 0值 | 🐛 0值 |
| 餐饮综合分析 V2 | ⚠️ KPI空 + 5模板未跑 | ⚠️ 同 | (restart) | ⚠️ 同 | ⚠️ 同 | ⚠️ 同 |
| 销售数据分析 | 🐛 "数量金额_N" 列名裸露 | ❌ 2空 | (restart) | 🐛 "数量金额_N" | 🐛 "数量金额_N" | 🐛 "数量金额_N" + 智能数据分析有数 |
| 智能数据分析 | minimal (23s 慢) | minimal | (restart) | minimal | minimal | ✅ 4kpi 7chart |
| 趋势分析 | 4tpl Week6 模板 | 4tpl | (restart) | 4tpl | 4tpl | 4tpl |
| 餐饮运营总览 | ✅ 最富 (7624.2万/132店) | ✅ 5024.5万但 0店 | (restart) | ❌ 空 "请先上传POS数据" | ❌ 空 | ❌ 空 |
| 菜品四象限 | ✅ 1558菜品 4象限 | ⚠️ chart 有但数据稀 | (restart) | ❌ 空 | ❌ 空 | ❌ 空 |
| 门店对比 | ✅ 132 店排名 + 明细表 | ❌ 0 门店空 | (restart) | ❌ 空 | ❌ 空 | ❌ 空 |
| 销售订单 | minimal (POS无) | minimal | (restart) | minimal | minimal | minimal |

---

## 3. 关键 Bug / UX 问题 (P0-P2)

### 🐛 P0-1 — 销售数据分析 KPI 标签裸露 DB 列名

**现象** (桂满陇/唏嘛香/御九井/上马火锅): 8 个 KPI 卡显示
```
数量金额    634.3万
数量金额_2  0
数量金额_3  124.2万
数量金额_4  1.8亿
数量金额_5  1.8亿
数量金额_6  2312.6万
数量金额_7  0
数量金额_8  1.5亿
```

**问题**:
1. `数量金额_N` 是数据库列名,不是面向用户的标签
2. 同时 2 个值都是 "1.8亿" — 可能是同列被重复 SUM
3. 桂满陇 1.8 亿 × 2 = 3.6 亿 · 29,089 条 = avg ¥12,377/条,远超实际菜品价格

**根因**: 上传后 schema detection auto_confirm=true 的情况下,没有把 CSV 列名从"数量金额"类模糊名映射成"销售额/订单数/客单价"等标准 KPI 标签;前端直接 render `_2..._8` 后缀.

**影响**: 这是用户打开 `销售数据分析` 第一眼看到的,**严重破坏专业感**. 数据分析师无法从这种标签判断业务含义.

**修复方向**:
- 后端 schema mapper 对 `数量金额` 这类模糊列名加去重/强制映射 (如检测到 N 列同名 → 分别映射为"总营业额/订单数/销售数量/均客单/最高客单/..." 等语义)
- 或前端 formatter 识别 `_N` suffix → 显示 "销售额 (指标 N)"

---

### 🐛 P0-2 — Gold 层没自动物化,Dashboard + Finance 始终 ¥0.00

**现象** (所有 6 商家): 经营驾驶舱 / 财务数据分析 / 餐饮 V2 实时KPI看板 都显示
```
总营收 ¥0.00 / POS 订单数 0 / 客单价 ¥-- / 门店数 0
```

但 `餐饮运营总览` (基于 Python restaurant_analytics_v2,直接读上传数据) 展示了完整 7624.2万 + 132 店.

**根因**: upload-and-analyze 成功后,数据入了 raw 表 (smart_bi_dynamic_data 之类),但没触发 **Silver 层 materialization** 写入 `fact_pos_transaction`. Dashboard/Finance 的 Gold-backed KPI 全部通过 `fact_pos_transaction` 聚合 → 新上传的商家看不到任何数字.

**影响**: 商家上传数据后,点进最显眼的 **经营驾驶舱** 看到全 0,立刻怀疑"数据没上传成功" — 用户流失点.

**修复方向** (之前 Phase 1 已做 **前端 fallback chain**,但对 Gold 不生效,因为 Gold 本身空):
- 上传时增加 Silver materialization pipeline: 上传 CSV → 识别 POS 字段 → 写入 fact_pos_transaction + agg_daily
- 或 fallback 到读 raw 层 (但会导致跨 schema 查询)
- 最小改动: Dashboard KPI 见 Gold 空 → 切换到 Python restaurant_analytics_v2 路径 (同 `/restaurant/analytics`)

---

### 🐛 P0-3 — 不二君"门店数 0"但"总营收 5024.5万"自相矛盾

**现象**: 不二君 餐饮运营总览:
- 总营收 5024.5万
- 菜品数 28  
- 明星菜品 14
- **门店数 0** ← 不合理

**根因**: 不二君 CSV 的 "门店名称" 字段解析失败 (可能列名非"门店"/"店名"标准). Python 聚合能算出总营收,但 group-by store 返回空集.

**影响**: 门店对比页面空,Top 5 图表空挂. 数据分析师无法做门店分析.

**修复**: schema_helpers 加更多门店列名别名: `店铺/门店/分店/店名/门店名称/分店名称/Store/Outlet`.

---

### 🐛 P1-4 — 餐饮 V2 Dashboard 默认占位符硬编码

**桂满陇**餐饮 V2 Dashboard 表单:
```
子行业: 火锅      ← 桂满陇是江浙菜!
门店: 例:青花椒大丸百货店  ← 其他商家的门店
期间: 2026-04    ← 当前月份,多数商家无数据
```

**问题**: 全局硬编码,不随商家变化. 桂满陇商家看到"火锅"+"青花椒"placeholder,困惑.

**修复**: Vue component 初始化时从当前 factoryId / `factoryService.getIndustry()` 拉实际行业填入默认. 门店 placeholder 也应该从商家的 store_list 取 1 家做示例.

---

### 🐛 P1-5 — 侧边栏对餐饮租户显示所有制造模块

**现象**: 6 商家全部看到 采购管理/销售管理/**人事管理**/**财务管理**/**系统管理**/数据分析/**餐饮运营**/智能BI 的完整菜单.

但在 Apr 24 P1-3 commit `6de89e6dc` 修过: F002 restaurant_admin1 下 **/sales/finished-goods + /sales/shipments** 对餐饮隐藏. 这依赖 `hideForFactoryTypes: ['RESTAURANT']` 机制.

**问题**: 更大范围的制造模块 (采购/人事/财务) 对餐饮租户仍可见. 对纯餐饮商家,"采购订单"毫无意义.

**修复方向**: 把 purchase/hr/finance 整个加 `hideForFactoryTypes: ['RESTAURANT']` OR 依赖 Canvas 管理员手动 disable 对应模块码 (purchase_order/hr_employee/finance_ar/finance_ap).

---

### 🐛 P2-6 — 智能数据分析加载慢 + 多数显空

所有商家智能数据分析加载 23s (上马火锅例外 5s,有内容). 其余显示 minimal.

**原因**: 上传完成后 Python 异步生成 dynamic_chart_analysis 结果,没完成 → 前端显 loading 超时.

**修复**: 上传后主动等 3-5s 再允许用户跳转智能数据分析,或后端加 completeness 状态.

---

### 🐛 P2-7 — 菜品四象限分类名称用词非标

桂满陇菜品四象限: 明星 / 耕牛 / 谜题 / 瘦狗

标准 BCG 矩阵中文对应:
- 明星 (Stars) = 高市场占有率 + 高增长
- **金牛 (Cash Cows)** = 高占有率 + 低增长 ← 目前用"耕牛"
- **问题 (Question Marks)** = 低占有率 + 高增长 ← 目前用"谜题"
- 瘦狗 (Dogs) = 低 + 低

**影响**: 专业数据分析师看到"耕牛"会困惑 — 这是非标用词. "谜题"对应"问题产品"也不直观.

**修复**: 改为标准术语 金牛 / 问题产品.

---

## 4. 数据分析师视角评分

| 模块 | 评分 | 评语 |
|------|-----:|------|
| 经营驾驶舱 | 2/10 | 新商家看到全空,缺乏首屏价值.Gold 物化缺失是瓶颈. |
| 财务数据分析 | 2/10 | 利润 tab 对餐饮返 Gold 空. 其他 4 tab (成本/应收/应付/预算) 已隐藏但提示弱. |
| **餐饮运营总览** | **8/10** | ⭐ 最强模块. 6 KPI + 菜品四象限 + 门店 Top5 + 品类饼 + 雷达指标. 桂满陇场景下非常专业. |
| **菜品四象限** | **7/10** | ⭐ 基于 BCG 矩阵,分类方式对菜品优化有直接指导. "耕牛/谜题"术语需改. |
| **门店对比** | **9/10** | ⭐⭐ 桂满陇场景下接近完美: 132 店 bar + 明细表 (营收/品项数/均收入/折扣率/状态). |
| 销售数据分析 | 3/10 | KPI 列名露 DB 后缀,值重复,语义缺. 1.8亿 × 2 显示严重可信度问题. |
| 智能数据分析 | 4/10 | 上马火锅数据下能出 4 KPI + 7 chart,其他多数空.稳定性不足. |
| 趋势分析 | 5/10 | Week6 模板 fallback 展现 4 tpl,但主 chart (生产/质量/成本) 对餐饮无意义 (Apr 24 P1-11 已隐藏). |
| 餐饮综合分析 V2 | 5/10 | 表单 + 5 模板 placeholder,要用户手动点"跑 V2 分析". Placeholder 硬编码. |
| 销售订单 | 1/10 | 餐饮租户几乎全空. P1-10 已加提示,但页面仍占屏.建议彻底隐藏. |

---

## 5. 普通用户视角评分

| 维度 | 评分 | 评语 |
|------|-----:|------|
| 登录即上手 | 3/10 | 进入先看 Dashboard 全空,不知道"我的数据上传在哪".需要找 Excel 上传菜单. |
| 上传流程 | 7/10 | 上传-and-analyze 成功率高 (6/6),auto_confirm=true 后台自动识别字段.旧 .xls 报错提示清晰. |
| 找"我的分析" | 4/10 | 数据在 **餐饮运营总览** 能看到,但默认首页是 **经营驾驶舱** 显空,多数用户不会往 餐饮运营 深挖. |
| 术语一致性 | 5/10 | 耕牛/谜题/数量金额_N 等非标术语让普通店长困惑. |
| 错误提示 | 8/10 | 旧 .xls 上传报"Excel 解析失败: 文件不是有效的 xlsx 格式,可能损坏/非 Excel/旧 .xls 格式",信息明确. |
| 多店铺导航 | 2/10 | 单店家在门店对比看 Top5 排名没问题,但没有"我店"vs"其他店"对比视角. |
| 移动端? | N/A | 本轮仅测 Web-Admin. |

---

## 6. 跨商家一致性观察

| 一致 | 不一致 |
|------|--------|
| 侧边栏 66 项全部商家相同 (未 Canvas 定制) | 餐饮运营总览: 桂满陇/不二君有数据,其余 4 空 |
| 经营驾驶舱所有商家全空 (Gold 未物化) | 智能数据分析: 只有上马火锅有数据 (252 records 反而最小样本触发成功) |
| 财务 KPI 全 ¥0.00 (Gold 空) |  |
| 趋势分析 4tpl 全商家 ||
| 餐饮 V2 dashboard 硬编码 "火锅" + "青花椒" placeholder | 门店解析: 桂满陇 132,不二君 0,其他 4 未触发 |

---

## 7. 优先修复清单 (建议)

| 优先级 | 问题 | 工作量 |
|-------:|------|-------:|
| P0 | 销售数据分析 "数量金额_N" 列名裸露 | 0.5-1 天 (后端 schema mapper 加语义映射) |
| P0 | Gold 层 fact_pos_transaction 不自动物化 → Dashboard/Finance ¥0 | 2-3 天 (upload pipeline 加 Silver 物化) |
| P0 | 不二君 门店解析 = 0 但有营收 | 0.5 天 (schema_helpers 加门店别名) |
| P1 | 餐饮 V2 Dashboard 硬编码 placeholder | 0.5 天 (从 factoryService 拉行业+门店) |
| P1 | 餐饮租户侧边栏仍见采购/人事/财务制造模块 | 0.5 天 (扩展 hideForFactoryTypes) |
| P2 | 智能数据分析加载 23s → 多数空 | 1 天 (后端 completeness 状态 + 前端 skeleton) |
| P2 | 菜品四象限"耕牛/谜题"→"金牛/问题产品" | 5min (字符串改) |
| P2 | 销售订单餐饮租户空表彻底隐藏 | 5min (加 v-if) |

---

## 8. 测试证据位置

- 报告: `docs/plans/2026-04-24-merchant-module-qa-evaluation.md`
- 结果 JSON: `tests/e2e-comprehensive/results/qa-merchant-module-eval/results.json`
- 60 截图: `tests/e2e-comprehensive/results/qa-merchant-module-eval/{gml,xmx,ite,smh,yjj,bej}/*.png`
- 脚本: `tests/e2e-comprehensive/qa-merchant-upload-batch.mjs` + `qa-merchant-module-eval.mjs`
- DB seed: SQL in session log
- 6 商家账号 (密码 123456): guimanlong_admin / ximaxiang_admin / ilteatro_admin / shangma_admin / yujiujing_admin / buerjun_admin

---

## 9. 结论

**系统可用性**: 上传流程稳健 (6/6 成功),数据富的商家 (桂满陇) 餐饮运营总览 / 菜品四象限 / 门店对比 3 个模块**达到专业分析师可用水准** — 9/10 分.

**核心缺陷**: Gold 层 (fact_pos_transaction) 不随上传自动物化 → 首屏 Dashboard 对新商家全空,严重影响首次体验. **这是最影响用户留存的问题**.

**次要缺陷**: 销售数据分析 "数量金额_N" 列名露、餐饮 V2 默认硬编码 "火锅+青花椒"、门店别名识别不够宽泛.

**建议**: 优先修 P0-2 (Gold 自动物化) 和 P0-1 (列名映射). 这两项解决后,新商家 onboarding 首屏体验跃升.
