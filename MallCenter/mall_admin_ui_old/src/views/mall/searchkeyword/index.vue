<!--
  搜索关键词管理页面
  功能：查看商家搜索的无结果关键词，匹配商品，发送通知
-->
<template>
  <div class="app-container">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-cards">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon today">
              <el-icon><Search /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ overview.todayNoResult || 0 }}</div>
              <div class="stat-label">今日无结果搜索</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon pending">
              <el-icon><Clock /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ overview.pendingCount || 0 }}</div>
              <div class="stat-label">待处理关键词</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon matched">
              <el-icon><Link /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ overview.matchedCount || 0 }}</div>
              <div class="stat-label">已匹配关键词</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon notified">
              <el-icon><Bell /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ overview.notifiedCount || 0 }}</div>
              <div class="stat-label">已通知商家</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 数据表格 -->
    <avue-crud
      ref="crud"
      v-model="form"
      :page="page"
      :data="tableData"
      :table-loading="tableLoading"
      :option="tableOption"
      @on-load="getPageF"
      @refresh-change="refreshChange"
      @search-change="searchChange"
      @sort-change="sortChange"
    >
      <!-- 状态列 -->
      <template #status="scope">
        <el-tag :type="getStatusType(scope.row.status)" effect="plain" size="small">
          {{ getStatusLabel(scope.row.status) }}
        </el-tag>
      </template>

      <!-- 热门标记 -->
      <template #isHot="scope">
        <el-tag v-if="scope.row.searchCount >= 10" type="danger" effect="dark" size="small">
          热门
        </el-tag>
        <span v-else>-</span>
      </template>

      <!-- 匹配商品列 -->
      <template #matchedProductIds="scope">
        <template v-if="scope.row.matchedProductIds && scope.row.matchedProductIds.length > 0">
          <el-tag type="success" size="small">
            {{ scope.row.matchedProductIds.length }}个商品
          </el-tag>
        </template>
        <template v-else>
          <span class="text-muted">未匹配</span>
        </template>
      </template>

      <!-- 操作菜单 -->
      <template #menu="scope">
        <el-button
          type="primary"
          link
          @click="openMatchDialog(scope.row)"
        >
          <el-icon><Link /></el-icon>
          匹配商品
        </el-button>
        <el-button
          type="success"
          link
          :disabled="!scope.row.matchedProductIds || scope.row.matchedProductIds.length === 0"
          @click="openNotifyDialog(scope.row)"
        >
          <el-icon><Bell /></el-icon>
          通知商家
        </el-button>
        <el-button
          type="info"
          link
          @click="ignoreKeyword(scope.row)"
          v-if="scope.row.status === 0"
        >
          忽略
        </el-button>
      </template>
    </avue-crud>

    <!-- 匹配商品弹窗 -->
    <el-dialog
      v-model="matchDialogVisible"
      title="匹配商品"
      width="70%"
      destroy-on-close
    >
      <div class="match-dialog-content">
        <div class="keyword-info">
          <span class="label">关键词：</span>
          <el-tag type="primary" size="large">{{ currentKeyword.keyword }}</el-tag>
          <span class="search-count">
            (搜索次数: {{ currentKeyword.searchCount }}, 商家数: {{ currentKeyword.uniqueMerchants }})
          </span>
        </div>

        <!-- 商品搜索 -->
        <div class="product-search">
          <el-input
            v-model="productSearchText"
            placeholder="搜索商品名称"
            clearable
            @keyup.enter="searchProducts"
          >
            <template #append>
              <el-button @click="searchProducts">
                <el-icon><Search /></el-icon>
              </el-button>
            </template>
          </el-input>
        </div>

        <!-- 商品列表 -->
        <el-table
          ref="productTable"
          :data="productList"
          v-loading="productLoading"
          @selection-change="handleProductSelect"
          height="400"
        >
          <el-table-column type="selection" width="50" />
          <el-table-column label="商品图片" width="100">
            <template #default="scope">
              <el-image
                :src="scope.row.picUrl"
                style="width: 60px; height: 60px"
                fit="cover"
              />
            </template>
          </el-table-column>
          <el-table-column prop="name" label="商品名称" />
          <el-table-column prop="salesPrice" label="价格" width="100">
            <template #default="scope">
              <span style="color: #e74c3c">¥{{ scope.row.salesPrice }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="categoryName" label="分类" width="120" />
          <el-table-column prop="stock" label="库存" width="80" />
        </el-table>

        <!-- 分页 -->
        <el-pagination
          v-model:current-page="productPage.currentPage"
          v-model:page-size="productPage.pageSize"
          :total="productPage.total"
          layout="total, prev, pager, next"
          @current-change="loadProducts"
          style="margin-top: 16px; justify-content: flex-end;"
        />
      </div>

      <template #footer>
        <el-button @click="matchDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="selectedProducts.length === 0"
          :loading="matchLoading"
          @click="confirmMatch"
        >
          确认匹配 ({{ selectedProducts.length }})
        </el-button>
      </template>
    </el-dialog>

    <!-- 发送通知弹窗 -->
    <el-dialog
      v-model="notifyDialogVisible"
      title="发送通知"
      width="500px"
    >
      <el-form label-width="100px">
        <el-form-item label="关键词">
          <el-tag type="primary">{{ currentKeyword.keyword }}</el-tag>
        </el-form-item>
        <el-form-item label="匹配商品">
          <el-tag type="success">
            {{ currentKeyword.matchedProductIds?.length || 0 }}个商品
          </el-tag>
        </el-form-item>
        <el-form-item label="待通知商家">
          <el-tag>{{ currentKeyword.uniqueMerchants }}位</el-tag>
        </el-form-item>
        <el-form-item label="通知渠道">
          <el-checkbox v-model="notifyOptions.inApp" disabled>站内消息</el-checkbox>
          <el-checkbox v-model="notifyOptions.sms">短信通知</el-checkbox>
        </el-form-item>
        <el-form-item label="短信模板" v-if="notifyOptions.sms">
          <el-select v-model="notifyOptions.templateCode" placeholder="选择短信模板">
            <el-option label="商品上架通知" value="PRODUCT_FOUND" />
            <el-option label="新品推荐通知" value="NEW_PRODUCT" />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="notifyDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="notifyLoading"
          @click="confirmNotify"
        >
          发送通知
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="SearchKeyword">
import { Search, Clock, Link, Bell } from '@element-plus/icons-vue'
import {
  getOverview,
  getStatsPage,
  matchProducts,
  notifyMerchants,
  updateStats,
  searchProducts as apiSearchProducts
} from '@/api/mall/searchkeyword'
import { tableOption } from '@/const/crud/mall/searchkeyword'

const { proxy } = getCurrentInstance()

const data = reactive({
  form: {},
  tableData: [],
  page: {
    total: 0,
    currentPage: 1,
    pageSize: 20,
    ascs: [],
    descs: 'search_count',
  },
  paramsSearch: {},
  tableLoading: false,
  overview: {
    todayNoResult: 0,
    pendingCount: 0,
    matchedCount: 0,
    notifiedCount: 0,
  },
  // 匹配商品弹窗
  matchDialogVisible: false,
  currentKeyword: {},
  productSearchText: '',
  productList: [],
  productLoading: false,
  productPage: {
    currentPage: 1,
    pageSize: 10,
    total: 0,
  },
  selectedProducts: [],
  matchLoading: false,
  // 通知弹窗
  notifyDialogVisible: false,
  notifyOptions: {
    inApp: true,
    sms: false,
    templateCode: 'PRODUCT_FOUND',
  },
  notifyLoading: false,
})

const {
  form,
  page,
  tableData,
  tableLoading,
  overview,
  matchDialogVisible,
  currentKeyword,
  productSearchText,
  productList,
  productLoading,
  productPage,
  selectedProducts,
  matchLoading,
  notifyDialogVisible,
  notifyOptions,
  notifyLoading,
} = toRefs(data)

// 状态映射
function getStatusType(status) {
  const types = {
    0: 'warning',
    1: 'success',
    2: 'primary',
    3: 'info',
  }
  return types[status] || 'info'
}

function getStatusLabel(status) {
  const labels = {
    0: '待处理',
    1: '已匹配',
    2: '已通知',
    3: '已忽略',
  }
  return labels[status] || '未知'
}

// 加载概览统计
async function loadOverview() {
  try {
    const res = await getOverview()
    if (res.code === 200) {
      data.overview = res.data || {}
    }
  } catch (error) {
    console.error('加载统计失败:', error)
  }
}

// 加载分页数据
function getPageF(page, params) {
  data.tableLoading = true
  getStatsPage(
    Object.assign(
      {
        current: page.currentPage,
        size: page.pageSize,
        descs: data.page.descs,
        ascs: data.page.ascs,
      },
      params,
      data.paramsSearch
    )
  )
    .then((response) => {
      data.tableData = response.data.records || []
      data.page.total = response.data.total
      data.page.currentPage = page.currentPage
      data.page.pageSize = page.pageSize
      data.tableLoading = false
    })
    .catch(() => {
      data.tableLoading = false
    })
}

function searchChange(params, done) {
  params = proxy.filterForm(params)
  data.paramsSearch = params
  data.page.currentPage = 1
  getPageF(data.page, params)
  done()
}

function sortChange(val) {
  let prop = val.prop ? val.prop.replace(/([A-Z])/g, '_$1').toLowerCase() : ''
  if (val.order === 'ascending') {
    data.page.descs = []
    data.page.ascs = prop
  } else if (val.order === 'descending') {
    data.page.ascs = []
    data.page.descs = prop
  } else {
    data.page.ascs = []
    data.page.descs = 'search_count'
  }
  getPageF(data.page)
}

function refreshChange() {
  loadOverview()
  getPageF(data.page)
}

// 打开匹配商品弹窗
function openMatchDialog(row) {
  data.currentKeyword = row
  data.matchDialogVisible = true
  data.productSearchText = row.keyword
  data.selectedProducts = []
  loadProducts()
}

// 搜索商品
function searchProducts() {
  data.productPage.currentPage = 1
  loadProducts()
}

// 加载商品列表
async function loadProducts() {
  data.productLoading = true
  try {
    const res = await apiSearchProducts({
      current: data.productPage.currentPage,
      size: data.productPage.pageSize,
      name: data.productSearchText,
    })
    if (res.code === 200) {
      data.productList = res.data.records || []
      data.productPage.total = res.data.total
    }
  } catch (error) {
    console.error('加载商品失败:', error)
  } finally {
    data.productLoading = false
  }
}

// 商品选择变化
function handleProductSelect(selection) {
  data.selectedProducts = selection
}

// 确认匹配
async function confirmMatch() {
  if (data.selectedProducts.length === 0) {
    proxy.$message.warning('请选择要匹配的商品')
    return
  }

  data.matchLoading = true
  try {
    const productIds = data.selectedProducts.map(p => p.id)
    const res = await matchProducts(data.currentKeyword.id, productIds)
    if (res.code === 200) {
      proxy.$message.success('匹配成功')
      data.matchDialogVisible = false
      loadOverview()
      getPageF(data.page)
    }
  } catch (error) {
    console.error('匹配失败:', error)
  } finally {
    data.matchLoading = false
  }
}

// 打开通知弹窗
function openNotifyDialog(row) {
  data.currentKeyword = row
  data.notifyDialogVisible = true
  data.notifyOptions = {
    inApp: true,
    sms: false,
    templateCode: 'PRODUCT_FOUND',
  }
}

// 确认发送通知
async function confirmNotify() {
  data.notifyLoading = true
  try {
    const res = await notifyMerchants(
      data.currentKeyword.id,
      data.notifyOptions.sms,
      data.notifyOptions.templateCode
    )
    if (res.code === 200) {
      const result = res.data || {}
      proxy.$message.success(
        `通知发送成功: 站内${result.inAppSent || 0}条, 短信${result.smsSent || 0}条`
      )
      data.notifyDialogVisible = false
      loadOverview()
      getPageF(data.page)
    }
  } catch (error) {
    console.error('发送通知失败:', error)
  } finally {
    data.notifyLoading = false
  }
}

// 忽略关键词
async function ignoreKeyword(row) {
  try {
    await proxy.$confirm('确定要忽略该关键词吗？', '提示', {
      type: 'warning',
    })
    const res = await updateStats(row.id, { status: 3 })
    if (res.code === 200) {
      proxy.$message.success('已忽略')
      loadOverview()
      getPageF(data.page)
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('操作失败:', error)
    }
  }
}

// 初始化
onMounted(() => {
  loadOverview()
})
</script>

<style lang="scss" scoped>
.stats-cards {
  margin-bottom: 20px;

  .stat-card {
    .stat-content {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .stat-icon {
      width: 60px;
      height: 60px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      color: #fff;

      &.today {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }
      &.pending {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      }
      &.matched {
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
      }
      &.notified {
        background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
      }
    }

    .stat-info {
      .stat-value {
        font-size: 28px;
        font-weight: bold;
        color: #333;
      }
      .stat-label {
        font-size: 14px;
        color: #999;
        margin-top: 4px;
      }
    }
  }
}

.match-dialog-content {
  .keyword-info {
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 12px;

    .label {
      font-weight: 500;
    }
    .search-count {
      color: #999;
      font-size: 14px;
    }
  }

  .product-search {
    margin-bottom: 16px;
  }
}

.text-muted {
  color: #999;
}

// 去掉 ruoyi 的样式
.avue-crud :deep(.el-card__body) {
  padding: 0 !important;
}
</style>
