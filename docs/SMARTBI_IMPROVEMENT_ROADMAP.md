# SmartBI 行业对标改进路线图

**当前评分**: 40% (22/55 分)
**目标评分**: 53% (Metabase 水平, 29/55 分)
**差距**: 7 分 (约 2-3 周开发量)

---

## 📊 当前评分明细 (2026-02-12)

| 维度 | 当前分数 | Metabase | 差距 | 说明 |
|------|---------|----------|------|------|
| 数据接入 | 1/5 | 4/5 | -3 | 仅支持 Excel 上传 |
| 图表丰富度 | 3/5 | 3.5/5 | -0.5 | 6 种图表,缺少桑基图/漏斗 |
| AI/ML 能力 | 3/5 | 2/5 | +1 | LLM 分析优于 Metabase |
| 仪表盘构建 | 2.5/5 | 4/5 | -1.5 | 有拖拽,但体验粗糙 |
| 自助查询 | 3/5 | 4/5 | -1 | 有模板,缺少可视化查询构建器 |
| 协作能力 | 2/5 | 3.5/5 | -1.5 | 有分享链接,缺少评论/订阅 |
| 导出能力 | 3.5/5 | 3/5 | +0.5 | Excel+PDF 优于 Metabase |
| 移动端 | 1/5 | 3/5 | -2 | RN 应用存在但未适配 BI |
| 实时数据 | 0/5 | 2/5 | -2 | 无数据刷新机制 |
| 企业安全 | 1/5 | 3.5/5 | -2.5 | 无 RBAC/审计日志 |
| 交互过滤 | 2/5 | 3.5/5 | -1.5 | 单维度过滤,无联动 |

---

## 🚀 Top 5 快速见效项 (< 2 天/项)

### Q1. 图表联动过滤 (Interactive Cross-Filtering)
**影响维度**: 交互过滤 +1.5 分, 仪表盘构建 +0.5 分
**ROI**: ★★★★★
**工作量**: 1.5 天

**现状问题**:
- 现有 `dimensionFilter` 是全局下拉框,需要手动选择
- 图表之间无法联动: 点击柱状图某省份 → 其他图表不会自动过滤
- Metabase/Tableau 标配功能,缺失会显著降低感知质量

**实现方案**:
```typescript
// 1. 在 SmartBIAnalysis.vue 添加全局过滤状态
const activeFilters = ref<Map<string, Set<string>>>(new Map());

// 2. 修改 handleChartDrillDown 支持过滤模式
function enableFilterMode(chart: ChartResult) {
  // 点击图表元素 → 添加到 activeFilters
  const { dimension, value } = clickedDataPoint;
  if (!activeFilters.value.has(dimension)) {
    activeFilters.value.set(dimension, new Set());
  }
  activeFilters.value.get(dimension).add(value);

  // 触发其他图表重新渲染 (传入 filters)
  enrichedResults.value.forEach(result => {
    const filteredData = applyFilters(result.rawData, activeFilters.value);
    rerenderChart(result.charts, filteredData);
  });
}

// 3. 添加过滤器面包屑组件
<div class="active-filters-bar">
  <el-tag
    v-for="[dim, vals] in activeFilters"
    closable
    @close="removeFilter(dim)"
  >
    {{ dim }}: {{ Array.from(vals).join(', ') }}
  </el-tag>
  <el-button @click="clearAllFilters" text>清除全部</el-button>
</div>
```

**技术要点**:
- ECharts `params.seriesName + params.name` 提取维度值
- 修改 `batchBuildCharts()` 接受 `filters` 参数
- 添加 "进入过滤模式" 按钮 (切换 drilldown 行为)

**文件改动**:
- `web-admin/src/views/smart-bi/SmartBIAnalysis.vue` (+120 行)
- `web-admin/src/api/smartbi.ts` (新增 `applyFilters()` 工具函数)

---

### Q2. 数据自动刷新 (Real-time Data Refresh)
**影响维度**: 实时数据 +2 分
**ROI**: ★★★★☆
**工作量**: 1 天

**现状问题**:
- 上传后数据永久缓存,无刷新机制
- 工厂实时生产数据场景: 每天凌晨生成新报表 → 需要重新上传
- 缺少 "刷新" 按钮 + 自动刷新配置

**实现方案**:
```typescript
// 1. 添加刷新按钮 (header-actions)
<el-button @click="refreshCurrentSheet" :loading="refreshing">
  <el-icon><Refresh /></el-icon>
  刷新数据
</el-button>

// 2. 后端支持 uploadId 覆盖上传
async function refreshCurrentSheet() {
  const currentUpload = uploadBatches.value[selectedBatchIndex.value];
  // 重用 uploadId,清除旧 cache,重新分析
  await uploadBatchStreamSSE(currentFile, {
    reuseUploadId: currentUpload.uploadId,
    overwrite: true
  });
}

// 3. 自动刷新配置 (可选)
<el-dropdown>
  <span>自动刷新: {{ autoRefreshInterval }}</span>
  <template #dropdown>
    <el-dropdown-item @click="setAutoRefresh(0)">关闭</el-dropdown-item>
    <el-dropdown-item @click="setAutoRefresh(60)">1 分钟</el-dropdown-item>
    <el-dropdown-item @click="setAutoRefresh(300)">5 分钟</el-dropdown-item>
  </template>
</el-dropdown>
```

**技术要点**:
- Java `SmartBIUploadController` 新增 `overwrite` 参数
- PostgreSQL: `DELETE FROM smart_bi_dynamic_data WHERE upload_id = ?` before insert
- 前端: `setInterval()` 定时触发 (仅当页面可见时)

**文件改动**:
- `backend-java/.../SmartBIUploadController.java` (+30 行)
- `web-admin/src/views/smart-bi/SmartBIAnalysis.vue` (+60 行)

---

### Q3. 查询模板改进 (Query Template Enhancement)
**影响维度**: 自助查询 +1 分
**ROI**: ★★★★☆
**工作量**: 1 天

**现状问题**:
- 现有 12 个模板写死在前端 (hardcoded)
- 无法自定义: 不同行业需要不同模板 (食品 vs 电商 vs 制造)
- Metabase "Questions Gallery" 支持保存/分享查询

**实现方案**:
```typescript
// 1. 查询模板持久化 (PostgreSQL)
CREATE TABLE smart_bi_query_templates (
  id BIGSERIAL PRIMARY KEY,
  factory_id VARCHAR(50),
  name VARCHAR(200) NOT NULL,
  category VARCHAR(50),
  prompt TEXT NOT NULL,
  icon VARCHAR(50),
  is_public BOOLEAN DEFAULT false,
  usage_count INT DEFAULT 0,
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

// 2. 模板管理界面
<el-button @click="openTemplateManager">
  <el-icon><Edit /></el-icon>
  管理模板
</el-button>

// 3. "保存为模板" 功能
async function saveAsTemplate(question: string) {
  await post('/api/smart-bi/templates', {
    name: `自定义查询_${Date.now()}`,
    category: 'custom',
    prompt: question,
    is_public: false
  });
}
```

**技术要点**:
- REST API: `GET/POST/DELETE /api/smart-bi/templates`
- 前端: 替换 hardcoded `queryTemplates` 为后端数据
- 添加 "⭐️ 收藏" 功能 (高频模板置顶)

**文件改动**:
- `database/create_smart_bi_query_templates.sql` (新建)
- `backend-java/.../entity/SmartBIQueryTemplate.java` (新建)
- `backend-java/.../controller/SmartBITemplateController.java` (新建)
- `web-admin/src/views/smart-bi/SmartBIAnalysis.vue` (改 `queryTemplates` 为异步加载)

---

### Q4. 空状态设计 (Empty State Design)
**影响维度**: UI/UX 感知质量 +15%
**ROI**: ★★★★☆
**工作量**: 0.5 天

**现状问题**:
- 无数据时显示 "暂无数据",缺少引导
- 加载失败时 error message 没有操作建议
- Metabase 空状态有插画 + 操作指引

**实现方案**:
```vue
<!-- 1. 空上传状态 (现有代码改进) -->
<div v-if="uploadedSheets.length === 0" class="empty-state">
  <img src="@/assets/empty-upload.svg" width="200" />
  <h3>还没有上传数据</h3>
  <p class="hint">上传 Excel 文件开始智能分析</p>
  <el-button type="primary" @click="triggerUpload">
    <el-icon><Upload /></el-icon>
    立即上传
  </el-button>
  <div class="quick-links">
    <a @click="loadDemoData">查看示例数据</a>
    <a href="/docs/smartbi-guide" target="_blank">使用指南</a>
  </div>
</div>

<!-- 2. 无图表状态 (sheet 分析失败) -->
<div v-if="enrichedResult.charts.length === 0" class="empty-charts">
  <el-empty description="该表无法生成图表">
    <template #image>
      <el-icon :size="60" color="#909399"><WarningFilled /></el-icon>
    </template>
    <p>可能原因: 数据格式不符合要求或缺少数值列</p>
    <el-button @click="viewRawData">查看原始数据</el-button>
  </el-empty>
</div>

<!-- 3. 加载骨架屏 (ChartSkeleton 改进) -->
<ChartSkeleton v-if="loading" :count="5" animated />
```

**设计要点**:
- 空状态插画: 使用 Undraw/Storyset (免费商用)
- 文案: 说明原因 + 提供下一步操作
- 颜色: 中性灰 (#909399), 避免红色 (不是错误)

**文件改动**:
- `web-admin/src/components/smartbi/EmptyState.vue` (新建通用组件)
- `web-admin/src/views/smart-bi/SmartBIAnalysis.vue` (替换现有空状态)
- `web-admin/src/assets/empty-*.svg` (添加 3 个插画)

---

### Q5. 键盘快捷键 (Keyboard Shortcuts)
**影响维度**: UI/UX 感知质量 +10%
**ROI**: ★★★☆☆
**工作量**: 0.5 天

**现状问题**:
- 所有操作需要鼠标点击
- 切换 sheet、导出、分享等高频操作无快捷键
- 专业用户期望快捷键 (如 Excel: Ctrl+S 保存)

**实现方案**:
```typescript
// 1. 快捷键监听 (useKeyboardShortcuts composable)
import { useEventListener } from '@vueuse/core';

function setupKeyboardShortcuts() {
  useEventListener(document, 'keydown', (e: KeyboardEvent) => {
    // 忽略输入框内按键
    if ((e.target as HTMLElement).tagName === 'INPUT') return;

    const shortcuts = {
      'ArrowLeft': () => switchSheet(currentSheetIndex.value - 1),
      'ArrowRight': () => switchSheet(currentSheetIndex.value + 1),
      'KeyE': () => e.ctrlKey && exportExcel(),
      'KeyP': () => e.ctrlKey && exportPDF(),
      'KeyS': () => e.ctrlKey && e.preventDefault() && openShareDialog(),
      'KeyR': () => e.ctrlKey && refreshCurrentSheet(),
      'Slash': () => focusQuickQuestion(),
      'Escape': () => closeAllDialogs(),
    };

    const key = e.code;
    if (shortcuts[key]) shortcuts[key]();
  });
}

// 2. 快捷键提示 (Tooltip)
<el-tooltip content="导出 Excel (Ctrl+E)">
  <el-button @click="exportExcel">导出</el-button>
</el-tooltip>

// 3. 快捷键帮助面板 (? 键打开)
<el-dialog v-model="showShortcutsHelp" title="键盘快捷键">
  <el-descriptions :column="1">
    <el-descriptions-item label="← →">切换表格</el-descriptions-item>
    <el-descriptions-item label="Ctrl+E">导出 Excel</el-descriptions-item>
    <el-descriptions-item label="Ctrl+S">分享</el-descriptions-item>
    <el-descriptions-item label="/">快速提问</el-descriptions-item>
    <el-descriptions-item label="Esc">关闭弹窗</el-descriptions-item>
  </el-descriptions>
</el-dialog>
```

**技术要点**:
- 使用 VueUse `useEventListener` 避免内存泄漏
- `e.preventDefault()` 阻止浏览器默认行为 (Ctrl+S)
- 添加 "?" 按钮在 header-actions 显示帮助

**文件改动**:
- `web-admin/src/composables/useKeyboardShortcuts.ts` (新建)
- `web-admin/src/views/smart-bi/SmartBIAnalysis.vue` (+40 行)

---

## 🎯 Top 3 中期改进项 (3-7 天/项)

### M1. 可视化查询构建器 (Visual Query Builder)
**影响维度**: 自助查询 +1 分, 仪表盘构建 +0.5 分
**ROI**: ★★★★☆
**工作量**: 5 天

**现状问题**:
- 现有 "智能问答" 完全依赖 LLM: 黑盒,不可控
- 非技术用户不知道问什么: 没有字段列表/值域预览
- Metabase "Query Builder" 核心功能: 拖拽字段 → 自动生成 SQL

**实现方案**:
```vue
<!-- 查询构建器 UI -->
<div class="query-builder">
  <el-row :gutter="12">
    <!-- 左侧: 字段列表 -->
    <el-col :span="6">
      <el-card header="可用字段">
        <el-tree
          :data="availableFields"
          draggable
          @node-drag-end="onFieldDrop"
        >
          <template #default="{ node, data }">
            <span>{{ data.label }}</span>
            <el-tag size="small">{{ data.type }}</el-tag>
          </template>
        </el-tree>
      </el-card>
    </el-col>

    <!-- 中间: 查询配置 -->
    <el-col :span="12">
      <el-card header="查询配置">
        <el-form label-width="80px">
          <el-form-item label="选择字段">
            <el-select v-model="query.selectedFields" multiple>
              <el-option
                v-for="field in fields"
                :key="field.name"
                :value="field.name"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="过滤条件">
            <div v-for="(filter, idx) in query.filters" :key="idx">
              <el-select v-model="filter.field">
                <el-option v-for="f in fields" :value="f.name" />
              </el-select>
              <el-select v-model="filter.operator">
                <el-option label="等于" value="=" />
                <el-option label="大于" value=">" />
                <el-option label="包含" value="LIKE" />
              </el-select>
              <el-input v-model="filter.value" />
              <el-button @click="removeFilter(idx)" icon="Delete" />
            </div>
            <el-button @click="addFilter">添加条件</el-button>
          </el-form-item>

          <el-form-item label="分组">
            <el-select v-model="query.groupBy" multiple />
          </el-form-item>

          <el-form-item label="排序">
            <el-select v-model="query.orderBy" />
            <el-radio-group v-model="query.orderDirection">
              <el-radio label="ASC">升序</el-radio>
              <el-radio label="DESC">降序</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>

        <el-button type="primary" @click="executeQuery">
          执行查询
        </el-button>
      </el-card>
    </el-col>

    <!-- 右侧: 预览 -->
    <el-col :span="6">
      <el-card header="查询预览">
        <pre>{{ generatedSQL }}</pre>
      </el-card>
    </el-col>
  </el-row>

  <!-- 结果展示 -->
  <el-card header="查询结果" style="margin-top: 12px;">
    <el-table :data="queryResults" />
  </el-card>
</div>
```

**后端支持**:
```python
# backend/python/smartbi/api/query_builder.py
@router.post("/api/smartbi/visual-query")
async def execute_visual_query(request: VisualQueryRequest):
    """
    执行可视化查询构建器生成的查询
    """
    upload_id = request.upload_id
    sheet_name = request.sheet_name

    # 从 PostgreSQL 加载原始数据
    df = load_dynamic_data(upload_id, sheet_name)

    # 应用过滤
    for filter in request.filters:
        if filter.operator == '=':
            df = df[df[filter.field] == filter.value]
        elif filter.operator == '>':
            df = df[df[filter.field] > float(filter.value)]
        # ... 其他操作符

    # 应用分组/聚合
    if request.group_by:
        df = df.groupby(request.group_by).agg(request.aggregations)

    # 应用排序
    if request.order_by:
        df = df.sort_values(request.order_by, ascending=(request.order_direction == 'ASC'))

    return {
        "data": df.to_dict('records'),
        "sql": generate_sql_preview(request)  # 用于展示
    }
```

**技术要点**:
- 字段列表从 `smart_bi_pg_field_definitions` 加载
- 值域预览: `SELECT DISTINCT {field} LIMIT 100` 显示可选值
- SQL 生成: 仅用于展示 (实际执行用 pandas)
- 保存查询: 存为模板 (复用 Q3 基础设施)

**文件改动**:
- `web-admin/src/views/smart-bi/QueryBuilder.vue` (新建, ~500 行)
- `backend/python/smartbi/api/query_builder.py` (新建, ~200 行)
- `web-admin/src/router/modules/smartbi.ts` (添加路由)

---

### M2. 仪表盘体验升级 (Dashboard Builder UX)
**影响维度**: 仪表盘构建 +1 分
**ROI**: ★★★☆☆
**工作量**: 4 天

**现状问题**:
- 现有 DashboardBuilder 功能完整,但体验粗糙:
  - 拖拽手感差: 无吸附线,容易错位
  - 无协作功能: 无法分享/克隆 dashboard
  - 无模板: 空 dashboard 不知道怎么摆

**实现方案**:

**2.1 网格吸附 + 对齐线**
```typescript
// 拖拽时显示对齐辅助线
const alignmentGuides = ref<{ x: number[], y: number[] }>({ x: [], y: [] });

function onCardDrag(card: DashboardCard, e: MouseEvent) {
  const threshold = 5; // 5px 吸附阈值

  // 检测与其他卡片的边界对齐
  const otherCards = internalLayout.value.cards.filter(c => c.id !== card.id);
  const guides = { x: [], y: [] };

  otherCards.forEach(other => {
    // 左对齐
    if (Math.abs(card.x - other.x) < threshold) {
      card.x = other.x;
      guides.x.push(other.x);
    }
    // 右对齐
    if (Math.abs((card.x + card.w) - (other.x + other.w)) < threshold) {
      card.x = other.x + other.w - card.w;
      guides.x.push(other.x + other.w);
    }
    // 上下对齐同理
  });

  alignmentGuides.value = guides;
}

// CSS 绘制辅助线
<div v-for="x in alignmentGuides.x" :key="x" class="guide-line-v" :style="{ left: x + 'px' }" />
```

**2.2 Dashboard 模板库**
```typescript
// 预设 Dashboard 模板
const dashboardTemplates = [
  {
    name: '财务总览',
    description: '营收、成本、利润三大核心指标',
    thumbnail: '/templates/finance-overview.png',
    layout: {
      cards: [
        { id: '1', chartType: 'kpi', title: '总营收', x: 0, y: 0, w: 3, h: 2 },
        { id: '2', chartType: 'kpi', title: '总成本', x: 3, y: 0, w: 3, h: 2 },
        { id: '3', chartType: 'line', title: '利润趋势', x: 0, y: 2, w: 12, h: 4 },
        // ...
      ]
    }
  },
  {
    name: '销售漏斗',
    description: '从线索到成交的转化分析',
    layout: { /* ... */ }
  },
  // ... 5-10 个模板
];

// 应用模板
function applyTemplate(template: DashboardTemplate) {
  internalLayout.value = { ...template.layout };
  // 自动绑定数据到卡片
  autoBindData();
}
```

**2.3 Dashboard 分享/克隆**
```typescript
// 保存到后端 (PostgreSQL)
CREATE TABLE smart_bi_dashboards (
  id BIGSERIAL PRIMARY KEY,
  factory_id VARCHAR(50),
  name VARCHAR(200),
  layout JSON NOT NULL,
  is_public BOOLEAN DEFAULT false,
  created_by BIGINT,
  cloned_from BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

// API 端点
POST /api/smart-bi/dashboards        # 创建
GET  /api/smart-bi/dashboards        # 列表
POST /api/smart-bi/dashboards/{id}/clone  # 克隆
```

**文件改动**:
- `web-admin/src/components/smartbi/DashboardBuilder.vue` (改进拖拽逻辑, +200 行)
- `web-admin/src/views/smart-bi/DashboardTemplates.vue` (新建模板选择器)
- `database/create_smart_bi_dashboards.sql` (新建表)
- `backend-java/.../entity/SmartBIDashboard.java` (新建)

---

### M3. 移动端适配 (Mobile BI Adaptation)
**影响维度**: 移动端 +2 分
**ROI**: ★★★☆☆
**工作量**: 6 天

**现状问题**:
- RN 应用存在但无 SmartBI 专用界面
- Web 页面在移动端无法操作 (图表交互、拖拽等)
- 工厂管理者需要在手机查看实时报表

**实现方案**:

**3.1 RN 新增 SmartBI 模块**
```typescript
// frontend/CretasFoodTrace/src/screens/smartbi/SmartBIDashboardScreen.tsx
export default function SmartBIDashboardScreen() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      {/* Dashboard 列表 */}
      <FlatList
        data={dashboards}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setSelectedDashboard(item)}>
            <View style={styles.dashboardCard}>
              <Text style={styles.title}>{item.name}</Text>
              <Text style={styles.subtitle}>{item.description}</Text>
              <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Dashboard 详情 */}
      {selectedDashboard && (
        <ScrollView>
          {selectedDashboard.cards.map(card => (
            <MobileChartCard key={card.id} card={card} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// 移动端优化图表组件
function MobileChartCard({ card }) {
  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>{card.title}</Text>
      {/* 使用 react-native-echarts-wrapper */}
      <ECharts option={card.config} height={200} />
    </View>
  );
}
```

**3.2 Web 响应式改进**
```scss
// SmartBIAnalysis.vue 添加媒体查询
@media (max-width: 768px) {
  .chart-grid {
    grid-template-columns: 1fr !important; // 单列布局
  }

  .header-actions {
    flex-wrap: wrap; // 按钮换行

    .el-button {
      margin-bottom: 8px;
    }
  }

  .sheet-tabs {
    overflow-x: auto; // 横向滚动
    white-space: nowrap;
  }
}
```

**3.3 离线支持**
```typescript
// RN 端使用 MMKV 缓存 dashboard 数据
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

async function cacheDashboard(dashboard: Dashboard) {
  storage.set(`dashboard_${dashboard.id}`, JSON.stringify(dashboard));
}

async function loadDashboardOffline(id: string): Promise<Dashboard | null> {
  const cached = storage.getString(`dashboard_${id}`);
  return cached ? JSON.parse(cached) : null;
}
```

**文件改动**:
- `frontend/CretasFoodTrace/src/screens/smartbi/` (新建目录, 5 个文件)
- `frontend/CretasFoodTrace/src/navigation/FactoryAdminTabNavigator.tsx` (添加 SmartBI tab)
- `web-admin/src/views/smart-bi/SmartBIAnalysis.vue` (添加响应式样式)
- `frontend/CretasFoodTrace/src/services/api/smartbi.ts` (新建 API 客户端)

---

## 🎨 UI/UX 精细化提升 (不改功能)

### P1. 加载状态动画 (Loading States)
**当前**: 简单 `<Loading />` icon
**改进**:
- 骨架屏: `<ChartSkeleton />` 显示图表轮廓
- 进度提示: "正在分析第 3/11 个表格..."
- SSE 流式反馈: 实时显示解析进度

**工作量**: 0.5 天

---

### P2. 图表悬浮工具栏 (Chart Hover Toolbar)
**当前**: 需要点击 "..." 菜单操作
**改进**: 鼠标悬浮图表 → 显示半透明工具栏
- 📊 切换图表类型
- 📥 下载图片
- 🔍 查看数据表
- ⚙️ 图表配置

**参考**: Metabase chart hover actions
**工作量**: 0.5 天

---

### P3. 数据表格增强 (Data Table Enhancement)
**当前**: 原始数据表格无格式
**改进**:
- 数值列右对齐 + 千分位
- 百分比列显示颜色条
- 可排序/可搜索
- 支持复制选区 (Ctrl+C)

**使用组件**: Element Plus `el-table` 内置功能
**工作量**: 0.5 天

---

### P4. 颜色主题 (Color Themes)
**当前**: 固定配色
**改进**:
- 3 种预设主题: 默认/暖色/冷色 (已有 `colorPalettes`)
- 深色模式支持
- 色盲友好模式 (ColorBrewer Safe)

**工作量**: 0.5 天

---

### P5. 动画过渡 (Transitions)
**当前**: 瞬间切换,生硬
**改进**:
- Sheet 切换: `<transition name="fade-slide">`
- 图表加载: ECharts `animationDuration: 1000`
- 数据刷新: 闪烁提示

**工作量**: 0.3 天

---

### P6. Tooltip 提示完善
**当前**: 部分按钮无 tooltip
**改进**:
- 所有图标按钮添加 `el-tooltip`
- 专业术语添加解释 (如 "同比" = "Year-over-Year")
- 快捷键提示

**工作量**: 0.3 天

---

### P7. 微交互 (Micro-interactions)
- 按钮 hover 放大 1.05x
- KPI 卡片点击波纹效果
- 拖拽卡片时阴影加深
- 操作成功: 绿色勾 ✓ 动画

**工作量**: 0.5 天

---

## ❌ 不建议实现的功能 (低 ROI)

### ❌ D1. 多数据源连接 (MySQL/PostgreSQL/API)
**为什么不做**:
- 当前场景: 工厂内部 Excel 报表分析,不是企业级 BI 平台
- 技术复杂度高: 需要 query engine, connection pooling, schema discovery
- 安全风险: 直连数据库需要严格权限控制
- **替代方案**: 保持 Excel 上传,添加 "定时导入" 功能 (从内网文件服务器)

---

### ❌ D2. SQL 编辑器
**为什么不做**:
- 目标用户: 工厂管理者/财务人员,不是数据分析师
- 已有 "可视化查询构建器" (M1) 覆盖需求
- SQL 编辑器需要语法高亮/自动补全/执行计划,开发成本 3-5 天

---

### ❌ D3. 权限粒度控制 (RBAC)
**为什么不做**:
- 当前架构: factoryId 隔离已足够
- 企业级 RBAC (行级/列级权限) 需要:
  - 权限引擎重构 (~2 周)
  - 与现有 JWT 权限体系整合
  - 查询性能优化 (每次查询检查权限)
- **替代方案**: 继续使用 factoryId 隔离 + 分享链接 TTL

---

### ❌ D4. 自定义图表类型 (Custom Viz)
**为什么不做**:
- ECharts 已支持 40+ 图表类型,覆盖 95% 需求
- 自定义图表需要:
  - 图表配置 DSL
  - 可视化配置器
  - 预览/调试工具
- 开发成本 > 5 天,使用频率 < 5%

---

### ❌ D5. 实时协作编辑 (Collaborative Editing)
**为什么不做**:
- 类似 Google Docs 多人同时编辑 dashboard
- 需要 WebSocket + CRDT/OT 算法
- 当前场景: 单用户分析为主,协作需求低
- **替代方案**: Dashboard 克隆 + 评论功能 (异步协作)

---

## 📈 改进后预期评分

实现 Q1-Q5 + M1-M3 后:

| 维度 | 当前 | 改进后 | 增量 |
|------|------|--------|------|
| 数据接入 | 1 | 1 | 0 (保持) |
| 图表丰富度 | 3 | 3 | 0 (已足够) |
| AI/ML 能力 | 3 | 3 | 0 (已领先) |
| 仪表盘构建 | 2.5 | 4 | **+1.5** (M2) |
| 自助查询 | 3 | 5 | **+2** (Q3+M1) |
| 协作能力 | 2 | 3 | **+1** (M2 分享) |
| 导出能力 | 3.5 | 3.5 | 0 (已优秀) |
| 移动端 | 1 | 3 | **+2** (M3) |
| 实时数据 | 0 | 2 | **+2** (Q2) |
| 企业安全 | 1 | 1 | 0 (暂不改) |
| 交互过滤 | 2 | 3.5 | **+1.5** (Q1) |

**总分**: 22 → **32 分** (58%)
**超过目标**: 53% → 58% (+5%)

---

## 🗓️ 实施时间表 (3 周)

### Week 1: Quick Wins (5 项 × 1 天 = 5 天)
- Day 1-2: Q1 图表联动过滤
- Day 3: Q2 数据自动刷新
- Day 4: Q3 查询模板改进
- Day 5: Q4 空状态设计 + Q5 快捷键

**产出**: +5 分, 从 40% → 49%

---

### Week 2: Medium Term Part 1 (M1 + M2)
- Day 1-3: M1 可视化查询构建器 (核心功能)
- Day 4-5: M1 后端 API + 字段值域

**产出**: +1.5 分, 从 49% → 52%

---

### Week 3: Medium Term Part 2 (M2 + M3)
- Day 1-2: M2 仪表盘网格吸附 + 模板库
- Day 3: M2 Dashboard 分享/克隆
- Day 4-5: M3 RN 端基础适配

**产出**: +4 分, 从 52% → 58%

---

## 🔄 持续优化建议

### 迭代 1 (4-6 周后)
- 收集用户反馈: 哪些功能最常用?
- 优化 AI 分析质量: 根据真实查询调整 prompt
- 性能优化: 大数据集 (>10000 行) 分页/虚拟滚动

### 迭代 2 (2-3 月后)
- 添加审计日志: 谁在什么时间查看/导出了什么数据
- 企业版功能: 白标定制、SSO 集成
- 行业模板包: 食品/制造/零售专用分析模板

---

## 📋 验收标准

### 功能完整性
- [ ] Q1-Q5 所有快速见效项完成
- [ ] M1-M3 核心功能可用
- [ ] P1-P7 UI 优化完成

### 质量标准
- [ ] E2E 测试覆盖新功能 (Playwright)
- [ ] 无 console.error (生产环境)
- [ ] 移动端 Lighthouse 分数 > 80

### 性能指标
- [ ] 图表渲染 < 500ms (50 数据点)
- [ ] Dashboard 加载 < 2s (5 图表)
- [ ] SSE 上传进度无卡顿

### 用户体验
- [ ] 空状态有操作指引
- [ ] 所有按钮有 tooltip
- [ ] 支持键盘导航

---

## 🎯 总结

通过 **3 周** 开发,预期从 **40%** 提升至 **58%**,超过 Metabase (53%) 水平。

**核心策略**:
1. **扬长避短**: 保持 AI 分析优势,不与 Metabase 拼数据源接入
2. **用户导向**: 优化高频操作 (切换、导出、分享),而非炫技功能
3. **渐进增强**: 先做快速见效项,再做中期项,避免 Big Bang

**关键成功因素**:
- Q1 图表联动: 最能提升 "专业感" 的功能
- M1 查询构建器: 降低 LLM 依赖,提高可控性
- M3 移动端: 覆盖工厂管理者核心场景

**风险控制**:
- 不做复杂功能 (SQL 编辑器、RBAC),避免工期失控
- 复用现有基础设施 (PostgreSQL、ECharts),减少新依赖
- 保持向后兼容,不破坏现有功能
