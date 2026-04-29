<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import {
  getSchedulingSettings,
  updateSchedulingSettings,
  SchedulingSettings
} from '@/api/scheduling';
import { ElMessage } from 'element-plus';
import { Refresh, Check, InfoFilled } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('scheduling'));

const loading = ref(false);
const saving = ref(false);
const form = ref<SchedulingSettings>({
  autoSchedulingMode: 'MANUAL_CONFIRM',
  lowRiskThreshold: 0.85,
  mediumRiskThreshold: 0.70,
  enableNotifications: true,
  autoTriggerEnabled: false
});

onMounted(() => {
  loadSettings();
});

// R32 P6 (I5) — 总闸 OFF 时, 把模式归位到 MANUAL_CONFIRM, 避免"看似配了 FULLY_AUTO 但被 OFF 屏蔽"的歧义
watch(() => form.value.autoTriggerEnabled, (enabled) => {
  if (!enabled && form.value.autoSchedulingMode === 'FULLY_AUTO') {
    form.value.autoSchedulingMode = 'MANUAL_CONFIRM';
  }
});

async function loadSettings() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const response = await getSchedulingSettings(factoryId.value);
    if (response.success && response.data) {
      form.value = { ...form.value, ...response.data };
    }
  } catch (error) {
    console.error('加载排产设置失败:', error);
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  if (!factoryId.value) return;
  if (form.value.lowRiskThreshold <= form.value.mediumRiskThreshold) {
    ElMessage.warning('低风险阈值必须大于中风险阈值');
    return;
  }
  saving.value = true;
  try {
    const response = await updateSchedulingSettings(factoryId.value, form.value);
    if (response.success && response.data) {
      form.value = { ...form.value, ...response.data };
      ElMessage.success('排产设置已保存');
    }
  } catch (error) {
    console.error('保存失败:', error);
  } finally {
    saving.value = false;
  }
}

function handleReset() {
  loadSettings();
}

const modeDescription = computed(() => {
  switch (form.value.autoSchedulingMode) {
    case 'FULLY_AUTO':
      return '完全自动: 低风险计划直接排产生效, 中高风险继续走人工确认';
    case 'MANUAL_CONFIRM':
      return '人工确认: AI 生成排产建议, 等待主管确认后才生效 (推荐, 安全)';
    case 'DISABLED':
      return '已禁用: 不触发任何自动排产, PP 创建后需完全手动操作';
    default:
      return '';
  }
});
</script>

<template>
  <div class="scheduling-settings-page" v-loading="loading">
    <el-page-header :icon="null">
      <template #content>
        <span class="page-title">排产自动化设置</span>
      </template>
      <template #extra>
        <el-button :icon="Refresh" @click="handleReset" :disabled="saving">重置</el-button>
        <el-button
          type="primary"
          :icon="Check"
          :loading="saving"
          :disabled="!canWrite"
          @click="handleSave"
        >保存</el-button>
      </template>
    </el-page-header>

    <el-alert
      class="info-banner"
      type="info"
      :icon="InfoFilled"
      show-icon
      :closable="false"
    >
      <template #title>
        排产链路两阶段: ① SO 财审 → 自动建生产计划 PP (供应链联动, 不受本页控制) ② PP 生成后是否进入排程 (本页设置 = 此阶段开关)
      </template>
    </el-alert>

    <el-card class="settings-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>核心开关</span>
        </div>
      </template>

      <el-form label-width="180px" :model="form">
        <el-form-item label="自动排产总开关">
          <el-switch
            v-model="form.autoTriggerEnabled"
            :disabled="!canWrite"
            active-text="开启"
            inactive-text="关闭"
          />
          <div class="form-hint">
            控制 PP 创建后是否进入排程链 (是 isAutoSchedulingEnabled gate). 关闭后, 模式与阈值都不生效, PP 仍由供应链自动创建但停留在 PENDING 等人工排程.
          </div>
        </el-form-item>

        <el-form-item label="自动排产模式">
          <el-radio-group v-model="form.autoSchedulingMode" :disabled="!canWrite || !form.autoTriggerEnabled">
            <el-radio-button value="DISABLED">禁用</el-radio-button>
            <el-radio-button value="MANUAL_CONFIRM">人工确认</el-radio-button>
            <el-radio-button value="FULLY_AUTO">完全自动</el-radio-button>
          </el-radio-group>
          <div class="form-hint">{{ modeDescription }}</div>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="settings-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>风险阈值</span>
          <span class="card-subtitle">AI 计算计划完成概率, 按概率落入区间决定处理方式</span>
        </div>
      </template>

      <el-form label-width="180px" :model="form">
        <el-form-item label="低风险阈值">
          <el-slider
            v-model="form.lowRiskThreshold"
            :min="0.5"
            :max="1.0"
            :step="0.01"
            :format-tooltip="(v: number) => (v * 100).toFixed(0) + '%'"
            :disabled="!canWrite"
            show-input
            :show-input-controls="false"
          />
          <div class="form-hint">
            完成概率 ≥ {{ (form.lowRiskThreshold * 100).toFixed(0) }}% 视为低风险, FULLY_AUTO 模式下直接生效
          </div>
        </el-form-item>

        <el-form-item label="中风险阈值">
          <el-slider
            v-model="form.mediumRiskThreshold"
            :min="0.3"
            :max="0.9"
            :step="0.01"
            :format-tooltip="(v: number) => (v * 100).toFixed(0) + '%'"
            :disabled="!canWrite"
            show-input
            :show-input-controls="false"
          />
          <div class="form-hint">
            完成概率在 {{ (form.mediumRiskThreshold * 100).toFixed(0) }}% - {{ (form.lowRiskThreshold * 100).toFixed(0) }}% 之间视为中风险, 等待人工确认; 低于 {{ (form.mediumRiskThreshold * 100).toFixed(0) }}% 视为高风险, 紧急推送主管
          </div>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="settings-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>通知</span>
        </div>
      </template>

      <el-form label-width="180px" :model="form">
        <el-form-item label="通知开关">
          <el-switch
            v-model="form.enableNotifications"
            :disabled="!canWrite"
            active-text="开启"
            inactive-text="关闭"
          />
          <div class="form-hint">
            自动排产触发或高风险计划出现时, 推送通知给排产主管
          </div>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.scheduling-settings-page {
  padding: 16px;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
}

.info-banner {
  margin: 16px 0;
}

.settings-card {
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.card-subtitle {
  font-size: 12px;
  color: #909399;
  font-weight: normal;
}

.form-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  line-height: 1.6;
}
</style>
