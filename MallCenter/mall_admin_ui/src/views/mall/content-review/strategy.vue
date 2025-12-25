<!--
  审核策略配置页
-->
<template>
  <div class="app-container strategy-config">
    <el-row :gutter="20">
      <!-- 左侧：审核规则配置 -->
      <el-col :span="12">
        <!-- 自动审核设置 -->
        <el-card class="box-card">
          <template #header>
            <div class="card-header">
              <span>自动审核设置</span>
              <el-button type="primary" size="small" @click="saveAutoSettings" :loading="savingAuto">
                保存
              </el-button>
            </div>
          </template>

          <el-form :model="autoSettings" label-width="140px">
            <el-form-item label="启用自动审核">
              <el-switch v-model="autoSettings.enabled" />
              <span class="form-tip">开启后，系统将自动审核低风险内容</span>
            </el-form-item>

            <el-divider content-position="left">商品审核</el-divider>

            <el-form-item label="商品自动通过">
              <el-switch v-model="autoSettings.product.autoApprove" :disabled="!autoSettings.enabled" />
            </el-form-item>
            <el-form-item label="通过条件">
              <el-checkbox-group v-model="autoSettings.product.conditions" :disabled="!autoSettings.enabled">
                <el-checkbox label="trusted_merchant">信任商户</el-checkbox>
                <el-checkbox label="no_sensitive">无敏感词</el-checkbox>
                <el-checkbox label="has_certificate">有资质证书</el-checkbox>
              </el-checkbox-group>
            </el-form-item>

            <el-divider content-position="left">评价审核</el-divider>

            <el-form-item label="评价自动通过">
              <el-switch v-model="autoSettings.review.autoApprove" :disabled="!autoSettings.enabled" />
            </el-form-item>
            <el-form-item label="通过条件">
              <el-checkbox-group v-model="autoSettings.review.conditions" :disabled="!autoSettings.enabled">
                <el-checkbox label="no_sensitive">无敏感词</el-checkbox>
                <el-checkbox label="no_link">无外链</el-checkbox>
                <el-checkbox label="positive">正面评价(4星以上)</el-checkbox>
              </el-checkbox-group>
            </el-form-item>

            <el-divider content-position="left">商户审核</el-divider>

            <el-form-item label="商户自动通过">
              <el-switch v-model="autoSettings.merchant.autoApprove" :disabled="!autoSettings.enabled" />
              <span class="form-tip">建议关闭，商户入驻需人工审核</span>
            </el-form-item>
          </el-form>
        </el-card>

        <!-- 审核时效设置 -->
        <el-card class="box-card" style="margin-top: 20px">
          <template #header>
            <span>审核时效设置</span>
          </template>

          <el-form :model="timeSettings" label-width="140px">
            <el-form-item label="审核超时提醒">
              <el-input-number v-model="timeSettings.reminderHours" :min="1" :max="72" />
              <span class="form-tip">小时后发送提醒</span>
            </el-form-item>
            <el-form-item label="自动驳回时限">
              <el-input-number v-model="timeSettings.autoRejectDays" :min="0" :max="30" />
              <span class="form-tip">天未审核自动驳回（0表示不自动驳回）</span>
            </el-form-item>
            <el-form-item label="优先级规则">
              <el-select v-model="timeSettings.priorityRule" style="width: 200px">
                <el-option label="按提交时间" value="submit_time" />
                <el-option label="按内容类型" value="content_type" />
                <el-option label="按商户等级" value="merchant_level" />
              </el-select>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <!-- 右侧：敏感词管理 -->
      <el-col :span="12">
        <el-card class="box-card">
          <template #header>
            <div class="card-header">
              <span>敏感词库管理</span>
              <div>
                <el-button size="small" @click="showImportDialog">
                  <el-icon><Upload /></el-icon> 批量导入
                </el-button>
                <el-button type="primary" size="small" @click="showAddWordDialog">
                  <el-icon><Plus /></el-icon> 添加
                </el-button>
              </div>
            </div>
          </template>

          <!-- 分类标签 -->
          <el-radio-group v-model="currentCategory" size="small" class="category-tabs">
            <el-radio-button v-for="cat in categories" :key="cat.value" :label="cat.value">
              {{ cat.label }} ({{ getCategoryCount(cat.value) }})
            </el-radio-button>
          </el-radio-group>

          <!-- 搜索 -->
          <el-input
            v-model="wordSearch"
            placeholder="搜索敏感词..."
            clearable
            style="margin: 15px 0"
            @input="filterWords"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>

          <!-- 敏感词列表 -->
          <div class="word-list" v-loading="loadingWords">
            <el-tag
              v-for="word in filteredWords"
              :key="word.id"
              :type="getCategoryTagType(word.category)"
              closable
              @close="removeWord(word)"
              class="word-tag"
            >
              {{ word.word }}
            </el-tag>

            <el-empty v-if="filteredWords.length === 0 && !loadingWords" description="暂无敏感词" :image-size="60" />
          </div>

          <!-- 分页 -->
          <div class="word-pagination" v-if="wordTotal > wordPageSize">
            <el-pagination
              small
              layout="prev, pager, next"
              :total="wordTotal"
              :page-size="wordPageSize"
              v-model:current-page="wordPage"
              @current-change="loadWords"
            />
          </div>
        </el-card>

        <!-- 违规处理规则 -->
        <el-card class="box-card" style="margin-top: 20px">
          <template #header>
            <span>违规处理规则</span>
          </template>

          <el-table :data="violationRules" size="small">
            <el-table-column prop="level" label="违规等级" width="100">
              <template #default="{ row }">
                <el-tag :type="row.tagType" size="small">{{ row.levelName }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="description" label="描述" />
            <el-table-column prop="action" label="处理方式" width="150" />
            <el-table-column label="操作" width="80">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="editRule(row)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <!-- 添加敏感词对话框 -->
    <el-dialog v-model="addWordDialogVisible" title="添加敏感词" width="500px">
      <el-form :model="wordForm" :rules="wordRules" ref="wordFormRef" label-width="100px">
        <el-form-item label="敏感词" prop="word">
          <el-input v-model="wordForm.word" placeholder="请输入敏感词" />
        </el-form-item>
        <el-form-item label="分类" prop="category">
          <el-select v-model="wordForm.category" style="width: 100%">
            <el-option
              v-for="cat in categories"
              :key="cat.value"
              :label="cat.label"
              :value="cat.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="处理方式">
          <el-radio-group v-model="wordForm.action">
            <el-radio label="reject">直接驳回</el-radio>
            <el-radio label="review">人工审核</el-radio>
            <el-radio label="replace">替换为***</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addWordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitWord" :loading="submittingWord">确定</el-button>
      </template>
    </el-dialog>

    <!-- 批量导入对话框 -->
    <el-dialog v-model="importDialogVisible" title="批量导入敏感词" width="500px">
      <el-form label-width="100px">
        <el-form-item label="选择分类">
          <el-select v-model="importCategory" style="width: 100%">
            <el-option
              v-for="cat in categories"
              :key="cat.value"
              :label="cat.label"
              :value="cat.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="敏感词列表">
          <el-input
            v-model="importText"
            type="textarea"
            :rows="8"
            placeholder="每行一个敏感词，或用逗号、空格分隔"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitImport" :loading="importing">导入</el-button>
      </template>
    </el-dialog>

    <!-- 编辑违规规则对话框 -->
    <el-dialog v-model="ruleDialogVisible" title="编辑违规规则" width="500px">
      <el-form :model="ruleForm" label-width="100px">
        <el-form-item label="违规等级">
          <el-input :value="ruleForm.levelName" disabled />
        </el-form-item>
        <el-form-item label="处理方式">
          <el-select v-model="ruleForm.action" style="width: 100%">
            <el-option label="警告" value="warn" />
            <el-option label="删除内容" value="delete" />
            <el-option label="禁言7天" value="mute_7" />
            <el-option label="禁言30天" value="mute_30" />
            <el-option label="封禁账号" value="ban" />
          </el-select>
        </el-form-item>
        <el-form-item label="通知用户">
          <el-switch v-model="ruleForm.notifyUser" />
        </el-form-item>
        <el-form-item label="通知商户">
          <el-switch v-model="ruleForm.notifyMerchant" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ruleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRule">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="ContentReviewStrategy">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Upload, Search } from '@element-plus/icons-vue'
import {
  getSensitiveWords,
  addSensitiveWord,
  deleteSensitiveWord,
  importSensitiveWords,
  getReviewStrategy,
  updateReviewStrategy
} from '@/api/mall/contentReview'

// 自动审核设置
const savingAuto = ref(false)
const autoSettings = reactive({
  enabled: true,
  product: {
    autoApprove: true,
    conditions: ['trusted_merchant', 'no_sensitive']
  },
  review: {
    autoApprove: true,
    conditions: ['no_sensitive', 'no_link']
  },
  merchant: {
    autoApprove: false
  }
})

// 时效设置
const timeSettings = reactive({
  reminderHours: 24,
  autoRejectDays: 7,
  priorityRule: 'submit_time'
})

// 敏感词管理
const loadingWords = ref(false)
const wordSearch = ref('')
const currentCategory = ref('all')
const wordPage = ref(1)
const wordPageSize = 50
const wordTotal = ref(0)
const sensitiveWords = ref([])

const categories = [
  { value: 'all', label: '全部' },
  { value: 'politics', label: '政治敏感' },
  { value: 'porn', label: '色情低俗' },
  { value: 'violence', label: '暴力违法' },
  { value: 'ad', label: '广告引流' },
  { value: 'other', label: '其他' }
]

// 过滤后的敏感词
const filteredWords = computed(() => {
  let words = sensitiveWords.value
  if (currentCategory.value !== 'all') {
    words = words.filter(w => w.category === currentCategory.value)
  }
  if (wordSearch.value) {
    words = words.filter(w => w.word.includes(wordSearch.value))
  }
  return words
})

// 获取分类数量
const getCategoryCount = (category) => {
  if (category === 'all') return sensitiveWords.value.length
  return sensitiveWords.value.filter(w => w.category === category).length
}

// 获取分类标签类型
const getCategoryTagType = (category) => {
  const types = {
    politics: 'danger',
    porn: 'warning',
    violence: 'danger',
    ad: '',
    other: 'info'
  }
  return types[category] || 'info'
}

// 加载敏感词
const loadWords = async () => {
  loadingWords.value = true
  try {
    const res = await getSensitiveWords({
      current: wordPage.value,
      size: wordPageSize,
      category: currentCategory.value !== 'all' ? currentCategory.value : undefined
    })
    sensitiveWords.value = res.data?.records || []
    wordTotal.value = res.data?.total || 0
  } catch (error) {
    console.error('加载敏感词失败:', error)
    // 模拟数据
    sensitiveWords.value = [
      { id: 1, word: '敏感词1', category: 'politics', action: 'reject' },
      { id: 2, word: '敏感词2', category: 'porn', action: 'review' },
      { id: 3, word: '敏感词3', category: 'ad', action: 'replace' },
      { id: 4, word: '测试词', category: 'other', action: 'review' }
    ]
    wordTotal.value = 4
  } finally {
    loadingWords.value = false
  }
}

// 过滤敏感词
const filterWords = () => {
  // 实时搜索在 computed 中处理
}

// 添加敏感词对话框
const addWordDialogVisible = ref(false)
const wordFormRef = ref(null)
const submittingWord = ref(false)
const wordForm = reactive({
  word: '',
  category: 'other',
  action: 'review'
})

const wordRules = {
  word: [{ required: true, message: '请输入敏感词', trigger: 'blur' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }]
}

const showAddWordDialog = () => {
  wordForm.word = ''
  wordForm.category = 'other'
  wordForm.action = 'review'
  addWordDialogVisible.value = true
}

const submitWord = async () => {
  try {
    await wordFormRef.value.validate()
  } catch {
    return
  }

  submittingWord.value = true
  try {
    await addSensitiveWord(wordForm)
    ElMessage.success('添加成功')
    addWordDialogVisible.value = false
    loadWords()
  } catch (error) {
    console.error('添加失败:', error)
    ElMessage.error('添加失败')
  } finally {
    submittingWord.value = false
  }
}

// 删除敏感词
const removeWord = async (word) => {
  try {
    await deleteSensitiveWord(word.id)
    ElMessage.success('删除成功')
    loadWords()
  } catch (error) {
    ElMessage.error('删除失败')
  }
}

// 批量导入
const importDialogVisible = ref(false)
const importing = ref(false)
const importCategory = ref('other')
const importText = ref('')

const showImportDialog = () => {
  importCategory.value = 'other'
  importText.value = ''
  importDialogVisible.value = true
}

const submitImport = async () => {
  if (!importText.value.trim()) {
    ElMessage.warning('请输入敏感词')
    return
  }

  // 解析敏感词列表
  const words = importText.value
    .split(/[\n,，\s]+/)
    .map(w => w.trim())
    .filter(w => w.length > 0)

  if (words.length === 0) {
    ElMessage.warning('未解析到有效敏感词')
    return
  }

  importing.value = true
  try {
    await importSensitiveWords({
      category: importCategory.value,
      words: words
    })
    ElMessage.success(`成功导入 ${words.length} 个敏感词`)
    importDialogVisible.value = false
    loadWords()
  } catch (error) {
    console.error('导入失败:', error)
    ElMessage.error('导入失败')
  } finally {
    importing.value = false
  }
}

// 违规处理规则
const violationRules = ref([
  { level: 1, levelName: '轻微违规', tagType: 'warning', description: '包含广告、轻微不当用语', action: '警告' },
  { level: 2, levelName: '一般违规', tagType: '', description: '包含敏感词、不实信息', action: '删除内容' },
  { level: 3, levelName: '严重违规', tagType: 'danger', description: '色情、暴力、政治敏感', action: '禁言7天' },
  { level: 4, levelName: '极其严重', tagType: 'danger', description: '违法信息、恶意攻击', action: '封禁账号' }
])

const ruleDialogVisible = ref(false)
const ruleForm = reactive({
  level: 1,
  levelName: '',
  action: 'warn',
  notifyUser: true,
  notifyMerchant: false
})

const editRule = (rule) => {
  Object.assign(ruleForm, rule)
  ruleDialogVisible.value = true
}

const saveRule = () => {
  const index = violationRules.value.findIndex(r => r.level === ruleForm.level)
  if (index > -1) {
    violationRules.value[index].action = getActionName(ruleForm.action)
  }
  ruleDialogVisible.value = false
  ElMessage.success('保存成功')
}

const getActionName = (action) => {
  const names = {
    warn: '警告',
    delete: '删除内容',
    mute_7: '禁言7天',
    mute_30: '禁言30天',
    ban: '封禁账号'
  }
  return names[action] || action
}

// 保存自动审核设置
const saveAutoSettings = async () => {
  savingAuto.value = true
  try {
    await updateReviewStrategy({
      autoSettings: autoSettings,
      timeSettings: timeSettings
    })
    ElMessage.success('保存成功')
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败')
  } finally {
    savingAuto.value = false
  }
}

// 加载策略配置
const loadStrategy = async () => {
  try {
    const res = await getReviewStrategy()
    if (res.data) {
      Object.assign(autoSettings, res.data.autoSettings || {})
      Object.assign(timeSettings, res.data.timeSettings || {})
    }
  } catch (error) {
    console.error('加载策略失败:', error)
  }
}

// 初始化
onMounted(() => {
  loadWords()
  loadStrategy()
})
</script>

<style lang="scss" scoped>
.strategy-config {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .form-tip {
    font-size: 12px;
    color: #909399;
    margin-left: 10px;
  }

  .category-tabs {
    width: 100%;

    :deep(.el-radio-button__inner) {
      padding: 8px 12px;
    }
  }

  .word-list {
    min-height: 200px;
    max-height: 400px;
    overflow-y: auto;
    padding: 10px 0;

    .word-tag {
      margin: 4px;
    }
  }

  .word-pagination {
    margin-top: 15px;
    display: flex;
    justify-content: center;
  }
}
</style>
