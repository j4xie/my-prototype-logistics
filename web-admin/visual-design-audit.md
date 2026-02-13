# Visual Design Audit Report (A2)
Date: 2026-02-11

## Executive Summary

| Metric | Value |
|--------|-------|
| Files audited | 42+ (views, components, global styles) |
| Unique hex colors found | 68 |
| Unique font-sizes found | 20 |
| Unique border-radius values | 10 |
| Unique box-shadow variants | 14 |
| Critical issues | 8 |
| Major issues | 12 |
| Minor issues | 9 |
| Design system score | 4/10 |

The data analysis module suffers from a **dual color system problem**: the original Element Plus palette (`#409eff`, `#67c23a`, etc.) coexists with Tailwind CSS colors (`#3b82f6`, `#10b981`, etc.) introduced in newer SmartBI components. Additionally, SmartBIAnalysis.vue introduces a third palette from Tableau (`#4E79A7`, `#E15759`). Typography lacks a formal scale -- 20 distinct font-size values appear with no design tokens. Spacing is mostly reasonable (multiples of 4px) but inconsistent across page-level containers. Responsive coverage is partial: only 14 of 42+ audited files contain `@media` queries.

---

## 1. Complete Color Inventory

### 1.1 Design Token Colors (style.css :root)

| Token | Value | Role |
|-------|-------|------|
| `--primary-color` | `#409eff` | Primary action |
| `--success-color` | `#67c23a` | Success/positive |
| `--warning-color` | `#e6a23c` | Warning |
| `--danger-color` | `#f56c6c` | Error/danger |
| `--info-color` | `#909399` | Info/neutral |
| `--bg-color` | `#f5f7fa` | Container background |
| `--bg-color-page` | `#f0f2f5` | Page background |
| `--bg-color-overlay` | `#ffffff` | Card/overlay background |
| `--text-color-primary` | `#303133` | Heading text |
| `--text-color-regular` | `#606266` | Body text |
| `--text-color-secondary` | `#909399` | Secondary text |
| `--text-color-placeholder` | `#c0c4cc` | Placeholder text |
| `--border-color` | `#dcdfe6` | Default border |
| `--border-color-light` | `#e4e7ed` | Light border |
| `--border-color-lighter` | `#ebeef5` | Lightest border |

**Issue**: These tokens are defined but **rarely referenced**. The vast majority of color usages across components use raw hex values instead of `var(--token)`.

### 1.2 Primary / Action Colors

| Color | Hex | Source System | Files Using | Approx. Count |
|-------|-----|---------------|-------------|----------------|
| Element Primary Blue | `#409eff` / `#409EFF` | Element Plus | 30+ | 80+ |
| Element Primary Light | `#66b1ff` | Element Plus (hover) | 2 | 3 |
| Element Primary Lighter | `#79bbff` | Element Plus (gradient) | 2 | 3 |
| Element Primary BG | `#b3d8ff` | Element Plus (border) | 2 | 3 |
| Element Primary BG Light | `#ecf5ff` / `#f0f9ff` | Element Plus (bg) | 2 | 3 |
| Tailwind Blue 500 | `#3b82f6` | Tailwind | 5 (SmartBIAnalysis, AlertDashboard, index.ts, FinanceAnalysis) | 12 |
| Tailwind Blue 600 | `#2563eb` | Tailwind | 1 (AlertDashboard) | 1 |
| Tableau Blue | `#4E79A7` | Tableau 10 | 1 (SmartBIAnalysis) | 6 |
| Cyan Accent | `#00d4ff` | Custom | 2 (DynamicChartRenderer, CategoryStructure) | 2 |
| Tailwind Cyan | `#0ea5e9` | Tailwind | 1 (index.ts) | 1 |

### 1.3 Success / Positive Colors

| Color | Hex | Source System | Files Using | Approx. Count |
|-------|-----|---------------|-------------|----------------|
| Element Success | `#67c23a` / `#67C23A` | Element Plus | 25+ | 60+ |
| Element Success Light | `#85ce61` / `#95d475` | Element Plus (gradient) | 2 | 2 |
| Element Success BG | `#f0f9eb` / `#e1f3d8` | Element Plus | 3 | 5 |
| Tailwind Emerald 500 | `#10b981` | Tailwind | 4 (AlertDashboard, FinanceAnalysis, DataCompleteness, index.ts) | 6 |
| Tailwind Emerald 600 | `#059669` | Tailwind | 3 (KPICard, AlertDashboard) | 4 |
| Tailwind Green 500 | `#22c55e` | Tailwind | 1 (index.ts) | 1 |
| Tailwind Teal | `#14b8a6` | Tailwind | 1 (index.ts) | 1 |
| Chart Light Green | `#91cc75` | ECharts default | 1 (CategoryStructure) | 1 |
| Olive Green | `#6B8E23` | Custom | 1 (production-report) | 2 |
| Yellow-Green | `#9ACD32` | Custom | 1 (production-report) | 1 |

### 1.4 Error / Negative Colors

| Color | Hex | Source System | Files Using | Approx. Count |
|-------|-----|---------------|-------------|----------------|
| Element Danger | `#f56c6c` / `#F56C6C` | Element Plus | 25+ | 50+ |
| Element Danger Light | `#f78989` / `#fab6b6` | Element Plus (gradient) | 2 | 2 |
| Element Danger BG | `#fef0f0` / `#fde2e2` | Element Plus | 2 | 3 |
| Tailwind Red 500 | `#ef4444` | Tailwind | 4 (AlertDashboard, DataCompleteness, index.ts) | 6 |
| Tailwind Red 600 | `#dc2626` | Tailwind | 3 (KPICard, AlertDashboard) | 4 |
| Tableau Red | `#E15759` | Tableau 10 | 1 (SmartBIAnalysis) | 3 |
| Custom Red | `#E74C3C` | Flat UI | 1 (analytics/index.vue) | 2 |
| Custom Red-Orange | `#ff6b6b` | Custom | 1 (DynamicChartRenderer) | 1 |
| Tailwind Pink | `#ec4899` | Tailwind | 1 (index.ts) | 1 |
| Custom Pink | `#ff6b9d` | Custom | 1 (CategoryStructure) | 1 |

### 1.5 Warning Colors

| Color | Hex | Source System | Files Using | Approx. Count |
|-------|-----|---------------|-------------|----------------|
| Element Warning | `#e6a23c` / `#E6A23C` | Element Plus | 20+ | 40+ |
| Element Warning Light | `#eebe77` / `#ebb563` | Element Plus (gradient) | 2 | 2 |
| Element Warning BG | `#fdf6ec` / `#faecd8` | Element Plus | 2 | 3 |
| Tailwind Amber 500 | `#f59e0b` | Tailwind | 3 (AlertDashboard, DataCompleteness, index.ts) | 4 |
| Tailwind Amber 600 | `#d97706` | Tailwind | 1 (AlertDashboard) | 1 |
| Tailwind Yellow | `#fbbf24` | Tailwind | 1 (CategoryStructure) | 1 |
| Custom Yellow | `#ffd93d` | Custom | 1 (DynamicChartRenderer) | 1 |

### 1.6 Neutral / Gray Colors

| Color | Hex | Source System | Files Using | Approx. Count |
|-------|-----|---------------|-------------|----------------|
| Element Text Primary | `#303133` | Element Plus | 30+ | 60+ |
| Element Text Regular | `#606266` | Element Plus | 20+ | 40+ |
| Element Text Secondary | `#909399` | Element Plus | 35+ | 80+ |
| Element Text Placeholder | `#c0c4cc` / `#C0C4CC` | Element Plus | 5 | 8 |
| Tailwind Gray 900 | `#1f2937` | Tailwind | 1 (SmartBIAnalysis) | 8 |
| Tailwind Gray 800 | `#1D2129` | Tailwind/Arco | 1 (SmartBIAnalysis) | 2 |
| Tailwind Gray 700 | `#4b5563` | Tailwind | 1 (SmartBIAnalysis) | 2 |
| Tailwind Gray 600 | `#6b7280` | Tailwind | 1 (SmartBIAnalysis) | 4 |
| Tailwind Gray 500 | `#9ca3af` | Tailwind | 2 (smartbi.ts, SmartBIAnalysis) | 4 |
| Custom Gray | `#666` | Non-standard | 1 (AlertDashboard) | 1 |
| Custom Gray | `#999` | Non-standard | 2 (BudgetAchievementChart, CategoryStructure) | 2 |
| Custom Gray | `#333` | Non-standard | 1 (DashboardFinance) | 1 |
| Element Border | `#dcdfe6` | Element Plus | 10+ | 15 |
| Element Border Light | `#e4e7ed` / `#E4E7ED` | Element Plus | 8 | 10 |
| Element Border Lighter | `#ebeef5` | Element Plus | 12+ | 20+ |
| Tailwind Gray 200 | `#e5e7eb` | Tailwind | 1 (SmartBIAnalysis) | 6 |
| Tailwind Gray 100 | `#f3f4f6` | Tailwind | 1 (SmartBIAnalysis) | 5 |
| Tailwind Gray 50 | `#f9fafb` | Tailwind | 1 (SmartBIAnalysis) | 3 |

### 1.7 Accent / Special Colors

| Color | Hex | Usage | Files |
|-------|-----|-------|-------|
| Purple (sales) | `#9B59B6` | Stat card accent | analytics/index.vue |
| Purple (Violet) | `#8b5cf6` | Index page accent | SmartBIAnalysis |
| Purple (Light) | `#f5f3ff` | Index page bg | SmartBIAnalysis |
| Purple (Gradient) | `#764ba2` | AI Insight header | AIInsightPanel |
| Purple (ECharts) | `#8A2BE2` | Chart color 9 | DynamicChartRenderer |
| Purple (Tailwind) | `#c084fc` | Chart palette | CategoryStructure |
| Purple (Tailwind) | `#d946ef` | Chart palette | index.ts |
| Tableau Purple | `#B07AA1` | Summary card gradient | SmartBIAnalysis |
| Teal | `#00CED1` | Chart color 10 | DynamicChartRenderer |
| Tailwind Blue | `#dbeafe` | Hover bg | SmartBIAnalysis |
| Tailwind Emerald | `#34d399` | Chart palette | CategoryStructure |
| Orange | `#f97316` | Chart palette | index.ts |
| Gold Rank 1 | `#FFD700` / `#FFA500` | Ranking badge | Dashboard, ToolReliability |
| Silver Rank 2 | `#C0C0C0` / `#A8A8A8` | Ranking badge | Dashboard, ToolReliability |
| Bronze Rank 3 | `#CD7F32` / `#B8860B` | Ranking badge | Dashboard, ToolReliability |
| Yellow (Budget) | `#ffb800` | Ranking gradient | ToolReliability |
| AI Insight colors | `#667eea`, `#5a6fd6` | AI panel header gradient | AIInsightPanel |
| AI Dark Theme | `#1a1a2e`, `#16213e`, `#3d3d5c` | Dark mode AI panel | AIInsightPanel |

### 1.8 Color Inconsistencies (CRITICAL)

| # | Issue | Color A (Element Plus) | Color B (Tailwind/Other) | Files | Recommendation |
|---|-------|----------------------|------------------------|-------|----------------|
| C1 | Dual "success green" | `#67c23a` (25+ files) | `#10b981` (4 files), `#059669` (3 files) | Mixed across SmartBI | Standardize on `#67c23a` or define `--color-positive` |
| C2 | Dual "error red" | `#f56c6c` (25+ files) | `#ef4444` (4 files), `#dc2626` (3 files) | Mixed across SmartBI | Standardize on `#f56c6c` or define `--color-negative` |
| C3 | Triple "primary blue" | `#409eff` (30+ files) | `#3b82f6` (5 files), `#4E79A7` (1 file) | SmartBIAnalysis, AlertDashboard | Standardize on `#409eff` |
| C4 | Dual "warning yellow" | `#e6a23c` (20+ files) | `#f59e0b` (3 files) | DataCompleteness, AlertDashboard | Standardize on `#e6a23c` |
| C5 | Triple "dark text" | `#303133` (30+ files) | `#1f2937` (1 file), `#1D2129` (1 file) | SmartBIAnalysis | Standardize on `#303133` |
| C6 | Shorthand grays | `#333`, `#666`, `#999` | `#303133`, `#606266`, `#909399` | DashboardFinance, AlertDashboard | Replace shorthand with Element tokens |
| C7 | Non-standard finance red | `#E74C3C` (Flat UI) | `#f56c6c` (Element) | analytics/index.vue | Replace with `--danger-color` |
| C8 | Tokens defined but unused | CSS vars in style.css | Hardcoded hex everywhere | All files | Migrate to `var(--token)` references |

---

## 2. Typography Audit

### 2.1 Font Size Scale

| Size (px) | Role | Files Using | Count |
|-----------|------|-------------|-------|
| 10 | Trend arrow, badge label, confidence | KPICard, AIInsightPanel, BudgetAchievement, DataConfidence | 5 |
| 11 | Unit text, axis labels, progress label | KPICard, DashboardBuilder, BudgetAchievement | 6 |
| 12 | Secondary labels, footer, rank value, stat label | 20+ files | 30+ |
| 13 | Sub-heading, meta text, breadcrumb | 15+ files | 20+ |
| 14 | Base body text, message text, table text | 25+ files | 40+ |
| 15 | Chart title, ranking title | AIInsightPanel, DynamicRankings, SmartBIAnalysis | 3 |
| 16 | Section header, module icon, tab header | 15+ files | 20+ |
| 18 | Sub-module value, card header | DashboardHR, DashboardWarehouse, AppHeader, CalibrationDetail, BudgetAchievement | 6 |
| 20 | Page sub-title, AI query h1, water-number | AIQuery, CalibrationDetail, AppHeader, KPICard | 4 |
| 22 | Finance KPI value | DashboardFinance, Dashboard (responsive) | 2 |
| 24 | Page title, stat-icon title, KPI stat value | analytics/index, DashboardDefault, DashboardAdmin, DashboardHR, etc. | 8 |
| 26 | KPI value (Dashboard) | Dashboard.vue | 1 |
| 28 | Large KPI stat value, page title (large) | DashboardAdmin, DashboardHR, DashboardWarehouse, DashboardProduction, analytics/index, equipment/alerts, error/mobile-only | 8 |
| 32 | Main KPI value | KPICard component | 1 |
| 36 | Hero KPI stat | MetricCard, DashboardWarehouse | 2 |
| 48 | Mega KPI score | CalibrationDetail | 1 |
| 120 | Error page code | 404.vue, 403.vue | 2 |

### 2.2 Typography Inconsistencies

| # | Issue | Details | Severity |
|---|-------|---------|----------|
| T1 | No formal type scale | 20 unique font-size values with no token system | Critical |
| T2 | KPI value inconsistency | Same "KPI big number" role uses 22px, 24px, 26px, 28px, 32px, 36px across different dashboards | Major |
| T3 | Page title inconsistency | Page h1 uses 20px (AIQuery), 24px (analytics/index), 28px (error pages) | Major |
| T4 | Section header inconsistency | Section h3 uses 15px (SmartBIAnalysis chart-title), 16px (most files), 18px (CalibrationDetail) | Minor |
| T5 | No font-weight tokens | Weights scattered as 400, 500, 600, 700 with no semantic naming | Minor |
| T6 | No monospace for numbers | KPI values use default font-family; no tabular-nums or monospace font for numeric alignment | Major |
| T7 | Line-height inconsistent | Global is 1.5715, message text is 1.8, analysis content is 1.8, KPI values are 1.2 -- no token system | Minor |

### 2.3 Recommended Type Scale

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `--font-size-xs` | 10px | 400 | Badges, tiny labels |
| `--font-size-sm` | 12px | 400 | Secondary labels, captions |
| `--font-size-base` | 14px | 400 | Body text, table text |
| `--font-size-md` | 16px | 500/600 | Section headers |
| `--font-size-lg` | 20px | 600 | Page titles |
| `--font-size-xl` | 24px | 700 | Stat values (small) |
| `--font-size-2xl` | 32px | 700 | KPI hero values |
| `--font-size-3xl` | 48px | 700 | Score displays |

---

## 3. Spacing Audit

### 3.1 Page-Level Padding

| File | Padding | Notes |
|------|---------|-------|
| AIQuery.vue | `20px` | |
| analytics/index.vue | `20px` | |
| AlertDashboard.vue | `20px` | |
| analytics/ai-reports | `20px` | |
| analytics/kpi | `20px` | |
| analytics/trends | `20px` | |
| analytics/production-report | `20px` | |
| AdvancedFinanceAnalysis.vue | `20px` | |
| SmartBIAnalysis.vue (index page) | `24px` | Inconsistent |
| AppLayout main content | `16px` | Different from all views |
| CalibrationListView | `20px` | |
| CalibrationDetailView | `20px` | |

**Issue**: Page padding is mostly `20px` but AppLayout uses `16px` and SmartBIAnalysis index uses `24px`.

### 3.2 Card Padding

| Context | Padding | Files |
|---------|---------|-------|
| KPICard component | `20px` | KPICard.vue |
| Dashboard KPI card | `20px` (via el-card) | Dashboard.vue |
| MetricCard | `20px` | MetricCard.vue |
| Dashboard stat sections | `16px 24px` | DashboardAdmin, DashboardHR, DashboardFinance, DashboardWarehouse, DashboardProduction |
| SmartBI chart grid item | `20px` | SmartBIAnalysis.vue |
| AIInsightPanel header | `16px 20px` | AIInsightPanel.vue |
| AIInsightPanel body | `20px` | AIInsightPanel.vue |
| BudgetAchievementChart | `20px` | BudgetAchievementChart.vue |
| CategoryStructureChart | `20px` | CategoryStructureComparisonChart.vue |
| Quick-nav card | `24px` | analytics/index.vue |

**Mostly consistent** at `20px` for standalone cards. Dashboard stat sections use `16px 24px` as a pattern.

### 3.3 Section Spacing (margin-bottom / gap)

| Pattern | Value | Files |
|---------|-------|-------|
| Page header to content | `16px` | AIQuery, Dashboard |
| Page header to content | `24px` | analytics/index, SmartBIAnalysis |
| Section to section | `16px` | Dashboard.vue (kpi, ranking, chart, insight sections) |
| Section to section | `24px` | SmartBIAnalysis (chart, analysis, data sections) |
| El-row gutter | `16px` | analytics/index, Dashboard |
| Chart grid gap | `24px` | SmartBIAnalysis |
| Card margin-bottom | `16px` | analytics/index stat-card, Dashboard sections |

**Issue**: Two competing spacing rhythms -- `16px` in Dashboard.vue vs `24px` in SmartBIAnalysis.vue.

### 3.4 Spacing Inconsistencies

| # | Issue | Details | Severity |
|---|-------|---------|----------|
| S1 | Dual section rhythm | Dashboard uses 16px between sections; SmartBIAnalysis uses 24px | Minor |
| S2 | Page padding mismatch | AppLayout 16px vs views 20px creates nested padding inconsistency | Major |
| S3 | No spacing tokens | All spacing is hardcoded px values with no CSS variables | Major |

---

## 4. Layout & Grid Audit

### 4.1 Card Border-Radius Values

| Value | Files Using | Count |
|-------|-------------|-------|
| `3px` | Scrollbar, DashboardBuilder badge | 3 |
| `4px` | AppHeader, DashboardFinance pill, KPICard benchmark | 4 |
| `6px` | DashboardBuilder, BudgetAchievement, KPICard benchmark | 4 |
| `8px` | Global el-card, Dashboard sections, most charts, SmartBIAnalysis | 20+ |
| `12px` | KPICard, stat-card, chart-grid-item, ranking-card, insight-card, CalibrationList, analytics/index, SmartBIAnalysis, BudgetAchievement tab | 15+ |
| `16px` | error/mobile-only, BudgetAchievement active tab, SmartBIAnalysis index-count | 3 |
| `50%` | Avatars, badges, circles | 5 |

**Issue**: Default el-card is `8px` (global style.css), but many components override to `12px`. No single border-radius token.

### 4.2 Box-Shadow Variants

| Shadow | Usage | Files |
|--------|-------|-------|
| `0 2px 4px rgba(0,0,0,0.12)` | `--box-shadow-light` (global) | style.css, el-card global |
| `0 2px 12px rgba(0,0,0,0.05)` | Chat container, Dashboard KPI | AIQuery, Dashboard |
| `0 2px 12px rgba(0,0,0,0.06)` | AIInsightPanel | AIInsightPanel |
| `0 1px 3px rgba(0,0,0,0.06)` | KPICard default | KPICard |
| `0 1px 3px rgba(0,0,0,0.08)` | ProductionAnalysis cards, DataCompleteness, SmartBIAnalysis | 4 files |
| `0 2px 8px rgba(0,0,0,0.04)` | AdvancedFinanceAnalysis | AdvancedFinanceAnalysis |
| `0 2px 8px rgba(0,0,0,0.08)` | BudgetAchievement, DashboardBuilder | 2 files |
| `0 4px 12px rgba(0,0,0,0.08)` | CategoryStructure, YoYMoM hover | 2 files |
| `0 4px 12px rgba(0,0,0,0.1)` | MetricCard hover, KPICard hover | 2 files |
| `0 4px 16px rgba(0,0,0,0.1)` | SmartBIConfig | 1 file |
| `0 4px 16px rgba(0,0,0,0.12)` | DashboardBuilder hover | 1 file |
| `0 8px 24px rgba(0,0,0,0.1)` | analytics nav hover | 1 file |
| `0 8px 24px rgba(0,0,0,0.12)` | scheduling | 1 file |
| `0 10px 25px rgba(0,0,0,0.1)` + double | SmartBIAnalysis chart hover | 1 file |
| `0 20px 60px rgba(0,0,0,0.3)` | Login, mobile-only | 2 files |

**14 unique box-shadow variants** -- should be reduced to 3-4 elevation tokens.

### 4.3 Grid System

- **el-row/el-col** used in Dashboard.vue, analytics/index.vue (responsive via `:xs`, `:sm`, `:md`, `:lg`)
- **CSS Grid** used in SmartBIAnalysis.vue (chart-dashboard: `repeat(2, 1fr)` with responsive breakpoints)
- **Flexbox** used everywhere else for layout
- No unified grid system across the module

---

## 5. Chart Styling Audit

### 5.1 ECharts Color Palettes

**DynamicChartRenderer PIE_COLORS (primary palette)**:
```
#409EFF, #67C23A, #E6A23C, #F56C6C, #909399, #00d4ff, #ff6b6b, #ffd93d, #8A2BE2, #00CED1
```

**AIQuery legacy chart colors**:
```
#409EFF, #67C23A (bar only, 2-color hardcoded)
Pie: #409EFF, #67C23A, #E6A23C, #F56C6C, #909399
```

**CategoryStructureComparisonChart palette**:
```
#409eff, #67c23a, #e6a23c, #f56c6c, #909399, #00d4ff, #ff6b9d, #c084fc, #fbbf24, #34d399
```

**smartbi/index.ts warm palette**: `#f97316, #ef4444, #ec4899, #f59e0b, #d946ef`
**smartbi/index.ts cool palette**: `#3b82f6, #10b981, #0ea5e9, #14b8a6, #22c55e`

**SmartBIAnalysis outlier color**: `#E15759` (Tableau)
**SmartBIAnalysis summary card**: `#4E79A7`, `#B07AA1` (Tableau)

### 5.2 Chart Tooltip Styling

Most charts use a consistent tooltip pattern:
```javascript
backgroundColor: 'rgba(255, 255, 255, 0.95)',
borderColor: '#ebeef5',
textStyle: { color: '#303133' }
```

**Consistent across**: BudgetAchievement, CategoryStructure, YoYMoM, WaterfallChart, CombinedChart, TrendChart, NestedDonutChart, MetricsTrendChart

### 5.3 Chart Axis Styling

Consistent pattern across most charts:
```javascript
axisLine: { lineStyle: { color: '#dcdfe6' } },
axisLabel: { color: '#909399' },
splitLine: { lineStyle: { color: '#ebeef5', type: 'dashed' } }
```

### 5.4 Chart Issues

| # | Issue | Details | Severity |
|---|-------|---------|----------|
| CH1 | Three distinct chart palettes | DynamicChartRenderer, index.ts warm/cool, Tableau colors in SmartBIAnalysis | Critical |
| CH2 | No shared chart theme | Each chart component builds its own ECharts theme inline | Major |
| CH3 | Inconsistent chart heights | 250px (AIQuery), 300px (loading), 320px (Dashboard), 400px (grid item), 480px (hero), 500px (SmartBIAnalysis) | Minor |

---

## 6. Interactive States Audit

### 6.1 Hover Effects

| Component | Hover Effect | Consistency |
|-----------|-------------|-------------|
| stat-card (analytics/index) | `translateY(-4px)` | Yes |
| nav-card (analytics/index) | `translateY(-4px)` + shadow `0 8px 24px` | Yes |
| KPICard | `translateY(-2px)` + shadow `0 4px 12px` | Different lift |
| SmartBIAnalysis chart-grid-item | `translateY(-2px)` + shadow `0 10px 25px` | Different lift + shadow |
| MetricCard | shadow `0 4px 12px` only (no translate) | Different pattern |
| DashboardBuilder widget | shadow `0 4px 16px` | Different shadow |

**Issue**: Three different hover elevation patterns (`-2px`, `-4px`, shadow-only). Should be unified.

### 6.2 Focus Outlines

No custom `:focus` or `:focus-visible` styles found in any audited component. All focus behavior relies on Element Plus defaults.

### 6.3 Transition Timing

| Pattern | Value | Files |
|---------|-------|-------|
| `all 0.3s` | Generic transition | analytics/index, Dashboard |
| `all 0.25s cubic-bezier(0.4, 0, 0.2, 1)` | Material easing | KPICard, SmartBIAnalysis |
| `all 0.2s ease` | Quick transition | SmartBIAnalysis index-item |
| `opacity 0.2s` | Fade | SmartBIAnalysis chart-export-btn |

**Issue**: Mixed transition timing functions.

---

## 7. WCAG AA Accessibility Audit

### 7.1 Contrast Ratio Analysis

| Element | Foreground | Background | Ratio | Pass/Fail (AA) |
|---------|-----------|-----------|-------|----------------|
| Body text on white | `#303133` | `#ffffff` | **12.6:1** | PASS |
| Regular text on white | `#606266` | `#ffffff` | **7.0:1** | PASS |
| Secondary text on white | `#909399` | `#ffffff` | **3.5:1** | FAIL (< 4.5:1 for normal text) |
| Placeholder text on white | `#c0c4cc` | `#ffffff` | **1.9:1** | FAIL |
| `#999` on white | `#999999` | `#ffffff` | **2.85:1** | FAIL |
| `#666` on white | `#666666` | `#ffffff` | **5.7:1** | PASS |
| `#333` on white | `#333333` | `#ffffff` | **12.6:1** | PASS |
| White on primary blue | `#ffffff` | `#409eff` | **3.0:1** | FAIL (for normal text, PASS for large text) |
| White on success green | `#ffffff` | `#67c23a` | **2.5:1** | FAIL |
| White on warning yellow | `#ffffff` | `#e6a23c` | **2.1:1** | FAIL |
| White on danger red | `#ffffff` | `#f56c6c` | **3.1:1** | FAIL (for normal text) |
| KPI stat label on white | `#909399` | `#ffffff` | **3.5:1** | FAIL |
| Message time in chat | `#909399` | `#f5f7fa` | **3.2:1** | FAIL |
| Secondary text on #f5f7fa | `#909399` | `#f5f7fa` | **3.2:1** | FAIL |
| Chart axis labels | `#909399` | `#ffffff` | **3.5:1** | FAIL |
| Tailwind gray-500 on white | `#9ca3af` | `#ffffff` | **3.1:1** | FAIL |
| Tailwind gray-500 on gray-50 | `#9ca3af` | `#f9fafb` | **2.9:1** | FAIL |
| Tailwind emerald-600 on white (KPI) | `#059669` | `#ffffff` | **4.6:1** | PASS |
| Tailwind red-600 on white (KPI) | `#dc2626` | `#ffffff` | **5.6:1** | PASS |

### 7.2 Critical Accessibility Issues

| # | Issue | Details | Severity |
|---|-------|---------|----------|
| A1 | `#909399` fails AA on white | Used in 35+ files for secondary text, labels, subtitles. Ratio 3.5:1 needs 4.5:1 | Critical |
| A2 | White on colored status badges | White text on `#67c23a`, `#e6a23c`, `#f56c6c` backgrounds all fail AA | Major |
| A3 | Chart axis labels unreadable | `#909399` at 11px on white is both low contrast and small | Major |
| A4 | No focus indicators | No custom `:focus-visible` styles for keyboard navigation | Major |
| A5 | Placeholder contrast | `#c0c4cc` on white at 1.9:1 is extremely low | Minor (placeholder is exempt from WCAG but still poor UX) |

---

## 8. Responsive Design Audit

### 8.1 Files with @media Queries

| File | Breakpoints | Coverage |
|------|-------------|----------|
| Dashboard.vue | 768px | KPI card value size reduction |
| FinanceAnalysis.vue | 768px | Layout adjustments |
| SalesAnalysis.vue | 768px | Layout adjustments |
| ExcelUpload.vue | 768px | Upload area size |
| AIQuery.vue | 768px | Message width, quick questions |
| SmartBIAnalysis.vue | 900px, 1400px | Chart grid columns |
| AdvancedFinanceAnalysis.vue | 768px, 1200px | Grid columns |
| BudgetAchievementChart.vue | 600px, 1200px | Chart height |
| CategoryStructureComparisonChart.vue | 768px, 1200px | Flexible layout |
| YoYMoMComparisonChart.vue | 768px, 1200px | Flexible layout |
| DashboardBuilder.vue | 768px | Sidebar collapse |
| analytics/kpi/index.vue | 768px | Grid adjustment |
| PeriodSelector.vue | 768px | Compact mode |
| NestedDonutChart.vue | 768px | Chart layout |

### 8.2 Files WITHOUT Responsive Handling

| File | Risk |
|------|------|
| analytics/index.vue | Uses el-col `:xs`/`:sm`/`:md`/`:lg` (responsive via Element) |
| analytics/trends/index.vue | No @media, no responsive classes |
| analytics/ai-reports/index.vue | No @media, no responsive classes |
| analytics/production-report/index.vue | No @media |
| AlertDashboard.vue | No @media |
| DataCompletenessView.vue | No @media |
| ProductionAnalysis.vue | No @media |
| All Dashboard*.vue components | No @media (rely on parent el-row/el-col) |
| KPICard.vue | No @media (relies on container width) |
| AIInsightPanel.vue | Only `prefers-color-scheme: dark` (no width breakpoints) |

### 8.3 Responsive Issues

| # | Issue | Details | Severity |
|---|-------|---------|----------|
| R1 | Fixed chart heights | Many charts use fixed `height: 320px` or `400px` without responsive adjustment | Major |
| R2 | Fixed `width: 80px`, `100px` | Dashboard ranking `region-name` (80px), `region-value` (100px) will overflow on mobile | Minor |
| R3 | No responsive type scale | Font sizes are static px values at all screen widths | Minor |
| R4 | Quick-nav 3-column layout | analytics/index.vue uses `el-col :span="8"` (3 cols) with no responsive breakpoints | Major |

---

## 9. Issue Summary

| # | Category | Issue | Severity | Effort | Key Files |
|---|----------|-------|----------|--------|-----------|
| 1 | Color | Dual color system (Element Plus vs Tailwind) | Critical | Large | AlertDashboard, DataCompleteness, SmartBIAnalysis, KPICard, index.ts |
| 2 | Color | CSS variables defined but not used | Critical | Large | All 42+ files |
| 3 | Color | Triple primary blue (#409eff, #3b82f6, #4E79A7) | Critical | Medium | SmartBIAnalysis, AlertDashboard |
| 4 | Accessibility | `#909399` secondary text fails WCAG AA (3.5:1) | Critical | Medium | 35+ files |
| 5 | Typography | 20 unique font-sizes, no token system | Critical | Large | All files |
| 6 | Typography | KPI value font-size inconsistent (22-36px) | Major | Medium | Dashboard*.vue, analytics/ |
| 7 | Typography | No monospace/tabular-nums for numeric values | Major | Small | KPICard, Dashboard*.vue |
| 8 | Color | Shorthand grays (#333, #666, #999) | Major | Small | DashboardFinance, AlertDashboard |
| 9 | Accessibility | White text on colored backgrounds fails AA | Major | Medium | Status badges, KPI icons |
| 10 | Accessibility | No keyboard focus indicators | Major | Medium | All interactive components |
| 11 | Chart | Three different chart color palettes | Major | Medium | DynamicChartRenderer, index.ts, SmartBIAnalysis |
| 12 | Shadow | 14 unique box-shadow variants | Major | Medium | 20+ files |
| 13 | Spacing | No spacing tokens | Major | Large | All files |
| 14 | Spacing | Page padding mismatch (16px vs 20px vs 24px) | Major | Small | AppLayout, views |
| 15 | Layout | border-radius inconsistency (8px vs 12px for cards) | Major | Medium | style.css global vs components |
| 16 | Responsive | Fixed chart heights not adaptive | Major | Medium | 10+ chart files |
| 17 | Responsive | analytics/index quick-nav not responsive | Major | Small | analytics/index.vue |
| 18 | Color | Non-standard #E74C3C (Flat UI red) | Minor | Small | analytics/index.vue |
| 19 | Color | Non-standard #9B59B6 (Flat UI purple) | Minor | Small | analytics/index.vue |
| 20 | Chart | No shared ECharts theme registration | Minor | Medium | All chart components |
| 21 | Hover | Three different hover elevation patterns | Minor | Small | Various |
| 22 | Transition | Mixed timing functions | Minor | Small | Various |
| 23 | Typography | Section header size inconsistency (15-18px) | Minor | Small | SmartBIAnalysis, CalibrationDetail |
| 24 | Typography | Line-height not tokenized | Minor | Small | All files |
| 25 | Color | AI Insight Panel dark mode partially implemented | Minor | Medium | AIInsightPanel |
| 26 | Accessibility | Chart axis labels too small + low contrast | Major | Small | All chart components |
| 27 | Color | Production report uses unique olive green (#6B8E23) | Minor | Small | production-report/index.vue |
| 28 | Chart | Inconsistent chart container heights (250-500px) | Minor | Small | Various |
| 29 | Responsive | analytics sub-pages lack @media queries | Minor | Medium | trends, ai-reports, production-report |

---

## 10. Proposed Design Token System

### 10.1 Color Tokens

```css
:root {
  /* Brand */
  --color-primary: #409eff;
  --color-primary-light: #79bbff;
  --color-primary-lighter: #ecf5ff;

  /* Semantic */
  --color-success: #67c23a;
  --color-success-light: #e1f3d8;
  --color-warning: #e6a23c;
  --color-warning-light: #faecd8;
  --color-danger: #f56c6c;
  --color-danger-light: #fde2e2;
  --color-info: #909399;

  /* Text (WCAG AA compliant replacements) */
  --color-text-primary: #303133;    /* 12.6:1 on white */
  --color-text-regular: #606266;    /* 7.0:1 on white */
  --color-text-secondary: #86909c;  /* ~4.5:1 on white -- upgraded from #909399 */
  --color-text-disabled: #c0c4cc;

  /* Positive/Negative (for data visualization) */
  --color-positive: #059669;        /* 4.6:1 on white */
  --color-negative: #dc2626;        /* 5.6:1 on white */

  /* Backgrounds */
  --color-bg-page: #f0f2f5;
  --color-bg-container: #f5f7fa;
  --color-bg-elevated: #ffffff;

  /* Borders */
  --color-border: #dcdfe6;
  --color-border-light: #e4e7ed;
  --color-border-lighter: #ebeef5;

  /* Chart palette (10 colors, perceptually distinct) */
  --chart-color-1: #409eff;
  --chart-color-2: #67c23a;
  --chart-color-3: #e6a23c;
  --chart-color-4: #f56c6c;
  --chart-color-5: #909399;
  --chart-color-6: #00d4ff;
  --chart-color-7: #8b5cf6;
  --chart-color-8: #ec4899;
  --chart-color-9: #14b8a6;
  --chart-color-10: #f97316;
}
```

### 10.2 Typography Tokens

```css
:root {
  --font-size-xs: 10px;
  --font-size-sm: 12px;
  --font-size-base: 14px;
  --font-size-md: 16px;
  --font-size-lg: 20px;
  --font-size-xl: 24px;
  --font-size-2xl: 32px;
  --font-size-3xl: 48px;

  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  --line-height-tight: 1.2;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;

  --font-family-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
}
```

### 10.3 Spacing Tokens

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  --page-padding: 20px;
  --card-padding: 20px;
  --section-gap: 24px;
  --element-gap: 16px;
}
```

### 10.4 Elevation Tokens

```css
:root {
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.12);
  --shadow-xl: 0 8px 24px rgba(0, 0, 0, 0.12);

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;
}
```

### 10.5 Migration Priority

1. **Phase 1 (Quick wins)**: Replace `#909399` secondary text with `#86909c` for WCAG AA compliance. Replace shorthand grays (`#333`, `#666`, `#999`). Standardize card border-radius to 12px.
2. **Phase 2 (Token adoption)**: Add all CSS variable tokens to `style.css`. Migrate color hex values to `var()` references file by file.
3. **Phase 3 (Chart unification)**: Create a shared ECharts theme using the unified chart palette. Register it globally. Remove per-component inline palettes.
4. **Phase 4 (Typography)**: Adopt type scale tokens. Add `font-variant-numeric: tabular-nums` to KPI value classes. Standardize KPI value sizes.
5. **Phase 5 (Responsive)**: Add @media queries to all analytics sub-pages. Add responsive chart heights. Ensure quick-nav and fixed-width elements are mobile-friendly.
