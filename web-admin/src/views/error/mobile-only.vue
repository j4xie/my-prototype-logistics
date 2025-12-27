<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Iphone, Warning } from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();

// 角色名称映射
const roleNames: Record<string, string> = {
  operator: '操作员',
  quality_inspector: '质检员',
  warehouse_worker: '仓库工人'
};

const roleName = computed(() => {
  const role = route.query.role as string;
  return roleNames[role] || role || '您的角色';
});

function goToLogin() {
  router.push('/login');
}
</script>

<template>
  <div class="mobile-only-page">
    <div class="content-card">
      <!-- 图标区域 -->
      <div class="icon-container">
        <el-icon :size="80" class="mobile-icon">
          <Iphone />
        </el-icon>
        <el-icon :size="32" class="warning-badge">
          <Warning />
        </el-icon>
      </div>

      <!-- 标题 -->
      <h1 class="title">请使用移动端 App</h1>

      <!-- 说明信息 -->
      <div class="message-box">
        <p class="role-info">
          <el-tag type="info" size="large">{{ roleName }}</el-tag>
        </p>
        <p class="description">
          您的角色被设置为<strong>移动端专属</strong>，<br />
          请使用 <strong>白垩纪食品溯源 App</strong> 进行操作。
        </p>
      </div>

      <!-- 功能说明 -->
      <div class="features">
        <h3>移动端支持的功能：</h3>
        <ul>
          <li v-if="route.query.role === 'operator'">
            <el-icon><el-icon-check /></el-icon>
            生产操作记录
          </li>
          <li v-if="route.query.role === 'operator'">
            <el-icon><el-icon-check /></el-icon>
            批次扫码登记
          </li>
          <li v-if="route.query.role === 'quality_inspector'">
            <el-icon><el-icon-check /></el-icon>
            质检记录填写
          </li>
          <li v-if="route.query.role === 'quality_inspector'">
            <el-icon><el-icon-check /></el-icon>
            拍照上传
          </li>
          <li v-if="route.query.role === 'warehouse_worker'">
            <el-icon><el-icon-check /></el-icon>
            入库/出库操作
          </li>
          <li v-if="route.query.role === 'warehouse_worker'">
            <el-icon><el-icon-check /></el-icon>
            库存盘点
          </li>
          <li>
            <el-icon><el-icon-check /></el-icon>
            考勤打卡
          </li>
          <li>
            <el-icon><el-icon-check /></el-icon>
            消息通知
          </li>
        </ul>
      </div>

      <!-- 二维码区域 (占位) -->
      <div class="qr-section">
        <div class="qr-placeholder">
          <el-icon :size="48"><Iphone /></el-icon>
          <p>扫描二维码下载 App</p>
        </div>
        <p class="qr-hint">或联系管理员获取安装包</p>
      </div>

      <!-- 操作按钮 -->
      <div class="actions">
        <el-button type="primary" size="large" @click="goToLogin">
          返回登录（切换账号）
        </el-button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.mobile-only-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.content-card {
  background: white;
  border-radius: 16px;
  padding: 48px;
  max-width: 500px;
  width: 100%;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.icon-container {
  position: relative;
  display: inline-block;
  margin-bottom: 24px;

  .mobile-icon {
    color: #409eff;
  }

  .warning-badge {
    position: absolute;
    bottom: -4px;
    right: -8px;
    color: #e6a23c;
    background: white;
    border-radius: 50%;
    padding: 4px;
  }
}

.title {
  font-size: 28px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 24px 0;
}

.message-box {
  background: #f4f4f5;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 24px;

  .role-info {
    margin: 0 0 12px 0;
  }

  .description {
    margin: 0;
    font-size: 14px;
    color: #606266;
    line-height: 1.8;
  }
}

.features {
  text-align: left;
  margin-bottom: 24px;

  h3 {
    font-size: 14px;
    color: #909399;
    margin: 0 0 12px 0;
    font-weight: 500;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;

    li {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      font-size: 14px;
      color: #606266;

      .el-icon {
        color: #67c23a;
      }
    }
  }
}

.qr-section {
  margin-bottom: 32px;

  .qr-placeholder {
    width: 150px;
    height: 150px;
    border: 2px dashed #dcdfe6;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: 0 auto 12px;
    color: #909399;

    p {
      margin: 8px 0 0 0;
      font-size: 12px;
    }
  }

  .qr-hint {
    margin: 0;
    font-size: 12px;
    color: #c0c4cc;
  }
}

.actions {
  .el-button {
    width: 100%;
  }
}
</style>
