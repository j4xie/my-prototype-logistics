<template>
  <div class="smart-bi-analysis">
    <el-card class="upload-card">
      <template #header>
        <div class="card-header">
          <span class="title">📊 智能数据分析</span>
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
                :label="`${batch.fileName} (${batch.sheetCount} Sheets)`"
                :value="idx"
              >
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>{{ batch.fileName }}</span>
                  <span style="color: #909399; font-size: 12px; margin-left: 12px;">
                    {{ batch.uploadTime }} · {{ batch.sheetCount }} Sheets
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
            <el-button v-if="canUpload && uploadedSheets.length > 0" @click="resetUpload" type="warning" size="small">
              <el-icon><Upload /></el-icon>
              上传新文件
            </el-button>
          </div>
        </div>
      </template>

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
        <el-empty v-else description="暂无分析数据，请联系管理员上传 Excel 文件" />
      </div>

      <!-- 上传进度 (SSE 流式) -->
      <div v-if="uploading" class="progress-section">
        <el-progress :percentage="uploadProgress" :status="uploadStatus" :stroke-width="20" striped striped-flow></el-progress>
        <p class="progress-text">{{ progressText }}</p>

        <!-- 详细进度面板 -->
        <div v-if="sheetProgressList.length > 0" class="sheet-progress-panel">
          <div class="progress-header">
            <span>📊 Sheet 处理进度 ({{ completedSheetCount }}/{{ totalSheetCount }})</span>
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

      <!-- 结果展示 -->
      <div v-if="uploadedSheets.length > 0 && !uploading" class="result-section">
        <el-alert
          :title="`成功处理 ${uploadResult.totalSheets} 个 Sheet，共 ${uploadResult.totalSavedRows} 行数据`"
          type="success"
          :closable="false"
          show-icon
        />

        <el-tabs v-model="activeTab" class="sheet-tabs">
          <el-tab-pane
            v-for="sheet in uploadedSheets"
            :key="sheet.sheetIndex"
            :name="String(sheet.sheetIndex)"
          >
            <!-- 自定义 Tab 标签 -->
            <template #label>
              <span class="custom-tab-label" :class="{ 'is-index': isIndexSheet(sheet) }">
                <el-icon v-if="isIndexSheet(sheet)"><List /></el-icon>
                <el-icon v-else><Document /></el-icon>
                <span>{{ getSheetDisplayName(sheet) }}</span>
                <el-tag v-if="!isIndexSheet(sheet)" size="small" type="info">{{ sheet.savedRows }}行</el-tag>
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

              <!-- KPI 统计卡片 -->
              <div v-if="sheet.flowResult?.kpiSummary" class="kpi-section">
                <div class="kpi-grid">
                  <KPICard
                    v-for="kpi in getSheetKPIs(sheet)"
                    :key="kpi.title"
                    :title="kpi.title"
                    :value="kpi.value"
                    :unit="kpi.unit"
                    :trend="kpi.trend"
                    :trendValue="kpi.trendValue"
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
                <div v-if="enrichingSheets.has(sheet.sheetIndex) && !hasChartData(sheet)" class="chart-loading">
                  <el-icon class="is-loading" :size="32"><Loading /></el-icon>
                  <p>正在通过 AI 生成图表...</p>
                </div>

                <!-- P6: 编排模式 — DashboardBuilder -->
                <div v-else-if="layoutEditMode" class="builder-wrapper">
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

                <!-- 标准模式 -->
                <div v-else class="chart-dashboard">
                  <!-- Cross-chart filter bar -->
                  <div v-if="activeFilter" class="chart-filter-bar">
                    <el-icon><Filter /></el-icon>
                    <span>过滤: {{ activeFilter.dimension }} = <strong>{{ activeFilter.value }}</strong></span>
                    <el-button type="primary" link size="small" @click="clearChartFilter">清除过滤</el-button>
                  </div>
                  <div v-for="(chart, idx) in getSheetCharts(sheet)" :key="idx" class="chart-grid-item">
                    <div class="chart-title-row">
                      <div class="chart-title" style="margin-bottom:0">{{ chart.title || '数据分析' }}</div>
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
                    <div :id="`chart-${sheet.sheetIndex}-${idx}`" class="chart-container"></div>
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
                  <!-- Risk/Opportunity tags -->
                  <div v-if="getStructuredInsight(sheet)" class="summary-tags">
                    <el-tag v-if="getStructuredInsight(sheet)?.riskAlerts?.length" type="danger" size="small" effect="plain">
                      {{ getStructuredInsight(sheet)!.riskAlerts.length }} 个风险
                    </el-tag>
                    <el-tag v-if="getStructuredInsight(sheet)?.opportunities?.length" type="success" size="small" effect="plain">
                      {{ getStructuredInsight(sheet)!.opportunities.length }} 个机会
                    </el-tag>
                  </div>
                </div>
              </div>

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
                  <h3>🤖 AI 智能分析</h3>
                  <div v-if="enrichingSheets.has(sheet.sheetIndex) && !sheet.flowResult?.aiAnalysis" class="chart-loading">
                    <el-icon class="is-loading" :size="24"><Loading /></el-icon>
                    <p>正在生成 AI 分析洞察...</p>
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
                <h3>📋 数据预览</h3>
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
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { post } from '@/api/request';
import { getUploadTableData, getUploadHistory, enrichSheetAnalysis, getSmartKPIs, chartDrillDown, crossSheetAnalysis, yoyComparison, renameMeaninglessColumns, statisticalAnalysis, invalidateAnalysisCache } from '@/api/smartbi';
import type { UploadHistoryItem, EnrichResult, ColumnSummary, StructuredAIData, SmartKPI, DrillDownResult as DrillDownResultType, CrossSheetResult as CrossSheetResultType, FinancialMetrics, YoYResult, YoYComparisonItem, StatisticalResult } from '@/api/smartbi';
import { ElMessage } from 'element-plus';
import { UploadFilled, Upload, Refresh, CircleCheckFilled, CircleCloseFilled, Loading, List, Document, Tickets, InfoFilled, ArrowRight, Pointer, DataAnalysis, TrendCharts, Download, Filter } from '@element-plus/icons-vue';
import type { UploadFile, UploadUserFile, UploadInstance } from 'element-plus';
import * as echarts from 'echarts';
import KPICard from '@/components/smartbi/KPICard.vue';
import AIInsightPanel from '@/components/smartbi/AIInsightPanel.vue';
import YoYMoMComparisonChart from '@/components/smartbi/YoYMoMComparisonChart.vue';
import DashboardBuilder from '@/components/smartbi/DashboardBuilder.vue';
import type { DashboardLayout, DashboardCard, ChartDefinition } from '@/components/smartbi/DashboardBuilder.vue';
import type { ComparisonData } from '@/components/smartbi/YoYMoMComparisonChart.vue';
import type { AIInsight } from '@/components/smartbi/AIInsightPanel.vue';

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
}
const uploadBatches = ref<UploadBatch[]>([]);
const selectedBatchIndex = ref<number>(0);
const historyLoading = ref(false);

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
    charts?: Array<{ chartType: string; title: string; config: Record<string, unknown> }>;
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

// Enrichment 状态 (前端驱动的图表/AI补充)
const enrichingSheets = ref<Set<number>>(new Set());
const enrichedSheets = ref<Set<number>>(new Set());
// R-21: 缓存 enrichment 获取的原始数据，避免 drill-down 重复请求
const sheetRawDataCache = new Map<number, Record<string, unknown>[]>();
// 缓存时间戳：uploadId → cachedAt ISO string
const cachedAtMap = ref<Map<number, string>>(new Map());

// 下钻分析状态
const drillDownVisible = ref(false);
const drillDownLoading = ref(false);
const drillDownResult = ref<DrillDownResultType | null>(null);
const drillDownContext = ref<{ dimension: string; filterValue: string; sheetName: string }>({
  dimension: '', filterValue: '', sheetName: ''
});

// P4: 多级下钻栈
interface DrillLevel {
  dimension: string;
  filterValue: string;
  result: DrillDownResultType;
  hierarchyType?: string;
  currentLevel?: number;
}
const drillStack = ref<DrillLevel[]>([]);
const currentDrillSheet = ref<SheetResult | null>(null);

// 综合分析状态
const crossSheetVisible = ref(false);
const crossSheetLoading = ref(false);
const crossSheetResult = ref<CrossSheetResultType | null>(null);
const crossSheetKpiKeys = computed(() => {
  if (!crossSheetResult.value?.kpiComparison?.length) return [];
  const keys = new Set<string>();
  for (const item of crossSheetResult.value.kpiComparison) {
    if (item.kpis) Object.keys(item.kpis).forEach(k => keys.add(k));
  }
  return [...keys];
});

// 同比分析状态
const yoyVisible = ref(false);
const yoyLoading = ref(false);
const yoyResult = ref<YoYResult | null>(null);
const yoySheetName = ref('');
const dataSheets = computed(() => uploadedSheets.value.filter(s => !isIndexSheet(s) && s.uploadId));

// P5: 因果分析状态
const statisticalVisible = ref(false);
const statisticalLoading = ref(false);
const statisticalResult = ref<StatisticalResult | null>(null);

const distributionTableData = computed(() => {
  if (!statisticalResult.value?.distributions) return [];
  return Object.entries(statisticalResult.value.distributions).map(([col, d]) => ({
    column: col,
    mean: d.mean.toLocaleString(undefined, { maximumFractionDigits: 2 }),
    median: d.median.toLocaleString(undefined, { maximumFractionDigits: 2 }),
    std: d.std.toLocaleString(undefined, { maximumFractionDigits: 2 }),
    min: d.min.toLocaleString(undefined, { maximumFractionDigits: 2 }),
    max: d.max.toLocaleString(undefined, { maximumFractionDigits: 2 }),
    distribution_type: d.distribution_type,
    is_normal: d.is_normal,
    cv: (d.coefficient_of_variation * 100).toFixed(1) + '%',
  }));
});

const distributionTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    'normal': '正态分布',
    'skewed_right': '右偏分布',
    'skewed_left': '左偏分布',
    'bimodal': '双峰分布',
    'uniform': '均匀分布',
    'heavy_tailed': '重尾分布',
    'unknown': '未知',
  };
  return labels[type] || type;
};

// P6: 编排模式状态
const layoutEditMode = ref(false);
const dashboardLayouts = ref<Map<number, DashboardLayout>>(new Map());

const availableChartDefinitions: ChartDefinition[] = [
  { type: 'bar', name: '柱状图', defaultWidth: 6, defaultHeight: 3, minWidth: 3, minHeight: 2 },
  { type: 'line', name: '折线图', defaultWidth: 6, defaultHeight: 3, minWidth: 3, minHeight: 2 },
  { type: 'pie', name: '饼图', defaultWidth: 4, defaultHeight: 3, minWidth: 3, minHeight: 2 },
  { type: 'area', name: '面积图', defaultWidth: 6, defaultHeight: 3, minWidth: 3, minHeight: 2 },
  { type: 'scatter', name: '散点图', defaultWidth: 6, defaultHeight: 3, minWidth: 4, minHeight: 2 },
  { type: 'waterfall', name: '瀑布图', defaultWidth: 8, defaultHeight: 3, minWidth: 4, minHeight: 3 },
];

// P6: charts → DashboardLayout 转换
const chartsToLayout = (charts: Array<{ chartType: string; title: string; config: Record<string, unknown> }>, sheetName: string, uploadId?: number): DashboardLayout => {
  // Try to load saved layout
  if (uploadId) {
    const saved = loadSavedLayout(uploadId);
    if (saved && saved.cards.length === charts.length && saved.cards.every((card, i) => card.chartType === (charts[i].chartType || 'bar'))) return saved;
  }

  return {
    id: `layout-${sheetName}`,
    name: sheetName,
    cards: charts.map((chart, i) => ({
      id: `card-${i}`,
      chartType: chart.chartType || 'bar',
      title: chart.title || `图表${i + 1}`,
      x: (i % 2) * 6,
      y: Math.floor(i / 2) * 3,
      w: i === 0 ? 12 : 6,
      h: i === 0 ? 4 : 3,
      config: chart.config
    }))
  };
};

const layoutCacheMap = new Map<string, DashboardLayout>();
const getCachedLayout = (sheet: SheetResult): DashboardLayout => {
  const charts = getSheetCharts(sheet);
  const cacheKey = `${sheet.uploadId}-${sheet.sheetIndex}-${charts.length}`;
  const cached = layoutCacheMap.get(cacheKey);
  if (cached) return cached;
  const layout = chartsToLayout(charts, sheet.sheetName, sheet.uploadId);
  layoutCacheMap.set(cacheKey, layout);
  return layout;
};

const handleLayoutChange = (layout: DashboardLayout) => {
  // Update internal reference
};

const handleLayoutSave = (layout: DashboardLayout, uploadId?: number) => {
  if (uploadId) {
    saveLayout(uploadId, layout);
    ElMessage.success('布局已保存');
  }
};

const saveLayout = (uploadId: number, layout: DashboardLayout) => {
  const key = `smartbi-layout-${uploadId}`;
  localStorage.setItem(key, JSON.stringify(layout));
};

const loadSavedLayout = (uploadId: number): DashboardLayout | null => {
  const key = `smartbi-layout-${uploadId}`;
  const saved = localStorage.getItem(key);
  try {
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

// ========== Cross-chart filter state (Phase 3.4) ==========
const activeFilter = ref<{ dimension: string; value: string } | null>(null);

// ========== Debounce timer for tab switch (Phase 2.3) ==========
let renderDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// 获取 Sheet 的所有图表（多图表优先，单图表兼容）
const getSheetCharts = (sheet: SheetResult): Array<{ chartType: string; title: string; config: Record<string, unknown>; xField?: string }> => {
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
    uploadedSheets.value = result.results?.filter((r: SheetResult) => r.success) || [];

    // 捕获索引元数据
    if (result.indexMetadata) {
      indexMetadata.value = result.indexMetadata;
      console.log('=== INDEX METADATA ===');
      console.log('indexMetadata:', JSON.stringify(result.indexMetadata, null, 2));
    }

    // DEBUG: 打印返回数据
    console.log('=== COMPLETE EVENT ===');
    console.log('uploadedSheets:', JSON.stringify(uploadedSheets.value, null, 2));
    console.log('First sheet flowResult:', uploadedSheets.value[0]?.flowResult);
    console.log('First sheet chartConfig:', uploadedSheets.value[0]?.flowResult?.chartConfig);

    if (uploadedSheets.value.length > 0) {
      activeTab.value = String(uploadedSheets.value[0].sheetIndex);

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
  }

  // 处理错误事件
  if (type === 'ERROR') {
    uploadStatus.value = 'exception';
    progressText.value = event.error || '处理失败';
    ElMessage.error(event.error || '处理失败');
  }
};

/**
 * Process ECharts options: evaluate __FUNC__ animation delays from Python
 */
const processEChartsOptions = (opts: Record<string, unknown>): Record<string, unknown> => {
  const processValue = (val: unknown): unknown => {
    if (typeof val === 'string' && val.startsWith('__FUNC__')) {
      try { return new Function('return ' + val.slice(8))(); } catch { return val; }
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

// P1: 图表轴标签万/亿自动格式化
// 从 Python chart_builder 的 yAxis.name (如 " (万)") 中提取量级，注入 axisLabel.formatter
const enhanceChartOption = (opts: Record<string, unknown>): void => {
  const yAxis = (opts as any).yAxis;
  if (!yAxis || typeof yAxis.name !== 'string') return;

  // Parse suffix: " (万)" or " (亿)"
  const match = yAxis.name.match(/\(([万亿])\)/);
  if (!match) return;

  const suffix = match[1];
  const divisor = suffix === '亿' ? 1e8 : 1e4;

  yAxis.axisLabel = yAxis.axisLabel || {};
  if (!yAxis.axisLabel.formatter) {
    yAxis.axisLabel.formatter = (value: number) => {
      if (value === 0) return '0';
      const scaled = value / divisor;
      return Number.isInteger(scaled) ? `${scaled}${suffix}` : `${scaled.toFixed(1)}${suffix}`;
    };
  }

  // Scatter charts: also format xAxis if values are large
  const xAxis = (opts as any).xAxis;
  if (xAxis && xAxis.type === 'value' && typeof xAxis.name === 'string') {
    const xMatch = xAxis.name.match(/\(([万亿])\)/);
    if (xMatch) {
      const xSuffix = xMatch[1];
      const xDivisor = xSuffix === '亿' ? 1e8 : 1e4;
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
};

// 渲染当前激活 Tab 的所有图表（多图表仪表板 — 8-benchmark upgrade）
const renderActiveCharts = () => {
  const t0 = performance.now();
  const activeSheetIndex = parseInt(activeTab.value);
  const activeSheet = uploadedSheets.value.find(s => s.sheetIndex === activeSheetIndex);
  if (!activeSheet) return;

  const charts = getSheetCharts(activeSheet);
  console.log(`[Render] Rendering ${charts.length} charts for sheet ${activeSheetIndex}`);

  charts.forEach((chart, idx) => {
    const chartId = `chart-${activeSheet.sheetIndex}-${idx}`;
    const dom = document.getElementById(chartId);
    if (!dom) {
      console.warn(`Chart container not found: ${chartId}`);
      return;
    }

    const config = chart.config;
    if (!config || isChartDataEmpty(config)) return;

    let echartsOptions = resolveEChartsOptions(config);
    if (!echartsOptions) return;

    // Process __FUNC__ animation delay strings
    echartsOptions = processEChartsOptions(echartsOptions);
    enhanceChartOption(echartsOptions);

    // Apply anomaly overlay if available
    const anomalies = (config as any).anomalies || (chart as any).anomalies;
    if (anomalies) {
      applyAnomalyOverlay(echartsOptions, anomalies);
    }

    try {
      // ECharts instance reuse (Phase 2.2) — avoid dispose+init cycle
      let instance = echarts.getInstanceByDom(dom);
      if (!instance) {
        instance = echarts.init(dom);
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
    } catch (error) {
      console.error(`Failed to render chart ${chartId}:`, error);
    }
  });

  console.log(`[Perf] renderActiveCharts took ${(performance.now() - t0).toFixed(1)}ms`);
};

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
            if (!instance) instance = echarts.init(dom);
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
  }
});

watch(activeTab, () => {
  // Clear active filter on tab switch
  activeFilter.value = null;
  layoutEditMode.value = false; // P6: reset to standard mode on tab switch

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
    const myChart = echarts.init(chartDom);
    myChart.setOption(echartsOptions);
    console.log(`Chart ${chartId} rendered successfully`);
  } catch (error) {
    console.error('Failed to render chart:', error);
  }
};

// 根据数据构建基础 ECharts 配置
const buildBasicOptions = (chartType: string, data: any): any => {
  console.log('buildBasicOptions:', chartType, data);

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

// 通过前端驱动 Python 服务补充 Sheet 的图表和 AI 分析
const enrichSheet = async (sheet: SheetResult, forceRefresh = false) => {
  const sheetIndex = sheet.sheetIndex;
  const uploadId = sheet.uploadId;
  if (!uploadId || enrichingSheets.value.has(sheetIndex)) return;

  enrichingSheets.value.add(sheetIndex);

  try {
    console.log(`[Enrich] Starting enrichment for sheet ${sheetIndex} (uploadId=${uploadId})${forceRefresh ? ' [FORCE REFRESH]' : ''}`);
    const result: EnrichResult = await enrichSheetAnalysis(uploadId, forceRefresh);

    if (result.success) {
      const currentSheet = uploadedSheets.value.find(s => s.sheetIndex === sheetIndex);
      if (currentSheet) {
        if (!currentSheet.flowResult) {
          currentSheet.flowResult = {};
        }
        // 多图表数据
        if (result.charts?.length) {
          currentSheet.flowResult.charts = result.charts;
          currentSheet.flowResult.chartConfig = result.charts[0].config; // 向后兼容
        } else if (result.chartConfig) {
          currentSheet.flowResult.chartConfig = result.chartConfig;
        }
        // KPI 摘要
        if (result.kpiSummary) {
          currentSheet.flowResult.kpiSummary = result.kpiSummary;
        }
        if (result.aiAnalysis) {
          currentSheet.flowResult.aiAnalysis = result.aiAnalysis;
        }
        // 结构化 AI 数据
        if (result.structuredAI) {
          currentSheet.flowResult.structuredAI = result.structuredAI;
        }
      }
      enrichedSheets.value.add(sheetIndex);
      // Track cache status for UI hint
      if (result.cached && result.cachedAt) {
        cachedAtMap.value.set(uploadId, result.cachedAt);
      } else {
        cachedAtMap.value.delete(uploadId);
      }
      console.log(`[Enrich] Sheet ${sheetIndex} enriched${result.cached ? ' (from cache)' : ''}: ${result.charts?.length || 0} charts, KPI: ${!!result.kpiSummary}, AI: ${!!result.aiAnalysis}`);

      // 如果当前 tab 就是这个 sheet，立即渲染图表
      if (parseInt(activeTab.value) === sheetIndex) {
        await nextTick();
        renderActiveCharts();
      }

      // U1: 后台预取下一个未 enrich 的 sheet，减少 tab 切换等待
      const nextUnenriched = uploadedSheets.value.find(
        s => s.sheetIndex > sheetIndex && !enrichedSheets.value.has(s.sheetIndex)
          && !enrichingSheets.value.has(s.sheetIndex) && !isIndexSheet(s) && s.uploadId
      );
      if (nextUnenriched) {
        setTimeout(() => enrichSheet(nextUnenriched), 500);
      }
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

// 图表下钻处理
const handleChartDrillDown = async (sheet: SheetResult, chartIndex: number, params: any) => {
  if (drillDownLoading.value) return;
  if (!params.name && !params.seriesName) return;
  if (!sheet.uploadId) return;

  // 从图表配置中推断维度和度量
  const charts = getSheetCharts(sheet);
  const chartItem = charts[chartIndex];
  if (!chartItem) return;

  // 使用 enrichment 时保存的 xField 作为维度名
  let dimension = (chartItem as any).xField || '';
  if (!dimension) {
    // fallback 1: 从图表配置 xAxis.name 推断
    const config = chartItem.config as any;
    if (config?.xAxis?.name) {
      dimension = config.xAxis.name;
    }
  }
  if (!dimension) {
    // fallback 2: 从 xAxis.data 的类型推断 — 如果是分类轴，取第一个标签列名
    const config = chartItem.config as any;
    if (config?.xAxis?.type === 'category' && Array.isArray(config.xAxis.data) && config.xAxis.data.length > 0) {
      // 尝试从 series 名或数据结构推断维度名
      const firstCat = config.xAxis.data[0];
      if (typeof firstCat === 'string' && isNaN(Number(firstCat))) {
        dimension = '分类';
      }
    }
  }
  if (!dimension) {
    // fallback 3: 从当前 sheet 的数据中找第一个分类列
    const flowCharts = sheet.flowResult?.charts;
    if (flowCharts?.length) {
      for (const fc of flowCharts) {
        if ((fc as any).xField) { dimension = (fc as any).xField; break; }
      }
    }
  }

  const filterValue = params.name || params.seriesName || '';
  if (!filterValue) return;

  drillDownContext.value = {
    dimension: dimension || '项目',
    filterValue,
    sheetName: sheet.sheetName
  };
  drillStack.value = []; // P4: reset drill stack for new drill-down
  currentDrillSheet.value = sheet;
  drillDownVisible.value = true;
  drillDownLoading.value = true;
  drillDownResult.value = null;

  try {
    // R-21: 优先使用缓存数据，避免重复请求
    let rawData = sheetRawDataCache.get(sheet.uploadId);
    if (!rawData) {
      const tableRes = await getUploadTableData(sheet.uploadId, 0, 2000);
      const rawTableData = (tableRes.success && tableRes.data?.data) ? tableRes.data.data as Record<string, unknown>[] : [];
      rawData = renameMeaninglessColumns(rawTableData);
      sheetRawDataCache.set(sheet.uploadId, rawData);
    }

    // 推断度量列（所有数值列）
    const measures = inferMeasures(rawData);

    const result = await chartDrillDown({
      uploadId: sheet.uploadId,
      sheetName: sheet.sheetName,
      dimension: drillDownContext.value.dimension,
      filterValue,
      measures: measures.length > 0 ? measures : ['amount', 'revenue', 'profit'],
      data: rawData
    });

    drillDownResult.value = result;

    // 渲染下钻图表 - 使用 setTimeout 等待 el-drawer DOM transition 完成
    if (result.success && result.chartConfig) {
      renderDrillDownChart(result.chartConfig!, true);
    }
  } catch (error) {
    console.error('Drill-down failed:', error);
    drillDownResult.value = { success: false, error: '下钻分析失败' };
  } finally {
    drillDownLoading.value = false;
  }
};

// P4: 推断度量列（提取为可复用函数）
const inferMeasures = (rawData: Record<string, unknown>[]): string[] => {
  const measures: string[] = [];
  if (rawData.length > 0) {
    for (const key of Object.keys(rawData[0])) {
      const sample = rawData.slice(0, 10);
      const numCount = sample.filter(r => {
        const v = r[key];
        return typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)));
      }).length;
      if (numCount >= 5) measures.push(key);
    }
  }
  return measures;
};

const MAX_DRILL_DEPTH = 10;

// P4: 按指定维度继续下钻
const drillByDimension = async (targetDimension: string) => {
  const sheet = currentDrillSheet.value;
  if (!sheet?.uploadId || !drillDownResult.value) return;
  if (drillStack.value.length >= MAX_DRILL_DEPTH) {
    ElMessage.warning(`已达到最大下钻深度 (${MAX_DRILL_DEPTH} 层)`);
    return;
  }

  // Push current level to stack
  drillStack.value.push({
    dimension: drillDownContext.value.dimension,
    filterValue: drillDownContext.value.filterValue,
    result: drillDownResult.value,
    hierarchyType: drillDownResult.value.hierarchy?.type,
    currentLevel: drillDownResult.value.current_level ?? undefined,
  });

  drillDownContext.value = {
    dimension: targetDimension,
    filterValue: '',
    sheetName: sheet.sheetName
  };
  drillDownLoading.value = true;
  drillDownResult.value = null;

  try {
    let rawData = sheetRawDataCache.get(sheet.uploadId);
    if (!rawData) return;

    const measures = inferMeasures(rawData);
    const breadcrumb = drillStack.value.map(l => ({ dimension: l.dimension, value: l.filterValue }));

    const result = await chartDrillDown({
      uploadId: sheet.uploadId,
      sheetName: sheet.sheetName,
      dimension: targetDimension,
      filterValue: '',
      measures: measures.length > 0 ? measures : ['amount', 'revenue', 'profit'],
      data: rawData,
      breadcrumb,
    });

    drillDownResult.value = result;
    if (result.success && result.chartConfig) {
      renderDrillDownChart(result.chartConfig!, true);
    }
  } catch (error) {
    console.error('Drill deeper failed:', error);
    drillDownResult.value = { success: false, error: '继续下钻失败' };
  } finally {
    drillDownLoading.value = false;
  }
};

// P4: 返回到根级
const drillBackToRoot = () => {
  if (drillStack.value.length === 0) return;
  const first = drillStack.value[0];
  drillStack.value = [];
  drillDownResult.value = first.result;
  drillDownContext.value.dimension = first.dimension;
  drillDownContext.value.filterValue = first.filterValue;
  if (first.result.chartConfig) {
    renderDrillDownChart(first.result.chartConfig as Record<string, unknown>, false);
  }
};

// P4: 返回到指定层级
const drillBackTo = (index: number) => {
  if (index >= drillStack.value.length) return;
  const target = drillStack.value[index];
  drillStack.value = drillStack.value.slice(0, index);
  drillDownResult.value = target.result;
  drillDownContext.value.dimension = target.dimension;
  drillDownContext.value.filterValue = target.filterValue;
  if (target.result.chartConfig) {
    renderDrillDownChart(target.result.chartConfig as Record<string, unknown>, false);
  }
};

// 渲染下钻图表 (DOM-aware, Phase 2.4) — P4: optional click handler for continue drilling
const renderDrillDownChart = async (config: Record<string, unknown>, registerClick = false) => {
  const dom = await waitForElement('drill-down-chart');
  if (!dom) return;

  try {
    let instance = echarts.getInstanceByDom(dom);
    if (!instance) instance = echarts.init(dom);
    instance.setOption(processEChartsOptions(config), { notMerge: true });

    if (registerClick) {
      instance.off('click');
      instance.on('click', (params: any) => {
        if (drillDownLoading.value) return;
        if (!params.name) return;
        const sheet = currentDrillSheet.value;
        if (!sheet?.uploadId) return;
        if (drillStack.value.length >= MAX_DRILL_DEPTH) {
          ElMessage.warning(`已达到最大下钻深度 (${MAX_DRILL_DEPTH} 层)`);
          return;
        }

        // Push current result to stack and drill deeper
        if (drillDownResult.value) {
          drillStack.value.push({
            dimension: drillDownContext.value.dimension,
            filterValue: drillDownContext.value.filterValue,
            result: drillDownResult.value,
            hierarchyType: drillDownResult.value.hierarchy?.type,
            currentLevel: drillDownResult.value.current_level ?? undefined,
          });
        }

        // Determine next dimension
        const availDims = drillDownResult.value?.available_dimensions;
        const nextDim = availDims?.length ? availDims[0] : drillDownContext.value.dimension;
        const clickValue = params.name;

        drillDownContext.value = {
          dimension: nextDim,
          filterValue: clickValue,
          sheetName: sheet.sheetName,
        };
        drillDownLoading.value = true;
        drillDownResult.value = null;

        (async () => {
          try {
            const rawData = sheetRawDataCache.get(sheet.uploadId!);
            if (!rawData) return;
            const measures = inferMeasures(rawData);
            const breadcrumb = drillStack.value.map(l => ({ dimension: l.dimension, value: l.filterValue }));
            const hierarchy = drillStack.value[drillStack.value.length - 1]?.hierarchyType;

            const result = await chartDrillDown({
              uploadId: sheet.uploadId!,
              sheetName: sheet.sheetName,
              dimension: nextDim,
              filterValue: clickValue,
              measures: measures.length > 0 ? measures : ['amount', 'revenue', 'profit'],
              data: rawData,
              hierarchyType: hierarchy,
              breadcrumb,
            });

            drillDownResult.value = result;
            if (result.success && result.chartConfig) {
              renderDrillDownChart(result.chartConfig!, true);
            }
          } catch (error) {
            console.error('Continue drill failed:', error);
            drillDownResult.value = { success: false, error: '继续下钻失败' };
          } finally {
            drillDownLoading.value = false;
          }
        })();
      });
    }
  } catch (error) {
    console.error('Failed to render drill-down chart:', error);
  }
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

  // Toggle filter if same value
  if (activeFilter.value?.value === filterValue && activeFilter.value?.dimension === dimension) {
    activeFilter.value = null;
  } else {
    activeFilter.value = { dimension: dimension || '项目', value: filterValue };
  }

  // Re-render all charts with filter applied
  // Note: actual data filtering would require re-calling buildCharts with filtered data
  // For now we visually highlight the filtered category via ECharts emphasis
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
onBeforeUnmount(() => {
  if (renderDebounceTimer) clearTimeout(renderDebounceTimer);
  window.removeEventListener('resize', handleResize);
  // Dispose all ECharts instances
  document.querySelectorAll('[id^="chart-"]').forEach(dom => {
    const instance = echarts.getInstanceByDom(dom as HTMLElement);
    if (instance) instance.dispose();
  });
  // Dispose stat heatmap if open
  disposeStatHeatmap();
});

// 打开综合分析
let crossSheetAbortController: AbortController | null = null;
const openCrossSheetAnalysis = async () => {
  // R-23: 取消上一次未完成的请求
  if (crossSheetAbortController) crossSheetAbortController.abort();
  crossSheetAbortController = new AbortController();
  const dataSheets = uploadedSheets.value.filter(s => !isIndexSheet(s) && s.uploadId);
  if (dataSheets.length < 2) {
    ElMessage.warning('至少需要 2 个数据 Sheet 才能进行综合分析');
    return;
  }

  crossSheetVisible.value = true;
  crossSheetLoading.value = true;
  crossSheetResult.value = null;

  try {
    const result = await crossSheetAnalysis({
      uploadIds: dataSheets.map(s => s.uploadId!),
      sheetNames: dataSheets.map(s => getSheetDisplayName(s))
    });

    crossSheetResult.value = result;

    // 渲染综合图表 - 使用 setTimeout 等待 el-dialog DOM transition 完成
    if (result.success && result.charts?.length) {
      await nextTick();
      renderCrossSheetCharts(result.charts!);
    }
  } catch (error) {
    console.error('Cross-sheet analysis failed:', error);
    crossSheetResult.value = { success: false, error: '综合分析失败' };
  } finally {
    crossSheetLoading.value = false;
  }
};

// 渲染综合分析图表
const renderCrossSheetCharts = async (charts: Array<{ chartType: string; title: string; config: Record<string, unknown> }>) => {
  for (let idx = 0; idx < charts.length; idx++) {
    const chart = charts[idx];
    const dom = await waitForElement(`cross-chart-${idx}`);
    if (!dom) continue;

    try {
      const config = chart.config;
      if (!config) continue;

      const options = resolveEChartsOptions(config);
      if (options) {
        let instance = echarts.getInstanceByDom(dom);
        if (!instance) instance = echarts.init(dom);
        const processed = processEChartsOptions(options);
        enhanceChartOption(processed);
        instance.setOption(processed, { notMerge: true });
      }
    } catch (error) {
      console.error(`Failed to render cross-chart ${idx}:`, error);
    }
  }
};

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

// P5: 打开因果分析
const openStatisticalAnalysis = () => {
  statisticalResult.value = null;
  statisticalLoading.value = false;
  statisticalVisible.value = true;
};

// P5: 运行统计分析
const runStatisticalAnalysis = async (sheet: SheetResult) => {
  if (!sheet.uploadId) {
    ElMessage.warning('该 Sheet 没有持久化数据');
    return;
  }

  statisticalLoading.value = true;
  statisticalResult.value = null;

  try {
    let rawData = sheetRawDataCache.get(sheet.uploadId);
    if (!rawData) {
      const tableRes = await getUploadTableData(sheet.uploadId, 0, 2000);
      const rawTableData = (tableRes.success && tableRes.data?.data) ? tableRes.data.data as Record<string, unknown>[] : [];
      rawData = renameMeaninglessColumns(rawTableData);
      sheetRawDataCache.set(sheet.uploadId, rawData);
    }

    const result = await statisticalAnalysis({ data: rawData });
    statisticalResult.value = result;

    // Render heatmap if correlations exist
    if (result.success && result.correlations?.matrix && Object.keys(result.correlations.matrix).length >= 2) {
      renderStatHeatmap(result.correlations.matrix);
    }
  } catch (error) {
    console.error('Statistical analysis failed:', error);
    statisticalResult.value = {
      success: false,
      distributions: {},
      correlations: { matrix: {}, strong_positive: [], strong_negative: [] },
      comparisons: {},
      outlier_summary: {},
      processing_time_ms: 0,
      error: '统计分析失败'
    };
  } finally {
    statisticalLoading.value = false;
  }
};

// P5: 渲染相关性热力图
const renderStatHeatmap = async (matrix: Record<string, Record<string, number>>) => {
  await nextTick();
  // Wait for dialog DOM transition
  setTimeout(() => {
    const dom = document.getElementById('stat-heatmap-chart');
    if (!dom) return;
    let instance = echarts.getInstanceByDom(dom);
    if (!instance) instance = echarts.init(dom);

    const measures = Object.keys(matrix);
    const data: [number, number, number][] = [];
    for (let i = 0; i < measures.length; i++) {
      for (let j = 0; j < measures.length; j++) {
        data.push([i, j, Math.round((matrix[measures[i]]?.[measures[j]] ?? 0) * 100) / 100]);
      }
    }

    instance.setOption({
      tooltip: {
        position: 'top',
        formatter: (p: any) => `${measures[p.data[0]]} vs ${measures[p.data[1]]}<br/>相关系数: ${p.data[2]}`
      },
      grid: { left: '18%', right: '10%', bottom: '18%', top: '5%', containLabel: true },
      xAxis: { type: 'category', data: measures, splitArea: { show: true }, axisLabel: { rotate: 45, fontSize: 10 } },
      yAxis: { type: 'category', data: measures, splitArea: { show: true }, axisLabel: { fontSize: 10 } },
      visualMap: {
        min: -1, max: 1, calculable: true, orient: 'horizontal', left: 'center', bottom: '0%',
        inRange: { color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'] }
      },
      series: [{ name: '相关系数', type: 'heatmap', data, label: { show: true, fontSize: 10 }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } } }]
    }, { notMerge: true });
  }, 300);
};

const disposeStatHeatmap = () => {
  const dom = document.getElementById('stat-heatmap-chart');
  if (dom) {
    const instance = echarts.getInstanceByDom(dom);
    if (instance) instance.dispose();
  }
};

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
};

// 将上传记录列表组装为一个批次
const makeBatch = (uploads: UploadHistoryItem[]): UploadBatch => {
  const first = uploads[0];
  const d = new Date(first.createdAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const uploadTime = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return {
    fileName: first.fileName,
    uploadTime,
    sheetCount: uploads.length,
    totalRows: uploads.reduce((sum, u) => sum + (u.rowCount || 0), 0),
    uploads,
  };
};

// 选择某个批次，填充 uploadedSheets
const selectBatch = (index: number) => {
  selectedBatchIndex.value = index;
  const batch = uploadBatches.value[index];
  if (!batch) return;

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
    message: `${batch.fileName} (${batch.sheetCount} Sheets, ${batch.totalRows} 行)`,
    results: uploadedSheets.value,
  };

  enrichedSheets.value = new Set();
  enrichingSheets.value = new Set();
  activeTab.value = '0';
  nextTick(() => {
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

    uploadBatches.value = batches;
    if (batches.length > 0) selectBatch(0);
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

onMounted(() => {
  loadHistory();
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

  .result-section {
    margin-top: 20px;

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

          .chart-grid-item {
            background: #fff;
            border-radius: 12px;
            border: none;
            padding: 20px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06);
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;

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

            &:hover .chart-export-btn {
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
</style>
