<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import {
  listServiceComplaints,
  createServiceComplaint,
  startServiceComplaint,
  resolveServiceComplaint,
  closeServiceComplaint,
  getServiceComplaint,
  type ServiceComplaint,
  type ServiceComplaintStatus,
  type ServiceComplaintSeverity,
  type ServiceComplaintType,
  type ServiceComplaintSource,
  type ServiceComplaintCreateRequest,
} from '@/api/serviceComplaint';

// ============================================================
// State
// ============================================================
const list = ref<ServiceComplaint[]>([]);
const total = ref(0);
const loading = ref(false);
const page = ref(0);
const size = ref(20);
const statusFilter = ref<string>('');

const dialogVisible = ref(false);
const submitting = ref(false);
const form = reactive<ServiceComplaintCreateRequest>({
  customerId: '',
  customerName: '',
  orderId: '',
  complaintType: 'PRODUCT_QUALITY',
  severity: 'MEDIUM',
  source: 'PHONE',
  description: '',
  occurredAt: undefined,
});

const detailVisible = ref(false);
const detailLoading = ref(false);
const detail = ref<ServiceComplaint | null>(null);

const resolveDialogVisible = ref(false);
const resolveTarget = ref<ServiceComplaint | null>(null);
const resolutionText = ref('');

// ============================================================
// 防呆 R2: dialog title context
// ============================================================
const createDialogTitle = computed(() => {
  const cust = form.customerName?.trim() || form.customerId?.trim() || '未选客户';
  const ord = form.orderId?.trim() ? ` (订单 ${form.orderId})` : '';
  return `新建售后投诉 — ${cust}${ord}`;
});

const resolveDialogTitle = computed(() => {
  if (!resolveTarget.value) return '解决投诉';
  const r = resolveTarget.value;
  const cust = r.customerName?.trim() || r.customerId?.trim();
  return `解决投诉 — ${r.complaintNumber} (${cust})`;
});

// ============================================================
// Loaders
// ============================================================
async function load(): Promise<void> {
  loading.value = true;
  try {
    const res = await listServiceComplaints({
      status: statusFilter.value || undefined,
      page: page.value,
      size: size.value,
    });
    list.value = res?.data?.content ?? [];
    total.value = res?.data?.totalElements ?? 0;
  } catch {
    ElMessage.error('加载失败');
  } finally {
    loading.value = false;
  }
}

// ============================================================
// Create
// ============================================================
function openCreate(): void {
  Object.assign(form, {
    customerId: '',
    customerName: '',
    orderId: '',
    complaintType: 'PRODUCT_QUALITY',
    severity: 'MEDIUM',
    source: 'PHONE',
    description: '',
    occurredAt: undefined,
  });
  dialogVisible.value = true;
}

async function submitCreate(): Promise<void> {
  if (!form.customerId?.trim()) {
    ElMessage.warning('请填写客户ID');
    return;
  }
  if (!form.description?.trim()) {
    ElMessage.warning('请填写投诉内容');
    return;
  }
  submitting.value = true;
  try {
    const payload: ServiceComplaintCreateRequest = {
      customerId: form.customerId.trim(),
      customerName: form.customerName?.trim() || undefined,
      orderId: form.orderId?.trim() || undefined,
      complaintType: form.complaintType,
      severity: form.severity,
      source: form.source,
      description: form.description.trim(),
      occurredAt: form.occurredAt || undefined,
    };
    await createServiceComplaint(payload);
    ElMessage.success('创建成功');
    dialogVisible.value = false;
    page.value = 0;
    load();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '创建失败';
    ElMessage.error(msg);
  } finally {
    submitting.value = false;
  }
}

// ============================================================
// Actions
// ============================================================
async function handleStart(row: ServiceComplaint): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `开始调查投诉 ${row.complaintNumber}? 状态: NEW → INVESTIGATING.`,
      '开始调查',
      { type: 'warning' },
    );
    await startServiceComplaint(row.id);
    ElMessage.success('已开始调查');
    load();
  } catch {
    /* user canceled */
  }
}

function openResolve(row: ServiceComplaint): void {
  resolveTarget.value = row;
  resolutionText.value = '';
  resolveDialogVisible.value = true;
}

async function submitResolve(): Promise<void> {
  if (!resolveTarget.value) return;
  if (!resolutionText.value?.trim()) {
    ElMessage.warning('解决方案不能为空');
    return;
  }
  try {
    await resolveServiceComplaint(resolveTarget.value.id, resolutionText.value.trim());
    ElMessage.success('已标记解决');
    resolveDialogVisible.value = false;
    load();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '提交失败';
    ElMessage.error(msg);
  }
}

async function handleClose(row: ServiceComplaint): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `关闭投诉 ${row.complaintNumber}? 关闭后不可编辑.`,
      '关闭投诉',
      { type: 'warning' },
    );
    await closeServiceComplaint(row.id);
    ElMessage.success('已关闭');
    load();
  } catch {
    /* user canceled */
  }
}

// ============================================================
// Detail drill-down
// ============================================================
async function openDetail(row: ServiceComplaint): Promise<void> {
  detailVisible.value = true;
  detailLoading.value = true;
  detail.value = null;
  try {
    const res = await getServiceComplaint(row.id);
    detail.value = res?.data ?? null;
  } catch {
    ElMessage.error('详情加载失败');
  } finally {
    detailLoading.value = false;
  }
}

// ============================================================
// Display helpers
// ============================================================
function statusTag(s: ServiceComplaintStatus): {
  type: 'info' | 'warning' | 'success' | 'danger';
  label: string;
} {
  if (s === 'NEW') return { type: 'info', label: '新建' };
  if (s === 'INVESTIGATING') return { type: 'warning', label: '调查中' };
  if (s === 'RESOLVED') return { type: 'success', label: '已解决' };
  return { type: 'danger', label: '已关闭' };
}

function severityTag(s: ServiceComplaintSeverity): {
  type: 'info' | 'warning' | 'success' | 'danger';
  label: string;
} {
  if (s === 'CRITICAL') return { type: 'danger', label: '紧急' };
  if (s === 'HIGH') return { type: 'warning', label: '高' };
  if (s === 'MEDIUM') return { type: 'info', label: '中' };
  return { type: 'success', label: '低' };
}

function typeLabel(t: ServiceComplaintType): string {
  const map: Record<ServiceComplaintType, string> = {
    PRODUCT_QUALITY: '产品质量',
    DELIVERY_LATE: '配送延迟',
    SERVICE_ATTITUDE: '服务态度',
    PRICING: '价格问题',
    OTHER: '其他',
  };
  return map[t] ?? t;
}

function sourceLabel(s: ServiceComplaintSource): string {
  const map: Record<ServiceComplaintSource, string> = {
    PHONE: '电话',
    EMAIL: '邮件',
    WECHAT: '微信',
    IN_STORE: '门店',
    OTHER: '其他',
  };
  return map[s] ?? s;
}

function onPageChange(p: number): void {
  page.value = p - 1;
  load();
}

function onStatusChange(): void {
  page.value = 0;
  load();
}

onMounted(load);
</script>

<template>
  <div class="service-complaints">
    <div class="header">
      <h2>售后服务投诉</h2>
      <div class="actions">
        <el-radio-group v-model="statusFilter" @change="onStatusChange" size="default">
          <el-radio-button label="">全部</el-radio-button>
          <el-radio-button label="NEW">新建</el-radio-button>
          <el-radio-button label="INVESTIGATING">调查中</el-radio-button>
          <el-radio-button label="RESOLVED">已解决</el-radio-button>
          <el-radio-button label="CLOSED">已关闭</el-radio-button>
        </el-radio-group>
        <el-button type="primary" :icon="Plus" @click="openCreate">新建投诉</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="list" stripe @row-click="openDetail">
      <el-table-column prop="complaintNumber" label="投诉单号" width="170" />
      <el-table-column label="客户" min-width="160">
        <template #default="{ row }">{{ row.customerName ?? row.customerId }}</template>
      </el-table-column>
      <el-table-column label="类型" width="120">
        <template #default="{ row }">{{ typeLabel(row.complaintType) }}</template>
      </el-table-column>
      <el-table-column label="严重程度" width="100">
        <template #default="{ row }">
          <el-tag :type="severityTag(row.severity).type" size="small">
            {{ severityTag(row.severity).label }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="来源" width="90">
        <template #default="{ row }">{{ sourceLabel(row.source) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusTag(row.status).type" size="small">
            {{ statusTag(row.status).label }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="occurredAt" label="发生时间" width="160" />
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.status === 'NEW'"
            size="small"
            type="primary"
            link
            @click.stop="handleStart(row)"
          >开始调查</el-button>
          <el-button
            v-if="row.status === 'INVESTIGATING'"
            size="small"
            type="success"
            link
            @click.stop="openResolve(row)"
          >解决</el-button>
          <el-button
            v-if="row.status === 'RESOLVED'"
            size="small"
            type="info"
            link
            @click.stop="handleClose(row)"
          >关闭</el-button>
          <el-button size="small" link @click.stop="openDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-if="total > 0"
      :current-page="page + 1"
      :page-size="size"
      :total="total"
      layout="prev, pager, next, total"
      @current-change="onPageChange"
      class="pagination"
    />

    <!-- Create dialog (R2: title shows customer + order context) -->
    <el-dialog v-model="dialogVisible" :title="createDialogTitle" width="640px">
      <el-form :model="form" label-width="110px">
        <el-form-item label="客户ID *">
          <el-input v-model="form.customerId" placeholder="客户 UUID" />
        </el-form-item>
        <el-form-item label="客户名称">
          <el-input v-model="form.customerName" placeholder="客户名称 (冗余, 用于显示)" />
        </el-form-item>
        <el-form-item label="关联订单">
          <el-input v-model="form.orderId" placeholder="可选, 销售订单 ID" />
        </el-form-item>
        <!-- R3: dropdown for type / severity / source -->
        <el-form-item label="投诉类型 *">
          <el-select v-model="form.complaintType" style="width: 260px">
            <el-option label="产品质量" value="PRODUCT_QUALITY" />
            <el-option label="配送延迟" value="DELIVERY_LATE" />
            <el-option label="服务态度" value="SERVICE_ATTITUDE" />
            <el-option label="价格问题" value="PRICING" />
            <el-option label="其他" value="OTHER" />
          </el-select>
        </el-form-item>
        <el-form-item label="严重程度 *">
          <el-select v-model="form.severity" style="width: 260px">
            <el-option label="低 (LOW)" value="LOW" />
            <el-option label="中 (MEDIUM)" value="MEDIUM" />
            <el-option label="高 (HIGH)" value="HIGH" />
            <el-option label="紧急 (CRITICAL)" value="CRITICAL" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源渠道 *">
          <el-select v-model="form.source" style="width: 260px">
            <el-option label="电话" value="PHONE" />
            <el-option label="邮件" value="EMAIL" />
            <el-option label="微信" value="WECHAT" />
            <el-option label="门店现场" value="IN_STORE" />
            <el-option label="其他" value="OTHER" />
          </el-select>
        </el-form-item>
        <el-form-item label="发生时间">
          <el-date-picker
            v-model="form.occurredAt"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss"
            placeholder="客户报告事件时间"
          />
        </el-form-item>
        <el-form-item label="投诉内容 *">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="4"
            placeholder="详细描述客户投诉内容"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitCreate">提交</el-button>
      </template>
    </el-dialog>

    <!-- Resolve dialog (R2: title shows complaint number + customer) -->
    <el-dialog v-model="resolveDialogVisible" :title="resolveDialogTitle" width="560px">
      <el-form label-width="110px">
        <el-form-item label="解决方案 *">
          <el-input
            v-model="resolutionText"
            type="textarea"
            :rows="5"
            placeholder="详细描述如何解决此投诉"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resolveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitResolve">确认解决</el-button>
      </template>
    </el-dialog>

    <!-- Detail drill-down -->
    <el-dialog v-model="detailVisible" title="投诉详情" width="720px">
      <el-skeleton v-if="detailLoading" :rows="6" animated />
      <el-descriptions v-else-if="detail" :column="2" border>
        <el-descriptions-item label="投诉单号">{{ detail.complaintNumber }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTag(detail.status).type" size="small">
            {{ statusTag(detail.status).label }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="客户">
          {{ detail.customerName ?? detail.customerId }}
        </el-descriptions-item>
        <el-descriptions-item label="关联订单">{{ detail.orderId ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ typeLabel(detail.complaintType) }}</el-descriptions-item>
        <el-descriptions-item label="严重程度">
          <el-tag :type="severityTag(detail.severity).type" size="small">
            {{ severityTag(detail.severity).label }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="来源">{{ sourceLabel(detail.source) }}</el-descriptions-item>
        <el-descriptions-item label="处理人">{{ detail.handledBy ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="发生时间">{{ detail.occurredAt ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="解决时间">{{ detail.resolvedAt ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="投诉内容" :span="2">
          <pre class="text-block">{{ detail.description }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="解决方案" :span="2">
          <pre class="text-block">{{ detail.resolution ?? '-' }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detail.createdAt }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ detail.updatedAt }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.service-complaints {
  padding: 16px;
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    h2 { margin: 0; }
    .actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }
  }
  .pagination {
    margin-top: 16px;
    justify-content: flex-end;
  }
  .text-block {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: inherit;
    font-size: 13px;
  }
}
</style>
