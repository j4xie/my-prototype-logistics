<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post, del } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Refresh, Connection, Delete } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('system'));

const loading = ref(false);
const connections = ref<any[]>([]);
const dialogVisible = ref(false);
const testLoading = ref<Record<string, boolean>>({});
const syncLoading = ref<Record<string, boolean>>({});

const brandMap: Record<string, { name: string; color: string }> = {
  KERUYUN: { name: '客如云', color: '#ff6600' },
  ERWEIHUO: { name: '二维火', color: '#e63946' },
  YINBAO: { name: '银豹', color: '#2a9d8f' },
  MEITUAN: { name: '美团', color: '#ffd60a' },
  HUALALA: { name: '哗啦啦', color: '#457b9d' },
};

const form = ref({
  brand: 'KERUYUN',
  connectionName: '',
  appKey: '',
  appSecret: '',
  posStoreId: '',
  remark: '',
});

onMounted(() => loadConnections());

async function loadConnections() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const res = await get(`/${factoryId.value}/pos/connections`);
    if (res.success) connections.value = Array.isArray(res.data) ? res.data : [];
  } catch { ElMessage.error('加载失败'); }
  finally { loading.value = false; }
}

async function handleCreate() {
  if (!form.value.connectionName || !form.value.appKey) return ElMessage.warning('请填写必填项');
  try {
    const res = await post(`/${factoryId.value}/pos/connections`, form.value);
    if (res.success) { ElMessage.success('创建成功'); dialogVisible.value = false; loadConnections(); }
  } catch { ElMessage.error('创建失败'); }
}

async function handleDelete(id: string) {
  try {
    await ElMessageBox.confirm('确认删除此POS连接？', '提示');
    const res = await del(`/${factoryId.value}/pos/connections/${id}`);
    if (res.success) { ElMessage.success('删除成功'); loadConnections(); }
  } catch { /* cancelled */ }
}

async function handleToggle(id: string, active: boolean) {
  try {
    const res = await post(`/${factoryId.value}/pos/connections/${id}/toggle`, undefined, { params: { active } } as any);
    if (res.success) { ElMessage.success(active ? '已启用' : '已停用'); loadConnections(); }
  } catch { ElMessage.error('操作失败'); }
}

async function handleTest(id: string) {
  testLoading.value[id] = true;
  try {
    const res = await post(`/${factoryId.value}/pos/connections/${id}/test`);
    if (res.success) {
      ElMessage.success('连接测试成功');
    } else {
      ElMessage.error(res.message || '连接测试失败');
    }
  } catch { ElMessage.error('连接测试失败'); }
  finally { testLoading.value[id] = false; }
}

async function handleSync(id: string) {
  syncLoading.value[id] = true;
  try {
    const res = await post(`/${factoryId.value}/pos/connections/${id}/sync`);
    if (res.success) {
      const count = Array.isArray(res.data) ? res.data.length : 0;
      ElMessage.success(`同步完成，获取 ${count} 条订单`);
    }
  } catch { ElMessage.error('同步失败'); }
  finally { syncLoading.value[id] = false; }
}
</script>

<template>
  <div class="page-wrapper">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">POS集成管理</span>
            <span class="data-count">{{ connections.length }} 个连接</span>
          </div>
          <div class="header-right">
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="dialogVisible = true">新建连接</el-button>
            <el-button :icon="Refresh" @click="loadConnections">刷新</el-button>
          </div>
        </div>
      </template>

      <div v-if="connections.length === 0 && !loading" style="padding: 40px 0">
        <el-empty description="暂无POS连接，点击上方按钮创建" />
      </div>

      <div v-else class="connection-grid">
        <el-card v-for="conn in connections" :key="conn.id" class="conn-card" shadow="hover">
          <div class="conn-header">
            <div class="conn-brand">
              <el-tag :color="brandMap[conn.brand]?.color || '#909399'" effect="dark" size="small">
                {{ brandMap[conn.brand]?.name || conn.brand }}
              </el-tag>
              <span class="conn-name">{{ conn.connectionName }}</span>
            </div>
            <el-switch v-if="canWrite" :model-value="conn.isActive" @change="(val: boolean) => handleToggle(conn.id, val)" />
          </div>

          <el-descriptions :column="2" size="small" border style="margin-top: 12px">
            <el-descriptions-item label="App Key">{{ conn.appKey ? '***' + conn.appKey.slice(-4) : '-' }}</el-descriptions-item>
            <el-descriptions-item label="门店ID">{{ conn.posStoreId || '-' }}</el-descriptions-item>
            <el-descriptions-item label="最近同步">{{ conn.lastSyncAt || '从未同步' }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="conn.isActive ? 'success' : 'info'" size="small">
                {{ conn.isActive ? '已启用' : '已停用' }}
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>

          <div v-if="conn.lastError" class="conn-error">
            <el-alert :title="conn.lastError" type="error" :closable="false" show-icon />
          </div>

          <div class="conn-actions" v-if="canWrite">
            <el-button type="primary" size="small" :icon="Connection" :loading="testLoading[conn.id]"
              @click="handleTest(conn.id)">测试连接</el-button>
            <el-button type="warning" size="small" :loading="syncLoading[conn.id]"
              @click="handleSync(conn.id)">手动同步</el-button>
            <el-button type="danger" size="small" :icon="Delete"
              @click="handleDelete(conn.id)">删除</el-button>
          </div>
        </el-card>
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" title="新建POS连接" width="520px" destroy-on-close>
      <el-form :model="form" label-width="100px">
        <el-form-item label="POS品牌">
          <el-select v-model="form.brand" style="width: 100%">
            <el-option v-for="(v, k) in brandMap" :key="k" :label="v.name" :value="k" />
          </el-select>
        </el-form-item>
        <el-form-item label="连接名称"><el-input v-model="form.connectionName" placeholder="如：白垩纪-客如云POS" /></el-form-item>
        <el-form-item label="App Key"><el-input v-model="form.appKey" /></el-form-item>
        <el-form-item label="App Secret"><el-input v-model="form.appSecret" type="password" show-password /></el-form-item>
        <el-form-item label="门店ID"><el-input v-model="form.posStoreId" placeholder="POS系统中的门店标识" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.page-wrapper { height: 100%; width: 100%; display: flex; flex-direction: column; }
.page-card { flex: 1; display: flex; flex-direction: column;
  :deep(.el-card__header) { padding: 16px 20px; border-bottom: 1px solid #ebeef5; }
  :deep(.el-card__body) { flex: 1; padding: 20px; overflow-y: auto; }
}
.card-header { display: flex; justify-content: space-between; align-items: center;
  .header-left { display: flex; align-items: baseline; gap: 12px;
    .page-title { font-size: 16px; font-weight: 600; color: #303133; }
    .data-count { font-size: 13px; color: #909399; }
  }
  .header-right { display: flex; gap: 8px; }
}
.connection-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(480px, 1fr)); gap: 16px; }
.conn-card {
  .conn-header { display: flex; justify-content: space-between; align-items: center; }
  .conn-brand { display: flex; align-items: center; gap: 8px;
    .conn-name { font-weight: 600; font-size: 15px; }
  }
  .conn-error { margin-top: 12px; }
  .conn-actions { display: flex; gap: 8px; margin-top: 16px; padding-top: 12px; border-top: 1px solid #ebeef5; }
}
</style>
