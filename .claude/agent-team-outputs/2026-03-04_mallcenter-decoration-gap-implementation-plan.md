# MallCenter 装修系统缺口实施计划

**日期**: 2026-03-04
**模式**: Full | 中文 | Codebase Grounding + Competitor Analysis

---

## 执行摘要

MallCenter 装修系统已完成约 65% 的核心功能，存在 7 个缺口。经代码验证，**G1 模块重排后端已完整实现（70-80% 完成），G4 店铺信息持久化被高估（实际仅 30-40%）**。推荐 Strategy B（3 周 6 项），按修正后优先级排列：Sprint 1 做 G3+G1（快速收益），Sprint 2 做 G4+G2（核心能力），Sprint 3 做 G5+G6（增值功能），G7 版本历史作为条件性任务。

---

## 共识与分歧图

| 缺口 | 研究员 A | 可行性 C | 分析师 | 评审 | **最终判定** |
|------|---------|---------|--------|------|------------|
| G1 完成度 | 后端完整 | 前端需补 | 30% | **70-80%** | **70-80%** ✅ reorderModules() L2332 完整 |
| G3 togglePreview bug | toggle 行为 | 需 refreshPreview | 0.5d | 确认 bug | **确认** ✅ L483-487 先检查关闭 |
| G4 完成度 | 无持久化 | 需 API 调用 | 60% | **30-40%** | **30-40%** ✅ L1620 update_info 无处理 |
| G5 实现方式 | — | 直接 API | Storage 桥接 | 直接 API | **直接 API** ✅ 避免 10MB 限制 |
| G6 模板数量 | 4 个 | 4 个 | 3 个 | 4 个 | **4 个** ✅ L2014-2036 确认 |
| Sprint 顺序 | — | — | G3+G4→G1+G2 | **G3+G1→G4+G2** | **G3+G1→G4+G2** ✅ G1 仅 1d |

---

## 最终置信度

| 缺口 | 工作量 | 置信度 | 依据 |
|------|--------|--------|------|
| G1 模块重排 | **1 天** | ★★★★★ | 后端完整，仅需前端 + prompt 注入 |
| G2 模块属性编辑 | **3-4 天** | ★★★★☆ | 按模块类型独立编辑组件 |
| G3 预览刷新 | **0.5 天** | ★★★★★ | 明确 bug，新建 refreshPreview() |
| G4 店铺信息 | **2-3 天** | ★★★★☆ | 后端持久化 + 前端消费 |
| G5 AI 生图 | **3-4 天** | ★★★☆☆ | API 稳定性是主要风险 |
| G6 扩展模板 | **2-3 天** | ★★★★☆ | 4→5 个模板 + DB 迁移 |
| G7 版本历史 | **4-5 天** | ★★★☆☆ | 全新功能，条件性执行 |

---

## 修正后 Sprint 计划

### Sprint 1（1.5 天）— 速赢

**G3 — 修复预览刷新**
- 文件：`decoration-chat/index.js`
- 问题：`togglePreview()` L483-487 检查 `showPreview` 为 true 时关闭面板
- 方案：新增 `refreshPreview()` 方法，无条件重新加载并显示

```javascript
async refreshPreview() {
  wx.showLoading({ title: '刷新预览...' })
  try {
    const res = await api.getDecorationConfig('home')
    wx.hideLoading()
    if (res.data) {
      let modules = (res.data.modules || []).sort((a, b) => (a.order || 0) - (b.order || 0))
      const theme = res.data.theme || {}
      const vars = []
      if (theme.primaryColor) vars.push('--preview-primary:' + theme.primaryColor)
      if (theme.backgroundColor) vars.push('--preview-bg:' + theme.backgroundColor)
      this.setData({ showPreview: true, previewModules: modules, previewCssVars: vars.join(';') })
    }
  } catch (e) { wx.hideLoading(); wx.showToast({ title: '刷新失败', icon: 'none' }) }
}
```

- 在 askQuestion 回调成功后调用 `this.refreshPreview()`

**G1 — 补全前端 Chat 重排**
- 后端已完整（`DecorationAiServiceImpl.java` L2332-2356）
- 前端：识别 `reorder_modules` 动作 → 调用 `refreshPreview()`
- **关键**：CHAT_SYSTEM_PROMPT 需动态注入当前模块列表，否则 LLM 无法生成正确排序

### Sprint 2（5-7 天）— 核心能力

**G4 — 店铺信息持久化**（2-3 天）
- 后端：`handleChatAction` L1619-1621 `update_info` case 新增持久化逻辑
- 前端：消费返回的 shopName/slogan 字段，在 chat 中展示确认

**G2 — 模块属性编辑扩展**（3-4 天）
- 扩展 `editableTypes` 从 2 种到 5+ 种
- 优先：banner（轮播配置）、product_grid（列数/显示选项）、coupon（样式）
- 方案：每种模块一个条件渲染编辑表单（`wx:if` 按 moduleType）

### Sprint 3（5-7 天）— 增值功能

**G5 — AI 生图集成**（3-4 天，条件：API 稳定性验证通过）
- 方案：decoration-chat 直接调用后端 API（复用 shop-design 的 generateAiImage 框架）
- 不用 Storage 桥接（避免 10MB 限制和竞态风险）

**G6 — 扩展模板**（2-3 天）
- 现有 4 个模板，新增 1 个行业模板
- DB migration 添加 template 持久化

### Sprint 4（4-5 天）— 条件性

**G7 — 版本历史**
- 新建 `merchant_page_config_version` 表
- 每次保存自动快照，保留最近 20 个版本
- 版本列表 + 一键回滚 API

---

## 策略选择

| 策略 | 范围 | 工时 | 适用场景 |
|------|------|------|---------|
| A 最小 | G3+G1 | 1.5 天 | Demo/快速上线 |
| B 标准 | G3+G1+G4+G2+G5+G6 | ~15 天 / 3 周 | 正式产品迭代 |
| C 全量 | 全部 7 项 | ~20 天 / 4 周 | 完整交付 |

---

## 关键风险

| 风险 | 概率 | 缓解 |
|------|------|------|
| LLM 排序指令不准确（无当前模块上下文） | 高 60% | 动态注入模块列表到 prompt |
| togglePreview 直接调用关闭面板 | 高 90% | 新建 refreshPreview() |
| update_info 看似生效实则未持久化 | 高 80% | 补全 handleChatAction 持久化 |
| AI 生图 API 超时/额度耗尽 | 中 40% | 降级为推荐图片库 |

---

## 开放问题

1. CHAT_SYSTEM_PROMPT 动态上下文注入方式：拼接 vs function calling？
2. shop-design 与 decoration-chat 功能重叠如何统一？
3. AI 生图 API 选型确认（通义万相/Midjourney/其他）
4. G7 版本回滚粒度：整页 vs 单模块？
5. 第 5 个模板应面向哪个细分行业？

---

## Process Note
- Mode: Full
- Researchers deployed: 3 (codebase, competitors, feasibility)
- Total sources: ~18 (12 codebase, 6 external)
- Key disagreements: 3 resolved
- Phases: Research → Analysis → Critique → Integration → Heal
- Healer: All checks passed ✅
- Competitor profiles: 3 (有赞, 微盟, Shopify)
