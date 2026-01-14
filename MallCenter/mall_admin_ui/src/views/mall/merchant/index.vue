<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ElMessageBox } from "element-plus";
import { Search, Refresh, View, Check, Close } from "@element-plus/icons-vue";
import { message } from "@/utils/message";
import {
  getMerchantPage,
  reviewMerchant,
  updateMerchantStatus
} from "@/api/mall/merchant";
import type { Merchant, MerchantQuery, MerchantStatus } from "@/api/mall/types/merchant";
import { MerchantStatusMap, MerchantStatusColor } from "@/api/mall/types/merchant";

defineOptions({
  name: "MerchantIndex"
});

const router = useRouter();

// 加载状态
const loading = ref(false);

// 商户列表
const tableData = ref<Merchant[]>([]);

// 分页信息
const pagination = reactive({
  current: 1,
  size: 10,
  total: 0
});

// 查询参数
const queryParams = reactive<MerchantQuery>({
  merchantName: "",
  status: undefined
});

// 获取商户列表
const fetchData = async () => {
  loading.value = true;
  try {
    const res = await getMerchantPage({
      ...queryParams,
      current: pagination.current,
      size: pagination.size
    });
    if (res.code === 200) {
      tableData.value = res.data.records;
      pagination.total = res.data.total;
    } else {
      message(res.msg || "获取商户列表失败", { type: "error" });
    }
  } catch (error) {
    message("获取商户列表失败", { type: "error" });
  } finally {
    loading.value = false;
  }
};

// 搜索
const handleSearch = () => {
  pagination.current = 1;
  fetchData();
};

// 重置
const handleReset = () => {
  queryParams.merchantName = "";
  queryParams.status = undefined;
  pagination.current = 1;
  fetchData();
};

// 查看详情
const handleView = (row: Merchant) => {
  router.push(`/mall/merchant/detail/${row.id}`);
};

// 审核通过
const handleApprove = async (row: Merchant) => {
  try {
    await ElMessageBox.confirm(
      `确定要审核通过商户「${row.merchantName}」吗？`,
      "审核确认",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );
    const res = await reviewMerchant(row.id, "approve");
    if (res.code === 200) {
      message("审核通过", { type: "success" });
      fetchData();
    } else {
      message(res.msg || "操作失败", { type: "error" });
    }
  } catch (error) {
    if (error !== "cancel") {
      message("操作失败", { type: "error" });
    }
  }
};

// 封禁商户
const handleBan = async (row: Merchant) => {
  try {
    const { value: remark } = await ElMessageBox.prompt(
      `确定要封禁商户「${row.merchantName}」吗？`,
      "封禁确认",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        inputPlaceholder: "请输入封禁原因（可选）",
        type: "warning"
      }
    );
    const res = await updateMerchantStatus(row.id, "2");
    if (res.code === 200) {
      message("封禁成功", { type: "success" });
      fetchData();
    } else {
      message(res.msg || "操作失败", { type: "error" });
    }
  } catch (error) {
    if (error !== "cancel") {
      message("操作失败", { type: "error" });
    }
  }
};

// 解封商户
const handleUnban = async (row: Merchant) => {
  try {
    await ElMessageBox.confirm(
      `确定要解封商户「${row.merchantName}」吗？`,
      "解封确认",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );
    const res = await updateMerchantStatus(row.id, "1");
    if (res.code === 200) {
      message("解封成功", { type: "success" });
      fetchData();
    } else {
      message(res.msg || "操作失败", { type: "error" });
    }
  } catch (error) {
    if (error !== "cancel") {
      message("操作失败", { type: "error" });
    }
  }
};

// 分页大小改变
const handleSizeChange = (size: number) => {
  pagination.size = size;
  pagination.current = 1;
  fetchData();
};

// 页码改变
const handleCurrentChange = (current: number) => {
  pagination.current = current;
  fetchData();
};

// 格式化状态
const formatStatus = (status: MerchantStatus) => {
  return MerchantStatusMap[status] || "未知";
};

// 获取状态类型
const getStatusType = (status: MerchantStatus) => {
  return MerchantStatusColor[status] || "info";
};

// 格式化 ID（显示前8位 + ...）
const formatId = (id: string | undefined) => {
  if (!id) return "-";
  if (id.length <= 8) return id;
  return id.substring(0, 8) + "...";
};

// 判断是否可以审核通过（待审核状态）
const canApprove = (row: Merchant) => row.status === 0;

// 判断是否可以封禁（已认证状态）
const canBan = (row: Merchant) => row.status === 1;

// 判断是否可以解封（已封禁状态）
const canUnban = (row: Merchant) => row.status === 2;

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div class="merchant-index">
    <!-- 搜索区域 -->
    <el-card shadow="never" class="search-card">
      <el-form :model="queryParams" :inline="true">
        <el-form-item label="商户名称">
          <el-input
            v-model="queryParams.merchantName"
            placeholder="请输入商户名称"
            clearable
            style="width: 200px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="商户状态">
          <el-select
            v-model="queryParams.status"
            placeholder="请选择状态"
            clearable
            style="width: 150px"
          >
            <el-option label="待审核" :value="0" />
            <el-option label="已认证" :value="1" />
            <el-option label="已封禁" :value="2" />
            <el-option label="已注销" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">
            搜索
          </el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 表格区域 -->
    <el-card shadow="never" class="table-card">
      <template #header>
        <div class="table-header">
          <span class="title">商户列表</span>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" stripe border>
        <el-table-column label="商户编号" width="140">
          <template #default="{ row }">
            <el-tooltip :content="row.merchantNo || row.id" placement="top" :show-after="300">
              <span class="id-cell">{{ row.merchantNo || formatId(row.id) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="merchantName" label="商户名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="contactName" label="联系人" width="100" show-overflow-tooltip />
        <el-table-column prop="contactPhone" label="联系电话" width="130" />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ formatStatus(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="goodsCount" label="商品数" width="90" align="center">
          <template #default="{ row }">
            <span class="count-cell">{{ row.goodsCount || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="orderCount" label="订单数" width="90" align="center">
          <template #default="{ row }">
            <span class="count-cell">{{ row.orderCount || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="170" />
        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link :icon="View" @click="handleView(row)">
              详情
            </el-button>
            <el-button
              v-if="canApprove(row)"
              type="success"
              link
              :icon="Check"
              @click="handleApprove(row)"
            >
              通过
            </el-button>
            <el-button
              v-if="canBan(row)"
              type="danger"
              link
              :icon="Close"
              @click="handleBan(row)"
            >
              封禁
            </el-button>
            <el-button
              v-if="canUnban(row)"
              type="warning"
              link
              @click="handleUnban(row)"
            >
              解封
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.current"
          v-model:page-size="pagination.size"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.merchant-index {
  padding: 20px;

  .search-card {
    margin-bottom: 16px;
  }

  .table-card {
    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .title {
        font-size: 16px;
        font-weight: 600;
      }
    }
  }

  .id-cell {
    font-family: "SF Mono", "Monaco", "Consolas", monospace;
    font-size: 12px;
    color: #606266;
    cursor: pointer;

    &:hover {
      color: #409eff;
    }
  }

  .count-cell {
    font-family: "SF Mono", "Monaco", "Consolas", monospace;
    font-weight: 600;
    color: #409eff;
  }

  .pagination-wrapper {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
  }
}
</style>
