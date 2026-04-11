<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import { ElMessage } from 'element-plus';
import { Search, Refresh } from '@element-plus/icons-vue';

// V3 P1-3 / v1 §2.1 — "已转样品库" 专用视图
// 客户要求 (1007s): "只保留 2 个页面: 研发样品管理 + 转样品库"
// 本页显示 productStatus='已转报模' 的样品, 作为成品转化后的"样品库".

const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);

const loading = ref(false);
const tableData = ref<Record<string, unknown>[]>([]);
const pagination = ref({ page: 0, size: 20, total: 0 });
const searchForm = ref({ customerName: '', name: '' });

async function loadData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const params: Record<string, unknown> = {
      page: pagination.value.page,
      size: pagination.value.size,
      productStatus: '已转报模',
    };
    if (searchForm.value.name) params.name = searchForm.value.name;
    if (searchForm.value.customerName) params.customerName = searchForm.value.customerName;
    const res = await get(`/${factoryId.value}/rd/samples`, { params });
    if (res.success) {
      let items = res.data.content || [];
      // 后端不一定支持 productStatus 参数, 前端兜底过滤
      items = items.filter((r: Record<string, unknown>) =>
        String(r.productStatus || '') === '已转报模'
      );
      if (searchForm.value.name) {
        const kw = searchForm.value.name.toLowerCase();
        items = items.filter((r: Record<string, unknown>) =>
          String(r.name || '').toLowerCase().includes(kw)
        );
      }
      if (searchForm.value.customerName) {
        const kw = searchForm.value.customerName.toLowerCase();
        items = items.filter((r: Record<string, unknown>) =>
          String(r.customerName || '').toLowerCase().includes(kw)
        );
      }
      tableData.value = items;
      pagination.value.total = items.length;
    }
  } catch {
    ElMessage.error('加载数据失败');
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pagination.value.page = 0;
  loadData();
}

function resetSearch() {
  searchForm.value = { customerName: '', name: '' };
  pagination.value.page = 0;
  loadData();
}

function handlePageChange(page: number) {
  pagination.value.page = page - 1;
  loadData();
}

onMounted(() => loadData());
</script>

<template>
  <div class="page-wrapper" v-loading="loading">
    <el-card shadow="never">
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:16px;font-weight:600">已转样品库</span>
          <el-tag type="success" size="small">{{ pagination.total }} 个产品已转报模</el-tag>
        </div>
      </template>

      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        <el-input
          v-model="searchForm.name"
          placeholder="产品名称"
          clearable
          style="width:180px"
          :prefix-icon="Search"
          @keyup.enter="handleSearch"
        />
        <el-input
          v-model="searchForm.customerName"
          placeholder="客户筛选"
          clearable
          style="width:160px"
          @keyup.enter="handleSearch"
        />
        <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="resetSearch">重置</el-button>
      </div>

      <el-table :data="tableData" border stripe>
        <el-table-column prop="sampleCode" label="样品编码" width="180" />
        <el-table-column prop="name" label="产品名称" min-width="140" />
        <el-table-column prop="customerName" label="客户名称" min-width="120" show-overflow-tooltip />
        <el-table-column prop="specification" label="规格" width="120" show-overflow-tooltip />
        <el-table-column prop="productLevel" label="级别" width="80" align="center">
          <template #default="{ row }">{{ row.productLevel || '-' }}</template>
        </el-table-column>
        <el-table-column prop="salesperson" label="业务员" width="100" />
        <el-table-column prop="sellingPoints" label="卖点" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.sellingPoints || '-' }}</template>
        </el-table-column>
        <el-table-column prop="customerExpectedPrice" label="客户预期价" width="110" align="right">
          <template #default="{ row }">
            {{ row.customerExpectedPrice ? '¥' + Number(row.customerExpectedPrice).toFixed(2) : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="转报模时间" width="170" />
      </el-table>

      <div style="display:flex;justify-content:flex-end;margin-top:16px">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @current-change="handlePageChange"
          @size-change="loadData"
        />
      </div>
    </el-card>
  </div>
</template>
