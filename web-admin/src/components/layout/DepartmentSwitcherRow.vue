<script setup lang="ts">
import { computed } from 'vue';

/**
 * Sprint 4 W1 U-DEPT-1: 部门切换 button row.
 *
 * 用于多部门用户在 HomeScreen / 列表顶部快速切换当前活跃部门. 横向 chip 行,
 * 当前部门高亮. 1 个部门时自动隐藏 (无切换价值).
 *
 * v-model 用法:
 *   <DepartmentSwitcherRow v-model="activeDeptId" :departments="depts" />
 *
 *   const depts = [
 *     { id: 'd1', name: '生产部' },
 *     { id: 'd2', name: '采购部' },
 *     { id: 'd3', name: '销售部' },
 *   ];
 */
export interface DeptOption {
  id: string;
  name: string;
  /** 可选 badge 数 (待办数等) */
  badge?: number;
}

const props = withDefaults(
  defineProps<{
    modelValue: string | null;
    departments: DeptOption[];
    /** 是否单部门时也渲染 (默认隐藏) */
    showWhenSingle?: boolean;
    /** "全部" 选项 label, 传空串则不渲染全部按钮 */
    allLabel?: string;
  }>(),
  {
    showWhenSingle: false,
    allLabel: '全部',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
  change: [value: string | null];
}>();

const visible = computed(
  () => props.showWhenSingle || props.departments.length > 1,
);

function select(id: string | null) {
  emit('update:modelValue', id);
  emit('change', id);
}

function isActive(id: string | null): boolean {
  return props.modelValue === id;
}
</script>

<template>
  <div v-if="visible" class="dept-switcher" role="tablist">
    <button
      v-if="allLabel"
      type="button"
      role="tab"
      class="dept-chip"
      :class="{ 'dept-chip--active': isActive(null) }"
      :aria-selected="isActive(null)"
      @click="select(null)"
    >
      {{ allLabel }}
    </button>
    <button
      v-for="dept in departments"
      :key="dept.id"
      type="button"
      role="tab"
      class="dept-chip"
      :class="{ 'dept-chip--active': isActive(dept.id) }"
      :aria-selected="isActive(dept.id)"
      @click="select(dept.id)"
    >
      {{ dept.name }}
      <span v-if="dept.badge && dept.badge > 0" class="dept-chip__badge">{{ dept.badge }}</span>
    </button>
  </div>
</template>

<style lang="scss" scoped>
.dept-switcher {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 0 12px;
  align-items: center;
}

.dept-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  height: 32px;
  border-radius: 16px;
  border: 1px solid var(--el-border-color, #dcdfe6);
  background-color: #fff;
  color: var(--el-text-color-regular, #606266);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;

  &:hover {
    border-color: var(--el-color-primary, #409eff);
    color: var(--el-color-primary, #409eff);
  }

  &--active {
    background-color: var(--el-color-primary, #409eff);
    border-color: var(--el-color-primary, #409eff);
    color: #fff;

    &:hover {
      color: #fff;
    }
  }
}

.dept-chip__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background-color: var(--el-color-danger, #f56c6c);
  color: #fff;
  font-size: 11px;
  line-height: 1;
}

.dept-chip--active .dept-chip__badge {
  background-color: #fff;
  color: var(--el-color-primary, #409eff);
}
</style>
