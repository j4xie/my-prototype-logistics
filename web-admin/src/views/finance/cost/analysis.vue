<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get } from '@/api/request';
import { ElMessage } from 'element-plus';
import { TrendCharts, Money, Document } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);

const loading = ref(false);
const costData = ref<any>(null);
const dateRange = ref<[Date, Date] | null>(null);

onMounted(() => {
  loadData();
});

async function loadData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const response = await get(`/${factoryId.value}/reports/dashboard/overview`);
    if (response.success && response.data) {
      costData.value = response.data;
    }
  } catch (error) {
    console.error('加载失败:', error);
    ElMessage.error('加载数据失败');
  } finally {
    loading.value = false;
  }
}

const statCards = computed(() => [
  {
    title: '本月总成本',
    value: costData.value?.totalCost ?? 0,
    unit: '元',
    icon: Money,
    color: '#409eff'
  },
  {
    title: '原材料成本',
    value: costData.value?.materialCost ?? 0,
    unit: '元',
    icon: Document,
    color: '#67c23a'
  },
  {
    title: '人工成本',
    value: costData.value?.laborCost ?? 0,
    unit: '元',
    icon: TrendCharts,
    color: '#e6a23c'
  }
]);
</script>

<template>
  <div class="page-container">
    <el-card class="search-card">
      <el-form inline>
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-row :gutter="20" class="stat-cards">
      <el-col v-for="card in statCards" :key="card.title" :xs="24" :sm="8">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-title">{{ card.title }}</span>
              <span class="stat-value" :style="{ color: card.color }">
                {{ card.value.toLocaleString() }}
                <small>{{ card.unit }}</small>
              </span>
            </div>
            <el-icon class="stat-icon" :style="{ backgroundColor: card.color + '20', color: card.color }">
              <component :is="card.icon" />
            </el-icon>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>成本趋势分析</span>
          </template>
          <div class="chart-placeholder">
            <el-empty description="图表加载中..." />
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>成本结构分析</span>
          </template>
          <div class="chart-placeholder">
            <el-empty description="图表加载中..." />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style lang="scss" scoped>
.page-container {
  padding: 20px;
}
.search-card {
  margin-bottom: 20px;
}
.stat-cards {
  margin-bottom: 20px;

  .stat-card {
    margin-bottom: 20px;
  }

  .stat-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .stat-info {
    display: flex;
    flex-direction: column;
  }

  .stat-title {
    font-size: 14px;
    color: #999;
    margin-bottom: 8px;
  }

  .stat-value {
    font-size: 24px;
    font-weight: 600;

    small {
      font-size: 14px;
      font-weight: 400;
      margin-left: 4px;
    }
  }

  .stat-icon {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
  }
}

.chart-placeholder {
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
