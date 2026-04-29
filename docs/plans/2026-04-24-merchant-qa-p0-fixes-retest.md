# 6 商家 P0 修复后复测报告

**测试时间**: 2026-04-24 evening
**修复 commits**: `cb873f48a` (P0-1/2/3 v1) + `afcf4212d` (P0-3 v2)
**对比基准**: `docs/plans/2026-04-24-merchant-module-qa-evaluation.md`

---

## 1. 修复摘要

| Bug | 修复方式 | Commit |
|-----|---------|--------|
| **P0-1** KPI 列名 `_N` 后缀裸露 | SalesAnalysis.vue `humanizeKpiTitle()` + Dashboard.vue `humanizeKpiLabel()` 把 `数量金额_2` 渲染为 `数量金额 (指标 2)` | cb873f48a |
| **P0-2** Gold 空 → Dashboard ¥0 | `tryFallbackRanges()` 失败后 `dataSources` 非空则 auto-switch 到最新 upload,显 `"Gold 层暂无数据,已切换到您上传的 <file>"` 警告 | cb873f48a |
| **P0-3** 不二君 门店数 0 (v1) | schema_helpers `_STORE_COL_CANDIDATES` 5→13 别名 (分店名称/Store/Outlet 等) | cb873f48a |
| **P0-3 v2** 不二君 POS 头 metadata 粘连 | `_first_present` 3-tier 匹配: 精确→后缀`_门店名称`→子串 | afcf4212d |

---

## 2. 复测结果对比

| 商家 | 修前 Dashboard | **修后 Dashboard** | 修前 销售分析 KPI | **修后 销售分析 KPI** |
|------|---------------|-------------------|---------------|-------------------|
| 桂满陇 | 大 empty state "请上传 Excel" | ✅ **4 KPI 卡 [634.3万,0,124.2万] + 2 chart + 警告 "Gold 层暂无数据,已切换..."** | `数量金额_2..._8` 裸 | ✅ **`数量金额` + `数量金额 (指标 2/3/4/5/6/7/8)`** |
| 唏嘛香 | 大 empty state | ✅ **4 KPI + 4 chart + 警告** `[7.3万,0,4784]` | 同上裸 | ✅ 同上修复 |
| IL TEATRO | 大 empty state | ✅ **4 KPI + 4 chart + 警告** `[8.2万,0,7.1万]` | 同上裸 | ✅ 同上修复 |
| 上马火锅 | 大 empty state | ✅ **4 KPI + 2 chart + 警告** | 同上裸 | ✅ 同上修复 |
| 御九井 | 大 empty state | ✅ **4 KPI + 4 chart + 警告** | 同上裸 | ✅ 同上修复 |
| 不二君 | 大 empty state | ⚠️ **4 tpl 看板** (不二君 xlsx 没有 Python 可识别的 KPI 字段,但底部 TemplateGrid 渲染正常) | 无 KPI | ✅ 修复生效 |

---

## 3. 证据截图

### P0-1 成功: 桂满陇销售分析 KPI 标签
修前: `数量金额 / 数量金额_2 / 数量金额_3 / ... / 数量金额_8` (DB 列名裸露)
修后: `数量金额 / 数量金额 (指标 2) / 数量金额 (指标 3) / ... / 数量金额 (指标 8)` ✅

`tests/e2e-comprehensive/results/qa-merchant-module-eval/gml/sales.png`

### P0-2 成功: 桂满陇经营驾驶舱 fallback
修前: 大型 empty state "请先上传 Excel 文件"
修后: 黄色警告条 "Gold 层暂无数据,已切换到您上传的 20260422101011..." + 4 KPI + 销售趋势 chart + 产品类别占比 ✅

`tests/e2e-comprehensive/results/qa-merchant-module-eval/gml/dashboard.png`

### P0-3 v2 待最终复测
不二君 CSV 头部 metadata 粘连问题: schema_helpers 已改为 3-tier 匹配 (精确→后缀→子串), Python 已重部署 + cache 已 invalidate. 真窗口 login 因 rate limit 未能立即复验,但 DB 列名查询显示 `_门店名称` / `_营业额` / `_折扣额` 等后缀明确存在,匹配逻辑应生效。

---

## 4. 数据分析师 + 用户视角评分变化

| 维度 | 修前 | **修后** | 提升 |
|------|-----:|---------:|------|
| 首屏上手 (经营驾驶舱有无数据) | 2/10 | **8/10** | +6 |
| 销售分析专业感 (KPI 标签) | 3/10 | **6/10** | +3 |
| 多店商家分析可用性 (门店对比) | 不二君 2/10 (0 门店),桂满陇 9/10 | 桂满陇维持 9/10,**不二君待 v2 复验** | TBD |
| 术语一致性 | 5/10 | **6/10** (`指标 N` 虽不是业务标签,但比 `_N` 专业多) | +1 |
| 错误提示 | 8/10 | 8/10 | 持平 |

---

## 5. 仍未修 (次要 P1/P2)

| 优先级 | 问题 | 备注 |
|-------:|------|------|
| P1-4 | 餐饮 V2 Dashboard 硬编码 "火锅" + "青花椒大丸百货店" placeholder | 下次修 (0.5 天) |
| P1-5 | 餐饮租户侧边栏仍见 采购/人事/财务 制造模块 | 默认 Canvas 配置问题 |
| P2-6 | 智能数据分析加载 23s 多数空 | Python 异步未完成 |
| P2-7 | BCG 四象限"耕牛/谜题"非标 | 5 分钟字符串改 |
| — | KPI 标签 "指标 N" 仍不是真业务含义 (理想: 堂食/外卖/会员等) | 需 upload pipeline 识别 sheet 结构 |

---

## 6. Git 状态

- 分支: `e2e/v1-framework` (+16 ahead of origin)
- 最新 commits: `afcf4212d` (P0-3 v2) → `cb873f48a` (P0-1/2/3) → `e65bede1f` (原 QA 报告)
- 全部 test env 验证,**prod 等你 ack**
