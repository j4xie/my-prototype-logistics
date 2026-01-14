<!--
  Dashboard - 仪表盘概览 (简化版)
-->
<template>
  <div class="dashboard-container">
    <el-card>
      <template #header>
        <span>欢迎使用管理后台</span>
      </template>
      <div class="welcome-content">
        <h2>欢迎回来，{{ username }}</h2>
        <p>{{ currentDate }}</p>
        <el-divider />
        <el-row :gutter="20">
          <el-col :span="6">
            <el-statistic title="今日订单" :value="128" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="今日销售额" :value="28650.80" prefix="¥" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="注册用户" :value="3256" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="在售商品" :value="186" />
          </el-col>
        </el-row>
      </div>
    </el-card>
  </div>
</template>

<script setup name="Dashboard">
import { computed } from 'vue'
import { useUserStore } from '@/store/modules/user'

const userStore = useUserStore()

// 用户名
const username = computed(() => userStore.name || '管理员')

// 当前日期
const currentDate = computed(() => {
  const now = new Date()
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${weekDays[now.getDay()]}`
})
</script>

<style lang="scss" scoped>
.dashboard-container {
  padding: 20px;
}
.welcome-content {
  text-align: center;
  h2 {
    margin-bottom: 10px;
    color: #303133;
  }
  p {
    color: #909399;
  }
}
</style>
