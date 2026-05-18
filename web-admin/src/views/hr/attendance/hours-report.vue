<script setup lang="ts">
/**
 * 工时统计 (#835 follow-up — H-ATT 工时报表).
 *
 * Reads `/hr/attendance-hours/list?yearMonth=YYYY-MM`. Allows filtering by
 * department + sorting by overtime. Read-only.
 *
 * 防呆 R2: rows show employee name + dept + computed hours + variance vs scheduled.
 * 防呆 R5: empty state — "本月无打卡数据 — 检查 TimeClockRecord 录入" + CTA to attendance list.
 */
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get } from '@/api/request';
import { Refresh, Document } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const router = useRouter();
const factoryId = computed(() => authStore.factoryId);
const canHRManage = computed(() => permissionStore.canWrite('hr'));

interface HoursRow {
  userId: number;
  userName: string;
  department: string | null;
  yearMonth: string;
  workedHours: number;
  scheduledHours: number;
  overtimeHours: number;
  lateMinutes: number;
  absentDays: number;
  comptimeEarned: number;
  clockedDays: number;
  scheduledDays: number;
}

const loading = ref(false);
const tableData = ref<HoursRow[]>([]);
const yearMonth = ref<string>(currentYearMonth());
const deptFilter = ref<string>('');

const filteredData = computed<HoursRow[]>(() => {
  if (!deptFilter.value) return tableData.value;
  return tableData.value.filter(
    (row) => (row.department || '') === deptFilter.value
  );
});

const departments = computed<string[]>(() => {
  const seen = new Set<string>();
  for (const row of tableData.value) {
    if (row.department) seen.add(row.department);
  }
  return Array.from(seen).sort();
});

const totals = computed(() => {
  const rows = filteredData.value;
  let worked = 0;
  let scheduled = 0;
  let ot = 0;
  let late = 0;
  let absent = 0;
  let comp = 0;
  for (const r of rows) {
    worked += r.workedHours;
    scheduled += r.scheduledHours;
    ot += r.overtimeHours;
    late += r.lateMinutes;
    absent += r.absentDays;
    comp += r.comptimeEarned;
  }
  return {
    headcount: rows.length,
    workedHours: round2(worked),
    scheduledHours: round2(scheduled),
    overtimeHours: round2(ot),
    lateMinutes: late,
    absentDays: absent,
    comptimeEarned: round2(comp),
  };
});

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function variancePct(row: HoursRow): number | null {
  if (!row.scheduledHours || row.scheduledHours === 0) return null;
  return round2(
    ((row.workedHours - row.scheduledHours) / row.scheduledHours) * 100
  );
}

onMounted(() => {
  if (canHRManage.value) loadList();
});

watch(yearMonth, () => {
  if (canHRManage.value) loadList();
});

async function loadList(): Promise<void> {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const res = await get<HoursRow[]>(
      `/${factoryId.value}/hr/attendance-hours/list`,
      { params: { yearMonth: yearMonth.value } }
    );
    if (res.success && Array.isArray(res.data)) {
      tableData.value = res.data;
    } else {
      tableData.value = [];
    }
  } catch (e) {
    console.error('加载工时统计失败:', e);
    tableData.value = [];
  } finally {
    loading.value = false;
  }
}

function goAttendance(): void {
  router.push({ name: 'HRAttendance' });
}
</script>

<template>
  <div class="hours-report-page" style="padding: 16px;">
    <el-card v-if="!canHRManage">
      <el-empty description="需要 HR 管理权限 (hr:read_write) 才能查看工厂全员工时报表">
        <el-button type="primary" @click="$router.push({ name: 'HRAttendance' })">
          返回考勤管理
        </el-button>
      </el-empty>
    </el-card>

    <el-card v-else>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div>
          <h2 style="margin: 0;">工时统计</h2>
          <p style="margin: 4px 0 0 0; color: #909399; font-size: 13px;">
            按月份聚合每位员工的工时 / 加班 / 迟到 / 缺勤,
            数据源: TimeClockRecord + EmployeeShiftAssignment.
            默认按加班工时倒序.
          </p>
        </div>
        <el-button :icon="Refresh" @click="loadList">刷新</el-button>
      </div>

      <!-- 过滤栏 -->
      <el-form inline>
        <el-form-item label="月份">
          <el-input
            v-model="yearMonth"
            placeholder="YYYY-MM"
            style="width: 140px;"
            @change="loadList"
          />
        </el-form-item>
        <el-form-item label="部门">
          <el-select
            v-model="deptFilter"
            placeholder="全部部门"
            clearable
            style="width: 180px;"
          >
            <el-option
              v-for="d in departments"
              :key="d"
              :label="d"
              :value="d"
            />
          </el-select>
        </el-form-item>
      </el-form>

      <!-- 汇总卡片 -->
      <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 12px;">
        <el-card shadow="never" class="summary-card">
          <div class="summary-label">参与员工</div>
          <div class="summary-value">{{ totals.headcount }}</div>
        </el-card>
        <el-card shadow="never" class="summary-card">
          <div class="summary-label">实际工时(h)</div>
          <div class="summary-value">{{ totals.workedHours }}</div>
        </el-card>
        <el-card shadow="never" class="summary-card">
          <div class="summary-label">排班工时(h)</div>
          <div class="summary-value">{{ totals.scheduledHours }}</div>
        </el-card>
        <el-card shadow="never" class="summary-card">
          <div class="summary-label">加班工时(h)</div>
          <div class="summary-value" style="color: #e6a23c;">{{ totals.overtimeHours }}</div>
        </el-card>
        <el-card shadow="never" class="summary-card">
          <div class="summary-label">迟到(min)</div>
          <div class="summary-value" style="color: #f56c6c;">{{ totals.lateMinutes }}</div>
        </el-card>
        <el-card shadow="never" class="summary-card">
          <div class="summary-label">缺勤(天)</div>
          <div class="summary-value" style="color: #f56c6c;">{{ totals.absentDays }}</div>
        </el-card>
      </div>

      <el-table
        :data="filteredData"
        v-loading="loading"
        stripe
        :default-sort="{ prop: 'overtimeHours', order: 'descending' }"
      >
        <el-table-column prop="userName" label="姓名" width="120" fixed />
        <el-table-column prop="department" label="部门" width="120">
          <template #default="{ row }">
            {{ row.department || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="userId" label="员工ID" width="100" />
        <el-table-column prop="workedHours" label="实际工时(h)" width="120" sortable>
          <template #default="{ row }">
            <span style="font-weight: 500;">{{ row.workedHours }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="scheduledHours" label="排班工时(h)" width="120" sortable>
          <template #default="{ row }">
            <span style="color: #909399;">{{ row.scheduledHours }}</span>
          </template>
        </el-table-column>
        <el-table-column label="差异" width="120">
          <template #default="{ row }">
            <span
              v-if="variancePct(row) !== null"
              :style="{
                color: (variancePct(row) ?? 0) >= 0 ? '#67c23a' : '#e6a23c',
                fontWeight: 500
              }"
            >
              {{ (variancePct(row) ?? 0) >= 0 ? '+' : '' }}{{ variancePct(row) }}%
            </span>
            <span v-else style="color: #c0c4cc;">N/A</span>
          </template>
        </el-table-column>
        <el-table-column prop="overtimeHours" label="加班(h)" width="100" sortable>
          <template #default="{ row }">
            <el-tag
              v-if="row.overtimeHours > 0"
              type="warning"
              size="small"
              style="font-weight: 500;"
            >
              +{{ row.overtimeHours }}
            </el-tag>
            <span v-else style="color: #909399;">0</span>
          </template>
        </el-table-column>
        <el-table-column prop="lateMinutes" label="迟到(min)" width="110" sortable>
          <template #default="{ row }">
            <el-tag
              v-if="row.lateMinutes > 0"
              type="danger"
              size="small"
            >
              {{ row.lateMinutes }}
            </el-tag>
            <span v-else style="color: #909399;">0</span>
          </template>
        </el-table-column>
        <el-table-column prop="absentDays" label="缺勤(天)" width="100" sortable>
          <template #default="{ row }">
            <el-tag
              v-if="row.absentDays > 0"
              type="danger"
              size="small"
            >
              {{ row.absentDays }}
            </el-tag>
            <span v-else style="color: #909399;">0</span>
          </template>
        </el-table-column>
        <el-table-column prop="clockedDays" label="打卡(天)" width="100">
          <template #default="{ row }">
            <span>{{ row.clockedDays }}/{{ row.scheduledDays }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="comptimeEarned" label="调休入账(h)" width="120">
          <template #default="{ row }">
            <span
              v-if="row.comptimeEarned > 0"
              style="color: #67c23a; font-weight: 500;"
            >
              +{{ row.comptimeEarned }}
            </span>
            <span v-else style="color: #909399;">0</span>
          </template>
        </el-table-column>

        <!-- 防呆 R5: empty state with CTA -->
        <template #empty>
          <div style="padding: 40px 20px; text-align: center;">
            <el-icon :size="48" color="#c0c4cc"><Document /></el-icon>
            <p style="color: #909399; margin: 16px 0 8px 0;">本月无打卡数据</p>
            <p style="color: #c0c4cc; font-size: 13px; margin: 0 0 16px 0;">
              请检查 TimeClockRecord 录入, 或确认本月是否有员工排班.
            </p>
            <el-button size="small" type="primary" @click="goAttendance">
              查看考勤明细
            </el-button>
          </div>
        </template>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.summary-card :deep(.el-card__body) {
  padding: 12px;
}
.summary-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}
.summary-value {
  font-size: 22px;
  font-weight: 600;
  color: #303133;
}
</style>
