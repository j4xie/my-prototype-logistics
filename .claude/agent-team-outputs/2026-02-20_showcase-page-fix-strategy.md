# 展示页面低优先级问题处理策略

**日期**: 2026-02-20
**研究主题**: 评估剩余3个低优先级展示页面问题的最佳处理策略

## 执行摘要

团队评估了3个低优先级展示页面问题：(1) client-request-example 设计不一致、(2) 子目录页面字体差异、(3) V3页面占位链接。经代码验证，ai-architecture/correction/ai-intent 已采用 Design System V4/V5，与 V3 配色完全一致（accent #C45C26）；占位链接确认存在于5个V3页面共30处。综合投入产出分析，建议仅修复占位链接（采用tooltip方案，30分钟），其余两项暂不处理。

## 最终建议

### 立即执行（30分钟）

**修复V3页面30处占位链接**

将 `href="#"` 替换为 `javascript:void(0)` + `title="即将上线"`：

```html
<!-- 原始 -->
<a href="#" class="footer-link">文档中心</a>

<!-- 修改为 -->
<a href="javascript:void(0)" class="footer-link" title="即将上线">文档中心</a>
```

涉及文件：index-v3.html, ai-bi-v3.html, ai-calibration-v3.html, ai-scheduling-v3.html, dashboard-v3.html

此方案优于删除链接：保持footer六列布局视觉完整，同时消除点击后跳到页顶的不专业体验。

### 不做

| 项目 | 理由 | 置信度 |
|------|------|--------|
| client-request-example 重设计 | 操作指南页面，设计独立合理（类似 Stripe Docs vs Stripe.com） | 80% |
| 5页面字体升级 Inter→Lexend | V4/V5 是 V3 的自然演进，强行降级到 V3 字体反而不合理 | 95% |

## 对比矩阵

| 维度 | Task 3 占位链接 | Task 1 重设计 | Task 2 字体 | 不做 |
|------|----------------|---------------|-------------|------|
| 工作量 | 30分钟 | 6-10小时 | 3-5小时 | 0 |
| 用户感知 | 中(5/10) | 低(2/10) | 极低(1/10) | 0 |
| 品牌影响 | 中高(6/10) | 低中(3/10) | 低(2/10) | 负面 |
| 演示风险 | 高 | 低 | 极低 | 高 |
| ROI | 3-4 | 0.3 | 0.4 | - |

## 代码验证结果

| 声明 | 验证结果 |
|------|----------|
| 30处占位链接 | ✅ 精确确认，5文件×6处 |
| ai-architecture/correction配色接近V3 | ✅ accent #C45C26 完全一致 |
| client-request-example有复杂业务功能 | ⚠️ 部分正确，"动态API数据看板"被夸大 |
| V4/V5标记暗示设计演进 | ✅ ai-architecture=V5, correction=V4, ai-intent=V4 |

## 开放问题

1. V3 vs V4/V5 长期走向？设计系统演进方向会影响所有统一化决策
2. 6个占位链接是否有实际内容规划？tooltip是长期方案还是临时方案？
3. client-request-example 是否有外部发送客户场景？需与销售团队确认

---

### Process Note
- Mode: Full
- Researchers deployed: 3
- Total sources found: 24 (8 per researcher)
- Key disagreements: 2 resolved (Task 3 ROI, Task 1 必要性), 1 unresolved (V3/V5 长期方向)
- Phases completed: Research → Analysis → Critique → Integration
- Fact-check: skipped (codebase-grounded findings, no external claims)
- Competitor profiles: N/A
