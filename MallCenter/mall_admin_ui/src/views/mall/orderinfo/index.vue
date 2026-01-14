<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ElMessageBox } from "element-plus";
import { Search, Refresh, View } from "@element-plus/icons-vue";
import { message } from "@/utils/message";
import {
  getOrderInfoPage,
  cancelOrder,
  OrderStatusMap
} from "@/api/mall/orderInfo";
import type { OrderInfo, OrderInfoQuery } from "@/api/mall/types/orderInfo";

defineOptions({
  name: "OrderInfoIndex"
});

const router = useRouter();

// 加载状态
const loading = ref(false);

// 订单列表
const tableData = ref<OrderInfo[]>([]);

// 分页信息
const pagination = reactive({
  current: 1,
  size: 10,
  total: 0
});

// 查询参数
const queryParams = reactive<OrderInfoQuery>({
  orderNo: "",
  status: undefined,
  receiverPhone: ""
});

// 状态选项
const statusOptions = Object.entries(OrderStatusMap).map(([value, label]) => ({
  value,
  label
}));

// 获取订单列表
const fetchData = async () => {
  loading.value = true;
  try {
    const res = await getOrderInfoPage({
      ...queryParams,
      current: pagination.current,
      size: pagination.size
    });
    if (res.code === 200) {
      tableData.value = res.data.records;
      pagination.total = res.data.total;
    } else {
      message(res.msg || "获取订单列表失败", { type: "error" });
    }
  } catch (error) {
    message("获取订单列表失败", { type: "error" });
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
  queryParams.orderNo = "";
  queryParams.status = undefined;
  queryParams.receiverPhone = "";
  pagination.current = 1;
  fetchData();
};

// 查看详情
const handleDetail = (row: OrderInfo) => {
  router.push(`/mall/merchant/orders/detail/${row.id}`);
};

// 取消订单
const handleCancel = async (row: OrderInfo) => {
  try {
    await ElMessageBox.confirm(
      `确定要取消订单「${row.orderNo}」吗？`,
      "取消确认",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );
    const res = await cancelOrder(row.id);
    if (res.code === 200) {
      message("取消成功", { type: "success" });
      fetchData();
    } else {
      message(res.msg || "取消失败", { type: "error" });
    }
  } catch (error) {
    if (error !== "cancel") {
      message("取消失败", { type: "error" });
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

// 格式化价格（分转元）
const formatPrice = (price: number) => {
  return `¥${(price / 100).toFixed(2)}`;
};

// 格式化状态
const formatStatus = (status: string) => {
  return OrderStatusMap[status as keyof typeof OrderStatusMap] || "未知";
};

// 获取状态类型
const getStatusType = (status: string) => {
  const typeMap: Record<string, string> = {
    "0": "warning", // 待付款
    "1": "primary", // 待发货
    "2": "info", // 待收货
    "3": "success", // 已完成
    "4": "danger", // 已取消
    "5": "danger" // 已退款
  };
  return typeMap[status] || "info";
};

// 是否可取消
const canCancel = (status: string) => {
  return status === "0" || status === "1";
};

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div class="order-info-index">
    <!-- 搜索区域 -->
    <el-card shadow="never" class="search-card">
      <el-form :model="queryParams" :inline="true">
        <el-form-item label="订单编号">
          <el-input
            v-model="queryParams.orderNo"
            placeholder="请输入订单编号"
            clearable
            style="width: 200px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="订单状态">
          <el-select
            v-model="queryParams.status"
            placeholder="请选择状态"
            clearable
            style="width: 150px"
          >
            <el-option
              v-for="item in statusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="收货人手机">
          <el-input
            v-model="queryParams.receiverPhone"
            placeholder="请输入手机号"
            clearable
            style="width: 150px"
            @keyup.enter="handleSearch"
          />
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
          <span class="title">订单列表</span>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" stripe border>
        <el-table-column prop="orderNo" label="订单编号" width="180" />
        <el-table-column label="商品信息" min-width="250">
          <template #default="{ row }">
            <div class="goods-info" v-if="row.orderItems && row.orderItems.length > 0">
              <el-image
                :src="row.orderItems[0].goodsPic"
                fit="cover"
                class="goods-pic"
              />
              <div class="goods-detail">
                <div class="goods-name">{{ row.orderItems[0].goodsName }}</div>
                <div class="goods-count" v-if="row.orderItems.length > 1">
                  等{{ row.orderItems.length }}件商品
                </div>
              </div>
            </div>
            <span v-else class="no-goods">暂无商品</span>
          </template>
        </el-table-column>
        <el-table-column label="收货人" width="150">
          <template #default="{ row }">
            <div>{{ row.receiverName }}</div>
            <div class="sub-text">{{ row.receiverPhone }}</div>
          </template>
        </el-table-column>
        <el-table-column label="订单金额" width="120">
          <template #default="{ row }">
            <span class="price">{{ formatPrice(row.payAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ formatStatus(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="下单时间" width="180" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link :icon="View" @click="handleDetail(row)">
              详情
            </el-button>
            <el-button
              v-if="canCancel(row.status)"
              type="danger"
              link
              @click="handleCancel(row)"
            >
              取消
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
.order-info-index {
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

  .goods-info {
    display: flex;
    align-items: center;

    .goods-pic {
      width: 50px;
      height: 50px;
      border-radius: 4px;
      flex-shrink: 0;
    }

    .goods-detail {
      margin-left: 10px;
      overflow: hidden;

      .goods-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 14px;
      }

      .goods-count {
        font-size: 12px;
        color: #909399;
        margin-top: 4px;
      }
    }
  }

  .no-goods {
    color: #909399;
    font-size: 12px;
  }

  .sub-text {
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
  }

  .price {
    color: #f56c6c;
    font-weight: 600;
  }

  .pagination-wrapper {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
  }
}
</style>
