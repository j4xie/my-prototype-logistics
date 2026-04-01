<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('production'));

const loading = ref(false);
const tableData = ref<Record<string, unknown>[]>([]);
const pagination = ref({ page: 0, size: 20, total: 0 });
const statusFilter = ref('');
const activeTab = ref('samples');

const sampleStatusMap: Record<string, { text: string; type: string }> = {
  DRAFT: { text: '草稿', type: 'info' },
  IN_PROGRESS: { text: '开发中', type: '' },
  TESTING: { text: '测试中', type: 'warning' },
  SUBMITTED: { text: '待审核', type: 'warning' },
  APPROVED: { text: '已通过', type: 'success' },
  REJECTED: { text: '已驳回', type: 'danger' },
};

const requestStatusMap: Record<string, { text: string; type: string }> = {
  SUBMITTED: { text: '待分配', type: 'warning' },
  ASSIGNED: { text: '已分配', type: '' },
  IN_PROGRESS: { text: '进行中', type: '' },
  COMPLETED: { text: '已完成', type: 'success' },
  CANCELLED: { text: '已取消', type: 'info' },
};

onMounted(() => loadData());

async function loadData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const endpoint = activeTab.value === 'requests' ? 'requests' : activeTab.value === 'quotations' ? 'quotations' : 'samples';
    const params: Record<string, unknown> = { page: pagination.value.page, size: pagination.value.size };
    if (statusFilter.value) params.status = statusFilter.value;
    const res = await get(`/${factoryId.value}/rd/${endpoint}`, { params });
    if (res.success) {
      tableData.value = res.data.content || [];
      pagination.value.total = res.data.totalElements || 0;
    }
  } catch { ElMessage.error('加载数据失败'); }
  finally { loading.value = false; }
}

function switchTab(tab: string) {
  activeTab.value = tab;
  statusFilter.value = '';
  pagination.value.page = 0;
  loadData();
}

// 样品操作
async function handleSampleAction(id: string, action: string) {
  const labels: Record<string, string> = { submit: '提交审核', approve: '审核通过', reject: '驳回' };
  try {
    if (action === 'reject') {
      const { value: notes } = await ElMessageBox.prompt('请输入驳回原因', '驳回');
      await post(`/${factoryId.value}/rd/samples/${id}/reject`, { notes });
    } else if (action === 'approve') {
      const { value: notes } = await ElMessageBox.prompt('审核意见（可选）', '审核通过', { inputValue: '', required: false });
      await post(`/${factoryId.value}/rd/samples/${id}/approve`, { notes: notes || '' });
    } else {
      await ElMessageBox.confirm(`确认${labels[action]}？`, '确认');
      await post(`/${factoryId.value}/rd/samples/${id}/${action}`);
    }
    ElMessage.success(`${labels[action]}成功`);
    loadData();
  } catch (e) { if (e !== 'cancel') ElMessage.error('操作失败'); }
}

// 新建研发需求弹窗
const requestDialogVisible = ref(false);
const requestForm = ref({ customerName: '', customerContact: '', requirements: '', urgency: 'MEDIUM' });
const submitting = ref(false);

async function handleCreateRequest() {
  if (!requestForm.value.customerName || !requestForm.value.requirements) {
    ElMessage.warning('请填写客户名称和需求描述'); return;
  }
  submitting.value = true;
  try {
    const res = await post(`/${factoryId.value}/rd/requests`, requestForm.value);
    if (res.success) {
      ElMessage.success('研发需求已创建');
      requestDialogVisible.value = false;
      switchTab('requests');
    } else { ElMessage.error(res.message || '创建失败'); }
  } catch { ElMessage.error('创建失败'); }
  finally { submitting.value = false; }
}

// 新建样品弹窗
const sampleDialogVisible = ref(false);
const sampleForm = ref({ rdRequestId: '', name: '', specification: '', grade: '', mainMaterial: '' });

async function handleCreateSample() {
  if (!sampleForm.value.name) { ElMessage.warning('请填写样品名称'); return; }
  submitting.value = true;
  try {
    const res = await post(`/${factoryId.value}/rd/samples`, sampleForm.value);
    if (res.success) {
      ElMessage.success('样品已创建');
      sampleDialogVisible.value = false;
      switchTab('samples');
    } else { ElMessage.error(res.message || '创建失败'); }
  } catch { ElMessage.error('创建失败'); }
  finally { submitting.value = false; }
}
</script>

<template>
  <div class="page-wrapper" v-loading="loading">
    <el-card shadow="never">
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="display:flex;gap:12px;align-items:center">
            <span style="font-size:16px;font-weight:600">研发管理</span>
            <el-radio-group v-model="activeTab" @change="switchTab" size="small">
              <el-radio-button value="requests">研发需求</el-radio-button>
              <el-radio-button value="samples">样品管理</el-radio-button>
              <el-radio-button value="quotations">报价任务</el-radio-button>
            </el-radio-group>
          </div>
          <div style="display:flex;gap:8px" v-if="canWrite">
            <el-button v-if="activeTab === 'requests'" type="primary" @click="requestDialogVisible = true">新建研发需求</el-button>
            <el-button v-if="activeTab === 'samples'" type="primary" @click="sampleDialogVisible = true">新建样品</el-button>
          </div>
        </div>
      </template>

      <!-- 研发需求列表 -->
      <el-table v-if="activeTab === 'requests'" :data="tableData" border stripe>
        <el-table-column prop="requestNumber" label="需求编号" width="180" />
        <el-table-column prop="customerName" label="客户" min-width="130" />
        <el-table-column prop="requirements" label="需求描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="urgency" label="紧急" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.urgency === 'HIGH' ? 'danger' : row.urgency === 'LOW' ? 'info' : 'warning'" size="small">
              {{ { HIGH: '紧急', MEDIUM: '普通', LOW: '低' }[row.urgency] || row.urgency }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="requestStatusMap[row.status]?.type || 'info'" size="small">{{ requestStatusMap[row.status]?.text || row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="submittedAt" label="提交时间" width="170" />
      </el-table>

      <!-- 样品列表 -->
      <el-table v-if="activeTab === 'samples'" :data="tableData" border stripe>
        <el-table-column prop="sampleCode" label="样品编号" width="180" />
        <el-table-column prop="name" label="样品名称" min-width="150" />
        <el-table-column prop="specification" label="规格" width="120" />
        <el-table-column prop="mainMaterial" label="主原料" width="120" />
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="sampleStatusMap[row.status]?.type || 'info'" size="small">{{ sampleStatusMap[row.status]?.text || row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" align="center" v-if="canWrite">
          <template #default="{ row }">
            <el-button v-if="['DRAFT','IN_PROGRESS','TESTING'].includes(row.status)" type="warning" link size="small" @click="handleSampleAction(row.id, 'submit')">提交审核</el-button>
            <el-button v-if="row.status === 'SUBMITTED'" type="success" link size="small" @click="handleSampleAction(row.id, 'approve')">通过</el-button>
            <el-button v-if="row.status === 'SUBMITTED'" type="danger" link size="small" @click="handleSampleAction(row.id, 'reject')">驳回</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 报价任务列表 -->
      <el-table v-if="activeTab === 'quotations'" :data="tableData" border stripe>
        <el-table-column prop="taskNumber" label="任务编号" width="180" />
        <el-table-column prop="totalCost" label="总成本" width="120" align="right">
          <template #default="{ row }">{{ row.totalCost || '-' }}</template>
        </el-table-column>
        <el-table-column prop="suggestedPrice" label="建议售价" width="120" align="right">
          <template #default="{ row }">{{ row.suggestedPrice || '-' }}</template>
        </el-table-column>
        <el-table-column prop="finalPrice" label="最终报价" width="120" align="right">
          <template #default="{ row }">{{ row.finalPrice || '-' }}</template>
        </el-table-column>
        <el-table-column prop="profitMargin" label="毛利率" width="90" align="center">
          <template #default="{ row }">{{ row.profitMargin != null ? `${row.profitMargin}%` : '-' }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="{ PENDING: 'warning', IN_PROGRESS: '', QUOTED: 'success', CONFIRMED: 'success' }[row.status] || 'info'" size="small">
              {{ { PENDING: '待报价', IN_PROGRESS: '报价中', QUOTED: '已报价', CONFIRMED: '已确认' }[row.status] || row.status }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="pagination.total > pagination.size"
        style="margin-top:16px;justify-content:flex-end"
        :current-page="pagination.page + 1" :page-size="pagination.size" :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="(p: number) => { pagination.page = p - 1; loadData(); }"
      />
    </el-card>

    <!-- 新建研发需求 -->
    <el-dialog v-model="requestDialogVisible" title="新建研发需求" width="520px" destroy-on-close>
      <el-form label-width="90px">
        <el-form-item label="客户名称" required><el-input v-model="requestForm.customerName" /></el-form-item>
        <el-form-item label="联系方式"><el-input v-model="requestForm.customerContact" /></el-form-item>
        <el-form-item label="紧急程度">
          <el-select v-model="requestForm.urgency" style="width:100%">
            <el-option label="紧急" value="HIGH" /><el-option label="普通" value="MEDIUM" /><el-option label="低" value="LOW" />
          </el-select>
        </el-form-item>
        <el-form-item label="需求描述" required><el-input v-model="requestForm.requirements" type="textarea" :rows="4" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="requestDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreateRequest">提交</el-button>
      </template>
    </el-dialog>

    <!-- 新建样品 -->
    <el-dialog v-model="sampleDialogVisible" title="新建样品" width="520px" destroy-on-close>
      <el-form label-width="90px">
        <el-form-item label="样品名称" required><el-input v-model="sampleForm.name" /></el-form-item>
        <el-form-item label="规格"><el-input v-model="sampleForm.specification" placeholder="如 200g/盒" /></el-form-item>
        <el-form-item label="等级"><el-input v-model="sampleForm.grade" /></el-form-item>
        <el-form-item label="主原料"><el-input v-model="sampleForm.mainMaterial" /></el-form-item>
        <el-form-item label="关联需求"><el-input v-model="sampleForm.rdRequestId" placeholder="研发需求ID（可选）" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="sampleDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreateSample">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>
