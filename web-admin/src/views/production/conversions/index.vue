<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post, put, del } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search, Refresh, Edit, Delete } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('production'));

const loading = ref(false);
const tableData = ref<any[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });
const searchKeyword = ref('');

// 对话框
const dialogVisible = ref(false);
const dialogLoading = ref(false);
const isEdit = ref(false);
const conversionForm = ref({
  id: '',
  materialTypeId: '',
  productTypeId: '',
  conversionRate: 0,
  wastageRate: 0,
  notes: ''
});
const materialTypes = ref<any[]>([]);
const productTypes = ref<any[]>([]);

onMounted(() => {
  loadData();
  loadMaterialTypes();
  loadProductTypes();
});

async function loadData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const response = await get(`/${factoryId.value}/conversions`, {
      params: {
        page: pagination.value.page,
        size: pagination.value.size,
        keyword: searchKeyword.value || undefined
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

async function loadMaterialTypes() {
  if (!factoryId.value) return;
  try {
    const response = await get(`/${factoryId.value}/raw-material-types`);
    if (response.success && response.data) {
      materialTypes.value = response.data.content || response.data || [];
    }
  } catch (error) {
    console.error('加载原料类型失败:', error);
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

function handleCreate() {
  isEdit.value = false;
  conversionForm.value = {
    id: '',
    materialTypeId: '',
    productTypeId: '',
    conversionRate: 0,
    wastageRate: 0,
    notes: ''
  };
  dialogVisible.value = true;
}

function handleEdit(row: any) {
  isEdit.value = true;
  conversionForm.value = {
    id: row.id,
    materialTypeId: row.materialTypeId,
    productTypeId: row.productTypeId,
    conversionRate: row.conversionRate,
    wastageRate: row.wastageRate || 0,
    notes: row.notes || ''
  };
  dialogVisible.value = true;
}

async function submitForm() {
  if (!conversionForm.value.materialTypeId || !conversionForm.value.productTypeId || !conversionForm.value.conversionRate) {
    ElMessage.warning('请填写完整信息');
    return;
  }

  dialogLoading.value = true;
  try {
    let response;
    if (isEdit.value) {
      response = await put(`/${factoryId.value}/conversions/${conversionForm.value.id}`, conversionForm.value);
    } else {
      response = await post(`/${factoryId.value}/conversions`, conversionForm.value);
    }
    if (response.success) {
      ElMessage.success(isEdit.value ? '更新成功' : '创建成功');
      dialogVisible.value = false;
      loadData();
    } else {
      ElMessage.error(response.message || '操作失败');
    }
  } catch (error) {
    ElMessage.error('操作失败');
  } finally {
    dialogLoading.value = false;
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm('确定删除此转换率配置?', '提示', { type: 'warning' });
    const response = await del(`/${factoryId.value}/conversions/${row.id}`);
    if (response.success) {
      ElMessage.success('删除成功');
      loadData();
    } else {
      ElMessage.error(response.message || '删除失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败');
    }
  }
}
</script>

<template>
  <div class="page-wrapper">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">转换率配置</span>
            <span class="data-count">共 {{ pagination.total }} 条记录</span>
          </div>
          <div class="header-right">
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="handleCreate">
              新增配置
            </el-button>
          </div>
        </div>
      </template>

      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索原料/产品名称"
          :prefix-icon="Search"
          clearable
          style="width: 280px"
          @keyup.enter="handleSearch"
        />
        <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleRefresh">重置</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" stripe border style="width: 100%">
        <el-table-column prop="materialTypeName" label="原料类型" min-width="150" show-overflow-tooltip />
        <el-table-column prop="productTypeName" label="产品类型" min-width="150" show-overflow-tooltip />
        <el-table-column prop="conversionRate" label="转换率" width="120" align="center">
          <template #default="{ row }">
            {{ (row.conversionRate * 100).toFixed(1) }}%
          </template>
        </el-table-column>
        <el-table-column prop="wastageRate" label="损耗率" width="120" align="center">
          <template #default="{ row }">
            {{ ((row.wastageRate || 0) * 100).toFixed(1) }}%
          </template>
        </el-table-column>
        <el-table-column prop="notes" label="备注" min-width="200" show-overflow-tooltip />
        <el-table-column prop="updatedAt" label="更新时间" width="180" />
        <el-table-column label="操作" width="150" fixed="right" align="center">
          <template #default="{ row }">
            <el-button v-if="canWrite" type="primary" link size="small" :icon="Edit" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button v-if="canWrite" type="danger" link size="small" :icon="Delete" @click="handleDelete(row)">
              删除
            </el-button>
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

    <!-- 编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑转换率' : '新增转换率'" width="500px">
      <el-form :model="conversionForm" label-width="100px">
        <el-form-item label="原料类型" required>
          <el-select v-model="conversionForm.materialTypeId" placeholder="选择原料类型" style="width: 100%">
            <el-option
              v-for="item in materialTypes"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="产品类型" required>
          <el-select v-model="conversionForm.productTypeId" placeholder="选择产品类型" style="width: 100%">
            <el-option
              v-for="item in productTypes"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="转换率" required>
          <el-input-number
            v-model="conversionForm.conversionRate"
            :min="0"
            :max="1"
            :step="0.01"
            :precision="2"
            style="width: 100%"
          />
          <div class="form-tip">0-1之间的小数，如0.85表示85%</div>
        </el-form-item>
        <el-form-item label="损耗率">
          <el-input-number
            v-model="conversionForm.wastageRate"
            :min="0"
            :max="1"
            :step="0.01"
            :precision="2"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="conversionForm.notes" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dialogLoading" @click="submitForm">确定</el-button>
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

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
