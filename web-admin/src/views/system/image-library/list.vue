<script setup lang="ts">
/**
 * 公共图片库 (P2 #80 C-IMAGE-LIB-1)
 *
 * 在通用 Attachment 系统 (#658) 之上的策划层 — 把已上传图片按 title/tags/category 管理,
 * 支持跨工厂共享 (isPublic) + 使用计数. 替代以前散落在 SKU / 营销 / LOGO 多处的图片复用.
 *
 * 防呆 (per .claude/rules/fool-proof-design.md):
 *  - R3: category dropdown + tags chip (预设 + 自由输入), 无自由文本"原因"字段
 *  - R5: 空 gallery 显示明确 CTA "上传第一张图片", 不让用户卡死
 */
import { ref, computed, onMounted, reactive } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post, put, del } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Plus, Edit, Delete as DeleteIcon, Refresh, Picture, Search, Upload,
} from '@element-plus/icons-vue';

interface ImageLibraryView {
  id: string;
  attachmentId: string;
  factoryId: string | null;
  title: string;
  description: string | null;
  tags: string[];
  category: string;
  uploaderUserId: number;
  isPublic: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  fileUrl: string | null;
  thumbnailUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
}

interface PageData<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('system'));

const loading = ref(false);
const images = ref<ImageLibraryView[]>([]);
const totalElements = ref(0);

// 过滤条件
const filters = reactive({
  category: '' as string,
  keyword: '' as string,
  tag: '' as string,
  crossFactoryOnly: false,
});

const pagination = reactive({
  page: 1,   // el-pagination 1-based
  size: 24,  // 4 列 × 6 行
});

// 预设分类 + 标签
const categoryOptions = [
  { value: 'PRODUCT', label: '商品图', color: '' },
  { value: 'MARKETING', label: '营销物料', color: 'success' },
  { value: 'LOGO', label: '品牌标识', color: 'warning' },
  { value: 'EVENT', label: '活动事件', color: 'info' },
  { value: 'OTHER', label: '其他', color: 'info' },
];

const categoryLabel = (cat: string): string => {
  const found = categoryOptions.find(c => c.value === cat);
  return found ? found.label : cat;
};

const categoryTagType = (cat: string): '' | 'success' | 'warning' | 'info' | 'danger' => {
  const found = categoryOptions.find(c => c.value === cat);
  return (found?.color ?? '') as '' | 'success' | 'warning' | 'info' | 'danger';
};

const presetTags = [
  '促销', '春季', '夏季', '秋季', '冬季', '新品', '热销',
  '高端', '日常', '节日', '中秋', '春节', '国庆', '招牌',
];

onMounted(loadData);

async function loadData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const params: Record<string, string | number | boolean> = {
      page: pagination.page - 1,
      size: pagination.size,
      crossFactoryOnly: filters.crossFactoryOnly,
    };
    if (filters.category) params.category = filters.category;
    if (filters.keyword) params.keyword = filters.keyword;
    if (filters.tag) params.tag = filters.tag;

    const res = await get<PageData<ImageLibraryView>>(`/${factoryId.value}/image-library`, { params });
    if (res.success && res.data) {
      images.value = res.data.content ?? [];
      totalElements.value = res.data.totalElements ?? 0;
    } else {
      images.value = [];
      totalElements.value = 0;
    }
  } catch (e) {
    console.error('loadData failed', e);
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pagination.page = 1;
  loadData();
}

function handleReset() {
  filters.category = '';
  filters.keyword = '';
  filters.tag = '';
  filters.crossFactoryOnly = false;
  pagination.page = 1;
  loadData();
}

function handlePageChange(p: number) {
  pagination.page = p;
  loadData();
}

function handleSizeChange(s: number) {
  pagination.size = s;
  pagination.page = 1;
  loadData();
}

// ==================== 收录 / 编辑对话框 ====================

const dialogVisible = ref(false);
const editingId = ref<string | null>(null);
const submitting = ref(false);

const form = reactive({
  attachmentId: '',
  title: '',
  description: '',
  tags: [] as string[],
  category: 'OTHER',
  isPublic: false,
});

const dialogTitle = computed(() => (editingId.value ? '编辑图片库条目' : '收录图片'));

function openCreate() {
  editingId.value = null;
  form.attachmentId = '';
  form.title = '';
  form.description = '';
  form.tags = [];
  form.category = 'OTHER';
  form.isPublic = false;
  newTagInput.value = '';
  dialogVisible.value = true;
}

function openEdit(row: ImageLibraryView) {
  editingId.value = row.id;
  form.attachmentId = row.attachmentId;
  form.title = row.title ?? '';
  form.description = row.description ?? '';
  form.tags = [...(row.tags ?? [])];
  form.category = row.category ?? 'OTHER';
  form.isPublic = !!row.isPublic;
  newTagInput.value = '';
  dialogVisible.value = true;
}

// 标签新增 input (chip 模式)
const newTagInput = ref('');

function addTag(tag: string) {
  const t = tag.trim();
  if (!t) return;
  if (form.tags.includes(t)) {
    ElMessage.info(`标签「${t}」已存在`);
    newTagInput.value = '';
    return;
  }
  form.tags.push(t);
  newTagInput.value = '';
}

function addNewTag() {
  if (newTagInput.value) addTag(newTagInput.value);
}

function removeTag(t: string) {
  form.tags = form.tags.filter(x => x !== t);
}

async function handleSave() {
  if (!editingId.value && !form.attachmentId) {
    return ElMessage.warning('请先填写已上传的 Attachment ID (上传流程详见管理员手册)');
  }
  if (!form.title.trim()) {
    return ElMessage.warning('请填写标题');
  }
  if (!form.category) {
    return ElMessage.warning('请选择分类');
  }
  submitting.value = true;
  try {
    if (editingId.value) {
      const res = await put(`/${factoryId.value}/image-library/${editingId.value}`, {
        title: form.title,
        description: form.description,
        tags: form.tags,
        category: form.category,
        isPublic: form.isPublic,
      });
      if (res.success) ElMessage.success('更新成功');
    } else {
      const res = await post(`/${factoryId.value}/image-library`, {
        attachmentId: form.attachmentId,
        title: form.title,
        description: form.description,
        tags: form.tags,
        category: form.category,
        isPublic: form.isPublic,
      });
      if (res.success) ElMessage.success('已收录至图片库');
    }
    dialogVisible.value = false;
    loadData();
  } catch (e) {
    console.error(e);
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(row: ImageLibraryView) {
  try {
    await ElMessageBox.confirm(
      `确定从图片库移除「${row.title}」?`,
      '删除确认',
      { type: 'warning', confirmButtonText: '确定移除', cancelButtonText: '取消' },
    );
    const res = await del(`/${factoryId.value}/image-library/${row.id}`);
    if (res.success) {
      ElMessage.success('已移除');
      loadData();
    }
  } catch {
    /* cancel */
  }
}

async function handleRecordUsage(row: ImageLibraryView) {
  try {
    const res = await post(`/${factoryId.value}/image-library/${row.id}/use`, {});
    if (res.success) {
      row.usageCount = (row.usageCount ?? 0) + 1;
      ElMessage.success('已记录使用 (+1)');
    }
  } catch (e) {
    console.error(e);
  }
}

function copyImageUrl(url: string | null) {
  if (!url) return ElMessage.warning('该图片暂无可用 URL');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url)
      .then(() => ElMessage.success('URL 已复制到剪贴板'))
      .catch(() => ElMessage.warning('复制失败,请手动选中 URL'));
  } else {
    ElMessage.warning('当前浏览器不支持自动复制,请手动选中 URL');
  }
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function showUploadHelp() {
  ElMessageBox.alert(
    '收录流程: \n\n1) 先在业务模块 (SKU / 营销 / 工序) 完成 Attachment 上传, 取得 attachmentId\n2) 复制 attachmentId\n3) 此页面点"收录图片", 粘贴 attachmentId + 填写 title / category / tags / isPublic\n\n后续 Sprint 将集成"直接上传"入口, 当前 MVP 仅支持引用现有 attachment.',
    '使用说明',
    { confirmButtonText: '我知道了' },
  );
}
</script>

<template>
  <div class="page-wrapper">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">公共图片库</span>
            <span class="data-count">
              共 {{ totalElements }} 张 — 按分类/标签管理可复用图片, 支持跨工厂共享
            </span>
          </div>
          <div class="header-right">
            <el-button :icon="Refresh" @click="loadData">刷新</el-button>
            <el-button :icon="Search" @click="showUploadHelp">使用说明</el-button>
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="openCreate">
              收录图片
            </el-button>
          </div>
        </div>
      </template>

      <!-- 过滤条 -->
      <div class="filter-bar">
        <el-select
          v-model="filters.category"
          placeholder="全部分类"
          clearable
          style="width: 140px"
          @change="handleSearch"
        >
          <el-option
            v-for="c in categoryOptions"
            :key="c.value"
            :label="c.label"
            :value="c.value"
          />
        </el-select>
        <el-select
          v-model="filters.tag"
          placeholder="按标签过滤"
          clearable
          filterable
          allow-create
          style="width: 160px"
          @change="handleSearch"
        >
          <el-option v-for="t in presetTags" :key="t" :label="t" :value="t" />
        </el-select>
        <el-input
          v-model="filters.keyword"
          placeholder="标题/描述 关键词"
          clearable
          style="width: 240px"
          :prefix-icon="Search"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
        <el-checkbox v-model="filters.crossFactoryOnly" @change="handleSearch">
          仅显示跨工厂共享
        </el-checkbox>
        <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>

      <!-- gallery -->
      <div v-loading="loading" class="gallery-wrapper">
        <!-- 防呆 R5: empty state with explicit CTA -->
        <el-empty
          v-if="!loading && images.length === 0"
          description="还没有任何图片入库"
        >
          <el-button v-if="canWrite" type="primary" :icon="Upload" @click="openCreate">
            上传第一张图片
          </el-button>
          <el-button v-else @click="showUploadHelp">查看使用说明</el-button>
        </el-empty>

        <div v-else class="gallery-grid">
          <el-card
            v-for="img in images"
            :key="img.id"
            class="image-card"
            shadow="hover"
            :body-style="{ padding: 0 }"
          >
            <div class="image-thumb-wrapper">
              <el-image
                v-if="img.fileUrl"
                :src="img.thumbnailUrl || img.fileUrl"
                :preview-src-list="[img.fileUrl]"
                fit="cover"
                lazy
                class="image-thumb"
                preview-teleported
              >
                <template #error>
                  <div class="image-error">
                    <el-icon :size="40"><Picture /></el-icon>
                    <div>图片加载失败</div>
                  </div>
                </template>
                <template #placeholder>
                  <div class="image-loading">
                    <el-icon :size="32"><Picture /></el-icon>
                  </div>
                </template>
              </el-image>
              <div v-else class="image-error">
                <el-icon :size="40"><Picture /></el-icon>
                <div>无可用 URL</div>
              </div>

              <!-- 角标 -->
              <div class="image-badges">
                <el-tag size="small" :type="categoryTagType(img.category)">
                  {{ categoryLabel(img.category) }}
                </el-tag>
                <el-tag v-if="img.isPublic" size="small" type="success" effect="dark">
                  共享
                </el-tag>
              </div>
            </div>

            <div class="image-meta">
              <div class="image-title" :title="img.title">{{ img.title }}</div>
              <div class="image-tags">
                <el-tag
                  v-for="t in img.tags"
                  :key="t"
                  size="small"
                  effect="plain"
                  class="image-tag"
                >
                  {{ t }}
                </el-tag>
                <span v-if="!img.tags || img.tags.length === 0" class="image-no-tag">
                  无标签
                </span>
              </div>
              <div class="image-info">
                <span>{{ formatSize(img.fileSize) }}</span>
                <span class="image-usage">使用 {{ img.usageCount }} 次</span>
              </div>
              <div class="image-actions">
                <el-button
                  link
                  type="primary"
                  size="small"
                  @click="handleRecordUsage(img)"
                >
                  使用 +1
                </el-button>
                <el-button
                  link
                  type="primary"
                  size="small"
                  @click="copyImageUrl(img.fileUrl)"
                >
                  复制 URL
                </el-button>
                <el-button
                  v-if="canWrite"
                  link
                  type="primary"
                  size="small"
                  :icon="Edit"
                  @click="openEdit(img)"
                >
                  编辑
                </el-button>
                <el-button
                  v-if="canWrite"
                  link
                  type="danger"
                  size="small"
                  :icon="DeleteIcon"
                  @click="handleDelete(img)"
                >
                  删除
                </el-button>
              </div>
            </div>
          </el-card>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="totalElements > 0" class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :page-sizes="[12, 24, 48, 96]"
          :total="totalElements"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <!-- 创建 / 编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" destroy-on-close>
      <el-form :model="form" label-width="100px">
        <el-form-item v-if="!editingId" label="Attachment ID" required>
          <el-input
            v-model="form.attachmentId"
            placeholder="先通过业务模块上传图片得到 attachmentId"
            clearable
          />
          <div class="form-hint">
            上传流程见右上角"使用说明". 后续 Sprint 将增加"直接上传"入口.
          </div>
        </el-form-item>
        <el-form-item label="标题" required>
          <el-input
            v-model="form.title"
            placeholder="如 春季促销主 Banner"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="分类" required>
          <el-select v-model="form.category" style="width: 100%">
            <el-option
              v-for="c in categoryOptions"
              :key="c.value"
              :label="c.label"
              :value="c.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <div class="tag-input-wrapper">
            <el-tag
              v-for="t in form.tags"
              :key="t"
              closable
              class="form-tag"
              @close="removeTag(t)"
            >
              {{ t }}
            </el-tag>
            <el-input
              v-model="newTagInput"
              size="small"
              placeholder="输入后回车添加"
              class="tag-input"
              @keyup.enter="addNewTag"
              @blur="addNewTag"
            />
          </div>
          <div class="form-hint">
            常用预设:
            <el-tag
              v-for="t in presetTags.slice(0, 8)"
              :key="t"
              size="small"
              effect="plain"
              class="preset-tag"
              @click="addTag(t)"
            >
              + {{ t }}
            </el-tag>
          </div>
        </el-form-item>
        <el-form-item label="跨工厂共享">
          <el-switch v-model="form.isPublic" />
          <span class="form-hint inline-hint">
            开启后其他工厂可在自己的图片库中查看并使用
          </span>
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="可选 — 详细说明用途/版权/适用场景"
            maxlength="5000"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSave">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-wrapper { padding: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.header-left { display: flex; align-items: baseline; gap: 12px; }
.page-title { font-size: 18px; font-weight: 600; }
.data-count { font-size: 13px; color: #909399; }
.header-right { display: flex; gap: 8px; }

.filter-bar {
  display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
  margin-bottom: 16px;
  padding: 12px;
  background: #fafafa;
  border-radius: 4px;
}

.gallery-wrapper { min-height: 240px; }
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.image-card { overflow: hidden; }
.image-thumb-wrapper {
  position: relative;
  width: 100%;
  height: 180px;
  background: #f5f7fa;
}
.image-thumb { width: 100%; height: 100%; }
.image-error, .image-loading {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: #909399;
  background: #f5f7fa;
  gap: 6px;
  font-size: 12px;
}
.image-badges {
  position: absolute;
  top: 6px; left: 6px;
  display: flex; gap: 4px;
}

.image-meta {
  padding: 10px 12px;
}
.image-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.image-tags {
  display: flex; flex-wrap: wrap; gap: 4px;
  min-height: 22px;
  margin-bottom: 6px;
}
.image-tag { margin: 0; }
.image-no-tag { font-size: 12px; color: #c0c4cc; }

.image-info {
  display: flex; justify-content: space-between;
  font-size: 12px; color: #909399;
  margin-bottom: 6px;
}
.image-usage { font-weight: 500; color: #67c23a; }

.image-actions {
  display: flex; flex-wrap: wrap; gap: 4px;
  border-top: 1px solid #ebeef5;
  padding-top: 6px;
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex; justify-content: center;
}

.tag-input-wrapper {
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  min-height: 32px;
}
.form-tag { margin: 0; }
.tag-input { width: 140px; }

.form-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  line-height: 1.6;
}
.inline-hint { margin-left: 12px; margin-top: 0; }

.preset-tag {
  cursor: pointer;
  margin-right: 4px;
  margin-top: 4px;
}
</style>
