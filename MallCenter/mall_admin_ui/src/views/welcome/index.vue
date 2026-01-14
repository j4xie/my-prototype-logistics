<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import {
  DocumentCopy,
  Money,
  User,
  ShoppingCart,
  List,
  Goods,
  Grid,
  UserFilled
} from "@element-plus/icons-vue";

defineOptions({
  name: "Welcome"
});

// 注册图标组件（用于动态渲染）
const iconComponents = {
  DocumentCopy,
  Money,
  User,
  ShoppingCart
};

dayjs.locale("zh-cn");

// 当前日期
const currentDate = computed(() => {
  return dayjs().format("YYYY年MM月DD日 dddd");
});

// 当前时间段问候语
const greeting = computed(() => {
  const hour = dayjs().hour();
  if (hour < 6) return "凌晨好";
  if (hour < 9) return "早上好";
  if (hour < 12) return "上午好";
  if (hour < 14) return "中午好";
  if (hour < 17) return "下午好";
  if (hour < 19) return "傍晚好";
  return "晚上好";
});

// 统计数据（静态数据）
const statsData = ref([
  {
    title: "今日订单",
    value: 128,
    unit: "单",
    icon: "DocumentCopy",
    color: "#409EFF",
    bgColor: "rgba(64, 158, 255, 0.1)",
    trend: "+12%",
    trendUp: true
  },
  {
    title: "今日销售额",
    value: 28960,
    unit: "元",
    icon: "Money",
    color: "#67C23A",
    bgColor: "rgba(103, 194, 58, 0.1)",
    trend: "+8%",
    trendUp: true
  },
  {
    title: "注册用户",
    value: 1856,
    unit: "人",
    icon: "User",
    color: "#E6A23C",
    bgColor: "rgba(230, 162, 60, 0.1)",
    trend: "+5%",
    trendUp: true
  },
  {
    title: "在售商品",
    value: 326,
    unit: "款",
    icon: "ShoppingCart",
    color: "#F56C6C",
    bgColor: "rgba(245, 108, 108, 0.1)",
    trend: "+3",
    trendUp: true
  }
]);

// 格式化数字（添加千分位）
const formatNumber = (num: number) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// 加载动画
const loading = ref(true);

onMounted(() => {
  // 模拟加载
  setTimeout(() => {
    loading.value = false;
  }, 500);
});
</script>

<template>
  <div class="dashboard-container">
    <!-- 欢迎区域 -->
    <div class="welcome-section">
      <div class="welcome-content">
        <h1 class="welcome-title">{{ greeting }}，管理员</h1>
        <p class="welcome-date">{{ currentDate }}</p>
      </div>
      <div class="welcome-desc">
        <span>欢迎使用商城管理系统</span>
      </div>
    </div>

    <!-- 统计卡片区域 -->
    <el-row :gutter="20" class="stats-row" v-loading="loading">
      <el-col
        v-for="(item, index) in statsData"
        :key="index"
        :xs="24"
        :sm="12"
        :md="12"
        :lg="6"
      >
        <div class="stat-card" :style="{ '--card-color': item.color }">
          <div class="stat-icon" :style="{ backgroundColor: item.bgColor }">
            <el-icon :size="28" :color="item.color">
              <component :is="iconComponents[item.icon as keyof typeof iconComponents]" />
            </el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-title">{{ item.title }}</div>
            <div class="stat-value">
              <span class="value">{{ formatNumber(item.value) }}</span>
              <span class="unit">{{ item.unit }}</span>
            </div>
            <div class="stat-trend" :class="{ up: item.trendUp, down: !item.trendUp }">
              <span>{{ item.trendUp ? "较昨日" : "较昨日" }}</span>
              <span class="trend-value">{{ item.trend }}</span>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 快捷入口区域 -->
    <el-card shadow="never" class="quick-actions-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">快捷操作</span>
        </div>
      </template>
      <el-row :gutter="16">
        <el-col :xs="12" :sm="8" :md="6" :lg="4">
          <router-link to="/mall/orderInfo" class="quick-action-item">
            <el-icon :size="24" color="#409EFF"><List /></el-icon>
            <span>订单管理</span>
          </router-link>
        </el-col>
        <el-col :xs="12" :sm="8" :md="6" :lg="4">
          <router-link to="/mall/goodsSpu" class="quick-action-item">
            <el-icon :size="24" color="#67C23A"><Goods /></el-icon>
            <span>商品管理</span>
          </router-link>
        </el-col>
        <el-col :xs="12" :sm="8" :md="6" :lg="4">
          <router-link to="/mall/goodsCategory" class="quick-action-item">
            <el-icon :size="24" color="#E6A23C"><Grid /></el-icon>
            <span>分类管理</span>
          </router-link>
        </el-col>
        <el-col :xs="12" :sm="8" :md="6" :lg="4">
          <router-link to="/system/user" class="quick-action-item">
            <el-icon :size="24" color="#F56C6C"><UserFilled /></el-icon>
            <span>用户管理</span>
          </router-link>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.dashboard-container {
  padding: 20px;
  min-height: calc(100vh - 140px);
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8eb 100%);
}

// 欢迎区域
.welcome-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px;
  margin-bottom: 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: #fff;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);

  .welcome-content {
    .welcome-title {
      margin: 0 0 8px 0;
      font-size: 28px;
      font-weight: 600;
      letter-spacing: 1px;
    }

    .welcome-date {
      margin: 0;
      font-size: 14px;
      opacity: 0.85;
    }
  }

  .welcome-desc {
    font-size: 14px;
    opacity: 0.9;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 20px;
  }
}

// 统计卡片区域
.stats-row {
  margin-bottom: 24px;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 24px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  margin-bottom: 16px;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  }

  .stat-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 12px;
    flex-shrink: 0;
  }

  .stat-content {
    flex: 1;
    margin-left: 20px;

    .stat-title {
      font-size: 14px;
      color: #909399;
      margin-bottom: 8px;
    }

    .stat-value {
      display: flex;
      align-items: baseline;
      margin-bottom: 8px;

      .value {
        font-size: 28px;
        font-weight: 700;
        color: #303133;
        line-height: 1;
      }

      .unit {
        font-size: 14px;
        color: #909399;
        margin-left: 4px;
      }
    }

    .stat-trend {
      font-size: 12px;
      color: #909399;

      .trend-value {
        margin-left: 4px;
        font-weight: 600;
      }

      &.up .trend-value {
        color: #67C23A;
      }

      &.down .trend-value {
        color: #F56C6C;
      }
    }
  }
}

// 快捷操作卡片
.quick-actions-card {
  border-radius: 12px;
  border: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);

  .card-header {
    .card-title {
      font-size: 16px;
      font-weight: 600;
      color: #303133;
    }
  }

  .quick-action-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px 16px;
    background: #f5f7fa;
    border-radius: 8px;
    text-decoration: none;
    transition: all 0.3s ease;
    margin-bottom: 16px;

    &:hover {
      background: #e6f0ff;
      transform: translateY(-2px);
    }

    span {
      margin-top: 10px;
      font-size: 14px;
      color: #606266;
    }
  }
}

// 响应式调整
@media (max-width: 768px) {
  .dashboard-container {
    padding: 12px;
  }

  .welcome-section {
    flex-direction: column;
    align-items: flex-start;
    padding: 20px;

    .welcome-content {
      .welcome-title {
        font-size: 22px;
      }
    }

    .welcome-desc {
      margin-top: 16px;
    }
  }

  .stat-card {
    padding: 16px;

    .stat-icon {
      width: 48px;
      height: 48px;
    }

    .stat-content {
      margin-left: 12px;

      .stat-value .value {
        font-size: 22px;
      }
    }
  }
}
</style>
