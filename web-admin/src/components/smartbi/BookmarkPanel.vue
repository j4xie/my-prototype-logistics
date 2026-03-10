<script setup lang="ts">
/**
 * BookmarkPanel - SmartBI 书签管理面板
 * 支持保存/恢复视图快照、分享链接、拖拽排序、内联重命名
 */
import { ref, computed, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { CollectionTag as BookmarkIcon, Close, Plus, Timer, Rank, Edit, Share, Delete } from '@element-plus/icons-vue';
import type { Bookmark, BookmarkState } from '@/views/smart-bi/composables/useBookmarks';
import { useBookmarks } from '@/views/smart-bi/composables/useBookmarks';

// ==================== Props & Emits ====================

interface Props {
  dashboardId: string;
  currentState?: BookmarkState;
  visible?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  currentState: undefined,
  visible: false,
});

const emit = defineEmits<{
  apply: [state: BookmarkState];
  close: [];
  'update:visible': [value: boolean];
}>();

// ==================== Composable ====================

const {
  bookmarks,
  activeBookmarkId,
  loadBookmarks,
  saveBookmark,
  applyBookmark,
  updateBookmark,
  deleteBookmark,
  autoSaveLastState,
  restoreLastState,
  generateShareUrl,
  reorderBookmarks,
} = useBookmarks(props.dashboardId);

// ==================== State ====================

const saveDialogVisible = ref(false);
const newBookmarkName = ref('');
const newBookmarkDesc = ref('');
const savingBookmark = ref(false);

const editingId = ref<string | null>(null);
const editingName = ref('');
const editingDesc = ref('');

const hoveredId = ref<string | null>(null);
const draggingId = ref<string | null>(null);
const dragOverId = ref<string | null>(null);

const showLastStateHint = ref(false);
const lastState = ref<BookmarkState | null>(null);

// ==================== Computed ====================

const sortedBookmarks = computed(() => [...bookmarks.value]);

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin} 分钟前`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} 小时前`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD} 天前`;
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function statePreviewText(state: BookmarkState): string {
  const parts: string[] = [];
  if (state.year) parts.push(`${state.year}年`);
  if (state.startMonth && state.endMonth) {
    parts.push(`${state.startMonth}-${state.endMonth}月`);
  }
  if (state.periodType) parts.push(state.periodType);
  if (state.viewMode) parts.push(state.viewMode);
  return parts.join(' · ') || '已保存视图';
}

// ==================== Actions ====================

function openSaveDialog() {
  newBookmarkName.value = `视图 ${new Date().toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  newBookmarkDesc.value = '';
  saveDialogVisible.value = true;
}

async function confirmSave() {
  if (!newBookmarkName.value.trim()) {
    ElMessage.warning('请输入书签名称');
    return;
  }
  if (!props.currentState) {
    ElMessage.warning('当前无可保存的视图状态');
    return;
  }
  savingBookmark.value = true;
  try {
    saveBookmark(newBookmarkName.value.trim(), props.currentState, newBookmarkDesc.value.trim() || undefined);
    ElMessage.success('书签已保存');
    saveDialogVisible.value = false;
  } finally {
    savingBookmark.value = false;
  }
}

function handleApply(bm: Bookmark) {
  const state = applyBookmark(bm.id);
  if (state) {
    emit('apply', state);
    ElMessage.success(`已恢复: ${bm.name}`);
  }
}

async function handleDelete(bm: Bookmark) {
  await ElMessageBox.confirm(`确认删除书签「${bm.name}」？`, '提示', { type: 'warning' }).catch(() => { throw new Error('cancel'); });
  deleteBookmark(bm.id);
  ElMessage.success('已删除');
}

function startEdit(bm: Bookmark) {
  editingId.value = bm.id;
  editingName.value = bm.name;
  editingDesc.value = bm.description ?? '';
}

function confirmEdit(id: string) {
  if (!editingName.value.trim()) {
    ElMessage.warning('名称不能为空');
    return;
  }
  updateBookmark(id, { name: editingName.value.trim(), description: editingDesc.value.trim() || undefined });
  editingId.value = null;
  ElMessage.success('已更新');
}

function cancelEdit() {
  editingId.value = null;
}

function copyShareLink(bm: Bookmark) {
  const url = generateShareUrl(bm.id);
  navigator.clipboard.writeText(url).then(() => {
    ElMessage.success('分享链接已复制');
  }).catch(() => {
    ElMessage.info(`链接: ${url}`);
  });
}

function handleRestoreLastState() {
  if (lastState.value) {
    emit('apply', lastState.value);
    showLastStateHint.value = false;
    ElMessage.success('已恢复上次查看状态');
  }
}

// ==================== Drag to Reorder ====================

function onDragStart(id: string) {
  draggingId.value = id;
}

function onDragOver(id: string) {
  if (draggingId.value !== id) dragOverId.value = id;
}

function onDrop(id: string) {
  if (!draggingId.value || draggingId.value === id) return;
  const ids = sortedBookmarks.value.map(b => b.id);
  const fromIdx = ids.indexOf(draggingId.value);
  const toIdx = ids.indexOf(id);
  if (fromIdx < 0 || toIdx < 0) return;
  ids.splice(fromIdx, 1);
  ids.splice(toIdx, 0, draggingId.value);
  reorderBookmarks(ids);
  draggingId.value = null;
  dragOverId.value = null;
}

function onDragEnd() {
  draggingId.value = null;
  dragOverId.value = null;
}

// ==================== Init ====================

loadBookmarks();
lastState.value = restoreLastState();
if (lastState.value) showLastStateHint.value = true;

watch(() => props.currentState, (val) => {
  if (val) autoSaveLastState(val);
}, { deep: true });

watch(() => props.dashboardId, () => {
  loadBookmarks();
  lastState.value = restoreLastState();
});
</script>

<template>
  <div class="bmp" :class="{ 'bmp--hidden': !visible }">
    <!-- Panel Header -->
    <div class="bmp__header">
      <div class="bmp__header-left">
        <el-icon class="bmp__header-icon"><BookmarkIcon /></el-icon>
        <span class="bmp__header-title">书签视图</span>
        <el-tag size="small" type="info" effect="plain">{{ bookmarks.length }}</el-tag>
      </div>
      <el-button text size="small" @click="emit('close')">
        <el-icon><Close /></el-icon>
      </el-button>
    </div>

    <!-- Save Current View -->
    <div class="bmp__save-bar">
      <el-button type="primary" size="small" @click="openSaveDialog" :disabled="!currentState">
        <el-icon><Plus /></el-icon>
        保存当前视图
      </el-button>
    </div>

    <!-- Last State Hint -->
    <div v-if="showLastStateHint && lastState" class="bmp__last-state">
      <el-icon><Timer /></el-icon>
      <span>检测到上次查看记录</span>
      <el-button text size="small" @click="handleRestoreLastState">恢复</el-button>
      <el-button text size="small" @click="showLastStateHint = false">
        <el-icon><Close /></el-icon>
      </el-button>
    </div>

    <!-- Empty State -->
    <div v-if="sortedBookmarks.length === 0" class="bmp__empty">
      <el-icon :size="36" class="bmp__empty-icon"><BookmarkIcon /></el-icon>
      <p class="bmp__empty-title">暂无书签</p>
      <p class="bmp__empty-hint">保存常用视图，方便快速切换</p>
    </div>

    <!-- Bookmark List -->
    <div v-else class="bmp__list">
      <div
        v-for="bm in sortedBookmarks"
        :key="bm.id"
        class="bmp__item"
        :class="{
          'bmp__item--active': activeBookmarkId === bm.id,
          'bmp__item--dragging': draggingId === bm.id,
          'bmp__item--dragover': dragOverId === bm.id,
        }"
        draggable="true"
        @mouseenter="hoveredId = bm.id"
        @mouseleave="hoveredId = null"
        @dragstart="onDragStart(bm.id)"
        @dragover.prevent="onDragOver(bm.id)"
        @drop="onDrop(bm.id)"
        @dragend="onDragEnd"
      >
        <!-- Active indicator -->
        <div v-if="activeBookmarkId === bm.id" class="bmp__active-dot" />

        <!-- Drag handle -->
        <el-icon class="bmp__drag-handle"><Rank /></el-icon>

        <!-- Content area -->
        <div class="bmp__item-body" @click="handleApply(bm)">
          <!-- Inline edit mode -->
          <template v-if="editingId === bm.id">
            <el-input
              v-model="editingName"
              size="small"
              placeholder="书签名称"
              @click.stop
              @keydown.enter="confirmEdit(bm.id)"
              @keydown.escape="cancelEdit"
              autofocus
            />
            <el-input
              v-model="editingDesc"
              size="small"
              placeholder="描述（可选）"
              @click.stop
              @keydown.enter="confirmEdit(bm.id)"
              @keydown.escape="cancelEdit"
              class="bmp__desc-input"
            />
            <div class="bmp__edit-actions" @click.stop>
              <el-button size="small" type="primary" @click="confirmEdit(bm.id)">保存</el-button>
              <el-button size="small" @click="cancelEdit">取消</el-button>
            </div>
          </template>

          <!-- Display mode -->
          <template v-else>
            <div class="bmp__item-name">{{ bm.name }}</div>
            <div v-if="bm.description" class="bmp__item-desc">{{ bm.description }}</div>
            <div class="bmp__item-meta">
              <span class="bmp__item-state-preview">{{ statePreviewText(bm.state) }}</span>
              <span class="bmp__item-date">{{ formatDate(bm.updatedAt) }}</span>
            </div>
          </template>
        </div>

        <!-- Hover actions -->
        <div
          v-if="hoveredId === bm.id && editingId !== bm.id"
          class="bmp__item-actions"
          @click.stop
        >
          <el-tooltip content="重命名" placement="top" :hide-after="0">
            <el-button text size="small" @click="startEdit(bm)">
              <el-icon><Edit /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip content="复制分享链接" placement="top" :hide-after="0">
            <el-button text size="small" @click="copyShareLink(bm)">
              <el-icon><Share /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip content="删除" placement="top" :hide-after="0">
            <el-button text size="small" type="danger" @click="handleDelete(bm)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </div>
    </div>

    <!-- Save Dialog -->
    <el-dialog
      v-model="saveDialogVisible"
      title="保存当前视图"
      width="400px"
      :close-on-click-modal="false"
    >
      <div class="bmp__save-form">
        <div class="bmp__save-form-group">
          <label class="bmp__save-label">书签名称 <span class="bmp__required">*</span></label>
          <el-input
            v-model="newBookmarkName"
            placeholder="为当前视图命名"
            autofocus
            @keydown.enter="confirmSave"
          />
        </div>
        <div class="bmp__save-form-group">
          <label class="bmp__save-label">描述（可选）</label>
          <el-input
            v-model="newBookmarkDesc"
            type="textarea"
            :rows="2"
            placeholder="记录当前视图的用途或特点"
          />
        </div>
        <div v-if="currentState" class="bmp__save-preview">
          <div class="bmp__save-preview-label">将保存以下状态</div>
          <div class="bmp__save-preview-content">{{ statePreviewText(currentState) }}</div>
        </div>
      </div>
      <template #footer>
        <el-button @click="saveDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingBookmark" @click="confirmSave">保存书签</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.bmp {
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e8eaed;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  width: 300px;
  max-height: 600px;
  overflow: hidden;
  font-family: inherit;
}

.bmp--hidden {
  display: none;
}

/* Header */
.bmp__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.bmp__header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bmp__header-icon {
  color: #1B65A8;
}

.bmp__header-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

/* Save bar */
.bmp__save-bar {
  padding: 10px 16px;
  border-bottom: 1px solid #f5f5f5;
}

/* Last state hint */
.bmp__last-state {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #fffbe6;
  border-bottom: 1px solid #fff3c7;
  font-size: 12px;
  color: #7a5500;
}

.bmp__last-state .el-icon {
  color: #e6a23c;
}

.bmp__last-state span {
  flex: 1;
}

/* Empty */
.bmp__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 32px 16px;
  color: #c0c4cc;
}

.bmp__empty-icon {
  color: #dcdfe6;
}

.bmp__empty-title {
  font-size: 14px;
  color: #909399;
  margin: 0;
}

.bmp__empty-hint {
  font-size: 12px;
  color: #c0c4cc;
  margin: 0;
  text-align: center;
}

/* List */
.bmp__list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.bmp__list::-webkit-scrollbar {
  width: 4px;
}

.bmp__list::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 2px;
}

/* Item */
.bmp__item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  margin-bottom: 4px;
  transition: background 0.15s, border-color 0.15s;
  cursor: pointer;
}

.bmp__item:hover {
  background: #f5f7fa;
  border-color: #e8eaed;
}

.bmp__item--active {
  background: #ecf5ff;
  border-color: #c6d9f0;
}

.bmp__item--dragging {
  opacity: 0.4;
}

.bmp__item--dragover {
  background: #e8f0fa;
  border-color: #1B65A8;
  border-style: dashed;
}

.bmp__active-dot {
  position: absolute;
  left: 3px;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #1B65A8;
}

.bmp__drag-handle {
  color: #c0c4cc;
  flex-shrink: 0;
  margin-top: 2px;
  cursor: grab;
}

.bmp__item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.bmp__item-name {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bmp__item-desc {
  font-size: 12px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bmp__item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.bmp__item-state-preview {
  font-size: 11px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.bmp__item-date {
  font-size: 11px;
  color: #c0c4cc;
  flex-shrink: 0;
}

.bmp__desc-input {
  margin-top: 4px;
}

.bmp__edit-actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.bmp__item-actions {
  display: flex;
  flex-direction: column;
  gap: 0;
  flex-shrink: 0;
}

/* Save form */
.bmp__save-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.bmp__save-form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.bmp__save-label {
  font-size: 13px;
  color: #606266;
  font-weight: 500;
}

.bmp__required {
  color: #f56c6c;
}

.bmp__save-preview {
  padding: 10px 12px;
  background: #f5f7fa;
  border-radius: 6px;
}

.bmp__save-preview-label {
  font-size: 11px;
  color: #909399;
  margin-bottom: 4px;
}

.bmp__save-preview-content {
  font-size: 13px;
  color: #606266;
}
</style>
