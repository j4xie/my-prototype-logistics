<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { View, Delete, Search, Refresh } from "@element-plus/icons-vue";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import {
  getAiSessionsPage,
  getAiSessionById,
  deleteAiSession
} from "@/api/mall/decoration";
import type { AiSession, AiSessionQuery } from "@/api/mall/types/decoration";
import MerchantSelect from "@/components/MerchantSelect/index.vue";

defineOptions({
  name: "AiSessions"
});

// 列表数据
const tableData = ref<AiSession[]>([]);
const loading = ref(false);
const total = ref(0);

// 查询参数
const queryParams = reactive<AiSessionQuery>({
  merchantId: undefined,
  status: undefined,
  startDate: undefined,
  endDate: undefined,
  current: 1,
  size: 10
});

// 日期范围
const dateRange = ref<[string, string] | null>(null);

// 详情弹窗
const detailDialogVisible = ref(false);
const detailLoading = ref(false);
const currentDetail = ref<AiSession | null>(null);

// 状态选项
const statusOptions = [
  { label: "进行中", value: 0 },
  { label: "已完成", value: 1 },
  { label: "已取消", value: 2 }
];

// 步骤映射
const stepLabels: Record<number, string> = {
  1: "选择行业",
  2: "选择风格",
  3: "选择主题",
  4: "确认配置"
};

// 获取列表
const fetchList = async () => {
  loading.value = true;
  try {
    // 处理日期范围
    if (dateRange.value && dateRange.value.length === 2) {
      queryParams.startDate = dateRange.value[0];
      queryParams.endDate = dateRange.value[1];
    } else {
      queryParams.startDate = undefined;
      queryParams.endDate = undefined;
    }

    const res = await getAiSessionsPage(queryParams) as any;
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
  queryParams.merchantId = undefined;
  queryParams.status = undefined;
  queryParams.startDate = undefined;
  queryParams.endDate = undefined;
  queryParams.current = 1;
  dateRange.value = null;
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

// 查看详情
const handleViewDetail = async (row: AiSession) => {
  detailDialogVisible.value = true;
  detailLoading.value = true;
  currentDetail.value = null;

  try {
    const res = await getAiSessionById(row.id!);
    if (res.code === 200 && res.data) {
      currentDetail.value = res.data;
    } else {
      message(res.msg || "获取详情失败", { type: "error" });
    }
  } catch (error) {
    message("获取详情失败", { type: "error" });
  } finally {
    detailLoading.value = false;
  }
};

// 删除
const handleDelete = async (row: AiSession) => {
  try {
    await ElMessageBox.confirm("确定要删除该会话记录吗？", "提示", {
      type: "warning"
    });
    const res = await deleteAiSession(row.id!);
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

// 获取状态标签类型
const getStatusType = (status: number | undefined) => {
  switch (status) {
    case 0:
      return "warning";
    case 1:
      return "success";
    case 2:
      return "info";
    default:
      return "info";
  }
};

// 获取状态名称
const getStatusName = (status: number | undefined) => {
  return statusOptions.find(o => o.value === status)?.label || "未知";
};

// 获取步骤名称
const getStepName = (step: number | undefined) => {
  if (step === undefined || step === null) return "-";
  return stepLabels[step] || `步骤${step}`;
};

// 格式化JSON显示
const formatJson = (jsonStr: string | undefined) => {
  if (!jsonStr) return "-";
  try {
    const obj = JSON.parse(jsonStr);
    return JSON.stringify(obj, null, 2);
  } catch {
    return jsonStr;
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
        <el-form-item label="商户">
          <MerchantSelect
            v-model="queryParams.merchantId"
            placeholder="全部商户"
            clearable
            style="width: 180px"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select
            v-model="queryParams.status"
            placeholder="全部"
            clearable
            style="width: 120px"
          >
            <el-option
              v-for="item in statusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 240px"
          />
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
          <span class="font-medium">AI会话记录列表</span>
        </div>
      </template>

      <el-table v-loading="loading" :data="tableData" stripe>
        <el-table-column prop="sessionId" label="会话ID" width="180" show-overflow-tooltip />
        <el-table-column prop="merchantName" label="商户名称" width="120" show-overflow-tooltip />
        <el-table-column prop="userPrompt" label="用户描述" min-width="180" show-overflow-tooltip />
        <el-table-column prop="currentStep" label="当前步骤" width="100">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ getStepName(row.currentStep) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="selectedIndustry" label="选择行业" width="100" show-overflow-tooltip />
        <el-table-column prop="selectedStyle" label="选择风格" width="100" show-overflow-tooltip />
        <el-table-column prop="selectedThemeCode" label="主题编码" width="120" show-overflow-tooltip />
        <el-table-column prop="feedbackScore" label="评分" width="80">
          <template #default="{ row }">
            <span v-if="row.feedbackScore !== undefined && row.feedbackScore !== null">
              {{ row.feedbackScore }}
            </span>
            <span v-else class="text-gray-400">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusName(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="160" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link :icon="View" @click="handleViewDetail(row)">详情</el-button>
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

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="detailDialogVisible"
      title="AI会话详情"
      width="800px"
      destroy-on-close
    >
      <div v-loading="detailLoading">
        <template v-if="currentDetail">
          <!-- 基本信息 -->
          <el-descriptions :column="2" border class="mb-4">
            <el-descriptions-item label="会话ID">{{ currentDetail.sessionId }}</el-descriptions-item>
            <el-descriptions-item label="商户名称">{{ currentDetail.merchantName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="当前步骤">
              <el-tag size="small" type="info">{{ getStepName(currentDetail.currentStep) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="getStatusType(currentDetail.status)" size="small">
                {{ getStatusName(currentDetail.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="选择行业">{{ currentDetail.selectedIndustry || '-' }}</el-descriptions-item>
            <el-descriptions-item label="选择风格">{{ currentDetail.selectedStyle || '-' }}</el-descriptions-item>
            <el-descriptions-item label="主题编码">{{ currentDetail.selectedThemeCode || '-' }}</el-descriptions-item>
            <el-descriptions-item label="评分">
              <span v-if="currentDetail.feedbackScore !== undefined && currentDetail.feedbackScore !== null">
                {{ currentDetail.feedbackScore }}
              </span>
              <span v-else class="text-gray-400">-</span>
            </el-descriptions-item>
            <el-descriptions-item label="创建时间" :span="2">{{ currentDetail.createTime }}</el-descriptions-item>
            <el-descriptions-item label="用户描述" :span="2">{{ currentDetail.userPrompt || '-' }}</el-descriptions-item>
          </el-descriptions>

          <!-- AI分析结果 -->
          <div class="detail-section">
            <div class="section-title">AI分析结果</div>
            <el-input
              type="textarea"
              :model-value="formatJson(currentDetail.aiAnalysis)"
              :rows="8"
              readonly
              class="json-textarea"
            />
          </div>

          <!-- 生成配置 -->
          <div class="detail-section">
            <div class="section-title">生成配置</div>
            <el-input
              type="textarea"
              :model-value="formatJson(currentDetail.generatedConfig)"
              :rows="8"
              readonly
              class="json-textarea"
            />
          </div>
        </template>
        <el-empty v-else description="暂无数据" />
      </div>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
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

.text-gray-400 {
  color: #9ca3af;
}

.detail-section {
  margin-top: 16px;

  .section-title {
    font-weight: 500;
    margin-bottom: 8px;
    color: #303133;
  }
}

.json-textarea {
  :deep(.el-textarea__inner) {
    font-family: "Monaco", "Menlo", "Ubuntu Mono", "Consolas", monospace;
    font-size: 12px;
    line-height: 1.5;
    background-color: #f5f7fa;
  }
}
</style>
