<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { Plus, Edit, Delete, Search, Refresh } from "@element-plus/icons-vue";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import {
  getKeywordMappingsPage,
  createKeywordMapping,
  updateKeywordMapping,
  deleteKeywordMapping
} from "@/api/mall/decoration";
import type { KeywordMapping, KeywordMappingQuery } from "@/api/mall/types/decoration";

defineOptions({
  name: "KeywordMappings"
});

// 列表数据
const tableData = ref<KeywordMapping[]>([]);
const loading = ref(false);
const total = ref(0);

// 查询参数
const queryParams = reactive<KeywordMappingQuery>({
  keyword: "",
  mappingType: "",
  status: undefined,
  current: 1,
  size: 10
});

// 弹窗控制
const dialogVisible = ref(false);
const dialogTitle = ref("");
const formLoading = ref(false);

// 表单数据
const formData = ref<KeywordMapping>({
  keyword: "",
  mappingType: "industry",
  mappingValue: "",
  themeCode: "",
  weight: 1,
  status: 1
});

// 映射类型选项
const mappingTypeOptions = [
  { label: "行业映射", value: "industry" },
  { label: "风格映射", value: "style" },
  { label: "产品映射", value: "product" }
];

// 行业映射值选项
const industryValueOptions = [
  { label: "生鲜食品", value: "fresh_food" },
  { label: "海鲜水产", value: "seafood" },
  { label: "甜品烘焙", value: "dessert" },
  { label: "礼品礼盒", value: "gift" },
  { label: "母婴用品", value: "baby" },
  { label: "数码科技", value: "tech" },
  { label: "美妆护肤", value: "beauty" },
  { label: "通用", value: "general" }
];

// 风格映射值选项
const styleValueOptions = [
  { label: "清新自然", value: "fresh" },
  { label: "高端奢华", value: "luxury" },
  { label: "简约现代", value: "minimal" },
  { label: "多巴胺活力", value: "dopamine" },
  { label: "温馨舒适", value: "warm" }
];

// 根据映射类型计算可选的映射值
const mappingValueOptions = computed(() => {
  switch (formData.value.mappingType) {
    case "industry":
      return industryValueOptions;
    case "style":
      return styleValueOptions;
    case "product":
      return industryValueOptions; // 产品映射复用行业选项
    default:
      return [];
  }
});

// 获取列表
const fetchList = async () => {
  loading.value = true;
  try {
    const res = await getKeywordMappingsPage(queryParams) as any;
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
  queryParams.keyword = "";
  queryParams.mappingType = "";
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
  dialogTitle.value = "新增关键词映射";
  formData.value = {
    keyword: "",
    mappingType: "industry",
    mappingValue: "",
    themeCode: "",
    weight: 1,
    status: 1
  };
  dialogVisible.value = true;
};

// 编辑
const handleEdit = (row: KeywordMapping) => {
  dialogTitle.value = "编辑关键词映射";
  formData.value = { ...row };
  dialogVisible.value = true;
};

// 删除
const handleDelete = async (row: KeywordMapping) => {
  try {
    await ElMessageBox.confirm("确定要删除该关键词映射吗？", "提示", {
      type: "warning"
    });
    const res = await deleteKeywordMapping(row.id!);
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
  if (!formData.value.keyword || !formData.value.mappingType || !formData.value.mappingValue) {
    message("请填写必填项", { type: "warning" });
    return;
  }

  formLoading.value = true;
  try {
    let res;
    if (formData.value.id) {
      res = await updateKeywordMapping(formData.value.id, formData.value);
    } else {
      res = await createKeywordMapping(formData.value);
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

// 映射类型变化时清空映射值
const handleMappingTypeChange = () => {
  formData.value.mappingValue = "";
};

// 获取映射类型名称
const getMappingTypeName = (value: string) => {
  return mappingTypeOptions.find(o => o.value === value)?.label || value;
};

// 获取映射值名称
const getMappingValueName = (type: string, value: string) => {
  if (type === "industry" || type === "product") {
    return industryValueOptions.find(o => o.value === value)?.label || value;
  } else if (type === "style") {
    return styleValueOptions.find(o => o.value === value)?.label || value;
  }
  return value;
};

// 获取映射类型的标签类型
const getMappingTypeTagType = (type: string) => {
  switch (type) {
    case "industry":
      return "";
    case "style":
      return "success";
    case "product":
      return "warning";
    default:
      return "info";
  }
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
        <el-form-item label="关键词">
          <el-input
            v-model="queryParams.keyword"
            placeholder="请输入关键词"
            clearable
            style="width: 180px"
          />
        </el-form-item>
        <el-form-item label="映射类型">
          <el-select
            v-model="queryParams.mappingType"
            placeholder="全部"
            clearable
            style="width: 140px"
          >
            <el-option
              v-for="item in mappingTypeOptions"
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
          <span class="font-medium">关键词映射列表</span>
          <el-button type="primary" :icon="Plus" @click="handleAdd">新增映射</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="tableData" stripe>
        <el-table-column prop="keyword" label="关键词" width="150" />
        <el-table-column prop="mappingType" label="映射类型" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="getMappingTypeTagType(row.mappingType)">
              {{ getMappingTypeName(row.mappingType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="mappingValue" label="映射值" width="120">
          <template #default="{ row }">
            <el-tag size="small" type="info">
              {{ getMappingValueName(row.mappingType, row.mappingValue) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="themeCode" label="关联主题" width="120" show-overflow-tooltip />
        <el-table-column prop="weight" label="权重" width="80" align="center" />
        <el-table-column prop="matchCount" label="匹配次数" width="100" align="center" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
              {{ row.status === 1 ? "启用" : "停用" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="170" />
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
      width="550px"
      destroy-on-close
    >
      <el-form :model="formData" label-width="100px">
        <el-form-item label="关键词" required>
          <el-input v-model="formData.keyword" placeholder="如: 海鲜, 生鲜, 高端" />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="映射类型" required>
              <el-select
                v-model="formData.mappingType"
                placeholder="请选择"
                @change="handleMappingTypeChange"
              >
                <el-option
                  v-for="item in mappingTypeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="映射值" required>
              <el-select v-model="formData.mappingValue" placeholder="请选择">
                <el-option
                  v-for="item in mappingValueOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="关联主题">
              <el-input v-model="formData.themeCode" placeholder="主题编码 (可选)" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="权重">
              <el-input-number
                v-model="formData.weight"
                :min="1"
                :max="100"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="状态">
          <el-switch
            v-model="formData.status"
            :active-value="1"
            :inactive-value="0"
            active-text="启用"
            inactive-text="停用"
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
