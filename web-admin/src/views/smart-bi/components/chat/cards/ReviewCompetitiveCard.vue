<template>
  <div class="review-competitive-card">
    <h4>评论竞品分析</h4>
    <el-table v-if="ranking.length" :data="ranking" size="small" stripe>
      <el-table-column prop="rank" label="排名" width="60" align="center" />
      <el-table-column label="品牌" min-width="120">
        <template #default="{ row }">
          <strong v-if="row.is_own" class="own-brand">{{ row.brand_name }}</strong>
          <span v-else>{{ row.brand_name }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="rating" label="评分" align="right" width="70" />
      <el-table-column prop="review_count" label="评论数" align="right" width="80" />
      <el-table-column v-if="canViewPrice" prop="avg_spend" label="客单价" align="right" width="90">
        <template #default="{ row }">
          {{ row.avg_spend != null ? '¥' + row.avg_spend : '-' }}
        </template>
      </el-table-column>
    </el-table>
    <div v-if="insights.length" class="insights">
      <el-alert
        v-for="(insight, i) in insights"
        :key="i"
        :title="insight"
        type="info"
        :closable="false"
        show-icon
        style="margin-top: 8px;"
      />
    </div>
    <p v-if="!ranking.length" class="empty">暂无竞品数据</p>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { usePermissionStore } from '@/store/modules/permission';
const props = defineProps<{ data: Record<string, unknown> }>();
const permissionStore = usePermissionStore();
const canViewPrice = computed(() => permissionStore.canViewPrice);
const ranking = computed(() => (props.data?.ranking as Array<Record<string, unknown>>) ?? []);
const insights = computed(() => (props.data?.insights as string[]) ?? []);
</script>
<style scoped>
.review-competitive-card { padding: 12px; }
.own-brand { color: #409eff; font-weight: bold; }
.insights { margin-top: 12px; }
.empty { color: #909399; font-size: 13px; margin-top: 8px; }
</style>
