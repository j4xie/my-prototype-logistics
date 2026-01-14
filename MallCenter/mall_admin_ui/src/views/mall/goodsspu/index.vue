<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ElMessageBox } from "element-plus";
import { Search, Refresh, Plus, Edit, Delete } from "@element-plus/icons-vue";
import { message } from "@/utils/message";
import {
  getGoodsSpuPage,
  deleteGoodsSpu,
  publishGoodsSpu,
  unpublishGoodsSpu
} from "@/api/mall/goodsSpu";
import type { GoodsSpu, GoodsSpuQuery } from "@/api/mall/types/goodsSpu";
import MerchantSelect from "@/components/MerchantSelect/index.vue";

defineOptions({
  name: "GoodsSpuIndex"
});

const router = useRouter();

// 加载状态
const loading = ref(false);

// 商品列表
const tableData = ref<GoodsSpu[]>([]);

// 分页信息
const pagination = reactive({
  current: 1,
  size: 10,
  total: 0
});

// 查询参数
const queryParams = reactive<GoodsSpuQuery>({
  name: "",
  categoryId: "",
  status: undefined,
  merchantId: undefined
});

// 获取商品列表
const fetchData = async () => {
  loading.value = true;
  try {
    const res = await getGoodsSpuPage({
      ...queryParams,
      current: pagination.current,
      size: pagination.size
    });
    if (res.code === 200) {
      tableData.value = res.data.records;
      pagination.total = res.data.total;
    } else {
      message(res.msg || "获取商品列表失败", { type: "error" });
    }
  } catch (error) {
    message("获取商品列表失败", { type: "error" });
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
  queryParams.name = "";
  queryParams.categoryId = "";
  queryParams.status = undefined;
  queryParams.merchantId = undefined;
  pagination.current = 1;
  fetchData();
};

// 新增商品
const handleAdd = () => {
  router.push("/mall/merchant/goods/form");
};

// 编辑商品
const handleEdit = (row: GoodsSpu) => {
  router.push(`/mall/merchant/goods/form/${row.id}`);
};

// 删除商品
const handleDelete = async (row: GoodsSpu) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除商品「${row.name}」吗？`,
      "删除确认",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );
    const res = await deleteGoodsSpu(row.id);
    if (res.code === 200) {
      message("删除成功", { type: "success" });
      fetchData();
    } else {
      message(res.msg || "删除失败", { type: "error" });
    }
  } catch (error) {
    if (error !== "cancel") {
      message("删除失败", { type: "error" });
    }
  }
};

// 上架/下架商品
const handleToggleStatus = async (row: GoodsSpu) => {
  const isPublish = row.shelf === "0";
  const action = isPublish ? "上架" : "下架";
  try {
    await ElMessageBox.confirm(
      `确定要${action}商品「${row.name}」吗？`,
      `${action}确认`,
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );
    const res = isPublish
      ? await publishGoodsSpu(row.id)
      : await unpublishGoodsSpu(row.id);
    if (res.code === 200) {
      message(`${action}成功`, { type: "success" });
      fetchData();
    } else {
      message(res.msg || `${action}失败`, { type: "error" });
    }
  } catch (error) {
    if (error !== "cancel") {
      message(`${action}失败`, { type: "error" });
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

// 格式化价格（后端已经是元为单位）
const formatPrice = (price: number) => {
  if (!price && price !== 0) return "-";
  return `¥${price.toFixed(2)}`;
};

// 格式化状态
const formatStatus = (status: string) => {
  return status === "1" ? "上架中" : "已下架";
};

// 解析图片URL（处理后端返回的逗号分隔字符串格式）
const parsePicUrls = (picUrls: string[] | null | undefined): string[] => {
  if (!picUrls || picUrls.length === 0) return [];
  // 后端返回格式可能是 ["url1,url2,url3"] 或 ["url1", "url2", "url3"]
  const result: string[] = [];
  for (const url of picUrls) {
    if (url && url.includes(",")) {
      result.push(...url.split(",").map(u => u.trim()).filter(u => u));
    } else if (url) {
      result.push(url);
    }
  }
  return result;
};

// 获取状态类型
const getStatusType = (status: string) => {
  return status === "1" ? "success" : "info";
};

// 格式化 ID（显示前8位 + ...）
const formatId = (id: string | undefined) => {
  if (!id) return "-";
  if (id.length <= 8) return id;
  return id.substring(0, 8) + "...";
};

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div class="goods-spu-index">
    <!-- 搜索区域 -->
    <el-card shadow="never" class="search-card">
      <el-form :model="queryParams" :inline="true">
        <el-form-item label="所属商户">
          <MerchantSelect
            v-model="queryParams.merchantId"
            :show-all="true"
            all-label="全部商户"
            placeholder="请选择商户"
            @change="handleSearch"
          />
        </el-form-item>
        <el-form-item label="商品名称">
          <el-input
            v-model="queryParams.name"
            placeholder="请输入商品名称"
            clearable
            style="width: 200px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="商品状态">
          <el-select
            v-model="queryParams.status"
            placeholder="请选择状态"
            clearable
            style="width: 150px"
          >
            <el-option label="上架中" value="1" />
            <el-option label="已下架" value="0" />
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
          <span class="title">商品列表</span>
          <el-button type="primary" :icon="Plus" @click="handleAdd">
            新增商品
          </el-button>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" stripe border>
        <el-table-column label="ID" width="110">
          <template #default="{ row }">
            <el-tooltip :content="row.id" placement="top" :show-after="300">
              <span class="id-cell">{{ formatId(row.id) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="商品图片" width="90" align="center">
          <template #default="{ row }">
            <el-image
              v-if="parsePicUrls(row.picUrls).length > 0"
              :src="parsePicUrls(row.picUrls)[0]"
              :preview-src-list="parsePicUrls(row.picUrls)"
              fit="cover"
              class="goods-image"
              preview-teleported
            />
            <span v-else class="no-image">暂无图片</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="商品名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="categoryName" label="分类" width="100" show-overflow-tooltip />
        <el-table-column label="价格" width="140" align="right">
          <template #default="{ row }">
            <div class="price-wrapper">
              <span class="price">{{ formatPrice(row.salesPrice) }}</span>
              <del v-if="row.marketPrice && row.marketPrice > row.salesPrice" class="market-price">
                {{ formatPrice(row.marketPrice) }}
              </del>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="stock" label="库存" width="80" align="center" />
        <el-table-column prop="sort" label="排序" width="70" align="center" />
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.shelf)" size="small">
              {{ formatStatus(row.shelf) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="170" />
        <el-table-column label="操作" width="180" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link :icon="Edit" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button
              :type="row.shelf === '0' ? 'success' : 'warning'"
              link
              @click="handleToggleStatus(row)"
            >
              {{ row.shelf === "0" ? "上架" : "下架" }}
            </el-button>
            <el-button type="danger" link :icon="Delete" @click="handleDelete(row)">
              删除
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
.goods-spu-index {
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

  .goods-image {
    width: 50px;
    height: 50px;
    border-radius: 6px;
    object-fit: cover;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s;

    &:hover {
      transform: scale(1.05);
    }
  }

  .no-image {
    color: #c0c4cc;
    font-size: 12px;
    display: inline-block;
    padding: 15px 0;
  }

  .price-wrapper {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    line-height: 1.4;
  }

  .price {
    color: #f56c6c;
    font-weight: 600;
    font-size: 14px;
  }

  .market-price {
    color: #c0c4cc;
    font-size: 12px;
    text-decoration: line-through;
  }

  .pagination-wrapper {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
  }
}
</style>
