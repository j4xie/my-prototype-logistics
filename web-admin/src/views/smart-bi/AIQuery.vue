<script setup lang="ts">
/**
 * SmartBI AI 问答页面
 * 支持自然语言查询、快捷问题、对话历史和图表展示
 */
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { post } from '@/api/request';
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
    data: any;
  };
  table?: {
    columns: string[];
    data: Record<string, any>[];
  };
  loading?: boolean;
}

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
    // 调用 AI 接口
    // const response = await post(`/${factoryId.value}/smart-bi/ai/query`, { query });

    // 模拟 AI 响应
    await new Promise(resolve => setTimeout(resolve, 1500));

    const aiResponse = generateMockResponse(query);

    // 更新助手消息
    const messageIndex = chatHistory.value.findIndex(m => m.id === assistantId);
    if (messageIndex !== -1) {
      chatHistory.value[messageIndex] = {
        id: assistantId,
        role: 'assistant',
        content: aiResponse.content,
        timestamp: new Date(),
        chart: aiResponse.chart,
        table: aiResponse.table,
        loading: false
      };
    }

    // 渲染图表
    await nextTick();
    if (aiResponse.chart) {
      renderChart(assistantId, aiResponse.chart);
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

// 生成模拟响应
function generateMockResponse(query: string): {
  content: string;
  chart?: ChatMessage['chart'];
  table?: ChatMessage['table'];
} {
  if (query.includes('销售额')) {
    return {
      content: '根据数据分析，本月销售额为 285.6 万元，同比增长 12.5%，环比增长 8.3%。\n\n主要增长来自华东区，贡献了 45% 的销售额。冷冻肉类产品销售最为突出，占总销售额的 39%。',
      chart: {
        type: 'line',
        data: {
          xAxis: ['1月', '2月', '3月', '4月', '5月', '6月'],
          series: [
            { name: '销售额', data: [210, 235, 258, 245, 268, 285.6] }
          ]
        }
      }
    };
  }

  if (query.includes('产品') || query.includes('最高')) {
    return {
      content: '销售额最高的产品是「冷冻牛肉」，本月销售额达到 112.8 万元，占总销售额的 39.5%。\n\n前三名产品分别是：\n1. 冷冻牛肉 - 112.8 万元\n2. 冷冻猪肉 - 78.5 万元\n3. 海鲜产品 - 52.3 万元',
      chart: {
        type: 'pie',
        data: {
          series: [
            { name: '冷冻牛肉', value: 112.8 },
            { name: '冷冻猪肉', value: 78.5 },
            { name: '海鲜产品', value: 52.3 },
            { name: '速冻食品', value: 28.6 },
            { name: '其他', value: 13.4 }
          ]
        }
      }
    };
  }

  if (query.includes('利润')) {
    return {
      content: '本月毛利润为 85.6 万元，毛利率为 30%；净利润为 42.8 万元，净利率为 15%。\n\n与上月相比，净利润增长了 8.3%，主要得益于原材料成本的下降和销售规模的扩大。',
      chart: {
        type: 'bar',
        data: {
          xAxis: ['1月', '2月', '3月', '4月', '5月', '6月'],
          series: [
            { name: '毛利润', data: [63, 70.5, 77.4, 73.5, 80.4, 85.6] },
            { name: '净利润', data: [31.5, 35.3, 38.7, 36.8, 40.2, 42.8] }
          ]
        }
      }
    };
  }

  if (query.includes('部门')) {
    return {
      content: '业绩最好的是销售一部，本月完成销售额 85.6 万元，同比增长 18.5%，超额完成目标 115%。\n\n部门业绩排名：\n1. 销售一部 - 85.6 万元 (+18.5%)\n2. 销售二部 - 72.5 万元 (+12.3%)\n3. 销售三部 - 68.0 万元 (+8.7%)\n4. 销售四部 - 59.5 万元 (+5.2%)',
      table: {
        columns: ['排名', '部门', '销售额', '增长率', '完成率'],
        data: [
          { 排名: 1, 部门: '销售一部', 销售额: '85.6万', 增长率: '+18.5%', 完成率: '115%' },
          { 排名: 2, 部门: '销售二部', 销售额: '72.5万', 增长率: '+12.3%', 完成率: '108%' },
          { 排名: 3, 部门: '销售三部', 销售额: '68.0万', 增长率: '+8.7%', 完成率: '102%' },
          { 排名: 4, 部门: '销售四部', 销售额: '59.5万', 增长率: '+5.2%', 完成率: '95%' }
        ]
      }
    };
  }

  if (query.includes('库存')) {
    return {
      content: '当前库存总价值为 456.8 万元，库存周转天数为 25 天，处于正常水平。\n\n需要关注的是，部分产品库存周转较慢：\n- 冷冻羊肉：周转天数 42 天（建议优化）\n- 进口海鲜：周转天数 38 天（建议促销）',
      chart: {
        type: 'bar',
        data: {
          xAxis: ['冷冻牛肉', '冷冻猪肉', '海鲜产品', '冷冻羊肉', '进口海鲜'],
          series: [
            { name: '周转天数', data: [18, 22, 28, 42, 38] }
          ]
        }
      }
    };
  }

  if (query.includes('应收') || query.includes('账款')) {
    return {
      content: '当前应收账款总额为 128.5 万元：\n- 30天内：85.6 万元（66.6%，正常）\n- 30-60天：28.5 万元（22.2%，需关注）\n- 60天以上：14.4 万元（11.2%，需催收）\n\n建议对逾期超过60天的3笔账款加强催收。',
      chart: {
        type: 'pie',
        data: {
          series: [
            { name: '30天内', value: 85.6 },
            { name: '30-60天', value: 28.5 },
            { name: '60天以上', value: 14.4 }
          ]
        }
      }
    };
  }

  if (query.includes('客户')) {
    return {
      content: '本月活跃客户数为 328 家，同比增长 6.8%。\n\n新增客户 28 家，流失客户 8 家，净增 20 家。客户留存率为 97.6%，处于良好水平。\n\n高价值客户占比提升至 28%，客单价持续增长。',
      chart: {
        type: 'line',
        data: {
          xAxis: ['1月', '2月', '3月', '4月', '5月', '6月'],
          series: [
            { name: '活跃客户数', data: [285, 296, 305, 312, 320, 328] }
          ]
        }
      }
    };
  }

  // 默认响应
  return {
    content: '我理解您想了解「' + query + '」相关的信息。\n\n目前系统支持以下类型的查询：\n- 销售数据分析（销售额、订单、客户等）\n- 财务数据分析（利润、成本、预算等）\n- 库存数据分析（周转、库龄、预警等）\n- 部门业绩分析（排名、对比、趋势等）\n\n请尝试使用更具体的问题，或点击下方的快捷问题。'
  };
}

// 渲染图表
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

                <!-- 图表展示 -->
                <div v-if="message.chart" class="message-chart">
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
