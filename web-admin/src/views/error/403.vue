<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

function goBack() {
  router.go(-1);
}

function goHome() {
  router.push('/dashboard');
}
</script>

<template>
  <div class="error-page">
    <div class="error-content">
      <h1 class="error-code">403</h1>
      <h2 class="error-title">访问被拒绝</h2>
      <p class="error-message">抱歉，您没有权限访问此页面。</p>
      <div class="error-actions">
        <el-button @click="goBack">返回上页</el-button>
        <el-button type="primary" @click="goHome">返回首页</el-button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.error-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}

.error-content {
  text-align: center;
  padding: 40px;

  .error-code {
    font-size: 120px;
    font-weight: 700;
    color: #409eff;
    margin: 0;
    line-height: 1;
  }

  .error-title {
    font-size: 24px;
    color: #333;
    margin: 16px 0;
  }

  .error-message {
    font-size: 14px;
    color: #999;
    margin-bottom: 32px;
  }

  .error-actions {
    display: flex;
    gap: 16px;
    justify-content: center;
  }
}
</style>
