<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post, put, del } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search, Refresh, Download, Upload, Picture } from '@element-plus/icons-vue';

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
    { required: true, message: '请输入产品编号', trigger: 'blur' },
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
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error);
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
    }
  } catch (error) {
    console.error('提交失败:', error);
  } finally {
    submitting.value = false;
  }
}

function handleExport() {
  ElMessage.info('导出功能开发中');
}

function handleImport() {
  ElMessage.info('导入功能开发中');
}

function getCategoryLabel(value?: string) {
  const category = PRODUCT_CATEGORIES.find(c => c.value === value);
  return category?.label || value || '-';
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
              {{ getCategoryLabel(row.productCategory) }}
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
        <el-table-column label="操作" width="140" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
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
          <el-input v-model="formData.code" placeholder="请输入产品编号" :disabled="isEditing" />
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
</style>
