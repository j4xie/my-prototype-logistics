<template>
  <div class="tpl-grid-section">
    <div class="tpl-grid-header">
      <h3>📊 模板分析</h3>
      <el-button
        v-if="!loading && hasAnyData"
        size="small"
        type="text"
        @click="refresh"
      >
        刷新
      </el-button>
    </div>
    <div v-if="loadError" class="tpl-grid-error">
      加载模板分析失败: {{ loadError }}
    </div>
    <div class="tpl-grid" v-else>
      <TemplateCard
        v-for="code in codes"
        :key="code"
        :code="code"
        :item="itemsMap[code]"
        :status="statusFor(code)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import TemplateCard from './TemplateCard.vue';
import {
  getAnalysisResults,
  type AnalysisResultItem,
} from '@/api/smartbi/analysisResults';
import { getPageCodes } from '../composables/useTemplateMap';

const props = defineProps<{
  /** Page key (dashboard|finance|trend|restaurantv2) */
  pageKey: string;
  /** Factory id — usually from useFactoryStore in parent */
  factoryId: string;
  /** Optional: pin to one upload; omit for latest-per-code resolution */
  uploadId?: number;
}>();

const loading = ref(true);
const loadError = ref('');
const items = ref<AnalysisResultItem[]>([]);
const missingCodes = ref<string[]>([]);
const neverCodes = ref<string[]>([]);

const codes = computed(() => getPageCodes(props.pageKey));

const itemsMap = computed(() => {
  const m: Record<string, AnalysisResultItem> = {};
  for (const i of items.value) m[i.template_code] = i;
  return m;
});

const hasAnyData = computed(() => items.value.length > 0);

function statusFor(code: string): 'loading' | 'loaded' | 'missing' | 'never' {
  if (loading.value) return 'loading';
  if (itemsMap.value[code]) return 'loaded';
  if (missingCodes.value.includes(code)) return 'missing';
  if (neverCodes.value.includes(code)) return 'never';
  return 'never'; // safe fallback
}

async function load() {
  if (!props.factoryId || codes.value.length === 0) return;
  loading.value = true;
  loadError.value = '';
  try {
    const resp = await getAnalysisResults(
      props.factoryId,
      [...codes.value],
      props.uploadId !== undefined ? { uploadId: props.uploadId } : {},
    );
    if (resp.success && resp.data) {
      items.value = resp.data.items || [];
      missingCodes.value = resp.data.missing_codes || [];
      neverCodes.value = resp.data.never_materialized_codes || [];
    } else {
      loadError.value = resp.message || '接口返回空';
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
    console.error('[TemplateGrid] load failed', e);
  } finally {
    loading.value = false;
  }
}

function refresh() {
  load();
}

onMounted(load);
watch(() => [props.factoryId, props.pageKey, props.uploadId], load);
</script>

<style scoped>
.tpl-grid-section {
  margin-top: 24px;
}
.tpl-grid-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.tpl-grid-header h3 {
  margin: 0;
  font-size: 16px;
}
.tpl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 16px;
}
.tpl-grid-error {
  padding: 16px;
  background: #fef0f0;
  color: #f56c6c;
  border-radius: 4px;
}
</style>
