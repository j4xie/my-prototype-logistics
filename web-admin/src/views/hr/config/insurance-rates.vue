<script setup lang="ts">
/**
 * #833 H-WAGE follow-up — 工厂级 社保 / 公积金 费率配置页面.
 *
 * 单表单配置编辑器:
 *   - 显示当前 ACTIVE 配置 (8 费率 + 缴费基数上下限 + effectiveFrom)
 *   - 实时预览: 用 baseSalary 试算"改后 vs 当前"差异 (R1 防呆)
 *   - 历史版本列表 (含 ACTIVE + ARCHIVED, 含 admin + timestamp + 备注)
 *   - "重置为法定默认值" button (R5 防呆)
 *
 * @since 2026-05-18
 */
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh, RefreshLeft } from '@element-plus/icons-vue';
import {
  getCurrentInsuranceConfig,
  saveInsuranceConfig,
  listInsuranceConfigHistory,
  resetInsuranceConfigDefaults,
  type HrInsuranceConfig,
  type SaveInsuranceConfigPayload,
} from '@/api/insuranceConfig';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('hr'));

// ============= state =============
const loading = ref(false);
const submitting = ref(false);
const resetting = ref(false);
const currentConfig = ref<HrInsuranceConfig | null>(null);
const historyList = ref<HrInsuranceConfig[]>([]);

// 表单 (rate 字段以百分比显示, 提交时除以 100 → 0~1 小数)
const formData = ref({
  employeePensionRate: 8.00,
  employerPensionRate: 16.00,
  employeeMedicalRate: 2.00,
  employerMedicalRate: 8.00,
  employeeUnemploymentRate: 0.50,
  employerUnemploymentRate: 0.50,
  employeeProvidentFundRate: 8.00,
  employerProvidentFundRate: 8.00,
  baseSalaryLowerBound: null as number | null,
  baseSalaryUpperBound: null as number | null,
  effectiveFrom: nextMonthFirstDay(),
  remark: '',
});

// R1 防呆 试算 baseSalary
const previewBaseSalary = ref(10000);

function nextMonthFirstDay(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function currentMonthFirstDay(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ============= computed previews =============
// 当前 (DB) 费率合计
const currentEmployeeSocialPct = computed(() => {
  if (!currentConfig.value) return 0;
  return (
    Number(currentConfig.value.employeePensionRate) +
    Number(currentConfig.value.employeeMedicalRate) +
    Number(currentConfig.value.employeeUnemploymentRate)
  ) * 100;
});
const currentEmployerSocialPct = computed(() => {
  if (!currentConfig.value) return 0;
  return (
    Number(currentConfig.value.employerPensionRate) +
    Number(currentConfig.value.employerMedicalRate) +
    Number(currentConfig.value.employerUnemploymentRate)
  ) * 100;
});

// 表单 (待提交) 费率合计
const formEmployeeSocialPct = computed(() => {
  return (
    formData.value.employeePensionRate +
    formData.value.employeeMedicalRate +
    formData.value.employeeUnemploymentRate
  );
});
const formEmployerSocialPct = computed(() => {
  return (
    formData.value.employerPensionRate +
    formData.value.employerMedicalRate +
    formData.value.employerUnemploymentRate
  );
});

// R1 防呆 试算: 当前 vs 改后
interface PreviewRow {
  label: string;
  currentAmount: number;
  newAmount: number;
  diff: number;
}

const previewRows = computed<PreviewRow[]>(() => {
  const base = previewBaseSalary.value || 0;
  if (!currentConfig.value) return [];

  const cur = currentConfig.value;
  const calc = (rate: number) => Math.round(base * rate * 100) / 100;

  const rows: PreviewRow[] = [];
  rows.push({
    label: '个人社保 (养老+医疗+失业)',
    currentAmount: calc(currentEmployeeSocialPct.value / 100),
    newAmount: calc(formEmployeeSocialPct.value / 100),
    diff: 0,
  });
  rows.push({
    label: '单位社保 (info-only)',
    currentAmount: calc(currentEmployerSocialPct.value / 100),
    newAmount: calc(formEmployerSocialPct.value / 100),
    diff: 0,
  });
  rows.push({
    label: '个人公积金',
    currentAmount: calc(Number(cur.employeeProvidentFundRate)),
    newAmount: calc(formData.value.employeeProvidentFundRate / 100),
    diff: 0,
  });
  rows.push({
    label: '单位公积金 (info-only)',
    currentAmount: calc(Number(cur.employerProvidentFundRate)),
    newAmount: calc(formData.value.employerProvidentFundRate / 100),
    diff: 0,
  });
  rows.forEach((r) => {
    r.diff = Math.round((r.newAmount - r.currentAmount) * 100) / 100;
  });
  return rows;
});

// ============= lifecycle =============
onMounted(async () => {
  await Promise.all([loadCurrent(), loadHistory()]);
});

watch(currentConfig, (val) => {
  if (val) {
    // 把当前 DB 值填进 form (作为编辑起点)
    formData.value.employeePensionRate = Number(val.employeePensionRate) * 100;
    formData.value.employerPensionRate = Number(val.employerPensionRate) * 100;
    formData.value.employeeMedicalRate = Number(val.employeeMedicalRate) * 100;
    formData.value.employerMedicalRate = Number(val.employerMedicalRate) * 100;
    formData.value.employeeUnemploymentRate = Number(val.employeeUnemploymentRate) * 100;
    formData.value.employerUnemploymentRate = Number(val.employerUnemploymentRate) * 100;
    formData.value.employeeProvidentFundRate = Number(val.employeeProvidentFundRate) * 100;
    formData.value.employerProvidentFundRate = Number(val.employerProvidentFundRate) * 100;
    formData.value.baseSalaryLowerBound = val.baseSalaryLowerBound ?? null;
    formData.value.baseSalaryUpperBound = val.baseSalaryUpperBound ?? null;
  }
});

async function loadCurrent() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const res = await getCurrentInsuranceConfig(factoryId.value);
    if (res.success && res.data) {
      currentConfig.value = res.data;
    }
  } catch (e) {
    console.error('加载当前配置失败:', e);
  } finally {
    loading.value = false;
  }
}

async function loadHistory() {
  if (!factoryId.value) return;
  try {
    const res = await listInsuranceConfigHistory(factoryId.value);
    if (res.success && res.data) {
      historyList.value = res.data;
    }
  } catch (e) {
    console.error('加载历史失败:', e);
  }
}

// ============= validation (R1 防呆) =============
function validateForm(): string | null {
  const rates = [
    ['employeePensionRate', formData.value.employeePensionRate],
    ['employerPensionRate', formData.value.employerPensionRate],
    ['employeeMedicalRate', formData.value.employeeMedicalRate],
    ['employerMedicalRate', formData.value.employerMedicalRate],
    ['employeeUnemploymentRate', formData.value.employeeUnemploymentRate],
    ['employerUnemploymentRate', formData.value.employerUnemploymentRate],
    ['employeeProvidentFundRate', formData.value.employeeProvidentFundRate],
    ['employerProvidentFundRate', formData.value.employerProvidentFundRate],
  ] as const;
  for (const [name, val] of rates) {
    if (val == null || isNaN(val) || val < 0 || val > 30) {
      return `${name} 必须在 0% ~ 30% 之间 (got ${val})`;
    }
  }
  if (
    formData.value.baseSalaryLowerBound != null &&
    formData.value.baseSalaryUpperBound != null &&
    formData.value.baseSalaryLowerBound > formData.value.baseSalaryUpperBound
  ) {
    return `缴费基数下限 ¥${formData.value.baseSalaryLowerBound} 不可大于上限 ¥${formData.value.baseSalaryUpperBound}`;
  }
  if (!formData.value.effectiveFrom || !/^\d{4}-\d{2}-\d{2}$/.test(formData.value.effectiveFrom)) {
    return 'effectiveFrom 格式必须为 YYYY-MM-DD';
  }
  return null;
}

// ============= submit =============
async function handleSave() {
  if (!factoryId.value) return;
  const err = validateForm();
  if (err) {
    ElMessage.error(err);
    return;
  }
  try {
    await ElMessageBox.confirm(
      `保存后将归档当前配置, 新费率从 ${formData.value.effectiveFrom} 起生效. 确认?`,
      '保存配置',
      { confirmButtonText: '保存', cancelButtonText: '取消', type: 'warning' }
    );
  } catch {
    return;
  }

  submitting.value = true;
  try {
    const payload: SaveInsuranceConfigPayload = {
      employeePensionRate: round4(formData.value.employeePensionRate / 100),
      employerPensionRate: round4(formData.value.employerPensionRate / 100),
      employeeMedicalRate: round4(formData.value.employeeMedicalRate / 100),
      employerMedicalRate: round4(formData.value.employerMedicalRate / 100),
      employeeUnemploymentRate: round4(formData.value.employeeUnemploymentRate / 100),
      employerUnemploymentRate: round4(formData.value.employerUnemploymentRate / 100),
      employeeProvidentFundRate: round4(formData.value.employeeProvidentFundRate / 100),
      employerProvidentFundRate: round4(formData.value.employerProvidentFundRate / 100),
      baseSalaryLowerBound: formData.value.baseSalaryLowerBound ?? null,
      baseSalaryUpperBound: formData.value.baseSalaryUpperBound ?? null,
      effectiveFrom: formData.value.effectiveFrom,
      remark: formData.value.remark || undefined,
    };
    const res = await saveInsuranceConfig(factoryId.value, payload);
    if (res.success) {
      ElMessage.success(res.message || '已保存');
      await Promise.all([loadCurrent(), loadHistory()]);
    }
  } catch (e) {
    // 4位一体: 全局 axios interceptor 已 sticky display backend message
    console.error('保存失败:', e);
  } finally {
    submitting.value = false;
  }
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

// R5 防呆: 重置为法定默认值
async function handleReset() {
  if (!factoryId.value) return;
  try {
    await ElMessageBox.confirm(
      '将归档当前配置并恢复为法定默认值 (个人养老8% / 医疗2% / 失业0.5% / 公积金8%; 单位养老16% / 医疗8% / 失业0.5% / 公积金8%). 确认?',
      '重置为法定默认',
      { confirmButtonText: '重置', cancelButtonText: '取消', type: 'warning' }
    );
  } catch {
    return;
  }
  resetting.value = true;
  try {
    const res = await resetInsuranceConfigDefaults(factoryId.value);
    if (res.success) {
      ElMessage.success(res.message || '已重置为法定默认');
      await Promise.all([loadCurrent(), loadHistory()]);
    }
  } catch (e) {
    console.error('重置失败:', e);
  } finally {
    resetting.value = false;
  }
}

function formatPct(v: number | string | null | undefined): string {
  if (v == null) return '-';
  return (Number(v) * 100).toFixed(2) + '%';
}

function formatTs(v?: string | null): string {
  if (!v) return '-';
  // ISO -> "2026-05-18 14:32"
  return v.replace('T', ' ').substring(0, 16);
}
</script>

<template>
  <div class="insurance-config-page" style="padding: 16px;">
    <!-- ============ 当前配置 ============ -->
    <el-card v-loading="loading">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 16px; font-weight: 600;">
            社保 / 公积金 费率配置 (工厂级)
          </span>
          <el-button :icon="Refresh" @click="loadCurrent">刷新</el-button>
        </div>
      </template>

      <el-descriptions
        v-if="currentConfig"
        :column="4"
        border
        title="当前生效"
      >
        <el-descriptions-item label="生效起始">
          {{ currentConfig.effectiveFrom }}
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag type="success">{{ currentConfig.status }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="个人社保合计">
          <strong>{{ currentEmployeeSocialPct.toFixed(2) }}%</strong>
        </el-descriptions-item>
        <el-descriptions-item label="单位社保合计">
          {{ currentEmployerSocialPct.toFixed(2) }}%
        </el-descriptions-item>

        <el-descriptions-item label="个人养老">{{ formatPct(currentConfig.employeePensionRate) }}</el-descriptions-item>
        <el-descriptions-item label="个人医疗">{{ formatPct(currentConfig.employeeMedicalRate) }}</el-descriptions-item>
        <el-descriptions-item label="个人失业">{{ formatPct(currentConfig.employeeUnemploymentRate) }}</el-descriptions-item>
        <el-descriptions-item label="个人公积金">{{ formatPct(currentConfig.employeeProvidentFundRate) }}</el-descriptions-item>

        <el-descriptions-item label="单位养老">{{ formatPct(currentConfig.employerPensionRate) }}</el-descriptions-item>
        <el-descriptions-item label="单位医疗">{{ formatPct(currentConfig.employerMedicalRate) }}</el-descriptions-item>
        <el-descriptions-item label="单位失业">{{ formatPct(currentConfig.employerUnemploymentRate) }}</el-descriptions-item>
        <el-descriptions-item label="单位公积金">{{ formatPct(currentConfig.employerProvidentFundRate) }}</el-descriptions-item>

        <el-descriptions-item label="缴费基数下限" :span="2">
          {{ currentConfig.baseSalaryLowerBound != null ? '¥' + currentConfig.baseSalaryLowerBound : '不限' }}
        </el-descriptions-item>
        <el-descriptions-item label="缴费基数上限" :span="2">
          {{ currentConfig.baseSalaryUpperBound != null ? '¥' + currentConfig.baseSalaryUpperBound : '不限' }}
        </el-descriptions-item>
        <el-descriptions-item label="备注" :span="4">
          {{ currentConfig.remark || '-' }}
        </el-descriptions-item>
      </el-descriptions>

      <el-empty v-else description="尚无配置" />
    </el-card>

    <!-- ============ 编辑表单 ============ -->
    <el-card v-if="canWrite" style="margin-top: 16px;">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 16px; font-weight: 600;">修改费率 (将创建新版本)</span>
          <el-button
            :icon="RefreshLeft"
            type="warning"
            plain
            :loading="resetting"
            @click="handleReset"
          >
            重置为法定默认
          </el-button>
        </div>
      </template>

      <el-form label-width="160px" label-position="right">
        <el-divider content-position="left">个人缴费 (从工资扣)</el-divider>
        <el-row :gutter="16">
          <el-col :span="6">
            <el-form-item label="养老 %">
              <el-input-number
                v-model="formData.employeePensionRate"
                :min="0"
                :max="30"
                :precision="2"
                :step="0.1"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="医疗 %">
              <el-input-number
                v-model="formData.employeeMedicalRate"
                :min="0"
                :max="30"
                :precision="2"
                :step="0.1"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="失业 %">
              <el-input-number
                v-model="formData.employeeUnemploymentRate"
                :min="0"
                :max="30"
                :precision="2"
                :step="0.1"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="公积金 %">
              <el-input-number
                v-model="formData.employeeProvidentFundRate"
                :min="0"
                :max="30"
                :precision="2"
                :step="0.1"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">单位缴费 (info-only, 不扣员工)</el-divider>
        <el-row :gutter="16">
          <el-col :span="6">
            <el-form-item label="养老 %">
              <el-input-number
                v-model="formData.employerPensionRate"
                :min="0"
                :max="30"
                :precision="2"
                :step="0.1"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="医疗 %">
              <el-input-number
                v-model="formData.employerMedicalRate"
                :min="0"
                :max="30"
                :precision="2"
                :step="0.1"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="失业 %">
              <el-input-number
                v-model="formData.employerUnemploymentRate"
                :min="0"
                :max="30"
                :precision="2"
                :step="0.1"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="公积金 %">
              <el-input-number
                v-model="formData.employerProvidentFundRate"
                :min="0"
                :max="30"
                :precision="2"
                :step="0.1"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">缴费基数 (¥元, 留空 = 不限)</el-divider>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="基数下限">
              <el-input-number
                v-model="formData.baseSalaryLowerBound"
                :min="0"
                :precision="2"
                :step="100"
                placeholder="例: 3000"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="基数上限">
              <el-input-number
                v-model="formData.baseSalaryUpperBound"
                :min="0"
                :precision="2"
                :step="100"
                placeholder="例: 30000"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="生效起始">
              <el-input v-model="formData.effectiveFrom" placeholder="YYYY-MM-DD" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="备注">
          <el-input
            v-model="formData.remark"
            type="textarea"
            :rows="2"
            placeholder="可选: 例如 '2026 年 6 月昆山市公积金率调整'"
          />
        </el-form-item>

        <!-- ============ R1 防呆 试算 ============ -->
        <el-divider content-position="left">R1 试算: 当前 vs 改后 (实时)</el-divider>
        <el-form-item label="试算基本工资 ¥">
          <el-input-number
            v-model="previewBaseSalary"
            :min="0"
            :precision="2"
            :step="500"
            style="width: 200px;"
          />
        </el-form-item>
        <el-table
          v-if="currentConfig"
          :data="previewRows"
          stripe
          style="margin-bottom: 16px;"
        >
          <el-table-column prop="label" label="项目" min-width="200" />
          <el-table-column label="当前 (DB)" min-width="120" align="right">
            <template #default="{ row }">¥{{ row.currentAmount.toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="改后" min-width="120" align="right">
            <template #default="{ row }">¥{{ row.newAmount.toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="差额" min-width="120" align="right">
            <template #default="{ row }">
              <span
                :style="{
                  color: row.diff > 0 ? '#f56c6c' : row.diff < 0 ? '#67c23a' : '#909399',
                  fontWeight: row.diff !== 0 ? '600' : 'normal',
                }"
              >
                {{ row.diff > 0 ? '+' : '' }}¥{{ row.diff.toFixed(2) }}
              </span>
            </template>
          </el-table-column>
        </el-table>

        <el-form-item>
          <el-button
            type="primary"
            :loading="submitting"
            @click="handleSave"
          >
            保存配置 (创建新版本)
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- ============ 历史版本 (R2 防呆: admin + timestamp) ============ -->
    <el-card style="margin-top: 16px;">
      <template #header>
        <span style="font-size: 16px; font-weight: 600;">
          历史版本 ({{ historyList.length }})
        </span>
      </template>
      <el-table :data="historyList" stripe>
        <el-table-column label="生效起始" prop="effectiveFrom" min-width="120" />
        <el-table-column label="状态" min-width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">
              {{ row.status === 'ACTIVE' ? '当前生效' : '已归档' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="个人社保%" min-width="110" align="right">
          <template #default="{ row }">
            {{ (
              (Number(row.employeePensionRate) +
                Number(row.employeeMedicalRate) +
                Number(row.employeeUnemploymentRate)) * 100
            ).toFixed(2) }}%
          </template>
        </el-table-column>
        <el-table-column label="单位社保%" min-width="110" align="right">
          <template #default="{ row }">
            {{ (
              (Number(row.employerPensionRate) +
                Number(row.employerMedicalRate) +
                Number(row.employerUnemploymentRate)) * 100
            ).toFixed(2) }}%
          </template>
        </el-table-column>
        <el-table-column label="个人公积金%" min-width="110" align="right">
          <template #default="{ row }">
            {{ formatPct(row.employeeProvidentFundRate) }}
          </template>
        </el-table-column>
        <el-table-column label="单位公积金%" min-width="110" align="right">
          <template #default="{ row }">
            {{ formatPct(row.employerProvidentFundRate) }}
          </template>
        </el-table-column>
        <el-table-column label="操作人 (userId)" prop="createdBy" min-width="120" />
        <el-table-column label="创建时间" min-width="150">
          <template #default="{ row }">{{ formatTs(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="备注" prop="remark" min-width="200" show-overflow-tooltip />
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.insurance-config-page :deep(.el-descriptions__label) {
  width: 100px;
}
</style>
