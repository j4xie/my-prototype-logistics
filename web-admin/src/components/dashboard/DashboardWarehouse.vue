<script setup lang="ts">
/**
 * 仓储管理 Dashboard
 * 适用角色: warehouse_manager
 * 特点: 库存数据、出入库管理、预警信息
 */
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import { Box, Warning, Van, Document } from '@element-plus/icons-vue';

const router = useRouter();
const authStore = useAuthStore();

const loading = ref(false);
const factoryId = computed(() => authStore.factoryId);

// 仓储统计数据
const warehouseStats = ref({
  totalMaterials: 0,
  lowStockItems: 0,
  todayInbound: 0,
  todayOutbound: 0
});

// 统计卡片
const statCards = computed(() => [
  {
    title: '原材料批次',
    value: warehouseStats.value.totalMaterials,
    unit: '批',
    icon: Box,
    color: '#409eff',
    route: '/warehouse/materials'
  },
  {
    title: '库存预警',
    value: warehouseStats.value.lowStockItems,
    unit: '项',
    icon: Warning,
    color: '#f56c6c',
    route: '/warehouse/materials'
  },
  {
    title: '今日入库',
    value: warehouseStats.value.todayInbound,
    unit: '批',
    icon: Van,
    color: '#67c23a',
    route: '/warehouse/materials'
  },
  {
    title: '今日出库',
    value: warehouseStats.value.todayOutbound,
    unit: '批',
    icon: Van,
    color: '#e6a23c',
    route: '/warehouse/shipments'
  }
]);

// 快捷操作
const quickActions = [
  { title: '原材料批次', icon: Box, route: '/warehouse/materials', color: '#409eff' },
  { title: '出货管理', icon: Van, route: '/warehouse/shipments', color: '#67c23a' },
  { title: '盘点管理', icon: Document, route: '/warehouse/inventory', color: '#e6a23c' }
];

onMounted(async () => {
  await loadWarehouseData();
});

async function loadWarehouseData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const [materialsRes, shipmentsRes] = await Promise.allSettled([
      get<{ content: any[]; totalElements: number }>(`/${factoryId.value}/material-batches?page=1&size=1`),
      get<{ content: any[]; totalElements: number }>(`/${factoryId.value}/shipments?page=1&size=1`)
    ]);

    if (materialsRes.status === 'fulfilled' && materialsRes.value.success) {
      warehouseStats.value.totalMaterials = materialsRes.value.data?.totalElements ?? 0;
    }

    // 模拟其他数据
    warehouseStats.value.lowStockItems = Math.floor(Math.random() * 5);
    warehouseStats.value.todayInbound = Math.floor(Math.random() * 10);
    warehouseStats.value.todayOutbound = Math.floor(Math.random() * 8);
  } catch (error) {
    console.error('Failed to load warehouse data:', error);
  } finally {
    loading.value = false;
  }
}

function navigateTo(route: string) {
  router.push(route);
}
</script>

<template>
  <div class="dashboard-warehouse" v-loading="loading">
    <!-- 欢迎区 -->
    <div class="welcome-section">
      <div class="welcome-info">
        <h1>欢迎回来，{{ authStore.user?.fullName || authStore.user?.username }}</h1>
        <p>
          <el-tag type="info" size="small">仓储经理</el-tag>
          <span class="factory-info">工厂: {{ factoryId }}</span>
        </p>
      </div>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stat-cards">
      <el-col v-for="card in statCards" :key="card.title" :xs="24" :sm="12" :md="6">
        <el-card class="stat-card" shadow="hover" @click="navigateTo(card.route)">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-title">{{ card.title }}</span>
              <span class="stat-value" :style="{ color: card.color }">
                {{ card.value }}
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

    <!-- 快捷操作 -->
    <el-card class="quick-actions-card">
      <template #header>
        <span>仓储管理</span>
      </template>
      <div class="quick-actions">
        <div
          v-for="action in quickActions"
          :key="action.title"
          class="action-item"
          @click="navigateTo(action.route)"
        >
          <el-icon :size="32" :style="{ color: action.color }">
            <component :is="action.icon" />
          </el-icon>
          <span>{{ action.title }}</span>
        </div>
      </div>
    </el-card>

    <!-- 库存概览 -->
    <el-row :gutter="20">
      <el-col :xs="24" :lg="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>库存预警</span>
              <el-button type="primary" link @click="navigateTo('/warehouse/materials')">
                查看详情
              </el-button>
            </div>
          </template>
          <div class="warning-content">
            <el-empty v-if="warehouseStats.lowStockItems === 0" description="暂无库存预警" />
            <div v-else class="warning-info">
              <el-icon :size="48" color="#f56c6c"><Warning /></el-icon>
              <p>有 <strong>{{ warehouseStats.lowStockItems }}</strong> 项原材料库存不足</p>
              <el-button type="danger" @click="navigateTo('/warehouse/materials')">
                立即处理
              </el-button>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>今日出入库</span>
              <el-button type="primary" link @click="navigateTo('/warehouse/shipments')">
                查看详情
              </el-button>
            </div>
          </template>
          <div class="io-stats">
            <div class="io-item inbound">
              <span class="label">入库</span>
              <span class="value">{{ warehouseStats.todayInbound }}</span>
              <span class="unit">批</span>
            </div>
            <div class="io-item outbound">
              <span class="label">出库</span>
              <span class="value">{{ warehouseStats.todayOutbound }}</span>
              <span class="unit">批</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style lang="scss" scoped>
.dashboard-warehouse {
  min-height: calc(100vh - 144px);
}

.welcome-section {
  margin-bottom: 24px;

  h1 {
    font-size: 24px;
    color: #333;
    margin: 0 0 8px;
  }

  p {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0;
    color: #999;
    font-size: 14px;
  }
}

.stat-cards {
  margin-bottom: 24px;

  .stat-card {
    margin-bottom: 20px;
    cursor: pointer;
    transition: transform 0.2s;

    &:hover {
      transform: translateY(-2px);
    }
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
    font-size: 28px;
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

.quick-actions-card {
  margin-bottom: 24px;

  .quick-actions {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
  }

  .action-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px 24px;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background-color: #f5f7fa;
    }

    span {
      font-size: 14px;
      color: #606266;
    }
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.warning-content {
  min-height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;

  .warning-info {
    text-align: center;

    p {
      margin: 16px 0;
      font-size: 14px;
      color: #606266;

      strong {
        font-size: 18px;
        color: #f56c6c;
      }
    }
  }
}

.io-stats {
  display: flex;
  justify-content: space-around;
  padding: 20px 0;

  .io-item {
    text-align: center;

    .label {
      display: block;
      font-size: 14px;
      color: #909399;
      margin-bottom: 8px;
    }

    .value {
      font-size: 36px;
      font-weight: 600;
    }

    .unit {
      font-size: 14px;
      color: #909399;
      margin-left: 4px;
    }

    &.inbound .value {
      color: #67c23a;
    }

    &.outbound .value {
      color: #e6a23c;
    }
  }
}

.el-card {
  margin-bottom: 20px;
}
</style>
