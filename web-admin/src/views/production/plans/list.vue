<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search, Refresh, VideoPlay, VideoPause, CircleCheck, CircleClose, Download, Upload, ChatDotRound } from '@element-plus/icons-vue';
import { formatDateTimeCell } from '@/utils/tableFormatters';
import {
  downloadImportTemplate,
  importProductionPlans,
  exportProductionPlans,
  getProductionLines,
  getSupervisors,
} from '@/api/productionPlan';
import AiEntryDrawer from '@/components/ai-entry/AiEntryDrawer.vue';
import { PRODUCTION_PLAN_CONFIG } from '@/components/ai-entry/types';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('production'));

const loading = ref(false);
const actionLoading = ref(false);
const tableData = ref<any[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });
const searchForm = ref({
  keyword: '',
  status: ''
});

// 新建计划对话框
const dialogVisible = ref(false);
const dialogLoading = ref(false);
const planForm = ref({
  productTypeId: '',
  plannedQuantity: 0,
  plannedDate: '',
  notes: '',
  suggestedProductionLineId: '' as string | undefined,
  estimatedWorkers: undefined as number | undefined,
  assignedSupervisorId: '' as string | undefined,
  sourceCustomerName: '',
  processName: '',
  batchDate: '',
});
const productTypes = ref<any[]>([]);

// Import/Export & reference data
const productionLines = ref<any[]>([]);
const supervisors = ref<any[]>([]);

// AI Entry Drawer
const aiEntryVisible = ref(false);

onMounted(() => {
  loadData();
  loadProductTypes();
  loadReferenceData();
});

async function loadData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const response = await get(`/${factoryId.value}/production-plans`, {
      params: {
        page: pagination.value.page,
        size: pagination.value.size,
        keyword: searchForm.value.keyword || undefined,
        status: searchForm.value.status || undefined
      }
    });
    if (response.success && response.data) {
      tableData.value = response.data.content || [];
      pagination.value.total = response.data.totalElements || 0;
    }
  } catch (error) {
    console.error('加载失败:', error);
    ElMessage.error('加载数据失败');
  } finally {
    loading.value = false;
  }
}

async function loadProductTypes() {
  if (!factoryId.value) return;
  try {
    const response = await get(`/${factoryId.value}/product-types`);
    if (response.success && response.data) {
      productTypes.value = response.data.content || response.data || [];
    }
  } catch (error) {
    console.error('加载产品类型失败:', error);
  }
}

function handleSearch() {
  pagination.value.page = 1;
  loadData();
}

function handleRefresh() {
  searchForm.value = { keyword: '', status: '' };
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
  planForm.value = {
    productTypeId: '',
    plannedQuantity: 0,
    plannedDate: '',
    notes: '',
    suggestedProductionLineId: '',
    estimatedWorkers: undefined,
    assignedSupervisorId: '',
    sourceCustomerName: '',
    processName: '',
    batchDate: '',
  };
  dialogVisible.value = true;
}

async function submitPlan() {
  if (!planForm.value.productTypeId || !planForm.value.plannedQuantity || !planForm.value.plannedDate) {
    ElMessage.warning('请填写完整信息');
    return;
  }

  dialogLoading.value = true;
  try {
    const response = await post(`/${factoryId.value}/production-plans`, planForm.value);
    if (response.success) {
      ElMessage.success('创建成功');
      dialogVisible.value = false;
      loadData();
    } else {
      ElMessage.error(response.message || '创建失败');
    }
  } catch (error) {
    ElMessage.error('创建失败');
  } finally {
    dialogLoading.value = false;
  }
}

async function handleStart(row: any) {
  if (actionLoading.value) return;
  try {
    await ElMessageBox.confirm('确定开始此生产计划?', '提示', { type: 'warning' });
    actionLoading.value = true;
    const response = await post(`/${factoryId.value}/production-plans/${row.id}/start`);
    if (response.success) {
      ElMessage.success('已开始生产');
      loadData();
    } else {
      ElMessage.error(response.message || '操作失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败');
    }
  } finally {
    actionLoading.value = false;
  }
}

async function handleComplete(row: any) {
  if (actionLoading.value) return;
  try {
    const { value } = await ElMessageBox.prompt('请输入实际产量', '完成生产', {
      inputPattern: /^\d+$/,
      inputErrorMessage: '请输入有效数量'
    });
    actionLoading.value = true;
    const response = await post(`/${factoryId.value}/production-plans/${row.id}/complete`, {
      actualQuantity: parseInt(value)
    });
    if (response.success) {
      ElMessage.success('生产已完成');
      loadData();
    } else {
      ElMessage.error(response.message || '操作失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败');
    }
  } finally {
    actionLoading.value = false;
  }
}

async function handleCancel(row: any) {
  if (actionLoading.value) return;
  try {
    const { value } = await ElMessageBox.prompt('请输入取消原因', '取消计划', {
      inputPattern: /.+/,
      inputErrorMessage: '请输入取消原因'
    });
    actionLoading.value = true;
    const response = await post(`/${factoryId.value}/production-plans/${row.id}/cancel`, {
      reason: value
    });
    if (response.success) {
      ElMessage.success('计划已取消');
      loadData();
    } else {
      ElMessage.error(response.message || '操作失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败');
    }
  } finally {
    actionLoading.value = false;
  }
}

async function handleCreateBatch(row: any) {
  if (actionLoading.value) return;
  try {
    await ElMessageBox.confirm(
      `确定将计划 "${row.planNumber}" 转为生产批次？\n\n转换后将自动创建批次并开始生产流程。`,
      '转为批次',
      { type: 'warning', confirmButtonText: '确认转换', cancelButtonText: '取消' }
    );
    actionLoading.value = true;
    const response = await post(`/${factoryId.value}/production-plans/${row.id}/create-batch`);
    if (response.success) {
      const batch = response.data;
      ElMessage.success(`批次创建成功！批次号: ${batch?.batchNumber || ''}`);
      loadData();
    } else {
      ElMessage.error(response.message || '转换失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败');
    }
  } finally {
    actionLoading.value = false;
  }
}

function isPendingStatus(status: string) {
  return status === 'PLANNED' || status === 'PENDING';
}

function getStatusType(status: string) {
  const map: Record<string, string> = {
    PLANNED: 'info',
    PENDING: 'info',
    IN_PROGRESS: 'warning',
    COMPLETED: 'success',
    CANCELLED: 'danger'
  };
  return map[status?.toUpperCase()] || 'info';
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    PLANNED: '待执行',
    PENDING: '待执行',
    IN_PROGRESS: '进行中',
    COMPLETED: '已完成',
    CANCELLED: '已取消'
  };
  return map[status?.toUpperCase()] || status;
}

// ==================== Reference Data ====================

async function loadReferenceData() {
  if (!factoryId.value) return;
  try {
    const [linesRes, supsRes] = await Promise.all([
      getProductionLines(factoryId.value),
      getSupervisors(factoryId.value),
    ]);
    if (linesRes?.data) {
      productionLines.value = Array.isArray(linesRes.data) ? linesRes.data : (linesRes.data as Record<string, unknown>).content || [];
    }
    if (supsRes?.data) {
      supervisors.value = Array.isArray(supsRes.data) ? supsRes.data : (supsRes.data as Record<string, unknown>).content || [];
    }
  } catch (e) {
    console.warn('Failed to load reference data:', e);
  }
}

// ==================== Import / Export ====================

async function handleDownloadTemplate() {
  if (!factoryId.value) return;
  try {
    const response = await downloadImportTemplate(factoryId.value);
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'production-plan-template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('模板下载成功');
  } catch {
    ElMessage.error('模板下载失败');
  }
}

async function handleImportFile(uploadFile: any) {
  if (!uploadFile?.raw) return;

  const file = uploadFile.raw;
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.warning('文件大小不能超过10MB');
    return;
  }

  try {
    if (!factoryId.value) return;
    const formData = new FormData();
    formData.append('file', file);

    const res = await importProductionPlans(factoryId.value, formData);
    if (res?.data) {
      const r = res.data;
      const failureInfo = r.failureDetails?.length
        ? '\n\n失败详情:\n' + r.failureDetails.map((f) => `第${f.rowNumber}行: ${f.reason}`).join('\n')
        : '';
      ElMessageBox.alert(
        `总计: ${r.totalCount} 条\n成功: ${r.successCount} 条\n失败: ${r.failureCount} 条` + failureInfo,
        '导入结果',
        { confirmButtonText: '确定', callback: () => loadData() }
      );
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '请检查文件格式';
    ElMessage.error('导入失败: ' + msg);
  }
}

async function handleExport() {
  if (!factoryId.value) return;
  try {
    const params: Record<string, string> = {};
    if (searchForm.value.keyword) params.keyword = searchForm.value.keyword;
    if (searchForm.value.status) params.status = searchForm.value.status;

    const response = await exportProductionPlans(factoryId.value, params);
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `生产计划_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('导出成功');
  } catch {
    ElMessage.error('导出失败');
  }
}

// ==================== AI Entry ====================

function handleAiFill(params: Record<string, unknown>) {
  // Match productTypeName to productTypeId
  const name = String(params.productTypeName || '');
  const matched = productTypes.value.find(
    (pt: Record<string, unknown>) => String(pt.name || '').includes(name) || name.includes(String(pt.name || ''))
  );

  planForm.value = {
    productTypeId: matched ? String(matched.id) : '',
    plannedQuantity: Number(params.plannedQuantity || 0),
    plannedDate: String(params.plannedDate || ''),
    notes: String(params.notes || ''),
    suggestedProductionLineId: '',
    estimatedWorkers: undefined,
    assignedSupervisorId: '',
    sourceCustomerName: String(params.sourceCustomerName || ''),
    processName: String(params.processName || ''),
    batchDate: String(params.batchDate || ''),
  };
  dialogVisible.value = true;
}
</script>

<template>
  <div class="page-wrapper">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">生产计划管理</span>
            <span class="data-count">共 {{ pagination.total }} 条记录</span>
          </div>
          <div class="header-right">
            <el-button type="success" :icon="Download" @click="handleDownloadTemplate">
              下载模板
            </el-button>
            <el-upload
              :auto-upload="false"
              :show-file-list="false"
              accept=".xlsx,.xls"
              :on-change="handleImportFile"
              style="display: inline-block; margin-left: 8px;"
            >
              <el-button type="warning" :icon="Upload">
                导入Excel
              </el-button>
            </el-upload>
            <el-button type="info" :icon="Download" @click="handleExport" style="margin-left: 8px;">
              导出Excel
            </el-button>
            <el-button type="success" :icon="ChatDotRound" @click="aiEntryVisible = true" style="margin-left: 8px;">
              AI对话创建
            </el-button>
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="handleCreate" style="margin-left: 8px;">
              新建计划
            </el-button>
          </div>
        </div>
      </template>

      <div class="search-bar">
        <el-input
          v-model="searchForm.keyword"
          placeholder="搜索计划编号/产品名称"
          :prefix-icon="Search"
          clearable
          style="width: 280px"
          @keyup.enter="handleSearch"
        />
        <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 150px">
          <el-option label="待执行" value="PLANNED" />
          <el-option label="进行中" value="IN_PROGRESS" />
          <el-option label="已完成" value="COMPLETED" />
          <el-option label="已取消" value="CANCELLED" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleRefresh">重置</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" empty-text="暂无数据" stripe border style="width: 100%">
        <el-table-column prop="planNumber" label="计划编号" width="160" />
        <el-table-column prop="productTypeName" label="产品类型" min-width="150" show-overflow-tooltip />
        <el-table-column prop="sourceCustomerName" label="客户" min-width="120" show-overflow-tooltip />
        <el-table-column prop="processName" label="工序" width="120" show-overflow-tooltip />
        <el-table-column prop="batchDate" label="批次日期" width="120" />
        <el-table-column prop="plannedQuantity" label="计划数量" width="100" align="right" />
        <el-table-column prop="actualQuantity" label="实际数量" width="100" align="right" />
        <el-table-column prop="plannedDate" label="计划日期" width="120" />
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="suggestedProductionLineName" label="建议产线" width="120" show-overflow-tooltip />
        <el-table-column prop="estimatedWorkers" label="预计工人" width="90" align="center" />
        <el-table-column prop="assignedSupervisorName" label="指派主管" width="100" show-overflow-tooltip />
        <el-table-column prop="sourceType" label="来源" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.sourceType === 'EXCEL_IMPORT'" type="warning" size="small">Excel导入</el-tag>
            <el-tag v-else-if="row.sourceType === 'AI_CHAT'" type="success" size="small">AI创建</el-tag>
            <el-tag v-else size="small">手动</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180" :formatter="formatDateTimeCell" />
        <el-table-column label="操作" width="280" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small">查看</el-button>
            <el-button
              v-if="canWrite && isPendingStatus(row.status)"
              type="warning"
              link
              size="small"
              :disabled="actionLoading"
              @click="handleCreateBatch(row)"
            >转为批次</el-button>
            <el-button
              v-if="canWrite && isPendingStatus(row.status)"
              type="success"
              link
              size="small"
              :icon="VideoPlay"
              :disabled="actionLoading"
              @click="handleStart(row)"
            >开始</el-button>
            <el-button
              v-if="canWrite && row.status === 'IN_PROGRESS'"
              type="primary"
              link
              size="small"
              :icon="CircleCheck"
              :disabled="actionLoading"
              @click="handleComplete(row)"
            >完成</el-button>
            <el-button
              v-if="canWrite && (isPendingStatus(row.status) || row.status === 'IN_PROGRESS')"
              type="danger"
              link
              size="small"
              :icon="CircleClose"
              :disabled="actionLoading"
              @click="handleCancel(row)"
            >取消</el-button>
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

    <!-- 新建计划对话框 -->
    <el-dialog v-model="dialogVisible" title="新建生产计划" width="500px">
      <el-form :model="planForm" label-width="100px">
        <el-form-item label="产品类型" required>
          <el-select v-model="planForm.productTypeId" placeholder="选择产品类型" style="width: 100%">
            <el-option
              v-for="item in productTypes"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="客户名称">
          <el-input v-model="planForm.sourceCustomerName" placeholder="如: 永佑" />
        </el-form-item>
        <el-form-item label="工序">
          <el-input v-model="planForm.processName" placeholder="如: 分切、包装" />
        </el-form-item>
        <el-form-item label="批次日期">
          <el-date-picker
            v-model="planForm.batchDate"
            type="date"
            placeholder="生产批次日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="计划数量" required>
          <el-input-number v-model="planForm.plannedQuantity" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="计划日期" required>
          <el-date-picker
            v-model="planForm.plannedDate"
            type="date"
            placeholder="选择日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="planForm.notes" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="建议产线">
          <el-select v-model="planForm.suggestedProductionLineId" clearable placeholder="可选 - 选择产线" style="width: 100%">
            <el-option v-for="line in productionLines" :key="line.id" :label="line.name" :value="line.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="预计工人数">
          <el-input-number v-model="planForm.estimatedWorkers" :min="1" :max="100" placeholder="可选" style="width: 100%" />
        </el-form-item>
        <el-form-item label="指派主管">
          <el-select v-model="planForm.assignedSupervisorId" clearable placeholder="可选 - 选择主管" style="width: 100%">
            <el-option v-for="sup in supervisors" :key="sup.id" :label="sup.fullName || sup.username" :value="sup.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dialogLoading" @click="submitPlan">确定</el-button>
      </template>
    </el-dialog>

    <!-- AI 对话创建 -->
    <AiEntryDrawer
      v-model="aiEntryVisible"
      :config="PRODUCTION_PLAN_CONFIG"
      @fill-form="handleAiFill"
    />
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
  flex-wrap: wrap;
  gap: 8px;

  .header-right {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0;
  }

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
