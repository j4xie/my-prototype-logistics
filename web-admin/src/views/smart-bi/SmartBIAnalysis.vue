<template>
  <div class="smart-bi-analysis">
    <el-card class="upload-card">
      <template #header>
        <div class="card-header">
          <span class="title">📊 智能数据分析</span>
          <el-button v-if="uploadedSheets.length > 0" @click="resetUpload" type="danger" size="small">
            <el-icon><Refresh /></el-icon>
            重新上传
          </el-button>
        </div>
      </template>

      <!-- 上传区域 -->
      <div v-if="uploadedSheets.length === 0" class="upload-section">
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
            :label="`${sheet.sheetName} (${sheet.savedRows}行)`"
            :name="String(sheet.sheetIndex)"
          >
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
            </div>

            <!-- 图表展示 -->
            <div v-if="sheet.flowResult?.chartConfig" class="chart-section">
              <h3>📈 数据可视化</h3>
              <div :id="`chart-${sheet.sheetIndex}`" class="chart-container"></div>
            </div>

            <!-- AI 分析 -->
            <div v-if="sheet.flowResult?.aiAnalysis || sheet.flowResult?.chartConfig?.aiAnalysis" class="ai-analysis-section">
              <h3>🤖 AI 智能分析</h3>
              <el-card shadow="never" class="analysis-card">
                <div class="analysis-content" v-html="formatAnalysis(getAIAnalysis(sheet))"></div>
              </el-card>
            </div>

            <!-- 数据预览 -->
            <div class="data-preview-section">
              <h3>📋 数据预览</h3>
              <el-button @click="loadSheetData(sheet)" type="primary" size="small">
                查看原始数据
              </el-button>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { post } from '@/api/request';
import { ElMessage } from 'element-plus';
import { UploadFilled, Upload, Refresh, CircleCheckFilled, CircleCloseFilled, Loading } from '@element-plus/icons-vue';
import type { UploadFile, UploadUserFile, UploadInstance } from 'element-plus';
import * as echarts from 'echarts';

const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId || 'F001');

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
  flowResult?: {
    recommendedChartType?: string;
    chartConfig?: any;
    aiAnalysis?: string;
    recommendedTemplates?: any[];
  };
}

interface BatchUploadResult {
  totalSheets: number;
  successCount: number;
  failedCount: number;
  requiresConfirmationCount: number;
  totalSavedRows: number;
  message: string;
  results: SheetResult[];
}

const uploadedSheets = ref<SheetResult[]>([]);
const uploadResult = ref<BatchUploadResult | null>(null);
const activeTab = ref('');

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
  const sheetConfigs = availableSheets.value
    .filter(s => s.rowCount > 0)
    .map(s => ({
      sheetIndex: s.index,
      headerRow: s.index === 0 ? 0 : (s.name.includes('利润表') ? 3 : 2),
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

// 渲染当前激活 Tab 的图表
const renderActiveChart = () => {
  const activeSheetIndex = parseInt(activeTab.value);
  const activeSheet = uploadedSheets.value.find(s => s.sheetIndex === activeSheetIndex);

  // DEBUG
  console.log('=== renderActiveChart ===');
  console.log('activeTab:', activeTab.value, 'activeSheetIndex:', activeSheetIndex);
  console.log('activeSheet:', activeSheet);
  console.log('chartConfig:', activeSheet?.flowResult?.chartConfig);
  if (activeSheet?.flowResult?.chartConfig) {
    renderChart(activeSheet);
  }
};

// 监听 Tab 切换，渲染对应图表
watch(activeTab, () => {
  nextTick(() => {
    renderActiveChart();
  });
});

// 渲染单个图表
const renderChart = (sheet: SheetResult) => {
  const chartId = `chart-${sheet.sheetIndex}`;
  const chartDom = document.getElementById(chartId);

  console.log('=== renderChart ===');
  console.log('chartId:', chartId);
  console.log('chartDom exists:', !!chartDom);

  if (!chartDom) {
    console.warn(`Chart container not found: ${chartId}`);
    return;
  }

  const chartConfig = sheet.flowResult?.chartConfig;
  console.log('chartConfig:', chartConfig);
  console.log('chartConfig keys:', chartConfig ? Object.keys(chartConfig) : 'null');
  console.log('chartConfig.options:', chartConfig?.options);
  console.log('chartConfig.data:', chartConfig?.data);

  if (!chartConfig) {
    console.warn('No chartConfig found');
    return;
  }

  // 如果没有 options，尝试使用 data 构建基础图表
  let echartsOptions = chartConfig.options;
  if (!echartsOptions && chartConfig.data) {
    console.log('No options, trying to build from data...');
    // 根据 chartType 构建基础配置
    const chartType = chartConfig.chartType || 'line';
    echartsOptions = buildBasicOptions(chartConfig.chartType, chartConfig.data);
  }

  if (!echartsOptions) {
    console.warn('No chart options could be built');
    return;
  }

  try {
    const myChart = echarts.init(chartDom);
    myChart.setOption(echartsOptions);
    console.log('Chart rendered successfully');
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
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/【(.*?)】/g, '<span class="highlight">【$1】</span>')
    .replace(/(\d+\.)/g, '<br/><strong>$1</strong>');
};

// 加载 Sheet 数据
const loadSheetData = (sheet: SheetResult) => {
  ElMessage.info('数据预览功能开发中...');
};

// 重置上传
const resetUpload = () => {
  fileList.value = [];
  uploadedSheets.value = [];
  uploadResult.value = null;
  activeTab.value = '';
  uploading.value = false;
  uploadProgress.value = 0;
};

// 加载历史上传记录
const loadHistory = async () => {
  try {
    const response = await post<{ data: { content: any[] } }>(
      `/${factoryId.value}/smart-bi/uploads`,
      { page: 0, size: 1 }
    );

    if (response.success && response.data?.content?.length > 0) {
      const latestUpload = response.data.content[0];

      // 模拟批量上传结果格式
      uploadResult.value = {
        totalSheets: 1,
        successCount: 1,
        failedCount: 0,
        totalSavedRows: latestUpload.rowCount || 0,
        message: `已加载历史数据: ${latestUpload.fileName} - ${latestUpload.sheetName}`,
        results: [{
          sheetIndex: 0,
          sheetName: latestUpload.sheetName,
          success: true,
          message: '从历史记录加载',
          detectedDataType: latestUpload.dataType,
          savedRows: latestUpload.rowCount,
          uploadId: latestUpload.id,
          flowResult: {
            recommendedChartType: latestUpload.recommendedChartType,
            chartConfig: latestUpload.chartConfig ? JSON.parse(latestUpload.chartConfig) : null,
            aiAnalysis: latestUpload.aiAnalysis
          }
        }]
      };

      uploadedSheets.value = uploadResult.value.results;
      activeTab.value = '0';

      nextTick(() => {
        renderActiveChart();
      });
    }
  } catch (error: any) {
    console.error('加载历史记录失败:', error);
  }
};

onMounted(() => {
  // 历史记录加载功能暂未实现后端接口，跳过
  // loadHistory();
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

      .chart-section {
        margin: 24px 0;

        h3 {
          margin-bottom: 16px;
          font-size: 16px;
          color: #303133;
        }

        .chart-container {
          width: 100%;
          height: 500px;
          border: 1px solid #e4e7ed;
          border-radius: 4px;
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
      }

      .data-preview-section {
        margin: 24px 0;

        h3 {
          margin-bottom: 16px;
          font-size: 16px;
          color: #303133;
        }
      }
    }
  }
}
</style>
