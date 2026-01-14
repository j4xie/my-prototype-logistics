<!--
  搜索排名配置页
-->
<template>
  <div class="app-container ranking-config">
    <el-row :gutter="20">
      <!-- 排名因素配置 -->
      <el-col :span="12">
        <el-card class="box-card">
          <template #header>
            <div class="card-header">
              <span>排名因素权重</span>
              <el-button type="primary" size="small" @click="saveWeights" :loading="saving">
                保存配置
              </el-button>
            </div>
          </template>

          <div class="weight-config">
            <div class="weight-item" v-for="factor in rankingFactors" :key="factor.key">
              <div class="factor-info">
                <div class="factor-name">{{ factor.name }}</div>
                <div class="factor-desc">{{ factor.description }}</div>
              </div>
              <div class="factor-weight">
                <el-slider
                  v-model="factor.weight"
                  :min="0"
                  :max="100"
                  :step="5"
                  :format-tooltip="val => val + '%'"
                  style="width: 150px"
                />
                <el-input-number
                  v-model="factor.weight"
                  :min="0"
                  :max="100"
                  size="small"
                  controls-position="right"
                  style="width: 80px; margin-left: 10px"
                />
              </div>
            </div>

            <el-divider />

            <div class="weight-total">
              <span>权重总计：</span>
              <span :class="{ 'warning': totalWeight !== 100 }">{{ totalWeight }}%</span>
              <el-tag v-if="totalWeight === 100" type="success" size="small">正常</el-tag>
              <el-tag v-else type="warning" size="small">建议调整为100%</el-tag>
            </div>
          </div>
        </el-card>

        <!-- 排名规则 -->
        <el-card class="box-card" style="margin-top: 20px">
          <template #header>
            <span>排名规则</span>
          </template>

          <el-form label-width="140px">
            <el-form-item label="新品优先展示">
              <el-switch v-model="rules.newProductFirst" />
              <span class="form-tip">7天内上架的商品优先展示</span>
            </el-form-item>
            <el-form-item label="库存不足降权">
              <el-switch v-model="rules.lowStockPenalty" />
              <span class="form-tip">库存少于10件的商品降低排名</span>
            </el-form-item>
            <el-form-item label="差评商品降权">
              <el-switch v-model="rules.badReviewPenalty" />
              <span class="form-tip">评分低于3分的商品降低排名</span>
            </el-form-item>
            <el-form-item label="人工置顶">
              <el-switch v-model="rules.manualTop" />
              <span class="form-tip">允许手动设置商品置顶</span>
            </el-form-item>
            <el-form-item label="付费推广">
              <el-switch v-model="rules.paidPromotion" />
              <span class="form-tip">付费推广商品额外加权</span>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <!-- 置顶商品管理 -->
      <el-col :span="12">
        <el-card class="box-card">
          <template #header>
            <div class="card-header">
              <span>置顶商品管理</span>
              <el-button type="primary" size="small" @click="showAddTopDialog">
                <el-icon><Plus /></el-icon> 添加置顶
              </el-button>
            </div>
          </template>

          <div class="top-products" v-loading="topLoading">
            <draggable
              v-model="topProducts"
              item-key="id"
              handle=".drag-handle"
              animation="200"
              class="drag-list"
            >
              <template #item="{ element, index }">
                <div class="top-item">
                  <div class="drag-handle">
                    <el-icon><Rank /></el-icon>
                  </div>
                  <div class="top-rank">TOP {{ index + 1 }}</div>
                  <el-image :src="element.picUrl" fit="cover" class="top-image">
                    <template #error>
                      <div class="image-placeholder">
                        <el-icon><Picture /></el-icon>
                      </div>
                    </template>
                  </el-image>
                  <div class="top-info">
                    <div class="top-name">{{ element.name }}</div>
                    <div class="top-meta">
                      <span>关键词：{{ element.keyword || '全部' }}</span>
                      <span>有效期：{{ element.expireDate || '永久' }}</span>
                    </div>
                  </div>
                  <div class="top-actions">
                    <el-button type="danger" link size="small" @click="removeTop(index)">
                      移除
                    </el-button>
                  </div>
                </div>
              </template>
            </draggable>

            <el-empty v-if="topProducts.length === 0" description="暂无置顶商品" />
          </div>
        </el-card>

        <!-- 热门搜索词 -->
        <el-card class="box-card" style="margin-top: 20px">
          <template #header>
            <div class="card-header">
              <span>热门搜索词</span>
              <el-button type="primary" size="small" @click="showAddKeywordDialog">
                <el-icon><Plus /></el-icon> 添加
              </el-button>
            </div>
          </template>

          <div class="hot-keywords">
            <el-tag
              v-for="(keyword, index) in hotKeywords"
              :key="index"
              closable
              :type="keyword.isManual ? '' : 'info'"
              @close="removeKeyword(index)"
              class="keyword-tag"
            >
              {{ keyword.word }}
              <span class="keyword-count" v-if="keyword.searchCount">
                ({{ keyword.searchCount }})
              </span>
            </el-tag>

            <el-empty v-if="hotKeywords.length === 0" description="暂无热门搜索词" :image-size="60" />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 添加置顶对话框 -->
    <el-dialog v-model="addTopDialogVisible" title="添加置顶商品" width="500px">
      <el-form :model="topForm" label-width="100px">
        <el-form-item label="选择商品" required>
          <el-select
            v-model="topForm.productId"
            placeholder="搜索并选择商品"
            filterable
            remote
            :remote-method="searchProducts"
            style="width: 100%"
          >
            <el-option
              v-for="item in productOptions"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="topForm.keyword" placeholder="留空则全局置顶" />
          <div class="form-tip">指定关键词搜索时置顶该商品</div>
        </el-form-item>
        <el-form-item label="有效期">
          <el-date-picker
            v-model="topForm.expireDate"
            type="date"
            placeholder="留空永久有效"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addTopDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitTop">确定</el-button>
      </template>
    </el-dialog>

    <!-- 添加关键词对话框 -->
    <el-dialog v-model="addKeywordDialogVisible" title="添加热门搜索词" width="400px">
      <el-form :model="keywordForm" label-width="80px">
        <el-form-item label="关键词" required>
          <el-input v-model="keywordForm.word" placeholder="请输入关键词" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addKeywordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitKeyword">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="RankingConfig">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Rank, Picture } from '@element-plus/icons-vue'
import draggable from 'vuedraggable'
import { getPage as getProducts } from '@/api/mall/goodsspu'

// 状态
const saving = ref(false)
const topLoading = ref(false)

// 排名因素权重
const rankingFactors = ref([
  { key: 'sales', name: '销量', description: '商品销售数量越高，排名越靠前', weight: 30 },
  { key: 'rating', name: '评分', description: '商品平均评分越高，排名越靠前', weight: 20 },
  { key: 'conversion', name: '转化率', description: '浏览转购买的比率越高，排名越靠前', weight: 15 },
  { key: 'clicks', name: '点击量', description: '商品被点击次数越多，排名越靠前', weight: 15 },
  { key: 'recency', name: '上新时间', description: '新上架的商品获得额外加分', weight: 10 },
  { key: 'stock', name: '库存充足度', description: '库存充足的商品排名更靠前', weight: 10 }
])

// 权重总计
const totalWeight = computed(() => {
  return rankingFactors.value.reduce((sum, f) => sum + f.weight, 0)
})

// 排名规则
const rules = reactive({
  newProductFirst: true,
  lowStockPenalty: true,
  badReviewPenalty: true,
  manualTop: true,
  paidPromotion: false
})

// 置顶商品
const topProducts = ref([])

// 热门搜索词
const hotKeywords = ref([
  { word: '有机蔬菜', searchCount: 1234, isManual: true },
  { word: '新鲜水果', searchCount: 987, isManual: false },
  { word: '牛肉', searchCount: 856, isManual: true },
  { word: '海鲜', searchCount: 654, isManual: false }
])

// 添加置顶对话框
const addTopDialogVisible = ref(false)
const topForm = reactive({
  productId: null,
  keyword: '',
  expireDate: ''
})
const productOptions = ref([])

// 添加关键词对话框
const addKeywordDialogVisible = ref(false)
const keywordForm = reactive({
  word: ''
})

// 保存权重配置
const saveWeights = async () => {
  saving.value = true
  try {
    // TODO: 调用保存API
    await new Promise(resolve => setTimeout(resolve, 500))
    ElMessage.success('配置保存成功')
  } catch (error) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

// 搜索商品
const searchProducts = async (query) => {
  if (!query) return
  try {
    const res = await getProducts({ name: query, current: 1, size: 20 })
    productOptions.value = (res.data?.records || []).map(item => ({
      id: item.id,
      name: item.name,
      picUrl: item.picUrl,
      price: item.price
    }))
  } catch (error) {
    console.error('搜索商品失败:', error)
  }
}

// 显示添加置顶对话框
const showAddTopDialog = () => {
  topForm.productId = null
  topForm.keyword = ''
  topForm.expireDate = ''
  addTopDialogVisible.value = true
}

// 提交置顶
const submitTop = () => {
  if (!topForm.productId) {
    ElMessage.warning('请选择商品')
    return
  }

  const product = productOptions.value.find(p => p.id === topForm.productId)
  if (product) {
    topProducts.value.push({
      ...product,
      keyword: topForm.keyword,
      expireDate: topForm.expireDate
    })
  }
  addTopDialogVisible.value = false
  ElMessage.success('添加成功')
}

// 移除置顶
const removeTop = (index) => {
  topProducts.value.splice(index, 1)
}

// 显示添加关键词对话框
const showAddKeywordDialog = () => {
  keywordForm.word = ''
  addKeywordDialogVisible.value = true
}

// 提交关键词
const submitKeyword = () => {
  if (!keywordForm.word.trim()) {
    ElMessage.warning('请输入关键词')
    return
  }

  hotKeywords.value.unshift({
    word: keywordForm.word.trim(),
    searchCount: 0,
    isManual: true
  })
  addKeywordDialogVisible.value = false
  ElMessage.success('添加成功')
}

// 移除关键词
const removeKeyword = (index) => {
  hotKeywords.value.splice(index, 1)
}

// 加载置顶商品
const loadTopProducts = async () => {
  topLoading.value = true
  try {
    // TODO: 调用获取置顶商品API
    // 模拟数据
    const res = await getProducts({ current: 1, size: 3 })
    topProducts.value = (res.data?.records || []).slice(0, 3).map(p => ({
      ...p,
      keyword: '',
      expireDate: ''
    }))
  } catch (error) {
    console.error('加载置顶商品失败:', error)
  } finally {
    topLoading.value = false
  }
}

// 初始化
onMounted(() => {
  loadTopProducts()
})
</script>

<style lang="scss" scoped>
.ranking-config {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .weight-config {
    .weight-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 15px 0;
      border-bottom: 1px solid #ebeef5;

      &:last-child {
        border-bottom: none;
      }

      .factor-info {
        .factor-name {
          font-size: 14px;
          color: #303133;
          margin-bottom: 4px;
        }

        .factor-desc {
          font-size: 12px;
          color: #909399;
        }
      }

      .factor-weight {
        display: flex;
        align-items: center;
      }
    }

    .weight-total {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;

      .warning {
        color: #e6a23c;
      }
    }
  }

  .form-tip {
    font-size: 12px;
    color: #909399;
    margin-left: 10px;
  }

  .drag-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .top-item {
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

    .top-rank {
      background: linear-gradient(135deg, #ff9a44 0%, #fc6076 100%);
      color: #fff;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    }

    .top-image {
      width: 50px;
      height: 50px;
      border-radius: 4px;
      flex-shrink: 0;
    }

    .top-info {
      flex: 1;

      .top-name {
        font-size: 14px;
        color: #303133;
        margin-bottom: 4px;
      }

      .top-meta {
        font-size: 12px;
        color: #909399;

        span {
          margin-right: 15px;
        }
      }
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

  .hot-keywords {
    min-height: 100px;

    .keyword-tag {
      margin: 5px;
      font-size: 14px;

      .keyword-count {
        font-size: 12px;
        color: #909399;
      }
    }
  }
}
</style>
