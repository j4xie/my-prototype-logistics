<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh, Plus } from '@element-plus/icons-vue';
import {
  listSalaries,
  createSalary,
  updateSalary,
  confirmSalary,
  markSalaryPaid,
  deleteSalary,
  previewSalaryCompute,
  getMonthlySummary,
  previewAnnualBonusTax,
  setAnnualBonus,
  type SalaryItem,
  type SalaryStatus,
  type SalaryComputePreview,
  type SalaryMonthlySummary,
  type AnnualBonusPreview,
} from '@/api/salary';
import {
  previewDeductionForMonth,
  type SalarySpecialDeduction,
} from '@/api/specialDeduction';
import { exportPayslipPDF } from './payslipExport';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('hr'));

// ============= state =============
const STATUS_LABEL: Record<SalaryStatus, string> = {
  DRAFT: '草稿',
  CONFIRMED: '已确认',
  PAID: '已发放',
};
const STATUS_TAG_TYPE: Record<SalaryStatus, '' | 'success' | 'warning' | 'info'> = {
  DRAFT: 'info',
  CONFIRMED: 'warning',
  PAID: 'success',
};

const activeTab = ref<'list' | 'summary'>('list');
const loading = ref(false);
const tableData = ref<SalaryItem[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });

// 列表过滤
const filterYearMonth = ref<string>(currentYearMonth());
const filterStatus = ref<SalaryStatus | ''>('');

// 月汇总
const summaryYearMonth = ref<string>(currentYearMonth());
const summaryData = ref<SalaryMonthlySummary | null>(null);
const summaryRecordCount = ref<number>(0);

// ============= dialog: create / edit =============
const dialogVisible = ref(false);
const dialogMode = ref<'create' | 'edit'>('create');
const dialogSubmitting = ref(false);
const formEditingId = ref<string | null>(null);

const formData = ref({
  userId: 0,
  yearMonth: currentYearMonth(),
  baseSalary: 0,
  remark: '',
});

// R1 防呆: preview state — base 变化触发实时算 social/tax/net
const previewData = ref<SalaryComputePreview | null>(null);
const previewLoading = ref(false);

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

onMounted(() => {
  loadList();
});

watch(activeTab, () => {
  pagination.value.page = 1;
  if (activeTab.value === 'summary') loadSummary();
  else loadList();
});

watch([filterYearMonth, filterStatus], () => {
  pagination.value.page = 1;
  loadList();
});

// R1 防呆: base 变化时实时 preview
watch(() => formData.value.baseSalary, async (val) => {
  if (!dialogVisible.value) return;
  if (val == null || val < 0) {
    previewData.value = null;
    return;
  }
  await refreshPreview();
});

async function refreshPreview() {
  if (!factoryId.value) return;
  previewLoading.value = true;
  try {
    const res = await previewSalaryCompute(factoryId.value, formData.value.baseSalary);
    if (res.success && res.data) {
      previewData.value = res.data;
    }
  } catch (e) {
    console.error('preview 失败:', e);
  } finally {
    previewLoading.value = false;
  }
}

// ============= list / summary load =============
async function loadList() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const res = await listSalaries(factoryId.value, {
      yearMonth: filterYearMonth.value || undefined,
      status: filterStatus.value || undefined,
      page: pagination.value.page - 1,
      size: pagination.value.size,
    });
    if (res.success && res.data) {
      tableData.value = res.data.content || [];
      pagination.value.total = res.data.totalElements || 0;
    } else {
      tableData.value = [];
      pagination.value.total = 0;
    }
  } catch (e) {
    console.error('加载工资单失败:', e);
    tableData.value = [];
    pagination.value.total = 0;
  } finally {
    loading.value = false;
  }
}

async function loadSummary() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const res = await getMonthlySummary(factoryId.value, summaryYearMonth.value);
    if (res.success && res.data) {
      summaryData.value = res.data;
    } else {
      summaryData.value = null;
    }
    // 同时拉总记录数
    const listRes = await listSalaries(factoryId.value, {
      yearMonth: summaryYearMonth.value,
      page: 0,
      size: 1,
    });
    if (listRes.success && listRes.data) {
      summaryRecordCount.value = listRes.data.totalElements;
    }
  } catch (e) {
    console.error('加载月汇总失败:', e);
    summaryData.value = null;
  } finally {
    loading.value = false;
  }
}

// ============= dialog actions =============
function openCreate() {
  dialogMode.value = 'create';
  formEditingId.value = null;
  formData.value = {
    userId: 0,
    yearMonth: currentYearMonth(),
    baseSalary: 0,
    remark: '',
  };
  previewData.value = null;
  dialogVisible.value = true;
}

function openEdit(row: SalaryItem) {
  if (row.status === 'PAID') {
    ElMessage.warning('已发放工资单不可编辑');
    return;
  }
  dialogMode.value = 'edit';
  formEditingId.value = row.id;
  formData.value = {
    userId: row.userId,
    yearMonth: row.yearMonth,
    baseSalary: Number(row.baseSalary),
    remark: row.remark || '',
  };
  // 立即触发 preview
  refreshPreview();
  dialogVisible.value = true;
}

async function handleSubmit() {
  if (!factoryId.value) return;
  if (dialogMode.value === 'create') {
    if (!formData.value.userId || formData.value.userId <= 0) {
      ElMessage.error('请填写员工 userId');
      return;
    }
    if (!formData.value.yearMonth || !/^\d{4}-\d{2}$/.test(formData.value.yearMonth)) {
      ElMessage.error('yearMonth 格式必须为 YYYY-MM');
      return;
    }
  }
  if (formData.value.baseSalary < 0) {
    ElMessage.error('基本工资必须 ≥ 0');
    return;
  }

  dialogSubmitting.value = true;
  try {
    if (dialogMode.value === 'create') {
      const res = await createSalary(factoryId.value, {
        userId: formData.value.userId,
        yearMonth: formData.value.yearMonth,
        baseSalary: formData.value.baseSalary,
        remark: formData.value.remark || undefined,
      });
      if (res.success) {
        ElMessage.success(res.message || '已创建');
        dialogVisible.value = false;
        await loadList();
      }
    } else if (formEditingId.value) {
      const res = await updateSalary(factoryId.value, formEditingId.value, {
        baseSalary: formData.value.baseSalary,
        remark: formData.value.remark || undefined,
      });
      if (res.success) {
        ElMessage.success(res.message || '已更新');
        dialogVisible.value = false;
        await loadList();
      }
    }
  } catch (e) {
    // 4位一体: 全局 axios interceptor 已 sticky display backend message (含 R4 409)
    console.error('提交失败:', e);
  } finally {
    dialogSubmitting.value = false;
  }
}

// R2 防呆: confirm dialog 显示 user+yearMonth+netSalary context
async function handleConfirm(row: SalaryItem) {
  try {
    await ElMessageBox.confirm(
      `确认工资单 [用户 ${row.userId} / ${row.yearMonth} / 实发 ¥${row.netSalary}] ?`,
      '确认工资单',
      { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' }
    );
    if (!factoryId.value) return;
    const res = await confirmSalary(factoryId.value, row.id);
    if (res.success) {
      ElMessage.success(res.message || '已确认');
      await loadList();
    }
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') console.error(e);
  }
}

// R2 防呆: 发放确认含 amount context
async function handleMarkPaid(row: SalaryItem) {
  try {
    await ElMessageBox.confirm(
      `标记工资单已发放 [用户 ${row.userId} / ${row.yearMonth} / 实发 ¥${row.netSalary}] ?`,
      '标记发放',
      {
        confirmButtonText: '已发放',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
    if (!factoryId.value) return;
    const res = await markSalaryPaid(factoryId.value, row.id);
    if (res.success) {
      ElMessage.success(res.message || '已标记发放');
      await loadList();
    }
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') console.error(e);
  }
}

async function handleDelete(row: SalaryItem) {
  try {
    await ElMessageBox.confirm(
      `删除草稿工资单 [用户 ${row.userId} / ${row.yearMonth}] ?`,
      '删除确认',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    );
    if (!factoryId.value) return;
    const res = await deleteSalary(factoryId.value, row.id);
    if (res.success) {
      ElMessage.success('已删除');
      await loadList();
    }
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') console.error(e);
  }
}

// ============= #833 follow-up: 年终奖 dialog =============
const bonusDialogVisible = ref(false);
const bonusSubmitting = ref(false);
const bonusEditingRow = ref<SalaryItem | null>(null);
const bonusForm = ref<{ bonusAmount: number | null }>({ bonusAmount: 0 });
const bonusPreview = ref<AnnualBonusPreview | null>(null);
const bonusPreviewLoading = ref(false);

// R4 防呆: 年终奖 dialog 仅 DRAFT/CONFIRMED 可开; PAID 锁
function canEditAnnualBonus(row: SalaryItem): boolean {
  return canWrite.value && row.status !== 'PAID';
}

function openAnnualBonusDialog(row: SalaryItem) {
  if (!canEditAnnualBonus(row)) {
    ElMessage.warning(`已发放工资单不可修改年终奖 [用户 ${row.userId} / ${row.yearMonth}]`);
    return;
  }
  bonusEditingRow.value = row;
  bonusForm.value = {
    bonusAmount: row.annualBonus == null ? 0 : Number(row.annualBonus),
  };
  bonusPreview.value = null;
  bonusDialogVisible.value = true;
  // 立刻 trigger preview (initial value)
  refreshBonusPreview();
}

// R1 防呆: bonus 输入变化 → 实时算 tax + bracket
watch(() => bonusForm.value.bonusAmount, (val) => {
  if (!bonusDialogVisible.value) return;
  if (val == null || val < 0) {
    bonusPreview.value = null;
    return;
  }
  refreshBonusPreview();
});

async function refreshBonusPreview() {
  if (!factoryId.value) return;
  const amount = bonusForm.value.bonusAmount;
  if (amount == null || amount < 0) {
    bonusPreview.value = null;
    return;
  }
  bonusPreviewLoading.value = true;
  try {
    const res = await previewAnnualBonusTax(factoryId.value, amount);
    if (res.success && res.data) {
      bonusPreview.value = res.data;
    }
  } catch (e) {
    console.error('年终奖 preview 失败:', e);
  } finally {
    bonusPreviewLoading.value = false;
  }
}

async function handleSubmitAnnualBonus() {
  if (!factoryId.value || !bonusEditingRow.value) return;
  const amount = bonusForm.value.bonusAmount;
  if (amount != null && amount < 0) {
    ElMessage.error('年终奖必须 ≥ 0');
    return;
  }
  bonusSubmitting.value = true;
  try {
    const res = await setAnnualBonus(
      factoryId.value,
      bonusEditingRow.value.id,
      amount === 0 ? null : amount  // 0 视为清空
    );
    if (res.success) {
      ElMessage.success(res.message || '已设置年终奖');
      bonusDialogVisible.value = false;
      await loadList();
    }
  } catch (e) {
    // 4位一体: axios interceptor 已 sticky display message
    console.error('设置年终奖失败:', e);
  } finally {
    bonusSubmitting.value = false;
  }
}

// #833 / #844 follow-up: 工资条 PDF 生成 (客户端 jsPDF + 专项扣除明细).
// 同时拉取该 user+yearMonth ACTIVE 专项扣除明细 (#844 API);
// previewDeductionForMonth 失败时 PDF 仍可生成,仅省略扣除明细。
const exportingId = ref<string | null>(null);
async function handleExportPayslip(row: SalaryItem) {
  if (!factoryId.value) return;
  exportingId.value = row.id;
  try {
    // 1) 拉专项扣除明细 (非阻塞 — 失败仅省略该 section)
    let deductions: SalarySpecialDeduction[] = [];
    try {
      const dedRes = await previewDeductionForMonth(
        factoryId.value,
        row.userId,
        row.yearMonth
      );
      if (dedRes.success && dedRes.data?.activeDeductions) {
        deductions = dedRes.data.activeDeductions;
      }
    } catch (e) {
      // 静默 — PDF 仍可生成,仅省略扣除明细
      console.warn('拉取专项扣除明细失败,PDF 将不含该 section:', e);
    }

    // 2) 生成并下载 PDF
    const fileName = await exportPayslipPDF({
      salary: row,
      deductions,
    });
    ElMessage.success(`已下载 ${fileName}`);
  } catch (e) {
    console.error('工资条 PDF 生成失败:', e);
    ElMessage.error('PDF 生成失败');
  } finally {
    exportingId.value = null;
  }
}
</script>

<template>
  <div class="salaries-page" style="padding: 16px;">
    <el-card>
      <div
        style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;"
      >
        <h2 style="margin: 0;">月度工资单</h2>
        <div>
          <el-button v-if="canWrite" type="primary" :icon="Plus" @click="openCreate">
            新建工资单
          </el-button>
          <el-button
            :icon="Refresh"
            @click="activeTab === 'summary' ? loadSummary() : loadList()"
          >
            刷新
          </el-button>
        </div>
      </div>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="工资单列表" name="list" />
        <el-tab-pane label="月度汇总" name="summary" />
      </el-tabs>

      <!-- 月汇总视图 -->
      <div v-if="activeTab === 'summary'">
        <el-form inline>
          <el-form-item label="月份">
            <el-input
              v-model="summaryYearMonth"
              placeholder="YYYY-MM"
              style="width: 140px;"
              @change="loadSummary"
            />
          </el-form-item>
        </el-form>
        <div v-if="summaryData" v-loading="loading" class="summary-grid">
          <el-statistic
            title="总应发 (¥)"
            :value="Number(summaryData.totalBase)"
            :precision="2"
          />
          <el-statistic
            title="总个人社保 (¥)"
            :value="Number(summaryData.totalSocialEmployee)"
            :precision="2"
          />
          <el-statistic
            title="总个税 (¥)"
            :value="Number(summaryData.totalPersonalTax)"
            :precision="2"
          />
          <el-statistic
            title="总实发 (¥)"
            :value="Number(summaryData.totalNet)"
            :precision="2"
          />
          <el-statistic title="工资单数量" :value="summaryRecordCount" />
        </div>
        <el-empty v-else description="暂无数据" />
      </div>

      <!-- 列表视图 -->
      <div v-else>
        <el-form inline style="margin-bottom: 12px;">
          <el-form-item label="月份">
            <el-input
              v-model="filterYearMonth"
              placeholder="YYYY-MM (留空看全部)"
              clearable
              style="width: 180px;"
            />
          </el-form-item>
          <el-form-item label="状态">
            <el-select
              v-model="filterStatus"
              placeholder="全部"
              clearable
              style="width: 140px;"
            >
              <el-option label="草稿" value="DRAFT" />
              <el-option label="已确认" value="CONFIRMED" />
              <el-option label="已发放" value="PAID" />
            </el-select>
          </el-form-item>
        </el-form>
        <el-table :data="tableData" v-loading="loading" stripe>
          <el-table-column prop="userId" label="员工ID" width="100" />
          <el-table-column prop="yearMonth" label="月份" width="100" />
          <el-table-column prop="baseSalary" label="基本工资" width="110">
            <template #default="{ row }">¥{{ Number(row.baseSalary).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="socialInsuranceEmployee" label="个人社保" width="110">
            <template #default="{ row }">¥{{ Number(row.socialInsuranceEmployee).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="providentFundEmployee" label="个人公积金" width="110">
            <template #default="{ row }">¥{{ Number(row.providentFundEmployee).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="personalTax" label="个税" width="100">
            <template #default="{ row }">¥{{ Number(row.personalTax).toFixed(2) }}</template>
          </el-table-column>
          <!-- #833 follow-up: 年终奖 + 年终奖个税 (nullable) -->
          <el-table-column prop="annualBonus" label="年终奖" width="110">
            <template #default="{ row }">
              <span v-if="row.annualBonus != null">¥{{ Number(row.annualBonus).toFixed(2) }}</span>
              <span v-else style="color: #c0c4cc;">—</span>
            </template>
          </el-table-column>
          <el-table-column prop="annualBonusTax" label="年终奖个税" width="110">
            <template #default="{ row }">
              <span v-if="row.annualBonusTax != null">¥{{ Number(row.annualBonusTax).toFixed(2) }}</span>
              <span v-else style="color: #c0c4cc;">—</span>
            </template>
          </el-table-column>
          <el-table-column prop="netSalary" label="实发" width="110">
            <template #default="{ row }">
              <strong>¥{{ Number(row.netSalary).toFixed(2) }}</strong>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="STATUS_TAG_TYPE[row.status as SalaryStatus]">
                {{ STATUS_LABEL[row.status as SalaryStatus] || row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" show-overflow-tooltip />
          <el-table-column label="操作" width="380" fixed="right">
            <template #default="{ row }">
              <template v-if="canWrite && row.status === 'DRAFT'">
                <el-button size="small" @click="openEdit(row)">编辑</el-button>
                <el-button size="small" type="success" @click="handleConfirm(row)">
                  确认
                </el-button>
                <el-button size="small" type="danger" @click="handleDelete(row)">
                  删除
                </el-button>
              </template>
              <template v-else-if="canWrite && row.status === 'CONFIRMED'">
                <el-button size="small" @click="openEdit(row)">编辑备注</el-button>
                <el-button size="small" type="primary" @click="handleMarkPaid(row)">
                  标记发放
                </el-button>
              </template>
              <!-- #833 follow-up: 设置年终奖 — DRAFT/CONFIRMED 可改, PAID 锁 -->
              <el-button
                v-if="canEditAnnualBonus(row)"
                size="small"
                @click="openAnnualBonusDialog(row)"
              >
                {{ row.annualBonus != null ? '改年终奖' : '设年终奖' }}
              </el-button>
              <!-- #833 / #844 follow-up: 工资条 PDF — 全状态可下载 (草稿亦可预览) -->
              <el-button
                size="small"
                :loading="exportingId === row.id"
                @click="handleExportPayslip(row)"
              >
                下载工资条
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          style="margin-top: 16px; justify-content: flex-end;"
          @current-change="loadList"
          @size-change="loadList"
        />
      </div>
    </el-card>

    <!-- R1 防呆: 创建/编辑对话框, base 变化实时显示 social/tax/net preview -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '新建月度工资单' : '编辑月度工资单'"
      width="640px"
    >
      <el-form :model="formData" label-width="100px">
        <el-form-item label="员工 userId" required>
          <el-input-number
            v-model="formData.userId"
            :min="1"
            :precision="0"
            :disabled="dialogMode === 'edit'"
            style="width: 200px;"
          />
        </el-form-item>
        <el-form-item label="月份" required>
          <el-input
            v-model="formData.yearMonth"
            placeholder="YYYY-MM"
            :disabled="dialogMode === 'edit'"
            style="width: 200px;"
          />
        </el-form-item>
        <el-form-item label="基本工资" required>
          <el-input-number
            v-model="formData.baseSalary"
            :min="0"
            :step="100"
            :precision="2"
            style="width: 200px;"
          />
          <span style="margin-left: 12px; color: #909399; font-size: 12px;">
            (输入后实时算社保 + 个税 + 实发)
          </span>
        </el-form-item>

        <!-- R1 防呆: 实时 preview -->
        <el-alert
          v-if="previewData"
          :type="previewData.netSalary > 0 ? 'success' : 'info'"
          :closable="false"
          show-icon
          style="margin-bottom: 16px;"
        >
          <template #title>
            <div style="font-weight: 600;">
              实发预览: ¥{{ Number(previewData.netSalary).toFixed(2) }}
            </div>
          </template>
          <template #default>
            <div style="font-size: 13px; line-height: 1.8;">
              <div>
                基本工资 ¥{{ Number(previewData.baseSalary).toFixed(2) }}
                - 个人社保 ¥{{ Number(previewData.socialInsuranceEmployee).toFixed(2) }} (10.5%)
                - 个人公积金 ¥{{ Number(previewData.providentFundEmployee).toFixed(2) }} (8%)
              </div>
              <div>
                应税收入 ¥{{ Number(previewData.taxableIncome).toFixed(2) }}
                → 个税 ¥{{ Number(previewData.personalTax).toFixed(2) }}
              </div>
              <div style="color: #909399; margin-top: 4px;">
                单位社保 ¥{{ Number(previewData.socialInsuranceEmployer).toFixed(2) }} (26%) +
                单位公积金 ¥{{ Number(previewData.providentFundEmployer).toFixed(2) }} (8%) (info-only)
              </div>
            </div>
          </template>
        </el-alert>
        <el-alert
          v-else-if="previewLoading"
          type="info"
          title="计算中..."
          :closable="false"
          style="margin-bottom: 16px;"
        />

        <el-form-item label="备注">
          <el-input
            v-model="formData.remark"
            type="textarea"
            :rows="2"
            placeholder="可选, 简要说明"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="dialogSubmitting"
          @click="handleSubmit"
        >
          {{ dialogMode === 'create' ? '保存草稿' : '保存修改' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- #833 follow-up: 年终奖编辑对话框 — R1 防呆 实时预览 tax + bracket -->
    <el-dialog
      v-model="bonusDialogVisible"
      title="设置年终奖"
      width="640px"
    >
      <div v-if="bonusEditingRow" style="margin-bottom: 12px; color: #606266; font-size: 13px;">
        <strong>员工 {{ bonusEditingRow.userId }}</strong> / 月份
        <strong>{{ bonusEditingRow.yearMonth }}</strong> / 实发
        <strong>¥{{ Number(bonusEditingRow.netSalary).toFixed(2) }}</strong>
      </div>
      <el-form :model="bonusForm" label-width="100px">
        <el-form-item label="年终奖 (¥)" required>
          <el-input-number
            v-model="bonusForm.bonusAmount"
            :min="0"
            :step="1000"
            :precision="2"
            style="width: 240px;"
          />
          <span style="margin-left: 12px; color: #909399; font-size: 12px;">
            (留 0 = 该月无年终奖)
          </span>
        </el-form-item>

        <!-- R1 防呆: 实时 tax + bracket preview -->
        <el-alert
          v-if="bonusPreview"
          :type="bonusPreview.annualBonusTax > 0 ? 'warning' : 'info'"
          :closable="false"
          show-icon
          style="margin-bottom: 16px;"
        >
          <template #title>
            <div style="font-weight: 600;">
              税额预览: ¥{{ Number(bonusPreview.annualBonusTax).toFixed(2) }}
              (税率 {{ bonusPreview.bracketRate }} / 档位 {{ bonusPreview.bracketLabel }})
            </div>
          </template>
          <template #default>
            <div style="font-size: 13px; line-height: 1.8;">
              <div>
                年终奖 ¥{{ Number(bonusPreview.annualBonus).toFixed(2) }}
                ÷ 12 = 月度等价 ¥{{ Number(bonusPreview.monthlyEquivalent).toFixed(2) }}
                → 档位 {{ bonusPreview.bracketLabel }}
              </div>
              <div>
                税额 = ¥{{ Number(bonusPreview.annualBonus).toFixed(2) }}
                × {{ bonusPreview.bracketRate }}
                − ¥{{ Number(bonusPreview.quickDeduction).toFixed(2) }} (速算扣除)
                = ¥{{ Number(bonusPreview.annualBonusTax).toFixed(2) }}
              </div>
              <div style="color: #909399; margin-top: 4px;">
                按中国一次性年终奖税法 (独立于月度个税)
              </div>
            </div>
          </template>
        </el-alert>
        <el-alert
          v-else-if="bonusPreviewLoading"
          type="info"
          title="计算中..."
          :closable="false"
          style="margin-bottom: 16px;"
        />
      </el-form>

      <template #footer>
        <el-button @click="bonusDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="bonusSubmitting"
          @click="handleSubmitAnnualBonus"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  padding: 24px;
}
</style>
