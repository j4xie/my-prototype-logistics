<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post } from '@/api/request';
import { ElMessage } from 'element-plus';
import { Plus, Search, Refresh } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('quality'));

const loading = ref(false);
const submitting = ref(false);
const tableData = ref<any[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });
const searchKeyword = ref('');
const filterResult = ref('');

// 新建对话框
const dialogVisible = ref(false);
const dialogForm = ref({
  batchNumber: '',
  productTypeId: '',
  notes: ''
});

// 详情抽屉
const detailVisible = ref(false);
const detailData = ref<any>(null);

onMounted(() => {
  loadData();
});

async function loadData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const response = await get(`/${factoryId.value}/processing/quality/inspections`, {
      params: {
        page: pagination.value.page,
        size: pagination.value.size,
        keyword: searchKeyword.value || undefined,
        result: filterResult.value || undefined
      }
    });
    if (response.success && response.data) {
      tableData.value = response.data.content || [];
      pagination.value.total = response.data.totalElements || 0;
    } else if (response.success === false) {
      ElMessage.error(response.message || '加载质检记录失败');
    }
  } catch (error) {
    console.error('加载失败:', error);
    ElMessage.error('加载数据失败');
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pagination.value.page = 1;
  loadData();
}

function handleRefresh() {
  searchKeyword.value = '';
  filterResult.value = '';
  pagination.value.page = 1;
  loadData();
}

function handlePageChange(page: number) {
  pagination.value.page = page;
  loadData();
}

function handleSizeChange(size: number) {
  pagination.value.size = size;
  pagination.value.page = 1;
  loadData();
}

function handleCreate() {
  dialogForm.value = { batchNumber: '', productTypeId: '', notes: '' };
  dialogVisible.value = true;
}

async function submitCreateForm() {
  if (!dialogForm.value.batchNumber) {
    ElMessage.warning('请输入批次号');
    return;
  }
  submitting.value = true;
  try {
    const response = await post(`/${factoryId.value}/processing/quality/inspections`, dialogForm.value);
    if (response.success) {
      ElMessage.success('质检记录已创建');
      dialogVisible.value = false;
      loadData();
    } else {
      ElMessage.error(response.message || '创建失败');
    }
  } catch {
    ElMessage.error('创建失败，请检查网络连接');
  } finally {
    submitting.value = false;
  }
}

function showDetail(row: any) {
  detailData.value = row;
  detailVisible.value = true;
}
</script>

<template>
  <div class="page-wrapper">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">质检记录管理</span>
            <span class="data-count">共 {{ pagination.total }} 条记录</span>
          </div>
          <div class="header-right">
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="handleCreate">新建质检</el-button>
          </div>
        </div>
      </template>

      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索质检编号/批次号"
          :prefix-icon="Search"
          clearable
          style="width: 280px"
          @keyup.enter="handleSearch"
        />
        <el-select v-model="filterResult" placeholder="检测结果" clearable style="width: 150px">
          <el-option label="合格" value="PASSED" />
          <el-option label="不合格" value="FAILED" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleRefresh">重置</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" empty-text="暂无数据" stripe border style="width: 100%">
        <el-table-column label="质检编号" width="160">
          <template #default="{ row }">
            {{ row.id ? row.id.substring(0, 8).toUpperCase() : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="notes" label="批次/备注" min-width="180" show-overflow-tooltip />
        <el-table-column prop="sampleSize" label="抽样数" width="90" align="center" />
        <el-table-column prop="inspectorId" label="质检员ID" width="100" align="center" />
        <el-table-column prop="result" label="检测结果" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.result === 'PASSED' ? 'success' : 'danger'" size="small">
              {{ row.result === 'PASSED' ? '合格' : '不合格' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="qualityGrade" label="等级" width="70" align="center" />
        <el-table-column label="合格率" width="90" align="center">
          <template #default="{ row }">
            {{ row.passRate != null ? row.passRate.toFixed(1) + '%' : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="inspectionDate" label="检测日期" width="130" />
        <el-table-column label="操作" width="120" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="showDetail(row)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <!-- 新建质检对话框 -->
    <el-dialog v-model="dialogVisible" title="新建质检记录" width="480px" :close-on-click-modal="false">
      <el-form :model="dialogForm" label-width="90px">
        <el-form-item label="批次号" required>
          <el-input v-model="dialogForm.batchNumber" placeholder="输入生产批次号" />
        </el-form-item>
        <el-form-item label="产品类型">
          <el-input v-model="dialogForm.productTypeId" placeholder="产品类型ID（可选）" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="dialogForm.notes" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitCreateForm">确定</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" title="质检记录详情" size="420px">
      <el-descriptions :column="1" border v-if="detailData">
        <el-descriptions-item label="质检编号">{{ detailData.id ? detailData.id.substring(0, 8).toUpperCase() : '-' }}</el-descriptions-item>
        <el-descriptions-item label="批次/备注">{{ detailData.notes || '-' }}</el-descriptions-item>
        <el-descriptions-item label="抽样数">{{ detailData.sampleSize ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="质检员ID">{{ detailData.inspectorId ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="检测结果">
          <el-tag :type="detailData.result === 'PASSED' ? 'success' : 'danger'" size="small">
            {{ detailData.result === 'PASSED' ? '合格' : '不合格' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="等级">{{ detailData.qualityGrade || '-' }}</el-descriptions-item>
        <el-descriptions-item label="合格率">{{ detailData.passRate != null ? detailData.passRate.toFixed(1) + '%' : '-' }}</el-descriptions-item>
        <el-descriptions-item label="检测日期">{{ detailData.inspectionDate || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </div>
</template>

<style lang="scss" scoped>
.page-wrapper {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.page-card {
  flex: 1;
  display: flex;
  flex-direction: column;

  :deep(.el-card__header) {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color-lighter, #ebeef5);
  }

  :deep(.el-card__body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 20px;
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .header-left {
    display: flex;
    align-items: baseline;
    gap: 12px;

    .page-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color-primary, #303133);
    }

    .data-count {
      font-size: 13px;
      color: var(--text-color-secondary, #909399);
    }
  }
}

.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.el-table {
  flex: 1;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid var(--border-color-lighter, #ebeef5);
  margin-top: 16px;
}
</style>
