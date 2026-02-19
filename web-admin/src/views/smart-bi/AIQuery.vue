<script setup lang="ts">
/**
 * SmartBI AI 问答页面
 * 支持自然语言查询、快捷问题、对话历史和图表展示
 * 连接 Python SmartBI 服务获取真实分析结果
 */
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { chatAnalysis, getUploadHistory, deduplicateUploads, type AnalysisResult, type AIInsightData, type ChartConfig, type UploadHistoryItem } from '@/api/smartbi';
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
import echarts from '@/utils/echarts';
import { AIInsightPanel } from '@/components/smartbi';
import SmartBIEmptyState from '@/components/smartbi/SmartBIEmptyState.vue';

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
  { key: 'sales', label: '销售分析', icon: 'TrendCharts', color: '#409EFF' },
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

// 监听窗口大小变化，调整图表大小
window.addEventListener('resize', () => {
  chartInstances.forEach(chart => chart.resize());
});

// 发送消息
async function handleSendMessage() {
  const query = inputQuery.value.trim();
  if (!query) return;

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

  // 滚动到底部
  await scrollToBottom();

  isTyping.value = true;

  try {
    // 调用真实 Python SmartBI API
    const response = await chatAnalysis({
      query,
      data: currentData.value.length > 0 ? currentData.value : undefined,
      fields: currentFields.value.length > 0 ? currentFields.value : undefined,
      table_type: currentTableType.value || undefined,
      uploadId: selectedUploadId.value ? String(selectedUploadId.value) : undefined,
    });

    // 更新助手消息
    const messageIndex = chatHistory.value.findIndex(m => m.id === assistantId);
    if (messageIndex !== -1) {
      if (response.success) {
        // 构建图表数据 (兼容旧格式)
        let chartData: ChatMessage['chart'] | undefined;
        if (response.charts && response.charts.length > 0) {
          const firstChart = response.charts[0];
          chartData = {
            type: firstChart.type as 'line' | 'bar' | 'pie',
            data: firstChart.option as Record<string, unknown>
          };
        }

        chatHistory.value[messageIndex] = {
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
      } else {
        // Convert raw API errors to user-friendly messages
        let errorMsg = '分析请求失败，请稍后重试';
        const rawError = response.error || '';
        if (rawError.includes('422') || rawError.includes('Unprocessable') || rawError.includes('sheet_id') || rawError.includes('Field required')) {
          errorMsg = '请先选择一个数据源（上传 Excel 或选择已有数据），再进行 AI 问答';
        } else if (rawError.includes('500') || rawError.includes('Internal Server')) {
          errorMsg = '分析服务暂时不可用，请稍后重试';
        } else if (rawError.includes('503') || rawError.includes('504') || rawError.includes('timeout')) {
          errorMsg = 'AI 分析服务暂时不可用，请稍后重试。';
        } else if (rawError.includes('network') || rawError.includes('fetch') || rawError.includes('Failed to fetch') || rawError.includes('ERR_CONNECTION')) {
          errorMsg = '请求失败，请检查网络连接';
        } else if (rawError) {
          errorMsg = rawError.length > 100 ? '分析请求失败，请稍后重试' : rawError;
        }
        chatHistory.value[messageIndex] = {
          id: assistantId,
          role: 'assistant',
          content: errorMsg,
          timestamp: new Date(),
          loading: false
        };
      }
    }

    // 渲染图表
    await nextTick();
    if (response.charts && response.charts.length > 0) {
      renderChartFromConfig(assistantId, response.charts[0]);
    }
  } catch (error) {
    console.error('AI 查询失败:', error);

    // Convert technical errors to user-friendly Chinese messages
    let friendlyMessage = '抱歉，查询过程中发生错误，请稍后重试。';
    const errStr = (error instanceof Error ? error.message : String(error)) || '';
    if (error && typeof error === 'object') {
      const errObj = error as Record<string, unknown>;
      const status = errObj.status || errObj.statusCode;
      if (status === 422 || errStr.includes('422') || errStr.includes('Unprocessable')) {
        friendlyMessage = '请先选择一个数据源（上传 Excel 或选择已有数据），再进行 AI 问答';
      } else if (status === 500 || errStr.includes('500') || errStr.includes('Internal Server')) {
        friendlyMessage = '分析服务暂时不可用，请稍后重试';
      } else if (status === 503 || status === 504 || errStr.includes('503') || errStr.includes('504') || errStr.includes('timeout')) {
        friendlyMessage = 'AI 分析服务暂时不可用，请稍后重试。';
      } else if (errStr.includes('fetch') || errStr.includes('network') || errStr.includes('Failed to fetch') || errStr.includes('ERR_CONNECTION')) {
        friendlyMessage = '请求失败，请检查网络连接';
      }
    }

    // 更新为错误消息
    const messageIndex = chatHistory.value.findIndex(m => m.id === assistantId);
    if (messageIndex !== -1) {
      chatHistory.value[messageIndex] = {
        id: assistantId,
        role: 'assistant',
        content: friendlyMessage,
        timestamp: new Date(),
        loading: false
      };
    }
  } finally {
    isTyping.value = false;
    await scrollToBottom();
  }
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
    const chartDom = document.getElementById(`chart-${messageId}`);
    if (!chartDom) {
      if (attempt < 3) {
        setTimeout(() => tryRender(attempt + 1), 200);
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
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
      xAxis: { type: 'category', data: chartConfig.data.xAxis },
      yAxis: { type: 'value' },
      series: chartConfig.data.series.map((s: any) => ({
        name: s.name,
        type: 'line',
        smooth: true,
        data: s.data,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
            { offset: 1, color: 'rgba(64, 158, 255, 0.05)' }
          ])
        }
      }))
    };
  } else if (chartConfig.type === 'bar') {
    option = {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
      xAxis: { type: 'category', data: chartConfig.data.xAxis },
      yAxis: { type: 'value' },
      series: chartConfig.data.series.map((s: any, i: number) => ({
        name: s.name,
        type: 'bar',
        data: s.data,
        itemStyle: {
          color: i === 0 ? '#409EFF' : '#67C23A',
          borderRadius: [4, 4, 0, 0]
        }
      }))
    };
  } else if (chartConfig.type === 'pie') {
    option = {
      tooltip: { trigger: 'item', formatter: '{b}: {c}万 ({d}%)' },
      legend: { orient: 'vertical', right: '10%', top: 'center' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['40%', '50%'],
        data: chartConfig.data.series.map((s: any, i: number) => ({
          name: s.name,
          value: s.value,
          itemStyle: {
            color: ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399'][i % 5]
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
  }

  chart.setOption(option!);
}

// 滚动到底部
async function scrollToBottom() {
  await nextTick();
  if (chatContainerRef.value) {
    chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight;
  }
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
  <div class="ai-query-page">
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
          />
        </el-select>
        <el-button :icon="Delete" @click="handleClearHistory">清空对话</el-button>
      </div>
    </div>

    <div class="chat-container">
      <!-- 对话历史区 -->
      <div class="chat-history" ref="chatContainerRef">
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
                <span>正在思考...</span>
              </div>
              <template v-else>
                <div class="message-text">{{ message.content }}</div>

                <!-- AI 洞察面板 -->
                <div v-if="message.insights" class="message-insights">
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
  height: calc(100vh - 144px);
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
        color: #409EFF;
      }
    }
  }
}

.chat-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
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
      background: #409EFF;
      color: #fff;
      border-radius: 12px 0 12px 12px;
    }

    .message-text {
      color: #fff;
    }
  }

  &.assistant {
    .message-body {
      background: #f5f7fa;
      border-radius: 0 12px 12px 12px;
    }
  }

  .message-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #409EFF;
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
    background: #67C23A;
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
      color: #303133;
    }

    .message-time {
      font-size: 12px;
      color: #909399;
    }
  }

  .message-body {
    padding: 12px 16px;
  }

  .message-text {
    font-size: 14px;
    line-height: 1.8;
    color: #303133;
    white-space: pre-wrap;
  }

  .loading-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #909399;

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
  border-top: 1px solid #ebeef5;
  background: #fafafa;

  .label {
    font-size: 13px;
    color: #909399;
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
  border-top: 1px solid #ebeef5;
  background: #fff;

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
    color: #409EFF;
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
  background: white;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #409EFF;
    box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
    transform: translateY(-2px);
  }
}

.template-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: #303133;
  font-weight: 600;
}

.template-label {
  font-size: 14px;
}

.template-desc {
  margin: 0;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

// 响应式
@media (max-width: 768px) {
  .chat-message {
    .message-content {
      max-width: 85%;
    }
  }

  .quick-questions {
    .questions-list {
      max-height: 80px;
      overflow-y: auto;
    }
  }

  .template-grid {
    grid-template-columns: 1fr;
  }
}
</style>
