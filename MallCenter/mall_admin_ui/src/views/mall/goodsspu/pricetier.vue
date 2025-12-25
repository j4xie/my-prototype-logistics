<!--
  商品阶梯定价配置页面
-->
<template>
  <div class="app-container price-tier-config">
    <!-- 页面头部 -->
    <div class="page-header">
      <el-page-header @back="goBack" title="返回">
        <template #content>
          <span class="page-title">阶梯定价配置</span>
        </template>
      </el-page-header>
    </div>

    <!-- 商品信息卡片 -->
    <el-card class="product-info-card" v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>商品信息</span>
        </div>
      </template>
      <el-descriptions :column="3" border v-if="productInfo">
        <el-descriptions-item label="商品名称">
          {{ productInfo.name }}
        </el-descriptions-item>
        <el-descriptions-item label="商品编码">
          {{ productInfo.spuCode || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="上架状态">
          <el-tag :type="productInfo.shelf === '1' ? 'success' : 'info'">
            {{ productInfo.shelf === '1' ? '已上架' : '未上架' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="销售价">
          <span class="price-value">¥{{ productInfo.salesPrice }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="库存">
          {{ productInfo.stock }}
        </el-descriptions-item>
        <el-descriptions-item label="已售">
          {{ productInfo.saleNum }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- 阶梯定价配置 -->
    <el-card class="tier-config-card">
      <template #header>
        <div class="card-header">
          <span>阶梯定价配置</span>
          <el-switch
            v-model="enablePriceTier"
            active-text="启用"
            inactive-text="禁用"
          />
        </div>
      </template>

      <el-alert
        v-if="!enablePriceTier"
        title="阶梯定价未启用"
        type="info"
        description="启用阶梯定价后，可以设置不同购买数量对应的优惠价格，购买越多越便宜。"
        :closable="false"
        show-icon
      />

      <div v-else>
        <el-alert
          title="阶梯定价说明"
          type="success"
          description="设置批发价格梯度，每个阶梯对应一个价格。系统会根据购买数量自动匹配最优惠的价格。"
          :closable="false"
          show-icon
          style="margin-bottom: 20px"
        />

        <el-table :data="priceTiers" border style="width: 100%">
          <el-table-column label="阶梯" width="80" align="center">
            <template #default="{ $index }">
              <el-tag>{{ $index + 1 }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="最小数量" width="160">
            <template #default="{ row, $index }">
              <el-input-number
                v-model="row.minQuantity"
                :min="$index === 0 ? 1 : priceTiers[$index - 1].minQuantity + 1"
                controls-position="right"
                style="width: 100%"
              />
            </template>
          </el-table-column>
          <el-table-column label="最大数量" width="160">
            <template #default="{ row, $index }">
              <el-input-number
                v-model="row.maxQuantity"
                :min="row.minQuantity"
                :disabled="$index === priceTiers.length - 1"
                controls-position="right"
                style="width: 100%"
                :placeholder="$index === priceTiers.length - 1 ? '无上限' : ''"
              />
            </template>
          </el-table-column>
          <el-table-column label="阶梯价格" width="160">
            <template #default="{ row }">
              <el-input-number
                v-model="row.price"
                :precision="2"
                :min="0"
                controls-position="right"
                style="width: 100%"
              />
            </template>
          </el-table-column>
          <el-table-column label="折扣率" width="120" align="center">
            <template #default="{ row }">
              <span v-if="productInfo && productInfo.salesPrice > 0" class="discount-rate">
                {{ ((row.price / productInfo.salesPrice) * 100).toFixed(1) }}%
              </span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="节省金额" width="120" align="center">
            <template #default="{ row }">
              <span v-if="productInfo && productInfo.salesPrice > 0" class="save-amount">
                ¥{{ (productInfo.salesPrice - row.price).toFixed(2) }}
              </span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" align="center">
            <template #default="{ $index }">
              <el-button
                type="danger"
                size="small"
                :icon="Delete"
                circle
                @click="removePriceTier($index)"
                :disabled="priceTiers.length <= 1"
              />
            </template>
          </el-table-column>
        </el-table>

        <div class="tier-actions">
          <el-button type="primary" :icon="Plus" @click="addPriceTier">
            添加阶梯
          </el-button>
          <el-button type="info" @click="resetToDefault">
            恢复默认
          </el-button>
        </div>

        <!-- 价格预览 -->
        <el-card class="preview-card" shadow="never">
          <template #header>
            <span>价格预览</span>
          </template>
          <div class="price-preview-list">
            <div
              v-for="(tier, index) in priceTiers"
              :key="index"
              class="preview-item"
            >
              <div class="quantity-range">
                购买 {{ tier.minQuantity }}
                <span v-if="tier.maxQuantity">- {{ tier.maxQuantity }}</span>
                <span v-else>+</span>
                件
              </div>
              <div class="tier-price">¥{{ tier.price.toFixed(2) }}/件</div>
            </div>
          </div>
        </el-card>
      </div>
    </el-card>

    <!-- 底部操作栏 -->
    <div class="footer-actions">
      <el-button @click="goBack">取消</el-button>
      <el-button type="primary" @click="savePriceTiers" :loading="saving">
        保存配置
      </el-button>
    </div>
  </div>
</template>

<script setup name="GoodsSpuPriceTier">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete } from '@element-plus/icons-vue'
import { getObj } from '@/api/mall/goodsspu'
import { listBySpuId, saveTiers, deleteBySpuId } from '@/api/mall/goodspricetier'

const router = useRouter()
const route = useRoute()

// 商品ID
const spuId = ref(null)

// 响应式数据
const loading = ref(false)
const saving = ref(false)
const productInfo = ref(null)
const enablePriceTier = ref(false)

// 阶梯定价数据
const priceTiers = ref([
  { minQuantity: 10, maxQuantity: 49, price: 0, sortOrder: 1 },
  { minQuantity: 50, maxQuantity: 99, price: 0, sortOrder: 2 },
  { minQuantity: 100, maxQuantity: null, price: 0, sortOrder: 3 }
])

// 默认阶梯配置
const defaultTiers = [
  { minQuantity: 10, maxQuantity: 49, price: 0, sortOrder: 1 },
  { minQuantity: 50, maxQuantity: 99, price: 0, sortOrder: 2 },
  { minQuantity: 100, maxQuantity: null, price: 0, sortOrder: 3 }
]

// 加载商品信息
const loadProductInfo = async () => {
  if (!spuId.value) return

  loading.value = true
  try {
    const res = await getObj(spuId.value)
    productInfo.value = res.data || res

    // 自动设置默认价格为销售价的折扣
    if (productInfo.value.salesPrice) {
      const basePrice = productInfo.value.salesPrice
      priceTiers.value = [
        { minQuantity: 10, maxQuantity: 49, price: (basePrice * 0.95).toFixed(2) * 1, sortOrder: 1 },
        { minQuantity: 50, maxQuantity: 99, price: (basePrice * 0.90).toFixed(2) * 1, sortOrder: 2 },
        { minQuantity: 100, maxQuantity: null, price: (basePrice * 0.85).toFixed(2) * 1, sortOrder: 3 }
      ]
    }
  } catch (error) {
    console.error('加载商品信息失败:', error)
    ElMessage.error('加载商品信息失败')
  } finally {
    loading.value = false
  }
}

// 加载阶梯定价数据
const loadPriceTiers = async () => {
  try {
    const res = await listBySpuId(spuId.value)
    const tiers = res.data || res || []

    if (tiers.length > 0) {
      enablePriceTier.value = true
      priceTiers.value = tiers.map((tier, index) => ({
        id: tier.id,
        minQuantity: tier.minQuantity,
        maxQuantity: tier.maxQuantity,
        price: tier.price,
        sortOrder: tier.sortOrder || index + 1
      }))
    }
  } catch (error) {
    console.error('加载阶梯定价失败:', error)
  }
}

// 返回列表
const goBack = () => {
  router.push('/mall/goodsspu')
}

// 添加阶梯
const addPriceTier = () => {
  const lastTier = priceTiers.value[priceTiers.value.length - 1]
  priceTiers.value.push({
    minQuantity: (lastTier.maxQuantity || lastTier.minQuantity) + 1,
    maxQuantity: null,
    price: lastTier.price * 0.95, // 默认比上一阶梯便宜5%
    sortOrder: priceTiers.value.length + 1
  })
  // 更新上一个阶梯的最大数量
  if (priceTiers.value.length > 1) {
    priceTiers.value[priceTiers.value.length - 2].maxQuantity =
      priceTiers.value[priceTiers.value.length - 1].minQuantity - 1
  }
}

// 删除阶梯
const removePriceTier = (index) => {
  if (priceTiers.value.length > 1) {
    priceTiers.value.splice(index, 1)
    // 重新计算排序
    priceTiers.value.forEach((tier, i) => {
      tier.sortOrder = i + 1
    })
  }
}

// 恢复默认
const resetToDefault = () => {
  ElMessageBox.confirm('确定要恢复默认阶梯配置吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    if (productInfo.value && productInfo.value.salesPrice) {
      const basePrice = productInfo.value.salesPrice
      priceTiers.value = [
        { minQuantity: 10, maxQuantity: 49, price: (basePrice * 0.95).toFixed(2) * 1, sortOrder: 1 },
        { minQuantity: 50, maxQuantity: 99, price: (basePrice * 0.90).toFixed(2) * 1, sortOrder: 2 },
        { minQuantity: 100, maxQuantity: null, price: (basePrice * 0.85).toFixed(2) * 1, sortOrder: 3 }
      ]
    } else {
      priceTiers.value = [...defaultTiers]
    }
    ElMessage.success('已恢复默认配置')
  }).catch(() => {})
}

// 保存阶梯定价
const savePriceTiers = async () => {
  saving.value = true
  try {
    if (enablePriceTier.value && priceTiers.value.length > 0) {
      // 验证价格阶梯
      for (let i = 0; i < priceTiers.value.length; i++) {
        const tier = priceTiers.value[i]
        if (tier.price <= 0) {
          ElMessage.warning(`第${i + 1}个阶梯价格必须大于0`)
          saving.value = false
          return
        }
        if (i > 0 && tier.price >= priceTiers.value[i - 1].price) {
          ElMessage.warning(`第${i + 1}个阶梯价格应低于第${i}个阶梯`)
          saving.value = false
          return
        }
      }

      await saveTiers(spuId.value, priceTiers.value)
      ElMessage.success('阶梯定价保存成功')
    } else {
      // 禁用阶梯定价，删除所有配置
      await saveTiers(spuId.value, [])
      ElMessage.success('已禁用阶梯定价')
    }
    goBack()
  } catch (error) {
    console.error('保存阶梯定价失败:', error)
    ElMessage.error('保存失败，请重试')
  } finally {
    saving.value = false
  }
}

// 初始化
onMounted(async () => {
  spuId.value = route.params.id || route.query.id

  if (!spuId.value) {
    ElMessage.error('缺少商品ID参数')
    goBack()
    return
  }

  await loadProductInfo()
  await loadPriceTiers()
})
</script>

<style lang="scss" scoped>
.price-tier-config {
  .page-header {
    margin-bottom: 20px;
    .page-title {
      font-size: 18px;
      font-weight: 600;
    }
  }

  .product-info-card {
    margin-bottom: 20px;

    .price-value {
      color: #f56c6c;
      font-size: 16px;
      font-weight: 600;
    }
  }

  .tier-config-card {
    margin-bottom: 80px;

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  }

  .tier-actions {
    margin-top: 15px;
    display: flex;
    gap: 10px;
  }

  .discount-rate {
    color: #67c23a;
    font-weight: 500;
  }

  .save-amount {
    color: #f56c6c;
    font-weight: 500;
  }

  .preview-card {
    margin-top: 20px;
    background: #fafafa;

    .price-preview-list {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
    }

    .preview-item {
      padding: 15px 25px;
      background: #fff;
      border-radius: 8px;
      border: 1px solid #e4e7ed;
      text-align: center;
      min-width: 140px;

      .quantity-range {
        font-size: 14px;
        color: #606266;
        margin-bottom: 8px;
      }

      .tier-price {
        font-size: 20px;
        font-weight: 600;
        color: #f56c6c;
      }
    }
  }

  .footer-actions {
    position: fixed;
    bottom: 0;
    left: 210px;
    right: 0;
    padding: 12px 20px;
    background: #fff;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    z-index: 100;
  }
}

// 适配侧边栏收起状态
.hideSidebar .price-tier-config .footer-actions {
  left: 54px;
}
</style>
