<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post, put, del } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search, Refresh, Download, Upload, Picture, ChatDotRound, Setting, Rank, Delete as DeleteIcon } from '@element-plus/icons-vue';
import AiEntryDrawer from '@/components/ai-entry/AiEntryDrawer.vue';
import { PRODUCT_CONFIG } from '@/components/ai-entry/types';
import {
  getActiveWorkProcesses,
  getProductWorkProcesses,
  createProductWorkProcess,
  deleteProductWorkProcess,
  batchSortProductWorkProcesses,
  type WorkProcessItem,
  type ProductWorkProcessItem,
} from '@/api/processProduction';

// 产品分类定义
const PRODUCT_CATEGORIES = [
  { value: 'FINISHED_PRODUCT', label: '成品' },
  { value: 'RAW_MATERIAL', label: '原料' },
  { value: 'PACKAGING', label: '包辅材' },
  { value: 'SEASONING', label: '调味品' },
  { value: 'CUSTOMER_MATERIAL', label: '客户自带原料加工' }
] as const;

type ProductCategory = typeof PRODUCT_CATEGORIES[number]['value'];

// 产品类型接口
interface ProductType {
  id: string;
  code: string;
  name: string;
  category?: string;
  productCategory?: ProductCategory;
  unit: string;
  specification?: string;
  relatedCustomer?: string;
  imageUrl?: string;
  notes?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('system'));

// 状态
const loading = ref(false);
const tableData = ref<ProductType[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });
const searchKeyword = ref('');
const activeTab = ref<ProductCategory>('FINISHED_PRODUCT');

// 弹窗状态
const dialogVisible = ref(false);
const dialogTitle = ref('新增产品');
const isEditing = ref(false);
const formRef = ref();
const submitting = ref(false);

// 表单数据
const formData = reactive<Partial<ProductType>>({
  id: '',
  code: '',
  name: '',
  productCategory: 'FINISHED_PRODUCT',
  unit: '',
  specification: '',
  relatedCustomer: '',
  imageUrl: '',
  notes: ''
});

// 表单验证规则
const formRules = {
  code: [
    { max: 50, message: '产品编号不能超过50个字符', trigger: 'blur' }
  ],
  name: [
    { required: true, message: '请输入产品名称', trigger: 'blur' },
    { max: 100, message: '产品名称不能超过100个字符', trigger: 'blur' }
  ],
  unit: [
    { required: true, message: '请输入单位', trigger: 'blur' },
    { max: 20, message: '单位不能超过20个字符', trigger: 'blur' }
  ],
  productCategory: [
    { required: true, message: '请选择产品大类', trigger: 'change' }
  ]
};

onMounted(() => {
  loadData();
});

async function loadData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const response = await get<{ content: ProductType[]; totalElements: number }>(`/${factoryId.value}/product-types`, {
      params: {
        page: pagination.value.page,
        size: pagination.value.size,
        keyword: searchKeyword.value || undefined,
        productCategory: activeTab.value
      }
    });
    if (response.success && response.data) {
      tableData.value = response.data.content || [];
      pagination.value.total = response.data.totalElements || 0;
    } else if (response.success === false) {
      ElMessage.error(response.message || '加载数据失败');
    }
  } catch (error) {
    console.error('加载失败:', error);
    ElMessage.error('加载数据失败');
  } finally {
    loading.value = false;
  }
}

function handleTabChange(tab: ProductCategory) {
  activeTab.value = tab;
  pagination.value.page = 1;
  loadData();
}

function handleSearch() {
  pagination.value.page = 1;
  loadData();
}

function handleRefresh() {
  searchKeyword.value = '';
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

function resetForm() {
  formData.id = '';
  formData.code = '';
  formData.name = '';
  formData.productCategory = activeTab.value;
  formData.unit = '';
  formData.specification = '';
  formData.relatedCustomer = '';
  formData.imageUrl = '';
  formData.notes = '';
}

function handleAdd() {
  resetForm();
  dialogTitle.value = '新增产品';
  isEditing.value = false;
  dialogVisible.value = true;
}

function handleEdit(row: ProductType) {
  dialogTitle.value = '编辑产品';
  isEditing.value = true;
  formData.id = row.id;
  formData.code = row.code;
  formData.name = row.name;
  formData.productCategory = row.productCategory || activeTab.value;
  formData.unit = row.unit;
  formData.specification = row.specification || '';
  formData.relatedCustomer = row.relatedCustomer || '';
  formData.imageUrl = row.imageUrl || '';
  formData.notes = row.notes || '';
  dialogVisible.value = true;
}

async function handleDelete(row: ProductType) {
  try {
    await ElMessageBox.confirm(
      `确定要删除产品 "${row.name}" 吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const response = await del(`/${factoryId.value}/product-types/${row.id}`);
    if (response.success) {
      ElMessage.success('删除成功');
      loadData();
    } else {
      ElMessage.error(response.message || '删除失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error);
      ElMessage.error('删除失败');
    }
  }
}

async function handleSubmit() {
  if (!formRef.value) return;

  try {
    await formRef.value.validate();
    submitting.value = true;

    const payload = {
      code: formData.code,
      name: formData.name,
      productCategory: formData.productCategory,
      unit: formData.unit,
      specification: formData.specification,
      relatedCustomer: formData.relatedCustomer,
      imageUrl: formData.imageUrl,
      notes: formData.notes,
      isActive: true
    };

    let response;
    if (isEditing.value) {
      response = await put(`/${factoryId.value}/product-types/${formData.id}`, payload);
    } else {
      response = await post(`/${factoryId.value}/product-types`, payload);
    }

    if (response.success) {
      ElMessage.success(isEditing.value ? '编辑成功' : '新增成功');
      dialogVisible.value = false;
      loadData();
    } else {
      ElMessage.error(response.message || '提交失败');
    }
  } catch (error) {
    console.error('提交失败:', error);
    ElMessage.error('提交失败');
  } finally {
    submitting.value = false;
  }
}

function handleExport() {
  if (tableData.value.length === 0) {
    ElMessage.warning('暂无数据可导出');
    return;
  }
  const headers = ['产品编号', '产品名称', '分类', '单位', '规格', '关联客户', '状态', '备注'];
  const rows = tableData.value.map((row: ProductType) => [
    row.code || '',
    row.name || '',
    getCategoryLabel(row.productCategory || row.category),
    row.unit || '',
    row.specification || '',
    row.relatedCustomer || '',
    row.isActive ? '启用' : '停用',
    row.notes || ''
  ]);
  const csvContent = '\uFEFF' + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `产品列表_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  ElMessage.success('导出成功');
}

function handleImport() {
  ElMessage.info('请使用 Excel 上传功能批量导入产品');
}

function getCategoryLabel(value?: string) {
  const category = PRODUCT_CATEGORIES.find(c => c.value === value);
  return category?.label || value || '-';
}

// ==================== 工序配置抽屉 ====================
const processDrawerVisible = ref(false);
const processDrawerProduct = ref<ProductType | null>(null);
const availableProcesses = ref<WorkProcessItem[]>([]);
const linkedProcesses = ref<ProductWorkProcessItem[]>([]);
const processLoading = ref(false);
const addingProcessId = ref('');

async function handleConfigProcesses(row: ProductType) {
  processDrawerProduct.value = row;
  processDrawerVisible.value = true;
  processLoading.value = true;
  try {
    const [activeRes, linkedRes] = await Promise.all([
      getActiveWorkProcesses(factoryId.value!),
      getProductWorkProcesses(factoryId.value!, row.id),
    ]);
    availableProcesses.value = (activeRes.success ? (Array.isArray(activeRes.data) ? activeRes.data : []) : []) as WorkProcessItem[];
    linkedProcesses.value = (linkedRes.success ? (Array.isArray(linkedRes.data) ? linkedRes.data : []) : []) as ProductWorkProcessItem[];
  } catch {
    ElMessage.error('加载工序配置失败');
  } finally {
    processLoading.value = false;
  }
}

const unlinkedProcesses = computed(() => {
  const linkedIds = new Set(linkedProcesses.value.map(lp => lp.workProcessId));
  return availableProcesses.value.filter(p => !linkedIds.has(p.id));
});

async function handleAddProcess(processId: string) {
  if (!processDrawerProduct.value) return;
  addingProcessId.value = processId;
  try {
    const nextOrder = linkedProcesses.value.length + 1;
    const res = await createProductWorkProcess(factoryId.value!, {
      productTypeId: processDrawerProduct.value.id,
      workProcessId: processId,
      processOrder: nextOrder,
    });
    if (res.success) {
      await refreshLinkedProcesses();
      ElMessage.success('已关联');
    } else {
      ElMessage.error(res.message || '关联失败');
    }
  } catch {
    ElMessage.error('关联失败');
  } finally {
    addingProcessId.value = '';
  }
}

async function handleRemoveProcess(item: ProductWorkProcessItem) {
  try {
    await ElMessageBox.confirm(`确定取消关联工序「${item.processName}」？`, '提示', { type: 'warning' });
    const res = await deleteProductWorkProcess(factoryId.value!, item.id);
    if (res.success) {
      await refreshLinkedProcesses();
      ElMessage.success('已取消关联');
    }
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('操作失败');
  }
}

async function handleMoveProcess(index: number, direction: 'up' | 'down') {
  const list = [...linkedProcesses.value];
  const swapIdx = direction === 'up' ? index - 1 : index + 1;
  if (swapIdx < 0 || swapIdx >= list.length) return;
  [list[index], list[swapIdx]] = [list[swapIdx], list[index]];
  const sortItems = list.map((item, i) => ({ id: item.id, processOrder: i + 1 }));
  try {
    await batchSortProductWorkProcesses(factoryId.value!, sortItems);
    await refreshLinkedProcesses();
  } catch {
    ElMessage.error('排序失败');
  }
}

async function refreshLinkedProcesses() {
  if (!processDrawerProduct.value) return;
  const res = await getProductWorkProcesses(factoryId.value!, processDrawerProduct.value.id);
  linkedProcesses.value = (res.success ? (Array.isArray(res.data) ? res.data : []) : []) as ProductWorkProcessItem[];
}

// ==================== AI Entry ====================
const aiEntryVisible = ref(false);

function handleAiFill(params: Record<string, unknown>) {
  formData.name = String(params.name || '');
  formData.productCategory = (String(params.productCategory || activeTab.value)) as ProductCategory;
  formData.unit = String(params.unit || '');
  formData.specification = String(params.specification || '');
  formData.relatedCustomer = String(params.relatedCustomer || '');
  formData.notes = String(params.notes || '');
  formData.id = '';
  formData.code = '';
  formData.imageUrl = '';
  dialogTitle.value = '新增产品 (AI 填充)';
  isEditing.value = false;
  dialogVisible.value = true;
}
</script>

<template>
  <div class="page-wrapper">
    <el-card class="page-card" shadow="never">
      <!-- 页面标题和操作 -->
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">产品信息管理</span>
            <span class="data-count">共 {{ pagination.total }} 条记录</span>
          </div>
          <div class="header-right">
            <el-button :icon="Download" @click="handleExport">导出</el-button>
            <el-button :icon="Upload" @click="handleImport">导入</el-button>
            <el-button type="success" :icon="ChatDotRound" @click="aiEntryVisible = true">
              AI录入
            </el-button>
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="handleAdd">
              新增产品
            </el-button>
          </div>
        </div>
      </template>

      <!-- 分类Tab切换 -->
      <div class="category-tabs">
        <el-tabs v-model="activeTab" @tab-change="handleTabChange">
          <el-tab-pane
            v-for="category in PRODUCT_CATEGORIES"
            :key="category.value"
            :label="category.label"
            :name="category.value"
          />
        </el-tabs>
      </div>

      <!-- 搜索区域 -->
      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索产品名称/编号/客户"
          :prefix-icon="Search"
          clearable
          style="width: 300px"
          @keyup.enter="handleSearch"
        />
        <el-button type="primary" :icon="Search" @click="handleSearch">
          搜索
        </el-button>
        <el-button :icon="Refresh" @click="handleRefresh">
          重置
        </el-button>
      </div>

      <!-- 数据表格 -->
      <el-table
        :data="tableData"
        v-loading="loading"
        stripe
        border
        style="width: 100%"
      >
        <el-table-column prop="relatedCustomer" label="关联客户" width="140" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.relatedCustomer || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="code" label="产品编号" width="140" />
        <el-table-column prop="name" label="产品名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="specification" label="规格" width="160" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.specification || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="unit" label="单位" width="80" align="center" />
        <el-table-column prop="productCategory" label="产品大类" width="130" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="info">
              {{ getCategoryLabel(row.productCategory || row.category) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="imageUrl" label="图片" width="100" align="center">
          <template #default="{ row }">
            <el-image
              v-if="row.imageUrl"
              :src="row.imageUrl"
              :preview-src-list="[row.imageUrl]"
              fit="cover"
              style="width: 50px; height: 50px; border-radius: 4px;"
              preview-teleported
            >
              <template #error>
                <div class="image-error">
                  <el-icon><Picture /></el-icon>
                </div>
              </template>
            </el-image>
            <span v-else class="no-image">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="notes" label="备注" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.notes || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="warning" link size="small" @click="handleConfigProcesses(row)">
              <el-icon><Setting /></el-icon>工序
            </el-button>
            <el-button v-if="canWrite" type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
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

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
        label-position="right"
      >
        <el-form-item label="产品编号" prop="code">
          <el-input v-model="formData.code" placeholder="留空自动生成，如: CP-F001-001" :disabled="isEditing" />
          <div class="form-tip">留空则系统自动生成编号（成品→CP, 原料→YL, 包辅材→BF）</div>
        </el-form-item>
        <el-form-item label="产品名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入产品名称" />
        </el-form-item>
        <el-form-item label="产品大类" prop="productCategory">
          <el-select v-model="formData.productCategory" placeholder="请选择产品大类" style="width: 100%">
            <el-option
              v-for="category in PRODUCT_CATEGORIES"
              :key="category.value"
              :label="category.label"
              :value="category.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="单位" prop="unit">
          <el-input v-model="formData.unit" placeholder="请输入单位（如：kg、箱、袋）" />
        </el-form-item>
        <el-form-item label="规格" prop="specification">
          <el-input v-model="formData.specification" placeholder="请输入规格（如：310g*42袋/箱）" />
        </el-form-item>
        <el-form-item label="关联客户" prop="relatedCustomer">
          <el-input v-model="formData.relatedCustomer" placeholder="请输入关联客户" />
        </el-form-item>
        <el-form-item label="产品图片" prop="imageUrl">
          <el-input v-model="formData.imageUrl" placeholder="请输入图片URL" />
          <div v-if="formData.imageUrl" class="image-preview">
            <el-image
              :src="formData.imageUrl"
              fit="contain"
              style="width: 100px; height: 100px; margin-top: 8px;"
            >
              <template #error>
                <div class="image-error">图片加载失败</div>
              </template>
            </el-image>
          </div>
        </el-form-item>
        <el-form-item label="备注" prop="notes">
          <el-input
            v-model="formData.notes"
            type="textarea"
            :rows="3"
            placeholder="请输入备注信息"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- AI 对话录入 -->
    <AiEntryDrawer
      v-model="aiEntryVisible"
      :config="PRODUCT_CONFIG"
      @fill-form="handleAiFill"
    />

    <!-- 工序配置抽屉 -->
    <el-drawer
      v-model="processDrawerVisible"
      :title="`工序配置 — ${processDrawerProduct?.name || ''}`"
      size="560px"
      direction="rtl"
    >
      <div v-loading="processLoading" class="process-config">
        <!-- 已关联工序（右侧） -->
        <div class="process-section">
          <div class="section-title">
            <span>已关联工序</span>
            <el-tag size="small" type="info">{{ linkedProcesses.length }} 个</el-tag>
          </div>
          <div v-if="linkedProcesses.length === 0" class="process-empty">
            暂无关联工序，请从下方可选列表中添加
          </div>
          <div v-else class="linked-list">
            <div v-for="(item, idx) in linkedProcesses" :key="item.id" class="linked-item">
              <div class="linked-order">{{ idx + 1 }}</div>
              <div class="linked-info">
                <div class="linked-name">{{ item.processName }}</div>
                <div class="linked-meta">
                  <el-tag size="small" type="info">{{ item.processCategory }}</el-tag>
                  <span class="linked-unit">{{ item.unitOverride || item.defaultUnit }}</span>
                  <span v-if="item.estimatedMinutesOverride || item.defaultEstimatedMinutes" class="linked-time">
                    {{ item.estimatedMinutesOverride || item.defaultEstimatedMinutes }}分钟
                  </span>
                </div>
              </div>
              <div class="linked-actions">
                <el-button :icon="Rank" link size="small" :disabled="idx === 0" @click="handleMoveProcess(idx, 'up')" title="上移" />
                <el-button :icon="Rank" link size="small" :disabled="idx === linkedProcesses.length - 1" @click="handleMoveProcess(idx, 'down')" title="下移" />
                <el-button :icon="DeleteIcon" link size="small" type="danger" @click="handleRemoveProcess(item)" />
              </div>
            </div>
          </div>
        </div>

        <el-divider />

        <!-- 可选工序（左侧） -->
        <div class="process-section">
          <div class="section-title">
            <span>可选工序</span>
            <el-tag size="small">{{ unlinkedProcesses.length }} 个</el-tag>
          </div>
          <div v-if="unlinkedProcesses.length === 0" class="process-empty">
            所有工序已关联，或暂无可用工序
          </div>
          <div v-else class="available-list">
            <div v-for="proc in unlinkedProcesses" :key="proc.id" class="available-item">
              <div class="available-info">
                <span class="available-name">{{ proc.processName }}</span>
                <el-tag size="small" type="info">{{ proc.processCategory }}</el-tag>
                <span class="available-unit">{{ proc.unit }}</span>
              </div>
              <el-button
                type="primary"
                size="small"
                :icon="Plus"
                :loading="addingProcessId === proc.id"
                @click="handleAddProcess(proc.id)"
              >
                添加
              </el-button>
            </div>
          </div>
        </div>
      </div>
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

  .header-right {
    display: flex;
    gap: 8px;
  }
}

.category-tabs {
  margin-bottom: 16px;

  :deep(.el-tabs__nav-wrap::after) {
    display: none;
  }

  :deep(.el-tabs__item) {
    font-size: 14px;
    padding: 0 20px;
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

.image-error {
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
  border-radius: 4px;
  color: #909399;
}

.no-image {
  color: #909399;
}

.image-preview {
  width: 100%;
  display: flex;
  justify-content: flex-start;

  .image-error {
    width: 100px;
    height: 100px;
    margin-top: 8px;
    font-size: 12px;
    border: 1px dashed #dcdfe6;
  }
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  line-height: 1.4;
}

.process-config {
  min-height: 200px;
}

.process-section {
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-weight: 600;
    font-size: 14px;
    color: #303133;
  }
}

.process-empty {
  text-align: center;
  color: #909399;
  padding: 24px 0;
  font-size: 13px;
}

.linked-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.linked-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #F5F7FA;
  border-radius: 8px;
  border: 1px solid #EBEEF5;

  .linked-order {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #409EFF;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .linked-info {
    flex: 1;

    .linked-name {
      font-weight: 500;
      font-size: 14px;
      color: #303133;
    }

    .linked-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
      font-size: 12px;
      color: #909399;
    }
  }

  .linked-actions {
    display: flex;
    gap: 2px;
  }
}

.available-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.available-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border: 1px solid #EBEEF5;
  border-radius: 6px;
  background: #fff;

  .available-info {
    display: flex;
    align-items: center;
    gap: 8px;

    .available-name {
      font-size: 14px;
      color: #303133;
    }

    .available-unit {
      font-size: 12px;
      color: #909399;
    }
  }
}
</style>
