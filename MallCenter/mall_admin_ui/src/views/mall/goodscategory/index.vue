<script setup lang="ts">
import { ref, reactive, onMounted, computed } from "vue";
import { ElMessageBox } from "element-plus";
import { Plus, Edit, Delete, Refresh, Picture, Document } from "@element-plus/icons-vue";
import { message } from "@/utils/message";
import {
  getCategoryTree,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  type GoodsCategory,
  type GoodsCategoryForm
} from "@/api/mall/goodsCategory";

defineOptions({
  name: "GoodsCategory"
});

// 分类树数据
const categoryTree = ref<GoodsCategory[]>([]);

// 加载状态
const loading = ref(false);

// 对话框控制
const dialogVisible = ref(false);
const dialogTitle = ref("新增分类");
const dialogLoading = ref(false);

// 表单数据
const formData = reactive<GoodsCategoryForm>({
  id: undefined,
  parentId: "0",
  name: "",
  iconText: "",
  picUrl: "",
  sort: 0,
  enable: "1",
  description: ""
});

// 表单引用
const formRef = ref();

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: "请输入分类名称", trigger: "blur" },
    { min: 1, max: 50, message: "分类名称长度为1-50个字符", trigger: "blur" }
  ],
  sort: [{ required: true, message: "请输入排序值", trigger: "blur" }],
  enable: [{ required: true, message: "请选择启用状态", trigger: "change" }]
};

// 计算属性：一级分类数量
const topLevelCategoryCount = computed(() => {
  return categoryTree.value.length;
});

// 计算属性：是否显示一级分类数量警告
const showTopLevelWarning = computed(() => {
  return formData.parentId === "0" && topLevelCategoryCount.value >= 7;
});

// 计算属性：获取扁平化的分类列表，用于选择父级分类
const flatCategoryList = computed(() => {
  const result: Array<{ id: string; name: string; level: number }> = [];

  const flatten = (list: GoodsCategory[], level = 0) => {
    for (const item of list) {
      result.push({
        id: item.id,
        name: "　".repeat(level) + item.name,
        level
      });
      if (item.children && item.children.length > 0) {
        flatten(item.children, level + 1);
      }
    }
  };

  flatten(categoryTree.value);
  return result;
});

// 获取分类树数据
const fetchCategoryTree = async () => {
  loading.value = true;
  try {
    const res = await getCategoryTree();
    if (res.code === 200) {
      categoryTree.value = res.data || [];
    } else {
      message(res.msg || "获取分类列表失败", { type: "error" });
    }
  } catch (error) {
    console.error("获取分类列表失败:", error);
    message("获取分类列表失败，请稍后重试", { type: "error" });
  } finally {
    loading.value = false;
  }
};

// 重置表单
const resetForm = () => {
  formData.id = undefined;
  formData.parentId = "0";
  formData.name = "";
  formData.iconText = "";
  formData.picUrl = "";
  formData.sort = 0;
  formData.enable = "1";
  formData.description = "";
  formRef.value?.clearValidate();
};

// 打开新增对话框
const handleAdd = (parentId = "0") => {
  resetForm();
  formData.parentId = parentId;
  dialogTitle.value = "新增分类";
  dialogVisible.value = true;
};

// 打开编辑对话框
const handleEdit = async (row: GoodsCategory) => {
  resetForm();
  dialogTitle.value = "编辑分类";
  dialogLoading.value = true;
  dialogVisible.value = true;

  try {
    const res = await getCategoryById(row.id);
    if (res.code === 200 && res.data) {
      const data = res.data;
      formData.id = data.id;
      formData.parentId = data.parentId || "0";
      formData.name = data.name;
      formData.iconText = data.iconText || "";
      formData.picUrl = data.picUrl || "";
      formData.sort = data.sort;
      formData.enable = data.enable;
      formData.description = data.description || "";
    } else {
      message(res.msg || "获取分类详情失败", { type: "error" });
      dialogVisible.value = false;
    }
  } catch (error) {
    console.error("获取分类详情失败:", error);
    message("获取分类详情失败，请稍后重试", { type: "error" });
    dialogVisible.value = false;
  } finally {
    dialogLoading.value = false;
  }
};

// 添加子分类
const handleAddChild = (row: GoodsCategory) => {
  handleAdd(row.id);
};

// 删除分类
const handleDelete = async (row: GoodsCategory) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除分类"${row.name}"吗？删除后不可恢复。`,
      "删除确认",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );

    loading.value = true;
    const res = await deleteCategory(row.id);
    if (res.code === 200) {
      message("删除成功", { type: "success" });
      await fetchCategoryTree();
    } else {
      message(res.msg || "删除失败", { type: "error" });
    }
  } catch (error) {
    if (error !== "cancel") {
      console.error("删除分类失败:", error);
      message("删除失败，请稍后重试", { type: "error" });
    }
  } finally {
    loading.value = false;
  }
};

// 提交表单
const handleSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  dialogLoading.value = true;
  try {
    const isEdit = !!formData.id;
    const res = isEdit
      ? await updateCategory(formData)
      : await createCategory(formData);

    if (res.code === 200) {
      message(isEdit ? "修改成功" : "新增成功", { type: "success" });
      dialogVisible.value = false;
      await fetchCategoryTree();
    } else {
      message(res.msg || (isEdit ? "修改失败" : "新增失败"), {
        type: "error"
      });
    }
  } catch (error) {
    console.error("保存分类失败:", error);
    message("保存失败，请稍后重试", { type: "error" });
  } finally {
    dialogLoading.value = false;
  }
};

// 关闭对话框
const handleClose = () => {
  dialogVisible.value = false;
  resetForm();
};

// 格式化启用状态 - 兼容字符串和数字类型
const formatEnable = (enable: string | number | undefined | null) => {
  // 转换为字符串后比较，兼容 "1", 1, true 等情况
  const value = String(enable);
  return value === "1" || value === "true" ? "启用" : "禁用";
};

// 获取启用状态标签类型 - 兼容字符串和数字类型
const getEnableType = (enable: string | number | undefined | null) => {
  const value = String(enable);
  return value === "1" || value === "true" ? "success" : "danger";
};

onMounted(() => {
  fetchCategoryTree();
});
</script>

<template>
  <div class="goods-category">
    <!-- 页面头部 -->
    <el-card shadow="never" class="header-card">
      <div class="header-content">
        <h3 class="page-title">商品分类管理</h3>
        <div class="header-actions">
          <el-button type="primary" :icon="Plus" @click="handleAdd()">
            新增分类
          </el-button>
          <el-button :icon="Refresh" @click="fetchCategoryTree">
            刷新
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- 分类树形表格 -->
    <el-card shadow="never" class="table-card">
      <el-table
        v-loading="loading"
        :data="categoryTree"
        row-key="id"
        border
        default-expand-all
        :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
      >
        <el-table-column prop="name" label="分类名称" min-width="200">
          <template #default="{ row }">
            <span class="category-name">{{ row.name }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="iconText" label="图标文字" width="120" align="center">
          <template #default="{ row }">
            <span v-if="row.iconText" class="icon-text">{{ row.iconText }}</span>
            <span v-else class="empty-placeholder">
              <el-icon class="empty-icon"><Document /></el-icon>
              <span>未设置</span>
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="picUrl" label="分类图片" width="120" align="center">
          <template #default="{ row }">
            <el-image
              v-if="row.picUrl"
              :src="row.picUrl"
              :preview-src-list="[row.picUrl]"
              fit="cover"
              class="category-image"
            />
            <div v-else class="image-placeholder">
              <el-icon class="placeholder-icon"><Picture /></el-icon>
              <span class="placeholder-text">无图片</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="sort" label="排序" width="100" align="center" />

        <el-table-column prop="enable" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getEnableType(row.enable)" size="small">
              {{ formatEnable(row.enable) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column
          prop="description"
          label="描述"
          min-width="150"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span v-if="row.description" class="description-text">{{ row.description }}</span>
            <span v-else class="empty-text">暂无描述</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link :icon="Plus" @click="handleAddChild(row)">
              添加子类
            </el-button>
            <el-button type="primary" link :icon="Edit" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button type="danger" link :icon="Delete" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 空状态 -->
      <el-empty
        v-if="!loading && categoryTree.length === 0"
        description="暂无分类数据"
      />
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      :close-on-click-modal="false"
      @close="handleClose"
    >
      <el-form
        ref="formRef"
        v-loading="dialogLoading"
        :model="formData"
        :rules="formRules"
        label-width="100px"
        label-position="right"
      >
        <el-form-item label="父级分类" prop="parentId">
          <el-select
            v-model="formData.parentId"
            placeholder="请选择父级分类"
            clearable
            style="width: 100%"
          >
            <el-option label="顶级分类" value="0" />
            <el-option
              v-for="item in flatCategoryList"
              :key="item.id"
              :label="item.name"
              :value="item.id"
              :disabled="item.id === formData.id"
            />
          </el-select>
          <div v-if="formData.parentId === '0'" class="form-tip">
            <span>一级分类最多 7 个</span>
            <span :class="{ 'count-warning': showTopLevelWarning }">
              （当前 {{ topLevelCategoryCount }} 个{{ showTopLevelWarning ? '，已达上限' : '' }}）
            </span>
          </div>
        </el-form-item>

        <el-form-item label="分类名称" prop="name">
          <el-input
            v-model="formData.name"
            placeholder="请输入分类名称"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="图标文字" prop="iconText">
          <el-input
            v-model="formData.iconText"
            placeholder="请输入图标文字（如：热门、新品）"
            maxlength="20"
            show-word-limit
          />
          <div class="form-tip">图标文字用于在前端显示分类的简短标识</div>
        </el-form-item>

        <el-form-item label="分类图片" prop="picUrl">
          <el-input
            v-model="formData.picUrl"
            placeholder="请输入分类图片URL"
          />
        </el-form-item>

        <el-form-item label="排序" prop="sort">
          <el-input-number
            v-model="formData.sort"
            :min="0"
            :max="9999"
            controls-position="right"
            style="width: 200px"
          />
          <div class="form-tip">数值越小越靠前</div>
        </el-form-item>

        <el-form-item label="启用状态" prop="enable">
          <el-radio-group v-model="formData.enable">
            <el-radio value="1">启用</el-radio>
            <el-radio value="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="分类描述" prop="description">
          <el-input
            v-model="formData.description"
            type="textarea"
            placeholder="请输入分类描述"
            :rows="3"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="handleClose">取消</el-button>
          <el-button
            type="primary"
            :loading="dialogLoading"
            @click="handleSubmit"
          >
            确定
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.goods-category {
  padding: 20px;

  .header-card {
    margin-bottom: 20px;

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .page-title {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #303133;
      }

      .header-actions {
        display: flex;
        gap: 12px;
      }
    }
  }

  .table-card {
    .category-name {
      font-weight: 500;
    }

    .icon-text {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 32px;
      height: 32px;
      padding: 4px 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }

    .empty-placeholder {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #c0c4cc;
      font-size: 12px;

      .empty-icon {
        font-size: 14px;
      }
    }

    .category-image {
      width: 50px;
      height: 50px;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s ease;

      &:hover {
        transform: scale(1.05);
      }
    }

    .image-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 50px;
      height: 50px;
      margin: 0 auto;
      background-color: #f5f7fa;
      border: 1px dashed #dcdfe6;
      border-radius: 8px;
      color: #c0c4cc;

      .placeholder-icon {
        font-size: 18px;
        margin-bottom: 2px;
      }

      .placeholder-text {
        font-size: 10px;
      }
    }

    .description-text {
      color: #606266;
      font-size: 13px;
    }

    .empty-text {
      color: #c0c4cc;
      font-style: italic;
      font-size: 12px;
    }
  }

  .form-tip {
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
    line-height: 1.5;

    .count-warning {
      color: #e6a23c;
      font-weight: 500;
    }
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
}
</style>
