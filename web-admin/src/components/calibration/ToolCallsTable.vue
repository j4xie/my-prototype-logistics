<script setup lang="ts">
/**
 * ToolCallsTable - 工具调用记录表组件
 * 显示最近的工具调用记录，支持筛选和分页
 */
import { ref, computed, watch } from 'vue';
import { Search, Refresh, View } from '@element-plus/icons-vue';
import type { ToolCallRecord } from '@/types/calibration';

interface Props {
  data: ToolCallRecord[];
  loading?: boolean;
  total?: number;
  initialPageSize?: number;
  initialPage?: number;
  showFilters?: boolean;
  showPagination?: boolean;
  toolOptions?: Array<{ label: string; value: string }>;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  total: 0,
  initialPageSize: 10,
  initialPage: 1,
  showFilters: true,
  showPagination: true,
  toolOptions: () => []
});

// 本地分页状态
const currentPage = ref(props.initialPage);
const pageSize = ref(props.initialPageSize);

const emit = defineEmits<{
  (e: 'pageChange', page: number): void;
  (e: 'sizeChange', size: number): void;
  (e: 'filter', filters: { status?: string; toolCode?: string }): void;
  (e: 'refresh'): void;
  (e: 'viewDetail', record: ToolCallRecord): void;
}>();

// 筛选状态
const filterStatus = ref<string>('');
const filterTool = ref<string>('');

// 状态选项
const statusOptions = [
  { label: '全部状态', value: '' },
  { label: '成功', value: 'success' },
  { label: '失败', value: 'failed' },
  { label: '超时', value: 'timeout' },
  { label: '已取消', value: 'cancelled' }
];

// 状态样式映射
const statusConfig: Record<string, { type: 'success' | 'danger' | 'warning' | 'info'; text: string }> = {
  success: { type: 'success', text: '成功' },
  failed: { type: 'danger', text: '失败' },
  timeout: { type: 'warning', text: '超时' },
  cancelled: { type: 'info', text: '已取消' }
};

// 格式化持续时间
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

// 格式化时间
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  // 今天的显示时分秒
  if (diffMins < 60 * 24 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  // 其他显示日期时间
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 处理筛选变化
function handleFilterChange() {
  emit('filter', {
    status: filterStatus.value || undefined,
    toolCode: filterTool.value || undefined
  });
}

// 处理分页变化
function handlePageChange(page: number) {
  currentPage.value = page;
  emit('pageChange', page);
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  currentPage.value = 1; // 重置到第一页
  emit('sizeChange', size);
}

// 处理刷新
function handleRefresh() {
  emit('refresh');
}

// 查看详情
function handleViewDetail(record: ToolCallRecord) {
  emit('viewDetail', record);
}

// 监听筛选变化
watch([filterStatus, filterTool], handleFilterChange);
</script>

<template>
  <div class="tool-calls-table">
    <!-- 筛选栏 -->
    <div v-if="showFilters" class="filter-bar">
      <div class="filter-left">
        <el-select
          v-model="filterStatus"
          placeholder="状态"
          clearable
          style="width: 120px"
        >
          <el-option
            v-for="opt in statusOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <el-select
          v-if="toolOptions.length > 0"
          v-model="filterTool"
          placeholder="工具"
          clearable
          filterable
          style="width: 160px"
        >
          <el-option
            v-for="opt in toolOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </div>
      <div class="filter-right">
        <el-button :icon="Refresh" @click="handleRefresh">刷新</el-button>
      </div>
    </div>

    <!-- 表格 -->
    <el-table
      :data="data"
      :loading="loading"
      stripe
      style="width: 100%"
      :header-cell-style="{ background: '#fafafa', color: '#606266' }"
    >
      <el-table-column label="工具" min-width="160">
        <template #default="{ row }">
          <div class="tool-cell">
            <span class="tool-name">{{ row.toolName }}</span>
            <span class="tool-code">{{ row.toolCode }}</span>
          </div>
        </template>
      </el-table-column>

      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag
            :type="statusConfig[row.status]?.type || 'info'"
            size="small"
          >
            {{ statusConfig[row.status]?.text || row.status }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column label="耗时" width="100" align="right">
        <template #default="{ row }">
          <span class="duration" :class="{ 'duration-slow': row.duration > 5000 }">
            {{ formatDuration(row.duration) }}
          </span>
        </template>
      </el-table-column>

      <el-table-column label="意图" min-width="140">
        <template #default="{ row }">
          <span v-if="row.intentName" class="intent-name">{{ row.intentName }}</span>
          <span v-else class="no-intent">-</span>
        </template>
      </el-table-column>

      <el-table-column label="用户" width="100">
        <template #default="{ row }">
          <span v-if="row.userName">{{ row.userName }}</span>
          <span v-else class="no-user">系统</span>
        </template>
      </el-table-column>

      <el-table-column label="时间" width="120" align="right">
        <template #default="{ row }">
          <span class="timestamp">{{ formatTime(row.timestamp) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="操作" width="70" align="center" fixed="right">
        <template #default="{ row }">
          <el-button
            type="primary"
            link
            :icon="View"
            @click="handleViewDetail(row)"
          >
            详情
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div v-if="showPagination && total > 0" class="pagination-wrapper">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && data.length === 0" class="empty-state">
      <el-empty description="暂无调用记录" :image-size="80" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.tool-calls-table {
  width: 100%;

  .filter-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    .filter-left {
      display: flex;
      gap: 12px;
    }
  }

  .tool-cell {
    .tool-name {
      display: block;
      font-size: 14px;
      color: #303133;
      font-weight: 500;
    }

    .tool-code {
      display: block;
      font-size: 12px;
      color: #909399;
      margin-top: 2px;
    }
  }

  .duration {
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 13px;
    color: #606266;

    &.duration-slow {
      color: #e6a23c;
    }
  }

  .intent-name {
    font-size: 13px;
    color: #606266;
  }

  .no-intent,
  .no-user {
    color: #c0c4cc;
    font-size: 13px;
  }

  .timestamp {
    font-size: 12px;
    color: #909399;
  }

  .pagination-wrapper {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }

  .empty-state {
    padding: 40px 0;
  }
}

// 响应式
@media (max-width: 768px) {
  .tool-calls-table {
    .filter-bar {
      flex-direction: column;
      gap: 12px;

      .filter-left,
      .filter-right {
        width: 100%;
      }

      .filter-left {
        flex-wrap: wrap;

        .el-select {
          width: 100% !important;
        }
      }
    }
  }
}
</style>
