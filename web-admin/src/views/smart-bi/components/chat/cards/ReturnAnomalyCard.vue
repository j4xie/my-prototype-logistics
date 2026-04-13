<template>
  <div class="return-anomaly-card">
    <h4>退货异常检测</h4>
    <div v-if="anomalies.length">
      <div v-for="(a, i) in anomalies" :key="i" class="anomaly-item">
        <div class="anomaly-header">
          <el-tag :type="a.severity === 'HIGH' ? 'danger' : 'warning'" size="small">
            {{ a.severity === 'HIGH' ? '高危' : '中危' }}
          </el-tag>
          <span class="store">{{ a.store_name ?? a.store_id }}</span>
          <span class="supplier" v-if="a.supplier_name">· {{ a.supplier_name }}</span>
          <span class="pct red">退货率 {{ a.return_pct }}%</span>
        </div>
        <p v-if="a.reason" class="reason">{{ a.reason }}</p>
      </div>
    </div>
    <div v-if="batches.length" class="batches">
      <h5>批次汇总</h5>
      <el-table :data="batches" size="small" stripe>
        <el-table-column prop="batch_id" label="批次" width="120" />
        <el-table-column prop="avg_return_pct" label="平均退货率" align="right" width="110" />
        <el-table-column prop="anomaly_count" label="异常门店数" align="right" width="110" />
      </el-table>
    </div>
    <p v-if="!anomalies.length && !batches.length" class="empty">未检测到退货异常</p>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ data: Record<string, unknown> }>();
const anomalies = computed(() => (props.data?.anomalies as Array<Record<string, unknown>>) ?? []);
const batches = computed(() => (props.data?.batch_summaries as Array<Record<string, unknown>>) ?? []);
</script>
<style scoped>
.return-anomaly-card { padding: 12px; }
.anomaly-item { margin-bottom: 10px; padding: 8px 10px; background: #fff8f8; border-left: 3px solid #f56c6c; border-radius: 4px; }
.anomaly-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.store { font-weight: bold; }
.supplier { color: #909399; font-size: 12px; }
.pct { font-size: 13px; }
.red { color: #f56c6c; }
.reason { margin: 4px 0 0; font-size: 12px; color: #606266; }
.batches { margin-top: 12px; }
.batches h5 { margin: 0 0 8px; font-size: 13px; color: #606266; }
.empty { color: #909399; font-size: 13px; margin-top: 8px; }
</style>
