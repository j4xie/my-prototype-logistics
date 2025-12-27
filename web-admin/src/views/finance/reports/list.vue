<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePermissionStore } from '@/store/modules/permission';
import { Document, Download } from '@element-plus/icons-vue';

const permissionStore = usePermissionStore();
const canWrite = computed(() => permissionStore.canWrite('finance'));

const reports = ref([
  { id: 1, name: '月度财务报表', type: 'MONTHLY', lastGenerated: '2025-12-01', status: 'AVAILABLE' },
  { id: 2, name: '成本分析报告', type: 'COST', lastGenerated: '2025-12-15', status: 'AVAILABLE' },
  { id: 3, name: '季度预算报告', type: 'QUARTERLY', lastGenerated: '2025-10-01', status: 'AVAILABLE' }
]);
</script>

<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>财务报表</span>
          <el-button v-if="canWrite" type="primary" :icon="Document">生成报表</el-button>
        </div>
      </template>

      <el-table :data="reports" stripe>
        <el-table-column prop="name" label="报表名称" />
        <el-table-column prop="type" label="类型">
          <template #default="{ row }">
            <el-tag>{{ getTypeText(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lastGenerated" label="生成时间" />
        <el-table-column prop="status" label="状态">
          <template #default="{ row }">
            <el-tag type="success">{{ row.status === 'AVAILABLE' ? '可下载' : '生成中' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default>
            <el-button type="primary" link :icon="Download">下载</el-button>
            <el-button type="primary" link>查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script lang="ts">
function getTypeText(type: string) {
  const map: Record<string, string> = {
    MONTHLY: '月报',
    QUARTERLY: '季报',
    COST: '成本分析',
    ANNUAL: '年报'
  };
  return map[type] || type;
}
</script>

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
