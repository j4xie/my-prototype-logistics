<script setup lang="ts">
/**
 * 车辆字典管理 (vehicles)
 * audit P1 fix: 后端 /vehicles 全 CRUD 齐全, 前端零页面.
 * 出货时应该能选车牌, 之前 dropdown 都没有 → 配车信息丢失.
 */
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post, put, del } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Edit, Delete as DeleteIcon, Refresh } from '@element-plus/icons-vue';
import type { TableRow } from '@/types/api';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('warehouse'));

const loading = ref(false);
const tableData = ref<TableRow[]>([]);

onMounted(loadData);

async function loadData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const res = await get(`/${factoryId.value}/vehicles`);
    if (res.success && res.data) {
      tableData.value = Array.isArray(res.data) ? res.data : (res.data.content || []);
    }
  } catch (e) { console.error(e); }
  finally { loading.value = false; }
}

const dialogVisible = ref(false);
const editingId = ref<string | null>(null);
const form = ref({
  plateNumber: '',
  driver: '',
  phone: '',
  vehicleType: '货车',
  capacity: 0,
  status: 'available',
  notes: '',
});
const dialogTitle = computed(() => (editingId.value ? '编辑车辆' : '新建车辆'));
const submitting = ref(false);

function openCreate() {
  editingId.value = null;
  form.value = { plateNumber: '', driver: '', phone: '', vehicleType: '货车', capacity: 0, status: 'available', notes: '' };
  dialogVisible.value = true;
}

function openEdit(row: TableRow) {
  editingId.value = String(row.id || '');
  form.value = {
    plateNumber: String(row.plateNumber || ''),
    driver: String(row.driver || ''),
    phone: String(row.phone || ''),
    vehicleType: String(row.vehicleType || '货车'),
    capacity: Number(row.capacity || 0),
    status: String(row.status || 'available'),
    notes: String(row.notes || ''),
  };
  dialogVisible.value = true;
}

async function handleSave() {
  if (!form.value.plateNumber) return ElMessage.warning('请填写车牌号');
  submitting.value = true;
  try {
    if (editingId.value) {
      const res = await put(`/${factoryId.value}/vehicles/${editingId.value}`, form.value);
      if (res.success) ElMessage.success('更新成功');
    } else {
      const res = await post(`/${factoryId.value}/vehicles`, form.value);
      if (res.success) ElMessage.success('创建成功');
    }
    dialogVisible.value = false;
    loadData();
  } catch (e) { console.error(e); }
  finally { submitting.value = false; }
}

async function handleDelete(row: TableRow) {
  try {
    await ElMessageBox.confirm(`确定删除车辆「${row.plateNumber}」?`, '删除确认', { type: 'warning' });
    const res = await del(`/${factoryId.value}/vehicles/${row.id}`);
    if (res.success) { ElMessage.success('删除成功'); loadData(); }
  } catch { /* cancel */ }
}

const statusMap: Record<string, { text: string; type: string }> = {
  available: { text: '可用', type: 'success' },
  loading: { text: '装货中', type: 'warning' },  // 出货时被锁定
  in_use: { text: '使用中', type: 'warning' },
  maintenance: { text: '维护中', type: 'info' },
  retired: { text: '已退役', type: 'info' },
};
</script>

<template>
  <div class="page-wrapper">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">车辆字典</span>
            <span class="data-count">出货 / 调拨时可选的车辆列表</span>
          </div>
          <div class="header-right">
            <el-button :icon="Refresh" @click="loadData">刷新</el-button>
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="openCreate">新建车辆</el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" :data="tableData" stripe>
        <el-table-column prop="plateNumber" label="车牌号" width="140" />
        <el-table-column prop="vehicleType" label="车型" width="120" />
        <el-table-column prop="driver" label="司机" width="120" />
        <el-table-column prop="phone" label="联系电话" width="140" />
        <el-table-column prop="capacity" label="载重 (kg)" width="120" />
        <el-table-column prop="currentLoad" label="当前载重 (kg)" width="140" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="(statusMap[row.status]?.type as any) || 'info'" size="small">
              {{ statusMap[row.status]?.text || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button v-if="canWrite" link type="primary" :icon="Edit" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="canWrite" link type="danger" :icon="DeleteIcon" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px" destroy-on-close>
      <el-form :model="form" label-width="100px">
        <el-form-item label="车牌号" required>
          <el-input v-model="form.plateNumber" placeholder="如 沪 A12345" />
        </el-form-item>
        <el-form-item label="车型">
          <el-input v-model="form.vehicleType" placeholder="如 厢式货车 / 冷藏车" />
        </el-form-item>
        <el-form-item label="司机姓名">
          <el-input v-model="form.driver" />
        </el-form-item>
        <el-form-item label="司机电话">
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item label="载重 (kg)">
          <el-input-number v-model="form.capacity" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="可用" value="available" />
            <el-option label="装货中" value="loading" />
            <el-option label="使用中" value="in_use" />
            <el-option label="维护中" value="maintenance" />
            <el-option label="已退役" value="retired" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.notes" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-wrapper { padding: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.header-left { display: flex; align-items: baseline; gap: 12px; }
.page-title { font-size: 18px; font-weight: 600; }
.data-count { font-size: 13px; color: #909399; }
</style>
