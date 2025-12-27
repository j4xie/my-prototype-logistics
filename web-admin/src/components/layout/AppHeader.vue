<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAppStore } from '@/store/modules/app';
import { useAuthStore } from '@/store/modules/auth';
import { ElMessageBox, ElMessage } from 'element-plus';
import { Fold, Expand, User, SwitchButton, Refresh } from '@element-plus/icons-vue';

const router = useRouter();
const route = useRoute();
const appStore = useAppStore();
const authStore = useAuthStore();

// 面包屑
const breadcrumbs = computed(() => {
  const matched = route.matched.filter(r => r.meta.title);
  return matched.map(r => ({
    path: r.path,
    title: r.meta.title as string
  }));
});

// 用户信息
const userInfo = computed(() => ({
  name: authStore.user?.fullName || authStore.user?.username || '用户',
  role: authStore.roleMetadata?.displayName || '未知角色',
  factoryId: authStore.factoryId
}));

// 切换侧边栏
function toggleSidebar() {
  appStore.toggleSidebar();
}

// 刷新页面
function handleRefresh() {
  router.go(0);
}

// 退出登录
async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });

    await authStore.logout();
    ElMessage.success('已退出登录');
    router.push('/login');
  } catch (e) {
    // 用户取消
  }
}
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <!-- 折叠按钮 -->
      <el-icon class="collapse-btn" @click="toggleSidebar">
        <Fold v-if="!appStore.sidebarCollapsed" />
        <Expand v-else />
      </el-icon>

      <!-- 面包屑 -->
      <el-breadcrumb separator="/">
        <el-breadcrumb-item
          v-for="item in breadcrumbs"
          :key="item.path"
          :to="item.path"
        >
          {{ item.title }}
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="header-right">
      <!-- 刷新按钮 -->
      <el-tooltip content="刷新页面" placement="bottom">
        <el-icon class="header-action" @click="handleRefresh">
          <Refresh />
        </el-icon>
      </el-tooltip>

      <!-- 用户下拉菜单 -->
      <el-dropdown trigger="click">
        <div class="user-info">
          <el-avatar :size="32" :icon="User" />
          <div class="user-detail">
            <span class="user-name">{{ userInfo.name }}</span>
            <span class="user-role">{{ userInfo.role }}</span>
          </div>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-if="userInfo.factoryId">
              <el-icon><Box /></el-icon>
              工厂: {{ userInfo.factoryId }}
            </el-dropdown-item>
            <el-dropdown-item divided @click="handleLogout">
              <el-icon><SwitchButton /></el-icon>
              退出登录
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.app-header {
  height: 64px;
  background-color: #fff;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  position: sticky;
  top: 0;
  z-index: 99;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;

  .collapse-btn {
    font-size: 20px;
    cursor: pointer;
    color: #666;
    transition: color 0.2s;

    &:hover {
      color: #1890ff;
    }
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;

  .header-action {
    font-size: 18px;
    cursor: pointer;
    color: #666;
    padding: 8px;
    border-radius: 4px;
    transition: all 0.2s;

    &:hover {
      background-color: #f5f5f5;
      color: #1890ff;
    }
  }
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;

  &:hover {
    background-color: #f5f5f5;
  }

  .user-detail {
    display: flex;
    flex-direction: column;
    line-height: 1.3;

    .user-name {
      font-size: 14px;
      color: #333;
    }

    .user-role {
      font-size: 12px;
      color: #999;
    }
  }
}
</style>
