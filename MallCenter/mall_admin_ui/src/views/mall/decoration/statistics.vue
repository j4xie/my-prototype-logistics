<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { Refresh, DataAnalysis, TrendCharts, User } from "@element-plus/icons-vue";
import { message } from "@/utils/message";
import { getAiUsageOverview, getMerchantAiUsageList } from "@/api/mall/decoration";
import type { MerchantAiUsage } from "@/api/mall/types/decoration";

defineOptions({
  name: "AiStatistics"
});

// Overview data
interface OverviewData {
  totalSessions: number;
  completedSessions: number;
  appliedConfigs: number;
  avgFeedbackScore: number;
  todaySessions: number;
  weekSessions: number;
  topIndustries: Array<{ name: string; count: number }>;
  topStyles: Array<{ name: string; count: number }>;
}

const overview = ref<OverviewData>({
  totalSessions: 0,
  completedSessions: 0,
  appliedConfigs: 0,
  avgFeedbackScore: 0,
  todaySessions: 0,
  weekSessions: 0,
  topIndustries: [],
  topStyles: []
});

const merchantUsageList = ref<MerchantAiUsage[]>([]);
const loadingOverview = ref(false);
const loadingMerchants = ref(false);

// Computed values
const completionRate = computed(() => {
  if (overview.value.totalSessions === 0) return 0;
  return Math.round(
    (overview.value.completedSessions / overview.value.totalSessions) * 100
  );
});

const applyRate = computed(() => {
  if (overview.value.completedSessions === 0) return 0;
  return Math.round(
    (overview.value.appliedConfigs / overview.value.completedSessions) * 100
  );
});

// Max count for progress calculation
const maxIndustryCount = computed(() => {
  if (overview.value.topIndustries.length === 0) return 1;
  return Math.max(...overview.value.topIndustries.map(i => i.count));
});

const maxStyleCount = computed(() => {
  if (overview.value.topStyles.length === 0) return 1;
  return Math.max(...overview.value.topStyles.map(s => s.count));
});

// Fetch overview data
const fetchOverview = async () => {
  loadingOverview.value = true;
  try {
    const res = await getAiUsageOverview();
    if (res.code === 200 && res.data) {
      overview.value = res.data;
    } else {
      message(res.msg || "获取统计数据失败", { type: "error" });
    }
  } catch (error) {
    message("获取统计数据失败", { type: "error" });
  } finally {
    loadingOverview.value = false;
  }
};

// Fetch merchant usage list
const fetchMerchantUsage = async () => {
  loadingMerchants.value = true;
  try {
    const res = await getMerchantAiUsageList();
    if (res.code === 200) {
      merchantUsageList.value = res.data || [];
    } else {
      message(res.msg || "获取商户使用统计失败", { type: "error" });
    }
  } catch (error) {
    message("获取商户使用统计失败", { type: "error" });
  } finally {
    loadingMerchants.value = false;
  }
};

// Refresh all data
const refreshData = () => {
  fetchOverview();
  fetchMerchantUsage();
};

// Format date
const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

// Get score color
const getScoreColor = (score: number) => {
  if (score >= 4.5) return "#67c23a";
  if (score >= 4.0) return "#409eff";
  if (score >= 3.0) return "#e6a23c";
  return "#f56c6c";
};

// Get progress color
const getProgressColor = (index: number) => {
  const colors = ["#409eff", "#67c23a", "#e6a23c", "#f56c6c", "#909399"];
  return colors[index % colors.length];
};

onMounted(() => {
  fetchOverview();
  fetchMerchantUsage();
});
</script>

<template>
  <div class="statistics-container">
    <!-- Page Header -->
    <el-card shadow="never" class="mb-4">
      <div class="flex justify-between items-center">
        <div class="flex items-center gap-2">
          <el-icon :size="24" color="#409eff"><DataAnalysis /></el-icon>
          <span class="text-lg font-medium">AI装修使用统计</span>
        </div>
        <el-button :icon="Refresh" @click="refreshData">刷新数据</el-button>
      </div>
    </el-card>

    <!-- Overview Statistics Cards -->
    <div v-loading="loadingOverview" class="overview-grid mb-4">
      <el-card shadow="hover" class="stat-card">
        <el-statistic title="总会话数" :value="overview.totalSessions">
          <template #suffix>
            <span class="text-sm text-gray-400">次</span>
          </template>
        </el-statistic>
      </el-card>

      <el-card shadow="hover" class="stat-card">
        <el-statistic
          title="已完成会话"
          :value="overview.completedSessions"
          :value-style="{ color: '#67c23a' }"
        >
          <template #suffix>
            <span class="text-sm text-gray-400">次</span>
          </template>
        </el-statistic>
        <div class="stat-extra">
          完成率: {{ completionRate }}%
        </div>
      </el-card>

      <el-card shadow="hover" class="stat-card">
        <el-statistic
          title="已应用配置"
          :value="overview.appliedConfigs"
          :value-style="{ color: '#409eff' }"
        >
          <template #suffix>
            <span class="text-sm text-gray-400">个</span>
          </template>
        </el-statistic>
        <div class="stat-extra">
          应用率: {{ applyRate }}%
        </div>
      </el-card>

      <el-card shadow="hover" class="stat-card">
        <el-statistic
          title="平均反馈分"
          :value="overview.avgFeedbackScore"
          :precision="1"
          :value-style="{ color: getScoreColor(overview.avgFeedbackScore) }"
        >
          <template #suffix>
            <span class="text-sm text-gray-400">/ 5.0</span>
          </template>
        </el-statistic>
      </el-card>

      <el-card shadow="hover" class="stat-card">
        <el-statistic
          title="今日会话"
          :value="overview.todaySessions"
          :value-style="{ color: '#e6a23c' }"
        >
          <template #suffix>
            <span class="text-sm text-gray-400">次</span>
          </template>
        </el-statistic>
      </el-card>

      <el-card shadow="hover" class="stat-card">
        <el-statistic
          title="本周会话"
          :value="overview.weekSessions"
          :value-style="{ color: '#909399' }"
        >
          <template #suffix>
            <span class="text-sm text-gray-400">次</span>
          </template>
        </el-statistic>
      </el-card>
    </div>

    <!-- Charts Section -->
    <div class="charts-grid mb-4">
      <!-- Top Industries -->
      <el-card shadow="never">
        <template #header>
          <div class="flex items-center gap-2">
            <el-icon color="#409eff"><TrendCharts /></el-icon>
            <span class="font-medium">热门行业 TOP5</span>
          </div>
        </template>
        <div v-loading="loadingOverview" class="chart-content">
          <div
            v-for="(item, index) in overview.topIndustries"
            :key="item.name"
            class="rank-item"
          >
            <div class="rank-header">
              <span class="rank-index" :class="{ 'top-rank': index < 3 }">
                {{ index + 1 }}
              </span>
              <span class="rank-name">{{ item.name }}</span>
              <span class="rank-count">{{ item.count }}次</span>
            </div>
            <el-progress
              :percentage="Math.round((item.count / maxIndustryCount) * 100)"
              :color="getProgressColor(index)"
              :show-text="false"
              :stroke-width="8"
            />
          </div>
          <el-empty
            v-if="!loadingOverview && overview.topIndustries.length === 0"
            description="暂无数据"
            :image-size="80"
          />
        </div>
      </el-card>

      <!-- Top Styles -->
      <el-card shadow="never">
        <template #header>
          <div class="flex items-center gap-2">
            <el-icon color="#67c23a"><TrendCharts /></el-icon>
            <span class="font-medium">热门风格 TOP5</span>
          </div>
        </template>
        <div v-loading="loadingOverview" class="chart-content">
          <div
            v-for="(item, index) in overview.topStyles"
            :key="item.name"
            class="rank-item"
          >
            <div class="rank-header">
              <span class="rank-index" :class="{ 'top-rank': index < 3 }">
                {{ index + 1 }}
              </span>
              <span class="rank-name">{{ item.name }}</span>
              <span class="rank-count">{{ item.count }}次</span>
            </div>
            <el-progress
              :percentage="Math.round((item.count / maxStyleCount) * 100)"
              :color="getProgressColor(index)"
              :show-text="false"
              :stroke-width="8"
            />
          </div>
          <el-empty
            v-if="!loadingOverview && overview.topStyles.length === 0"
            description="暂无数据"
            :image-size="80"
          />
        </div>
      </el-card>
    </div>

    <!-- Merchant Usage Table -->
    <el-card shadow="never">
      <template #header>
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-2">
            <el-icon color="#e6a23c"><User /></el-icon>
            <span class="font-medium">商户使用统计</span>
          </div>
          <el-button text :icon="Refresh" @click="fetchMerchantUsage">
            刷新
          </el-button>
        </div>
      </template>

      <el-table
        v-loading="loadingMerchants"
        :data="merchantUsageList"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="merchantName" label="商户名称" min-width="150">
          <template #default="{ row }">
            <span class="font-medium">{{ row.merchantName }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="totalSessions" label="总会话数" width="120" align="center">
          <template #default="{ row }">
            <span class="text-blue-500 font-medium">{{ row.totalSessions }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="completedSessions" label="已完成" width="120" align="center">
          <template #default="{ row }">
            <el-tag type="success" size="small">{{ row.completedSessions }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="appliedConfigs" label="已应用" width="120" align="center">
          <template #default="{ row }">
            <el-tag type="primary" size="small">{{ row.appliedConfigs }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="avgFeedbackScore" label="平均评分" width="150" align="center">
          <template #default="{ row }">
            <div class="score-display">
              <el-rate
                :model-value="row.avgFeedbackScore"
                disabled
                :max="5"
                :colors="['#f56c6c', '#e6a23c', '#67c23a']"
                size="small"
              />
              <span
                class="score-value"
                :style="{ color: getScoreColor(row.avgFeedbackScore) }"
              >
                {{ row.avgFeedbackScore?.toFixed(1) || '-' }}
              </span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="lastUsedTime" label="最后使用时间" min-width="180">
          <template #default="{ row }">
            <span class="text-gray-500">{{ formatDate(row.lastUsedTime) }}</span>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="!loadingMerchants && merchantUsageList.length === 0"
        description="暂无商户使用记录"
      />
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.statistics-container {
  padding: 20px;
}

.mb-4 {
  margin-bottom: 16px;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.stat-card {
  :deep(.el-card__body) {
    padding: 20px;
  }
}

.stat-extra {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 16px;
}

.chart-content {
  min-height: 200px;
}

.rank-item {
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
}

.rank-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.rank-index {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #f0f2f5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: #909399;
  margin-right: 12px;

  &.top-rank {
    background: linear-gradient(135deg, #409eff, #67c23a);
    color: white;
  }
}

.rank-name {
  flex: 1;
  font-size: 14px;
  color: #303133;
}

.rank-count {
  font-size: 14px;
  color: #909399;
  font-weight: 500;
}

.score-display {
  display: flex;
  align-items: center;
  gap: 8px;
}

.score-value {
  font-weight: 600;
  font-size: 14px;
}

.text-blue-500 {
  color: #409eff;
}

.text-gray-500 {
  color: #909399;
}

.text-gray-400 {
  color: #c0c4cc;
}

.font-medium {
  font-weight: 500;
}

.text-lg {
  font-size: 18px;
}

.text-sm {
  font-size: 12px;
}

.flex {
  display: flex;
}

.justify-between {
  justify-content: space-between;
}

.items-center {
  align-items: center;
}

.gap-2 {
  gap: 8px;
}
</style>
