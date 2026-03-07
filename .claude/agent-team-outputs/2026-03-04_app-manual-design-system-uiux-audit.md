# App 操作手册设计系统 + UI/UX 深度评审

**日期**: 2026-03-04
**评审对象**: `platform/app-manual/index.html` (1875 行)
**模式**: Full | Codebase Grounding: ENABLED

---

## Executive Summary

操作手册整体视觉完成度较高（深色科技风、角色色彩编码、timeline/step-grid 双布局），但存在三类系统性缺陷:

1. **CSS 设计令牌缺失**: FA/WM 角色颜色靠 10 处 inline style 硬编码，10 种 border-radius 无变量
2. **响应式断点不足**: 仅 3 个断点 (900/768/480px)，无大屏/超窄屏，flow-arrow 窄屏断裂被 overflow-x:hidden 掩盖
3. **可访问性严重不足**: Lightbox 无 focus trap/ARIA，29/43 phone-frame 无 aria-label，3 类 badge 对比度 < WCAG AA 4.5:1

---

## 优先级修复清单

### P0 — 立即修复 (约 1 小时)

| # | 问题 | 修复方案 | 预估时间 |
|---|------|---------|---------|
| 1 | `.flow-icon.fa` CSS class 缺失，10 处 inline style | 新增 `.flow-icon.fa` + `.flow-icon.wm` (仓储章节)，删除 inline style | 15 min |
| 2 | FA 颜色 `#fb923c` 未注册 CSS 变量 | 新增 `--accent-fa: #fb923c` 并更新所有引用 | 5 min |
| 3 | 29 个 phone-frame 缺少 `aria-label` | Ch01-03 全部补齐，格式参照 Ch04 | 20 min |
| 4 | Lightbox 缺少 `role="dialog"` + `aria-modal` | HTML 添加属性 + JS 添加 `.focus()` | 10 min |
| 5 | 无 `prefers-reduced-motion` 保护 | 添加 media query 关闭所有动画 | 10 min |

### P1 — 本周修复 (约 1.5 小时)

| # | 问题 | 修复方案 |
|---|------|---------|
| 6 | badge 对比度不足 (dispatcher/supervisor/factory-admin) | 色阶提升至 -300 系列: `#93c5fd`/`#c4b5fd`/`#fdba74` |
| 7 | phone-frame Space 键未支持 | onkeydown 补充 `event.key===' '` |
| 8 | nav-toggle 缺少 `aria-expanded` | JS 动态更新 |
| 9 | flow-arrow 窄屏断裂 | ≤480px 隐藏箭头，flow-node 改竖排 |
| 10 | border-radius 10 种值碎片化 | 归并为 4 档变量: `--radius-sm/md/lg/xl` |
| 11 | timeline-title/step-title 重复 CSS | 合并为联合选择器 |
| 12 | Lightbox 添加 focus trap | JS 实现 Tab 循环锁定 |

### P2 — 中期改善

| # | 问题 | 修复方案 |
|---|------|---------|
| 13 | Ch03 进销存 5 步复用 fa-psi-grid.png | 补拍各子模块独立截图 |
| 14 | 添加 375px/1440px 断点 | 超窄屏 timeline 调整 + 大屏 section 扩宽 |
| 15 | step-card.reverse 移动端翻转失效 | ≤900px 改为 column-reverse 保留节奏 |

---

## 详细发现 (按维度)

### 1. 视觉一致性

- **F-01** [高]: `.flow-icon` 层缺少 `.fa` CSS class，Ch03 进销存 + Ch04 仓储 flow-chart 全部使用 inline style (L1233-1253, L1509-1529)
- **F-02** [高]: FA 颜色 `#fb923c` 是唯一未注册为 CSS 变量的角色颜色
- **F-07** [中]: 10 种 border-radius (4/6/8/10/12/16/18/20/28px) 无变量统一
- **F-10** [中]: 20+ 处 inline style，其中 10 处为 flow-icon 颜色
- **F-06** [低]: timeline-title 与 step-title 定义完全重复可合并

### 2. 响应式布局

- **B-01** [中]: 仅 3 个断点 (900/768/480px)，无 1440px 大屏优化
- **B-02** [高]: flow-arrow 与 flow-node 同级 flex-wrap，窄屏箭头出现行首/行尾
- **B-03** [高]: step-card.reverse ≤900px 被强制 column，交替节奏消失
- **B-04** [高]: 5 张截图 step-phones 在 900px 布局 4+1 不对称
- **B-05** [中]: `overflow-x: hidden` 掩盖真实溢出
- **B-06** [中]: 375px timeline 数字圆圈贴边

### 3. 交互体验 + 可访问性

- **C-01** [高]: Lightbox 无焦点陷阱
- **C-02** [高]: Lightbox 缺少 `role="dialog"` + `aria-modal="true"`
- **C-03** [高]: 43 个 phone-frame 中 29 个 (67.4%) 缺少 `aria-label`
- **C-04** [高]: 5 种动画无 `prefers-reduced-motion` 保护
- **C-05** [高]: dispatcher/supervisor/factory-admin badge 对比度 ~3.0-3.4:1 < AA 4.5:1
- **C-06** [中]: phone-frame onkeydown 仅 Enter，未支持 Space
- **C-07** [中]: nav-toggle 无 aria-expanded 状态同步

### 4. 信息层次

- **A-03** [中]: 10-14px 范围 5 档字号区分度不足
- **A-04** [中]: timeline-content padding 24px vs step-card 32px 内部密度不一致
- **A-09** [低]: section-label (11px) → section-title (clamp 1.6-2.2rem) 跳跃大

### 5. 截图展示

- **A-05** [高]: Ch03 进销存 fa-psi-grid.png 出现 5 次，6 步仅 2 张独立截图
- **B-08** [低]: phone-frame.large 缩减比例不一致 (large 33% vs 普通 28%)

---

## 评分

| 维度 | 得分 | 说明 |
|------|------|------|
| 视觉一致性 | 6/10 | DP/WS 体系完整，FA/WM 临时补丁 |
| 响应式布局 | 5/10 | 桌面良好，移动端多处问题 |
| 交互体验 | 4/10 | Lightbox 可访问性归零 |
| 信息层次 | 7/10 | 三级标题梯度合理，小字号区间拥挤 |
| 截图展示 | 5/10 | Ch01/02/04 良好，Ch03 严重复用 |
| **综合** | **5.4/10** | |

---

### Process Note
- Mode: Full
- Researchers deployed: 3 + 1 browser (partial)
- Browser explorer: ON (tools unavailable, partial)
- Total findings: 24 (all ★★★★★ codebase evidence)
- Phases completed: Research + Browser → Analysis → Critique (code verified) → Heal
- Healer: All structural checks passed
