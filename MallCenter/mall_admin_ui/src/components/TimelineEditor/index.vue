<template>
  <div class="timeline-editor">
    <!-- 工具栏 -->
    <div class="timeline-toolbar">
      <el-button type="primary" @click="addNode" :icon="Plus">添加节点</el-button>
      <el-button @click="expandAll" :icon="Expand">全部展开</el-button>
      <el-button @click="collapseAll" :icon="Fold">全部折叠</el-button>
      <el-divider direction="vertical" />
      <el-switch v-model="previewMode" active-text="预览" inactive-text="编辑" />
    </div>

    <!-- 时间线列表 -->
    <div class="timeline-container" :class="{ 'preview-mode': previewMode }">
      <draggable
        v-model="timelineNodes"
        item-key="id"
        handle=".drag-handle"
        @end="onDragEnd"
        :disabled="previewMode"
      >
        <template #item="{ element, index }">
          <div 
            class="timeline-node"
            :class="{ 
              expanded: expandedNodes.includes(element.id),
              'is-first': index === 0,
              'is-last': index === timelineNodes.length - 1
            }"
          >
            <!-- 时间线连接 -->
            <div class="timeline-connector">
              <div class="connector-line" v-if="index < timelineNodes.length - 1"></div>
              <div 
                class="connector-dot" 
                :style="{ backgroundColor: getStageColor(element.stageType) }"
              >
                <el-icon><component :is="getStageIcon(element.stageType)" /></el-icon>
              </div>
            </div>

            <!-- 节点内容 -->
            <div class="node-content">
              <!-- 头部 -->
              <div class="node-header" @click="toggleExpand(element.id)">
                <div class="drag-handle" v-if="!previewMode">
                  <el-icon><Rank /></el-icon>
                </div>
                <div class="node-title">
                  <span class="stage-name">{{ element.stageName || '未命名阶段' }}</span>
                  <el-tag :color="getStageColor(element.stageType)" effect="dark" size="small">
                    {{ getStageLabel(element.stageType) }}
                  </el-tag>
                  <el-tag 
                    v-if="element.status === 'completed'" 
                    type="success" 
                    size="small"
                  >已完成</el-tag>
                  <el-tag v-else type="info" size="small">进行中</el-tag>
                </div>
                <div class="node-time">{{ formatTime(element.operateTime) }}</div>
                <div class="node-actions" v-if="!previewMode">
                  <el-button link type="primary" @click.stop="editNode(element)">
                    <el-icon><Edit /></el-icon>
                  </el-button>
                  <el-button link type="danger" @click.stop="deleteNode(element.id)">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
                <el-icon class="expand-icon">
                  <ArrowDown v-if="!expandedNodes.includes(element.id)" />
                  <ArrowUp v-else />
                </el-icon>
              </div>

              <!-- 展开内容 -->
              <el-collapse-transition>
                <div class="node-detail" v-show="expandedNodes.includes(element.id)">
                  <el-descriptions :column="2" border size="small">
                    <el-descriptions-item label="操作人">
                      {{ element.operator || '-' }}
                    </el-descriptions-item>
                    <el-descriptions-item label="车间/工位">
                      {{ element.workshop || '-' }}
                    </el-descriptions-item>
                    <el-descriptions-item label="设备">
                      {{ element.equipment || '-' }}
                    </el-descriptions-item>
                    <el-descriptions-item label="温度">
                      {{ element.temperature ? element.temperature + '°C' : '-' }}
                    </el-descriptions-item>
                    <el-descriptions-item label="湿度">
                      {{ element.humidity ? element.humidity + '%' : '-' }}
                    </el-descriptions-item>
                    <el-descriptions-item label="持续时间">
                      {{ element.duration || '-' }}
                    </el-descriptions-item>
                  </el-descriptions>
                  <div class="node-description" v-if="element.description">
                    <strong>描述：</strong>{{ element.description }}
                  </div>
                  <div class="node-evidence" v-if="element.evidenceUrls && element.evidenceUrls.length > 0">
                    <strong>证据图片：</strong>
                    <div class="evidence-images">
                      <el-image
                        v-for="(url, idx) in element.evidenceUrls"
                        :key="idx"
                        :src="url"
                        :preview-src-list="element.evidenceUrls"
                        :initial-index="idx"
                        fit="cover"
                        class="evidence-img"
                      />
                    </div>
                  </div>
                </div>
              </el-collapse-transition>
            </div>
          </div>
        </template>
      </draggable>

      <!-- 空状态 -->
      <el-empty v-if="timelineNodes.length === 0" description="暂无时间线节点">
        <el-button type="primary" @click="addNode">添加第一个节点</el-button>
      </el-empty>
    </div>

    <!-- 编辑对话框 -->
    <el-dialog 
      v-model="dialogVisible" 
      :title="isEdit ? '编辑节点' : '添加节点'" 
      width="600px"
      destroy-on-close
    >
      <el-form :model="formData" :rules="formRules" ref="formRef" label-width="100px">
        <el-form-item label="阶段名称" prop="stageName">
          <el-input v-model="formData.stageName" placeholder="请输入阶段名称" />
        </el-form-item>
        <el-form-item label="阶段类型" prop="stageType">
          <el-select v-model="formData.stageType" placeholder="请选择阶段类型">
            <el-option 
              v-for="stage in stageTypes" 
              :key="stage.value" 
              :label="stage.label" 
              :value="stage.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="操作时间" prop="operateTime">
          <el-date-picker
            v-model="formData.operateTime"
            type="datetime"
            placeholder="选择操作时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="formData.status">
            <el-radio value="completed">已完成</el-radio>
            <el-radio value="pending">进行中</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="formData.operator" placeholder="请输入操作人" />
        </el-form-item>
        <el-form-item label="车间/工位">
          <el-input v-model="formData.workshop" placeholder="请输入车间或工位" />
        </el-form-item>
        <el-form-item label="设备">
          <el-input v-model="formData.equipment" placeholder="请输入设备名称" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="温度(°C)">
              <el-input-number v-model="formData.temperature" :precision="1" :step="0.5" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="湿度(%)">
              <el-input-number v-model="formData.humidity" :min="0" :max="100" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="持续时间">
          <el-input v-model="formData.duration" placeholder="如：2小时30分钟" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input 
            v-model="formData.description" 
            type="textarea" 
            :rows="3" 
            placeholder="请输入详细描述"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveNode">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import draggable from 'vuedraggable'
import { 
  Plus, Expand, Fold, Rank, Edit, Delete, 
  ArrowDown, ArrowUp, Box, Setting, Check, 
  Van, Histogram, Document
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  },
  batchId: {
    type: [String, Number],
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

// 时间线节点数据
const timelineNodes = ref([])

// 展开的节点
const expandedNodes = ref([])

// 预览模式
const previewMode = ref(false)

// 对话框
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref(null)
const formData = ref({
  id: null,
  stageName: '',
  stageType: 'raw_material',
  operateTime: null,
  status: 'completed',
  operator: '',
  workshop: '',
  equipment: '',
  temperature: null,
  humidity: null,
  duration: '',
  description: '',
  evidenceUrls: []
})

// 阶段类型
const stageTypes = [
  { value: 'raw_material', label: '原料入库', icon: Box, color: '#409eff' },
  { value: 'processing', label: '加工处理', icon: Setting, color: '#e6a23c' },
  { value: 'quality_check', label: '质量检测', icon: Check, color: '#67c23a' },
  { value: 'packaging', label: '包装', icon: Document, color: '#909399' },
  { value: 'storage', label: '仓储', icon: Histogram, color: '#8b5cf6' },
  { value: 'shipping', label: '发货', icon: Van, color: '#f56c6c' }
]

// 表单验证规则
const formRules = {
  stageName: [{ required: true, message: '请输入阶段名称', trigger: 'blur' }],
  stageType: [{ required: true, message: '请选择阶段类型', trigger: 'change' }],
  operateTime: [{ required: true, message: '请选择操作时间', trigger: 'change' }]
}

// 监听外部数据变化
watch(() => props.modelValue, (val) => {
  if (val && Array.isArray(val)) {
    timelineNodes.value = JSON.parse(JSON.stringify(val))
  }
}, { immediate: true, deep: true })

// 获取阶段颜色
function getStageColor(stageType) {
  const stage = stageTypes.find(s => s.value === stageType)
  return stage ? stage.color : '#409eff'
}

// 获取阶段图标
function getStageIcon(stageType) {
  const stage = stageTypes.find(s => s.value === stageType)
  return stage ? stage.icon : Box
}

// 获取阶段标签
function getStageLabel(stageType) {
  const stage = stageTypes.find(s => s.value === stageType)
  return stage ? stage.label : '未知'
}

// 格式化时间
function formatTime(time) {
  if (!time) return '-'
  const date = new Date(time)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 切换展开
function toggleExpand(id) {
  const index = expandedNodes.value.indexOf(id)
  if (index > -1) {
    expandedNodes.value.splice(index, 1)
  } else {
    expandedNodes.value.push(id)
  }
}

// 全部展开
function expandAll() {
  expandedNodes.value = timelineNodes.value.map(n => n.id)
}

// 全部折叠
function collapseAll() {
  expandedNodes.value = []
}

// 添加节点
function addNode() {
  isEdit.value = false
  formData.value = {
    id: 'new_' + Date.now(),
    stageName: '',
    stageType: 'raw_material',
    operateTime: new Date(),
    status: 'completed',
    operator: '',
    workshop: '',
    equipment: '',
    temperature: null,
    humidity: null,
    duration: '',
    description: '',
    evidenceUrls: []
  }
  dialogVisible.value = true
}

// 编辑节点
function editNode(node) {
  isEdit.value = true
  formData.value = { ...node }
  dialogVisible.value = true
}

// 删除节点
function deleteNode(id) {
  ElMessageBox.confirm('确定要删除这个节点吗？', '提示', {
    type: 'warning'
  }).then(() => {
    const index = timelineNodes.value.findIndex(n => n.id === id)
    if (index > -1) {
      timelineNodes.value.splice(index, 1)
      emitChange()
      ElMessage.success('删除成功')
    }
  }).catch(() => {})
}

// 保存节点
function saveNode() {
  formRef.value.validate((valid) => {
    if (valid) {
      if (isEdit.value) {
        // 编辑
        const index = timelineNodes.value.findIndex(n => n.id === formData.value.id)
        if (index > -1) {
          timelineNodes.value[index] = { ...formData.value }
        }
      } else {
        // 新增
        timelineNodes.value.push({ ...formData.value })
      }
      dialogVisible.value = false
      emitChange()
      ElMessage.success('保存成功')
    }
  })
}

// 拖拽结束
function onDragEnd() {
  emitChange()
}

// 触发变更
function emitChange() {
  emit('update:modelValue', timelineNodes.value)
  emit('change', timelineNodes.value)
}
</script>

<style scoped lang="scss">
.timeline-editor {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
}

.timeline-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #ebeef5;
}

.timeline-container {
  position: relative;
  
  &.preview-mode {
    .drag-handle {
      display: none;
    }
    .node-actions {
      display: none;
    }
  }
}

.timeline-node {
  display: flex;
  margin-bottom: 16px;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.timeline-connector {
  position: relative;
  width: 40px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  
  .connector-line {
    position: absolute;
    top: 36px;
    left: 50%;
    transform: translateX(-50%);
    width: 2px;
    height: calc(100% - 20px);
    background: linear-gradient(to bottom, #409eff, #e4e7ed);
  }
  
  .connector-dot {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #409eff;
    color: #fff;
    z-index: 1;
    
    .el-icon {
      font-size: 18px;
    }
  }
}

.node-content {
  flex: 1;
  background: #f5f7fa;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e4e7ed;
  transition: all 0.3s;
  
  &:hover {
    border-color: #409eff;
    box-shadow: 0 2px 12px rgba(64, 158, 255, 0.15);
  }
}

.node-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  background: #fff;
  
  .drag-handle {
    cursor: move;
    color: #909399;
    
    &:hover {
      color: #409eff;
    }
  }
  
  .node-title {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    
    .stage-name {
      font-weight: 600;
      color: #303133;
    }
  }
  
  .node-time {
    color: #909399;
    font-size: 13px;
  }
  
  .node-actions {
    display: flex;
    gap: 4px;
  }
  
  .expand-icon {
    color: #909399;
    transition: transform 0.3s;
  }
}

.node-detail {
  padding: 16px;
  border-top: 1px solid #e4e7ed;
  
  .node-description {
    margin-top: 12px;
    padding: 12px;
    background: #fff;
    border-radius: 4px;
    font-size: 14px;
    color: #606266;
    line-height: 1.6;
  }
  
  .node-evidence {
    margin-top: 12px;
    
    .evidence-images {
      display: flex;
      gap: 8px;
      margin-top: 8px;
      flex-wrap: wrap;
    }
    
    .evidence-img {
      width: 80px;
      height: 80px;
      border-radius: 4px;
      cursor: pointer;
    }
  }
}
</style>







