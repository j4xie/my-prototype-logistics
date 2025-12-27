<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('warehouse'));

const loading = ref(false);
</script>

<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <span>库存盘点</span>
      </template>
      <el-empty description="功能开发中..." />
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.page-container {
  padding: 20px;
}
</style>
