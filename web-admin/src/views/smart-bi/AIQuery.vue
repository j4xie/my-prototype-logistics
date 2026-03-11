<script setup lang="ts">
/**
 * SmartBI AI 问答页面
 * 支持自然语言查询、快捷问题、对话历史和图表展示
 * 连接 Python SmartBI 服务获取真实分析结果
 */
import { ref, computed, onMounted, onUnmounted, onBeforeUnmount, nextTick, watch } from 'vue';
import { useChartResize } from '@/composables/useChartResize';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { chatAnalysis, chatAnalysisStream, getUploadHistory, deduplicateUploads, type AnalysisResult, type AIInsightData, type ChartConfig, type UploadHistoryItem } from '@/api/smartbi';
import { ElMessage } from 'element-plus';
import {
  ChatDotRound,
  Promotion,
  Refresh,
  Delete,
  User,
  Cpu,
  TrendCharts,
  Loading,
  Histogram,
  Location,
  Money,
  Coin,
  DataLine,
  PieChart,
  Warning,
  Sort,
  SetUp,
  DataAnalysis,
  Flag
} from '@element-plus/icons-vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import echarts from '@/utils/echarts';
import { AIInsightPanel } from '@/components/smartbi';
import SmartBIEmptyState from '@/components/smartbi/SmartBIEmptyState.vue';

// Render markdown content safely
function renderMarkdown(text: string): string {
  if (!text) return '';
  try {
    return DOMPurify.sanitize(marked(text) as string);
  } catch {
    return text;
  }
}

const route = useRoute();
const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);

// 输入框
const inputQuery = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

// 对话历史
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  chart?: {
    type: 'line' | 'bar' | 'pie';
    data: Record<string, unknown>;
  };
  chartConfig?: ChartConfig;
  insights?: AIInsightData;
  table?: {
    columns: string[];
    data: Record<string, unknown>[];
  };
  loading?: boolean;
  streaming?: boolean;
}

// 当前分析上下文 (用于连续对话)
const currentData = ref<unknown[]>([]);
const currentFields = ref<Array<{ original: string; standard: string }>>([]);
const currentTableType = ref<string>('');

// 数据源：自动加载最新上传作为分析上下文
const dataSources = ref<UploadHistoryItem[]>([]);
const selectedUploadId = ref<number | null>(null);
const dataSourceLabel = computed(() => {
  if (!selectedUploadId.value) return '';
  const item = dataSources.value.find(d => d.id === selectedUploadId.value);
  return item ? `数据源：${item.fileName || item.originalFileName || `上传#${item.id}`}` : '';
});

const chatHistory = ref<ChatMessage[]>([]);
const chatContainerRef = ref<HTMLDivElement | null>(null);

// 快捷问题 (保留作为后备)
const quickQuestions = [
  '本月销售额是多少?',
  '销售额最高的产品是什么?',
  '本月利润率如何?',
  '哪个部门业绩最好?',
  '库存周转情况怎样?',
  '应收账款逾期情况?',
  '与上月相比销售变化如何?',
  '客户数量增长情况?'
];

// 分析模板系统
interface QueryTemplate {
  id: string;
  category: string;
  icon: string;
  label: string;
  description: string;
  query: string;
  params?: { name: string; label: string; type: 'text' | 'select'; options?: string[] }[];
}

const templateCategories = [
  { key: 'sales', label: '销售分析', icon: 'TrendCharts', color: '#1B65A8' },
  { key: 'finance', label: '财务分析', icon: 'Money', color: '#67C23A' },
  { key: 'cost', label: '成本分析', icon: 'PieChart', color: '#E6A23C' },
  { key: 'comparison', label: '对比分析', icon: 'DataAnalysis', color: '#F56C6C' },
];

const queryTemplates: QueryTemplate[] = [
  // 销售分析
  { id: 't1', category: 'sales', icon: 'TrendCharts', label: '销售趋势分析', description: '按月度/季度展示销售额变化趋势', query: '分析销售额的月度变化趋势，标注增长和下降的关键月份' },
  { id: 't2', category: 'sales', icon: 'Histogram', label: '产品销售排名', description: '各产品/品类的销售额排名对比', query: '按产品或品类统计销售额排名，找出TOP5和末位产品' },
  { id: 't3', category: 'sales', icon: 'Location', label: '区域销售对比', description: '不同区域的销售业绩对比', query: '对比各区域的销售业绩，分析区域差异的原因' },

  // 财务分析
  { id: 't4', category: 'finance', icon: 'Money', label: '毛利率分析', description: '各产品/业务线的毛利率对比', query: '计算并对比各产品线的毛利率，识别高利润和低利润业务' },
  { id: 't5', category: 'finance', icon: 'Coin', label: '费用结构分析', description: '各项费用的占比和趋势', query: '分析各项费用（管理费用、销售费用、财务费用）的占比和变化趋势' },
  { id: 't6', category: 'finance', icon: 'DataLine', label: '收入利润对比', description: '收入与利润的变化关系', query: '对比分析收入和利润的变化趋势，计算利润率变动' },

  // 成本分析
  { id: 't7', category: 'cost', icon: 'PieChart', label: '成本构成分析', description: '各项成本的占比分布', query: '分析成本构成，找出占比最大的成本项目和优化空间' },
  { id: 't8', category: 'cost', icon: 'Warning', label: '异常值检测', description: '检测数据中的异常波动', query: '检测数据中的异常值和突变点，分析可能的原因' },

  // 对比分析
  { id: 't9', category: 'comparison', icon: 'Sort', label: '同比环比分析', description: '与去年同期/上期的对比', query: '进行同比和环比分析，识别增长和下降趋势' },
  { id: 't10', category: 'comparison', icon: 'SetUp', label: '预算达成分析', description: '实际值与预算目标的对比', query: '对比实际业绩与预算目标，计算达成率和差异' },
  { id: 't11', category: 'comparison', icon: 'DataAnalysis', label: '综合经营分析', description: '多维度经营指标综合分析', query: '综合分析收入、成本、利润、费用等关键经营指标，给出经营建议' },
  { id: 't12', category: 'comparison', icon: 'Flag', label: '行业对标分析', description: '与行业平均水平对比', query: '将关键指标与食品加工行业平均水平对比，评估竞争力和改进方向' },
];

const selectedCategory = ref('');

const filteredTemplates = computed(() => {
  if (!selectedCategory.value) return queryTemplates;
  return queryTemplates.filter(t => t.category === selectedCategory.value);
});

const useTemplate = (tpl: QueryTemplate) => {
  inputQuery.value = tpl.query;
  // Auto-send the template query
  handleSendMessage();
};

// 加载状态
const isTyping = ref(false);

// 图表实例缓存
const chartInstances: Map<string, echarts.ECharts> = new Map();

// Container ref for ResizeObserver-based chart resize
const pageRef = ref<HTMLElement>();

onMounted(async () => {
  // 加载可用数据源列表，去重 + 智能默认选择
  try {
    const res = await getUploadHistory({ status: 'COMPLETED' });
    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      const deduped = deduplicateUploads(res.data);
      dataSources.value = deduped;

      // Prefer non-auto-sync uploads with the most rows (richer data = better analysis)
      const nonAutoSync = deduped.filter(d => {
        const name = d.fileName || d.originalFileName || '';
        return !name.startsWith('[自动同步]');
      });
      const candidates = nonAutoSync.length > 0 ? nonAutoSync : deduped;
      // Sort by rowCount descending — larger sheets produce better charts
      const sorted = [...candidates].sort((a, b) => (b.rowCount || 0) - (a.rowCount || 0));
      selectedUploadId.value = sorted[0].id;
    }
  } catch (e) {
    console.warn('加载上传列表失败:', e);
  }

  // 检查 URL 中是否有预设问题
  const query = route.query.q as string;
  if (query) {
    inputQuery.value = query;
    handleSendMessage();
  }

  // 添加欢迎消息
  if (chatHistory.value.length === 0) {
    const sourceHint = dataSourceLabel.value ? `\n\n当前${dataSourceLabel.value}` : '\n\n提示：暂无上传数据，建议先在"数据分析"页面上传 Excel 文件。';
    chatHistory.value.push({
      id: 'welcome',
      role: 'assistant',
      content: `您好！我是 SmartBI 智能助手，可以帮您分析销售、财务、库存等数据。您可以选择下方的分析模板快速开始，或直接输入问题。${sourceHint}`,
      timestamp: new Date()
    });
  }
});

// Cleanup on unmount
onUnmounted(() => {
  if (activeStreamController) {
    activeStreamController.abort();
    activeStreamController = null;
  }
  if (scrollRafId !== null) cancelAnimationFrame(scrollRafId);
  if (chunkFlushTimer) clearTimeout(chunkFlushTimer);
  chartInstances.forEach(chart => chart.dispose());
  chartInstances.clear();
});

// ResizeObserver-based chart resize (also handles sidebar toggle)
useChartResize(pageRef, () => {
  chartInstances.forEach(chart => chart.resize());
});

// Active stream controller (to cancel on new message or cleanup)
let activeStreamController: AbortController | null = null;

// Cancel flag for chart retry timers after unmount
let isComponentAlive = true;
onBeforeUnmount(() => { isComponentAlive = false; });

// 发送消息
async function handleSendMessage() {
  const query = inputQuery.value.trim();
  if (!query) return;

  // Cancel any in-flight stream
  if (activeStreamController) {
    activeStreamController.abort();
    activeStreamController = null;
  }

  // 添加用户消息
  const userMessage: ChatMessage = {
    id: `user-${Date.now()}`,
    role: 'user',
    content: query,
    timestamp: new Date()
  };
  chatHistory.value.push(userMessage);

  // 清空输入
  inputQuery.value = '';

  // 添加助手加载消息
  const assistantId = `assistant-${Date.now()}`;
  const loadingMessage: ChatMessage = {
    id: assistantId,
    role: 'assistant',
    content: '',
    timestamp: new Date(),
    loading: true
  };
  chatHistory.value.push(loadingMessage);

  // 滚动到底部 (force: user just sent message)
  scrollToBottom(true);

  isTyping.value = true;

  const requestParams = {
    query,
    data: currentData.value.length > 0 ? currentData.value : undefined,
    fields: currentFields.value.length > 0 ? currentFields.value : undefined,
    table_type: currentTableType.value || undefined,
    uploadId: selectedUploadId.value ? String(selectedUploadId.value) : undefined,
  };

  // Helper to find the assistant message
  const getMessageIndex = () => chatHistory.value.findIndex(m => m.id === assistantId);

  // SSE degradation watchdog: if no chunk arrives within 5s of status, show switching notice
  let sseWatchdog: ReturnType<typeof setTimeout> | null = null;
  let firstChunkReceived = false;
  const startSseWatchdog = () => {
    if (sseWatchdog) clearTimeout(sseWatchdog);
    sseWatchdog = setTimeout(() => {
      if (!firstChunkReceived) {
        const idx = getMessageIndex();
        if (idx !== -1) {
          const msg = chatHistory.value[idx];
          msg.content = '正在切换备用通道，请稍候...';
          msg.loading = true;
        }
      }
    }, 5000);
  };
  const clearSseWatchdog = () => {
    if (sseWatchdog) { clearTimeout(sseWatchdog); sseWatchdog = null; }
  };

  // Try streaming first, fall back to non-streaming
  activeStreamController = chatAnalysisStream(requestParams, {
    onStatus(status: string) {
      const idx = getMessageIndex();
      if (idx !== -1) {
        const msg = chatHistory.value[idx];
        msg.content = status;
        msg.loading = true;
      }
      scrollToBottom();
      // Start watchdog after first status — expect chunks within 5s
      if (!firstChunkReceived) startSseWatchdog();
    },

    onChunk(text: string) {
      // First chunk arrived — cancel watchdog
      if (!firstChunkReceived) {
        firstChunkReceived = true;
        clearSseWatchdog();
      }
      // Buffer chunks for 16ms before flushing to reduce Vue reactivity triggers
      chunkTargetId = assistantId;
      chunkBuffer += text;
      if (!chunkFlushTimer) {
        chunkFlushTimer = setTimeout(flushChunkBuffer, 16);
      }
    },

    async onCharts(charts: ChartConfig[]) {
      const idx = getMessageIndex();
      if (idx !== -1 && charts.length > 0) {
        chatHistory.value[idx].chartConfig = charts[0];
        await nextTick();
        renderChartFromConfig(assistantId, charts[0]);
      }
    },

    async onDone(result: AnalysisResult) {
      clearSseWatchdog();
      // Flush any remaining buffered chunks
      if (chunkFlushTimer) { clearTimeout(chunkFlushTimer); chunkFlushTimer = null; }
      flushChunkBuffer();

      const idx = getMessageIndex();
      if (idx !== -1) {
        const msg = chatHistory.value[idx];
        // If still loading (no chunks arrived), content is just status text — prefer result.answer
        const finalContent = msg.loading
          ? (result.answer || '分析完成')
          : (msg.content || result.answer || '分析完成');

        // Build chart data for compat
        let chartData: ChatMessage['chart'] | undefined;
        if (result.charts && result.charts.length > 0) {
          const firstChart = result.charts[0];
          chartData = {
            type: firstChart.type as 'line' | 'bar' | 'pie',
            data: firstChart.option as Record<string, unknown>
          };
        }

        // Direct mutation instead of object spread
        msg.content = finalContent;
        msg.chart = chartData;
        msg.chartConfig = msg.chartConfig || result.charts?.[0];
        msg.insights = result.insights;
        msg.table = result.table as ChatMessage['table'];
        msg.loading = false;
        msg.streaming = false;

        // Render chart if not already rendered via onCharts
        if (!msg.chartConfig && result.charts && result.charts.length > 0) {
          await nextTick();
          renderChartFromConfig(assistantId, result.charts[0]);
        }
      }

      isTyping.value = false;
      activeStreamController = null;
      scrollToBottom(true);
    },

    async onError(error: string) {
      clearSseWatchdog();
      // Clear chunk buffer on error
      if (chunkFlushTimer) { clearTimeout(chunkFlushTimer); chunkFlushTimer = null; }
      chunkBuffer = '';
      console.error('AI 流式查询失败:', error);

      // Convert to user-friendly message
      let friendlyMessage = '抱歉，查询过程中发生错误，请稍后重试。';
      if (error.includes('422') || error.includes('Unprocessable')) {
        friendlyMessage = '请先选择一个数据源（上传 Excel 或选择已有数据），再进行 AI 问答';
      } else if (error.includes('500') || error.includes('Internal Server')) {
        friendlyMessage = '分析服务暂时不可用，请稍后重试';
      } else if (error.includes('timeout') || error.includes('503') || error.includes('504')) {
        friendlyMessage = 'AI 分析服务暂时不可用，请稍后重试。';
      } else if (error.includes('fetch') || error.includes('network') || error.includes('ERR_CONNECTION')) {
        friendlyMessage = '请求失败，请检查网络连接';
      } else if (error && error.length < 100) {
        friendlyMessage = error;
      }

      // Fall back to non-streaming
      try {
        const response = await chatAnalysis(requestParams);
        const idx = getMessageIndex();
        if (idx !== -1) {
          if (response.success) {
            let chartData: ChatMessage['chart'] | undefined;
            if (response.charts && response.charts.length > 0) {
              const firstChart = response.charts[0];
              chartData = {
                type: firstChart.type as 'line' | 'bar' | 'pie',
                data: firstChart.option as Record<string, unknown>
              };
            }
            chatHistory.value[idx] = {
              id: assistantId,
              role: 'assistant',
              content: response.answer || '分析完成',
              timestamp: new Date(),
              chart: chartData,
              chartConfig: response.charts?.[0],
              insights: response.insights,
              table: response.table as ChatMessage['table'],
              loading: false
            };
            await nextTick();
            if (response.charts && response.charts.length > 0) {
              renderChartFromConfig(assistantId, response.charts[0]);
            }
          } else {
            chatHistory.value[idx] = {
              id: assistantId,
              role: 'assistant',
              content: friendlyMessage,
              timestamp: new Date(),
              loading: false
            };
          }
        }
      } catch {
        const idx = getMessageIndex();
        if (idx !== -1) {
          chatHistory.value[idx] = {
            id: assistantId,
            role: 'assistant',
            content: friendlyMessage,
            timestamp: new Date(),
            loading: false
          };
        }
      }

      isTyping.value = false;
      activeStreamController = null;
      scrollToBottom(true);
    },
  });
}

/**
 * 设置分析上下文 (用于连续对话)
 * 可从 Excel 上传页面传入数据
 */
function setAnalysisContext(data: unknown[], fields: Array<{ original: string; standard: string }>, tableType?: string) {
  currentData.value = data;
  currentFields.value = fields;
  currentTableType.value = tableType || '';
}

// Format data source label with sheet name and row count
function formatDataSourceLabel(ds: UploadHistoryItem): string {
  const name = ds.fileName || `上传#${ds.id}`;
  const parts = [name];
  if (ds.sheetName) parts.push(ds.sheetName);
  if (ds.rowCount) parts.push(`${ds.rowCount}行`);
  return parts.join(' · ');
}

// 暴露给父组件调用
defineExpose({ setAnalysisContext });

// 渲染图表 (从 ChartConfig)
function renderChartFromConfig(messageId: string, chartConfig: ChartConfig) {
  if (!chartConfig) return;

  // Try to get chart container — may need a small delay for Vue to render the v-if container
  const tryRender = (attempt = 0) => {
    if (!isComponentAlive) return;
    const chartDom = document.getElementById(`chart-${messageId}`);
    if (!chartDom) {
      if (attempt < 5) {
        setTimeout(() => tryRender(attempt + 1), 300);
      }
      return;
    }

    // 销毁旧图表
    const oldChart = chartInstances.get(messageId);
    if (oldChart) {
      oldChart.dispose();
    }

    const chart = echarts.init(chartDom, 'cretas');
    chartInstances.set(messageId, chart);

    // Use option directly if available (proper ECharts config from Python)
    if (chartConfig.option && typeof chartConfig.option === 'object') {
      chart.setOption(chartConfig.option as echarts.EChartsOption);
      return;
    }

    // Fallback: chartConfig has raw data but no option — skip rendering
    console.warn('[AIQuery] chartConfig missing option, cannot render:', chartConfig);
  };

  tryRender();
}

// 渲染图表 (兼容旧格式)
function renderChart(messageId: string, chartConfig: ChatMessage['chart']) {
  if (!chartConfig) return;

  const chartDom = document.getElementById(`chart-${messageId}`);
  if (!chartDom) return;

  // 销毁旧图表
  const oldChart = chartInstances.get(messageId);
  if (oldChart) {
    oldChart.dispose();
  }

  const chart = echarts.init(chartDom, 'cretas');
  chartInstances.set(messageId, chart);

  let option: echarts.EChartsOption;

  if (chartConfig.type === 'line') {
    option = {
      tooltip: { trigger: 'axis', confine: true },
      legend: { bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
      xAxis: { type: 'category', data: chartConfig.data.xAxis },
      yAxis: { type: 'value' },
      series: (chartConfig.data.series || []).map((s: { name: string; data: number[] }) => ({
        name: s.name,
        type: 'line',
        smooth: true,
        data: s.data,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(27, 101, 168, 0.3)' },
            { offset: 1, color: 'rgba(27, 101, 168, 0.05)' }
          ])
        }
      }))
    };
  } else if (chartConfig.type === 'bar') {
    option = {
      tooltip: { trigger: 'axis', confine: true },
      legend: { bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
      xAxis: { type: 'category', data: chartConfig.data.xAxis },
      yAxis: { type: 'value' },
      series: (chartConfig.data.series || []).map((s: { name: string; data: number[] }, i: number) => ({
        name: s.name,
        type: 'bar',
        data: s.data,
        itemStyle: {
          color: i === 0 ? '#1B65A8' : '#67C23A',
          borderRadius: [4, 4, 0, 0]
        }
      }))
    };
  } else if (chartConfig.type === 'pie') {
    option = {
      tooltip: { trigger: 'item', confine: true, formatter: '{b}: {c}万 ({d}%)' },
      legend: { orient: 'vertical', right: '10%', top: 'center' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['40%', '50%'],
        data: (chartConfig.data.series || []).map((s: { name: string; value: number }, i: number) => ({
          name: s.name,
          value: s.value,
          itemStyle: {
            color: ['#1B65A8', '#67C23A', '#E6A23C', '#F56C6C', '#909399'][i % 5]
          }
        })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    };
  } else {
    console.warn(`Unsupported chart type: ${chartConfig.type}`);
    return;
  }

  chart.setOption(option);
}

// 滚动到底部 — rAF 节流 + 用户上翻暂停
let scrollRafId: number | null = null;
let userIsScrollingUp = false;

function onChatScroll() {
  if (!chatContainerRef.value) return;
  const el = chatContainerRef.value;
  const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  userIsScrollingUp = !isAtBottom;
}

function scrollToBottom(force = false) {
  if (!force && userIsScrollingUp) return;
  if (scrollRafId !== null) return;
  scrollRafId = requestAnimationFrame(() => {
    if (chatContainerRef.value) {
      chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight;
    }
    scrollRafId = null;
  });
}

// chunk 缓冲 — 16ms 内累积后批量更新
let chunkBuffer = '';
let chunkFlushTimer: ReturnType<typeof setTimeout> | null = null;
let chunkTargetId = '';

function flushChunkBuffer() {
  if (!chunkBuffer || !chunkTargetId) return;
  const idx = chatHistory.value.findIndex(m => m.id === chunkTargetId);
  if (idx !== -1) {
    const msg = chatHistory.value[idx];
    msg.content = (msg.loading ? '' : msg.content) + chunkBuffer;
    msg.loading = false;
    msg.streaming = true;
  }
  chunkBuffer = '';
  chunkFlushTimer = null;
  scrollToBottom();
}

// 处理快捷问题
function handleQuickQuestion(question: string) {
  inputQuery.value = question;
  handleSendMessage();
}

// 清空对话
function handleClearHistory() {
  // 销毁所有图表
  chartInstances.forEach(chart => chart.dispose());
  chartInstances.clear();

  chatHistory.value = [{
    id: 'welcome',
    role: 'assistant',
    content: '您好！我是 SmartBI 智能助手，可以帮您分析销售、财务、库存等数据。您可以选择下方的分析模板快速开始，或直接输入问题。',
    timestamp: new Date()
  }];
}

// 格式化时间
function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

// 处理键盘事件
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSendMessage();
  }
}
</script>

<template>
  <div ref="pageRef" class="ai-query-page">
    <div class="page-header">
      <div class="header-left">
        <h1>
          <el-icon><ChatDotRound /></el-icon>
          AI 智能问答
        </h1>
      </div>
      <div class="header-right">
        <el-select
          v-if="dataSources.length > 0"
          v-model="selectedUploadId"
          placeholder="选择数据源"
          size="small"
          style="width: 280px; margin-right: 8px"
        >
          <el-option
            v-for="ds in dataSources"
            :key="ds.id"
            :label="formatDataSourceLabel(ds)"
            :value="ds.id"
          >
            <el-tooltip :content="formatDataSourceLabel(ds)" placement="left" :show-after="500">
              <span style="display:block;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ formatDataSourceLabel(ds) }}</span>
            </el-tooltip>
          </el-option>
        </el-select>
        <el-button :icon="Delete" @click="handleClearHistory">清空对话</el-button>
      </div>
    </div>

    <div class="chat-container">
      <!-- 对话历史区 -->
      <div class="chat-history" ref="chatContainerRef" @scroll="onChatScroll">
        <div
          v-for="message in chatHistory"
          :key="message.id"
          class="chat-message"
          :class="message.role"
        >
          <div class="message-avatar">
            <el-icon v-if="message.role === 'user'"><User /></el-icon>
            <el-icon v-else><Cpu /></el-icon>
          </div>
          <div class="message-content">
            <div class="message-header">
              <span class="role-name">{{ message.role === 'user' ? '我' : 'AI 助手' }}</span>
              <span class="message-time">{{ formatTime(message.timestamp) }}</span>
            </div>
            <div class="message-body">
              <div v-if="message.loading" class="loading-indicator">
                <el-icon class="is-loading"><Loading /></el-icon>
                <span>{{ message.content || '正在思考...' }}</span>
              </div>
              <template v-else>
                <div v-if="message.role === 'assistant' && message.streaming" class="message-text streaming-text">{{ message.content }}</div>
                <div v-else-if="message.role === 'assistant'" class="message-text markdown-body" v-html="renderMarkdown(message.content)"></div>
                <div v-else class="message-text">{{ message.content }}</div>

                <!-- AI 洞察面板 (only show if insights has actual content) -->
                <div v-if="message.insights && ((message.insights.positive?.items?.length ?? 0) > 0 || (message.insights.negative?.items?.length ?? 0) > 0 || (message.insights.suggestions?.items?.length ?? 0) > 0)" class="message-insights">
                  <AIInsightPanel
                    :insight="message.insights"
                    title="AI 分析洞察"
                    :collapsible="true"
                    :default-expanded="true"
                  />
                </div>

                <!-- 图表展示 (only show if chart has proper ECharts option) -->
                <div v-if="(message.chartConfig && message.chartConfig.option) || message.chart" class="message-chart">
                  <div :id="`chart-${message.id}`" class="chart-container"></div>
                </div>

                <!-- 表格展示 -->
                <div v-if="message.table" class="message-table">
                  <el-table :data="message.table.data" stripe border size="small">
                    <el-table-column
                      v-for="col in message.table.columns"
                      :key="col"
                      :label="col"
                      :prop="col"
                      min-width="80"
                    />
                  </el-table>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- Template section - shown when only welcome message exists (no real conversation) -->
        <div v-if="chatHistory.length <= 1" class="template-section">
          <h3 class="template-title">
            <el-icon><Cpu /></el-icon> 选择分析模板
          </h3>

          <!-- Category tabs -->
          <div class="template-categories">
            <el-button
              v-for="cat in templateCategories"
              :key="cat.key"
              :type="selectedCategory === cat.key ? 'primary' : 'default'"
              size="small"
              round
              @click="selectedCategory = selectedCategory === cat.key ? '' : cat.key"
            >
              {{ cat.label }}
            </el-button>
            <el-button
              v-if="selectedCategory"
              size="small"
              text
              @click="selectedCategory = ''"
            >
              全部
            </el-button>
          </div>

          <!-- Template cards grid -->
          <div class="template-grid">
            <div
              v-for="tpl in filteredTemplates"
              :key="tpl.id"
              class="template-card"
              @click="useTemplate(tpl)"
            >
              <div class="template-card-header">
                <el-icon :size="20"><component :is="tpl.icon" /></el-icon>
                <span class="template-label">{{ tpl.label }}</span>
              </div>
              <p class="template-desc">{{ tpl.description }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 快捷问题 (hide when conversation has started to save space) -->
      <div v-if="chatHistory.length <= 2" class="quick-questions">
        <span class="label">快捷问题:</span>
        <div class="questions-list">
          <el-button
            v-for="(q, index) in quickQuestions"
            :key="index"
            size="small"
            round
            @click="handleQuickQuestion(q)"
          >
            {{ q }}
          </el-button>
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="input-area">
        <el-input
          v-model="inputQuery"
          ref="inputRef"
          type="textarea"
          :rows="2"
          placeholder="输入您的问题，例如：本月销售额是多少？"
          :disabled="isTyping"
          @keydown="handleKeydown"
        />
        <el-button
          type="primary"
          :icon="Promotion"
          :loading="isTyping"
          :disabled="!inputQuery.trim()"
          @click="handleSendMessage"
        >
          发送
        </el-button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.ai-query-page {
  padding: 20px;
  height: calc(100vh - var(--header-height, 64px) - 80px);
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  flex-shrink: 0;

  .header-left {
    h1 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 12px 0 0;
      font-size: 20px;
      font-weight: 600;

      .el-icon {
        color: var(--color-primary);
      }
    }
  }
}

.chat-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color, #fff);
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

// 对话历史
.chat-history {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px;
}

.chat-message {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;

  &.user {
    flex-direction: row-reverse;

    .message-content {
      align-items: flex-end;
    }

    .message-header {
      flex-direction: row-reverse;
    }

    .message-body {
      background: var(--color-primary);
      color: #fff;
      border-radius: 12px 0 12px 12px;
    }

    .message-text {
      color: #fff;
    }
  }

  &.assistant {
    .message-body {
      background: var(--el-fill-color-light, #f5f7fa);
      border-radius: 0 12px 12px 12px;
    }
  }

  .message-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--color-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    .el-icon {
      font-size: 20px;
      color: #fff;
    }
  }

  &.assistant .message-avatar {
    background: var(--el-color-success, #67C23A);
  }

  .message-content {
    display: flex;
    flex-direction: column;
    max-width: 70%;
  }

  .message-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;

    .role-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--el-text-color-primary, #303133);
    }

    .message-time {
      font-size: 12px;
      color: var(--el-text-color-secondary, #909399);
    }
  }

  .message-body {
    padding: 12px 16px;
  }

  .message-text {
    font-size: 14px;
    line-height: 1.8;
    color: var(--el-text-color-primary, #303133);
    white-space: pre-wrap;

    // Markdown body styles for assistant messages
    &.markdown-body {
      white-space: normal;

      :deep(p) { margin: 0.4em 0; }
      :deep(h1), :deep(h2), :deep(h3) { margin: 0.6em 0 0.3em; font-weight: 600; }
      :deep(h3) { font-size: 15px; }
      :deep(ul), :deep(ol) { padding-left: 1.5em; margin: 0.3em 0; }
      :deep(li) { margin: 0.15em 0; }
      :deep(strong) { font-weight: 600; }
      :deep(code) { background: rgba(0,0,0,0.06); padding: 2px 4px; border-radius: 3px; font-size: 13px; }
      :deep(pre) { background: rgba(0,0,0,0.04); padding: 8px 12px; border-radius: 6px; overflow-x: auto; }
      :deep(blockquote) { border-left: 3px solid var(--color-primary); padding-left: 12px; margin: 0.4em 0; color: var(--el-text-color-regular, #606266); }
      :deep(table) { border-collapse: collapse; margin: 0.5em 0; }
      :deep(th), :deep(td) { border: 1px solid var(--el-border-color, #dcdfe6); padding: 4px 8px; font-size: 13px; }
      :deep(th) { background: var(--el-fill-color-light, #f5f7fa); }
    }

    // Streaming plain text — pre-wrap preserves newlines, no markdown overhead
    // Blinking cursor gives "AI is typing" perception (like Power BI Copilot)
    &.streaming-text {
      white-space: pre-wrap;

      &::after {
        content: '▍';
        display: inline;
        animation: cursor-blink 0.6s steps(2) infinite;
        color: var(--el-color-primary, #1B65A8);
        font-weight: 300;
        margin-left: 1px;
      }
    }
  }

  @keyframes cursor-blink {
    0% { opacity: 1; }
    50% { opacity: 0; }
    100% { opacity: 1; }
  }

  .loading-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--el-text-color-secondary, #909399);

    .el-icon {
      font-size: 16px;
    }
  }

  .message-insights {
    margin-top: 16px;
    max-width: 500px;
  }

  .message-chart {
    margin-top: 16px;

    .chart-container {
      height: 250px;
      width: 100%;
      min-width: 300px;
    }
  }

  .message-table {
    margin-top: 16px;
    max-width: 500px;
  }
}

// 快捷问题
.quick-questions {
  padding: 12px 20px;
  border-top: 1px solid var(--el-border-color-light, #ebeef5);
  background: var(--el-fill-color-lighter, #fafafa);

  .label {
    font-size: 13px;
    color: var(--el-text-color-secondary, #909399);
    margin-right: 12px;
  }

  .questions-list {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 8px;
  }
}

// 输入区域
.input-area {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--el-border-color-lighter, #ebeef5);
  background: var(--el-bg-color, #fff);

  :deep(.el-textarea) {
    flex: 1;

    .el-textarea__inner {
      resize: none;
      border-radius: 8px;
    }
  }

  .el-button {
    align-self: flex-end;
    height: 40px;
    padding: 0 24px;
  }
}

// 分析模板
.template-section {
  padding: 20px;
}

.template-title {
  margin: 0 0 16px;
  color: #303133;
  font-size: 18px;
  display: flex;
  align-items: center;
  gap: 6px;

  .el-icon {
    color: var(--color-primary);
  }
}

.template-categories {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.template-card {
  padding: 16px;
  background: var(--el-bg-color, #fff);
  border: 1px solid var(--el-border-color-light, #e4e7ed);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--el-color-primary, #1B65A8);
    box-shadow: 0 4px 12px rgba(27, 101, 168, 0.15);
    transform: translateY(-2px);
  }
}

.template-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: var(--el-text-color-primary, #303133);
  font-weight: 600;
}

.template-label {
  font-size: 14px;
}

.template-desc {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
  line-height: 1.5;
}

// 响应式
@media (max-width: 768px) {
  .ai-query-page {
    padding: 12px;
    height: calc(100vh - var(--header-height, 56px) - 24px);
  }

  .chat-message {
    .message-content {
      max-width: 90%;
    }
  }

  .quick-questions {
    .questions-list {
      max-height: 120px;
      overflow-y: auto;
    }
  }

  .template-grid {
    grid-template-columns: 1fr;
  }
}
</style>
