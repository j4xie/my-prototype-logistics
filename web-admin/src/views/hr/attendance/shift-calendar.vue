<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh, Calendar } from '@element-plus/icons-vue';
import {
  listShifts,
  listAssignments,
  upsertAssignment,
  bulkAssign,
  deleteAssignment,
  type AttendanceShift,
  type EmployeeShiftAssignment,
} from '@/api/hrShiftAssignment';

/**
 * 高级排班可视化日历 (#835 follow-up).
 *
 * 月视图: 行 = 员工, 列 = 该月每一天. cell 显示分配班次 (color-coded).
 * - R2 防呆: cell tooltip 含 员工姓名 + 日期 + 班次名 (含起止时间).
 * - R3 防呆: 班次 dropdown (palette) + "无班次" 选项 (= 清除).
 * - R5 防呆: 空状态 (本月零分配) 提示先选 palette + 批量分配 button.
 */

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('hr'));

// ===================== State =====================

interface EmployeeRow {
  id: number;
  fullName: string;
  username?: string;
  roleCode?: string;
  department?: string;
}

const selectedMonth = ref<string>(currentYearMonth());
const employees = ref<EmployeeRow[]>([]);
const shifts = ref<AttendanceShift[]>([]);
const assignments = ref<EmployeeShiftAssignment[]>([]);
const loading = ref(false);

// 调色板 — 班次 → 颜色 (deterministic by index)
const SHIFT_COLORS = [
  { bg: '#ecf5ff', border: '#409eff', text: '#1d6dc7' }, // 蓝
  { bg: '#f0f9eb', border: '#67c23a', text: '#3a8a17' }, // 绿
  { bg: '#fdf6ec', border: '#e6a23c', text: '#a36314' }, // 橙
  { bg: '#fef0f0', border: '#f56c6c', text: '#a83232' }, // 红
  { bg: '#f4f4f5', border: '#909399', text: '#5a5e66' }, // 灰
  { bg: '#ecfaff', border: '#13c2c2', text: '#0a7a7a' }, // 青
  { bg: '#fff1f7', border: '#eb2f96', text: '#9c1759' }, // 粉
];

// 当前选中用于"画格子"的 palette 班次 (R3 防呆 — 操作前先选定)
const activePaletteShiftId = ref<string | null>(null);

// 批量分配 dialog
const bulkDialogVisible = ref(false);
const bulkForm = ref({
  userIds: [] as number[],
  dateStart: '',
  dateEnd: '',
  shiftId: '',
  notes: '',
});
const bulkSubmitting = ref(false);

// 选中员工 (el-table multi-select for bulk apply)
const selectedRows = ref<EmployeeRow[]>([]);

// ===================== Computed =====================

const daysInMonth = computed<string[]>(() => {
  const [yStr, mStr] = selectedMonth.value.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m) return [];
  const lastDay = new Date(y, m, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    out.push(`${yStr}-${mStr}-${String(d).padStart(2, '0')}`);
  }
  return out;
});

const monthStartDate = computed(() => daysInMonth.value[0] || '');
const monthEndDate = computed(() => daysInMonth.value[daysInMonth.value.length - 1] || '');

const shiftMap = computed<Record<string, AttendanceShift>>(() => {
  const map: Record<string, AttendanceShift> = {};
  shifts.value.forEach((s) => {
    map[s.id] = s;
  });
  return map;
});

const shiftColorMap = computed<Record<string, (typeof SHIFT_COLORS)[number]>>(() => {
  const map: Record<string, (typeof SHIFT_COLORS)[number]> = {};
  shifts.value.forEach((s, idx) => {
    map[s.id] = SHIFT_COLORS[idx % SHIFT_COLORS.length];
  });
  return map;
});

// Lookup: userId -> { date -> assignment }
const assignmentIndex = computed<Record<number, Record<string, EmployeeShiftAssignment>>>(() => {
  const idx: Record<number, Record<string, EmployeeShiftAssignment>> = {};
  assignments.value.forEach((a) => {
    if (!idx[a.userId]) idx[a.userId] = {};
    idx[a.userId][a.workDate] = a;
  });
  return idx;
});

const hasAnyAssignment = computed(() => assignments.value.length > 0);

// ===================== Helpers =====================

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getAssignmentFor(userId: number, date: string): EmployeeShiftAssignment | undefined {
  return assignmentIndex.value[userId]?.[date];
}

function getShiftDisplay(shift: AttendanceShift): string {
  // "早班 (08:00-17:00)"
  const start = (shift.startTime || '').slice(0, 5);
  const end = (shift.endTime || '').slice(0, 5);
  const overnight = shift.isOvernight ? '+1' : '';
  return `${shift.shiftName} (${start}-${end}${overnight})`;
}

function getCellTooltip(employee: EmployeeRow, date: string): string {
  const a = getAssignmentFor(employee.id, date);
  if (!a) {
    return `${employee.fullName} · ${date} · 未排班 (点击分配)`;
  }
  const shift = shiftMap.value[a.shiftId];
  const shiftLabel = shift ? getShiftDisplay(shift) : '已删除的班次';
  return `${employee.fullName} · ${date} · ${shiftLabel}${a.notes ? ` · ${a.notes}` : ''}`;
}

function isWeekend(date: string): boolean {
  const d = new Date(date);
  const day = d.getDay();
  return day === 0 || day === 6;
}

function dayOfMonth(date: string): string {
  return String(Number(date.slice(-2)));
}

function weekdayLabel(date: string): string {
  return ['日', '一', '二', '三', '四', '五', '六'][new Date(date).getDay()];
}

// ===================== Loading =====================

onMounted(async () => {
  await Promise.all([loadShifts(), loadEmployees()]);
  await loadAssignments();
});

watch(selectedMonth, async () => {
  await loadAssignments();
});

async function loadShifts() {
  if (!factoryId.value) return;
  try {
    const res = await listShifts(factoryId.value, true);
    if (res.success && res.data) {
      shifts.value = res.data as AttendanceShift[];
      if (shifts.value.length > 0 && !activePaletteShiftId.value) {
        activePaletteShiftId.value = shifts.value[0].id;
      }
    }
  } catch (e) {
    console.error('加载班次失败:', e);
  }
}

async function loadEmployees() {
  if (!factoryId.value) return;
  try {
    // 复用 employees 端点 — 分页大一些避免分页 UI (排班场景通常≤100人/页)
    const res = await get<{ content: EmployeeRow[]; totalElements: number }>(
      `/${factoryId.value}/users`,
      { params: { page: 1, size: 200 } }
    );
    if (res.success && res.data) {
      const rows = (res.data.content || []) as EmployeeRow[];
      employees.value = rows.filter((u) => u.id != null);
    }
  } catch (e) {
    console.error('加载员工失败:', e);
  }
}

async function loadAssignments() {
  if (!factoryId.value || !monthStartDate.value) return;
  loading.value = true;
  try {
    const res = await listAssignments(factoryId.value, monthStartDate.value, monthEndDate.value);
    if (res.success && res.data) {
      assignments.value = res.data as EmployeeShiftAssignment[];
    } else {
      assignments.value = [];
    }
  } catch (e) {
    console.error('加载排班失败:', e);
    assignments.value = [];
  } finally {
    loading.value = false;
  }
}

// ===================== Cell click — quick assign =====================

async function onCellClick(employee: EmployeeRow, date: string) {
  if (!canWrite.value) {
    ElMessage.warning('无权限操作 (需 hr:read_write)');
    return;
  }
  if (!activePaletteShiftId.value) {
    ElMessage.warning('请先在顶部 palette 中选择班次');
    return;
  }
  const existing = getAssignmentFor(employee.id, date);
  const shift = shiftMap.value[activePaletteShiftId.value];
  if (!shift) {
    ElMessage.error('班次不存在, 请刷新 palette');
    return;
  }

  // 已有同班次 → 等同切换 (无意义, 提示)
  if (existing && existing.shiftId === activePaletteShiftId.value) {
    ElMessage.info(`${employee.fullName} · ${date} 已是 ${shift.shiftName}`);
    return;
  }

  try {
    const res = await upsertAssignment(factoryId.value!, {
      userId: employee.id,
      workDate: date,
      shiftId: activePaletteShiftId.value,
    });
    if (res.success && res.data) {
      // 局部更新 — 不全量重 fetch
      const saved = res.data as EmployeeShiftAssignment;
      const existingIdx = assignments.value.findIndex(
        (a) => a.userId === saved.userId && a.workDate === saved.workDate
      );
      if (existingIdx >= 0) {
        assignments.value[existingIdx] = saved;
      } else {
        assignments.value = [...assignments.value, saved];
      }
      ElMessage.success(`${employee.fullName} · ${date} → ${shift.shiftName}`);
    }
  } catch (e) {
    console.error('排班保存失败:', e);
  }
}

async function onCellRightClick(employee: EmployeeRow, date: string, evt: MouseEvent) {
  evt.preventDefault();
  if (!canWrite.value) return;
  const existing = getAssignmentFor(employee.id, date);
  if (!existing) {
    ElMessage.info(`${employee.fullName} · ${date} 无排班可清除`);
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确定清除 ${employee.fullName} ${date} 的排班?`,
      '清除排班',
      { type: 'warning' }
    );
    const res = await deleteAssignment(factoryId.value!, existing.id);
    if (res.success) {
      assignments.value = assignments.value.filter((a) => a.id !== existing.id);
      ElMessage.success('已清除');
    }
  } catch (e) {
    if (e !== 'cancel') console.error('清除失败:', e);
  }
}

// ===================== Bulk assign =====================

function openBulk() {
  if (!canWrite.value) return;
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请在左侧勾选员工 (≥1 行)');
    return;
  }
  bulkForm.value = {
    userIds: selectedRows.value.map((r) => r.id),
    dateStart: monthStartDate.value,
    dateEnd: monthEndDate.value,
    shiftId: activePaletteShiftId.value || (shifts.value[0]?.id ?? ''),
    notes: '',
  };
  bulkDialogVisible.value = true;
}

function expandBulkDates(): string[] {
  const start = new Date(bulkForm.value.dateStart);
  const end = new Date(bulkForm.value.dateEnd);
  const out: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    );
  }
  return out;
}

async function submitBulk() {
  if (!bulkForm.value.shiftId) {
    ElMessage.error('请选择班次');
    return;
  }
  if (!bulkForm.value.dateStart || !bulkForm.value.dateEnd) {
    ElMessage.error('请选择起止日期');
    return;
  }
  if (new Date(bulkForm.value.dateStart) > new Date(bulkForm.value.dateEnd)) {
    ElMessage.error('开始日期必须 <= 结束日期');
    return;
  }
  const dates = expandBulkDates();
  if (dates.length === 0) {
    ElMessage.error('日期范围为空');
    return;
  }
  const totalCells = bulkForm.value.userIds.length * dates.length;
  if (totalCells > 500) {
    try {
      await ElMessageBox.confirm(
        `本次将分配 ${totalCells} 个排班 (${bulkForm.value.userIds.length} 员工 × ${dates.length} 天). 已有排班会被覆盖. 继续?`,
        '批量分配确认',
        { type: 'warning' }
      );
    } catch {
      return;
    }
  }

  bulkSubmitting.value = true;
  try {
    const res = await bulkAssign(factoryId.value!, {
      userIds: bulkForm.value.userIds,
      dates,
      shiftId: bulkForm.value.shiftId,
      notes: bulkForm.value.notes || undefined,
    });
    if (res.success && res.data) {
      ElMessage.success(
        `批量保存完成: 新增 ${res.data.created}, 覆盖 ${res.data.updated}, 合计 ${res.data.total}`
      );
      bulkDialogVisible.value = false;
      await loadAssignments();
    }
  } catch (e) {
    console.error('批量分配失败:', e);
  } finally {
    bulkSubmitting.value = false;
  }
}

function onSelectionChange(rows: EmployeeRow[]) {
  selectedRows.value = rows;
}
</script>

<template>
  <div class="shift-calendar-page">
    <el-card>
      <!-- ===== Header ===== -->
      <div class="header-row">
        <div class="header-title">
          <el-icon><Calendar /></el-icon>
          <h2>排班日历</h2>
          <el-tag size="small" type="info">月视图</el-tag>
        </div>
        <div class="header-actions">
          <el-date-picker
            v-model="selectedMonth"
            type="month"
            value-format="YYYY-MM"
            placeholder="选择月份"
            style="width: 160px;"
          />
          <el-button
            v-if="canWrite"
            type="primary"
            @click="openBulk"
            :disabled="selectedRows.length === 0"
          >
            批量分配 ({{ selectedRows.length }})
          </el-button>
          <el-button :icon="Refresh" @click="loadAssignments">刷新</el-button>
        </div>
      </div>

      <!-- ===== R3 防呆: Shift palette (top toolbar) ===== -->
      <div class="palette-row">
        <span class="palette-label">班次 palette:</span>
        <template v-if="shifts.length === 0">
          <el-empty
            description="本工厂未配置任何班次. 排班依赖班次定义, 请先 seed 或 DB 维护 attendance_shifts 表."
            :image-size="40"
            style="padding: 8px 0;"
          />
        </template>
        <template v-else>
          <el-radio-group v-model="activePaletteShiftId" size="default">
            <el-radio-button
              v-for="s in shifts"
              :key="s.id"
              :value="s.id"
              :style="{
                '--shift-color': shiftColorMap[s.id]?.border,
              }"
            >
              <span
                class="palette-chip"
                :style="{
                  background: shiftColorMap[s.id]?.bg,
                  borderLeft: `3px solid ${shiftColorMap[s.id]?.border}`,
                  color: shiftColorMap[s.id]?.text,
                }"
              >
                {{ s.shiftName }}
                <small>({{ (s.startTime || '').slice(0, 5) }}-{{ (s.endTime || '').slice(0, 5)
                }}{{ s.isOvernight ? '+1' : '' }})</small>
              </span>
            </el-radio-button>
          </el-radio-group>
        </template>
        <el-tooltip
          content="左键点击 cell = 应用选中班次 / 右键 cell = 清除"
          placement="top"
        >
          <el-icon class="palette-hint"><Calendar /></el-icon>
        </el-tooltip>
      </div>

      <!-- ===== R5 防呆: 空状态引导 ===== -->
      <el-alert
        v-if="!loading && employees.length > 0 && shifts.length > 0 && !hasAnyAssignment"
        type="info"
        :closable="false"
        show-icon
        title="本月暂无排班"
        description="操作流程: (1) 顶部选班次 → (2) 点击日历 cell 立即应用 / 或 (3) 勾选员工行 → 点 '批量分配' 一次性铺排"
        style="margin: 12px 0;"
      />

      <el-alert
        v-if="!loading && employees.length === 0"
        type="warning"
        :closable="false"
        show-icon
        title="未加载到员工"
        description="请确认工厂下有员工记录, 或刷新页面重试."
        style="margin: 12px 0;"
      />

      <!-- ===== Calendar grid (el-table fixed-left employee column + day columns) ===== -->
      <div class="calendar-wrapper" v-loading="loading">
        <el-table
          :data="employees"
          border
          stripe
          height="600"
          @selection-change="onSelectionChange"
          row-key="id"
          empty-text="无员工数据"
        >
          <el-table-column type="selection" width="40" fixed="left" />
          <el-table-column
            label="员工"
            min-width="140"
            fixed="left"
          >
            <template #default="{ row }">
              <div class="employee-cell">
                <div class="employee-name">{{ row.fullName || row.username || `User ${row.id}` }}</div>
                <div v-if="row.department" class="employee-meta">{{ row.department }}</div>
              </div>
            </template>
          </el-table-column>

          <el-table-column
            v-for="date in daysInMonth"
            :key="date"
            :label="dayOfMonth(date)"
            width="56"
            align="center"
            :class-name="isWeekend(date) ? 'weekend-col' : ''"
            :label-class-name="isWeekend(date) ? 'weekend-col' : ''"
          >
            <template #header>
              <div class="day-header">
                <div class="day-num">{{ dayOfMonth(date) }}</div>
                <div class="day-week" :class="{ weekend: isWeekend(date) }">
                  {{ weekdayLabel(date) }}
                </div>
              </div>
            </template>
            <template #default="{ row }">
              <el-tooltip
                :content="getCellTooltip(row, date)"
                placement="top"
                :show-after="200"
              >
                <div
                  class="day-cell"
                  :class="{
                    'has-assignment': !!getAssignmentFor(row.id, date),
                    'weekend-cell': isWeekend(date),
                    'clickable': canWrite,
                  }"
                  :style="
                    getAssignmentFor(row.id, date)
                      ? {
                          background: shiftColorMap[getAssignmentFor(row.id, date)!.shiftId]?.bg,
                          color: shiftColorMap[getAssignmentFor(row.id, date)!.shiftId]?.text,
                          borderLeft: `3px solid ${shiftColorMap[getAssignmentFor(row.id, date)!.shiftId]?.border}`,
                        }
                      : {}
                  "
                  @click="onCellClick(row, date)"
                  @contextmenu="(e: MouseEvent) => onCellRightClick(row, date, e)"
                >
                  <template v-if="getAssignmentFor(row.id, date)">
                    {{ shiftMap[getAssignmentFor(row.id, date)!.shiftId]?.shiftCode || '?' }}
                  </template>
                  <template v-else>
                    <span class="empty-mark">·</span>
                  </template>
                </div>
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="legend-row">
        <div class="legend-item">
          <span class="legend-swatch" style="background: #f5f7fa; border: 1px solid #ebeef5;" />
          未排班
        </div>
        <div
          v-for="s in shifts"
          :key="s.id"
          class="legend-item"
        >
          <span
            class="legend-swatch"
            :style="{
              background: shiftColorMap[s.id]?.bg,
              borderLeft: `3px solid ${shiftColorMap[s.id]?.border}`,
            }"
          />
          {{ s.shiftCode }} — {{ s.shiftName }}
        </div>
      </div>
    </el-card>

    <!-- ===== Bulk assign dialog ===== -->
    <el-dialog v-model="bulkDialogVisible" title="批量分配排班" width="540px">
      <el-form :model="bulkForm" label-width="100px">
        <el-form-item label="员工">
          <el-tag
            v-for="uid in bulkForm.userIds"
            :key="uid"
            size="small"
            style="margin-right: 4px; margin-bottom: 4px;"
          >
            {{ employees.find((e) => e.id === uid)?.fullName || `User ${uid}` }}
          </el-tag>
          <div style="color: #909399; font-size: 12px; margin-top: 4px;">
            共 {{ bulkForm.userIds.length }} 位员工 (从主表勾选)
          </div>
        </el-form-item>
        <el-form-item label="日期段" required>
          <el-date-picker
            v-model="bulkForm.dateStart"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="开始"
            style="width: 160px;"
          />
          <span style="margin: 0 8px;">至</span>
          <el-date-picker
            v-model="bulkForm.dateEnd"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="结束"
            style="width: 160px;"
          />
        </el-form-item>
        <el-form-item label="班次" required>
          <!-- R3 防呆: dropdown 自带选项 (不让自由填) -->
          <el-select v-model="bulkForm.shiftId" placeholder="选择班次" style="width: 100%;">
            <el-option
              v-for="s in shifts"
              :key="s.id"
              :label="getShiftDisplay(s)"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="bulkForm.notes"
            type="textarea"
            :rows="2"
            placeholder="可选 — e.g. 五一加班排"
          />
        </el-form-item>
        <el-alert
          type="warning"
          :closable="false"
          show-icon
          title="覆盖提示"
          description="同员工同日期已有排班的, 将被本次班次覆盖. 该操作不可撤销 (但可重新分配)."
        />
      </el-form>
      <template #footer>
        <el-button @click="bulkDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="bulkSubmitting" @click="submitBulk">
          确认分配
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.shift-calendar-page {
  padding: 16px;
  background: #f5f7fa;
  min-height: calc(100vh - 64px);
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-title h2 {
  margin: 0;
  font-size: 18px;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.palette-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: #fafbfc;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.palette-label {
  font-weight: 500;
  color: #303133;
  font-size: 13px;
}

.palette-chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 12px;
  line-height: 18px;
}

.palette-chip small {
  font-weight: 400;
  opacity: 0.8;
  margin-left: 4px;
}

.palette-hint {
  color: #909399;
  font-size: 14px;
  cursor: help;
}

.calendar-wrapper {
  margin-top: 8px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  overflow: hidden;
}

.employee-cell {
  padding: 2px 4px;
}

.employee-name {
  font-weight: 500;
  font-size: 13px;
  color: #303133;
}

.employee-meta {
  font-size: 11px;
  color: #909399;
  margin-top: 2px;
}

.day-header {
  text-align: center;
  font-size: 12px;
}

.day-num {
  font-weight: 600;
  color: #303133;
}

.day-week {
  font-size: 10px;
  color: #909399;
}

.day-week.weekend {
  color: #f56c6c;
}

.day-cell {
  width: 100%;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 500;
  border-radius: 3px;
  user-select: none;
  transition: background 0.15s;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.day-cell.clickable {
  cursor: pointer;
}

.day-cell.clickable:hover {
  filter: brightness(0.95);
  outline: 1px dashed #409eff;
}

.day-cell.weekend-cell:not(.has-assignment) {
  background: #fff5f5;
}

.empty-mark {
  color: #c0c4cc;
  font-size: 18px;
}

:deep(.weekend-col) {
  background: #fff8f8 !important;
}

.legend-row {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  padding: 8px 12px;
  background: #fafbfc;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  flex-wrap: wrap;
  font-size: 12px;
  color: #606266;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-swatch {
  display: inline-block;
  width: 24px;
  height: 14px;
  border-radius: 2px;
}
</style>
