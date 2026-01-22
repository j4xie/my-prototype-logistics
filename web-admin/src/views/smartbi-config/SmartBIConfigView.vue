<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { ElMessage } from 'element-plus';
import { Setting, Connection, PieChart, Collection, Odometer } from '@element-plus/icons-vue';
import {
  getThresholds,
  updateThreshold,
  type ThresholdConfig
} from '@/api/smartbi-config';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('system'));

// 当前选中的 Tab
const activeTab = ref('overview');

// 阈值配置数据
const thresholdLoading = ref(false);
const thresholdList = ref<ThresholdConfig[]>([]);
const thresholdSaving = ref(false);

// 根据路由参数设置初始 Tab
onMounted(() => {
  if (route.query.tab) {
    activeTab.value = route.query.tab as string;
  }
  loadThresholds();
});

// 监听 Tab 变化，更新 URL
watch(activeTab, (newTab) => {
  router.replace({ query: { ...route.query, tab: newTab } });
});

// 跳转到子页面
function goToPage(page: string) {
  router.push(`/smartbi-config/${page}`);
}

// 加载阈值配置
async function loadThresholds() {
  thresholdLoading.value = true;
  try {
    const response = await getThresholds();
    if (response.success && response.data) {
      thresholdList.value = response.data;
    }
  } catch (error) {
    console.error('加载阈值配置失败:', error);
    ElMessage.error('加载阈值配置失败');
  } finally {
    thresholdLoading.value = false;
  }
}

// 保存单个阈值
async function saveThreshold(row: ThresholdConfig) {
  thresholdSaving.value = true;
  try {
    const response = await updateThreshold(row.id, {
      warningThreshold: row.warningThreshold,
      criticalThreshold: row.criticalThreshold,
      isActive: row.isActive
    });
    if (response.success) {
      ElMessage.success('阈值已更新');
    }
  } catch (error) {
    console.error('保存阈值失败:', error);
    ElMessage.error('保存失败');
  } finally {
    thresholdSaving.value = false;
  }
}

// 统计信息
const stats = computed(() => {
  return {
    activeThresholds: thresholdList.value.filter(t => t.isActive).length,
    totalThresholds: thresholdList.value.length
  };
});

// 阈值方向显示
function getDirectionText(direction: string) {
  return direction === 'UP' ? '上升超过' : '下降超过';
}

function getDirectionType(direction: string) {
  return direction === 'UP' ? 'danger' : 'warning';
}
</script>

<template>
  <div class="page-wrapper">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span class="page-title">SmartBI 配置管理</span>
          <span class="page-subtitle">管理数据源、图表模板和分析配置</span>
        </div>
      </template>

      <el-tabs v-model="activeTab" class="config-tabs">
        <!-- 概览 Tab -->
        <el-tab-pane name="overview">
          <template #label>
            <span class="tab-label">
              <el-icon><Setting /></el-icon>
              配置概览
            </span>
          </template>

          <div class="overview-section">
            <!-- 快捷入口卡片 -->
            <el-row :gutter="20" class="quick-actions">
              <el-col :span="8">
                <el-card class="action-card" shadow="hover" @click="goToPage('data-sources')">
                  <div class="action-content">
                    <el-icon class="action-icon" :size="40"><Connection /></el-icon>
                    <div class="action-info">
                      <h3>数据源配置</h3>
                      <p>管理 SmartBI 数据源连接</p>
                    </div>
                  </div>
                  <el-button type="primary" link class="action-btn">
                    进入管理 &gt;
                  </el-button>
                </el-card>
              </el-col>
              <el-col :span="8">
                <el-card class="action-card" shadow="hover" @click="goToPage('chart-templates')">
                  <div class="action-content">
                    <el-icon class="action-icon" :size="40"><PieChart /></el-icon>
                    <div class="action-info">
                      <h3>图表模板</h3>
                      <p>配置可视化图表模板</p>
                    </div>
                  </div>
                  <el-button type="primary" link class="action-btn">
                    进入管理 &gt;
                  </el-button>
                </el-card>
              </el-col>
              <el-col :span="8">
                <el-card class="action-card action-card-disabled" shadow="hover">
                  <div class="action-content">
                    <el-icon class="action-icon" :size="40"><Collection /></el-icon>
                    <div class="action-info">
                      <h3>计算公式</h3>
                      <p>定义业务指标计算公式</p>
                    </div>
                  </div>
                  <el-tag size="small" type="info">即将推出</el-tag>
                </el-card>
              </el-col>
            </el-row>

            <!-- 配置统计 -->
            <el-card class="stats-card" shadow="never">
              <template #header>
                <span>配置状态</span>
              </template>
              <el-row :gutter="20">
                <el-col :span="6">
                  <el-statistic title="活跃阈值规则" :value="stats.activeThresholds">
                    <template #suffix>
                      <span class="stat-suffix">/ {{ stats.totalThresholds }}</span>
                    </template>
                  </el-statistic>
                </el-col>
                <el-col :span="6">
                  <el-statistic title="数据源数量" value="-">
                    <template #suffix>
                      <span class="stat-suffix">个</span>
                    </template>
                  </el-statistic>
                </el-col>
                <el-col :span="6">
                  <el-statistic title="图表模板" value="-">
                    <template #suffix>
                      <span class="stat-suffix">个</span>
                    </template>
                  </el-statistic>
                </el-col>
                <el-col :span="6">
                  <el-statistic title="自定义公式" value="-">
                    <template #suffix>
                      <span class="stat-suffix">个</span>
                    </template>
                  </el-statistic>
                </el-col>
              </el-row>
            </el-card>
          </div>
        </el-tab-pane>

        <!-- 阈值配置 Tab -->
        <el-tab-pane name="thresholds">
          <template #label>
            <span class="tab-label">
              <el-icon><Odometer /></el-icon>
              阈值配置
            </span>
          </template>

          <div class="threshold-section" v-loading="thresholdLoading">
            <el-alert
              type="info"
              :closable="false"
              show-icon
              style="margin-bottom: 20px"
            >
              <template #title>
                阈值配置用于设置 SmartBI 分析中的预警规则。当指标超过阈值时，系统会自动生成预警提示。
              </template>
            </el-alert>

            <el-table :data="thresholdList" border stripe>
              <el-table-column prop="metricCode" label="指标代码" width="150">
                <template #default="{ row }">
                  <code class="metric-code">{{ row.metricCode }}</code>
                </template>
              </el-table-column>
              <el-table-column prop="metricName" label="指标名称" width="180" />
              <el-table-column prop="direction" label="触发方向" width="120" align="center">
                <template #default="{ row }">
                  <el-tag :type="getDirectionType(row.direction)" size="small">
                    {{ getDirectionText(row.direction) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="警告阈值" width="150" align="center">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.warningThreshold"
                    :min="0"
                    :precision="2"
                    size="small"
                    :disabled="!canWrite"
                    controls-position="right"
                    style="width: 120px"
                  />
                </template>
              </el-table-column>
              <el-table-column label="严重阈值" width="150" align="center">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.criticalThreshold"
                    :min="0"
                    :precision="2"
                    size="small"
                    :disabled="!canWrite"
                    controls-position="right"
                    style="width: 120px"
                  />
                </template>
              </el-table-column>
              <el-table-column prop="unit" label="单位" width="80" align="center">
                <template #default="{ row }">
                  {{ row.unit || '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="isActive" label="状态" width="80" align="center">
                <template #default="{ row }">
                  <el-switch
                    v-model="row.isActive"
                    :disabled="!canWrite"
                    @change="saveThreshold(row)"
                  />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="100" align="center" fixed="right">
                <template #default="{ row }">
                  <el-button
                    type="primary"
                    link
                    :loading="thresholdSaving"
                    :disabled="!canWrite"
                    @click="saveThreshold(row)"
                  >
                    保存
                  </el-button>
                </template>
              </el-table-column>
            </el-table>

            <div v-if="thresholdList.length === 0 && !thresholdLoading" class="empty-state">
              <el-empty description="暂无阈值配置" />
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.page-wrapper {
  height: 100%;
  width: 100%;
  padding: 20px;
  box-sizing: border-box;
}

.page-card {
  height: 100%;
  display: flex;
  flex-direction: column;

  :deep(.el-card__header) {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color-lighter, #ebeef5);
  }

  :deep(.el-card__body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 0;
    overflow: hidden;
  }
}

.card-header {
  display: flex;
  align-items: baseline;
  gap: 12px;

  .page-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color-primary, #303133);
  }

  .page-subtitle {
    font-size: 14px;
    color: var(--text-color-secondary, #909399);
  }
}

.config-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;

  :deep(.el-tabs__header) {
    padding: 0 20px;
    margin-bottom: 0;
    background: #fafafa;
    border-bottom: 1px solid #ebeef5;
  }

  :deep(.el-tabs__content) {
    flex: 1;
    padding: 20px;
    overflow: auto;
  }
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

// 概览部分
.overview-section {
  .quick-actions {
    margin-bottom: 24px;
  }

  .action-card {
    cursor: pointer;
    transition: all 0.3s;
    height: 160px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;

    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    }

    &.action-card-disabled {
      cursor: not-allowed;
      opacity: 0.7;

      &:hover {
        transform: none;
        box-shadow: none;
      }
    }

    :deep(.el-card__body) {
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 20px;
    }

    .action-content {
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }

    .action-icon {
      color: var(--el-color-primary);
      flex-shrink: 0;
    }

    .action-info {
      h3 {
        margin: 0 0 8px;
        font-size: 16px;
        font-weight: 600;
        color: var(--text-color-primary);
      }

      p {
        margin: 0;
        font-size: 13px;
        color: var(--text-color-secondary);
      }
    }

    .action-btn {
      align-self: flex-end;
    }
  }

  .stats-card {
    :deep(.el-card__header) {
      padding: 12px 20px;
      font-weight: 600;
    }

    :deep(.el-card__body) {
      padding: 20px;
    }

    .stat-suffix {
      font-size: 14px;
      color: var(--text-color-secondary);
    }
  }
}

// 阈值部分
.threshold-section {
  .metric-code {
    background-color: #f5f5f5;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 12px;
  }

  .empty-state {
    padding: 40px 0;
  }
}
</style>
