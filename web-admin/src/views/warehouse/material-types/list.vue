<script setup lang="ts">
/**
 * 原料类型字典管理 (raw_material_types)
 *
 * 张权 Apr 29 2026 反馈: "没有 新建的入口哦 这个入口是入库登记".
 * 仓储 → 原料 / 物料 (采购入库) 页面只有"入库登记"(material_batches CRUD),
 * 但缺一个"原料类型字典"管理页, 用户无法在 UI 里创建新原料类型 (冻猪蹄/吸塑盒).
 * 后端 /raw-material-types 全 CRUD 早齐, 只缺前端页面 — 本页补上.
 *
 * May 7 2026 用户需求 (PR #114/#116/#120 后端落地):
 * 1. 编码自动生成 (创建时不传 code, 后端生成)
 * 2. 类别下拉 (主材/辅材/调味料/包材) 走 system_enums.MATERIAL_CATEGORY 字典
 * 3. 单位下拉 + 智能默认 (suggest-unit 按相似名称+类别取最近原料的 unit)
 * 4. 去掉单价 (按采购价浮动, 在采购订单里录)
 * 5. 包装层级: 一级 (kg, 必填=unit) + 二/三级 (10kg/箱, 12箱/柜)
 */
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post, put, del } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Edit, Delete as DeleteIcon, Search, Refresh, Lock } from '@element-plus/icons-vue';
import { formatAmount } from '@/utils/tableFormatters';
import ConceptDisambiguationAlert from '@/components/common/ConceptDisambiguationAlert.vue';
import type { TableRow } from '@/types/api';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('warehouse'));
// T2-5b (issue #534): expose movingAvgPrice — gate by canViewPrice RBAC
const canViewPrice = computed(() => permissionStore.canViewPrice);

const loading = ref(false);
const tableData = ref<TableRow[]>([]);
const pagination = ref({ page: 1, size: 20, total: 0 });
const searchKeyword = ref('');

// 字典选项 (从后端 system_enums + unit_of_measurements 拉, Canvas 字典管理可改)
interface DictItem { enumCode: string; enumLabel: string; sortOrder: number }
interface UnitItem { unitCode: string; unitName: string; unitSymbol?: string; sortOrder: number }
const categoryOptions = ref<DictItem[]>([]);
const storageTypeOptions = ref<DictItem[]>([]);
const unitOptions = ref<UnitItem[]>([]);

onMounted(async () => {
  await loadDictionaries();
  await loadData();
});

async function loadDictionaries() {
  if (!factoryId.value) return;
  try {
    const [catRes, storageRes, unitRes] = await Promise.all([
      get<DictItem[]>(`/${factoryId.value}/system-config/enums/MATERIAL_CATEGORY`),
      get<DictItem[]>(`/${factoryId.value}/system-config/enums/MATERIAL_STORAGE_TYPE`),
      get<UnitItem[]>(`/${factoryId.value}/system-config/units`),
    ]);
    categoryOptions.value = (catRes.data || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
    storageTypeOptions.value = (storageRes.data || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
    unitOptions.value = (unitRes.data || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  } catch (e) {
    console.warn('字典加载失败, 用空选项', e);
  }
}

// 编辑老数据时, 若历史值不在字典中, 临时合入下拉避免值丢失显示
function mergeHistoricCategory(current?: string): { value: string; label: string }[] {
  const opts = categoryOptions.value.map((c) => ({ value: c.enumLabel, label: c.enumLabel }));
  if (current && current.trim() !== '' && !opts.find((o) => o.value === current)) {
    return [{ value: current, label: `${current} (历史)` }, ...opts];
  }
  return opts;
}
function mergeHistoricStorage(current?: string): { value: string; label: string }[] {
  const opts = storageTypeOptions.value.map((c) => ({ value: c.enumLabel, label: c.enumLabel }));
  if (current && current.trim() !== '' && !opts.find((o) => o.value === current)) {
    return [{ value: current, label: `${current} (历史)` }, ...opts];
  }
  return opts;
}
function mergeHistoricUnit(current?: string): { value: string; label: string }[] {
  const opts = unitOptions.value.map((u) => {
    const sym = u.unitSymbol || u.unitCode;
    return { value: sym, label: `${u.unitName} (${sym})` };
  });
  if (current && current.trim() !== '' && !opts.find((o) => o.value === current)) {
    return [{ value: current, label: `${current} (历史)` }, ...opts];
  }
  return opts;
}

async function loadData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const res = await get<{ content: TableRow[]; totalElements: number }>(
      `/${factoryId.value}/raw-material-types`,
      {
        params: {
          page: pagination.value.page,
          size: pagination.value.size,
          keyword: searchKeyword.value || undefined,
        },
      },
    );
    if (res.success && res.data) {
      tableData.value = res.data.content || [];
      pagination.value.total = res.data.totalElements || 0;
    }
  } catch (e) { console.error(e); }
  finally { loading.value = false; }
}

// ==================== Create / Edit Dialog ====================
const dialogVisible = ref(false);
const editingId = ref<string | null>(null);
const form = ref({
  code: '', // 仅编辑模式显示, 创建时不传 (后端生成)
  name: '',
  category: '',
  unit: 'kg',
  storageType: '',
  shelfLifeDays: null as number | null,
  notes: '',
});
const packaging = ref({
  level1PerLevel2: '' as number | string,
  level2Unit: '',
  level2PerLevel3: '' as number | string,
  level3Unit: '',
});
const dialogTitle = computed(() => (editingId.value ? '编辑原料类型' : '新建原料类型'));

function resetPackaging() {
  packaging.value = { level1PerLevel2: '', level2Unit: '', level2PerLevel3: '', level3Unit: '' };
}

function openCreate() {
  editingId.value = null;
  form.value = {
    code: '',
    name: '',
    category: '',
    unit: 'kg',
    storageType: storageTypeOptions.value[0]?.enumLabel || '',
    shelfLifeDays: null,
    notes: '',
  };
  resetPackaging();
  dialogVisible.value = true;
}

async function openEdit(row: TableRow) {
  editingId.value = String(row.id || '');
  form.value = {
    code: String(row.code || ''),
    name: String(row.name || ''),
    category: String(row.category || ''),
    unit: String(row.unit || 'kg'),
    storageType: String(row.storageType || ''),
    shelfLifeDays: row.shelfLifeDays as number | null ?? null,
    notes: String(row.notes || ''),
  };
  resetPackaging();
  // 加载现有包装层级
  try {
    const res = await get<{ level1PerLevel2: number | null; level2Unit: string | null; level2PerLevel3: number | null; level3Unit: string | null }>(
      `/${factoryId.value}/material-packaging/by-material/${editingId.value}`,
    );
    if (res.success && res.data) {
      packaging.value = {
        level1PerLevel2: res.data.level1PerLevel2 ?? '',
        level2Unit: res.data.level2Unit || '',
        level2PerLevel3: res.data.level2PerLevel3 ?? '',
        level3Unit: res.data.level3Unit || '',
      };
    }
  } catch (e) { /* 无配置时正常空 */ }
  dialogVisible.value = true;
}

// 智能默认单位: 新建模式下, name + category 变化时取最近相似原料的 unit
let suggestTimer: number | undefined;
watch(
  () => [form.value.name, form.value.category, dialogVisible.value, editingId.value] as const,
  ([name, cat, visible, eid]) => {
    if (!visible || eid) return;
    if (suggestTimer) clearTimeout(suggestTimer);
    const trimmedName = String(name || '').trim();
    if (trimmedName.length < 2) return;
    suggestTimer = window.setTimeout(async () => {
      try {
        const params: Record<string, string> = { name: trimmedName };
        if (cat) params.category = String(cat);
        const res = await get<string>(`/${factoryId.value}/raw-material-types/suggest-unit`, { params });
        if (res.success && res.data) {
          form.value.unit = res.data;
        }
      } catch (e) { /* 静默 */ }
    }, 400);
  },
);

const submitting = ref(false);
async function handleSave() {
  if (!form.value.name) return ElMessage.warning('请填写原料名称');
  if (!form.value.category) return ElMessage.warning('请选择类别');
  if (!form.value.unit) return ElMessage.warning('请选择单位');
  if (!form.value.storageType) return ElMessage.warning('请选择储存类型');

  // 包装层级前端校验 (后端 service + DB CHECK 双重兜底)
  const hasL2Unit = !!packaging.value.level2Unit?.trim();
  const hasL2Qty = packaging.value.level1PerLevel2 !== '' && Number(packaging.value.level1PerLevel2) > 0;
  const hasL3Unit = !!packaging.value.level3Unit?.trim();
  const hasL3Qty = packaging.value.level2PerLevel3 !== '' && Number(packaging.value.level2PerLevel3) > 0;
  if (hasL2Unit !== hasL2Qty) return ElMessage.warning('二级单位和换算数量必须同时填写或同时清空');
  if (hasL3Unit !== hasL3Qty) return ElMessage.warning('三级单位和换算数量必须同时填写或同时清空');
  if (hasL3Unit && !hasL2Unit) return ElMessage.warning('必须先配置二级单位才能配置三级');

  submitting.value = true;
  try {
    let materialId: string;
    if (editingId.value) {
      const res = await put(`/${factoryId.value}/raw-material-types/${editingId.value}`, form.value);
      if (!res.success) throw new Error(res.message || '更新失败');
      materialId = editingId.value;
      ElMessage.success('更新成功');
    } else {
      // 创建: 不传 code 让后端自动生成
      const { code, ...payload } = form.value;
      const res = await post<{ id: string }>(`/${factoryId.value}/raw-material-types`, payload);
      if (!res.success) throw new Error(res.message || '创建失败');
      materialId = res.data?.id || '';
      ElMessage.success('创建成功');
    }

    // 包装层级 upsert / delete
    if (hasL2Unit || hasL3Unit) {
      await put(`/${factoryId.value}/material-packaging/by-material/${materialId}`, {
        level1Unit: form.value.unit,
        level1PerLevel2: hasL2Unit ? Number(packaging.value.level1PerLevel2) : null,
        level2Unit: hasL2Unit ? packaging.value.level2Unit.trim() : null,
        level2PerLevel3: hasL3Unit ? Number(packaging.value.level2PerLevel3) : null,
        level3Unit: hasL3Unit ? packaging.value.level3Unit.trim() : null,
      });
    } else if (editingId.value) {
      // 编辑模式下用户清空了二三级 → 删除现有配置
      try { await del(`/${factoryId.value}/material-packaging/by-material/${materialId}`); }
      catch { /* 不存在也 OK */ }
    }

    dialogVisible.value = false;
    loadData();
  } catch (e) {
    console.error(e);
    if (e instanceof Error) ElMessage.error(e.message);
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(row: TableRow) {
  try {
    await ElMessageBox.confirm(
      `确定删除原料类型「${row.name}」? 该原料关联的批次仍保留, 但无法新建新批次.`,
      '删除确认',
      { type: 'warning' },
    );
    const res = await del(`/${factoryId.value}/raw-material-types/${row.id}`);
    if (res.success) {
      ElMessage.success('删除成功');
      loadData();
    }
  } catch (e) { /* user cancelled or interceptor toasted */ }
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
</script>

<template>
  <div class="page-wrapper">
    <ConceptDisambiguationAlert
      here-name="原料类型字典"
      here="原料的「分类抽象」（如「冻猪蹄」「吸塑盒2014-3.5」），定义后才能在采购订单 / 入库登记 / BOM 里被选择"
      other-name="仓储管理 → 原料 / 物料 (采购入库)"
      other="原料的「具体批次」，记录某次入库的数量、价格、保质期"
      other-path="/warehouse/materials"
      consequence="先在这里建原料类型, 再去入库登记里给它建批次"
    />
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">原料类型字典</span>
            <span class="data-count">共 {{ pagination.total }} 条记录</span>
          </div>
          <div class="header-right">
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="openCreate">
              新建原料类型
            </el-button>
          </div>
        </div>
      </template>

      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索原料名称 / 编码"
          clearable
          style="width: 280px"
          @keyup.enter="handleSearch"
        />
        <el-button :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleRefresh">重置</el-button>
      </div>

      <el-table v-loading="loading" :data="tableData" stripe>
        <el-table-column prop="code" label="原料编码" width="160" />
        <el-table-column prop="name" label="原料名称" min-width="180" />
        <el-table-column prop="category" label="类别" width="120" />
        <el-table-column prop="unit" label="单位" width="80" />
        <el-table-column prop="storageType" label="储存类型" width="100" />
        <el-table-column prop="shelfLifeDays" label="保质期 (天)" width="120">
          <template #default="{ row }">{{ row.shelfLifeDays ?? '-' }}</template>
        </el-table-column>
        <!-- T2-5b (issue #534): F006 客户反馈 — expose 移动均价 (RawMaterialTypeDTO.movingAvgPrice)
             gated by canViewPrice RBAC (per PR #443/#467 price-field policy) -->
        <el-table-column v-if="canViewPrice" prop="movingAvgPrice" label="移动均价" width="120" align="right">
          <template #default="{ row }">
            <span v-if="row.movingAvgPrice != null">{{ formatAmount(row.movingAvgPrice) }}</span>
            <span v-else style="color: #c0c4cc">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button v-if="canWrite" link type="primary" :icon="Edit" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="canWrite" link type="danger" :icon="DeleteIcon" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.size"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 16px; justify-content: flex-end"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="640px" destroy-on-close>
      <el-form :model="form" label-width="120px">
        <!-- 编码: 创建时自动生成不显示, 编辑时只读 -->
        <el-form-item v-if="editingId" label="原料编码">
          <el-input v-model="form.code" disabled :prefix-icon="Lock" />
        </el-form-item>
        <el-form-item label="原料名称" required>
          <el-input v-model="form.name" placeholder="如 冻猪蹄 / 三文鱼" />
        </el-form-item>
        <el-form-item label="类别" required>
          <el-select v-model="form.category" placeholder="请选择类别" style="width: 100%" filterable>
            <el-option
              v-for="opt in mergeHistoricCategory(form.category)"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="单位" required>
          <el-select v-model="form.unit" placeholder="请选择单位" style="width: 100%" filterable>
            <el-option
              v-for="opt in mergeHistoricUnit(form.unit)"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="储存类型" required>
          <el-select v-model="form.storageType" placeholder="请选择储存类型" style="width: 100%">
            <el-option
              v-for="opt in mergeHistoricStorage(form.storageType)"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="保质期 (天)">
          <el-input-number v-model="form.shelfLifeDays" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.notes" type="textarea" :rows="2" />
        </el-form-item>

        <el-divider>
          <span class="divider-title">包装层级（可选）</span>
        </el-divider>
        <div class="packaging-hint">
          例: 三文鱼 一级 kg, 10 kg / 箱 (二级), 12 箱 / 柜 (三级)
        </div>
        <el-form-item label="一级单位">
          <el-input :value="form.unit" disabled :prefix-icon="Lock" />
          <div class="field-hint">基础单位 = 上方"单位"字段, 不可单独改</div>
        </el-form-item>
        <el-form-item label="二级换算">
          <div class="packaging-row">
            <el-input-number
              v-model="packaging.level1PerLevel2"
              :min="0"
              placeholder="数量 (10)"
              :controls="false"
              style="width: 140px"
            />
            <span class="packaging-sep">{{ form.unit || '/' }} /</span>
            <el-select
              v-model="packaging.level2Unit"
              placeholder="二级单位 (箱)"
              style="width: 180px"
              filterable
              clearable
            >
              <el-option
                v-for="opt in mergeHistoricUnit(packaging.level2Unit)"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
        </el-form-item>
        <el-form-item label="三级换算">
          <div class="packaging-row">
            <el-input-number
              v-model="packaging.level2PerLevel3"
              :min="0"
              placeholder="数量 (12)"
              :controls="false"
              :disabled="!packaging.level2Unit"
              style="width: 140px"
            />
            <span class="packaging-sep">{{ packaging.level2Unit || '/' }} /</span>
            <el-select
              v-model="packaging.level3Unit"
              placeholder="三级单位 (柜)"
              :disabled="!packaging.level2Unit"
              style="width: 180px"
              filterable
              clearable
            >
              <el-option
                v-for="opt in mergeHistoricUnit(packaging.level3Unit)"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
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
.search-bar { display: flex; gap: 8px; margin-bottom: 16px; }
.divider-title { font-size: 14px; color: #606266; font-weight: 500; }
.packaging-hint { font-size: 12px; color: #909399; margin-bottom: 12px; padding-left: 120px; }
.packaging-row { display: flex; align-items: center; gap: 8px; width: 100%; }
.packaging-sep { color: #909399; min-width: 28px; text-align: center; }
.field-hint { font-size: 12px; color: #909399; margin-top: 4px; }
</style>
