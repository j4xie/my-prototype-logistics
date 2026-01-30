<script setup lang="ts">
/**
 * SmartBI AI 问答页面
 * 支持自然语言查询、快捷问题、对话历史和图表展示
 * 连接 Python SmartBI 服务获取真实分析结果
 */
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { chatAnalysis, type AnalysisResult, type AIInsightData, type ChartConfig } from '@/api/smartbi';
import { ElMessage } from 'element-plus';
import {
  ChatDotRound,
  Promotion,
  Refresh,
  Delete,
  User,
  Cpu,
  TrendCharts,
  Loading
} from '@element-plus/icons-vue';
import * as echarts from 'echarts';
import { AIInsightPanel } from '@/components/smartbi';

const route = useRoute();
const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId || 'F001');

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

const chatHistory = ref<ChatMessage[]>([]);
const chatContainerRef = ref<HTMLDivElement | null>(null);

// 快捷问题
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

// 加载状态
const isTyping = ref(false);

// 图表实例缓存
const chartInstances: Map<string, echarts.ECharts> = new Map();

onMounted(() => {
  // 检查 URL 中是否有预设问题
  const query = route.query.q as string;
  if (query) {
    inputQuery.value = query;
    handleSendMessage();
  }

  // 添加欢迎消息
  if (chatHistory.value.length === 0) {
    chatHistory.value.push({
      id: 'welcome',
      role: 'assistant',
      content: '您好！我是 SmartBI 智能助手，可以帮您分析销售、财务、库存等数据。您可以直接输入问题，或点击下方的快捷问题。',
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
      data: currentData.value,
      fields: currentFields.value,
      table_type: currentTableType.value
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
        chatHistory.value[messageIndex] = {
          id: assistantId,
          role: 'assistant',
          content: response.error || '分析请求失败，请稍后重试',
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

    // 更新为错误消息
    const messageIndex = chatHistory.value.findIndex(m => m.id === assistantId);
    if (messageIndex !== -1) {
      chatHistory.value[messageIndex] = {
        id: assistantId,
        role: 'assistant',
        content: '抱歉，查询过程中发生错误，请稍后重试。',
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

// 暴露给父组件调用
defineExpose({ setAnalysisContext });

// 渲染图表 (从 ChartConfig)
function renderChartFromConfig(messageId: string, chartConfig: ChartConfig) {
  if (!chartConfig || !chartConfig.option) return;

  const chartDom = document.getElementById(`chart-${messageId}`);
  if (!chartDom) return;

  // 销毁旧图表
  const oldChart = chartInstances.get(messageId);
  if (oldChart) {
    oldChart.dispose();
  }

  const chart = echarts.init(chartDom);
  chartInstances.set(messageId, chart);

  // 直接使用 Python 返回的 ECharts option
  chart.setOption(chartConfig.option as echarts.EChartsOption);
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

  const chart = echarts.init(chartDom);
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
    content: '您好！我是 SmartBI 智能助手，可以帮您分析销售、财务、库存等数据。您可以直接输入问题，或点击下方的快捷问题。',
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
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/smart-bi' }">Smart BI</el-breadcrumb-item>
          <el-breadcrumb-item>AI 问答</el-breadcrumb-item>
        </el-breadcrumb>
        <h1>
          <el-icon><ChatDotRound /></el-icon>
          AI 智能问答
        </h1>
      </div>
      <div class="header-right">
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

                <!-- 图表展示 -->
                <div v-if="message.chart || message.chartConfig" class="message-chart">
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
      </div>

      <!-- 快捷问题 -->
      <div class="quick-questions">
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
}
</style>
