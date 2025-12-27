<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePermissionStore } from '@/store/modules/permission';

const permissionStore = usePermissionStore();
const canWrite = computed(() => permissionStore.canWrite('system'));

// 14种工厂角色数据
const roles = ref([
  {
    id: 1,
    name: 'factory_super_admin',
    displayName: '工厂超管',
    description: '工厂最高权限，管理所有模块',
    userCount: 2,
    level: 1
  },
  {
    id: 2,
    name: 'production_manager',
    displayName: '生产经理',
    description: '管理生产计划和批次，质检统计查看',
    userCount: 3,
    level: 2
  },
  {
    id: 3,
    name: 'workshop_supervisor',
    displayName: '车间主任',
    description: '执行生产任务，管理车间设备',
    userCount: 5,
    level: 3
  },
  {
    id: 4,
    name: 'quality_manager',
    displayName: '质检主管',
    description: '管理质检标准和流程',
    userCount: 2,
    level: 2
  },
  {
    id: 5,
    name: 'quality_inspector',
    displayName: '质检员',
    description: '执行质检任务',
    userCount: 8,
    level: 4
  },
  {
    id: 6,
    name: 'warehouse_manager',
    displayName: '仓库主管',
    description: '管理仓库和库存',
    userCount: 2,
    level: 2
  },
  {
    id: 7,
    name: 'warehouse_operator',
    displayName: '仓库操作员',
    description: '执行出入库操作',
    userCount: 6,
    level: 4
  },
  {
    id: 8,
    name: 'procurement_manager',
    displayName: '采购主管',
    description: '管理供应商和采购订单',
    userCount: 2,
    level: 2
  },
  {
    id: 9,
    name: 'procurement_staff',
    displayName: '采购员',
    description: '执行采购任务',
    userCount: 4,
    level: 4
  },
  {
    id: 10,
    name: 'sales_manager',
    displayName: '销售主管',
    description: '管理客户和销售订单',
    userCount: 2,
    level: 2
  },
  {
    id: 11,
    name: 'sales_staff',
    displayName: '销售员',
    description: '执行销售任务',
    userCount: 5,
    level: 4
  },
  {
    id: 12,
    name: 'hr_manager',
    displayName: '人事主管',
    description: '管理员工和考勤',
    userCount: 2,
    level: 2
  },
  {
    id: 13,
    name: 'equipment_manager',
    displayName: '设备主管',
    description: '管理设备和维护',
    userCount: 2,
    level: 2
  },
  {
    id: 14,
    name: 'finance_manager',
    displayName: '财务主管',
    description: '管理成本和财务报表',
    userCount: 2,
    level: 2
  }
]);

function getLevelTag(level: number) {
  const types: Record<number, string> = {
    1: 'danger',
    2: 'warning',
    3: 'success',
    4: 'info'
  };
  const labels: Record<number, string> = {
    1: '超级管理',
    2: '主管级',
    3: '主任级',
    4: '员工级'
  };
  return { type: types[level], label: labels[level] };
}
</script>

<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>角色管理</span>
          <el-tag type="info">共 14 种工厂角色</el-tag>
        </div>
      </template>

      <el-table :data="roles" stripe>
        <el-table-column prop="displayName" label="角色名称" width="120" />
        <el-table-column prop="name" label="角色标识" width="180">
          <template #default="{ row }">
            <code>{{ row.name }}</code>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" />
        <el-table-column prop="level" label="级别" width="120">
          <template #default="{ row }">
            <el-tag :type="getLevelTag(row.level).type">
              {{ getLevelTag(row.level).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="userCount" label="用户数" width="100">
          <template #default="{ row }">
            <el-tag>{{ row.userCount }} 人</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default>
            <el-button type="primary" link>查看权限</el-button>
            <el-button v-if="canWrite" type="primary" link>编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card style="margin-top: 20px;">
      <template #header>
        <span>权限说明</span>
      </template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="rw">读写权限 - 可查看和修改</el-descriptions-item>
        <el-descriptions-item label="r">只读权限 - 仅可查看</el-descriptions-item>
        <el-descriptions-item label="w">只写权限 - 仅可创建</el-descriptions-item>
        <el-descriptions-item label="-">无权限 - 不可访问</el-descriptions-item>
      </el-descriptions>
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
code {
  background-color: #f5f7fa;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
}
</style>
