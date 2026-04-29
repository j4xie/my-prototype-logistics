<script setup lang="ts">
/**
 * W5.2 — BOM 数据录入 dialog
 *
 * 给 V2 Dashboard 加的客户数据录入界面, 包含:
 *   Tab 1: SKU 主料成本表 (Layer 2, ±8%)
 *   Tab 2: 月度采购汇总 (Layer 3, ±5%)
 *
 * 数据持久化到 restaurant_sku_forms + restaurant_monthly_purchases 表
 * (W5.1 DB backing)
 */
import { computed, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Delete, Refresh, Upload } from '@element-plus/icons-vue';
import {
  listSkuForms,
  uploadSkuForms,
  deleteSkuForm,
  listMonthlyPurchases,
  uploadMonthlyPurchases,
  deleteMonthlyPurchase,
  type SkuFormInput,
  type MonthlyPurchaseInput,
} from '@/api/smartbi/restaurant-v2';

const props = defineProps<{
  modelValue: boolean;
  factoryId: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'data-changed'): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const activeTab = ref<'sku' | 'monthly'>('sku');
const loading = ref(false);

// ── SKU form state ──
const skuList = ref<any[]>([]);
const skuTotalCount = ref(0);
const skuByCategory = ref<Record<string, number>>({});
const newSku = ref<SkuFormInput>({
  skuName: '',
  category: '',
  totalCogsAmount: 0,
  sellingPrice: undefined,
  monthlySalesQuantity: undefined,
  ingredients: [{ name: '', cost: 0 }],
});

// ── Monthly purchase state ──
const monthlyList = ref<any[]>([]);
const monthlyTotalCount = ref(0);
const currentCalibration = ref<any>(null);
const newMonthly = ref<MonthlyPurchaseInput>({
  period: '',
  totalPurchase: 0,
  totalRevenue: 0,
  categoryBreakdown: {},
});
const categoryBreakdownText = ref('');

// ── Load data when dialog opens ──
watch(visible, async (v) => {
  if (v) await refreshAll();
});

async function refreshAll() {
  if (!props.factoryId) {
    ElMessage.warning('未获取到 factoryId, 请先登录');
    return;
  }
  loading.value = true;
  try {
    await Promise.all([loadSkuForms(), loadMonthlyPurchases()]);
  } finally {
    loading.value = false;
  }
}

async function loadSkuForms() {
  const resp = await listSkuForms(props.factoryId);
  if (resp.success && resp.data) {
    skuList.value = resp.data.items;
    skuTotalCount.value = resp.data.totalCount;
    skuByCategory.value = resp.data.byCategory;
  }
}

async function loadMonthlyPurchases() {
  const resp = await listMonthlyPurchases(props.factoryId);
  if (resp.success && resp.data) {
    monthlyList.value = resp.data.items;
    monthlyTotalCount.value = resp.data.totalCount;
    currentCalibration.value = resp.data.currentCalibration;
  }
}

// ── SKU form actions ──
function addIngredientRow() {
  newSku.value.ingredients = newSku.value.ingredients || [];
  newSku.value.ingredients.push({ name: '', cost: 0 });
}

function removeIngredientRow(idx: number) {
  if (!newSku.value.ingredients) return;
  newSku.value.ingredients.splice(idx, 1);
}

function resetNewSku() {
  newSku.value = {
    skuName: '',
    category: '',
    totalCogsAmount: 0,
    sellingPrice: undefined,
    monthlySalesQuantity: undefined,
    ingredients: [{ name: '', cost: 0 }],
  };
}

async function saveSkuForm() {
  if (!newSku.value.skuName || !newSku.value.category) {
    ElMessage.warning('请填写 SKU 名和品类');
    return;
  }
  if (newSku.value.totalCogsAmount <= 0) {
    ElMessage.warning('成本总额必须 > 0');
    return;
  }

  // Filter out empty ingredient rows
  const cleanIngredients = (newSku.value.ingredients || []).filter(
    (i) => i.name && i.cost > 0
  );

  const resp = await uploadSkuForms(props.factoryId, [
    { ...newSku.value, ingredients: cleanIngredients },
  ]);

  if (resp.success && resp.data) {
    ElMessage.success(
      `保存成功 (新增 ${resp.data.uploaded}, 更新 ${resp.data.updated})`
    );
    resetNewSku();
    await loadSkuForms();
    emit('data-changed');
  } else {
    ElMessage.error(resp.message || '保存失败');
  }
}

async function removeSkuForm(skuName: string) {
  try {
    await ElMessageBox.confirm(
      `确定删除 SKU "${skuName}"?`,
      '确认',
      { type: 'warning' }
    );
  } catch {
    return;
  }

  const resp = await deleteSkuForm(props.factoryId, skuName);
  if (resp.success) {
    ElMessage.success('已删除');
    await loadSkuForms();
    emit('data-changed');
  }
}

// ── Monthly purchase actions ──
function parseCategoryBreakdown(): Record<string, number> {
  const result: Record<string, number> = {};
  const text = categoryBreakdownText.value.trim();
  if (!text) return result;

  // Parse format: "肉类:180000\n海鲜:55000\n..."
  const lines = text.split('\n');
  for (const line of lines) {
    const match = line.trim().match(/^([^:：]+)[::]\s*([\d.]+)/);
    if (match) {
      result[match[1].trim()] = parseFloat(match[2]);
    }
  }
  return result;
}

function resetNewMonthly() {
  newMonthly.value = {
    period: '',
    totalPurchase: 0,
    totalRevenue: 0,
    categoryBreakdown: {},
  };
  categoryBreakdownText.value = '';
}

async function saveMonthlyPurchase() {
  if (!newMonthly.value.period) {
    ElMessage.warning('请填写期间 (如 2026-02)');
    return;
  }
  if (newMonthly.value.totalPurchase <= 0 || newMonthly.value.totalRevenue <= 0) {
    ElMessage.warning('采购总额 / 营收 必须 > 0');
    return;
  }

  const breakdown = parseCategoryBreakdown();
  const resp = await uploadMonthlyPurchases(props.factoryId, [
    { ...newMonthly.value, categoryBreakdown: breakdown },
  ]);

  if (resp.success && resp.data) {
    ElMessage.success(`保存成功 (saved=${resp.data.saved}, 总数 ${resp.data.countAfter})`);
    resetNewMonthly();
    await loadMonthlyPurchases();
    emit('data-changed');
  } else {
    ElMessage.error(resp.message || '保存失败');
  }
}

async function removeMonthlyPurchase(period: string) {
  try {
    await ElMessageBox.confirm(
      `确定删除 ${period} 月度采购?`,
      '确认',
      { type: 'warning' }
    );
  } catch {
    return;
  }

  const resp = await deleteMonthlyPurchase(props.factoryId, period);
  if (resp.success) {
    ElMessage.success('已删除');
    await loadMonthlyPurchases();
    emit('data-changed');
  }
}

// ── 演示数据快捷填入 (SKU 样例) ──
function fillDengSkuDemo() {
  newSku.value = {
    skuName: '招牌毛肚',
    category: '招牌主菜',
    totalCogsAmount: 18.5,
    sellingPrice: 58.0,
    monthlySalesQuantity: 820,
    ingredients: [
      { name: '毛肚', cost: 14.0, weightG: 180 },
      { name: '调料包', cost: 3.0 },
      { name: '包材', cost: 1.5 },
    ],
  };
}

// ── 演示数据快捷填入 (月度汇总样例) ──
function fillDengMonthlyDemo() {
  newMonthly.value = {
    period: '2026-02',
    totalPurchase: 335212.75,
    totalRevenue: 731047.52,
    categoryBreakdown: {},
  };
  categoryBreakdownText.value = `肉类:180000
海鲜:55000
蔬菜水果:38000
米面干货:25000
调料:22000
包材:15212.75`;
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="BOM 数据录入 — SKU 主料成本 + 月度采购"
    width="900px"
    top="5vh"
  >
    <el-tabs v-model="activeTab">
      <!-- ═══ Tab 1: SKU 主料成本表 ═══ -->
      <el-tab-pane name="sku">
        <template #label>
          <span>SKU 主料成本表 ({{ skuTotalCount }})</span>
        </template>

        <div class="ingest-section">
          <el-alert
            title="Layer 2 (±8% 精度) — 客户填 TOP 20 SKU 的主料清单"
            type="info"
            :closable="false"
            style="margin-bottom: 12px"
          />

          <!-- New SKU form -->
          <el-card class="new-form-card" shadow="never">
            <template #header>
              <div class="form-header">
                <span>新增 / 更新 SKU</span>
                <el-button size="small" @click="fillDengSkuDemo">填入演示数据</el-button>
              </div>
            </template>

            <el-form label-width="110px" :inline="false" size="small">
              <el-row :gutter="12">
                <el-col :span="8">
                  <el-form-item label="SKU 名" required>
                    <el-input v-model="newSku.skuName" placeholder="招牌毛肚" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="品类" required>
                    <el-input v-model="newSku.category" placeholder="招牌主菜" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="售价 (元)">
                    <el-input-number v-model="newSku.sellingPrice" :min="0" :precision="2" style="width: 100%" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="12">
                <el-col :span="8">
                  <el-form-item label="总成本 (元)" required>
                    <el-input-number v-model="newSku.totalCogsAmount" :min="0" :precision="2" style="width: 100%" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="月销量">
                    <el-input-number v-model="newSku.monthlySalesQuantity" :min="0" style="width: 100%" />
                  </el-form-item>
                </el-col>
              </el-row>

              <el-divider content-position="left">主料清单</el-divider>
              <div
                v-for="(ing, idx) in newSku.ingredients"
                :key="idx"
                style="margin-bottom: 6px"
              >
                <el-row :gutter="8">
                  <el-col :span="8">
                    <el-input v-model="ing.name" placeholder="主料名" size="small" />
                  </el-col>
                  <el-col :span="6">
                    <el-input-number
                      v-model="ing.cost"
                      :min="0"
                      :precision="2"
                      placeholder="成本"
                      size="small"
                      style="width: 100%"
                    />
                  </el-col>
                  <el-col :span="6">
                    <el-input-number
                      v-model="ing.weightG"
                      :min="0"
                      placeholder="重量(克)"
                      size="small"
                      style="width: 100%"
                    />
                  </el-col>
                  <el-col :span="4">
                    <el-button
                      size="small"
                      circle
                      :icon="Delete"
                      type="danger"
                      @click="removeIngredientRow(idx)"
                    />
                  </el-col>
                </el-row>
              </div>
              <el-button
                size="small"
                :icon="Plus"
                @click="addIngredientRow"
                style="margin-top: 6px"
              >
                添加主料
              </el-button>

              <div style="margin-top: 12px">
                <el-button type="primary" :icon="Upload" @click="saveSkuForm">
                  保存 SKU
                </el-button>
                <el-button @click="resetNewSku">清空</el-button>
              </div>
            </el-form>
          </el-card>

          <!-- Existing SKUs list -->
          <el-divider>已保存的 SKU ({{ skuTotalCount }})</el-divider>
          <el-table
            :data="skuList"
            size="small"
            stripe
            v-loading="loading"
            empty-text="尚无 SKU 数据, 请先添加"
          >
            <el-table-column prop="skuName" label="SKU" width="160" />
            <el-table-column prop="category" label="品类" width="120" />
            <el-table-column prop="totalCogsAmount" label="成本(元)" width="100" />
            <el-table-column prop="sellingPrice" label="售价" width="90" />
            <el-table-column prop="cogsPct" label="成本率" width="100">
              <template #default="{ row }">
                {{ row.cogsPct ? (row.cogsPct * 100).toFixed(1) + '%' : '—' }}
              </template>
            </el-table-column>
            <el-table-column label="主料" width="180">
              <template #default="{ row }">
                <span style="font-size: 12px; color: #909399">
                  {{ row.ingredients?.map((i: any) => i.name).join(' + ') || '—' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80">
              <template #default="{ row }">
                <el-button
                  size="small"
                  type="danger"
                  :icon="Delete"
                  circle
                  @click="removeSkuForm(row.skuName)"
                />
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- ═══ Tab 2: 月度采购汇总 ═══ -->
      <el-tab-pane name="monthly">
        <template #label>
          <span>月度采购 ({{ monthlyTotalCount }})</span>
        </template>

        <div class="ingest-section">
          <el-alert
            title="Layer 3 (±5% 精度) — 上传 3 个月以上采购数据触发自学习校准"
            type="info"
            :closable="false"
            style="margin-bottom: 12px"
          />

          <!-- Current calibration status -->
          <el-card v-if="currentCalibration" class="calibration-card" shadow="never">
            <template #header>
              <strong>当前校准状态</strong>
            </template>
            <div class="calibration-info">
              <span>样本: <strong>{{ currentCalibration.sampleSize }}</strong> 月</span>
              <span>置信度: <el-tag :type="currentCalibration.confidence === 'high' ? 'success' : 'warning'" size="small">{{ currentCalibration.confidence }}</el-tag></span>
              <span>实际食材率: <strong>{{ (currentCalibration.overallActualRatio * 100).toFixed(2) }}%</strong></span>
            </div>
            <div v-if="currentCalibration.warnings?.length" style="margin-top: 8px">
              <el-alert
                v-for="(w, i) in currentCalibration.warnings"
                :key="i"
                :title="w"
                type="warning"
                :closable="false"
                style="margin-bottom: 4px"
              />
            </div>
          </el-card>

          <!-- New monthly form -->
          <el-card class="new-form-card" shadow="never">
            <template #header>
              <div class="form-header">
                <span>新增 / 更新月度采购</span>
                <el-button size="small" @click="fillDengMonthlyDemo">填入演示数据</el-button>
              </div>
            </template>
            <el-form label-width="110px" size="small">
              <el-row :gutter="12">
                <el-col :span="8">
                  <el-form-item label="期间" required>
                    <el-input v-model="newMonthly.period" placeholder="2026-02" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="总采购额" required>
                    <el-input-number v-model="newMonthly.totalPurchase" :min="0" :precision="2" style="width: 100%" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="总营收" required>
                    <el-input-number v-model="newMonthly.totalRevenue" :min="0" :precision="2" style="width: 100%" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-form-item label="类目明细">
                <el-input
                  v-model="categoryBreakdownText"
                  type="textarea"
                  :rows="6"
                  placeholder="格式: 肉类:180000 (每行一类)"
                />
              </el-form-item>
              <el-button type="primary" :icon="Upload" @click="saveMonthlyPurchase">
                保存月度采购
              </el-button>
              <el-button @click="resetNewMonthly">清空</el-button>
            </el-form>
          </el-card>

          <!-- Existing monthly list -->
          <el-divider>已保存的月度采购 ({{ monthlyTotalCount }})</el-divider>
          <el-table
            :data="monthlyList"
            size="small"
            stripe
            v-loading="loading"
            empty-text="尚无月度采购数据"
          >
            <el-table-column prop="period" label="期间" width="100" />
            <el-table-column prop="totalPurchase" label="总采购" width="130">
              <template #default="{ row }">
                ¥{{ row.totalPurchase.toLocaleString('zh-CN') }}
              </template>
            </el-table-column>
            <el-table-column prop="totalRevenue" label="总营收" width="130">
              <template #default="{ row }">
                ¥{{ row.totalRevenue.toLocaleString('zh-CN') }}
              </template>
            </el-table-column>
            <el-table-column prop="overallRatio" label="食材率" width="90">
              <template #default="{ row }">
                {{ (row.overallRatio * 100).toFixed(2) }}%
              </template>
            </el-table-column>
            <el-table-column label="类目明细">
              <template #default="{ row }">
                <span style="font-size: 12px; color: #909399">
                  {{ Object.keys(row.categoryBreakdown || {}).join(', ') || '—' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80">
              <template #default="{ row }">
                <el-button
                  size="small"
                  type="danger"
                  :icon="Delete"
                  circle
                  @click="removeMonthlyPurchase(row.period)"
                />
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <el-button :icon="Refresh" @click="refreshAll">刷新</el-button>
      <el-button type="primary" @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.ingest-section {
  padding: 8px 0;
}

.new-form-card {
  margin-bottom: 16px;
  background: #f5f7fa;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}

.calibration-card {
  margin-bottom: 16px;
  border-left: 4px solid #409eff;
}

.calibration-info {
  display: flex;
  gap: 24px;
  align-items: center;
  color: #606266;
}

.calibration-info strong {
  color: #303133;
}
</style>
