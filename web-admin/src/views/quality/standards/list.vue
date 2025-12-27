<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePermissionStore } from '@/store/modules/permission';
import { Plus } from '@element-plus/icons-vue';

const permissionStore = usePermissionStore();
const canWrite = computed(() => permissionStore.canWrite('quality'));
</script>

<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>质检标准管理</span>
          <el-button v-if="canWrite" type="primary" :icon="Plus">新建标准</el-button>
        </div>
      </template>
      <el-empty description="功能开发中..." />
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.page-container {
  padding: 20px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
