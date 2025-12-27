<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { get, post } from '@/api/request';
import { ElMessage } from 'element-plus';
import { Document, Refresh, View, Warning } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);

const loading = ref(false);
const reports = ref<any[]>([]);
const selectedReport = ref<any>(null);
const detailDialogVisible = ref(false);

// 异常检测结果
const anomalies = ref<any[]>([]);
const anomalyLoading = ref(false);

onMounted(() => {
  loadReports();
  loadAnomalies();
});

async function loadReports() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const response = await get(`/${factoryId.value}/ai/reports`, {
      params: { page: 0, size: 20 }
    });
    if (response.success && response.data) {
      reports.value = response.data.content || response.data || [];
    }
  } catch (error) {
    console.error('加载AI报告失败:', error);
  } finally {
    loading.value = false;
  }
}

async function loadAnomalies() {
  if (!factoryId.value) return;
  anomalyLoading.value = true;
  try {
    const response = await get(`/${factoryId.value}/reports/anomalies`);
    if (response.success && response.data) {
      anomalies.value = response.data.anomalies || [];
    }
  } catch (error) {
    console.error('加载异常检测失败:', error);
  } finally {
    anomalyLoading.value = false;
  }
}

async function viewReport(report: any) {
  try {
    const response = await get(`/${factoryId.value}/ai/reports/${report.id}`);
    if (response.success && response.data) {
      selectedReport.value = response.data;
      detailDialogVisible.value = true;
    }
  } catch (error) {
    ElMessage.error('加载报告详情失败');
  }
}

async function generateNewReport() {
  if (!factoryId.value) return;
  try {
    ElMessage.info('正在生成新的分析报告...');
    const response = await post(`/${factoryId.value}/ai/analysis/cost/time-range`, {
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    });
    if (response.success) {
      ElMessage.success('报告生成成功');
      loadReports();
    }
  } catch (error) {
    ElMessage.error('生成报告失败');
  }
}

function formatDate(date: string) {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN');
}

function getReportTypeLabel(type: string) {
  const map: Record<string, string> = {
    cost_analysis: '成本分析',
    batch_analysis: '批次分析',
    trend_analysis: '趋势分析',
    anomaly_detection: '异常检测'
  };
  return map[type] || type;
}

function getSeverityType(severity: string) {
  const map: Record<string, string> = {
    high: 'danger',
    medium: 'warning',
    low: 'info'
  };
  return map[severity] || 'info';
}
</script>

<template>
  <div class="ai-reports-page">
    <div class="page-header">
      <div class="header-left">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/analytics' }">数据分析</el-breadcrumb-item>
          <el-breadcrumb-item>AI分析报告</el-breadcrumb-item>
        </el-breadcrumb>
        <h1>AI分析报告</h1>
      </div>
      <div class="header-right">
        <el-button type="primary" :icon="Refresh" @click="generateNewReport">生成新报告</el-button>
      </div>
    </div>

    <el-row :gutter="16">
      <!-- 报告列表 -->
      <el-col :span="16">
        <el-card class="reports-card">
          <template #header>
            <div class="card-header">
              <span>分析报告列表</span>
              <el-button text :icon="Refresh" @click="loadReports">刷新</el-button>
            </div>
          </template>

          <el-table :data="reports" v-loading="loading" stripe>
            <el-table-column prop="reportType" label="报告类型" width="120">
              <template #default="{ row }">
                <el-tag size="small">{{ getReportTypeLabel(row.reportType) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
            <el-table-column prop="createdAt" label="生成时间" width="170">
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link size="small" :icon="View" @click="viewReport(row)">
                  查看
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <!-- 异常检测 -->
      <el-col :span="8">
        <el-card class="anomalies-card">
          <template #header>
            <div class="card-header">
              <span><el-icon><Warning /></el-icon> 异常检测</span>
              <el-button text :icon="Refresh" @click="loadAnomalies">刷新</el-button>
            </div>
          </template>

          <div v-loading="anomalyLoading">
            <div v-if="anomalies.length === 0" class="empty-state">
              <el-empty description="暂无异常" :image-size="80" />
            </div>
            <div v-else class="anomaly-list">
              <div v-for="(anomaly, index) in anomalies" :key="index" class="anomaly-item">
                <el-tag :type="getSeverityType(anomaly.severity)" size="small">
                  {{ anomaly.severity === 'high' ? '严重' : anomaly.severity === 'medium' ? '中等' : '轻微' }}
                </el-tag>
                <div class="anomaly-content">
                  <div class="anomaly-title">{{ anomaly.title || anomaly.type }}</div>
                  <div class="anomaly-desc">{{ anomaly.description }}</div>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 报告详情对话框 -->
    <el-dialog v-model="detailDialogVisible" title="报告详情" width="70%" top="5vh">
      <div v-if="selectedReport" class="report-detail">
        <div class="report-header">
          <h2>{{ selectedReport.title }}</h2>
          <div class="report-meta">
            <el-tag>{{ getReportTypeLabel(selectedReport.reportType) }}</el-tag>
            <span class="time">生成时间: {{ formatDate(selectedReport.createdAt) }}</span>
          </div>
        </div>

        <el-divider />

        <div class="report-content">
          <div v-if="selectedReport.summary" class="section">
            <h3>摘要</h3>
            <p>{{ selectedReport.summary }}</p>
          </div>

          <div v-if="selectedReport.aiAnalysis" class="section">
            <h3>AI分析结果</h3>
            <div class="ai-analysis" v-html="selectedReport.aiAnalysis.replace(/\n/g, '<br>')"></div>
          </div>

          <div v-if="selectedReport.recommendations" class="section">
            <h3>建议</h3>
            <ul>
              <li v-for="(rec, i) in selectedReport.recommendations" :key="i">{{ rec }}</li>
            </ul>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.ai-reports-page {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;

  .header-left h1 {
    margin: 12px 0 0;
    font-size: 20px;
    font-weight: 600;
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .el-icon {
    margin-right: 4px;
  }
}

.reports-card, .anomalies-card {
  border-radius: 8px;
}

.anomaly-list {
  .anomaly-item {
    display: flex;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid #ebeef5;

    &:last-child {
      border-bottom: none;
    }

    .anomaly-content {
      flex: 1;

      .anomaly-title {
        font-weight: 500;
        color: #303133;
        margin-bottom: 4px;
      }

      .anomaly-desc {
        font-size: 13px;
        color: #909399;
      }
    }
  }
}

.empty-state {
  padding: 20px 0;
}

.report-detail {
  .report-header {
    h2 {
      margin: 0 0 12px;
      font-size: 18px;
    }

    .report-meta {
      display: flex;
      align-items: center;
      gap: 12px;

      .time {
        font-size: 13px;
        color: #909399;
      }
    }
  }

  .report-content {
    .section {
      margin-bottom: 24px;

      h3 {
        font-size: 15px;
        font-weight: 600;
        color: #303133;
        margin: 0 0 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid #ebeef5;
      }

      p, .ai-analysis {
        font-size: 14px;
        line-height: 1.8;
        color: #606266;
      }

      ul {
        margin: 0;
        padding-left: 20px;

        li {
          margin-bottom: 8px;
          color: #606266;
        }
      }
    }
  }
}
</style>
