<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { Plus, Edit, Delete, Search, Refresh } from "@element-plus/icons-vue";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import {
  getPromptTemplatesPage,
  createPromptTemplate,
  updatePromptTemplate,
  deletePromptTemplate
} from "@/api/mall/decoration";
import type { PromptTemplate, PromptTemplateQuery } from "@/api/mall/types/decoration";

defineOptions({
  name: "PromptTemplates"
});

// 列表数据
const tableData = ref<PromptTemplate[]>([]);
const loading = ref(false);
const total = ref(0);

// 查询参数
const queryParams = reactive<PromptTemplateQuery>({
  name: "",
  industryType: "",
  imageType: "",
  status: undefined,
  current: 1,
  size: 10
});

// 弹窗控制
const dialogVisible = ref(false);
const dialogTitle = ref("");
const formLoading = ref(false);

// 表单数据
const formData = ref<PromptTemplate>({
  name: "",
  code: "",
  industryType: "",
  imageType: "banner",
  styleType: "",
  basePrompt: "",
  variablesDef: '{"product":"产品名称","style":"风格描述","color_tone":"色调","size":"尺寸"}',
  negativePrompt: "blurry, low quality, distorted, watermark, text, logo",
  recommendedSize: "750*300",
  status: 1
});

// 行业类型选项
const industryOptions = [
  { label: "生鲜食品", value: "fresh_food" },
  { label: "海鲜水产", value: "seafood" },
  { label: "甜品烘焙", value: "dessert" },
  { label: "礼品礼盒", value: "gift" },
  { label: "母婴用品", value: "baby" },
  { label: "数码科技", value: "tech" },
  { label: "美妆护肤", value: "beauty" },
  { label: "通用", value: "general" }
];

// 图片类型选项
const imageTypeOptions = [
  { label: "Banner横幅", value: "banner" },
  { label: "背景图", value: "background" },
  { label: "图标", value: "icon" },
  { label: "产品图", value: "product" }
];

// 风格类型选项
const styleOptions = [
  { label: "清新自然", value: "fresh" },
  { label: "高端奢华", value: "luxury" },
  { label: "简约现代", value: "minimal" },
  { label: "多巴胺活力", value: "dopamine" },
  { label: "温馨舒适", value: "warm" }
];

// 获取列表
const fetchList = async () => {
  loading.value = true;
  try {
    const res = await getPromptTemplatesPage(queryParams) as any;
    if (res.code === 200) {
      // 兼容 RuoYi TableDataInfo 格式和标准格式
      tableData.value = res.rows || res.data?.records || [];
      total.value = res.total || res.data?.total || 0;
    } else {
      message(res.msg || "获取数据失败", { type: "error" });
    }
  } catch (error) {
    message("获取数据失败", { type: "error" });
  } finally {
    loading.value = false;
  }
};

// 搜索
const handleSearch = () => {
  queryParams.current = 1;
  fetchList();
};

// 重置
const handleReset = () => {
  queryParams.name = "";
  queryParams.industryType = "";
  queryParams.imageType = "";
  queryParams.status = undefined;
  queryParams.current = 1;
  fetchList();
};

// 分页
const handlePageChange = (page: number) => {
  queryParams.current = page;
  fetchList();
};

const handleSizeChange = (size: number) => {
  queryParams.size = size;
  queryParams.current = 1;
  fetchList();
};

// 新增
const handleAdd = () => {
  dialogTitle.value = "新增Prompt模板";
  formData.value = {
    name: "",
    code: "",
    industryType: "",
    imageType: "banner",
    styleType: "",
    basePrompt: "",
    variablesDef: '{"product":"产品名称","style":"风格描述","color_tone":"色调","size":"尺寸"}',
    negativePrompt: "blurry, low quality, distorted, watermark, text, logo",
    recommendedSize: "750*300",
    status: 1
  };
  dialogVisible.value = true;
};

// 编辑
const handleEdit = (row: PromptTemplate) => {
  dialogTitle.value = "编辑Prompt模板";
  formData.value = { ...row };
  dialogVisible.value = true;
};

// 删除
const handleDelete = async (row: PromptTemplate) => {
  try {
    await ElMessageBox.confirm("确定要删除该模板吗？", "提示", {
      type: "warning"
    });
    const res = await deletePromptTemplate(row.id!);
    if (res.code === 200) {
      message("删除成功", { type: "success" });
      fetchList();
    } else {
      message(res.msg || "删除失败", { type: "error" });
    }
  } catch {
    // 用户取消
  }
};

// 提交表单
const handleSubmit = async () => {
  if (!formData.value.name || !formData.value.code || !formData.value.basePrompt) {
    message("请填写必填项", { type: "warning" });
    return;
  }

  formLoading.value = true;
  try {
    let res;
    if (formData.value.id) {
      res = await updatePromptTemplate(formData.value.id, formData.value);
    } else {
      res = await createPromptTemplate(formData.value);
    }

    if (res.code === 200) {
      message(formData.value.id ? "更新成功" : "创建成功", { type: "success" });
      dialogVisible.value = false;
      fetchList();
    } else {
      message(res.msg || "操作失败", { type: "error" });
    }
  } catch (error) {
    message("操作失败", { type: "error" });
  } finally {
    formLoading.value = false;
  }
};

// 获取行业名称
const getIndustryName = (value: string) => {
  return industryOptions.find(o => o.value === value)?.label || value;
};

// 获取图片类型名称
const getImageTypeName = (value: string) => {
  return imageTypeOptions.find(o => o.value === value)?.label || value;
};

onMounted(() => {
  fetchList();
});
</script>

<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="mb-4">
      <el-form :inline="true" :model="queryParams">
        <el-form-item label="模板名称">
          <el-input
            v-model="queryParams.name"
            placeholder="请输入模板名称"
            clearable
            style="width: 180px"
          />
        </el-form-item>
        <el-form-item label="行业类型">
          <el-select
            v-model="queryParams.industryType"
            placeholder="全部"
            clearable
            style="width: 140px"
          >
            <el-option
              v-for="item in industryOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="图片类型">
          <el-select
            v-model="queryParams.imageType"
            placeholder="全部"
            clearable
            style="width: 120px"
          >
            <el-option
              v-for="item in imageTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select
            v-model="queryParams.status"
            placeholder="全部"
            clearable
            style="width: 100px"
          >
            <el-option label="启用" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 列表 -->
    <el-card shadow="never">
      <template #header>
        <div class="flex justify-between items-center">
          <span class="font-medium">Prompt模板列表</span>
          <el-button type="primary" :icon="Plus" @click="handleAdd">新增模板</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="tableData" stripe>
        <el-table-column prop="name" label="模板名称" width="150" />
        <el-table-column prop="code" label="模板编码" width="180" />
        <el-table-column prop="industryType" label="行业类型" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ getIndustryName(row.industryType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="imageType" label="图片类型" width="100">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ getImageTypeName(row.imageType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="basePrompt" label="基础Prompt" min-width="200" show-overflow-tooltip />
        <el-table-column prop="recommendedSize" label="推荐尺寸" width="100" />
        <el-table-column prop="useCount" label="使用次数" width="90" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
              {{ row.status === 1 ? "启用" : "停用" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link :icon="Edit" @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" link :icon="Delete" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="queryParams.current"
          v-model:page-size="queryParams.size"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="700px"
      destroy-on-close
    >
      <el-form :model="formData" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="模板名称" required>
              <el-input v-model="formData.name" placeholder="请输入模板名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="模板编码" required>
              <el-input v-model="formData.code" placeholder="如: fresh_food_banner" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="行业类型">
              <el-select v-model="formData.industryType" placeholder="请选择">
                <el-option
                  v-for="item in industryOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="图片类型">
              <el-select v-model="formData.imageType" placeholder="请选择">
                <el-option
                  v-for="item in imageTypeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="风格类型">
              <el-select v-model="formData.styleType" placeholder="请选择" clearable>
                <el-option
                  v-for="item in styleOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="基础Prompt" required>
          <el-input
            v-model="formData.basePrompt"
            type="textarea"
            :rows="4"
            placeholder="支持变量: {product}, {style}, {color_tone}, {size}"
          />
        </el-form-item>
        <el-form-item label="负向Prompt">
          <el-input
            v-model="formData.negativePrompt"
            type="textarea"
            :rows="2"
            placeholder="不希望出现的元素"
          />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="推荐尺寸">
              <el-input v-model="formData.recommendedSize" placeholder="如: 750*300" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-switch
                v-model="formData.status"
                :active-value="1"
                :inactive-value="0"
                active-text="启用"
                inactive-text="停用"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="变量定义">
          <el-input
            v-model="formData.variablesDef"
            type="textarea"
            :rows="2"
            placeholder="JSON格式变量定义"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="formLoading" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.page-container {
  padding: 20px;
}

.mb-4 {
  margin-bottom: 16px;
}

.pagination-container {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
