<template>
  <div class="smart-bi-analysis">
    <el-card class="upload-card">
      <template #header>
        <div class="card-header">
          <span class="title"><span class="section-badge section-badge--chart"></span> 智能数据分析</span>
          <div class="header-actions">
            <el-select
              v-if="uploadBatches.length > 1"
              v-model="selectedBatchIndex"
              @change="selectBatch"
              style="width: 300px; margin-right: 8px;"
              size="small"
            >
              <el-option
                v-for="(batch, idx) in uploadBatches"
                :key="idx"
                :label="formatBatchLabel(batch)"
                :value="idx"
              >
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>
                    <el-tag v-if="isAutoSyncBatch(batch)" size="small" type="success" style="margin-right: 6px;">自动同步</el-tag>
                    {{ safeBatchName(batch) }}
                  </span>
                  <span style="color: #909399; font-size: 12px; margin-left: 12px;">
                    {{ batch.uploadTime }} · {{ batch.sheetCount }} 表
                  </span>
                </div>
              </el-option>
            </el-select>
            <el-button v-if="uploadedSheets.length > 1" @click="openCrossSheetAnalysis" type="primary" size="small">
              <el-icon><DataAnalysis /></el-icon>
              综合分析
            </el-button>
            <el-button v-if="uploadedSheets.length > 0" @click="openYoYComparison" type="success" size="small">
              <el-icon><TrendCharts /></el-icon>
              同比分析
            </el-button>
            <el-button v-if="uploadedSheets.length > 0" @click="openStatisticalAnalysis" type="info" size="small">
              <el-icon><DataAnalysis /></el-icon>
              因果分析
            </el-button>
            <el-button v-if="uploadedSheets.length > 0" @click="openShareDialog" type="default" size="small" plain>
              <el-icon><Share /></el-icon>
              分享
            </el-button>
            <el-button v-if="canUpload && uploadedSheets.length > 0" @click="resetUpload" type="warning" size="small">
              <el-icon><Upload /></el-icon>
              上传新文件
            </el-button>
            <el-button v-if="uploadedSheets.length > 0" @click="startDemoTour" circle size="small" title="功能引导">
              <el-icon><QuestionFilled /></el-icon>
            </el-button>
          </div>
        </div>
      </template>

      <!-- Python 服务降级警告 -->
      <el-alert
        v-if="pythonUnavailable"
        title="AI 分析服务暂时不可用"
        description="Python SmartBI 服务无法连接，智能图表推荐和 AI 洞察功能暂时禁用。已上传的数据仍可正常查看。"
        type="warning"
        :closable="true"
        show-icon
        style="margin-bottom: 12px;"
      />

      <!-- 上传/空数据区域 -->
      <div v-if="uploadedSheets.length === 0 && !uploading" class="upload-section">
        <!-- 加载中 -->
        <div v-if="historyLoading" style="text-align: center; padding: 60px 0;">
          <el-icon class="is-loading" :size="32"><Loading /></el-icon>
          <p style="color: #909399; margin-top: 12px;">正在加载历史数据...</p>
        </div>
        <!-- 管理员：显示上传区域 -->
        <template v-else-if="canUpload">
          <el-upload
            ref="uploadRef"
            class="upload-dragger"
            drag
            :auto-upload="false"
            :limit="1"
            accept=".xlsx,.xls"
            :on-change="handleFileChange"
            :file-list="fileList"
          >
            <el-icon class="el-icon--upload"><upload-filled /></el-icon>
            <div class="el-upload__text">
              拖拽 Excel 文件到此处或 <em>点击上传</em>
            </div>
            <template #tip>
              <div class="el-upload__tip">
                支持 .xlsx、.xls 格式，文件大小不超过 50MB
              </div>
            </template>
          </el-upload>

          <el-button
            v-if="fileList.length > 0"
            type="primary"
            size="large"
            :loading="uploading"
            @click="uploadFile"
            style="margin-top: 20px; width: 100%"
          >
            <el-icon><Upload /></el-icon>
            开始分析
          </el-button>
        </template>
        <!-- 只读用户：提示 -->
        <SmartBIEmptyState v-else type="read-only" :showAction="false" />
      </div>

      <!-- 上传进度 (SSE 流式) -->
      <div v-if="uploading" class="progress-section">
        <el-progress :percentage="uploadProgress" :status="uploadStatus" :stroke-width="20" striped striped-flow></el-progress>
        <p class="progress-text">{{ progressText }}</p>

        <!-- 详细进度面板 -->
        <div v-if="sheetProgressList.length > 0" class="sheet-progress-panel">
          <div class="progress-header">
            <span><span class="section-badge section-badge--chart"></span> Sheet 处理进度 ({{ completedSheetCount }}/{{ totalSheetCount }})</span>
            <el-tag v-if="dictionaryHits > 0" type="success" size="small">
              字典命中: {{ dictionaryHits }}
            </el-tag>
            <el-tag v-if="llmAnalyzedFields > 0" type="warning" size="small">
              LLM分析: {{ llmAnalyzedFields }}
            </el-tag>
          </div>

          <div class="sheet-progress-list">
            <div
              v-for="sheet in sheetProgressList"
              :key="sheet.sheetIndex"
              class="sheet-progress-item"
              :class="{ 'is-complete': sheet.status === 'complete', 'is-failed': sheet.status === 'failed' }"
            >
              <div class="sheet-name">
                <el-icon v-if="sheet.status === 'complete'" class="status-icon success"><CircleCheckFilled /></el-icon>
                <el-icon v-else-if="sheet.status === 'failed'" class="status-icon error"><CircleCloseFilled /></el-icon>
                <el-icon v-else class="status-icon loading"><Loading /></el-icon>
                {{ sheet.sheetName }}
              </div>
              <div class="sheet-stage">{{ sheet.stage }}</div>
              <div class="sheet-message">{{ sheet.message }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Demo 缓存提示条 -->
      <div v-if="usingDemoCache && uploadedSheets.length > 0 && !uploading" class="demo-cache-banner">
        <div class="cache-banner-left">
          <el-icon><CircleCheckFilled /></el-icon>
          <span>已从缓存加载「{{ demoCacheFileName }}」的分析结果，无需等待</span>
        </div>
        <el-button type="primary" link size="small" @click="refreshFromServer">
          <el-icon><Refresh /></el-icon>
          从服务器刷新
        </el-button>
      </div>

      <!-- 结果展示 -->
      <div v-if="uploadedSheets.length > 0 && !uploading" v-loading="batchSwitching" element-loading-text="正在切换数据源..." class="result-section">
        <el-alert
          :title="`成功处理 ${uploadResult.totalSheets} 个 Sheet，共 ${uploadResult.totalSavedRows} 行数据`"
          type="success"
          :closable="false"
          show-icon
        />

        <!-- P1: 食品行业分析模板 -->
        <div v-if="foodIndustryDetection?.is_food_industry" class="industry-templates-bar">
          <span class="templates-label">食品行业模板:</span>
          <el-tag
            v-for="tpl in foodTemplates"
            :key="tpl.id"
            :type="activeTemplate === tpl.id ? 'primary' : 'success'"
            :effect="activeTemplate === tpl.id ? 'dark' : 'plain'"
            class="template-chip"
            @click="applyTemplate(tpl)"
          >
            {{ tpl.name }}
          </el-tag>
        </div>

        <el-tabs v-model="activeTab" class="sheet-tabs">
          <el-tab-pane
            v-for="sheet in uploadedSheets"
            :key="sheet.sheetIndex"
            :name="String(sheet.sheetIndex)"
          >
            <!-- 自定义 Tab 标签 -->
            <template #label>
              <span class="custom-tab-label" :class="{ 'is-index': isIndexSheet(sheet), 'is-failed': !sheet.success }">
                <el-icon v-if="!sheet.success" color="#F56C6C"><WarningFilled /></el-icon>
                <el-icon v-else-if="isIndexSheet(sheet)"><List /></el-icon>
                <el-icon v-else><Document /></el-icon>
                <span>{{ getSheetDisplayName(sheet) }}</span>
                <el-tag v-if="!sheet.success" size="small" type="danger">失败</el-tag>
                <el-tag v-else-if="!isIndexSheet(sheet)" size="small" type="info">{{ sheet.savedRows }}行</el-tag>
              </span>
            </template>

            <!-- 索引页特殊展示 -->
            <div v-if="isIndexSheet(sheet)" class="index-page-view">
              <div class="index-header">
                <el-icon class="index-icon"><Tickets /></el-icon>
                <h2>报表目录</h2>
                <span class="index-count">共 {{ indexMetadata?.sheetMappings?.length || 0 }} 个报表</span>
              </div>

              <div class="index-list">
                <div
                  v-for="(mapping, idx) in indexMetadata?.sheetMappings || []"
                  :key="mapping.index"
                  class="index-item"
                  :class="{ 'is-current': mapping.index === sheet.sheetIndex }"
                  @click="navigateToSheet(mapping.index)"
                >
                  <div class="item-number">{{ idx + 1 }}</div>
                  <div class="item-content">
                    <div class="item-name">{{ mapping.reportName }}</div>
                    <div v-if="mapping.sheetName !== mapping.reportName" class="item-sheet">
                      Sheet: {{ mapping.sheetName }}
                    </div>
                    <div v-if="mapping.description" class="item-description">
                      <el-icon><InfoFilled /></el-icon>
                      {{ mapping.description }}
                    </div>
                  </div>
                  <el-icon class="item-arrow"><ArrowRight /></el-icon>
                </div>
              </div>

              <div class="index-footer">
                <el-icon><Pointer /></el-icon>
                <span>点击报表名称跳转到对应 Sheet</span>
              </div>
            </div>

            <!-- 失败的 Sheet - 显示重试按钮 -->
            <div v-else-if="!sheet.success" class="failed-sheet-view">
              <el-result icon="error" :title="'Sheet 处理失败'" :sub-title="sheet.message">
                <template #extra>
                  <el-button
                    v-if="sheet.uploadId"
                    type="primary"
                    :loading="retryingSheets[sheet.sheetIndex]"
                    @click="handleRetrySheet(sheet)"
                  >
                    {{ retryingSheets[sheet.sheetIndex] ? '重试中...' : '重新处理' }}
                  </el-button>
                  <el-text v-else type="info" style="margin-top: 8px">
                    该 Sheet 未生成上传记录，请重新上传整个文件
                  </el-text>
                </template>
              </el-result>
            </div>

            <!-- 普通 Sheet 展示 -->
            <template v-else>
              <!-- Sheet 信息 -->
              <div class="sheet-info">
                <el-descriptions :column="3" border>
                  <el-descriptions-item label="数据类型">
                    <el-tag>{{ sheet.detectedDataType || 'UNKNOWN' }}</el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="推荐图表">
                    <el-tag type="success">{{ sheet.flowResult?.recommendedChartType || 'N/A' }}</el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="保存行数">
                    {{ sheet.savedRows }}
                  </el-descriptions-item>
                </el-descriptions>

                <!-- 显示编制说明（如有） -->
                <el-alert
                  v-if="getSheetDescription(sheet)"
                  :title="'编制说明'"
                  type="info"
                  :description="getSheetDescription(sheet)"
                  show-icon
                  :closable="false"
                  style="margin-top: 16px"
                />
              </div>

              <!-- KPI 统计卡片 — skeleton while enriching, real cards once loaded -->
              <div v-if="enrichingSheets.has(sheet.sheetIndex) && !sheet.flowResult?.kpiSummary" class="kpi-section">
                <ChartSkeleton type="kpi" />
              </div>
              <div v-else-if="sheet.flowResult?.kpiSummary" class="kpi-section">
                <div class="kpi-grid">
                  <KPICard
                    v-for="kpi in getSheetKPIs(sheet)"
                    :key="kpi.title"
                    :title="kpi.title"
                    :value="kpi.value"
                    :unit="kpi.unit"
                    :trend="kpi.trend"
                    :trendValue="kpi.trendValue"
                    :changeRate="kpi.changeRate"
                    :status="kpi.status"
                    :displayMode="kpi.displayMode"
                    :sparklineData="kpi.sparklineData"
                    :benchmarkLabel="kpi.benchmarkLabel"
                    :benchmarkGap="kpi.benchmarkGap"
                    format="custom"
                  />
                </div>
              </div>

              <!-- 图表展示（多图表仪表板） -->
              <div v-if="hasChartData(sheet) || enrichingSheets.has(sheet.sheetIndex)" class="chart-section">
                <div class="chart-section-header">
                  <h3>数据可视化</h3>
                  <div class="chart-section-actions">
                    <span v-if="hasChartData(sheet) && !layoutEditMode" class="drill-hint">点击图表数据点可下钻分析</span>
                    <!-- 刷新分析按钮 -->
                    <el-button
                      v-if="hasChartData(sheet)"
                      :icon="Refresh"
                      size="small"
                      :loading="enrichingSheets.has(sheet.sheetIndex)"
                      @click="handleRefreshAnalysis(sheet)"
                      style="margin-left: 8px;"
                    >刷新分析</el-button>
                    <!-- Q2: Auto-refresh dropdown -->
                    <el-dropdown v-if="hasChartData(sheet)" @command="setAutoRefresh" trigger="click" style="margin-left: 4px;">
                      <el-button size="small" :type="autoRefreshInterval > 0 ? 'success' : 'default'">
                        <el-icon><Timer /></el-icon>
                        {{ autoRefreshInterval > 0 ? `${autoRefreshInterval/1000}s` : '自动' }}
                      </el-button>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item :command="0">关闭自动刷新</el-dropdown-item>
                          <el-dropdown-item :command="30000">每 30 秒</el-dropdown-item>
                          <el-dropdown-item :command="60000">每 1 分钟</el-dropdown-item>
                          <el-dropdown-item :command="300000">每 5 分钟</el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                    <!-- P6: 编排模式切换 -->
                    <el-switch
                      v-if="hasChartData(sheet)"
                      v-model="layoutEditMode"
                      active-text="编排"
                      inactive-text="标准"
                      size="small"
                      style="margin-left: 12px;"
                    />
                  </div>
                </div>

                <!-- Global Filter Bar (Power BI / Tableau style) -->
                <div v-if="hasChartData(sheet)" class="global-filter-bar">
                  <el-icon class="filter-bar-icon"><Filter /></el-icon>
                  <el-select
                    v-model="globalFilterDimension"
                    placeholder="维度筛选"
                    size="small"
                    clearable
                    filterable
                    style="width: 140px"
                    @change="handleGlobalFilterChange(sheet)"
                  >
                    <el-option
                      v-for="col in getFilterableDimensions(sheet)"
                      :key="col"
                      :label="col"
                      :value="col"
                    />
                  </el-select>
                  <el-select
                    v-if="globalFilterDimension"
                    v-model="globalFilterValues"
                    placeholder="选择值"
                    size="small"
                    multiple
                    filterable
                    collapse-tags
                    collapse-tags-tooltip
                    :max-collapse-tags="2"
                    style="width: 240px"
                    @change="handleGlobalFilterApply(sheet)"
                  >
                    <el-option
                      v-for="val in getDimensionValues(sheet, globalFilterDimension)"
                      :key="val"
                      :label="val"
                      :value="val"
                    />
                  </el-select>
                  <el-button
                    v-if="globalFilterDimension || globalFilterValues.length"
                    size="small"
                    type="info"
                    link
                    @click="clearGlobalFilter(sheet)"
                  >清除筛选</el-button>
                  <span v-if="globalFilterValues.length" class="filter-count-badge">
                    已筛选 {{ globalFilterValues.length }} 项
                  </span>
                  <span v-if="filteredRawData" class="filter-count-badge filter-data-badge">
                    数据过滤: {{ filteredRowCount }}/{{ totalRowCount }} 行
                  </span>
                </div>

                <div v-if="enrichingSheets.has(sheet.sheetIndex) && !hasChartData(sheet)" class="chart-skeleton-wrapper">
                  <div v-if="enrichPhases.get(sheet.sheetIndex)?.chartsTotal" class="chart-progress-hint">
                    图表加载中 {{ enrichPhases.get(sheet.sheetIndex)?.charts || 0 }}/{{ enrichPhases.get(sheet.sheetIndex)?.chartsTotal }}...
                  </div>
                  <ChartSkeleton type="chart" />
                  <ChartSkeleton type="chart" />
                </div>

                <!-- P6: 编排模式 — DashboardBuilder (v-show preserves ECharts DOM) -->
                <div v-show="layoutEditMode && hasChartData(sheet)" class="builder-wrapper">
                  <DashboardBuilder
                    :layout="getCachedLayout(sheet)"
                    :available-charts="availableChartDefinitions"
                    :editable="true"
                    @layout-change="handleLayoutChange"
                    @save="(layout: DashboardLayout) => handleLayoutSave(layout, sheet.uploadId)"
                    @card-configure="(card: DashboardCard) => {}"
                  >
                    <template #card-content="{ card }">
                      <div :id="`builder-chart-${card.id}`" class="builder-chart-el" style="width:100%;height:100%;"></div>
                    </template>
                  </DashboardBuilder>
                </div>

                <!-- 标准模式 (v-show preserves ECharts DOM) -->
                <div v-show="!layoutEditMode || !hasChartData(sheet)" class="chart-dashboard">
                  <!-- Chart action bar -->
                  <div class="chart-action-bar">
                    <el-button
                      size="small"
                      type="primary"
                      plain
                      :loading="refreshAllChartsLoading"
                      @click="handleRefreshAllCharts(sheet)"
                    >
                      <el-icon><Refresh /></el-icon>
                      换一批图表
                    </el-button>
                    <el-button
                      size="small"
                      type="success"
                      plain
                      @click="handleExportExcel(sheet)"
                    >
                      <el-icon><Download /></el-icon>
                      导出 Excel
                    </el-button>
                    <el-button
                      size="small"
                      type="warning"
                      plain
                      @click="handleExportPDF(sheet)"
                    >
                      <el-icon><Document /></el-icon>
                      导出 PDF
                    </el-button>
                    <span class="chart-count-hint">{{ getSheetCharts(sheet).length }} 个图表</span>
                  </div>
                  <!-- Cross-chart filter bar -->
                  <div v-if="activeFilter" class="chart-filter-bar">
                    <el-icon><Filter /></el-icon>
                    <span>过滤: {{ activeFilter.dimension }} = <strong>{{ activeFilter.value }}</strong></span>
                    <el-button type="primary" link size="small" @click="clearChartFilter">清除过滤</el-button>
                  </div>
                  <div v-for="(chart, idx) in getSheetCharts(sheet)" :key="idx" class="chart-grid-item">
                    <div class="chart-title-row">
                      <div class="chart-title" style="margin-bottom:0">{{ chart.title || '数据分析' }}</div>
                      <div class="chart-controls">
                        <ChartTypeSelector
                          :current-type="chart.chartType"
                          :numeric-columns="getSheetColumns(sheet).filter(c => c.type === 'numeric').map(c => c.name)"
                          :categorical-columns="getSheetColumns(sheet).filter(c => c.type === 'categorical').map(c => c.name)"
                          :date-columns="getSheetColumns(sheet).filter(c => c.type === 'date').map(c => c.name)"
                          :row-count="sheet.flowResult?.kpiSummary?.rowCount || 0"
                          :loading="switchingChart?.sheetIndex === sheet.sheetIndex && switchingChart?.chartIndex === idx"
                          @switch-type="(type: string) => handleSwitchChartType(sheet, idx, type)"
                          @refresh="handleRefreshChart(sheet, idx)"
                        />
                        <ChartConfigPanel
                          :columns="getSheetColumns(sheet)"
                          :current-config="{ chartType: chart.chartType, xField: chart.xField, yFields: [] }"
                          :loading="switchingChart?.sheetIndex === sheet.sheetIndex && switchingChart?.chartIndex === idx"
                          @apply="(config: { xField: string; yFields: string[]; seriesField?: string; aggregation?: string }) => handleApplyChartConfig(sheet, idx, config)"
                        />
                        <el-dropdown class="chart-export-btn" trigger="click" @command="(cmd: string) => handleChartExport(cmd, sheet.sheetIndex, idx, chart.title)">
                          <el-button :icon="Download" circle size="small" />
                          <template #dropdown>
                            <el-dropdown-menu>
                              <el-dropdown-item command="png">导出 PNG</el-dropdown-item>
                              <el-dropdown-item command="svg">导出 SVG</el-dropdown-item>
                            </el-dropdown-menu>
                          </template>
                        </el-dropdown>
                      </div>
                    </div>
                    <div :id="`chart-${sheet.sheetIndex}-${idx}`" class="chart-container"></div>
                    <!-- P1.3: "查看更多" 按钮 (截断数据时显示) -->
                    <div v-if="chart.totalItems" class="chart-view-more">
                      <el-button type="primary" link size="small" @click="handleViewMoreData(sheet, idx, chart)">
                        查看更多 (共 {{ chart.totalItems }} 项，当前显示 {{ getDisplayedCount(chart) }} 项)
                      </el-button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 高管摘要横幅 (Power BI Copilot + Narrative BI) -->
              <div v-if="getExecutiveSummary(sheet)" class="executive-summary-banner">
                <div class="summary-icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                </div>
                <div class="summary-body">
                  <div class="summary-text">{{ getExecutiveSummary(sheet) }}</div>
                  <!-- Inline KPIs from top 3 -->
                  <div v-if="getSheetKPIs(sheet).length" class="summary-inline-kpis">
                    <div v-for="kpi in getSheetKPIs(sheet).slice(0, 3)" :key="kpi.title" class="inline-kpi">
                      <span class="inline-kpi-label">{{ kpi.title }}</span>
                      <span class="inline-kpi-value">{{ kpi.value }}{{ kpi.unit }}</span>
                      <span v-if="kpi.trendValue" class="inline-kpi-trend" :class="kpi.trend">{{ kpi.trendValue }}</span>
                    </div>
                  </div>
                  <!-- Risk/Opportunity/Sensitivity tags -->
                  <div v-if="getStructuredInsight(sheet)" class="summary-tags">
                    <el-tag v-if="getStructuredInsight(sheet)?.riskAlerts?.length" type="danger" size="small" effect="plain">
                      {{ getStructuredInsight(sheet)!.riskAlerts.length }} 个风险
                    </el-tag>
                    <el-tag v-if="getStructuredInsight(sheet)?.opportunities?.length" type="success" size="small" effect="plain">
                      {{ getStructuredInsight(sheet)!.opportunities.length }} 个机会
                    </el-tag>
                    <el-tag v-if="getSensitivityAnalysis(sheet)?.length" type="warning" size="small" effect="plain">
                      {{ getSensitivityAnalysis(sheet)!.length }} 项敏感性
                    </el-tag>
                  </div>
                </div>
              </div>

              <!-- A6: 食品行业标准参考面板 -->
              <el-collapse v-if="foodIndustryDetection?.is_food_industry && enrichedSheets.has(sheet.sheetIndex)" class="food-industry-panel">
                <el-collapse-item>
                  <template #title>
                    <div class="food-industry-header">
                      <el-tag type="success" size="small" effect="dark" style="margin-right: 8px;">
                        食品行业
                      </el-tag>
                      <span>食品行业标准参考</span>
                      <el-tag v-if="foodIndustryDetection.confidence > 0.5" type="info" size="small" style="margin-left: 8px;">
                        置信度 {{ (foodIndustryDetection.confidence * 100).toFixed(0) }}%
                      </el-tag>
                    </div>
                  </template>
                  <div class="food-standards-content">
                    <div v-if="foodIndustryDetection.suggested_standards?.length" class="standards-section">
                      <h4>相关食品安全标准</h4>
                      <ul>
                        <li v-for="std in foodIndustryDetection.suggested_standards" :key="std">{{ std }}</li>
                      </ul>
                    </div>
                    <div v-if="foodIndustryDetection.suggested_benchmarks?.length" class="benchmarks-section">
                      <h4>建议对标指标</h4>
                      <el-tag
                        v-for="bm in foodIndustryDetection.suggested_benchmarks"
                        :key="bm"
                        size="small"
                        type="info"
                        style="margin: 2px 4px;"
                      >
                        {{ bm.replace(/_/g, ' ') }}
                      </el-tag>
                    </div>
                    <div v-if="foodIndustryDetection.matched_keywords?.length" class="keywords-section">
                      <h4>匹配关键词</h4>
                      <el-tag
                        v-for="kw in foodIndustryDetection.matched_keywords.slice(0, 10)"
                        :key="kw"
                        size="small"
                        style="margin: 2px 4px;"
                      >
                        {{ kw }}
                      </el-tag>
                    </div>
                  </div>
                </el-collapse-item>
              </el-collapse>

              <!-- AI 分析 -->
              <div v-if="sheet.flowResult?.aiAnalysis || sheet.flowResult?.chartConfig?.aiAnalysis || enrichingSheets.has(sheet.sheetIndex)" class="ai-analysis-section">
                <!-- 结构化 AI 面板 -->
                <AIInsightPanel
                  v-if="getStructuredInsight(sheet)"
                  :insight="getStructuredInsight(sheet)"
                  :loading="enrichingSheets.has(sheet.sheetIndex) && !sheet.flowResult?.aiAnalysis"
                />

                <!-- 回退：纯文本展示 -->
                <template v-else>
                  <h3><span class="section-badge section-badge--ai"></span> AI 智能分析</h3>
                  <div v-if="enrichingSheets.has(sheet.sheetIndex) && !sheet.flowResult?.aiAnalysis">
                    <ChartSkeleton type="ai" />
                  </div>
                  <el-card v-else shadow="never" class="analysis-card">
                    <div class="analysis-content" v-html="formatAnalysis(getAIAnalysis(sheet))"></div>
                  </el-card>
                </template>
                <!-- 缓存状态提示 -->
                <div v-if="getCacheHint(sheet)" class="cache-hint">
                  {{ getCacheHint(sheet) }}
                </div>
              </div>

              <!-- 敏感性分析 -->
              <div v-if="getSensitivityAnalysis(sheet)?.length" class="sensitivity-analysis-section">
                <h4 style="margin: 16px 0 8px; color: var(--el-text-color-primary); font-size: 14px;">
                  <el-icon style="margin-right: 4px; vertical-align: middle;"><Warning /></el-icon>
                  关键驱动因素敏感性分析
                </h4>
                <el-table
                  :data="getSensitivityAnalysis(sheet)"
                  size="small"
                  stripe
                  :border="false"
                  style="width: 100%;"
                >
                  <el-table-column prop="factor" label="驱动因素" min-width="120" />
                  <el-table-column prop="current_value" label="当前值" min-width="100" />
                  <el-table-column prop="impact_description" label="变动影响" min-width="240" />
                </el-table>
              </div>

              <!-- 无数据提示 -->
              <div v-if="!hasChartData(sheet) && !sheet.flowResult?.aiAnalysis && !enrichingSheets.has(sheet.sheetIndex)" class="empty-sheet">
                <el-empty description="该 Sheet 暂无可分析的数据">
                  <el-button type="primary" size="small" @click="loadSheetData(sheet)">
                    查看原始数据
                  </el-button>
                </el-empty>
              </div>

              <!-- 数据预览 -->
              <div v-else class="data-preview-section">
                <h3><span class="section-badge section-badge--data"></span> 数据预览</h3>
                <el-button @click="loadSheetData(sheet)" type="primary" size="small">
                  查看原始数据
                </el-button>
              </div>
            </template>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-card>
  </div>

  <!-- 下钻分析抽屉 -->
  <el-drawer v-model="drillDownVisible" title="深度分析" size="55%" direction="rtl" @close="drillStack = []">
    <template #header>
      <div class="drill-down-header">
        <span class="drill-title">深度分析</span>
        <el-tag v-if="drillDownContext.dimension" type="info" size="small">
          {{ drillDownContext.dimension }}: {{ drillDownContext.filterValue }}
        </el-tag>
        <el-tag v-if="drillDownResult?.hierarchy" type="success" size="small" style="margin-left: 4px;">
          {{ drillDownResult.hierarchy.type }} 层级
        </el-tag>
      </div>
    </template>

    <!-- P4: 面包屑导航 -->
    <div v-if="drillStack.length > 0" class="drill-breadcrumb">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>
          <el-button type="primary" link size="small" @click="drillBackToRoot">全部数据</el-button>
        </el-breadcrumb-item>
        <el-breadcrumb-item v-for="(level, i) in drillStack" :key="i">
          <el-button type="primary" link size="small" @click="drillBackTo(i)">
            {{ level.dimension }}: {{ level.filterValue }}
          </el-button>
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div v-if="drillDownLoading" class="drill-loading">
      <el-icon class="is-loading" :size="40"><Loading /></el-icon>
      <p>正在分析 "{{ drillDownContext.filterValue }}" 的详细数据...</p>
    </div>

    <div v-else-if="drillDownResult">
      <!-- P4: 可用下钻维度按钮组 -->
      <div v-if="drillDownResult.available_dimensions?.length" class="drill-dimensions">
        <span class="drill-dim-label">可继续下钻:</span>
        <el-button v-for="dim in drillDownResult.available_dimensions" :key="dim" size="small" @click="drillByDimension(dim)">
          {{ dim }}
        </el-button>
      </div>

      <!-- 下钻图表 (点击可继续下钻) -->
      <div v-if="drillDownResult.chartConfig" class="drill-chart-section">
        <h4>数据分布 <span class="drill-hint-inline">(点击柱状图可继续下钻)</span></h4>
        <div id="drill-down-chart" class="drill-chart-container"></div>
      </div>

      <!-- 下钻数据摘要 -->
      <div v-if="drillDownResult.result?.summary" class="drill-summary-section">
        <h4>数据摘要</h4>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="维度">{{ drillDownResult.result.dimension }}</el-descriptions-item>
          <el-descriptions-item label="筛选值">{{ drillDownResult.result.filterValue }}</el-descriptions-item>
          <template v-for="(val, key) in drillDownResult.result.summary" :key="key">
            <el-descriptions-item v-if="key !== 'dimension'" :label="String(key)">
              {{ typeof val === 'number' ? val.toLocaleString() : val }}
            </el-descriptions-item>
          </template>
        </el-descriptions>
      </div>

      <!-- AI 洞察 -->
      <div v-if="drillDownResult.aiInsight" class="drill-ai-section">
        <h4>AI 洞察</h4>
        <el-card shadow="never" class="drill-insight-card">
          <div class="analysis-content" v-html="formatAnalysis(drillDownResult.aiInsight)"></div>
        </el-card>
      </div>

      <!-- 下钻数据表格 -->
      <div v-if="drillDownResult.result?.data?.length" class="drill-table-section">
        <h4>详细数据 ({{ drillDownResult.result.data.length }} 条)</h4>
        <el-table :data="drillDownResult.result.data.slice(0, 20)" border stripe size="small" max-height="300">
          <el-table-column v-for="col in Object.keys(drillDownResult.result.data[0] || {})" :key="col"
            :prop="col" :label="col" min-width="100" show-overflow-tooltip />
        </el-table>
      </div>

      <!-- 错误态：API 返回失败 -->
      <div v-if="!drillDownResult.success" class="drill-error">
        <el-empty :description="drillDownResult.error || '下钻分析失败，请稍后重试'" />
      </div>
      <!-- 空数据态：成功但无任何可展示内容 -->
      <div v-else-if="!drillDownResult.chartConfig && !drillDownResult.result?.summary && !drillDownResult.aiInsight && !drillDownResult.result?.data?.length" class="drill-empty">
        <el-empty description="该数据点暂无可展开的明细数据" />
      </div>
    </div>

    <el-empty v-else description="暂无分析结果" />
  </el-drawer>

  <!-- 分享链接对话框 -->
  <el-dialog v-model="shareDialogVisible" title="分享分析报告" width="500px">
    <div v-if="!shareLink" style="text-align: center; padding: 20px;">
      <p style="margin-bottom: 16px; color: #606266;">生成公开链接，无需登录即可查看分析报告</p>
      <el-form label-width="80px" style="max-width: 380px; margin: 0 auto;">
        <el-form-item label="标题">
          <el-input v-model="shareTitle" placeholder="分析报告标题" />
        </el-form-item>
        <el-form-item label="有效期">
          <el-select v-model="shareTTL" style="width: 100%">
            <el-option :value="1" label="1 天" />
            <el-option :value="7" label="7 天" />
            <el-option :value="30" label="30 天" />
            <el-option :value="90" label="90 天" />
          </el-select>
        </el-form-item>
      </el-form>
      <el-button type="primary" @click="createShareLink" :loading="shareCreating">
        <el-icon><Link /></el-icon> 生成分享链接
      </el-button>
    </div>
    <div v-else style="text-align: center; padding: 20px;">
      <el-result icon="success" title="分享链接已生成" sub-title="复制链接发送给他人即可查看">
        <template #extra>
          <el-input v-model="shareFullUrl" readonly style="margin-bottom: 12px;">
            <template #append>
              <el-button @click="copyShareLink">
                <el-icon><CopyDocument /></el-icon>
              </el-button>
            </template>
          </el-input>
          <div style="color: #909399; font-size: 12px;">
            有效期 {{ shareTTL }} 天 · 到期自动失效
          </div>
        </template>
      </el-result>
    </div>
  </el-dialog>

  <!-- 综合分析对话框 -->
  <el-dialog v-model="crossSheetVisible" title="全 Sheet 综合分析" width="90%" top="3vh" fullscreen>
    <div v-if="crossSheetLoading" class="cross-sheet-loading">
      <el-icon class="is-loading" :size="48"><Loading /></el-icon>
      <p>正在汇总所有 Sheet 数据，生成跨表综合分析...</p>
    </div>

    <div v-else-if="crossSheetResult">
      <!-- 高管摘要 -->
      <div v-if="crossSheetResult.aiSummary" class="cross-summary-banner">
        <div class="summary-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
        </div>
        <div class="summary-text" v-html="formatAnalysis(crossSheetResult.aiSummary)"></div>
      </div>

      <!-- KPI 对比卡片 -->
      <div v-if="crossSheetResult.kpiComparison?.length" class="cross-kpi-section">
        <h3>各 Sheet 核心指标对比</h3>
        <el-table :data="crossSheetResult.kpiComparison" border stripe size="small">
          <el-table-column prop="sheetName" label="报表" min-width="180" fixed />
          <template v-for="kpiKey in crossSheetKpiKeys" :key="kpiKey">
            <el-table-column :label="kpiKey" min-width="120">
              <template #default="{ row }">
                {{ row.kpis?.[kpiKey] != null ? Number(row.kpis[kpiKey]).toLocaleString() : '-' }}
              </template>
            </el-table-column>
          </template>
        </el-table>
      </div>

      <!-- 综合图表 -->
      <div v-if="crossSheetResult.charts?.length" class="cross-charts-section">
        <h3>综合可视化</h3>
        <div class="cross-chart-grid">
          <div v-for="(chart, idx) in crossSheetResult.charts" :key="idx" class="cross-chart-item">
            <div class="chart-title">{{ chart.title || '分析图表' }}</div>
            <div :id="`cross-chart-${idx}`" class="cross-chart-container"></div>
          </div>
        </div>
      </div>
    </div>

    <el-empty v-else description="暂无综合分析数据" />
  </el-dialog>

  <!-- 同比分析对话框 -->
  <el-dialog v-model="yoyVisible" title="年度同比分析" width="90%" top="3vh">
    <!-- Sheet 选择器 -->
    <div v-if="!yoyLoading && !yoyResult" class="yoy-sheet-selector">
      <p style="margin-bottom: 12px; color: #606266;">选择要进行同比分析的报表：</p>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        <el-button
          v-for="sheet in dataSheets"
          :key="sheet.uploadId"
          @click="runYoYForSheet(sheet)"
          size="default"
        >
          {{ getSheetDisplayName(sheet) }}
        </el-button>
      </div>
    </div>

    <div v-if="yoyLoading" class="cross-sheet-loading">
      <el-icon class="is-loading" :size="48"><Loading /></el-icon>
      <p>正在查询历史数据并生成同比分析...</p>
    </div>

    <div v-else-if="yoyResult && yoyResult.success && yoyResult.comparison.length > 0">
      <div style="margin-bottom: 16px; color: #909399; font-size: 13px;">
        <span v-if="yoyResult.current_period">当期: {{ yoyResult.current_period }}</span>
        <span v-if="yoyResult.compare_period"> vs 对比期: {{ yoyResult.compare_period }}</span>
      </div>
      <YoYMoMComparisonChart
        :title="yoySheetName"
        :data="transformYoYData(yoyResult.comparison)"
        metric="金额"
        unit="元"
        :showViewToggle="true"
        defaultViewMode="yoy"
        :height="450"
      />
    </div>

    <div v-else-if="yoyResult && !yoyResult.success">
      <el-empty :description="yoyResult.error || '同比分析失败'" />
    </div>

    <div v-else-if="yoyResult && yoyResult.comparison.length === 0">
      <el-empty description="未找到可对比的历史数据。请确保已上传不同期间的同类报表。" />
    </div>
  </el-dialog>

  <!-- P5: 因果分析对话框 -->
  <el-dialog v-model="statisticalVisible" title="因果分析" width="90%" top="3vh" @closed="disposeStatHeatmap">
    <!-- Sheet 选择器 -->
    <div v-if="!statisticalLoading && !statisticalResult" class="yoy-sheet-selector">
      <p style="margin-bottom: 12px; color: #606266;">选择要分析的报表：</p>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        <el-button
          v-for="sheet in dataSheets"
          :key="sheet.uploadId"
          @click="runStatisticalAnalysis(sheet)"
          size="default"
        >
          {{ getSheetDisplayName(sheet) }}
        </el-button>
      </div>
    </div>

    <div v-else-if="statisticalLoading" class="cross-sheet-loading">
      <el-icon class="is-loading" :size="48"><Loading /></el-icon>
      <p>正在进行统计分析...</p>
    </div>

    <div v-else-if="statisticalResult && statisticalResult.success">
      <!-- 相关性热力图 -->
      <div v-if="statisticalResult.correlations?.matrix && Object.keys(statisticalResult.correlations.matrix).length >= 2" class="stat-section">
        <h3>相关性热力图</h3>
        <div id="stat-heatmap-chart" class="stat-chart-container" style="height: 450px;"></div>

        <!-- 强相关 pairs -->
        <div v-if="statisticalResult.correlations.strong_positive.length || statisticalResult.correlations.strong_negative.length" class="stat-pairs">
          <h4>关键相关性发现</h4>
          <div class="stat-pair-list">
            <el-tag v-for="(pair, i) in statisticalResult.correlations.strong_positive" :key="'pos-'+i" type="success" effect="light" size="default" style="margin: 4px;">
              {{ pair.var1 }} &harr; {{ pair.var2 }} (r={{ pair.correlation.toFixed(2) }}, 强正相关)
            </el-tag>
            <el-tag v-for="(pair, i) in statisticalResult.correlations.strong_negative" :key="'neg-'+i" type="danger" effect="light" size="default" style="margin: 4px;">
              {{ pair.var1 }} &harr; {{ pair.var2 }} (r={{ pair.correlation.toFixed(2) }}, 强负相关)
            </el-tag>
          </div>
        </div>
      </div>

      <!-- 分布分析 -->
      <div v-if="Object.keys(statisticalResult.distributions).length" class="stat-section">
        <h3>分布分析</h3>
        <el-table :data="distributionTableData" border stripe size="small" max-height="350">
          <el-table-column prop="column" label="指标" min-width="150" fixed />
          <el-table-column prop="mean" label="均值" min-width="100" />
          <el-table-column prop="median" label="中位数" min-width="100" />
          <el-table-column prop="std" label="标准差" min-width="100" />
          <el-table-column prop="min" label="最小值" min-width="100" />
          <el-table-column prop="max" label="最大值" min-width="100" />
          <el-table-column prop="distribution_type" label="分布类型" min-width="120">
            <template #default="{ row }">
              <el-tag :type="row.is_normal ? 'success' : 'warning'" size="small">
                {{ distributionTypeLabel(row.distribution_type) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="cv" label="变异系数" min-width="100" />
        </el-table>
      </div>

      <!-- 对比分析 (Pareto, 集中度) -->
      <div v-if="Object.keys(statisticalResult.comparisons).length" class="stat-section">
        <h3>集中度分析</h3>
        <div v-for="(comp, dim) in statisticalResult.comparisons" :key="dim" class="stat-comparison-card">
          <el-descriptions :title="`维度: ${dim}`" :column="3" border size="small">
            <el-descriptions-item label="CR3 (前3集中度)">{{ (comp.cr3 * 100).toFixed(1) }}%</el-descriptions-item>
            <el-descriptions-item label="CR5 (前5集中度)">{{ (comp.cr5 * 100).toFixed(1) }}%</el-descriptions-item>
            <el-descriptions-item label="基尼系数">{{ comp.gini_coefficient.toFixed(3) }}</el-descriptions-item>
            <el-descriptions-item label="帕累托数量">{{ comp.pareto_count }} / {{ comp.total_items }}</el-descriptions-item>
            <el-descriptions-item label="帕累托比例">{{ (comp.pareto_ratio * 100).toFixed(1) }}%</el-descriptions-item>
            <el-descriptions-item label="度量">{{ comp.measure }}</el-descriptions-item>
          </el-descriptions>
          <div class="stat-top-bottom">
            <div>
              <h5>Top 3</h5>
              <el-tag v-for="(val, key) in comp.top_3" :key="'top-'+key" type="success" effect="plain" style="margin: 2px;">
                {{ key }}: {{ Number(val).toLocaleString() }}
              </el-tag>
            </div>
            <div>
              <h5>Bottom 3</h5>
              <el-tag v-for="(val, key) in comp.bottom_3" :key="'bot-'+key" type="info" effect="plain" style="margin: 2px;">
                {{ key }}: {{ Number(val).toLocaleString() }}
              </el-tag>
            </div>
          </div>
        </div>
      </div>

      <!-- 异常值 -->
      <div v-if="Object.keys(statisticalResult.outlier_summary).length" class="stat-section">
        <h3>异常值检测</h3>
        <div class="stat-outlier-list">
          <el-tag v-for="(info, col) in statisticalResult.outlier_summary" :key="col" type="warning" effect="light" style="margin: 4px;">
            {{ col }}: {{ info.count }} 个异常值
          </el-tag>
        </div>
      </div>

      <div style="margin-top: 12px; color: #909399; font-size: 12px;">
        分析耗时: {{ statisticalResult.processing_time_ms }}ms
      </div>
    </div>

    <div v-else-if="statisticalResult && !statisticalResult.success">
      <el-empty :description="statisticalResult.error || '分析失败'" />
    </div>

    <template #footer>
      <div v-if="statisticalResult">
        <el-button @click="statisticalResult = null">返回选择</el-button>
        <el-button v-if="statisticalResult.success" type="primary" @click="statisticalVisible = false">关闭</el-button>
      </div>
    </template>
  </el-dialog>

  <!-- 数据预览 Dialog -->
  <el-dialog v-model="showDataPreview" :title="`数据预览 - ${previewSheetName}`" width="90%" top="5vh">
    <div v-loading="previewLoading">
      <el-table v-if="previewData?.data" :data="previewData.data" border stripe max-height="500" size="small">
        <el-table-column v-for="header in previewData.headers" :key="header"
          :prop="header" :label="header" min-width="120" show-overflow-tooltip />
      </el-table>
      <div v-if="previewData?.total" style="margin-top: 12px; display: flex; justify-content: center;">
        <el-pagination layout="prev, pager, next, total"
          :total="previewData.total" :page-size="50" :current-page="previewPage"
          @current-change="(p: number) => { previewPage = p; loadPreviewData(); }" />
      </div>
    </div>
  </el-dialog>

  <!-- Demo 演示引导 -->
  <DemoTour
    ref="demoTourRef"
    :data-ready="tourDataReady"
  />

  <!-- Q5: Keyboard shortcuts help overlay -->
  <ShortcutsHelpOverlay :visible="showShortcutsHelp" :shortcuts="shortcutsList" @close="showShortcutsHelp = false" />
</template>

<script setup lang="ts">
defineOptions({ name: 'SmartBIAnalysis' });
import { ref, reactive, computed, onMounted, onBeforeUnmount, onDeactivated, onActivated, nextTick, watch } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { post } from '@/api/request';
import { getUploadTableData, getUploadHistory, enrichSheetAnalysis, getSmartKPIs, chartDrillDown, crossSheetAnalysis, yoyComparison, renameMeaninglessColumns, statisticalAnalysis, invalidateAnalysisCache, retrySheetUpload, smartRecommendChart, buildChart, checkPythonHealth, humanizeColumnName, FOOD_TEMPLATES, mapColumnsToTemplate, detectFoodIndustryLocal } from '@/api/smartbi';
import type { FoodTemplate } from '@/api/smartbi';
import type { UploadHistoryItem, EnrichResult, EnrichProgress, ColumnSummary, StructuredAIData, SmartKPI, DrillDownResult as DrillDownResultType, CrossSheetResult as CrossSheetResultType, FinancialMetrics, YoYResult, YoYComparisonItem, StatisticalResult, PythonHealthStatus } from '@/api/smartbi';
import { ElMessage } from 'element-plus';
import { UploadFilled, Upload, Refresh, CircleCheckFilled, CircleCloseFilled, Loading, List, Document, Tickets, InfoFilled, ArrowRight, Pointer, DataAnalysis, TrendCharts, Download, Filter, Warning, WarningFilled, QuestionFilled, Share, CopyDocument, Link, Timer } from '@element-plus/icons-vue';
import type { UploadFile, UploadUserFile, UploadInstance } from 'element-plus';
import echarts from '@/utils/echarts';
import { defineAsyncComponent } from 'vue';
import KPICard from '@/components/smartbi/KPICard.vue';
import AIInsightPanel from '@/components/smartbi/AIInsightPanel.vue';
import ChartSkeleton from '@/components/smartbi/ChartSkeleton.vue';
// T3.1: Lazy-load rarely-used components — only loaded when user triggers them
const YoYMoMComparisonChart = defineAsyncComponent(() => import('@/components/smartbi/YoYMoMComparisonChart.vue'));
const ChartTypeSelector = defineAsyncComponent(() => import('@/components/smartbi/ChartTypeSelector.vue'));
const ChartConfigPanel = defineAsyncComponent(() => import('@/components/smartbi/ChartConfigPanel.vue'));
const DashboardBuilder = defineAsyncComponent(() => import('@/components/smartbi/DashboardBuilder.vue'));
const DemoTour = defineAsyncComponent(() => import('@/components/smartbi/DemoTour.vue'));
const SmartBIEmptyState = defineAsyncComponent(() => import('@/components/smartbi/SmartBIEmptyState.vue'));
const ShortcutsHelpOverlay = defineAsyncComponent(() => import('@/components/smartbi/ShortcutsHelpOverlay.vue'));
import type { DashboardLayout, DashboardCard, ChartDefinition } from '@/components/smartbi/DashboardBuilder.vue';
import type { ComparisonData } from '@/components/smartbi/YoYMoMComparisonChart.vue';
import type { AIInsight } from '@/components/smartbi/AIInsightPanel.vue';
import { saveDemoCache, loadDemoCache } from '@/utils/demo-cache';
import type { DemoCacheData } from '@/utils/demo-cache';
import { useSmartBIShortcuts } from '@/composables/useSmartBIShortcuts';
import { useSmartBIDrillDown } from './composables/useSmartBIDrillDown';
import { useSmartBIStatistical } from './composables/useSmartBIStatistical';
import { useSmartBICrossSheet } from './composables/useSmartBICrossSheet';
import { useSmartBIDashboardLayout } from './composables/useSmartBIDashboardLayout';

const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);
const permissionStore = usePermissionStore();
const canUpload = computed(() => permissionStore.canWrite('analytics'));

// 历史批次
interface UploadBatch {
  fileName: string;
  uploadTime: string;
  sheetCount: number;
  totalRows: number;
  uploads: UploadHistoryItem[];
  uploadId?: number;
  id?: number;
}
const uploadBatches = ref<UploadBatch[]>([]);
const selectedBatchIndex = ref<number>(0);
const historyLoading = ref(false);
const batchSwitching = ref(false);  // U6: loading feedback when switching data source

// Python 服务健康状态
const pythonHealthStatus = ref<PythonHealthStatus | null>(null);
const pythonUnavailable = computed(() => {
  if (!pythonHealthStatus.value) return false;
  return !pythonHealthStatus.value.available;
});

/** Check Python health with exponential backoff retry (1s, 2s, 4s) */
async function checkHealthWithRetry(maxRetries = 3): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await checkPythonHealth();
      if (res?.data) {
        pythonHealthStatus.value = res.data;
        if (res.data.available) return true;
      }
    } catch { /* ignore */ }
    if (i < maxRetries - 1) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
  }
  pythonHealthStatus.value = { enabled: false, available: false, llmConfigured: false, consecutiveFailures: maxRetries, lastCheckMs: Date.now(), url: '' };
  return false;
}

/** Null-safe batch file name — fallback chain handles null/undefined from API or cache */
const safeBatchName = (batch: UploadBatch): string => {
  const candidates = [
    batch.fileName,
    (batch as Record<string, unknown>).batchName as string | undefined,
    (batch as Record<string, unknown>).originalFileName as string | undefined,
  ];
  for (const name of candidates) {
    if (name && name !== 'null' && name !== 'undefined' && name.trim() !== '') return name;
  }
  // Last resort: generate from upload time or batch id
  if (batch.uploadTime) return `Excel_${batch.uploadTime.replace(/[- :]/g, '')}`;
  const batchId = (batch as Record<string, unknown>).uploadId ?? (batch as Record<string, unknown>).id;
  return batchId ? `Upload #${batchId}` : 'Excel数据';
};
/** 判断批次是否来自自动同步 (detectedTableType === 'AUTO_PRODUCTION') */
const isAutoSyncBatch = (batch: UploadBatch): boolean => {
  return batch.uploads.some(u => u.tableType === 'AUTO_PRODUCTION');
};

/** Formatted label for dropdown: "[自动同步] 文件名 (N 表)" or "文件名 (N 表)" */
const formatBatchLabel = (batch: UploadBatch): string => {
  const prefix = isAutoSyncBatch(batch) ? '[自动同步] ' : '';
  return `${prefix}${safeBatchName(batch)} (${batch.sheetCount} 表)`;
};

// 上传相关
const uploadRef = ref<UploadInstance>();
const fileList = ref<UploadUserFile[]>([]);
const uploading = ref(false);
const uploadProgress = ref(0);
const uploadStatus = ref<'success' | 'exception' | 'warning' | undefined>();
const progressText = ref('');

// Sheet 数据
interface SheetResult {
  sheetIndex: number;
  sheetName: string;
  success: boolean;
  message: string;
  detectedDataType?: string;
  savedRows?: number;
  uploadId?: number;
  tableType?: 'index' | 'data' | 'summary' | 'metadata' | 'unknown';
  flowResult?: {
    recommendedChartType?: string;
    chartConfig?: any;
    aiAnalysis?: string;
    recommendedTemplates?: any[];
    charts?: Array<{ chartType: string; title: string; config: Record<string, unknown>; totalItems?: number }>;
    kpiSummary?: { rowCount: number; columnCount: number; columns: ColumnSummary[] };
    structuredAI?: StructuredAIData;
  };
}

// 索引页映射
interface IndexSheetMapping {
  index: number;
  reportName: string;
  sheetName: string;
  description?: string;
}

// 索引元数据
interface IndexMetadata {
  hasIndex: boolean;
  indexSheetIndex?: number;
  sheetMappings: IndexSheetMapping[];
}

interface BatchUploadResult {
  totalSheets: number;
  successCount: number;
  failedCount: number;
  requiresConfirmationCount: number;
  totalSavedRows: number;
  message: string;
  results: SheetResult[];
  indexMetadata?: IndexMetadata;
}

const uploadedSheets = ref<SheetResult[]>([]);
const uploadResult = ref<BatchUploadResult | null>(null);
const activeTab = ref('');
const indexMetadata = ref<IndexMetadata | null>(null);

// 数据预览
const showDataPreview = ref(false);
const previewLoading = ref(false);
const previewData = ref<{ headers: string[]; data: Record<string, unknown>[]; total: number; totalPages: number } | null>(null);
const previewPage = ref(1);
const previewSheetName = ref('');
const previewUploadId = ref<number>(0);

// Sheet retry 状态
const retryingSheets = reactive<Record<number, boolean>>({});

// Enrichment 状态 (前端驱动的图表/AI补充)
const enrichingSheets = ref<Set<number>>(new Set());
const enrichedSheets = ref<Set<number>>(new Set());
// P0: Progressive rendering phase tracking
interface EnrichPhaseState {
  kpi: boolean;
  charts: number;       // count of charts loaded so far
  chartsTotal: number;  // expected total charts
  ai: boolean;
}
const enrichPhases = ref<Map<number, EnrichPhaseState>>(new Map());
// R-21: 缓存 enrichment 获取的原始数据，避免 drill-down 重复请求
const sheetRawDataCache = new Map<number, Record<string, unknown>[]>();
// 缓存时间戳：uploadId → cachedAt ISO string
const cachedAtMap = ref<Map<number, string>>(new Map());

// A6: 食品行业检测结果
const foodIndustryDetection = ref<{
  is_food_industry: boolean;
  confidence: number;
  detected_categories: string[];
  matched_keywords: string[];
  suggested_benchmarks: string[];
  suggested_standards: string[];
} | null>(null);

// P1: 食品行业模板
const foodTemplates = FOOD_TEMPLATES;
const activeTemplate = ref<string>('');

// 下钻分析 (composable — lazy deps resolved at call time)
const {
  drillDownVisible, drillDownLoading, drillDownResult, drillDownContext,
  drillStack, currentDrillSheet,
  handleChartDrillDown, drillByDimension, drillBackToRoot, drillBackTo, inferMeasures,
} = useSmartBIDrillDown({
  sheetRawDataCache,
  processEChartsOptions: (opts: Record<string, unknown>) => processEChartsOptions(opts),
  waitForElement: (id: string) => waitForElement(id),
  getSheetCharts: (s: unknown) => getSheetCharts(s as SheetResult),
});

// Global filter state
const globalFilterDimension = ref('');
const globalFilterValues = ref<string[]>([]);

// Q1: Data filtering state
const filteredRawData = ref<Record<string, any>[] | null>(null);
const totalRowCount = ref(0);
const filteredRowCount = ref(0);

// Q2: Auto-refresh state
const autoRefreshInterval = ref<number>(0);
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null;

// 综合分析状态
// ========== Share Dialog ==========
const shareDialogVisible = ref(false);
const shareLink = ref('');
const shareFullUrl = ref('');
const shareTitle = ref('');
const shareTTL = ref(7);
const shareCreating = ref(false);

const openShareDialog = () => {
  shareLink.value = '';
  shareFullUrl.value = '';
  const batch = uploadBatches.value[selectedBatchIndex.value];
  shareTitle.value = batch?.fileName || batch?.batchName || '数据分析报告';
  shareTTL.value = 7;
  shareDialogVisible.value = true;
};

const createShareLink = async () => {
  const batch = uploadBatches.value[selectedBatchIndex.value];
  if (!batch?.uploadId && !batch?.id) {
    ElMessage.warning('请先选择一个上传数据');
    return;
  }
  shareCreating.value = true;
  try {
    const fId = factoryId.value || 'F001';
    const uploadId = batch.uploadId || batch.id;
    const resp = await post(`/${fId}/smart-bi/share`, {
      uploadId,
      title: shareTitle.value,
      ttlDays: shareTTL.value,
      sheetIndex: activeTab.value,
    });
    if (resp.success) {
      const token = resp.data.token;
      shareLink.value = token;
      shareFullUrl.value = `${window.location.origin}/smart-bi/share/${token}`;
    } else {
      ElMessage.error(resp.message || '创建分享链接失败');
    }
  } catch (e: unknown) {
    ElMessage.error('创建分享链接失败');
    console.error('Share link creation failed:', e);
  } finally {
    shareCreating.value = false;
  }
};

const copyShareLink = async () => {
  try {
    await navigator.clipboard.writeText(shareFullUrl.value);
    ElMessage.success('链接已复制到剪贴板');
  } catch {
    // Fallback for older browsers
    const input = document.createElement('input');
    input.value = shareFullUrl.value;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    ElMessage.success('链接已复制');
  }
};

// 综合分析 (composable)
const {
  crossSheetVisible, crossSheetLoading, crossSheetResult, crossSheetKpiKeys,
  openCrossSheetAnalysis: _openCrossSheet, renderCrossSheetCharts,
} = useSmartBICrossSheet({
  processEChartsOptions: (opts: Record<string, unknown>) => processEChartsOptions(opts),
  resolveEChartsOptions: (config: Record<string, unknown>) => resolveEChartsOptions(config),
  enhanceChartOption: (opts: Record<string, unknown>) => enhanceChartOption(opts),
  waitForElement: (id: string) => waitForElement(id),
  isIndexSheet: (s: unknown) => isIndexSheet(s as SheetResult),
  getSheetDisplayName: (s: unknown) => getSheetDisplayName(s as SheetResult),
});
const openCrossSheetAnalysis = () => _openCrossSheet(uploadedSheets.value);

// 同比分析状态
const yoyVisible = ref(false);
const yoyLoading = ref(false);
const yoyResult = ref<YoYResult | null>(null);
const yoySheetName = ref('');
const dataSheets = computed(() => uploadedSheets.value.filter(s => !isIndexSheet(s) && s.uploadId && s.success));

// 因果分析 (composable)
const {
  statisticalVisible, statisticalLoading, statisticalResult,
  distributionTableData, distributionTypeLabel,
  openStatisticalAnalysis, runStatisticalAnalysis, disposeStatHeatmap,
} = useSmartBIStatistical({ sheetRawDataCache });

// 仪表板布局 (composable)
const {
  layoutEditMode, dashboardLayouts, availableChartDefinitions,
  chartsToLayout, handleLayoutChange, handleLayoutSave,
  saveLayout, loadSavedLayout,
  getCachedLayout: _getCachedLayout,
} = useSmartBIDashboardLayout();
const getCachedLayout = (sheet: SheetResult) => _getCachedLayout(sheet, getSheetCharts);

// ========== Demo 缓存 & Tour 引导 ==========
const usingDemoCache = ref(false);
const demoCacheFileName = ref('');
const demoTourRef = ref<InstanceType<typeof DemoTour> | null>(null);
const tourDataReady = ref(false);

// (DemoTour 通过 CSS 选择器自动定位目标元素，无需手动传 ref)

/** 构建 DemoCacheData 用于保存 */
const buildDemoCacheData = (): DemoCacheData | null => {
  if (uploadedSheets.value.length === 0 || !uploadResult.value) return null;
  const batch = uploadBatches.value[selectedBatchIndex.value];
  return {
    uploadBatch: {
      fileName: batch ? safeBatchName(batch) : 'unknown',
      uploadTime: batch?.uploadTime || new Date().toISOString(),
      sheetCount: uploadedSheets.value.length,
      totalRows: uploadResult.value.totalSavedRows,
    },
    sheets: uploadedSheets.value.map(s => ({
      sheetIndex: s.sheetIndex,
      sheetName: s.sheetName,
      success: s.success,
      message: s.message,
      detectedDataType: s.detectedDataType,
      savedRows: s.savedRows,
      uploadId: s.uploadId,
      tableType: s.tableType,
      flowResult: s.flowResult ? {
        recommendedChartType: s.flowResult.recommendedChartType,
        chartConfig: s.flowResult.chartConfig,
        aiAnalysis: s.flowResult.aiAnalysis,
        charts: s.flowResult.charts,
        kpiSummary: s.flowResult.kpiSummary,
        structuredAI: s.flowResult.structuredAI,
        financialMetrics: (s.flowResult as any).financialMetrics,
      } : undefined,
    })),
    uploadResult: {
      totalSheets: uploadResult.value.totalSheets,
      successCount: uploadResult.value.successCount,
      failedCount: uploadResult.value.failedCount,
      requiresConfirmationCount: uploadResult.value.requiresConfirmationCount,
      totalSavedRows: uploadResult.value.totalSavedRows,
      message: uploadResult.value.message,
    },
    indexMetadata: indexMetadata.value || undefined,
  };
};

/** 检查当前数据是否 "enrichment 完成" (至少一半 sheet 有图表) 并自动缓存 */
const tryAutoSaveDemoCache = () => {
  const dataSheetList = uploadedSheets.value.filter(s => !isIndexSheet(s) && s.success);
  if (dataSheetList.length === 0) return;
  const enrichedCount = dataSheetList.filter(s => hasChartData(s) && s.flowResult?.aiAnalysis).length;
  // 至少一半的 sheet 完成了 enrichment 才缓存
  if (enrichedCount < Math.ceil(dataSheetList.length / 2)) return;

  const firstUploadId = uploadedSheets.value.find(s => s.uploadId)?.uploadId;
  if (!firstUploadId) return;

  const cacheData = buildDemoCacheData();
  if (cacheData) {
    saveDemoCache(firstUploadId, cacheData);
  }
};

/** 从缓存恢复数据 */
const restoreFromDemoCache = (): boolean => {
  const cached = loadDemoCache();
  if (!cached) return false;

  // 恢复 sheets
  uploadedSheets.value = cached.sheets.map(s => ({
    ...s,
    tableType: s.tableType as SheetResult['tableType'],
  }));

  // 恢复 uploadResult
  uploadResult.value = {
    ...cached.uploadResult,
    results: uploadedSheets.value,
  };

  // 恢复 indexMetadata
  if (cached.indexMetadata) {
    indexMetadata.value = cached.indexMetadata;
  }

  // 恢复批次信息
  uploadBatches.value = [{
    fileName: cached.uploadBatch.fileName,
    uploadTime: cached.uploadBatch.uploadTime,
    sheetCount: cached.uploadBatch.sheetCount,
    totalRows: cached.uploadBatch.totalRows,
    uploadId: cached.uploadId,
    id: cached.uploadId,
    uploads: [] as UploadHistoryItem[],
  }];
  selectedBatchIndex.value = 0;

  // 设置 active tab
  const firstSuccess = uploadedSheets.value.find(s => s.success && !isIndexSheet(s as SheetResult));
  activeTab.value = String((firstSuccess || uploadedSheets.value[0]).sheetIndex);

  usingDemoCache.value = true;
  demoCacheFileName.value = cached.uploadBatch.fileName;

  return true;
};

/** 重新触发 Tour 引导 */
const startDemoTour = () => {
  demoTourRef.value?.startTour();
};

/** 刷新数据 (清除缓存，重新从服务器加载) */
const refreshFromServer = () => {
  usingDemoCache.value = false;
  demoCacheFileName.value = '';
  uploadedSheets.value = [];
  uploadResult.value = null;
  enrichedSheets.value = new Set();
  enrichingSheets.value = new Set();
  enrichPhases.value = new Map();
  activeTab.value = '';
  tourDataReady.value = false;
  loadHistory();
};

// ========== Cross-chart filter state (Phase 3.4) ==========
const activeFilter = ref<{ dimension: string; value: string } | null>(null);

// ========== Debounce timer for tab switch (Phase 2.3) ==========
let renderDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// ========== Hover throttle timers per chart (avoid closure leak on tab switch) ==========
const hoverThrottleTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearHoverThrottleTimers() {
  hoverThrottleTimers.forEach(timer => clearTimeout(timer));
  hoverThrottleTimers.clear();
}

// 获取 Sheet 的所有图表（多图表优先，单图表兼容）
const getSheetCharts = (sheet: SheetResult): Array<{ chartType: string; title: string; config: Record<string, unknown>; xField?: string; totalItems?: number }> => {
  if (sheet.flowResult?.charts?.length) return sheet.flowResult.charts;
  if (sheet.flowResult?.chartConfig) return [{ chartType: 'bar', title: '数据分析', config: sheet.flowResult.chartConfig }];
  return [];
};

// 判断 sheet 是否有图表数据
const hasChartData = (sheet: SheetResult): boolean => {
  const charts = getSheetCharts(sheet);
  return charts.length > 0 && charts.some(c => c.config && !isChartDataEmpty(c.config));
};

// 智能 KPI 选择（使用 smartbi.ts 的 getSmartKPIs），带缓存避免重复计算 (R-18)
const kpiCache = new Map<string, SmartKPI[]>();
const computeSmartKPIs = (
  kpiSummary: { rowCount: number; columnCount: number; columns: ColumnSummary[] },
  financialMetrics?: FinancialMetrics | null
): SmartKPI[] => {
  const cacheKey = `${kpiSummary.rowCount}-${kpiSummary.columnCount}-${kpiSummary.columns?.length}-${financialMetrics ? 'fm' : ''}`;
  const cached = kpiCache.get(cacheKey);
  if (cached) return cached;
  const result = getSmartKPIs(kpiSummary, financialMetrics);
  kpiCache.set(cacheKey, result);
  return result;
};

// 获取 Sheet 的 KPI 列表（用于模板中）
const getSheetKPIs = (sheet: SheetResult): SmartKPI[] => {
  if (!sheet.flowResult?.kpiSummary) return [];
  return computeSmartKPIs(sheet.flowResult.kpiSummary, sheet.flowResult?.financialMetrics);
};

// 获取高管摘要
const getExecutiveSummary = (sheet: SheetResult): string => {
  return sheet.flowResult?.structuredAI?.executiveSummary || '';
};

// 构建 AIInsightPanel 所需的结构化数据
const getStructuredInsight = (sheet: SheetResult): AIInsight | null => {
  const structured = sheet.flowResult?.structuredAI;
  const aiText = sheet.flowResult?.aiAnalysis || sheet.flowResult?.chartConfig?.aiAnalysis || '';

  // 必须有结构化数据或 AI 文本
  if (!structured && !aiText) return null;

  const positive: string[] = [];
  const negative: string[] = [];
  const suggestions: string[] = [];

  // 从结构化数据分类
  if (structured) {
    if (structured.riskAlerts?.length) {
      for (const r of structured.riskAlerts) {
        negative.push(`${r.title}: ${r.description}${r.mitigation ? ` (建议: ${r.mitigation})` : ''}`);
      }
    }
    if (structured.opportunities?.length) {
      for (const o of structured.opportunities) {
        suggestions.push(`${o.title}: ${o.description}${o.action_required ? ` → ${o.action_required}` : ''}`);
      }
    }
  }

  // 从 AI 文本中提取（按 sentiment 分类）
  if (aiText) {
    const lines = aiText.split('\n\n').filter(Boolean);
    for (const line of lines) {
      const cleanLine = line.replace(/\*\*/g, '').trim();
      if (!cleanLine) continue;

      // 启发式分类（R-20: 先检查负面关键词，避免"增长下降"误判为正面）
      if (/negative|下降|风险|异常|低于|不足|减少|亏损|下滑|萎缩/i.test(cleanLine)) {
        negative.push(cleanLine);
      } else if (/recommendation|建议|改进|优化|应该|需要|可以/i.test(cleanLine)) {
        suggestions.push(cleanLine);
      } else if (/positive|增长|提升|良好|突出|达到|超过|上升|盈利/i.test(cleanLine)) {
        suggestions.push(cleanLine);
      } else {
        // 默认放到 positive
        positive.push(cleanLine);
      }
    }
  }

  // 至少有一个分组有内容
  if (positive.length === 0 && negative.length === 0 && suggestions.length === 0) {
    return null;
  }

  return {
    positive: { title: '积极发现', items: positive },
    negative: { title: '风险关注', items: negative },
    suggestions: { title: '改进建议', items: suggestions },
    generatedAt: new Date().toISOString()
  };
};

// 获取敏感性分析数据
const getSensitivityAnalysis = (sheet: SheetResult): Array<{ factor: string; current_value: string; impact_description: string }> | undefined => {
  return sheet.flowResult?.structuredAI?.sensitivityAnalysis;
};

// 获取 Sheet 显示名称（优先使用索引页的报表名）
const getSheetDisplayName = (sheet: SheetResult): string => {
  if (indexMetadata.value?.hasIndex) {
    const mapping = indexMetadata.value.sheetMappings.find(
      m => m.index === sheet.sheetIndex
    );
    if (mapping?.reportName) {
      return mapping.reportName;
    }
  }
  return sheet.sheetName;
};

// 获取 Sheet 的编制说明
const getSheetDescription = (sheet: SheetResult): string | undefined => {
  if (indexMetadata.value?.hasIndex) {
    const mapping = indexMetadata.value.sheetMappings.find(
      m => m.index === sheet.sheetIndex
    );
    return mapping?.description;
  }
  return undefined;
};

// 判断是否为索引页
const isIndexSheet = (sheet: SheetResult): boolean => {
  return sheet.tableType === 'index' ||
    sheet.sheetIndex === indexMetadata.value?.indexSheetIndex;
};

// SSE 进度相关
interface SheetProgress {
  sheetIndex: number;
  sheetName: string;
  stage: string;
  message: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
}

const sheetProgressList = ref<SheetProgress[]>([]);
const totalSheetCount = ref(0);
const completedSheetCount = ref(0);
const dictionaryHits = ref(0);
const llmAnalyzedFields = ref(0);

// Sheet 预览信息
interface SheetInfo {
  index: number;
  name: string;
  rowCount: number;
  columnCount: number;
}

const availableSheets = ref<SheetInfo[]>([]);
const selectedSheets = ref<number[]>([]);

// 文件选择
const handleFileChange = (file: UploadFile) => {
  if (file.size! > 50 * 1024 * 1024) {
    ElMessage.error('文件大小不能超过 50MB');
    fileList.value = [];
    return;
  }
  fileList.value = [file];
};

// 预览 Sheet 列表
const previewSheets = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await post<{ data: SheetInfo[] }>(
      `/${factoryId.value}/smart-bi/sheets`,
      formData,
      { timeout: 120000 } // 2分钟超时，LLM分析需要较长时间
    );

    if (response.success && response.data) {
      availableSheets.value = response.data;
      // 默认选择所有非空 Sheet
      selectedSheets.value = response.data
        .filter(s => s.rowCount > 0)
        .map(s => s.index);
      return true;
    }
    return false;
  } catch (error: any) {
    ElMessage.error(`预览失败: ${error.message || '未知错误'}`);
    return false;
  }
};

// 上传文件 (使用 SSE 流式进度)
const uploadFile = async () => {
  if (fileList.value.length === 0) {
    ElMessage.warning('请先选择文件');
    return;
  }

  const file = fileList.value[0].raw;
  if (!file) return;

  // 重置状态
  uploading.value = true;
  uploadProgress.value = 5;
  progressText.value = '正在预览 Sheet 列表...';
  sheetProgressList.value = [];
  totalSheetCount.value = 0;
  completedSheetCount.value = 0;
  dictionaryHits.value = 0;
  llmAnalyzedFields.value = 0;
  uploadStatus.value = undefined;

  // 1. 预览 Sheets
  const previewSuccess = await previewSheets(file);
  if (!previewSuccess) {
    uploading.value = false;
    return;
  }

  uploadProgress.value = 10;
  progressText.value = '准备上传...';

  // 2. 构建 Sheet 配置
  // headerRow: -1 表示使用 Python auto-parse 的自动检测功能
  // Python StructureDetector 会自动识别标题行、合并单元格、数据起始行
  const sheetConfigs = availableSheets.value
    .filter(s => s.rowCount > 0)
    .map(s => ({
      sheetIndex: s.index,
      headerRow: -1,  // 让 Python /auto-parse 自动检测，不再硬编码
      autoConfirm: true
    }));

  // 初始化 Sheet 进度列表
  sheetProgressList.value = sheetConfigs.map(config => {
    const sheetInfo = availableSheets.value.find(s => s.index === config.sheetIndex);
    return {
      sheetIndex: config.sheetIndex,
      sheetName: sheetInfo?.name || `Sheet ${config.sheetIndex}`,
      stage: '等待中',
      message: '',
      status: 'pending' as const
    };
  });

  // 3. 使用 SSE 流式上传
  const formData = new FormData();
  formData.append('file', file);
  formData.append('sheetConfigs', JSON.stringify(sheetConfigs));

  try {
    progressText.value = '开始处理...';

    // 使用 fetch + ReadableStream 处理 SSE
    // VITE_API_BASE_URL 已包含 /api/mobile，不需要重复
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/mobile';
    const url = `${baseUrl}/${factoryId.value}/smart-bi/upload-batch-stream`;

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('无法获取响应流');
    }

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 解析 SSE 事件
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留不完整的行

      for (const line of lines) {
        if (line.startsWith('data:')) {
          try {
            const eventData = JSON.parse(line.substring(5));
            handleSSEEvent(eventData);
          } catch (e) {
            console.warn('Failed to parse SSE data:', line);
          }
        }
      }
    }

    // 处理最后一个事件
    if (buffer.startsWith('data:')) {
      try {
        const eventData = JSON.parse(buffer.substring(5));
        handleSSEEvent(eventData);
      } catch (e) {
        // ignore
      }
    }

  } catch (error: any) {
    uploadStatus.value = 'exception';
    progressText.value = '上传失败';
    ElMessage.error(`上传失败: ${error.message || '未知错误'}`);
    uploading.value = false; // 错误时立即停止上传状态
  }
};

// 处理 SSE 事件
const handleSSEEvent = (event: any) => {
  const { type, progress, sheetIndex, sheetName, stage, message, completedSheets, totalSheets, dictionaryHits: dictHits, llmAnalyzedFields: llmFields, result } = event;

  // 更新总体进度
  if (progress) {
    uploadProgress.value = progress;
  }
  if (totalSheets) {
    totalSheetCount.value = totalSheets;
  }
  if (completedSheets !== undefined) {
    completedSheetCount.value = completedSheets;
  }
  if (dictHits !== undefined && dictHits !== null) {
    dictionaryHits.value += dictHits;
  }
  if (llmFields !== undefined && llmFields !== null) {
    llmAnalyzedFields.value += llmFields;
  }

  // 更新进度文本
  if (message) {
    progressText.value = message;
  }

  // 更新 Sheet 进度
  if (sheetIndex !== undefined && sheetIndex !== null) {
    const sheetProgress = sheetProgressList.value.find(s => s.sheetIndex === sheetIndex);
    if (sheetProgress) {
      if (stage) sheetProgress.stage = stage;
      if (message) sheetProgress.message = message;

      // 根据事件类型设置状态
      switch (type) {
        case 'SHEET_START':
        case 'PARSING':
        case 'FIELD_MAPPING':
        case 'LLM_ANALYZING':
        case 'PERSISTING':
        case 'CHART_GENERATING':
          sheetProgress.status = 'processing';
          break;
        case 'SHEET_COMPLETE':
          sheetProgress.status = 'complete';
          break;
        case 'SHEET_FAILED':
          sheetProgress.status = 'failed';
          break;
      }
    }
  }

  // 处理完成事件
  if (type === 'COMPLETE' && result) {
    uploadStatus.value = 'success';
    progressText.value = '分析完成！';
    uploadResult.value = result;
    // Include both successful AND failed sheets (failed ones get retry button)
    uploadedSheets.value = result.results || [];

    // 捕获索引元数据
    if (result.indexMetadata) {
      indexMetadata.value = result.indexMetadata;
    }

    if (uploadedSheets.value.length > 0) {
      // Prefer first successful sheet as active tab
      const firstSuccess = uploadedSheets.value.find(s => s.success);
      activeTab.value = String((firstSuccess || uploadedSheets.value[0]).sheetIndex);

      // 重要：先设置 uploading = false，让 DOM 渲染出来，然后再渲染图表
      uploading.value = false;

      // 等待 DOM 更新后再渲染图表
      nextTick(() => {
        setTimeout(() => {
          renderActiveChart();
        }, 100); // 额外延迟确保 DOM 完全渲染
      });

      // R-16: 只 enrich 当前 active tab + 下一个 sheet，避免并发雪崩
      const dataSheets = uploadedSheets.value.filter(s => !isIndexSheet(s) && s.uploadId);
      const sheetsToEnrich = dataSheets.slice(0, 2); // active + next
      for (const sheet of sheetsToEnrich) {
        const sheetHasCharts = hasChartData(sheet);
        const hasAI = !!sheet.flowResult?.aiAnalysis;
        if ((!sheetHasCharts || !hasAI) && sheet.uploadId) {
          enrichSheet(sheet);
        }
      }
    }

    ElMessage.success(result.message || '上传成功');

    // Re-check Python health after upload (enrichment needs it)
    checkHealthWithRetry(2).catch(() => {});
  }

  // 处理错误事件
  if (type === 'ERROR') {
    uploadStatus.value = 'exception';
    progressText.value = event.error || '处理失败';
    ElMessage.error(event.error || '处理失败');
  }
};

/** Animation registry — stagger delays by named key */
const ANIM_REGISTRY: Record<string, (idx: number) => number> = {
  stagger_80: (idx) => idx * 80,
  stagger_60: (idx) => idx * 60,
  stagger_5:  (idx) => idx * 5,
};

/** Formatter registry — tooltip/label callbacks by named key */
/* eslint-disable @typescript-eslint/no-explicit-any */
const FMT_REGISTRY: Record<string, (...args: any[]) => string> = {
  boxplot_tooltip: (p: any) => {
    const d = p.data;
    return `${p.name}<br/>最小: ${d[0]}<br/>Q1: ${d[1]}<br/>中位数: ${d[2]}<br/>Q3: ${d[3]}<br/>最大: ${d[4]}`;
  },
  correlation_tooltip: (p: any) => p.data[2].toFixed(2),
  correlation_label: (p: any) => p.data[2].toFixed(1),
  quadrant_scatter_tooltip: (p: any) =>
    `${p.data[2]}<br/>收入: ${Number(p.data[0]).toLocaleString()}<br/>利润率: ${p.data[1]}%`,
  quadrant_scatter_label: (p: any) => p.data[2],
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Process ECharts options: resolve __ANIM__/__FMT__ named references from Python.
 * No eval/new Function — all callbacks are pre-registered above.
 */
const processEChartsOptions = (opts: Record<string, unknown>): Record<string, unknown> => {
  const processValue = (val: unknown): unknown => {
    if (typeof val === 'string') {
      if (val.startsWith('__ANIM__')) return ANIM_REGISTRY[val.slice(8)] ?? val;
      if (val.startsWith('__FMT__'))  return FMT_REGISTRY[val.slice(7)] ?? val;
    }
    if (Array.isArray(val)) return val.map(processValue);
    if (val && typeof val === 'object') {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        result[k] = processValue(v);
      }
      return result;
    }
    return val;
  };
  return processValue(opts) as Record<string, unknown>;
};

/**
 * Resolve ECharts options from various config formats
 */
const resolveEChartsOptions = (config: Record<string, unknown>): Record<string, unknown> | null => {
  if ((config as any).series || (config as any).xAxis || (config as any).yAxis) {
    return config;
  } else if (typeof (config as any).chartOptions === 'string') {
    try { return JSON.parse((config as any).chartOptions); } catch { return null; }
  } else if ((config as any).options) {
    return (config as any).options;
  }
  return null;
};

/**
 * Add anomaly markPoints + mean markLine to chart (Phase 3.1)
 * anomalies comes from Python chart_builder IQR detection
 */
const applyAnomalyOverlay = (opts: Record<string, unknown>, anomalies: Record<string, any>) => {
  if (!anomalies || !opts) return;
  const series = (opts as any).series;
  if (!Array.isArray(series)) return;

  for (const s of series) {
    const colName = s.name;
    const anomalyData = anomalies[colName];
    if (!anomalyData) continue;

    // Mean reference line (Grafana style)
    if (anomalyData.mean != null) {
      s.markLine = {
        silent: true,
        symbol: 'none',
        lineStyle: { type: 'dashed', color: '#9ca3af', width: 1 },
        label: { formatter: `均值: ${anomalyData.mean}`, position: 'insideEndTop', fontSize: 11, color: '#9ca3af' },
        data: [{ yAxis: anomalyData.mean }]
      };
    }

    // Outlier red dots (ThoughtSpot SpotIQ)
    if (anomalyData.outliers?.length) {
      s.markPoint = {
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: { color: '#dc2626', borderColor: '#fff', borderWidth: 1 },
        label: { show: false },
        data: anomalyData.outliers.map((o: any) => ({
          xAxis: o.index,
          yAxis: o.value,
          value: `${o.deviation > 0 ? '+' : ''}${o.deviation}σ`
        }))
      };
    }
  }
};

// 综合图表增强：DataZoom + 标签自适应 + 近零值 + 零值标签隐藏 + 图例人性化 + 离群值 + 万/亿格式化
const enhanceChartOption = (opts: Record<string, unknown>): void => {
  // Helper: extract all numeric values from series data
  const getSeriesStats = (o: Record<string, unknown>): { max: number; min: number; count: number; nonZeroMin: number; zeroCount: number; median: number } => {
    const series = (o as any).series;
    if (!Array.isArray(series)) return { max: 0, min: 0, count: 0, nonZeroMin: Infinity, zeroCount: 0, median: 0 };
    let maxVal = 0, minVal = Infinity, count = 0, nonZeroMin = Infinity, zeroCount = 0;
    const allValues: number[] = [];
    for (const s of series) {
      const data = s?.data;
      if (!Array.isArray(data)) continue;
      for (const d of data) {
        const v = typeof d === 'number' ? d : (Array.isArray(d) ? Number(d[1]) || 0 : Number(d?.value) || 0);
        const abs = Math.abs(v);
        allValues.push(abs);
        if (abs > maxVal) maxVal = abs;
        if (abs < minVal) minVal = abs;
        if (abs > 0 && abs < nonZeroMin) nonZeroMin = abs;
        if (v === 0) zeroCount++;
        count++;
      }
    }
    // Compute median for outlier detection
    allValues.sort((a, b) => a - b);
    const median = allValues.length > 0 ? allValues[Math.floor(allValues.length / 2)] : 0;
    return { max: maxVal, min: minVal, count, nonZeroMin, zeroCount, median };
  };

  const stats = getSeriesStats(opts);
  const xAxis = (opts as any).xAxis;
  const yAxis = (opts as any).yAxis;
  const series = (opts as any).series;
  const chartType = Array.isArray(series) ? series[0]?.type : '';

  // === D2: 图例名称人性化 ===
  if (Array.isArray(series)) {
    for (const s of series) {
      if (s.name && typeof s.name === 'string') {
        s.name = humanizeColumnName(s.name);
      }
    }
  }
  // Legend data humanization
  const legend = (opts as any).legend;
  if (legend && Array.isArray(legend.data)) {
    legend.data = legend.data.map((item: any) => {
      if (typeof item === 'string') return humanizeColumnName(item);
      if (item && typeof item.name === 'string') {
        item.name = humanizeColumnName(item.name);
        return item;
      }
      return item;
    });
  }

  // === P1.1: 食品行业语义配色 ===
  if (Array.isArray(series) && chartType !== 'pie') {
    const semanticColorMap: Array<{ pattern: RegExp; colors: string[] }> = [
      { pattern: /收入|营收|销售额|revenue/i, colors: ['#52c41a', '#73d13d'] },
      { pattern: /成本|费用|支出|cost|expense/i, colors: ['#ff4d4f', '#ff7875'] },
      { pattern: /利润|净利|毛利|profit/i, colors: ['#1890ff', '#40a9ff'] },
      { pattern: /率|比例|占比|ratio|margin|rate/i, colors: ['#722ed1', '#9254de'] },
    ];
    for (const s of series) {
      if (!s.name || typeof s.name !== 'string') continue;
      if (s.itemStyle?.color) continue; // Don't override explicit colors
      for (const rule of semanticColorMap) {
        if (rule.pattern.test(s.name)) {
          s.itemStyle = s.itemStyle || {};
          s.itemStyle.color = rule.colors[0];
          if (s.lineStyle) s.lineStyle.color = rule.colors[0];
          if (s.areaStyle) {
            s.areaStyle.color = {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: rule.colors[0] + '40' },
                { offset: 1, color: rule.colors[0] + '08' },
              ]
            };
          }
          break;
        }
      }
    }
  }

  // === DataZoom — 数据量>30时自动启用 slider+inside ===
  if (xAxis && xAxis.type === 'category' && Array.isArray(xAxis.data) && xAxis.data.length > 30) {
    const dataLen = xAxis.data.length;
    const endPercent = Math.min(100, Math.round((25 / dataLen) * 100));
    if (!(opts as any).dataZoom) {
      (opts as any).dataZoom = [
        { type: 'slider', show: true, xAxisIndex: 0, start: 0, end: endPercent, height: 20, bottom: 8 },
        { type: 'inside', xAxisIndex: 0, start: 0, end: endPercent }
      ];
      const grid = (opts as any).grid || {};
      const curBottom = typeof grid.bottom === 'number' ? grid.bottom : 50;
      grid.bottom = Math.max(curBottom, 60);
      (opts as any).grid = grid;
    }
  }

  // === X轴标签自适应 — interval + rotate + formatter截断 ===
  if (xAxis && xAxis.type === 'category' && Array.isArray(xAxis.data)) {
    const dataLen = xAxis.data.length;
    xAxis.axisLabel = xAxis.axisLabel || {};
    if (dataLen > 15 && !xAxis.axisLabel.rotate) {
      xAxis.axisLabel.rotate = dataLen > 50 ? 60 : (dataLen > 30 ? 50 : 45);
    }
    if (dataLen > 20 && xAxis.axisLabel.interval === undefined) {
      xAxis.axisLabel.interval = Math.max(0, Math.ceil(dataLen / 8) - 1);
    }
    // D5: 标签截断 — 瀑布图/横向图用18字符，其他用10字符
    if (!xAxis.axisLabel.formatter) {
      const isWaterfall = Array.isArray(series) && series.some((s: any) => s.type === 'bar' && s.stack);
      const maxLen = isWaterfall ? 18 : 10;
      xAxis.axisLabel.formatter = (val: string) => {
        const str = String(val);
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(5, 10);
        if (/^\d{4}-\d{2}$/.test(str)) return str.slice(5) + '月';
        return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
      };
    }
    xAxis.axisLabel.hideOverlap = true;
  }

  // === D1+D7: 零值标签隐藏 + 标签防重叠 ===
  if (Array.isArray(series)) {
    for (const s of series) {
      // Hide zero-value bar/line labels to reduce visual noise
      if ((s.type === 'bar' || s.type === 'line') && s.label && s.label.show) {
        const origFormatter = s.label.formatter;
        s.label.formatter = (params: any) => {
          const val = typeof params.value === 'number' ? params.value :
                      (Array.isArray(params.value) ? Number(params.value[1]) : Number(params.value));
          // Hide zero or near-zero labels
          if (val === 0 || (Math.abs(val) < 0.01 && Math.abs(val) > 0)) return '';
          // If there was an original formatter, apply it
          if (typeof origFormatter === 'function') return origFormatter(params);
          // ECharts template strings like "{c}万" — substitute placeholders
          if (typeof origFormatter === 'string') {
            return origFormatter
              .replace(/\{a\}/g, params.seriesName || '')
              .replace(/\{b\}/g, params.name || '')
              .replace(/\{c\}/g, String(val))
              .replace(/\{d\}/g, String(params.percent ?? ''));
          }
          // Default: smart number formatting
          const abs = Math.abs(val);
          if (abs >= 1e4) return `${(val / 1e4).toFixed(abs >= 1e5 ? 0 : 2)}万`;
          if (abs >= 1000) return `${(val / 1000).toFixed(1)}K`;
          return Number.isInteger(val) ? String(val) : val.toFixed(2);
        };
      }
      if (s.label && s.label.show && !s.labelLayout) {
        s.labelLayout = { hideOverlap: true };
      }
    }
    // sampling for large datasets
    if (stats.count > 100) {
      for (const s of series) {
        if ((s.type === 'line' || s.type === 'bar') && !s.sampling) {
          s.sampling = 'lttb';
        }
      }
    }
  }

  // === D6: 饼图图例长文本截断 ===
  if (chartType === 'pie' && legend) {
    legend.formatter = (name: string) => {
      return name.length > 16 ? name.slice(0, 14) + '…' : name;
    };
    legend.tooltip = { show: true }; // hover to see full name
  }

  // === D3: 极端离群值检测 ===
  // 当最大值 > 10x 中位数时，在 tooltip 中提示
  if (chartType === 'bar' && stats.median > 0 && stats.max > stats.median * 10) {
    (opts as any).tooltip = (opts as any).tooltip || {};
    const origTipFormatter = (opts as any).tooltip.formatter;
    if (!origTipFormatter) {
      (opts as any).tooltip.formatter = (params: any) => {
        const p = Array.isArray(params) ? params[0] : params;
        const val = typeof p.value === 'number' ? p.value : (Array.isArray(p.value) ? p.value[1] : p.value);
        const numVal = Number(val);
        const base = `${p.marker || ''}${p.seriesName}: <b>${numVal.toLocaleString()}</b>`;
        if (Math.abs(numVal) > stats.median * 10) {
          return `${p.name}<br/>${base}<br/><span style="color:#ff6b35;font-size:11px">⚠ 离群值 (${(numVal / stats.median).toFixed(0)}x 中位数)</span>`;
        }
        return `${p.name}<br/>${base}`;
      };
    }
  }

  // === 近零值智能处理 ===
  if (yAxis && chartType !== 'pie' && stats.max > 0 && stats.nonZeroMin < Infinity) {
    const ratio = stats.max / stats.nonZeroMin;
    // Case 1: Extreme range → enable scale for better resolution
    if (ratio > 100 && stats.nonZeroMin < stats.max * 0.01) {
      yAxis.scale = true;
      if (!yAxis.splitNumber) yAxis.splitNumber = 8;
    }
    // Case 2: Value concentration — 80% of values in 10% of range
    if (stats.count > 5 && Array.isArray(series)) {
      const allValues: number[] = [];
      for (const s of series) {
        if (!Array.isArray(s?.data)) continue;
        for (const d of s.data) {
          const v = typeof d === 'number' ? d : (Array.isArray(d) ? Number(d[1]) || 0 : Number(d?.value) || 0);
          if (v !== 0) allValues.push(Math.abs(v));
        }
      }
      if (allValues.length > 5) {
        allValues.sort((a, b) => a - b);
        const rangeTotal = allValues[allValues.length - 1] - allValues[0];
        if (rangeTotal > 0) {
          // Check if 80% of values fall within 10% of range
          const p10 = allValues[Math.floor(allValues.length * 0.1)];
          const p90 = allValues[Math.floor(allValues.length * 0.9)];
          const innerRange = p90 - p10;
          if (innerRange < rangeTotal * 0.1) {
            yAxis.scale = true;
            if (!yAxis.splitNumber) yAxis.splitNumber = 6;
          }
        }
      }
    }
  }

  // === 万/亿 axis formatter ===
  if (yAxis && typeof yAxis.name === 'string') {
    const match = yAxis.name.match(/\(([万亿])\)/);
    if (match) {
      const suffix = match[1];
      const divisor = suffix === '亿' ? 1e8 : 1e4;
      const minThreshold = suffix === '亿' ? 1e8 : 1e4;

      if (stats.max < minThreshold) {
        yAxis.name = yAxis.name.replace(/\s*\([万亿]\)/, '');
      } else {
        yAxis.axisLabel = yAxis.axisLabel || {};
        if (!yAxis.axisLabel.formatter) {
          yAxis.axisLabel.formatter = (value: number) => {
            if (value === 0) return '0';
            const scaled = value / divisor;
            return Number.isInteger(scaled) ? `${scaled}${suffix}` : `${scaled.toFixed(1)}${suffix}`;
          };
        }
      }
    }
  }

  // Scatter charts: also format xAxis if values are large
  if (xAxis && xAxis.type === 'value' && typeof xAxis.name === 'string') {
    const xMatch = xAxis.name.match(/\(([万亿])\)/);
    if (xMatch) {
      const xSuffix = xMatch[1];
      const xDivisor = xSuffix === '亿' ? 1e8 : 1e4;
      const xMinThreshold = xSuffix === '亿' ? 1e8 : 1e4;
      if (stats.max < xMinThreshold) {
        xAxis.name = xAxis.name.replace(/\s*\([万亿]\)/, '');
      } else {
        xAxis.axisLabel = xAxis.axisLabel || {};
        if (!xAxis.axisLabel.formatter) {
          xAxis.axisLabel.formatter = (value: number) => {
            if (value === 0) return '0';
            const scaled = value / xDivisor;
            return Number.isInteger(scaled) ? `${scaled}${xSuffix}` : `${scaled.toFixed(1)}${xSuffix}`;
          };
        }
      }
    }
  }
};

// 渲染当前激活 Tab 的所有图表（多图表仪表板 — 8-benchmark upgrade）
// T5.2: Intersection Observer — only render charts when they enter the viewport
let chartObserver: IntersectionObserver | null = null;
const pendingChartConfigs = new Map<string, { chart: any; idx: number; sheet: any }>();

function getOrCreateChartObserver(): IntersectionObserver {
  if (chartObserver) return chartObserver;
  chartObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const dom = entry.target as HTMLElement;
        const chartId = dom.id;
        const pending = pendingChartConfigs.get(chartId);
        if (!pending) continue;
        // Render now that it's visible
        renderSingleChart(dom, pending.chart, pending.idx, pending.sheet);
        pendingChartConfigs.delete(chartId);
        chartObserver?.unobserve(dom); // stop observing once rendered
      }
    },
    { rootMargin: '200px', threshold: 0.01 } // trigger 200px before entering viewport
  );
  return chartObserver;
}

const renderActiveCharts = () => {
  const activeSheetIndex = parseInt(activeTab.value);
  const activeSheet = uploadedSheets.value.find(s => s.sheetIndex === activeSheetIndex);
  if (!activeSheet) return;

  const charts = getSheetCharts(activeSheet);
  const observer = getOrCreateChartObserver();

  charts.forEach((chart, idx) => {
    const chartId = `chart-${activeSheet.sheetIndex}-${idx}`;
    const dom = document.getElementById(chartId);
    if (!dom) return;

    const config = chart.config;
    if (!config || isChartDataEmpty(config)) return;

    // T5.2: First chart (hero) renders immediately, rest observe for viewport entry
    if (idx === 0) {
      renderSingleChart(dom, chart, idx, activeSheet);
    } else {
      // Check if already in viewport (scrolled into view)
      const rect = dom.getBoundingClientRect();
      const inViewport = rect.top < window.innerHeight + 200 && rect.bottom > -200;
      if (inViewport) {
        renderSingleChart(dom, chart, idx, activeSheet);
      } else {
        pendingChartConfigs.set(chartId, { chart, idx, sheet: activeSheet });
        observer.observe(dom);
      }
    }
  });
};

/** Render a single chart into its DOM container */
function renderSingleChart(dom: HTMLElement, chart: any, idx: number, activeSheet: any) {
    const config = chart.config;
    if (!config || isChartDataEmpty(config)) return;

    // Get all charts for cross-chart hover interactions
    const charts = getSheetCharts(activeSheet);

    let echartsOptions = resolveEChartsOptions(config);
    if (!echartsOptions) return;

    // Process __ANIM__/__FMT__ named references from Python
    echartsOptions = processEChartsOptions(echartsOptions);
    enhanceChartOption(echartsOptions);

    // D4: 全零图表检测 — 当95%+数据为零时添加提示水印
    const eSeries = (echartsOptions as any).series;
    if (Array.isArray(eSeries) && eSeries[0]?.type !== 'pie') {
      let totalVals = 0, zeroVals = 0;
      for (const s of eSeries) {
        if (!Array.isArray(s?.data)) continue;
        for (const d of s.data) {
          totalVals++;
          const v = typeof d === 'number' ? d : Number(d?.value ?? d?.[1] ?? 0);
          if (v === 0) zeroVals++;
        }
      }
      if (totalVals > 5 && zeroVals / totalVals > 0.9) {
        // Add watermark-style hint
        (echartsOptions as any).graphic = [
          {
            type: 'text',
            left: 'center',
            top: '38%',
            style: {
              text: '本项数据集中在少数项目',
              fontSize: 13,
              fill: 'rgba(150,150,150,0.6)',
              fontWeight: 'normal',
            },
            silent: true,
          },
          {
            type: 'text',
            left: 'center',
            top: '46%',
            style: {
              text: '可拖动下方滑块或切换维度查看',
              fontSize: 11,
              fill: 'rgba(180,180,180,0.5)',
            },
            silent: true,
          }
        ];
      }
    }

    // Apply anomaly overlay if available
    const anomalies = (config as any).anomalies || (chart as any).anomalies;
    if (anomalies) {
      applyAnomalyOverlay(echartsOptions, anomalies);
    }

    try {
      // ECharts instance reuse (Phase 2.2) — avoid dispose+init cycle
      let instance = echarts.getInstanceByDom(dom);
      if (!instance) {
        instance = echarts.init(dom, 'cretas');
      }
      instance.setOption(echartsOptions, { notMerge: true });

      // R-14: Apply visual emphasis if a cross-chart filter is active
      if (activeFilter.value) {
        const filterVal = activeFilter.value.value;
        // Find matching data index from xAxis
        const xData = (echartsOptions as any)?.xAxis?.data;
        if (Array.isArray(xData)) {
          const matchIdx = xData.indexOf(filterVal);
          if (matchIdx >= 0) {
            // Downplay all, then highlight the matched data point
            instance.dispatchAction({ type: 'downplay' });
            instance.dispatchAction({ type: 'highlight', dataIndex: matchIdx });
          }
        }
        // For pie charts, match by name
        const seriesArr = (echartsOptions as any)?.series;
        if (Array.isArray(seriesArr)) {
          for (const s of seriesArr) {
            if (s.type === 'pie' && Array.isArray(s.data)) {
              const pieIdx = s.data.findIndex((d: any) => d.name === filterVal);
              if (pieIdx >= 0) {
                instance.dispatchAction({ type: 'downplay' });
                instance.dispatchAction({ type: 'highlight', dataIndex: pieIdx });
              }
            }
          }
        }
      }

      // Click events: Ctrl+Click = filter, normal Click = drill-down
      instance.off('click');
      instance.on('click', (params: any) => {
        if (params.event?.event?.ctrlKey || params.event?.event?.metaKey) {
          applyChartFilter(activeSheet, params);
        } else {
          handleChartDrillDown(activeSheet, idx, params);
        }
      });

      // P0-B: Throttled hover cross-filtering with dispatchAction (100ms throttle)
      const chartKey = `chart-${activeSheet.sheetIndex}-${idx}`;
      instance.off('mouseover');
      instance.on('mouseover', (params: any) => {
        const hoverValue = params.name || params.seriesName;
        if (!hoverValue) return;
        if (hoverThrottleTimers.has(chartKey)) return; // throttle: skip if pending
        hoverThrottleTimers.set(chartKey, setTimeout(() => { hoverThrottleTimers.delete(chartKey); }, 100));
        charts.forEach((_c, sibIdx) => {
          if (sibIdx === idx) return;
          const sibId = `chart-${activeSheet.sheetIndex}-${sibIdx}`;
          const sibDom = document.getElementById(sibId);
          if (!sibDom) return;
          const sibInstance = echarts.getInstanceByDom(sibDom);
          if (!sibInstance) return;
          const sibOpt = sibInstance.getOption() as any;
          // Bar/line: match xAxis by name (not index — safe with DataZoom)
          const xData = sibOpt?.xAxis?.[0]?.data;
          if (Array.isArray(xData)) {
            const matchIdx = xData.indexOf(hoverValue);
            if (matchIdx >= 0) {
              sibInstance.dispatchAction({ type: 'highlight', dataIndex: matchIdx });
            }
          }
          // Pie: match by name
          const sibSeries = sibOpt?.series;
          if (Array.isArray(sibSeries)) {
            sibSeries.forEach((s: any) => {
              if (s.type === 'pie' && Array.isArray(s.data)) {
                const pieIdx = s.data.findIndex((d: any) => d.name === hoverValue);
                if (pieIdx >= 0) sibInstance.dispatchAction({ type: 'highlight', dataIndex: pieIdx });
              }
            });
          }
        });
      });
      instance.off('mouseout');
      instance.on('mouseout', () => {
        charts.forEach((_c, sibIdx) => {
          if (sibIdx === idx) return;
          const sibId = `chart-${activeSheet.sheetIndex}-${sibIdx}`;
          const sibDom = document.getElementById(sibId);
          if (!sibDom) return;
          const sibInstance = echarts.getInstanceByDom(sibDom);
          if (sibInstance) sibInstance.dispatchAction({ type: 'downplay' });
        });
      });
    } catch (error) {
      console.error(`Failed to render chart chart-${activeSheet.sheetIndex}-${idx}:`, error);
    }
}

// 向后兼容：旧版渲染入口
const renderActiveChart = () => renderActiveCharts();

// 监听 Tab 切换，带 150ms debounce 防止快速切换重复渲染 (Phase 2.3)
// P6: 切换编排模式时渲染 builder 内的图表
let layoutRenderPending = false;
watch(layoutEditMode, (isBuilder) => {
  if (isBuilder && !layoutRenderPending) {
    layoutRenderPending = true;
    nextTick(() => {
      const tryRender = () => {
        const activeSheetIndex = parseInt(activeTab.value);
        const activeSheet = uploadedSheets.value.find(s => s.sheetIndex === activeSheetIndex);
        if (!activeSheet) { layoutRenderPending = false; return; }
        const layout = getCachedLayout(activeSheet);
        const charts = getSheetCharts(activeSheet);
        const firstCardDom = layout.cards.length ? document.getElementById(`builder-chart-${layout.cards[0].id}`) : null;
        if (!firstCardDom) {
          // DOM not ready yet, retry on next frame
          requestAnimationFrame(tryRender);
          return;
        }
        layout.cards.forEach((card, i) => {
          if (i >= charts.length) return;
          const dom = document.getElementById(`builder-chart-${card.id}`);
          if (!dom) return;
          try {
            let instance = echarts.getInstanceByDom(dom);
            if (!instance) instance = echarts.init(dom, 'cretas');
            const config = charts[i].config;
            if (config) {
              instance.setOption(processEChartsOptions(config as Record<string, unknown>), { notMerge: true });
            }
          } catch (e) {
            console.error(`Failed to render builder chart ${card.id}:`, e);
          }
        });
        layoutRenderPending = false;
      };
      requestAnimationFrame(tryRender);
    });
  } else if (!isBuilder) {
    // Switching back to standard mode — re-render charts with DOM-ready check
    nextTick(() => {
      const tryRenderStandard = () => {
        const activeSheetIndex = parseInt(activeTab.value);
        const activeSheet = uploadedSheets.value.find(s => s.sheetIndex === activeSheetIndex);
        if (!activeSheet) return;
        const charts = getSheetCharts(activeSheet);
        if (charts.length === 0) return;
        const firstDom = document.getElementById(`chart-${activeSheetIndex}-0`);
        if (!firstDom) {
          requestAnimationFrame(tryRenderStandard);
          return;
        }
        renderActiveCharts();
      };
      setTimeout(() => requestAnimationFrame(tryRenderStandard), 300);
    });
  }
});

watch(activeTab, (newTab, oldTab) => {
  // Clear active filter on tab switch
  activeFilter.value = null;
  globalFilterDimension.value = '';
  globalFilterValues.value = [];
  layoutEditMode.value = false; // P6: reset to standard mode on tab switch

  // Clear hover throttle timers from previous tab to avoid leaked closures
  clearHoverThrottleTimers();

  // T4.1: Clear ECharts instances for previous tab but DON'T dispose —
  // instances are reused on tab switch back (avoid dispose+init cycle ~500ms overhead).
  // Instances are disposed only when component unmounts or after 60s idle.
  if (oldTab) {
    document.querySelectorAll(`[id^="chart-${oldTab}-"]`).forEach(dom => {
      const inst = echarts.getInstanceByDom(dom as HTMLElement);
      if (inst) {
        inst.off('click');
        inst.off('mouseover');
        inst.off('mouseout');
        inst.clear(); // clear options but keep instance alive for reuse
      }
    });
  }

  if (renderDebounceTimer) clearTimeout(renderDebounceTimer);
  renderDebounceTimer = setTimeout(() => {
    nextTick(() => {
      renderActiveCharts();

      // 检查当前 tab 的 sheet 是否需要 enrichment
      const activeSheetIndex = parseInt(activeTab.value);
      const activeSheet = uploadedSheets.value.find(s => s.sheetIndex === activeSheetIndex);
      if (activeSheet && !isIndexSheet(activeSheet) && activeSheet.uploadId) {
        const hasCharts = hasChartData(activeSheet);
        const hasAI = !!activeSheet.flowResult?.aiAnalysis;
        if ((!hasCharts || !hasAI) && !enrichingSheets.value.has(activeSheetIndex) && !enrichedSheets.value.has(activeSheetIndex)) {
          enrichSheet(activeSheet);
        }
      }
    });
  }, 150);
});

// 渲染单个图表
const renderChart = (sheet: SheetResult) => {
  const chartId = `chart-${sheet.sheetIndex}`;
  const chartDom = document.getElementById(chartId);

  if (!chartDom) {
    console.warn(`Chart container not found: ${chartId}`);
    return;
  }

  const chartConfig = sheet.flowResult?.chartConfig;
  if (!chartConfig) {
    console.warn('No chartConfig found');
    return;
  }

  // 检测空数据，跳过渲染
  if (isChartDataEmpty(chartConfig)) {
    console.warn('Chart data is empty, skipping render');
    return;
  }

  // 确定 ECharts options
  let echartsOptions: any = null;

  // Case 1: chartConfig 本身就是完整 ECharts 配置（来自 Python enrichment）
  if (chartConfig.series || chartConfig.xAxis || chartConfig.yAxis) {
    echartsOptions = chartConfig;
  }
  // Case 2: Java 返回的 { chartOptions: "JSON string" } 格式
  else if (chartConfig.chartOptions && typeof chartConfig.chartOptions === 'string') {
    try {
      echartsOptions = JSON.parse(chartConfig.chartOptions);
    } catch (e) {
      console.warn('Failed to parse chartOptions JSON string:', e);
    }
  }
  // Case 3: Java 返回的 { options: {...} } 格式
  else if (chartConfig.options) {
    echartsOptions = chartConfig.options;
  }
  // Case 4: 有 data 但没有 options，尝试构建基础图表
  else if (chartConfig.data) {
    echartsOptions = buildBasicOptions(chartConfig.chartType || 'line', chartConfig.data);
  }

  if (!echartsOptions) {
    console.warn('No chart options could be built');
    return;
  }

  try {
    // 销毁旧实例避免重复初始化
    const existingInstance = echarts.getInstanceByDom(chartDom);
    if (existingInstance) {
      existingInstance.dispose();
    }
    const myChart = echarts.init(chartDom, 'cretas');
    myChart.setOption(echartsOptions);
  } catch (error) {
    console.error('Failed to render chart:', error);
  }
};

// 根据数据构建基础 ECharts 配置
const buildBasicOptions = (chartType: string, data: any): any => {

  // 从数据中提取可能的字段
  if (!data || typeof data !== 'object') return null;

  // 尝试识别 x 轴和 y 轴数据
  const keys = Object.keys(data);
  if (keys.length === 0) return null;

  // 简单策略：第一个数组作为系列数据
  for (const key of keys) {
    if (Array.isArray(data[key])) {
      return {
        title: { text: chartType + ' Chart' },
        tooltip: {},
        xAxis: { type: 'category', data: data[key].map((_: any, i: number) => i + 1) },
        yAxis: { type: 'value' },
        series: [{ type: chartType.toLowerCase() || 'line', data: data[key] }]
      };
    }
  }

  return null;
};

// 获取 AI 分析
const getAIAnalysis = (sheet: SheetResult): string => {
  return sheet.flowResult?.aiAnalysis ||
         sheet.flowResult?.chartConfig?.aiAnalysis ||
         '暂无 AI 分析';
};

// 格式化分析结果
const formatAnalysis = (analysis: string): string => {
  return analysis
    .replace(/\n/g, '<br/>')
    .replace(/\*\*trend\*\*/gi, '📈 <strong>趋势</strong>')
    .replace(/\*\*anomaly\*\*/gi, '⚠️ <strong>异常</strong>')
    .replace(/\*\*recommendation\*\*/gi, '💡 <strong>建议</strong>')
    .replace(/\*\*comparison\*\*/gi, '📊 <strong>对比</strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/【(.*?)】/g, '<span class="highlight">【$1】</span>')
    .replace(/(<br\/>)(\d+\.)\s/g, '$1<strong>$2</strong> ');
};

// 刷新分析：清除缓存后强制重新 enrichment
const handleRefreshAnalysis = async (sheet: SheetResult) => {
  if (!sheet.uploadId || enrichingSheets.value.has(sheet.sheetIndex)) return;
  // 清除前端 enriched 状态
  enrichedSheets.value.delete(sheet.sheetIndex);
  cachedAtMap.value.delete(sheet.uploadId);
  // 清除后端缓存
  await invalidateAnalysisCache(sheet.uploadId);
  // 强制重新执行 enrichment
  enrichSheet(sheet, true);
};

// 缓存状态提示文本
const getCacheHint = (sheet: SheetResult): string => {
  if (!sheet.uploadId) return '';
  const cachedAt = cachedAtMap.value.get(sheet.uploadId);
  if (!cachedAt) return '';
  try {
    const d = new Date(cachedAt);
    const pad = (n: number) => String(n).padStart(2, '0');
    const timeStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `分析结果来自缓存（${timeStr}），点击"刷新分析"获取最新结果`;
  } catch {
    return '分析结果来自缓存，点击"刷新分析"获取最新结果';
  }
};

// 检测 ECharts chartConfig 中数据是否为空
const isChartDataEmpty = (chartConfig: any): boolean => {
  if (!chartConfig || Object.keys(chartConfig).length === 0) return true;

  // 辅助：检查 series 数组是否全为空数据
  const isSeriesEmpty = (series: any) => {
    const arr = Array.isArray(series) ? series : [series];
    return arr.every((s: any) => !s.data || s.data.length === 0);
  };

  // Case 1: 直接 ECharts options 格式（有 series）
  if (chartConfig.series) {
    return isSeriesEmpty(chartConfig.series);
  }

  // Case 2: Java 返回的 { chartOptions: "JSON string" } 格式
  if (chartConfig.chartOptions && typeof chartConfig.chartOptions === 'string') {
    try {
      const parsed = JSON.parse(chartConfig.chartOptions);
      if (parsed.series) return isSeriesEmpty(parsed.series);
    } catch { /* ignore parse error */ }
  }

  // Case 3: Java 返回的 { options: {...} } 格式
  if (chartConfig.options?.series) {
    return isSeriesEmpty(chartConfig.options.series);
  }

  // Case 4: 有 data 但没有有效数据
  if (chartConfig.data && typeof chartConfig.data === 'object') {
    const values = Object.values(chartConfig.data);
    return values.every((v: any) => !Array.isArray(v) || v.length === 0);
  }

  return false;
};

// P2.1: 使用 idle callback 预缓存下一个 sheet
const idleEnrichNext = (currentSheetIndex: number) => {
  // Polyfill for requestIdleCallback (not available in all browsers)
  const idleCb = (window as any).requestIdleCallback || ((fn: Function) => setTimeout(fn, 2000));

  idleCb(() => {
    // 仅在网络空闲时预加载（没有其他正在进行的 enrichment）
    if (enrichingSheets.value.size > 0) {
      return;
    }

    // 查找下一个未 enriched 的 sheet
    const nextSheet = uploadedSheets.value.find(
      s => s.sheetIndex > currentSheetIndex
        && !enrichedSheets.value.has(s.sheetIndex)
        && !enrichingSheets.value.has(s.sheetIndex)
        && !isIndexSheet(s)
        && s.uploadId
    );

    if (nextSheet?.uploadId) {
      console.log(`[P2.1] Pre-caching next sheet: ${nextSheet.sheetName} (index ${nextSheet.sheetIndex})`);

      // 静默预加载（无加载 UI）
      enrichSheetAnalysis(nextSheet.uploadId).then(result => {
        if (result && result.success) {
          const sheet = uploadedSheets.value.find(s => s.sheetIndex === nextSheet.sheetIndex);
          if (sheet) {
            if (!sheet.flowResult) {
              sheet.flowResult = {};
            }
            // 更新多图表数据
            if (result.charts?.length) {
              sheet.flowResult.charts = result.charts;
              sheet.flowResult.chartConfig = result.charts[0].config; // 向后兼容
            }
            // 更新 KPI 摘要
            if (result.kpiSummary) {
              sheet.flowResult.kpiSummary = result.kpiSummary;
            }
            // 更新 AI 分析
            if (result.aiAnalysis) {
              sheet.flowResult.aiAnalysis = result.aiAnalysis;
            }
            // 更新结构化 AI
            if (result.structuredAI) {
              sheet.flowResult.structuredAI = result.structuredAI;
            }
            // 缓存原始数据
            if (result.rawData?.length && nextSheet.uploadId) {
              sheetRawDataCache.set(nextSheet.uploadId, result.rawData);
            }

            // 标记为已 enriched
            enrichedSheets.value.add(nextSheet.sheetIndex);
            console.log(`[P2.1] Pre-cache complete for sheet ${nextSheet.sheetIndex}`);
          }
        }
      }).catch(err => {
        // 静默忽略预缓存错误（不影响用户体验）
        console.warn(`[P2.1] Pre-cache failed for sheet ${nextSheet.sheetIndex}:`, err);
      });
    }
  });
};

// 通过前端驱动 Python 服务补充 Sheet 的图表和 AI 分析 (P0: 渐进式渲染)
const enrichSheet = async (sheet: SheetResult, forceRefresh = false) => {
  const sheetIndex = sheet.sheetIndex;
  const uploadId = sheet.uploadId;
  if (!uploadId || enrichingSheets.value.has(sheetIndex)) return;

  enrichingSheets.value.add(sheetIndex);
  // Initialize progressive phase tracking
  enrichPhases.value.set(sheetIndex, { kpi: false, charts: 0, chartsTotal: 0, ai: false });

  try {
    const result: EnrichResult = await enrichSheetAnalysis(uploadId, forceRefresh, (progress: EnrichProgress) => {
      const currentSheet = uploadedSheets.value.find(s => s.sheetIndex === sheetIndex);
      if (!currentSheet) return;
      if (!currentSheet.flowResult) currentSheet.flowResult = {};

      const phase = enrichPhases.value.get(sheetIndex);

      if (progress.phase === 'kpi' && progress.partial.kpiSummary) {
        currentSheet.flowResult.kpiSummary = progress.partial.kpiSummary;
        if (progress.partial.financialMetrics !== undefined) {
          currentSheet.flowResult.financialMetrics = progress.partial.financialMetrics;
        }
        if (phase) {
          phase.kpi = true;
          phase.chartsTotal = progress.partial.chartsTotal || 0;
        }
      }

      if (progress.phase === 'chart-single' && progress.partial.charts?.length) {
        currentSheet.flowResult.charts = progress.partial.charts;
        currentSheet.flowResult.chartConfig = progress.partial.charts[0].config;
        if (phase) phase.charts = progress.partial.charts.length;
        // Render charts immediately if this is the active tab
        if (parseInt(activeTab.value) === sheetIndex) {
          nextTick(() => renderActiveCharts());
        }
      }

      // T1.1: Handle streaming AI text chunks — show progressively before final parse
      if (progress.phase === 'ai-streaming' && progress.partial.aiStreamChunk) {
        if (!currentSheet.flowResult._streamingAIText) {
          currentSheet.flowResult._streamingAIText = '';
        }
        currentSheet.flowResult._streamingAIText += progress.partial.aiStreamChunk;
        // Show raw streaming text as preview (will be replaced by structured result)
        currentSheet.flowResult.aiAnalysis = currentSheet.flowResult._streamingAIText;
      }

      if (progress.phase === 'ai') {
        if (progress.partial.aiAnalysis) {
          currentSheet.flowResult.aiAnalysis = progress.partial.aiAnalysis;
        }
        if (progress.partial.structuredAI) {
          currentSheet.flowResult.structuredAI = progress.partial.structuredAI;
        }
        // Clear streaming preview
        delete currentSheet.flowResult._streamingAIText;
        if (phase) phase.ai = true;
      }
    });

    if (result.success) {
      const currentSheet = uploadedSheets.value.find(s => s.sheetIndex === sheetIndex);
      if (currentSheet) {
        if (!currentSheet.flowResult) currentSheet.flowResult = {};
        // Final sync — ensure all data is set (handles cache-hit path where onProgress fires 'complete' only)
        if (result.charts?.length) {
          currentSheet.flowResult.charts = result.charts;
          currentSheet.flowResult.chartConfig = result.charts[0].config;
        } else if (result.chartConfig) {
          currentSheet.flowResult.chartConfig = result.chartConfig;
        }
        if (result.kpiSummary) currentSheet.flowResult.kpiSummary = result.kpiSummary;
        if (result.aiAnalysis) currentSheet.flowResult.aiAnalysis = result.aiAnalysis;
        if (result.structuredAI) currentSheet.flowResult.structuredAI = result.structuredAI;
        // Persist rawData for cross-filtering & Excel export
        if (result.rawData?.length && uploadId) {
          sheetRawDataCache.set(uploadId, result.rawData);
        } else if (uploadId && !sheetRawDataCache.has(uploadId)) {
          getUploadTableData(uploadId, 0, 2000).then(res => {
            if (res.success && res.data?.data?.length) {
              sheetRawDataCache.set(uploadId, res.data.data as Record<string, unknown>[]);
            }
          }).catch(() => {});
        }
      }
      enrichedSheets.value.add(sheetIndex);
      // Mark all phases complete
      const phase = enrichPhases.value.get(sheetIndex);
      if (phase) { phase.kpi = true; phase.ai = true; phase.charts = phase.chartsTotal; }

      // A6: Run food industry detection on first enriched sheet
      if (!foodIndustryDetection.value) {
        // Try rawData from enrichment result, sheetRawDataCache, or fetch
        let detectData = result.rawData;
        if (!detectData?.length && uploadId && sheetRawDataCache.has(uploadId)) {
          detectData = sheetRawDataCache.get(uploadId);
        }
        if (!detectData?.length && uploadId) {
          // Cache hit path — rawData not available, fetch minimal sample for detection
          try {
            const tableRes = await getUploadTableData(uploadId, 0, 20);
            if (tableRes.success && tableRes.data?.data?.length) {
              detectData = tableRes.data.data as Record<string, unknown>[];
            }
          } catch { /* non-critical */ }
        }
        if (detectData?.length) {
          const colNames = Object.keys(detectData[0]);
          const sampleRows = detectData.slice(0, 15);
          foodIndustryDetection.value = detectFoodIndustryLocal(colNames, sampleRows);
        }
      }

      // Track cache status for UI hint
      if (result.cached && result.cachedAt) {
        cachedAtMap.value.set(uploadId, result.cachedAt);
      } else {
        cachedAtMap.value.delete(uploadId);
      }

      // Render charts (final pass)
      if (parseInt(activeTab.value) === sheetIndex) {
        await nextTick();
        renderActiveCharts();
      }

      if (!tourDataReady.value && hasChartData(sheet) && result.aiAnalysis) {
        tourDataReady.value = true;
      }

      tryAutoSaveDemoCache();
      idleEnrichNext(sheetIndex);
    } else {
      console.warn(`[Enrich] Sheet ${sheetIndex} enrichment failed:`, result.error);
      ElMessage.warning(`Sheet "${sheet.sheetName}" 图表增强失败: ${result.error || '未知错误'}`);
    }
  } catch (error) {
    console.error(`[Enrich] Sheet ${sheetIndex} error:`, error);
    ElMessage.warning(`Sheet "${sheet.sheetName}" 图表增强异常，请检查 Python 服务是否运行`);
  } finally {
    enrichingSheets.value.delete(sheetIndex);
  }
};

// ========== P1: Template Application ==========

/** Apply a food industry analysis template to the active sheet */
const applyTemplate = async (template: FoodTemplate) => {
  const sheetIndex = parseInt(activeTab.value);
  const sheet = uploadedSheets.value.find(s => s.sheetIndex === sheetIndex);
  if (!sheet?.uploadId) {
    ElMessage.warning('请先选择一个数据表');
    return;
  }

  activeTemplate.value = template.id;
  enrichingSheets.value.add(sheetIndex);

  try {
    // Get raw data (from cache or fetch)
    let rawData = sheetRawDataCache.get(sheet.uploadId);
    if (!rawData) {
      const tableRes = await getUploadTableData(sheet.uploadId, 0, 2000);
      if (!tableRes.success || !tableRes.data?.data?.length) {
        ElMessage.warning('无法获取表格数据');
        return;
      }
      rawData = renameMeaninglessColumns(tableRes.data.data as Record<string, unknown>[]);
      sheetRawDataCache.set(sheet.uploadId, rawData);
    }

    // Detect label field for column mapping
    const allKeys = Object.keys(rawData[0]);
    const catCols = allKeys.filter(k => {
      const vals = rawData!.slice(0, 10).map(r => r[k]);
      return vals.every(v => typeof v === 'string' || v == null);
    });
    const labelField = catCols[0] || allKeys[0];

    // Map template columns to actual data columns
    const plans = mapColumnsToTemplate(rawData, template, labelField);
    if (!plans || plans.length === 0) {
      ElMessage.warning(`模板 "${template.name}" 无法匹配当前数据列，请检查数据格式`);
      return;
    }

    // Build charts from template plan (skip recommendChart)
    const charts: Array<{ chartType: string; title: string; config: Record<string, unknown>; xField?: string }> = [];
    for (const plan of plans) {
      const res = await buildChart({
        chartType: plan.chartType,
        data: plan.data,
        xField: plan.xField,
        yFields: plan.yFields,
        title: plan.title,
      });
      if (res.success && res.option) {
        charts.push({ chartType: plan.chartType, title: plan.title, config: res.option, xField: plan.xField });
      }
    }

    if (charts.length === 0) {
      ElMessage.warning('模板图表构建失败');
      return;
    }

    // Apply to sheet
    if (!sheet.flowResult) sheet.flowResult = {};
    sheet.flowResult.charts = charts;
    sheet.flowResult.chartConfig = charts[0].config;
    enrichedSheets.value.add(sheetIndex);

    await nextTick();
    renderActiveCharts();
    ElMessage.success(`已应用模板 "${template.name}"，生成 ${charts.length} 个图表`);
  } catch (error) {
    console.error('Template apply error:', error);
    ElMessage.error('模板应用失败');
  } finally {
    enrichingSheets.value.delete(sheetIndex);
  }
};

// ========== Chart Switching & Refresh (Phase 3) ==========

/** Track which chart is currently being switched/refreshed */
const switchingChart = ref<{ sheetIndex: number; chartIndex: number } | null>(null);

/** Switch a single chart's type */
const handleSwitchChartType = async (sheet: SheetResult, chartIndex: number, newType: string) => {
  const charts = getSheetCharts(sheet);
  const chart = charts[chartIndex];
  if (!chart || !sheet.uploadId) return;

  switchingChart.value = { sheetIndex: sheet.sheetIndex, chartIndex };
  try {
    // Get raw data for chart rebuilding, use cache if available
    let rawData = sheetRawDataCache.get(sheet.uploadId);
    if (!rawData) {
      const tableRes = await getUploadTableData(sheet.uploadId, 0, 2000);
      if (!tableRes.success || !tableRes.data?.data?.length) return;
      rawData = renameMeaninglessColumns(tableRes.data.data as Record<string, unknown>[]);
      sheetRawDataCache.set(sheet.uploadId, rawData);
    }

    const result = await buildChart({
      chartType: newType,
      data: rawData.slice(0, 200),
      xField: chart.xField,
      yFields: undefined,
      title: chart.title
    });

    if (result.success && result.option) {
      const currentSheet = uploadedSheets.value.find(s => s.sheetIndex === sheet.sheetIndex);
      if (currentSheet?.flowResult?.charts?.[chartIndex]) {
        currentSheet.flowResult.charts[chartIndex] = {
          ...currentSheet.flowResult.charts[chartIndex],
          chartType: newType,
          config: result.option
        };
        await nextTick();
        renderActiveCharts();
      }
    } else {
      ElMessage.warning('切换图表类型失败: ' + (result.error || '未知错误'));
    }
  } catch (e) {
    console.error('Chart type switch failed:', e);
    ElMessage.warning('图表切换失败');
  } finally {
    switchingChart.value = null;
  }
};

/** Refresh a single chart with a new random recommendation */
const handleRefreshChart = async (sheet: SheetResult, chartIndex: number) => {
  const charts = getSheetCharts(sheet);
  const chart = charts[chartIndex];
  if (!chart || !sheet.uploadId) return;

  switchingChart.value = { sheetIndex: sheet.sheetIndex, chartIndex };
  try {
    let rawData = sheetRawDataCache.get(sheet.uploadId);
    if (!rawData) {
      const tableRes = await getUploadTableData(sheet.uploadId, 0, 2000);
      if (!tableRes.success || !tableRes.data?.data?.length) return;
      rawData = renameMeaninglessColumns(tableRes.data.data as Record<string, unknown>[]);
      sheetRawDataCache.set(sheet.uploadId, rawData);
    }

    // Get current chart types to exclude
    const currentTypes = charts.map(c => c.chartType);

    const recRes = await smartRecommendChart({
      data: rawData.slice(0, 100),
      excludeTypes: currentTypes,
      maxRecommendations: 3
    });

    if (recRes.success && recRes.recommendations?.length) {
      const rec = recRes.recommendations[0];
      const buildRes = await buildChart({
        chartType: rec.chartType,
        data: rawData.slice(0, 200),
        xField: rec.xField,
        yFields: rec.yFields,
        title: rec.title || chart.title
      });

      if (buildRes.success && buildRes.option) {
        const currentSheet = uploadedSheets.value.find(s => s.sheetIndex === sheet.sheetIndex);
        if (currentSheet?.flowResult?.charts?.[chartIndex]) {
          currentSheet.flowResult.charts[chartIndex] = {
            chartType: rec.chartType,
            title: rec.title || chart.title,
            config: buildRes.option,
            xField: rec.xField
          };
          await nextTick();
          renderActiveCharts();
        }
      }
    } else {
      ElMessage.info('暂无更多推荐图表类型');
    }
  } catch (e) {
    console.error('Chart refresh failed:', e);
  } finally {
    switchingChart.value = null;
  }
};

/** Refresh ALL charts for a sheet ("换一批") */
const refreshAllChartsLoading = ref(false);
const handleRefreshAllCharts = async (sheet: SheetResult) => {
  if (!sheet.uploadId || refreshAllChartsLoading.value) return;
  refreshAllChartsLoading.value = true;
  try {
    // Force refresh the entire enrichment with cache invalidation
    await invalidateAnalysisCache(sheet.uploadId);
    enrichedSheets.value.delete(sheet.sheetIndex);
    await enrichSheet(sheet, true);
    ElMessage.success('图表已刷新');
  } catch (e) {
    console.error('Refresh all charts failed:', e);
    ElMessage.warning('图表刷新失败');
  } finally {
    refreshAllChartsLoading.value = false;
  }
};

/** Rebuild chart with custom axis config (Phase 4) */
const handleApplyChartConfig = async (
  sheet: SheetResult,
  chartIndex: number,
  config: { xField: string; yFields: string[]; seriesField?: string; aggregation?: string }
) => {
  const charts = getSheetCharts(sheet);
  const chart = charts[chartIndex];
  if (!chart || !sheet.uploadId) return;

  switchingChart.value = { sheetIndex: sheet.sheetIndex, chartIndex };
  try {
    let rawData = sheetRawDataCache.get(sheet.uploadId);
    if (!rawData) {
      const tableRes = await getUploadTableData(sheet.uploadId, 0, 2000);
      if (!tableRes.success || !tableRes.data?.data?.length) return;
      rawData = renameMeaninglessColumns(tableRes.data.data as Record<string, unknown>[]);
      sheetRawDataCache.set(sheet.uploadId, rawData);
    }

    const result = await buildChart({
      chartType: chart.chartType,
      data: rawData.slice(0, 200),
      xField: config.xField,
      yFields: config.yFields,
      title: chart.title
    });

    if (result.success && result.option) {
      const currentSheet = uploadedSheets.value.find(s => s.sheetIndex === sheet.sheetIndex);
      if (currentSheet?.flowResult?.charts?.[chartIndex]) {
        currentSheet.flowResult.charts[chartIndex] = {
          ...currentSheet.flowResult.charts[chartIndex],
          config: result.option,
          xField: config.xField
        };
        // Save config to localStorage for persistence
        const key = `chart-config-${sheet.uploadId}-${chartIndex}`;
        localStorage.setItem(key, JSON.stringify(config));
        await nextTick();
        renderActiveCharts();
      }
    } else {
      ElMessage.warning('配置应用失败: ' + (result.error || ''));
    }
  } catch (e) {
    console.error('Apply chart config failed:', e);
  } finally {
    switchingChart.value = null;
  }
};

/** Get column info for chart config panel */
const getSheetColumns = (sheet: SheetResult): Array<{ name: string; type: 'numeric' | 'categorical' | 'date' }> => {
  const kpi = sheet.flowResult?.kpiSummary;
  if (!kpi?.columns) return [];
  return kpi.columns.map(col => ({
    name: col.name,
    type: ['int64', 'float64', 'number', 'int32', 'float32'].includes(col.type) ? 'numeric' as const
      : col.type === 'datetime64' ? 'date' as const
      : 'categorical' as const
  }));
};

// Drill-down analysis — provided by useSmartBIDrillDown composable

// ========== P1.3: View More (truncated chart data) ==========
const getDisplayedCount = (chart: { chartType: string; config: Record<string, unknown> }): number => {
  const opt = chart.config as any;
  if (chart.chartType === 'pie') {
    return opt?.series?.[0]?.data?.length ?? 0;
  }
  return opt?.xAxis?.data?.length ?? opt?.dataset?.source?.length ?? 0;
};

const handleViewMoreData = (sheet: SheetResult, chartIdx: number, chart: { chartType: string; title: string; totalItems?: number }) => {
  // Show the raw data tab for this sheet, which contains all rows
  loadSheetData(sheet);
  ElMessage.info(`图表"${chart.title}"显示了前 ${getDisplayedCount(chart as any)} 项，完整 ${chart.totalItems} 项数据可在下方原始数据中查看`);
};

// ========== Chart Export (Phase 3.3 — industry standard, 8/8 benchmarks) ==========
const handleChartExport = (command: string, sheetIndex: number, chartIdx: number, chartTitle?: string) => {
  const chartId = `chart-${sheetIndex}-${chartIdx}`;
  const dom = document.getElementById(chartId);
  if (!dom) return;

  const instance = echarts.getInstanceByDom(dom);
  if (!instance) return;

  const fileName = `${chartTitle || '图表'}-${new Date().toISOString().slice(0, 10)}`;

  try {
    if (command === 'png') {
      const url = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
      const link = document.createElement('a');
      link.download = `${fileName}.png`;
      link.href = url;
      link.click();
      ElMessage.success('图表已导出为 PNG');
    } else if (command === 'svg') {
      const url = instance.getDataURL({ type: 'svg' });
      const link = document.createElement('a');
      link.download = `${fileName}.svg`;
      link.href = url;
      link.click();
      ElMessage.success('图表已导出为 SVG');
    }
  } catch (error) {
    console.error('Chart export failed:', error);
    ElMessage.error('图表导出失败，请重试');
  }
};

// ========== Excel Export (SheetJS) ==========
const handleExportExcel = async (sheet: SheetResult) => {
  try {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // 1. Data sheet — use cached rawData or fetch
    let rawData = sheetRawDataCache.get(sheet.uploadId!);
    if (!rawData?.length) {
      const tableRes = await getUploadTableData(sheet.uploadId!, 0, 5000);
      if (tableRes.success && tableRes.data?.data?.length) {
        rawData = tableRes.data.data as Record<string, unknown>[];
        sheetRawDataCache.set(sheet.uploadId!, rawData);
      }
    }
    if (rawData?.length) {
      const ws = XLSX.utils.json_to_sheet(rawData);
      XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName || '数据');
    }

    // 2. KPI summary sheet
    const kpi = sheet.flowResult?.kpiSummary;
    if (kpi?.columns?.length) {
      const kpiRows = kpi.columns
        .filter(c => ['int64', 'float64', 'number', 'int32', 'float32'].includes(c.type))
        .map(c => ({
          指标: c.name,
          类型: c.type,
          最小值: c.min ?? '',
          最大值: c.max ?? '',
          平均值: c.mean != null ? Math.round(c.mean * 100) / 100 : '',
          合计: c.sum ?? '',
        }));
      if (kpiRows.length) {
        const kpiWs = XLSX.utils.json_to_sheet(kpiRows);
        XLSX.utils.book_append_sheet(wb, kpiWs, 'KPI汇总');
      }
    }

    // 3. AI analysis sheet
    const ai = sheet.flowResult?.aiAnalysis;
    if (ai) {
      const aiWs = XLSX.utils.aoa_to_sheet([['AI 智能分析'], [''], ...ai.split('\n').map(line => [line])]);
      XLSX.utils.book_append_sheet(wb, aiWs, 'AI分析');
    }

    const fileName = `${sheet.sheetName || '分析报告'}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    ElMessage.success(`已导出 Excel: ${fileName}`);
  } catch (error) {
    console.error('Excel export failed:', error);
    ElMessage.error('Excel 导出失败');
  }
};

// ========== PDF Export (ECharts getDataURL + jsPDF + Chinese Font) ==========
let cachedChineseFont: string | null = null;

const loadChineseFont = async (): Promise<string | null> => {
  if (cachedChineseFont) return cachedChineseFont;
  try {
    const resp = await fetch('/fonts/simhei-subset.ttf');
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    cachedChineseFont = btoa(binary);
    return cachedChineseFont;
  } catch {
    return null;
  }
};

const handleExportPDF = async (sheet: SheetResult) => {
  try {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    let yOffset = 15;

    // Load and register Chinese font
    const fontBase64 = await loadChineseFont();
    const hasChinese = !!fontBase64;
    if (fontBase64) {
      doc.addFileToVFS('SimHei-subset.ttf', fontBase64);
      doc.addFont('SimHei-subset.ttf', 'SimHei', 'normal');
      doc.setFont('SimHei');
    }

    // Title
    doc.setFontSize(18);
    doc.text(sheet.sheetName || 'SmartBI 分析报告', pageWidth / 2, yOffset, { align: 'center' });
    yOffset += 10;

    doc.setFontSize(10);
    doc.text(new Date().toISOString().slice(0, 10), pageWidth / 2, yOffset, { align: 'center' });
    yOffset += 10;

    // KPI section
    const kpi = sheet.flowResult?.kpiSummary;
    if (kpi?.columns?.length) {
      doc.setFontSize(14);
      doc.text('关键指标摘要', 15, yOffset);
      yOffset += 8;
      doc.setFontSize(9);
      const numericCols = kpi.columns.filter(c => ['int64', 'float64', 'number', 'int32', 'float32'].includes(c.type));
      for (const col of numericCols.slice(0, 6)) {
        const sumVal = col.sum != null ? Number(col.sum).toLocaleString('zh-CN') : 'N/A';
        doc.text(`${col.name}: ${sumVal}`, 15, yOffset);
        yOffset += 5;
      }
      yOffset += 5;
    }

    // Chart images
    const charts = getSheetCharts(sheet);
    for (let i = 0; i < charts.length; i++) {
      const chartId = `chart-${sheet.sheetIndex}-${i}`;
      const dom = document.getElementById(chartId);
      if (!dom) continue;
      const instance = echarts.getInstanceByDom(dom);
      if (!instance) continue;

      const imgData = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
      const imgWidth = pageWidth - 30;
      const imgHeight = imgWidth * 0.6;

      if (yOffset + imgHeight > 280) {
        doc.addPage();
        yOffset = 15;
        if (hasChinese) doc.setFont('SimHei');
      }

      doc.setFontSize(11);
      doc.text(charts[i].title || `图表 ${i + 1}`, 15, yOffset);
      yOffset += 6;
      doc.addImage(imgData, 'PNG', 15, yOffset, imgWidth, imgHeight);
      yOffset += imgHeight + 10;
    }

    // AI analysis text
    const ai = sheet.flowResult?.aiAnalysis;
    if (ai) {
      if (yOffset > 200) {
        doc.addPage();
        yOffset = 15;
        if (hasChinese) doc.setFont('SimHei');
      }
      doc.setFontSize(14);
      doc.text('AI 智能分析', 15, yOffset);
      yOffset += 8;
      doc.setFontSize(9);
      const plainText = ai.replace(/\*\*/g, '').replace(/#{1,3}\s*/g, '');
      const lines = doc.splitTextToSize(plainText, pageWidth - 30);
      for (const line of lines) {
        if (yOffset > 280) {
          doc.addPage();
          yOffset = 15;
          if (hasChinese) doc.setFont('SimHei');
        }
        doc.text(line, 15, yOffset);
        yOffset += 4.5;
      }
    }

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      if (hasChinese) doc.setFont('SimHei');
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Cretas SmartBI · 第 ${p}/${totalPages} 页`, pageWidth / 2, 290, { align: 'center' });
      doc.setTextColor(0);
    }

    const fileName = `${sheet.sheetName || 'SmartBI'}-${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
    ElMessage.success(`已导出 PDF: ${fileName}`);
  } catch (error) {
    console.error('PDF export failed:', error);
    ElMessage.error('PDF 导出失败');
  }
};

// ========== Global Filter Bar ==========
const filterDimensionsLoading = ref(false);
// T3.2: Memoize dimension computation — avoid recalculating on every re-render
const _dimensionCache = new Map<number, string[]>();

const getFilterableDimensions = (sheet: SheetResult): string[] => {
  const uploadId = sheet.uploadId!;
  // Return cached result if available
  if (_dimensionCache.has(uploadId)) return _dimensionCache.get(uploadId)!;

  const rawData = sheetRawDataCache.get(uploadId);
  if (!rawData?.length) {
    // Lazy-load rawData on first filter interaction
    if (!filterDimensionsLoading.value && uploadId) {
      filterDimensionsLoading.value = true;
      getUploadTableData(uploadId, 0, 2000).then(res => {
        if (res.success && res.data?.data?.length) {
          sheetRawDataCache.set(uploadId, res.data.data as Record<string, unknown>[]);
          _dimensionCache.delete(uploadId); // invalidate cache so next call recomputes
        }
      }).finally(() => { filterDimensionsLoading.value = false; });
    }
    return [];
  }
  const allKeys = Object.keys(rawData[0]);
  const dims: string[] = [];
  for (const key of allKeys) {
    const uniqueVals = new Set(rawData.map(r => String(r[key] ?? '')));
    if (uniqueVals.size < 2) continue;
    // Check if column is mostly numeric
    const numericCount = rawData.filter(r => !isNaN(Number(r[key]))).length;
    const isNumeric = numericCount >= rawData.length * 0.8;
    // Include non-numeric columns with reasonable cardinality (up to 300 for large tables)
    if (!isNumeric && uniqueVals.size <= 300) {
      dims.push(key);
    }
  }
  // Fallback: if no categorical columns found, offer the first non-numeric column regardless
  if (dims.length === 0) {
    for (const key of allKeys) {
      const numericCount = rawData.filter(r => !isNaN(Number(r[key]))).length;
      if (numericCount < rawData.length * 0.5) {
        dims.push(key);
        break;
      }
    }
  }
  _dimensionCache.set(uploadId, dims);
  return dims;
};

const getDimensionValues = (sheet: SheetResult, dimension: string): string[] => {
  const rawData = sheetRawDataCache.get(sheet.uploadId!);
  if (!rawData?.length || !dimension) return [];
  const vals = [...new Set(rawData.map(r => String(r[dimension] ?? '')))].filter(Boolean);
  return vals.sort().slice(0, 100); // cap at 100 to keep dropdown usable
};

const handleGlobalFilterChange = (_sheet: SheetResult) => {
  globalFilterValues.value = [];
  filteredRawData.value = null;
  totalRowCount.value = 0;
  filteredRowCount.value = 0;
};

// Q1: Data filtering with debounce
let filterDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const applyDataFilter = async (sheet: SheetResult) => {
  const rawData = sheetRawDataCache.get(sheet.uploadId!);
  if (!rawData || !globalFilterDimension.value || globalFilterValues.value.length === 0) {
    filteredRawData.value = null;
    totalRowCount.value = 0;
    filteredRowCount.value = 0;
    return;
  }

  const filtered = rawData.filter(row => {
    const val = String(row[globalFilterDimension.value] ?? '');
    return globalFilterValues.value.includes(val);
  });

  totalRowCount.value = rawData.length;
  filteredRowCount.value = filtered.length;
  filteredRawData.value = filtered;

  // Re-render charts with filtered data by calling Python chart builder
  await rebuildChartsWithData(sheet, filtered);
};

const rebuildChartsWithData = async (sheet: SheetResult, data: Record<string, unknown>[]) => {
  if (!sheet.uploadId || data.length === 0) return;

  enrichingSheets.value.add(sheet.sheetIndex);

  try {
    // Call buildChart API with filtered data to generate new charts
    const chartPromises = [];
    const columns = Object.keys(data[0] || {});
    const numericCols = columns.filter(col => {
      const vals = data.map(r => r[col]).filter(v => v != null);
      return vals.every(v => !isNaN(Number(v)));
    });
    const categoricalCols = columns.filter(col => !numericCols.includes(col));

    // Build 2-3 charts with filtered data
    if (categoricalCols.length > 0 && numericCols.length > 0) {
      // Bar chart
      chartPromises.push(buildChart({
        data,
        chartType: 'bar',
        xField: categoricalCols[0],
        yFields: [numericCols[0]],
      }));

      // Pie chart if we have categorical data
      if (numericCols.length > 0) {
        chartPromises.push(buildChart({
          data,
          chartType: 'pie',
          xField: categoricalCols[0],
          yFields: [numericCols[0]],
        }));
      }
    }

    const results = await Promise.allSettled(chartPromises);
    const newCharts = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value?.success)
      .map(r => r.value.data);

    if (newCharts.length > 0) {
      // Update flowResult with new charts
      sheet.flowResult = {
        ...sheet.flowResult,
        charts: newCharts,
      };

      // Re-render charts
      await nextTick();
      renderActiveCharts();
    } else {
      ElMessage.warning('无法为筛选后的数据生成图表');
    }
  } catch (error) {
    console.error('Failed to rebuild charts with filtered data:', error);
    ElMessage.warning('图表重建失败，请稍后重试');
  } finally {
    enrichingSheets.value.delete(sheet.sheetIndex);
  }
};

const handleGlobalFilterApply = (sheet: SheetResult) => {
  if (!globalFilterDimension.value || !globalFilterValues.value.length) {
    filteredRawData.value = null;
    totalRowCount.value = 0;
    filteredRowCount.value = 0;
    nextTick(() => renderActiveCharts());
    return;
  }

  // Debounce to avoid rapid re-filtering
  if (filterDebounceTimer) clearTimeout(filterDebounceTimer);
  filterDebounceTimer = setTimeout(() => {
    applyDataFilter(sheet);
  }, 300);
};

const clearGlobalFilter = (sheet: SheetResult) => {
  globalFilterDimension.value = '';
  globalFilterValues.value = [];
  filteredRawData.value = null;
  totalRowCount.value = 0;
  filteredRowCount.value = 0;

  // Reset to original data - trigger re-enrichment
  if (sheet.uploadId) {
    enrichSheet(sheet);
  }
};

// ========== Cross-chart linked filter (Phase 3.4 — Power BI + Superset + Tableau) ==========
const applyChartFilter = (sheet: SheetResult, params: any) => {
  const filterValue = params.name || params.seriesName || '';
  if (!filterValue) return;

  // Determine dimension from xAxis
  const charts = getSheetCharts(sheet);
  let dimension = '';
  for (const c of charts) {
    const xField = (c as any).xField;
    if (xField) { dimension = xField; break; }
    const xName = (c.config as any)?.xAxis?.name;
    if (xName) { dimension = xName; break; }
  }

  // Q1: Ctrl+click triggers global filter data filtering
  if (params.event?.event?.ctrlKey || params.event?.event?.metaKey) {
    globalFilterDimension.value = dimension || '项目';
    globalFilterValues.value = [filterValue];
    handleGlobalFilterApply(sheet);
    return;
  }

  // Toggle filter if same value
  if (activeFilter.value?.value === filterValue && activeFilter.value?.dimension === dimension) {
    activeFilter.value = null;
  } else {
    activeFilter.value = { dimension: dimension || '项目', value: filterValue };
  }

  // Re-render all charts with filter applied
  nextTick(() => renderActiveCharts());
};

const clearChartFilter = () => {
  activeFilter.value = null;
  nextTick(() => renderActiveCharts());
};

// ========== DOM-aware rendering helper (Phase 2.4) ==========
const waitForElement = (id: string, timeout = 2000): Promise<HTMLElement | null> => {
  return new Promise((resolve) => {
    const existing = document.getElementById(id);
    if (existing) { resolve(existing); return; }

    const observer = new MutationObserver(() => {
      const el = document.getElementById(id);
      if (el) { observer.disconnect(); resolve(el); }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
  });
};

// ========== Cleanup on unmount (Phase 2.2 — prevent memory leaks) ==========
// ========== keep-alive lifecycle: pause/resume side effects ==========
onDeactivated(() => {
  // Pause resize listener & auto-refresh when cached (navigated away)
  window.removeEventListener('resize', handleResize);
  if (autoRefreshTimer) { clearInterval(autoRefreshTimer); autoRefreshTimer = null; }
  clearHoverThrottleTimers();
});

onActivated(() => {
  // Resume resize listener when re-entering
  window.addEventListener('resize', handleResize);
  // Resize ECharts to fit (container size may have changed)
  nextTick(() => {
    document.querySelectorAll('[id^="chart-"]').forEach(dom => {
      const instance = echarts.getInstanceByDom(dom as HTMLElement);
      if (instance) instance.resize();
    });
  });
});

onBeforeUnmount(() => {
  if (renderDebounceTimer) clearTimeout(renderDebounceTimer);
  clearHoverThrottleTimers();
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  window.removeEventListener('resize', handleResize);
  // T5.2: Disconnect intersection observer
  if (chartObserver) { chartObserver.disconnect(); chartObserver = null; }
  pendingChartConfigs.clear();
  // Dispose all ECharts instances within this component's scope
  const root = document.querySelector('.smart-bi-analysis');
  (root || document).querySelectorAll('[id^="chart-"]').forEach(dom => {
    const instance = echarts.getInstanceByDom(dom as HTMLElement);
    if (instance) instance.dispose();
  });
  // Dispose stat heatmap if open
  disposeStatHeatmap();
});

// Cross-sheet analysis — provided by useSmartBICrossSheet composable

// 打开同比分析对话框
const openYoYComparison = () => {
  yoyResult.value = null;
  yoyLoading.value = false;
  yoySheetName.value = '';
  yoyVisible.value = true;
};

// 为指定 Sheet 运行同比分析
const runYoYForSheet = async (sheet: SheetResult) => {
  if (!sheet.uploadId) {
    ElMessage.warning('该 Sheet 没有持久化数据');
    return;
  }

  yoySheetName.value = getSheetDisplayName(sheet);
  yoyLoading.value = true;
  yoyResult.value = null;

  try {
    const result = await yoyComparison({ uploadId: sheet.uploadId });
    yoyResult.value = result;
  } catch (error) {
    console.error('YoY comparison failed:', error);
    yoyResult.value = {
      success: false,
      current_upload_id: sheet.uploadId,
      comparison: [],
      error: '同比分析失败'
    };
  } finally {
    yoyLoading.value = false;
  }
};

// 转换 YoY API 数据为组件格式
const transformYoYData = (comparison: YoYComparisonItem[]): ComparisonData[] => {
  return comparison.map(item => ({
    period: item.label,
    current: item.current_value,
    lastYearSame: item.previous_value,
    yoyGrowth: item.yoy_growth ?? 0
  }));
};

// P5: Statistical analysis — provided by useSmartBIStatistical composable

// 加载 Sheet 数据
const loadSheetData = async (sheet: SheetResult) => {
  if (!sheet.uploadId) {
    ElMessage.warning('该 Sheet 没有持久化数据');
    return;
  }
  previewUploadId.value = sheet.uploadId;
  previewSheetName.value = sheet.sheetName;
  previewPage.value = 1;
  showDataPreview.value = true;
  await loadPreviewData();
};

const loadPreviewData = async () => {
  if (!previewUploadId.value) return;
  previewLoading.value = true;
  try {
    const res = await getUploadTableData(previewUploadId.value, previewPage.value - 1, 50);
    if (res.success && res.data) {
      previewData.value = res.data;
    } else {
      ElMessage.error(res.message || '获取数据失败');
    }
  } catch (error) {
    ElMessage.error('加载数据失败');
  } finally {
    previewLoading.value = false;
  }
};

// 导航到指定 Sheet
const navigateToSheet = (sheetIndex: number) => {
  // 找到目标 Sheet 在 uploadedSheets 中的位置
  const targetSheet = uploadedSheets.value.find(s => s.sheetIndex === sheetIndex);
  if (targetSheet) {
    activeTab.value = String(sheetIndex);
  } else {
    ElMessage.warning('该报表数据未加载或处理失败');
  }
};

// 重置上传
const resetUpload = () => {
  fileList.value = [];
  uploadedSheets.value = [];
  uploadResult.value = null;
  activeTab.value = '';
  uploading.value = false;
  uploadProgress.value = 0;
  indexMetadata.value = null;
  enrichedSheets.value = new Set();
  enrichingSheets.value = new Set();
  enrichPhases.value = new Map();
};

// 重试失败的 Sheet
const handleRetrySheet = async (sheet: SheetResult) => {
  if (!sheet.uploadId) {
    ElMessage.error('该 Sheet 无上传记录，请重新上传文件');
    return;
  }

  retryingSheets[sheet.sheetIndex] = true;
  try {
    const res = await retrySheetUpload(sheet.uploadId);
    if (res.success) {
      ElMessage.success(res.data?.message || '重试成功');
      // Update sheet to successful state
      sheet.success = true;
      sheet.savedRows = res.data?.rowCount || 0;
      sheet.message = '重试成功';

      // Trigger enrichment for the retried sheet
      if (sheet.uploadId) {
        enrichedSheets.value.delete(sheet.uploadId);
        enrichingSheets.value.delete(sheet.uploadId);
        nextTick(() => {
          enrichSheetAnalysis(sheet.uploadId!).then(enrichResult => {
            if (enrichResult) {
              sheet.flowResult = {
                ...sheet.flowResult,
                charts: enrichResult.charts,
                kpiSummary: enrichResult.kpiSummary,
                structuredAI: enrichResult.structuredAI,
              };
              enrichedSheets.value.add(sheet.uploadId!);
            }
          }).catch(err => {
            console.warn('Enrichment after retry failed:', err);
          });
        });
      }
    } else {
      ElMessage.error(res.message || '重试失败');
    }
  } catch (error) {
    console.error('Retry failed:', error);
    ElMessage.error('重试请求失败');
  } finally {
    retryingSheets[sheet.sheetIndex] = false;
  }
};

// 将上传记录列表组装为一个批次
const makeBatch = (uploads: UploadHistoryItem[]): UploadBatch => {
  const first = uploads[0];
  const d = new Date(first.createdAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const uploadTime = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return {
    fileName: (first.fileName && first.fileName !== 'null' && first.fileName.trim() !== '') ? first.fileName : `Excel_${uploadTime.replace(/[- :]/g, '')}`,
    uploadTime,
    sheetCount: uploads.length,
    totalRows: uploads.reduce((sum, u) => sum + (u.rowCount || 0), 0),
    uploadId: first.id,
    id: first.id,
    uploads,
  };
};

// 选择某个批次，填充 uploadedSheets
const selectBatch = (index: number) => {
  selectedBatchIndex.value = index;
  const batch = uploadBatches.value[index];
  if (!batch) return;

  // U6: Show loading feedback when switching data source
  batchSwitching.value = true;

  const sorted = [...batch.uploads].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  uploadedSheets.value = sorted.map((u, idx) => ({
    sheetIndex: idx,
    sheetName: u.sheetName,
    success: true,
    message: '从历史记录加载',
    tableType: u.tableType as SheetResult['tableType'],
    detectedDataType: u.tableType,
    savedRows: u.rowCount,
    uploadId: u.id,
    flowResult: {},
  }));

  // 重建 indexMetadata：服务端可能未区分 index 类型（统一存为 general），
  // 因此同时按 tableType 和 sheet 名称模式匹配检测索引页
  const indexNamePattern = /^(索引|目录|index|目次|sheet\s*index)$/i;
  const indexSheet = uploadedSheets.value.find(
    s => s.tableType === 'index' || indexNamePattern.test(s.sheetName.trim())
  );
  if (indexSheet) {
    indexSheet.tableType = 'index';  // 补齐 tableType
    indexMetadata.value = {
      hasIndex: true,
      indexSheetIndex: indexSheet.sheetIndex,
      sheetMappings: uploadedSheets.value
        .filter(s => s !== indexSheet)
        .map(s => ({ index: s.sheetIndex, reportName: s.sheetName, sheetName: s.sheetName })),
    };
  } else {
    indexMetadata.value = null;
  }

  uploadResult.value = {
    totalSheets: sorted.length,
    successCount: sorted.length,
    failedCount: 0,
    requiresConfirmationCount: 0,
    totalSavedRows: batch.totalRows,
    message: `${safeBatchName(batch)} (${batch.sheetCount} 表, ${batch.totalRows} 行)`,
    results: uploadedSheets.value,
  };

  enrichedSheets.value = new Set();
  enrichingSheets.value = new Set();
  enrichPhases.value = new Map();
  activeTab.value = '0';
  nextTick(() => {
    // U6: Clear loading after DOM updates with new batch data
    batchSwitching.value = false;
    renderActiveChart();
    // R-11: 自动触发当前 tab sheet 的 enrichment（history 加载后 flowResult 为空）
    const activeSheet = uploadedSheets.value.find(s => s.sheetIndex === 0);
    if (activeSheet && !isIndexSheet(activeSheet) && activeSheet.uploadId) {
      enrichSheet(activeSheet);
    }
  });
};

// 加载历史上传记录（按文件名 + 时间窗口分组为批次）
const loadHistory = async () => {
  historyLoading.value = true;
  try {
    const response = await getUploadHistory();
    if (!response.success || !response.data?.length) return;

    const uploads = response.data as UploadHistoryItem[];
    const batches: UploadBatch[] = [];
    let currentBatch: UploadHistoryItem[] = [];
    let currentFileName = '';
    let currentTime = 0;

    for (const u of uploads) {
      const t = new Date(u.createdAt).getTime();
      if (u.fileName !== currentFileName || (currentTime - t) > 5 * 60 * 1000) {
        if (currentBatch.length > 0) {
          batches.push(makeBatch(currentBatch));
        }
        currentBatch = [u];
        currentFileName = u.fileName;
        currentTime = t;
      } else {
        currentBatch.push(u);
      }
    }
    if (currentBatch.length > 0) batches.push(makeBatch(currentBatch));

    // 如果已从 demo 缓存恢复了数据，保留缓存中的 uploadId，只追加服务器批次
    if (usingDemoCache.value) {
      // 保留当前缓存批次（第一个），追加服务器批次到后面
      const cached = uploadBatches.value[0];
      if (cached) {
        uploadBatches.value = [cached, ...batches];
      } else {
        uploadBatches.value = batches;
      }
    } else {
      uploadBatches.value = batches;
      if (batches.length > 0) {
        selectBatch(0);
      }
    }
  } catch (error) {
    console.error('加载历史记录失败:', error);
  } finally {
    historyLoading.value = false;
  }
};

// ========== Window resize handler for ECharts (R-9) ==========
const handleResize = () => {
  document.querySelectorAll('[id^="chart-"]').forEach(dom => {
    const instance = echarts.getInstanceByDom(dom as HTMLElement);
    if (instance) instance.resize();
  });
};

// Q2: Auto-refresh timer methods
const setAutoRefresh = (interval: number) => {
  autoRefreshInterval.value = interval;
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  if (interval > 0) {
    autoRefreshTimer = setInterval(() => {
      const sheet = currentSheet.value;
      if (sheet) handleRefreshAnalysis(sheet);
    }, interval);
  }
};

// Q5: Keyboard shortcuts integration
const currentSheet = computed(() => {
  const idx = parseInt(activeTab.value);
  return uploadedSheets.value.find(s => s.sheetIndex === idx) || null;
});

const switchToPrevSheet = () => {
  const idx = parseInt(activeTab.value);
  if (isNaN(idx) || uploadedSheets.value.length === 0) return;
  const currentIndex = uploadedSheets.value.findIndex(s => s.sheetIndex === idx);
  if (currentIndex > 0) {
    activeTab.value = String(uploadedSheets.value[currentIndex - 1].sheetIndex);
  }
};

const switchToNextSheet = () => {
  const idx = parseInt(activeTab.value);
  if (isNaN(idx) || uploadedSheets.value.length === 0) return;
  const currentIndex = uploadedSheets.value.findIndex(s => s.sheetIndex === idx);
  if (currentIndex >= 0 && currentIndex < uploadedSheets.value.length - 1) {
    activeTab.value = String(uploadedSheets.value[currentIndex + 1].sheetIndex);
  }
};

const { showHelp: showShortcutsHelp, shortcuts: shortcutsList } = useSmartBIShortcuts({
  onPrevSheet: switchToPrevSheet,
  onNextSheet: switchToNextSheet,
  onRefresh: () => { const s = currentSheet.value; if (s) handleRefreshAnalysis(s); },
  onExport: () => { const s = currentSheet.value; if (s) handleExportExcel(s); },
  onShare: openShareDialog,
  onToggleLayout: () => { layoutEditMode.value = !layoutEditMode.value; },
  onHelp: () => { showShortcutsHelp.value = !showShortcutsHelp.value; },
});

onMounted(() => {
  // 后台检查 Python 服务健康状态 (with retry)
  checkHealthWithRetry().catch(() => {});

  // Demo 缓存快速恢复: 如果有缓存，跳过网络请求直接渲染
  const restoredFromCache = restoreFromDemoCache();
  if (restoredFromCache) {
    nextTick(() => {
      renderActiveChart();
      // 如果缓存中的 sheet 已有图表数据，标记 tour ready
      const activeSheet = uploadedSheets.value.find(s => s.sheetIndex === parseInt(activeTab.value));
      if (activeSheet && hasChartData(activeSheet)) {
        tourDataReady.value = true;
      }
      // 后台静默刷新: 异步加载服务端历史，不影响当前渲染
      loadHistory();
    });
  } else {
    loadHistory();
  }
  window.addEventListener('resize', handleResize);
});
</script>

<style scoped lang="scss">
.smart-bi-analysis {
  padding: 20px;

  .upload-card {
    max-width: 1400px;
    margin: 0 auto;

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .title {
        font-size: 18px;
        font-weight: bold;
      }
    }
  }

  .upload-section {
    padding: 40px 20px;
    text-align: center;

    .upload-dragger {
      :deep(.el-upload-dragger) {
        width: 600px;
        padding: 60px 40px;
      }

      .el-icon--upload {
        font-size: 80px;
        color: #409eff;
        margin-bottom: 20px;
      }
    }
  }

  .progress-section {
    padding: 60px 100px;

    .progress-text {
      text-align: center;
      margin-top: 16px;
      color: #606266;
      font-size: 14px;
    }

    .sheet-progress-panel {
      margin-top: 24px;
      padding: 16px;
      background: #f5f7fa;
      border-radius: 8px;
      border: 1px solid #e4e7ed;

      .progress-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e4e7ed;

        span {
          font-weight: 600;
          color: #303133;
        }

        .el-tag {
          margin-left: auto;
        }

        .el-tag + .el-tag {
          margin-left: 8px;
        }
      }

      .sheet-progress-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 300px;
        overflow-y: auto;

        .sheet-progress-item {
          display: grid;
          grid-template-columns: 200px 120px 1fr;
          gap: 16px;
          align-items: center;
          padding: 12px 16px;
          background: #fff;
          border-radius: 6px;
          border: 1px solid #e4e7ed;
          transition: all 0.3s ease;

          &.is-complete {
            background: #f0f9eb;
            border-color: #c2e7b0;
          }

          &.is-failed {
            background: #fef0f0;
            border-color: #fbc4c4;
          }

          .sheet-name {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 500;
            color: #303133;

            .status-icon {
              font-size: 16px;

              &.success {
                color: #67c23a;
              }

              &.error {
                color: #f56c6c;
              }

              &.loading {
                color: #409eff;
                animation: rotating 2s linear infinite;
              }
            }
          }

          .sheet-stage {
            font-size: 13px;
            color: #909399;
            padding: 4px 8px;
            background: #f4f4f5;
            border-radius: 4px;
            text-align: center;
          }

          .sheet-message {
            font-size: 13px;
            color: #606266;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
      }
    }
  }

  @keyframes rotating {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .demo-cache-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    margin-bottom: 12px;
    background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%);
    border: 1px solid #86efac;
    border-radius: 8px;
    font-size: 13px;
    color: #166534;

    .cache-banner-left {
      display: flex;
      align-items: center;
      gap: 8px;

      .el-icon {
        color: #22c55e;
        font-size: 16px;
      }
    }
  }

  .result-section {
    margin-top: 20px;

    .industry-templates-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      margin-top: 12px;
      background: linear-gradient(135deg, #f0f9eb 0%, #e1f3d8 100%);
      border-radius: 8px;
      border: 1px solid #e1f3d8;
      flex-wrap: wrap;

      .templates-label {
        font-size: 13px;
        font-weight: 600;
        color: #67c23a;
        white-space: nowrap;
      }

      .template-chip {
        cursor: pointer;
        transition: all 0.2s;
        &:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 6px rgba(103, 194, 58, 0.3);
        }
      }
    }

    .sheet-tabs {
      margin-top: 24px;

      .sheet-info {
        margin-bottom: 24px;
      }

      .kpi-section {
        margin-bottom: 20px;

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }
      }

      // 高管摘要横幅 (Power BI Copilot + Narrative BI)
      .executive-summary-banner {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding: 18px 22px;
        margin-bottom: 20px;
        background: linear-gradient(135deg, #2563eb06 0%, #7c3aed06 100%);
        border: 1px solid #2563eb20;
        border-left: 4px solid #2563eb;
        border-radius: 12px;

        .summary-icon {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .summary-body {
          flex: 1;
          min-width: 0;
        }

        .summary-text {
          font-size: 14px;
          line-height: 1.6;
          color: #1f2937;
          font-weight: 500;
        }

        .summary-inline-kpis {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #e5e7eb;

          .inline-kpi {
            display: flex;
            flex-direction: column;
            gap: 2px;

            .inline-kpi-label {
              font-size: 11px;
              color: #9ca3af;
              font-weight: 500;
            }

            .inline-kpi-value {
              font-size: 16px;
              font-weight: 700;
              color: #1f2937;
            }

            .inline-kpi-trend {
              font-size: 11px;
              font-weight: 600;
              &.up { color: #059669; }
              &.down { color: #dc2626; }
            }
          }
        }

        .summary-tags {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }
      }

      .chart-section {
        margin: 24px 0;

        h3 {
          margin-bottom: 16px;
          font-size: 16px;
          color: #303133;
        }

        .chart-dashboard {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;

          // Responsive breakpoints (Superset adaptive + Power BI magnetic grid)
          @media (min-width: 1400px) { grid-template-columns: repeat(3, 1fr); }
          @media (max-width: 900px) { grid-template-columns: 1fr; }

          .chart-action-bar {
            grid-column: 1 / -1;
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 4px;
            padding: 8px 12px;
            background: #f5f7fa;
            border-radius: 6px;
          }

          .chart-count-hint {
            font-size: 12px;
            color: #909399;
          }

          .chart-grid-item {
            background: #fff;
            border-radius: 12px;
            border: none;
            padding: 20px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06);
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            /* T5.1: CSS containment — prevents layout recalc cascade between chart cards */
            contain: layout style paint;
            content-visibility: auto;
            contain-intrinsic-size: auto 360px;

            &:hover {
              box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 10px rgba(0, 0, 0, 0.06);
              transform: translateY(-2px);
            }

            .chart-title-row {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 16px;
            }

            .chart-title {
              font-size: 14px;
              font-weight: 600;
              color: #374151;
              margin-bottom: 16px;
              padding-bottom: 0;
              border-bottom: none;
              display: flex;
              align-items: center;
              gap: 8px;
            }

            .chart-export-btn {
              opacity: 0;
              transition: opacity 0.2s;
            }

            .chart-controls {
              display: flex;
              gap: 4px;
              align-items: center;
              opacity: 0;
              transition: opacity 0.2s;
            }

            &:hover .chart-export-btn {
              opacity: 1;
            }

            &:hover .chart-controls {
              opacity: 1;
            }

            .chart-container {
              width: 100%;
              height: 320px;
            }

            // Hero chart (first) — full width
            &:first-child {
              grid-column: 1 / -1;

              .chart-container {
                height: 400px;
              }
            }
          }

          // Single chart fills width
          &:has(.chart-grid-item:only-child) {
            grid-template-columns: 1fr;

            .chart-container {
              height: 450px;
            }
          }

          // Active filter indicator
          .chart-filter-bar {
            grid-column: 1 / -1;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: #eff6ff;
            border-radius: 8px;
            font-size: 13px;
            color: #2563eb;
          }
        }

        .global-filter-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 16px;
          margin-bottom: 12px;
          background: linear-gradient(135deg, #f0f5ff 0%, #e6f0ff 100%);
          border: 1px solid #d6e4ff;
          border-radius: 8px;
          font-size: 13px;

          .filter-bar-icon {
            color: #4080ff;
            font-size: 16px;
          }

          .filter-count-badge {
            padding: 2px 10px;
            background: #4080ff;
            color: white;
            border-radius: 10px;
            font-size: 12px;

            &.filter-data-badge {
              background: #67c23a;
              margin-left: 8px;
            }
          }
        }

        .chart-container {
          width: 100%;
          height: 500px;
          border-radius: 8px;
        }

        .chart-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 300px;
          color: #909399;

          p {
            margin-top: 12px;
            font-size: 14px;
          }
        }

        .chart-skeleton-wrapper {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 16px;

          .chart-progress-hint {
            grid-column: 1 / -1;
            text-align: center;
            color: #909399;
            font-size: 13px;
            padding: 4px 0;
            animation: pulse-opacity 1.5s ease-in-out infinite;
          }
        }

        @keyframes pulse-opacity {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      }

      .ai-analysis-section {
        margin: 24px 0;

        h3 {
          margin-bottom: 16px;
          font-size: 16px;
          color: #303133;
        }

        .analysis-card {
          background: #f9fafc;

          .analysis-content {
            line-height: 1.8;
            color: #606266;
            white-space: pre-wrap;

            :deep(.highlight) {
              color: #409eff;
              font-weight: 500;
            }

            :deep(strong) {
              color: #303133;
            }
          }
        }

        // AIInsightPanel 间距
        :deep(.ai-insight-panel) {
          margin-top: 0;
        }

        .cache-hint {
          margin-top: 12px;
          font-size: 12px;
          color: #909399;
          text-align: right;
        }
      }

      .data-preview-section {
        margin: 24px 0;

        h3 {
          margin-bottom: 16px;
          font-size: 16px;
          color: #303133;
        }
      }

      .empty-sheet {
        padding: 60px 20px;
        background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
        border-radius: 12px;
        margin: 24px 0;
        text-align: center;

        .empty-illustration {
          margin-bottom: 16px;
          opacity: 0.6;
        }

        :deep(.el-empty__description p) {
          color: #6b7280;
          font-size: 14px;
        }
      }

      // 自定义 Tab 标签样式
      .custom-tab-label {
        display: flex;
        align-items: center;
        gap: 6px;

        .el-icon {
          font-size: 14px;
        }

        .el-tag {
          margin-left: 4px;
        }

        &.is-index {
          color: #8b5cf6;
          font-weight: 600;

          .el-icon {
            color: #8b5cf6;
          }
        }

        &.is-failed {
          color: #F56C6C;
        }
      }

      .failed-sheet-view {
        padding: 40px 20px;
        text-align: center;
      }

      // 图表区域头部（含下钻提示）
      .chart-section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;

        h3 {
          font-size: 16px;
          color: #303133;
          margin: 0;
        }

        .chart-section-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .drill-hint {
          font-size: 12px;
          color: #909399;
          background: #f4f4f5;
          padding: 4px 10px;
          border-radius: 12px;
        }
      }

      .header-actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      // 索引页视图样式
      .index-page-view {
        padding: 24px;

        .index-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 2px solid #e5e7eb;

          .index-icon {
            font-size: 28px;
            color: #8b5cf6;
          }

          h2 {
            font-size: 20px;
            font-weight: 600;
            color: #1f2937;
            margin: 0;
            flex: 1;
          }

          .index-count {
            font-size: 14px;
            color: #6b7280;
            background: #f3f4f6;
            padding: 4px 12px;
            border-radius: 16px;
          }
        }

        .index-list {
          display: flex;
          flex-direction: column;
          gap: 12px;

          .index-item {
            display: flex;
            align-items: center;
            padding: 16px;
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s ease;

            &:hover {
              border-color: #3b82f6;
              box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
              transform: translateY(-2px);
            }

            &.is-current {
              border-color: #8b5cf6;
              background: #f5f3ff;
            }

            .item-number {
              width: 36px;
              height: 36px;
              border-radius: 50%;
              background: #f3f4f6;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 600;
              color: #4b5563;
              margin-right: 16px;
              flex-shrink: 0;
            }

            &:hover .item-number,
            &.is-current .item-number {
              background: #dbeafe;
              color: #3b82f6;
            }

            .item-content {
              flex: 1;
              min-width: 0;

              .item-name {
                font-size: 15px;
                font-weight: 600;
                color: #1f2937;
                margin-bottom: 4px;
              }

              .item-sheet {
                font-size: 12px;
                color: #9ca3af;
                margin-bottom: 4px;
              }

              .item-description {
                display: flex;
                align-items: flex-start;
                gap: 6px;
                font-size: 13px;
                color: #6b7280;
                line-height: 1.5;
                margin-top: 8px;
                padding: 8px 12px;
                background: #f9fafb;
                border-radius: 6px;

                .el-icon {
                  color: #8b5cf6;
                  margin-top: 2px;
                  flex-shrink: 0;
                }
              }
            }

            .item-arrow {
              font-size: 20px;
              color: #9ca3af;
              margin-left: 12px;
              flex-shrink: 0;
            }

            &:hover .item-arrow {
              color: #3b82f6;
            }
          }
        }

        .index-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
          color: #9ca3af;
          font-size: 13px;

          .el-icon {
            font-size: 16px;
          }
        }
      }
    }
  }
}

// 下钻抽屉样式（scoped 外部组件需要 :deep 或全局选择器）
.drill-down-header {
  display: flex;
  align-items: center;
  gap: 12px;

  .drill-title {
    font-size: 16px;
    font-weight: 600;
  }
}

// P4: 面包屑导航
.drill-breadcrumb {
  margin-bottom: 16px;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
}

// P4: 可下钻维度
.drill-dimensions {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;

  .drill-dim-label {
    color: #606266;
    font-size: 13px;
  }
}

.drill-hint-inline {
  font-size: 12px;
  color: #909399;
  font-weight: normal;
}

.drill-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #909399;

  p {
    margin-top: 16px;
    font-size: 14px;
  }
}

.drill-chart-section,
.drill-summary-section,
.drill-ai-section,
.drill-table-section {
  margin-bottom: 24px;

  h4 {
    font-size: 15px;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 2px solid #f0f0f0;
  }
}

.drill-chart-container {
  width: 100%;
  height: 300px;
}

.drill-insight-card {
  background: #f9fafc;

  .analysis-content {
    line-height: 1.8;
    color: #606266;
    white-space: pre-wrap;
  }
}

// 综合分析样式
.cross-sheet-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  color: #909399;

  p {
    margin-top: 16px;
    font-size: 15px;
  }
}

.cross-summary-banner {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 20px 24px;
  margin-bottom: 24px;
  background: linear-gradient(135deg, #667eea08 0%, #764ba208 100%);
  border: 1px solid #667eea30;
  border-left: 4px solid #667eea;
  border-radius: 8px;

  .summary-icon {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }

  .summary-text {
    font-size: 14px;
    line-height: 1.7;
    color: #1f2937;
  }
}

.cross-kpi-section,
.cross-charts-section {
  margin-bottom: 28px;

  h3 {
    font-size: 17px;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 16px;
  }
}

.cross-chart-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;

  .cross-chart-item {
    background: #fff;
    border-radius: 8px;
    border: 1px solid #ebeef5;
    padding: 16px;

    &:first-child {
      grid-column: 1 / -1;
    }

    .chart-title {
      font-size: 15px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 12px;
    }

    .cross-chart-container {
      width: 100%;
      height: 350px;
    }
  }

  // P5: 因果分析样式
  .stat-section {
    margin-bottom: 24px;

    h3 {
      margin: 0 0 12px;
      font-size: 16px;
      font-weight: 600;
      color: #303133;
    }
  }

  .stat-chart-container {
    width: 100%;
    border: 1px solid #ebeef5;
    border-radius: 4px;
    margin-bottom: 16px;
  }

  .stat-pairs {
    margin-top: 12px;

    h4 {
      margin: 0 0 8px;
      font-size: 14px;
      color: #606266;
    }
  }

  .stat-pair-list {
    display: flex;
    flex-wrap: wrap;
  }

  .stat-comparison-card {
    margin-bottom: 16px;
  }

  .stat-top-bottom {
    display: flex;
    gap: 24px;
    margin-top: 12px;

    h5 {
      margin: 0 0 6px;
      font-size: 13px;
      color: #606266;
    }
  }

  .stat-outlier-list {
    display: flex;
    flex-wrap: wrap;
  }

  // P6: 编排模式样式
  .layout-mode-switch {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .builder-wrapper {
    min-height: 500px;

    .builder-chart-el {
      min-height: 200px;
    }
  }
}

// A6: 食品行业标准参考面板
.food-industry-panel {
  margin-bottom: 20px;
  border: 1px solid #b7eb8f;
  border-radius: 8px;
  overflow: hidden;

  :deep(.el-collapse-item__header) {
    background: linear-gradient(135deg, #f6ffed 0%, #fcffe6 100%);
    padding: 0 16px;
    height: 44px;
    border-bottom: none;
  }

  :deep(.el-collapse-item__wrap) {
    border-top: 1px solid #d9f7be;
  }

  .food-industry-header {
    display: flex;
    align-items: center;
    font-size: 14px;
    font-weight: 600;
    color: #389e0d;
  }

  .food-standards-content {
    padding: 16px;

    .standards-section,
    .benchmarks-section,
    .keywords-section {
      margin-bottom: 14px;

      &:last-child {
        margin-bottom: 0;
      }

      h4 {
        font-size: 13px;
        font-weight: 600;
        color: #1f2937;
        margin: 0 0 8px;
      }

      ul {
        margin: 0;
        padding-left: 20px;
        color: #4b5563;
        font-size: 13px;
        line-height: 1.8;
      }
    }
  }
}

// P1.3: 查看更多按钮
.chart-view-more {
  text-align: center;
  padding: 6px 0 2px;
  border-top: 1px dashed #e5e7eb;
  margin-top: 4px;
}
</style>
