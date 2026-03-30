<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import { ElMessage } from 'element-plus';
import { Search, Printer, Select, Check } from '@element-plus/icons-vue';
import QRCode from 'qrcode';

// ---------- types ----------
interface Employee {
  id: number;
  username: string;
  fullName: string;
  employeeCode: string;
  roleCode: string;
  roleDisplayName?: string;
  departmentDisplayName?: string;
  position?: string;
  isActive: boolean;
}

// ---------- state ----------
const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);

const loading = ref(false);
const employees = ref<Employee[]>([]);
const searchQuery = ref('');
const selectedIds = ref<Set<number>>(new Set());
const badgesGenerated = ref(false);
const qrCanvasRefs = ref<Record<number, HTMLCanvasElement>>({});

// Factory name used on the badge (editable)
const factoryName = ref('白垩纪食品');

// ---------- role map ----------
const roleMap: Record<string, string> = {
  factory_super_admin: '工厂总监',
  hr_admin: 'HR管理员',
  procurement_manager: '采购主管',
  sales_manager: '销售主管',
  dispatcher: '调度员',
  production_manager: '生产主管',
  warehouse_manager: '仓储主管',
  equipment_admin: '设备管理员',
  quality_manager: '质量经理',
  finance_manager: '财务主管',
  workshop_supervisor: '车间主任',
  quality_inspector: '质检员',
  operator: '操作员',
  warehouse_worker: '仓库员',
  permission_admin: '权限管理员',
  department_admin: '部门管理员',
  viewer: '查看者',
  unactivated: '未激活',
};

function getRoleText(role: string): string {
  return roleMap[role] || role;
}

// ---------- data loading ----------
onMounted(() => {
  loadEmployees();
});

async function loadEmployees() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const response = await get<{ content: Employee[]; totalElements: number }>(
      `/${factoryId.value}/users`,
      { params: { page: 1, size: 200 } }
    );
    if (response.success && response.data) {
      employees.value = (response.data.content || []).filter(
        (e) => e.isActive !== false
      );
    }
  } catch (error) {
    console.error('Failed to load employees:', error);
    ElMessage.error('加载员工列表失败');
  } finally {
    loading.value = false;
  }
}

// ---------- filtering ----------
const filteredEmployees = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return employees.value;
  return employees.value.filter(
    (e) =>
      (e.fullName && e.fullName.toLowerCase().includes(q)) ||
      (e.username && e.username.toLowerCase().includes(q)) ||
      (e.employeeCode && e.employeeCode.toLowerCase().includes(q))
  );
});

// ---------- selection ----------
function toggleSelect(emp: Employee) {
  const newSet = new Set(selectedIds.value);
  if (newSet.has(emp.id)) {
    newSet.delete(emp.id);
  } else {
    newSet.add(emp.id);
  }
  selectedIds.value = newSet;
  badgesGenerated.value = false;
}

function isSelected(emp: Employee): boolean {
  return selectedIds.value.has(emp.id);
}

const allFilteredSelected = computed(() => {
  if (filteredEmployees.value.length === 0) return false;
  return filteredEmployees.value.every((e) => selectedIds.value.has(e.id));
});

function toggleSelectAll() {
  const newSet = new Set(selectedIds.value);
  if (allFilteredSelected.value) {
    filteredEmployees.value.forEach((e) => newSet.delete(e.id));
  } else {
    filteredEmployees.value.forEach((e) => newSet.add(e.id));
  }
  selectedIds.value = newSet;
  badgesGenerated.value = false;
}

const selectedEmployees = computed(() =>
  employees.value.filter((e) => selectedIds.value.has(e.id))
);

// ---------- QR generation ----------
function setCanvasRef(el: HTMLCanvasElement | null, empId: number) {
  if (el) {
    qrCanvasRefs.value[empId] = el as HTMLCanvasElement;
  }
}

async function generateBadges() {
  if (selectedEmployees.value.length === 0) {
    ElMessage.warning('请先选择至少一名员工');
    return;
  }

  badgesGenerated.value = true;

  // Wait for DOM to render the badge cards with canvas elements
  await nextTick();
  // Small extra delay for the v-if transition
  await new Promise((resolve) => setTimeout(resolve, 50));

  for (const emp of selectedEmployees.value) {
    const canvas = qrCanvasRefs.value[emp.id];
    if (!canvas) continue;

    const qrData = emp.employeeCode || emp.username || String(emp.id);
    try {
      await QRCode.toCanvas(canvas, qrData, {
        width: 160,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      });
    } catch (err) {
      console.error(`QR generation failed for ${emp.fullName}:`, err);
    }
  }

  ElMessage.success(`已生成 ${selectedEmployees.value.length} 张工牌`);
}

// ---------- printing ----------
function handlePrint() {
  if (!badgesGenerated.value || selectedEmployees.value.length === 0) {
    ElMessage.warning('请先生成工牌');
    return;
  }
  window.print();
}
</script>

<template>
  <div class="page-container badge-generator-page">
    <!-- Header + controls (hidden when printing) -->
    <el-card class="no-print">
      <template #header>
        <div class="card-header">
          <span class="page-title">员工工牌生成</span>
        </div>
      </template>

      <!-- Factory name config -->
      <el-form inline class="controls-form">
        <el-form-item label="工厂名称">
          <el-input
            v-model="factoryName"
            placeholder="显示在工牌上的名称"
            style="width: 200px"
          />
        </el-form-item>
      </el-form>

      <!-- Search + actions -->
      <div class="toolbar">
        <el-input
          v-model="searchQuery"
          placeholder="搜索姓名、用户名或工号"
          :prefix-icon="Search"
          clearable
          style="width: 280px"
        />
        <div class="toolbar-actions">
          <el-button @click="toggleSelectAll">
            <el-icon><Select /></el-icon>
            {{ allFilteredSelected ? '取消全选' : '全选' }}
          </el-button>
          <el-button type="primary" @click="generateBadges" :disabled="selectedIds.size === 0">
            <el-icon><Check /></el-icon>
            生成工牌 ({{ selectedIds.size }})
          </el-button>
        </div>
      </div>

      <!-- Employee list -->
      <div v-loading="loading" class="employee-list">
        <div v-if="filteredEmployees.length === 0 && !loading" class="empty-text">
          暂无员工数据
        </div>
        <div
          v-for="emp in filteredEmployees"
          :key="emp.id"
          class="employee-row"
          :class="{ selected: isSelected(emp) }"
          @click="toggleSelect(emp)"
        >
          <el-checkbox :model-value="isSelected(emp)" @click.stop @change="toggleSelect(emp)" />
          <div class="emp-info">
            <span class="emp-name">{{ emp.fullName || emp.username }}</span>
            <el-tag v-if="emp.employeeCode" size="small" type="info" class="emp-code">
              {{ emp.employeeCode }}
            </el-tag>
            <span class="emp-role">{{ emp.roleDisplayName || getRoleText(emp.roleCode) }}</span>
            <span v-if="emp.departmentDisplayName" class="emp-dept">
              {{ emp.departmentDisplayName }}
            </span>
          </div>
        </div>
      </div>
    </el-card>

    <!-- Badge preview (visible on screen and when printing) -->
    <div v-if="badgesGenerated && selectedEmployees.length > 0" class="badges-section">
      <div class="section-header no-print">
        <h3>工牌预览</h3>
        <el-button type="success" :icon="Printer" @click="handlePrint">
          打印工牌
        </el-button>
      </div>

      <div class="badges-grid" id="printable-badges">
        <div v-for="emp in selectedEmployees" :key="emp.id" class="badge-card">
          <div class="badge-inner">
            <!-- Top: factory name -->
            <div class="badge-factory">{{ factoryName }}</div>

            <!-- QR code -->
            <div class="badge-qr">
              <canvas :ref="(el: unknown) => setCanvasRef(el as HTMLCanvasElement | null, (emp as Record<string, unknown>).id as number)"></canvas>
            </div>

            <!-- Employee info -->
            <div class="badge-name">{{ emp.fullName || emp.username }}</div>
            <div class="badge-code">{{ emp.employeeCode || '-' }}</div>
            <div class="badge-role">
              {{ emp.roleDisplayName || getRoleText(emp.roleCode) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.page-container {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
}

.controls-form {
  margin-bottom: 12px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}

/* Employee list */
.employee-list {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.empty-text {
  text-align: center;
  padding: 40px;
  color: var(--el-text-color-secondary);
}

.employee-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background-color 0.15s;
  border-bottom: 1px solid var(--el-border-color-extra-light);

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: var(--el-fill-color-light);
  }

  &.selected {
    background-color: var(--el-color-primary-light-9);
  }
}

.emp-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.emp-name {
  font-weight: 500;
  font-size: 14px;
}

.emp-code {
  font-family: monospace;
}

.emp-role {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.emp-dept {
  color: var(--el-text-color-placeholder);
  font-size: 12px;

  &::before {
    content: '|';
    margin-right: 8px;
    color: var(--el-border-color);
  }
}

/* Badges section */
.badges-section {
  margin-top: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }
}

.badges-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

/* Badge card: 85mm x 54mm standard card */
.badge-card {
  width: 85mm;
  height: 54mm;
  border: 1px solid #ccc;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  flex-shrink: 0;
}

.badge-inner {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4mm 6mm;
  box-sizing: border-box;
}

.badge-factory {
  font-size: 13px;
  font-weight: 700;
  color: #1a3c6e;
  letter-spacing: 2px;
  margin-bottom: 2mm;
}

.badge-qr {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2mm;

  canvas {
    width: 22mm !important;
    height: 22mm !important;
  }
}

.badge-name {
  font-size: 14px;
  font-weight: 600;
  color: #222;
  margin-bottom: 1mm;
}

.badge-code {
  font-size: 11px;
  font-family: 'Courier New', monospace;
  color: #555;
  margin-bottom: 1mm;
}

.badge-role {
  font-size: 10px;
  color: #888;
}

/* ============ Print styles ============ */
@media print {
  /* Hide everything except badge cards */
  .no-print,
  .section-header {
    display: none !important;
  }

  .page-container {
    padding: 0;
    margin: 0;
  }

  .badges-section {
    margin: 0;
  }

  .badges-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0;
    /* 2 columns x 4 rows per A4 page */
    justify-content: flex-start;
  }

  .badge-card {
    width: 85mm;
    height: 54mm;
    border: 1px solid #999;
    border-radius: 4px;
    margin: 4mm;
    page-break-inside: avoid;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Ensure QR canvas prints properly */
  .badge-qr canvas {
    width: 22mm !important;
    height: 22mm !important;
  }
}
</style>
