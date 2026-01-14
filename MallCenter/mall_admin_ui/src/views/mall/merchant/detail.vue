<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessageBox } from "element-plus";
import { Back, Check, Close } from "@element-plus/icons-vue";
import { message } from "@/utils/message";
import {
  getMerchantById,
  reviewMerchant,
  updateMerchantStatus
} from "@/api/mall/merchant";
import type { Merchant, MerchantStatus } from "@/api/mall/types/merchant";
import { MerchantStatusMap, MerchantStatusColor } from "@/api/mall/types/merchant";

defineOptions({
  name: "MerchantDetail"
});

const route = useRoute();
const router = useRouter();

// 加载状态
const loading = ref(false);

// 商户详情
const merchantInfo = ref<Merchant | null>(null);

// 商户ID
const merchantId = computed(() => Number(route.params.id));

// 获取商户详情
const fetchData = async () => {
  if (!merchantId.value) return;
  loading.value = true;
  try {
    const res = await getMerchantById(merchantId.value);
    if (res.code === 200) {
      merchantInfo.value = res.data;
    } else {
      message(res.msg || "获取商户详情失败", { type: "error" });
    }
  } catch (error) {
    message("获取商户详情失败", { type: "error" });
  } finally {
    loading.value = false;
  }
};

// 返回列表
const handleBack = () => {
  router.push("/mall/merchant/list");
};

// 格式化状态
const formatStatus = (status: MerchantStatus) => {
  return MerchantStatusMap[status] || "未知";
};

// 获取状态类型
const getStatusType = (status: MerchantStatus) => {
  return MerchantStatusColor[status] || "info";
};

// 判断是否可以审核通过（待审核状态）
const canApprove = computed(() => merchantInfo.value?.status === 0);

// 判断是否可以封禁（已认证状态）
const canBan = computed(() => merchantInfo.value?.status === 1);

// 判断是否可以解封（已封禁状态）
const canUnban = computed(() => merchantInfo.value?.status === 2);

// 审核通过
const handleApprove = async () => {
  if (!merchantInfo.value) return;
  try {
    await ElMessageBox.confirm(
      `确定要审核通过商户「${merchantInfo.value.merchantName}」吗？`,
      "审核确认",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );
    const res = await reviewMerchant(merchantInfo.value.id, "approve");
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
const handleBan = async () => {
  if (!merchantInfo.value) return;
  try {
    const { value: remark } = await ElMessageBox.prompt(
      `确定要封禁商户「${merchantInfo.value.merchantName}」吗？`,
      "封禁确认",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        inputPlaceholder: "请输入封禁原因（可选）",
        type: "warning"
      }
    );
    const res = await updateMerchantStatus(merchantInfo.value.id, "2");
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
const handleUnban = async () => {
  if (!merchantInfo.value) return;
  try {
    await ElMessageBox.confirm(
      `确定要解封商户「${merchantInfo.value.merchantName}」吗？`,
      "解封确认",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );
    const res = await updateMerchantStatus(merchantInfo.value.id, "1");
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

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div class="merchant-detail" v-loading="loading">
    <!-- 顶部操作栏 -->
    <el-card shadow="never" class="header-card">
      <div class="header-content">
        <el-button :icon="Back" @click="handleBack">返回列表</el-button>
        <div class="actions" v-if="merchantInfo">
          <el-button
            v-if="canApprove"
            type="success"
            :icon="Check"
            @click="handleApprove"
          >
            审核通过
          </el-button>
          <el-button
            v-if="canBan"
            type="danger"
            :icon="Close"
            @click="handleBan"
          >
            封禁商户
          </el-button>
          <el-button
            v-if="canUnban"
            type="warning"
            @click="handleUnban"
          >
            解封商户
          </el-button>
        </div>
      </div>
    </el-card>

    <template v-if="merchantInfo">
      <!-- 商户基本信息 -->
      <el-card shadow="never" class="info-card">
        <template #header>
          <div class="card-header">
            <span class="title">商户信息</span>
            <el-tag :type="getStatusType(merchantInfo.status)" size="large">
              {{ formatStatus(merchantInfo.status) }}
            </el-tag>
          </div>
        </template>
        <el-descriptions :column="3" border>
          <el-descriptions-item label="商户编号">
            {{ merchantInfo.merchantNo || merchantInfo.id }}
          </el-descriptions-item>
          <el-descriptions-item label="商户名称">
            {{ merchantInfo.merchantName }}
          </el-descriptions-item>
          <el-descriptions-item label="商户简称">
            {{ merchantInfo.shortName || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="联系人">
            {{ merchantInfo.contactName || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="联系电话">
            {{ merchantInfo.contactPhone || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="邮箱">
            {{ merchantInfo.contactEmail || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="商品数">
            <span class="count-value">{{ merchantInfo.productCount || 0 }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="订单数">
            <span class="count-value">{{ merchantInfo.orderCount || 0 }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="评分">
            <span class="count-value">{{ merchantInfo.rating || 5.00 }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="销售总额">
            <span class="price-value">¥{{ (merchantInfo.totalSales || 0).toFixed(2) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ merchantInfo.createTime }}
          </el-descriptions-item>
          <el-descriptions-item label="更新时间">
            {{ merchantInfo.updateTime || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="地址" :span="3">
            {{ merchantInfo.address || "-" }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 营业执照信息 -->
      <el-card shadow="never" class="info-card">
        <template #header>
          <span class="title">营业执照信息</span>
        </template>
        <el-descriptions :column="3" border>
          <el-descriptions-item label="营业执照号">
            {{ merchantInfo.licenseNo || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="法人代表">
            {{ merchantInfo.legalPerson || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="公司类型">
            {{ merchantInfo.companyType || "-" }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 营业执照图片 -->
        <div class="license-image-wrapper" v-if="merchantInfo.licenseImage">
          <div class="image-title">营业执照图片</div>
          <el-image
            :src="merchantInfo.licenseImage"
            :preview-src-list="[merchantInfo.licenseImage]"
            fit="contain"
            class="license-image"
            preview-teleported
          />
        </div>
      </el-card>

      <!-- 备注信息 -->
      <el-card shadow="never" class="info-card" v-if="merchantInfo.remarks">
        <template #header>
          <span class="title">备注信息</span>
        </template>
        <div class="remarks-content">
          {{ merchantInfo.remarks }}
        </div>
      </el-card>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.merchant-detail {
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
  }

  .count-value {
    font-family: "SF Mono", "Monaco", "Consolas", monospace;
    font-weight: 600;
    color: #409eff;
    font-size: 16px;
  }

  .price-value {
    font-family: "SF Mono", "Monaco", "Consolas", monospace;
    font-weight: 600;
    color: #f56c6c;
    font-size: 16px;
  }

  .license-image-wrapper {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #ebeef5;

    .image-title {
      font-size: 14px;
      color: #606266;
      margin-bottom: 12px;
      font-weight: 500;
    }

    .license-image {
      max-width: 400px;
      max-height: 300px;
      border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    }
  }

  .remarks-content {
    padding: 12px;
    background: #f5f7fa;
    border-radius: 4px;
    color: #606266;
    line-height: 1.6;
  }
}
</style>
