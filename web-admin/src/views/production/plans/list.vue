<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search, Refresh, VideoPlay, VideoPause, CircleCheck, CircleClose, Download, Upload, ChatDotRound } from '@element-plus/icons-vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  downloadImportTemplate,
  importProductionPlans,
  exportProductionPlans,
  getProductionLines,
  getSupervisors,
} from '@/api/productionPlan';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('production'));

const loading = ref(false);
const tableData = ref<any[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });
const searchForm = ref({
  keyword: '',
  status: ''
});

// 新建计划对话框
const dialogVisible = ref(false);
const dialogLoading = ref(false);
const planForm = ref({
  productTypeId: '',
  plannedQuantity: 0,
  plannedDate: '',
  notes: '',
  suggestedProductionLineId: '' as string | undefined,
  estimatedWorkers: undefined as number | undefined,
  assignedSupervisorId: '' as string | undefined,
});
const productTypes = ref<any[]>([]);

// Import/Export & reference data
const productionLines = ref<any[]>([]);
const supervisors = ref<any[]>([]);

// AI Chat state
const aiChatVisible = ref(false);
const chatMessages = ref<Array<{ role: string; content: string; suggestedActions?: any[] }>>([]);
const chatInput = ref('');
const chatLoading = ref(false);
const chatContainer = ref<HTMLElement | null>(null);
const conversationId = ref<string | null>(null);

onMounted(() => {
  loadData();
  loadProductTypes();
  loadReferenceData();
});

async function loadData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const response = await get(`/${factoryId.value}/production-plans`, {
      params: {
        page: pagination.value.page,
        size: pagination.value.size,
        keyword: searchForm.value.keyword || undefined,
        status: searchForm.value.status || undefined
      }
    });
    if (response.success && response.data) {
      tableData.value = response.data.content || [];
      pagination.value.total = response.data.totalElements || 0;
    }
  } catch (error) {
    console.error('加载失败:', error);
    ElMessage.error('加载数据失败');
  } finally {
    loading.value = false;
  }
}

async function loadProductTypes() {
  if (!factoryId.value) return;
  try {
    const response = await get(`/${factoryId.value}/product-types`);
    if (response.success && response.data) {
      productTypes.value = response.data.content || response.data || [];
    }
  } catch (error) {
    console.error('加载产品类型失败:', error);
  }
}

function handleSearch() {
  pagination.value.page = 1;
  loadData();
}

function handleRefresh() {
  searchForm.value = { keyword: '', status: '' };
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

function handleCreate() {
  planForm.value = {
    productTypeId: '',
    plannedQuantity: 0,
    plannedDate: '',
    notes: '',
    suggestedProductionLineId: '',
    estimatedWorkers: undefined,
    assignedSupervisorId: '',
  };
  dialogVisible.value = true;
}

async function submitPlan() {
  if (!planForm.value.productTypeId || !planForm.value.plannedQuantity || !planForm.value.plannedDate) {
    ElMessage.warning('请填写完整信息');
    return;
  }

  dialogLoading.value = true;
  try {
    const response = await post(`/${factoryId.value}/production-plans`, planForm.value);
    if (response.success) {
      ElMessage.success('创建成功');
      dialogVisible.value = false;
      loadData();
    } else {
      ElMessage.error(response.message || '创建失败');
    }
  } catch (error) {
    ElMessage.error('创建失败');
  } finally {
    dialogLoading.value = false;
  }
}

async function handleStart(row: any) {
  try {
    await ElMessageBox.confirm('确定开始此生产计划?', '提示', { type: 'warning' });
    const response = await post(`/${factoryId.value}/production-plans/${row.id}/start`);
    if (response.success) {
      ElMessage.success('已开始生产');
      loadData();
    } else {
      ElMessage.error(response.message || '操作失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败');
    }
  }
}

async function handleComplete(row: any) {
  try {
    const { value } = await ElMessageBox.prompt('请输入实际产量', '完成生产', {
      inputPattern: /^\d+$/,
      inputErrorMessage: '请输入有效数量'
    });
    const response = await post(`/${factoryId.value}/production-plans/${row.id}/complete`, {
      actualQuantity: parseInt(value)
    });
    if (response.success) {
      ElMessage.success('生产已完成');
      loadData();
    } else {
      ElMessage.error(response.message || '操作失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败');
    }
  }
}

async function handleCancel(row: any) {
  try {
    const { value } = await ElMessageBox.prompt('请输入取消原因', '取消计划', {
      inputPattern: /.+/,
      inputErrorMessage: '请输入取消原因'
    });
    const response = await post(`/${factoryId.value}/production-plans/${row.id}/cancel`, {
      reason: value
    });
    if (response.success) {
      ElMessage.success('计划已取消');
      loadData();
    } else {
      ElMessage.error(response.message || '操作失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败');
    }
  }
}

async function handleCreateBatch(row: any) {
  try {
    await ElMessageBox.confirm(
      `确定将计划 "${row.planNumber}" 转为生产批次？\n\n转换后将自动创建批次并开始生产流程。`,
      '转为批次',
      { type: 'warning', confirmButtonText: '确认转换', cancelButtonText: '取消' }
    );
    const response = await post(`/${factoryId.value}/production-plans/${row.id}/create-batch`);
    if (response.success) {
      const batch = response.data;
      ElMessage.success(`批次创建成功！批次号: ${batch?.batchNumber || ''}`);
      loadData();
    } else {
      ElMessage.error(response.message || '转换失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败');
    }
  }
}

function isPendingStatus(status: string) {
  return status === 'PLANNED' || status === 'PENDING';
}

function getStatusType(status: string) {
  const map: Record<string, string> = {
    PLANNED: 'info',
    PENDING: 'info',
    IN_PROGRESS: 'warning',
    COMPLETED: 'success',
    CANCELLED: 'danger'
  };
  return map[status] || 'info';
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    PLANNED: '待执行',
    PENDING: '待执行',
    IN_PROGRESS: '进行中',
    COMPLETED: '已完成',
    CANCELLED: '已取消'
  };
  return map[status] || status;
}

// ==================== Reference Data ====================

async function loadReferenceData() {
  if (!factoryId.value) return;
  try {
    const [linesRes, supsRes] = await Promise.all([
      getProductionLines(factoryId.value),
      getSupervisors(factoryId.value),
    ]);
    if (linesRes?.data) {
      productionLines.value = Array.isArray(linesRes.data) ? linesRes.data : (linesRes.data as any).content || [];
    }
    if (supsRes?.data) {
      supervisors.value = Array.isArray(supsRes.data) ? supsRes.data : (supsRes.data as any).content || [];
    }
  } catch (e) {
    console.warn('Failed to load reference data:', e);
  }
}

// ==================== Import / Export ====================

async function handleDownloadTemplate() {
  if (!factoryId.value) return;
  try {
    const response = await downloadImportTemplate(factoryId.value);
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'production-plan-template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('模板下载成功');
  } catch {
    ElMessage.error('模板下载失败');
  }
}

async function handleImportFile(uploadFile: any) {
  if (!uploadFile?.raw) return;

  const file = uploadFile.raw;
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.warning('文件大小不能超过10MB');
    return;
  }

  try {
    if (!factoryId.value) return;
    const formData = new FormData();
    formData.append('file', file);

    const res = await importProductionPlans(factoryId.value, formData);
    if (res?.data) {
      const r = res.data;
      const failureInfo = r.failureDetails?.length
        ? '\n\n失败详情:\n' + r.failureDetails.map((f) => `第${f.rowNumber}行: ${f.reason}`).join('\n')
        : '';
      ElMessageBox.alert(
        `总计: ${r.totalCount} 条\n成功: ${r.successCount} 条\n失败: ${r.failureCount} 条` + failureInfo,
        '导入结果',
        { confirmButtonText: '确定', callback: () => loadData() }
      );
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '请检查文件格式';
    ElMessage.error('导入失败: ' + msg);
  }
}

async function handleExport() {
  if (!factoryId.value) return;
  try {
    const params: Record<string, string> = {};
    if (searchForm.value.keyword) params.keyword = searchForm.value.keyword;
    if (searchForm.value.status) params.status = searchForm.value.status;

    const response = await exportProductionPlans(factoryId.value, params);
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `生产计划_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('导出成功');
  } catch {
    ElMessage.error('导出失败');
  }
}

// ==================== AI Chat ====================

function renderMarkdown(content: string): string {
  try {
    return DOMPurify.sanitize(marked.parse(content) as string);
  } catch {
    return content;
  }
}

function scrollChatToBottom() {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
}

async function sendChatMessage() {
  const msg = chatInput.value.trim();
  if (!msg || chatLoading.value || !factoryId.value) return;

  chatMessages.value.push({ role: 'user', content: msg });
  chatInput.value = '';
  chatLoading.value = true;

  await nextTick();
  scrollChatToBottom();

  try {
    let res: any;

    if (!conversationId.value) {
      // Start a new conversation
      res = await post(`/${factoryId.value}/conversation/start`, {
        message: msg,
        context: { entityType: 'PRODUCTION_PLAN' },
      });
    } else {
      // Continue conversation
      res = await post(`/${factoryId.value}/conversation/reply`, {
        conversationId: conversationId.value,
        message: msg,
      });
    }

    if (res?.data) {
      if (res.data.conversationId) conversationId.value = res.data.conversationId;
      chatMessages.value.push({
        role: 'assistant',
        content: res.data.message || res.data.reply || '处理中...',
        suggestedActions: res.data.suggestedActions || [],
      });
    }
  } catch {
    chatMessages.value.push({
      role: 'assistant',
      content: '抱歉，发生错误。请重试。',
    });
  } finally {
    chatLoading.value = false;
    await nextTick();
    scrollChatToBottom();
  }
}

async function handleChatAction(action: any) {
  if (action.actionCode === 'REDIRECT_TO_PLAN_FORM') {
    aiChatVisible.value = false;
    // Pre-fill form with collected params from the AI conversation
    const params = action.params || {};
    planForm.value = {
      productTypeId: params.productTypeId || '',
      plannedQuantity: params.plannedQuantity || 0,
      plannedDate: params.plannedDate || '',
      notes: params.notes || '',
      suggestedProductionLineId: params.suggestedProductionLineId || '',
      estimatedWorkers: params.estimatedWorkers || undefined,
      assignedSupervisorId: params.assignedSupervisorId || '',
    };
    dialogVisible.value = true;
    return;
  }

  if (action.actionCode === 'CONFIRM_CREATE' || action.label === '确认创建') {
    chatInput.value = '确认';
    await sendChatMessage();
    return;
  }

  // Default: send action label as message
  chatInput.value = action.label;
  await sendChatMessage();
}

function resetChat() {
  chatMessages.value = [];
  chatInput.value = '';
  conversationId.value = null;
  chatLoading.value = false;
}
</script>

<template>
  <div class="page-wrapper">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">生产计划管理</span>
            <span class="data-count">共 {{ pagination.total }} 条记录</span>
          </div>
          <div class="header-right">
            <el-button type="success" :icon="Download" @click="handleDownloadTemplate">
              下载模板
            </el-button>
            <el-upload
              :auto-upload="false"
              :show-file-list="false"
              accept=".xlsx,.xls"
              :on-change="handleImportFile"
              style="display: inline-block; margin-left: 8px;"
            >
              <el-button type="warning" :icon="Upload">
                导入Excel
              </el-button>
            </el-upload>
            <el-button type="info" :icon="Download" @click="handleExport" style="margin-left: 8px;">
              导出Excel
            </el-button>
            <el-button type="success" :icon="ChatDotRound" @click="aiChatVisible = true; resetChat();" style="margin-left: 8px;">
              AI对话创建
            </el-button>
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="handleCreate" style="margin-left: 8px;">
              新建计划
            </el-button>
          </div>
        </div>
      </template>

      <div class="search-bar">
        <el-input
          v-model="searchForm.keyword"
          placeholder="搜索计划编号/产品名称"
          :prefix-icon="Search"
          clearable
          style="width: 280px"
          @keyup.enter="handleSearch"
        />
        <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 150px">
          <el-option label="待执行" value="PLANNED" />
          <el-option label="进行中" value="IN_PROGRESS" />
          <el-option label="已完成" value="COMPLETED" />
          <el-option label="已取消" value="CANCELLED" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleRefresh">重置</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" stripe border style="width: 100%">
        <el-table-column prop="planNumber" label="计划编号" width="160" />
        <el-table-column prop="productTypeName" label="产品类型" min-width="150" show-overflow-tooltip />
        <el-table-column prop="plannedQuantity" label="计划数量" width="100" align="right" />
        <el-table-column prop="actualQuantity" label="实际数量" width="100" align="right" />
        <el-table-column prop="plannedDate" label="计划日期" width="120" />
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="suggestedProductionLineName" label="建议产线" width="120" show-overflow-tooltip />
        <el-table-column prop="estimatedWorkers" label="预计工人" width="90" align="center" />
        <el-table-column prop="assignedSupervisorName" label="指派主管" width="100" show-overflow-tooltip />
        <el-table-column prop="sourceType" label="来源" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.sourceType === 'EXCEL_IMPORT'" type="warning" size="small">Excel导入</el-tag>
            <el-tag v-else-if="row.sourceType === 'AI_CHAT'" type="success" size="small">AI创建</el-tag>
            <el-tag v-else size="small">手动</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180" />
        <el-table-column label="操作" width="280" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small">查看</el-button>
            <el-button
              v-if="canWrite && isPendingStatus(row.status)"
              type="warning"
              link
              size="small"
              @click="handleCreateBatch(row)"
            >转为批次</el-button>
            <el-button
              v-if="canWrite && isPendingStatus(row.status)"
              type="success"
              link
              size="small"
              :icon="VideoPlay"
              @click="handleStart(row)"
            >开始</el-button>
            <el-button
              v-if="canWrite && row.status === 'IN_PROGRESS'"
              type="primary"
              link
              size="small"
              :icon="CircleCheck"
              @click="handleComplete(row)"
            >完成</el-button>
            <el-button
              v-if="canWrite && (isPendingStatus(row.status) || row.status === 'IN_PROGRESS')"
              type="danger"
              link
              size="small"
              :icon="CircleClose"
              @click="handleCancel(row)"
            >取消</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <!-- 新建计划对话框 -->
    <el-dialog v-model="dialogVisible" title="新建生产计划" width="500px">
      <el-form :model="planForm" label-width="100px">
        <el-form-item label="产品类型" required>
          <el-select v-model="planForm.productTypeId" placeholder="选择产品类型" style="width: 100%">
            <el-option
              v-for="item in productTypes"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="计划数量" required>
          <el-input-number v-model="planForm.plannedQuantity" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="计划日期" required>
          <el-date-picker
            v-model="planForm.plannedDate"
            type="date"
            placeholder="选择日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="planForm.notes" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="建议产线">
          <el-select v-model="planForm.suggestedProductionLineId" clearable placeholder="可选 - 选择产线" style="width: 100%">
            <el-option v-for="line in productionLines" :key="line.id" :label="line.name" :value="line.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="预计工人数">
          <el-input-number v-model="planForm.estimatedWorkers" :min="1" :max="100" placeholder="可选" style="width: 100%" />
        </el-form-item>
        <el-form-item label="指派主管">
          <el-select v-model="planForm.assignedSupervisorId" clearable placeholder="可选 - 选择主管" style="width: 100%">
            <el-option v-for="sup in supervisors" :key="sup.id" :label="sup.fullName || sup.username" :value="sup.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dialogLoading" @click="submitPlan">确定</el-button>
      </template>
    </el-dialog>

    <!-- AI对话创建生产计划 -->
    <el-drawer v-model="aiChatVisible" title="AI 智能创建生产计划" size="50%" direction="rtl">
      <div class="ai-chat-container">
        <!-- Messages area -->
        <div class="chat-messages" ref="chatContainer">
          <div v-if="chatMessages.length === 0" class="chat-placeholder">
            <p>你好！我可以帮你创建生产计划。</p>
            <p>试试说："帮我创建一个明天生产500kg豆腐的计划"</p>
          </div>
          <div v-for="(msg, index) in chatMessages" :key="index" :class="['chat-message', msg.role]">
            <div class="chat-bubble" v-html="renderMarkdown(msg.content)" />
            <div v-if="msg.suggestedActions && msg.suggestedActions.length" class="chat-actions">
              <el-button
                v-for="action in msg.suggestedActions"
                :key="action.actionCode || action.label"
                size="small"
                @click="handleChatAction(action)"
              >{{ action.label }}</el-button>
            </div>
          </div>
          <div v-if="chatLoading" class="chat-message assistant">
            <div class="chat-bubble loading-bubble">思考中...</div>
          </div>
        </div>
        <!-- Input area -->
        <div class="chat-input-area">
          <el-input
            v-model="chatInput"
            type="textarea"
            :rows="2"
            placeholder="描述你的生产计划需求..."
            @keydown.enter.exact.prevent="sendChatMessage"
          />
          <el-button
            type="primary"
            @click="sendChatMessage"
            :disabled="!chatInput.trim() || chatLoading"
            style="margin-top: 8px; width: 100%;"
          >
            发送
          </el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<style lang="scss" scoped>
.page-wrapper {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.page-card {
  flex: 1;
  display: flex;
  flex-direction: column;

  :deep(.el-card__header) {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color-lighter, #ebeef5);
  }

  :deep(.el-card__body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 20px;
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;

  .header-right {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0;
  }

  .header-left {
    display: flex;
    align-items: baseline;
    gap: 12px;

    .page-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color-primary, #303133);
    }

    .data-count {
      font-size: 13px;
      color: var(--text-color-secondary, #909399);
    }
  }
}

.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.el-table {
  flex: 1;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid var(--border-color-lighter, #ebeef5);
  margin-top: 16px;
}

// AI Chat styles
.ai-chat-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 100px);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.chat-placeholder {
  text-align: center;
  color: var(--text-color-secondary, #909399);
  padding: 40px 20px;

  p {
    margin: 8px 0;
    font-size: 14px;
  }
}

.chat-message {
  margin-bottom: 16px;
}

.chat-message.user {
  text-align: right;
}

.chat-message.user .chat-bubble {
  background: #409eff;
  color: white;
  display: inline-block;
  text-align: left;
}

.chat-message.assistant .chat-bubble {
  background: #f4f4f5;
  color: var(--text-color-primary, #303133);
  display: inline-block;
}

.chat-bubble {
  padding: 10px 14px;
  border-radius: 8px;
  max-width: 80%;
  word-break: break-word;
  line-height: 1.6;
  font-size: 14px;

  :deep(p) {
    margin: 4px 0;
  }

  :deep(ul), :deep(ol) {
    padding-left: 20px;
    margin: 4px 0;
  }

  :deep(code) {
    background: rgba(0, 0, 0, 0.06);
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 13px;
  }
}

.loading-bubble {
  color: var(--text-color-secondary, #909399);
  font-style: italic;
}

.chat-actions {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chat-input-area {
  padding: 16px;
  border-top: 1px solid var(--border-color-lighter, #ebeef5);
}
</style>
