<script setup lang="ts">
/**
 * #863 follow-up — 城市差异化 社保 / 公积金 配置覆盖 管理页面.
 *
 * 主要功能:
 *   - 列出工厂已配置城市 (城市代号 / 中文名 / 缴费基数上下限 / 当前生效起始月)
 *   - 添加 / 编辑某城市覆盖 (缴费基数必填 + 可选费率覆盖 jsonb)
 *   - R1 防呆: 缴费基数 preview "员工 X 月薪 ¥Y → 缴基 ¥Z (受 上海上限 ¥W 影响)"
 *   - R2 防呆: 所有消息含 cityName + factoryId + bound context
 *   - R4 防呆: (factory, city) 后端 unique partial index 保证
 *   - R5 防呆: 城市列表为空 → 大按钮"添加首个城市覆盖"
 *   - 软删除已配置城市 (该城市员工后续按工厂默认计算)
 *
 * 不在本 MVP 内: 员工→城市分配 UI / 32 China 省级 dropdown / 自动从地址识别.
 *
 * @since 2026-05-18
 */
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Refresh, Setting, Delete } from '@element-plus/icons-vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import {
  listCityOverrides,
  saveCityOverride,
  deleteCityOverride,
  getCityEffective,
  type HrCityInsuranceOverride,
  type SaveCityOverridePayload,
} from '@/api/cityInsuranceOverride';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('hr'));

// ============= state =============
const loading = ref(false);
const submitting = ref(false);
const rows = ref<HrCityInsuranceOverride[]>([]);
const dialogVisible = ref(false);
const editing = ref<HrCityInsuranceOverride | null>(null);

// 常用城市快捷选项 (UI hint only, 用户可填任意 ASCII 城市代号)
const COMMON_CITIES = [
  { code: 'BEIJING', name: '北京' },
  { code: 'SHANGHAI', name: '上海' },
  { code: 'SHENZHEN', name: '深圳' },
  { code: 'GUANGZHOU', name: '广州' },
  { code: 'HANGZHOU', name: '杭州' },
  { code: 'CHENGDU', name: '成都' },
  { code: 'NANJING', name: '南京' },
  { code: 'KUNSHAN', name: '昆山' },
  { code: 'SUZHOU', name: '苏州' },
];

interface RateOverrideRow {
  key: string;
  label: string;
  enabled: boolean;
  percent: number; // 0~30
}

const formData = ref({
  cityCode: '',
  cityName: '',
  baseSalaryLowerBound: 5000,
  baseSalaryUpperBound: 30000,
  effectiveFrom: nextMonthFirstDay(),
  remark: '',
});

const rateOverrides = ref<RateOverrideRow[]>([
  { key: 'employeePensionRate', label: '个人养老', enabled: false, percent: 8 },
  { key: 'employerPensionRate', label: '单位养老', enabled: false, percent: 16 },
  { key: 'employeeMedicalRate', label: '个人医疗', enabled: false, percent: 2 },
  { key: 'employerMedicalRate', label: '单位医疗', enabled: false, percent: 8 },
  { key: 'employeeUnemploymentRate', label: '个人失业', enabled: false, percent: 0.5 },
  { key: 'employerUnemploymentRate', label: '单位失业', enabled: false, percent: 0.5 },
  { key: 'employeeProvidentFundRate', label: '个人公积金', enabled: false, percent: 8 },
  { key: 'employerProvidentFundRate', label: '单位公积金', enabled: false, percent: 8 },
]);

// R1 防呆: 缴费基数预览 (示例月薪 → cap 后基数)
const previewMonthlySalary = ref(10000);
const previewCappedBase = computed(() => {
  const sal = previewMonthlySalary.value || 0;
  const lower = formData.value.baseSalaryLowerBound;
  const upper = formData.value.baseSalaryUpperBound;
  if (sal <= 0) return 0;
  if (lower != null && sal < lower) return lower;
  if (upper != null && sal > upper) return upper;
  return sal;
});

const previewCapReason = computed(() => {
  const sal = previewMonthlySalary.value || 0;
  const lower = formData.value.baseSalaryLowerBound;
  const upper = formData.value.baseSalaryUpperBound;
  if (sal <= 0) return '请输入月薪';
  if (lower != null && sal < lower) {
    return `月薪 ¥${sal} 低于下限 ¥${lower}, 缴基按下限计算`;
  }
  if (upper != null && sal > upper) {
    return `月薪 ¥${sal} 超过上限 ¥${upper}, 缴基按上限封顶`;
  }
  return `月薪 ¥${sal} 在范围内, 缴基 = 月薪`;
});

function nextMonthFirstDay(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ============= lifecycle =============
onMounted(() => {
  void loadRows();
});

async function loadRows() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const res = await listCityOverrides(factoryId.value);
    if (res.success && Array.isArray(res.data)) {
      rows.value = res.data;
    }
  } catch (e) {
    console.error('加载城市覆盖列表失败:', e);
  } finally {
    loading.value = false;
  }
}

// ============= 添加 / 编辑 =============
function openAddDialog() {
  editing.value = null;
  formData.value = {
    cityCode: '',
    cityName: '',
    baseSalaryLowerBound: 5000,
    baseSalaryUpperBound: 30000,
    effectiveFrom: nextMonthFirstDay(),
    remark: '',
  };
  rateOverrides.value.forEach((r) => {
    r.enabled = false;
  });
  dialogVisible.value = true;
}

function openEditDialog(row: HrCityInsuranceOverride) {
  editing.value = row;
  formData.value = {
    cityCode: row.cityCode,
    cityName: row.cityName ?? '',
    baseSalaryLowerBound: Number(row.baseSalaryLowerBound),
    baseSalaryUpperBound: Number(row.baseSalaryUpperBound),
    effectiveFrom: row.effectiveFrom,
    remark: row.remark ?? '',
  };
  rateOverrides.value.forEach((r) => {
    if (row.overrideRates && row.overrideRates[r.key] != null) {
      r.enabled = true;
      r.percent = Number(row.overrideRates[r.key]) * 100;
    } else {
      r.enabled = false;
    }
  });
  dialogVisible.value = true;
}

function pickCommonCity(code: string, name: string) {
  formData.value.cityCode = code;
  formData.value.cityName = name;
}

// R1 client-side validation (server 端也会校验, 这里给出即时提示)
function validateForm(): string | null {
  if (!formData.value.cityCode || !formData.value.cityCode.trim()) {
    return '请填写城市代号 (e.g. SHANGHAI / BEIJING)';
  }
  if (
    formData.value.baseSalaryLowerBound == null ||
    formData.value.baseSalaryUpperBound == null
  ) {
    return '缴费基数上下限必填';
  }
  if (
    formData.value.baseSalaryLowerBound < 0 ||
    formData.value.baseSalaryUpperBound < 0
  ) {
    return '缴费基数必须 ≥ 0';
  }
  if (
    formData.value.baseSalaryLowerBound > formData.value.baseSalaryUpperBound
  ) {
    return `缴费基数下限 ¥${formData.value.baseSalaryLowerBound} 不可大于上限 ¥${formData.value.baseSalaryUpperBound}`;
  }
  if (!formData.value.effectiveFrom || !/^\d{4}-\d{2}-\d{2}$/.test(formData.value.effectiveFrom)) {
    return 'effectiveFrom 格式必须为 YYYY-MM-DD';
  }
  for (const r of rateOverrides.value) {
    if (!r.enabled) continue;
    if (isNaN(r.percent) || r.percent < 0 || r.percent > 30) {
      return `${r.label} 必须在 0% ~ 30% 之间 (got ${r.percent})`;
    }
  }
  return null;
}

async function handleSave() {
  if (!factoryId.value) return;
  const err = validateForm();
  if (err) {
    ElMessage.error(err);
    return;
  }

  // 收集 enabled 的 overrideRates → jsonb
  const overrideRates: Record<string, number> = {};
  for (const r of rateOverrides.value) {
    if (r.enabled) {
      overrideRates[r.key] = Math.round((r.percent / 100) * 10000) / 10000;
    }
  }

  try {
    const action = editing.value ? '更新' : '保存';
    await ElMessageBox.confirm(
      `${action}后将归档当前 [${formData.value.cityCode}] 城市覆盖, 新配置从 ${formData.value.effectiveFrom} 起生效. 确认?`,
      `${action}城市覆盖`,
      { confirmButtonText: action, cancelButtonText: '取消', type: 'warning' }
    );
  } catch {
    return;
  }

  submitting.value = true;
  try {
    const payload: SaveCityOverridePayload = {
      cityCode: formData.value.cityCode.trim().toUpperCase(),
      cityName: formData.value.cityName?.trim() || undefined,
      baseSalaryLowerBound: formData.value.baseSalaryLowerBound,
      baseSalaryUpperBound: formData.value.baseSalaryUpperBound,
      overrideRates: Object.keys(overrideRates).length > 0 ? overrideRates : undefined,
      effectiveFrom: formData.value.effectiveFrom,
      remark: formData.value.remark?.trim() || undefined,
    };
    const res = await saveCityOverride(factoryId.value, payload);
    if (res.success) {
      ElMessage.success(res.message || '已保存');
      dialogVisible.value = false;
      await loadRows();
    }
  } catch (e) {
    // 4位一体: axios interceptor sticky display backend message
    console.error('保存城市覆盖失败:', e);
  } finally {
    submitting.value = false;
  }
}

// ============= 删除 =============
async function handleDelete(row: HrCityInsuranceOverride) {
  if (!factoryId.value) return;
  try {
    await ElMessageBox.confirm(
      `删除 [${row.cityCode}${row.cityName ? ' / ' + row.cityName : ''}] 城市覆盖? 该城市员工后续按工厂默认配置计算 (不影响历史工资单).`,
      '删除城市覆盖',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    );
  } catch {
    return;
  }
  try {
    const res = await deleteCityOverride(factoryId.value, row.id);
    if (res.success) {
      ElMessage.success(res.message || '已删除');
      await loadRows();
    }
  } catch (e) {
    console.error('删除城市覆盖失败:', e);
  }
}

// ============= effective preview =============
const previewLoading = ref(false);
async function handlePreviewEffective(row: HrCityInsuranceOverride) {
  if (!factoryId.value) return;
  previewLoading.value = true;
  try {
    const res = await getCityEffective(factoryId.value, row.cityCode);
    if (res.success && res.data) {
      const cfg = res.data;
      const msg = [
        `城市 ${row.cityCode}${row.cityName ? ` (${row.cityName})` : ''}`,
        `缴费基数: ¥${cfg.baseSalaryLowerBound} ~ ¥${cfg.baseSalaryUpperBound}`,
        `个人社保: 养老 ${formatPct(cfg.employeePensionRate)} + 医疗 ${formatPct(cfg.employeeMedicalRate)} + 失业 ${formatPct(cfg.employeeUnemploymentRate)}`,
        `个人公积金: ${formatPct(cfg.employeeProvidentFundRate)}`,
      ].join('\n');
      void ElMessageBox.alert(msg, `[工厂 ${factoryId.value}] 合并后生效配置`, {
        confirmButtonText: '了解',
      });
    }
  } catch (e) {
    console.error('查询 effective 失败:', e);
  } finally {
    previewLoading.value = false;
  }
}

function formatPct(v: number | string | null | undefined): string {
  if (v == null) return '0%';
  const num = Number(v) * 100;
  return `${num.toFixed(2)}%`;
}

function formatCurrency(v: number | null | undefined): string {
  if (v == null) return '-';
  return `¥${Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// 当用户改 cityCode 时, 若匹配 common, 自动 fill cityName
watch(
  () => formData.value.cityCode,
  (v) => {
    if (!v) return;
    const upper = v.trim().toUpperCase();
    const match = COMMON_CITIES.find((c) => c.code === upper);
    if (match && !formData.value.cityName) {
      formData.value.cityName = match.name;
    }
  }
);
</script>

<template>
  <div class="city-overrides-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>
            <el-icon><Setting /></el-icon>
            城市差异化社保
            <el-text size="small" type="info">
              工厂级配置的覆盖层. 用于解决不同城市缴费基数 / 费率差异.
            </el-text>
          </span>
          <el-button-group>
            <el-button :icon="Refresh" :loading="loading" @click="loadRows">
              刷新
            </el-button>
            <el-button
              type="primary"
              :icon="Plus"
              :disabled="!canWrite"
              @click="openAddDialog"
            >
              添加城市覆盖
            </el-button>
          </el-button-group>
        </div>
      </template>

      <!-- R5 防呆: 空状态 -->
      <el-empty
        v-if="!loading && rows.length === 0"
        description="当前工厂尚未配置任何城市覆盖, 所有员工按工厂默认计算"
      >
        <el-button
          type="primary"
          :icon="Plus"
          :disabled="!canWrite"
          @click="openAddDialog"
        >
          添加首个城市覆盖
        </el-button>
      </el-empty>

      <el-table v-else :data="rows" v-loading="loading" border>
        <el-table-column prop="cityCode" label="城市代号" width="140" />
        <el-table-column prop="cityName" label="中文名" width="120">
          <template #default="{ row }">
            {{ row.cityName || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="缴费基数下限" width="160" align="right">
          <template #default="{ row }">
            {{ formatCurrency(row.baseSalaryLowerBound) }}
          </template>
        </el-table-column>
        <el-table-column label="缴费基数上限" width="160" align="right">
          <template #default="{ row }">
            {{ formatCurrency(row.baseSalaryUpperBound) }}
          </template>
        </el-table-column>
        <el-table-column label="费率覆盖项" min-width="200">
          <template #default="{ row }">
            <el-tag
              v-for="(_v, k) in row.overrideRates || {}"
              :key="k"
              size="small"
              type="info"
              class="rate-tag"
            >
              {{ k }}: {{ formatPct(Number(_v)) }}
            </el-tag>
            <span v-if="!row.overrideRates || Object.keys(row.overrideRates).length === 0" class="text-muted">
              -
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="effectiveFrom" label="生效日期" width="120" />
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button
              link
              size="small"
              :loading="previewLoading"
              @click="handlePreviewEffective(row)"
            >
              预览生效
            </el-button>
            <el-button
              link
              size="small"
              type="primary"
              :disabled="!canWrite"
              @click="openEditDialog(row)"
            >
              编辑
            </el-button>
            <el-button
              link
              size="small"
              type="danger"
              :icon="Delete"
              :disabled="!canWrite"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 添加 / 编辑 dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="editing ? `编辑城市覆盖 — ${editing.cityCode}` : '添加城市覆盖'"
      width="720px"
      destroy-on-close
    >
      <el-alert
        v-if="!editing"
        type="info"
        :closable="false"
        title="提示"
        description="保存后该城市员工的工资单将按此基数 / 费率计算. 老 ACTIVE 自动归档."
      />

      <el-form :model="formData" label-width="120px" style="margin-top: 16px;">
        <!-- 城市代号 -->
        <el-form-item label="城市代号 *" required>
          <el-input
            v-model="formData.cityCode"
            placeholder="e.g. SHANGHAI / BEIJING (大写 ASCII)"
            :disabled="editing != null"
            style="width: 260px; margin-right: 12px;"
          />
          <span class="quick-pick">
            <el-text size="small" type="info">快捷:</el-text>
            <el-tag
              v-for="c in COMMON_CITIES"
              :key="c.code"
              size="small"
              effect="plain"
              style="cursor: pointer; margin-left: 4px;"
              @click="pickCommonCity(c.code, c.name)"
            >
              {{ c.code }} ({{ c.name }})
            </el-tag>
          </span>
        </el-form-item>

        <el-form-item label="中文名">
          <el-input
            v-model="formData.cityName"
            placeholder="e.g. 上海 / 北京 (用于消息展示)"
            style="width: 260px;"
          />
        </el-form-item>

        <el-divider content-position="left">缴费基数 (必填)</el-divider>

        <el-form-item label="基数下限 *" required>
          <el-input-number
            v-model="formData.baseSalaryLowerBound"
            :min="0"
            :max="100000"
            :step="100"
            :precision="2"
            controls-position="right"
          />
          <el-text type="info" size="small" style="margin-left: 8px;">
            通常 = 当地社平工资的 60%
          </el-text>
        </el-form-item>
        <el-form-item label="基数上限 *" required>
          <el-input-number
            v-model="formData.baseSalaryUpperBound"
            :min="0"
            :max="200000"
            :step="100"
            :precision="2"
            controls-position="right"
          />
          <el-text type="info" size="small" style="margin-left: 8px;">
            通常 = 当地社平工资的 300%
          </el-text>
        </el-form-item>

        <!-- R1 防呆 preview -->
        <el-form-item label="缴基预览">
          <el-input-number
            v-model="previewMonthlySalary"
            :min="0"
            :step="500"
            :precision="2"
            controls-position="right"
          />
          <span style="margin-left: 12px;">
            月薪 → 缴基
            <strong style="color: #409EFF;">
              {{ formatCurrency(previewCappedBase) }}
            </strong>
          </span>
          <el-text
            type="info"
            size="small"
            style="display: block; margin-top: 4px;"
          >
            {{ previewCapReason }}
          </el-text>
        </el-form-item>

        <el-divider content-position="left">费率覆盖 (可选)</el-divider>
        <el-form-item label="" :show-message="false">
          <el-text type="info" size="small">
            勾选要覆盖工厂默认费率的项. 未勾选保持工厂默认.
          </el-text>
        </el-form-item>

        <el-form-item
          v-for="r in rateOverrides"
          :key="r.key"
          :label="r.label"
        >
          <el-checkbox v-model="r.enabled" />
          <el-input-number
            v-if="r.enabled"
            v-model="r.percent"
            :min="0"
            :max="30"
            :step="0.5"
            :precision="2"
            controls-position="right"
            style="margin-left: 12px;"
          />
          <span v-if="r.enabled" style="margin-left: 8px;">%</span>
          <el-text v-else type="info" size="small" style="margin-left: 12px;">
            按工厂默认
          </el-text>
        </el-form-item>

        <el-divider />

        <el-form-item label="生效起始月 *" required>
          <el-input
            v-model="formData.effectiveFrom"
            placeholder="YYYY-MM-DD"
            style="width: 200px;"
          />
          <el-text type="info" size="small" style="margin-left: 8px;">
            建议下个月 1 号
          </el-text>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="formData.remark"
            type="textarea"
            :rows="2"
            :maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSave">
          {{ editing ? '保存修改' : '保存' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.city-overrides-page {
  padding: 16px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-header span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.rate-tag {
  margin-right: 4px;
  margin-bottom: 4px;
}
.quick-pick {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.text-muted {
  color: #909399;
}
</style>
