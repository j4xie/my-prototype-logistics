<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessageBox } from "element-plus";
import { Back, Van } from "@element-plus/icons-vue";
import { message } from "@/utils/message";
import {
  getOrderInfoById,
  deliverOrder,
  cancelOrder,
  OrderStatusMap
} from "@/api/mall/orderInfo";
import type { OrderInfo, DeliverParams } from "@/api/mall/types/orderInfo";

defineOptions({
  name: "OrderInfoDetail"
});

const route = useRoute();
const router = useRouter();

// 加载状态
const loading = ref(false);

// 订单详情
const orderInfo = ref<OrderInfo | null>(null);

// 发货弹窗
const deliverDialogVisible = ref(false);
const deliverForm = ref<DeliverParams>({
  expressCompany: "",
  expressNo: ""
});

// 订单ID
const orderId = computed(() => route.params.id as string);

// 获取订单详情
const fetchData = async () => {
  if (!orderId.value) return;
  loading.value = true;
  try {
    const res = await getOrderInfoById(orderId.value);
    if (res.code === 200) {
      orderInfo.value = res.data;
    } else {
      message(res.msg || "获取订单详情失败", { type: "error" });
    }
  } catch (error) {
    message("获取订单详情失败", { type: "error" });
  } finally {
    loading.value = false;
  }
};

// 返回列表
const handleBack = () => {
  router.push("/mall/orderInfo");
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
    "0": "warning",
    "1": "primary",
    "2": "info",
    "3": "success",
    "4": "danger",
    "5": "danger"
  };
  return typeMap[status] || "info";
};

// 是否可发货（待发货状态）
const canDeliver = computed(() => orderInfo.value?.status === "1");

// 是否可取消（待付款或待发货状态）
const canCancel = computed(() => {
  const status = orderInfo.value?.status;
  return status === "0" || status === "1";
});

// 打开发货弹窗
const handleOpenDeliver = () => {
  deliverForm.value = {
    expressCompany: "",
    expressNo: ""
  };
  deliverDialogVisible.value = true;
};

// 确认发货
const handleConfirmDeliver = async () => {
  if (!orderInfo.value) return;
  try {
    const res = await deliverOrder(orderInfo.value.id, deliverForm.value);
    if (res.code === 200) {
      message("发货成功", { type: "success" });
      deliverDialogVisible.value = false;
      fetchData();
    } else {
      message(res.msg || "发货失败", { type: "error" });
    }
  } catch (error) {
    message("发货失败", { type: "error" });
  }
};

// 取消订单
const handleCancel = async () => {
  if (!orderInfo.value) return;
  try {
    await ElMessageBox.confirm(
      `确定要取消订单「${orderInfo.value.orderNo}」吗？`,
      "取消确认",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );
    const res = await cancelOrder(orderInfo.value.id);
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

// 计算商品总数
const totalQuantity = computed(() => {
  if (!orderInfo.value?.orderItems) return 0;
  return orderInfo.value.orderItems.reduce((sum, item) => sum + item.quantity, 0);
});

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div class="order-info-detail" v-loading="loading">
    <!-- 顶部操作栏 -->
    <el-card shadow="never" class="header-card">
      <div class="header-content">
        <el-button :icon="Back" @click="handleBack">返回列表</el-button>
        <div class="actions" v-if="orderInfo">
          <el-button
            v-if="canDeliver"
            type="primary"
            :icon="Van"
            @click="handleOpenDeliver"
          >
            发货
          </el-button>
          <el-button
            v-if="canCancel"
            type="danger"
            @click="handleCancel"
          >
            取消订单
          </el-button>
        </div>
      </div>
    </el-card>

    <template v-if="orderInfo">
      <!-- 订单基本信息 -->
      <el-card shadow="never" class="info-card">
        <template #header>
          <div class="card-header">
            <span class="title">订单信息</span>
            <el-tag :type="getStatusType(orderInfo.status)" size="large">
              {{ formatStatus(orderInfo.status) }}
            </el-tag>
          </div>
        </template>
        <el-descriptions :column="3" border>
          <el-descriptions-item label="订单编号">
            {{ orderInfo.orderNo }}
          </el-descriptions-item>
          <el-descriptions-item label="下单时间">
            {{ orderInfo.createTime }}
          </el-descriptions-item>
          <el-descriptions-item label="支付时间">
            {{ orderInfo.payTime || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="发货时间">
            {{ orderInfo.deliverTime || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="收货时间">
            {{ orderInfo.receiveTime || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="订单备注">
            {{ orderInfo.remark || "-" }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 收货信息 -->
      <el-card shadow="never" class="info-card">
        <template #header>
          <span class="title">收货信息</span>
        </template>
        <el-descriptions :column="3" border>
          <el-descriptions-item label="收货人">
            {{ orderInfo.receiverName }}
          </el-descriptions-item>
          <el-descriptions-item label="联系电话">
            {{ orderInfo.receiverPhone }}
          </el-descriptions-item>
          <el-descriptions-item label="收货地址" :span="3">
            {{ orderInfo.receiverAddress }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 用户信息 -->
      <el-card shadow="never" class="info-card" v-if="orderInfo.userName || orderInfo.userPhone">
        <template #header>
          <span class="title">用户信息</span>
        </template>
        <el-descriptions :column="3" border>
          <el-descriptions-item label="用户ID">
            {{ orderInfo.userId }}
          </el-descriptions-item>
          <el-descriptions-item label="用户名称">
            {{ orderInfo.userName || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="用户手机">
            {{ orderInfo.userPhone || "-" }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 商品列表 -->
      <el-card shadow="never" class="info-card">
        <template #header>
          <div class="card-header">
            <span class="title">商品信息</span>
            <span class="sub-title">共{{ totalQuantity }}件商品</span>
          </div>
        </template>
        <el-table :data="orderInfo.orderItems" stripe border>
          <el-table-column label="商品图片" width="100">
            <template #default="{ row }">
              <el-image
                :src="row.goodsPic"
                fit="cover"
                class="goods-pic"
                :preview-src-list="[row.goodsPic]"
                preview-teleported
              />
            </template>
          </el-table-column>
          <el-table-column prop="goodsName" label="商品名称" min-width="200" show-overflow-tooltip />
          <el-table-column label="单价" width="120">
            <template #default="{ row }">
              <span class="price">{{ formatPrice(row.price) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="quantity" label="数量" width="100" />
          <el-table-column label="小计" width="120">
            <template #default="{ row }">
              <span class="price">{{ formatPrice(row.price * row.quantity) }}</span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 金额信息 -->
      <el-card shadow="never" class="info-card amount-card">
        <template #header>
          <span class="title">金额信息</span>
        </template>
        <div class="amount-info">
          <div class="amount-row">
            <span class="label">商品总额：</span>
            <span class="value">{{ formatPrice(orderInfo.totalAmount - orderInfo.freightAmount) }}</span>
          </div>
          <div class="amount-row">
            <span class="label">运费：</span>
            <span class="value">{{ formatPrice(orderInfo.freightAmount) }}</span>
          </div>
          <div class="amount-row total">
            <span class="label">订单总额：</span>
            <span class="value">{{ formatPrice(orderInfo.totalAmount) }}</span>
          </div>
          <div class="amount-row pay">
            <span class="label">实付金额：</span>
            <span class="value highlight">{{ formatPrice(orderInfo.payAmount) }}</span>
          </div>
        </div>
      </el-card>
    </template>

    <!-- 发货弹窗 -->
    <el-dialog
      v-model="deliverDialogVisible"
      title="订单发货"
      width="500px"
      destroy-on-close
    >
      <el-form :model="deliverForm" label-width="100px">
        <el-form-item label="物流公司">
          <el-input
            v-model="deliverForm.expressCompany"
            placeholder="请输入物流公司"
          />
        </el-form-item>
        <el-form-item label="物流单号">
          <el-input
            v-model="deliverForm.expressNo"
            placeholder="请输入物流单号"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="deliverDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleConfirmDeliver">确认发货</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.order-info-detail {
  padding: 20px;

  .header-card {
    margin-bottom: 16px;

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  }

  .info-card {
    margin-bottom: 16px;

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .title {
      font-size: 16px;
      font-weight: 600;
    }

    .sub-title {
      font-size: 14px;
      color: #909399;
    }
  }

  .goods-pic {
    width: 60px;
    height: 60px;
    border-radius: 4px;
  }

  .price {
    color: #f56c6c;
    font-weight: 600;
  }

  .amount-card {
    .amount-info {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      padding: 20px;

      .amount-row {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        margin-bottom: 12px;
        font-size: 14px;

        .label {
          color: #606266;
          margin-right: 10px;
        }

        .value {
          min-width: 100px;
          text-align: right;
        }

        &.total {
          padding-top: 12px;
          border-top: 1px solid #ebeef5;
          font-size: 15px;
        }

        &.pay {
          font-size: 18px;
          font-weight: 600;

          .highlight {
            color: #f56c6c;
            font-size: 20px;
          }
        }
      }
    }
  }
}
</style>
