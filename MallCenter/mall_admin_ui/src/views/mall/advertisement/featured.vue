<!--
  精选商品推荐页
-->
<template>
  <div class="app-container featured-products">
    <el-row :gutter="20">
      <!-- 左侧：已选商品 -->
      <el-col :span="12">
        <el-card class="box-card">
          <template #header>
            <div class="card-header">
              <span>精选商品列表 ({{ selectedProducts.length }})</span>
              <el-button type="primary" size="small" @click="handleSave" :loading="saving">
                保存排序
              </el-button>
            </div>
          </template>

          <div class="product-list" v-loading="loading">
            <draggable
              v-model="selectedProducts"
              item-key="id"
              handle=".drag-handle"
              animation="200"
              class="drag-list"
            >
              <template #item="{ element, index }">
                <div class="product-item">
                  <div class="drag-handle">
                    <el-icon><Rank /></el-icon>
                  </div>
                  <div class="rank-number">{{ index + 1 }}</div>
                  <el-image
                    :src="element.picUrl"
                    fit="cover"
                    class="product-image"
                  >
                    <template #error>
                      <div class="image-placeholder">
                        <el-icon><Picture /></el-icon>
                      </div>
                    </template>
                  </el-image>
                  <div class="product-info">
                    <div class="product-name">{{ element.name }}</div>
                    <div class="product-price">¥{{ element.price }}</div>
                  </div>
                  <div class="product-actions">
                    <el-button type="danger" link size="small" @click="removeProduct(index)">
                      移除
                    </el-button>
                  </div>
                </div>
              </template>
            </draggable>

            <el-empty v-if="selectedProducts.length === 0" description="暂无精选商品，请从右侧添加" />
          </div>
        </el-card>
      </el-col>

      <!-- 右侧：商品选择 -->
      <el-col :span="12">
        <el-card class="box-card">
          <template #header>
            <span>选择商品</span>
          </template>

          <!-- 搜索 -->
          <el-form :inline="true" class="search-form">
            <el-form-item>
              <el-input
                v-model="searchKeyword"
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
            </el-form-item>
            <el-form-item>
              <el-select v-model="searchCategory" placeholder="选择分类" clearable @change="searchProducts">
                <el-option
                  v-for="cat in categories"
                  :key="cat.id"
                  :label="cat.name"
                  :value="cat.id"
                />
              </el-select>
            </el-form-item>
          </el-form>

          <!-- 商品列表 -->
          <div class="available-products" v-loading="searchLoading">
            <div
              class="available-item"
              v-for="product in availableProducts"
              :key="product.id"
              :class="{ selected: isSelected(product.id) }"
              @click="toggleProduct(product)"
            >
              <el-image :src="product.picUrl" fit="cover" class="item-image">
                <template #error>
                  <div class="image-placeholder">
                    <el-icon><Picture /></el-icon>
                  </div>
                </template>
              </el-image>
              <div class="item-info">
                <div class="item-name">{{ product.name }}</div>
                <div class="item-meta">
                  <span class="item-price">¥{{ product.price }}</span>
                  <span class="item-sales">销量 {{ product.salesCount || 0 }}</span>
                </div>
              </div>
              <div class="item-check">
                <el-icon v-if="isSelected(product.id)" color="#67c23a"><CircleCheck /></el-icon>
              </div>
            </div>

            <el-empty v-if="availableProducts.length === 0 && !searchLoading" description="暂无商品" />
          </div>

          <!-- 分页 -->
          <div class="pagination-wrap">
            <el-pagination
              v-model:current-page="pageNum"
              v-model:page-size="pageSize"
              :total="totalProducts"
              layout="prev, pager, next"
              small
              @current-change="searchProducts"
            />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup name="FeaturedProducts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Picture, Rank, CircleCheck } from '@element-plus/icons-vue'
import draggable from 'vuedraggable'
import { getPage as getProducts } from '@/api/mall/goodsspu'
import { getPage as getCategories } from '@/api/mall/goodscategory'

// 状态
const loading = ref(false)
const saving = ref(false)
const searchLoading = ref(false)

// 已选精选商品
const selectedProducts = ref([])

// 可选商品列表
const availableProducts = ref([])
const totalProducts = ref(0)
const pageNum = ref(1)
const pageSize = ref(10)

// 搜索条件
const searchKeyword = ref('')
const searchCategory = ref('')
const categories = ref([])

// 判断是否已选
const isSelected = (productId) => {
  return selectedProducts.value.some(p => p.id === productId)
}

// 加载精选商品
const loadFeaturedProducts = async () => {
  loading.value = true
  try {
    // TODO: 调用获取精选商品API
    // const res = await getFeaturedProducts()
    // selectedProducts.value = res.data || []

    // 模拟数据
    const res = await getProducts({ featured: 1, current: 1, size: 20 })
    selectedProducts.value = (res.data?.records || []).slice(0, 5)
  } catch (error) {
    console.error('加载精选商品失败:', error)
  } finally {
    loading.value = false
  }
}

// 搜索商品
const searchProducts = async () => {
  searchLoading.value = true
  try {
    const params = {
      current: pageNum.value,
      size: pageSize.value,
      status: 1 // 只显示上架商品
    }
    if (searchKeyword.value) {
      params.name = searchKeyword.value
    }
    if (searchCategory.value) {
      params.categoryId = searchCategory.value
    }

    const res = await getProducts(params)
    availableProducts.value = res.data?.records || []
    totalProducts.value = res.data?.total || 0
  } catch (error) {
    console.error('搜索商品失败:', error)
  } finally {
    searchLoading.value = false
  }
}

// 加载分类
const loadCategories = async () => {
  try {
    const res = await getCategories({ current: 1, size: 100 })
    categories.value = res.data?.records || []
  } catch (error) {
    console.error('加载分类失败:', error)
  }
}

// 切换商品选择
const toggleProduct = (product) => {
  const index = selectedProducts.value.findIndex(p => p.id === product.id)
  if (index > -1) {
    selectedProducts.value.splice(index, 1)
  } else {
    if (selectedProducts.value.length >= 20) {
      ElMessage.warning('最多只能添加20个精选商品')
      return
    }
    selectedProducts.value.push({ ...product })
  }
}

// 移除商品
const removeProduct = (index) => {
  selectedProducts.value.splice(index, 1)
}

// 保存排序
const handleSave = async () => {
  saving.value = true
  try {
    // TODO: 调用保存精选商品API
    // await saveFeaturedProducts(selectedProducts.value.map((p, i) => ({
    //   productId: p.id,
    //   sort: i + 1
    // })))

    await new Promise(resolve => setTimeout(resolve, 500))
    ElMessage.success('保存成功')
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

// 初始化
onMounted(() => {
  loadFeaturedProducts()
  searchProducts()
  loadCategories()
})
</script>

<style lang="scss" scoped>
.featured-products {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .product-list {
    min-height: 400px;
  }

  .drag-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .product-item {
    display: flex;
    align-items: center;
    padding: 12px;
    background: #f5f7fa;
    border-radius: 8px;
    gap: 12px;

    &:hover {
      background: #eef1f6;
    }

    .drag-handle {
      cursor: move;
      color: #909399;
      padding: 8px;

      &:hover {
        color: #409eff;
      }
    }

    .rank-number {
      width: 24px;
      height: 24px;
      background: #409eff;
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
    }

    .product-image {
      width: 60px;
      height: 60px;
      border-radius: 4px;
      flex-shrink: 0;
    }

    .product-info {
      flex: 1;

      .product-name {
        font-size: 14px;
        color: #303133;
        margin-bottom: 4px;
      }

      .product-price {
        font-size: 14px;
        color: #f56c6c;
        font-weight: bold;
      }
    }
  }

  .search-form {
    margin-bottom: 15px;
  }

  .available-products {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    min-height: 300px;
  }

  .available-item {
    display: flex;
    align-items: center;
    padding: 10px;
    border: 1px solid #ebeef5;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
    gap: 10px;

    &:hover {
      border-color: #409eff;
      box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
    }

    &.selected {
      border-color: #67c23a;
      background: #f0f9eb;
    }

    .item-image {
      width: 50px;
      height: 50px;
      border-radius: 4px;
      flex-shrink: 0;
    }

    .item-info {
      flex: 1;
      min-width: 0;

      .item-name {
        font-size: 13px;
        color: #303133;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .item-meta {
        margin-top: 4px;
        font-size: 12px;

        .item-price {
          color: #f56c6c;
          margin-right: 8px;
        }

        .item-sales {
          color: #909399;
        }
      }
    }

    .item-check {
      width: 24px;
      flex-shrink: 0;
    }
  }

  .image-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f7fa;
    color: #c0c4cc;
  }

  .pagination-wrap {
    margin-top: 15px;
    display: flex;
    justify-content: center;
  }
}
</style>
