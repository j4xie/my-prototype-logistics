<!-- FieldPropertyDrawer.vue — Slide-out drawer for editing all field properties -->
<template>
  <el-drawer v-model="visible" :title="'编辑字段: ' + (field?.fieldCode || '')" size="450px">
    <el-form v-if="field" label-width="100px" label-position="top">
      <el-form-item label="字段代码">
        <el-input :model-value="field.fieldCode" disabled />
      </el-form-item>
      <el-form-item label="显示标签">
        <el-input v-model="form.label" />
      </el-form-item>
      <el-form-item label="字段类型">
        <el-select v-model="form.type" style="width:100%">
          <el-option v-for="t in fieldTypes" :key="t" :label="t" :value="t" />
        </el-select>
      </el-form-item>
      <el-divider>可见性</el-divider>
      <el-form-item label="列表显示"><el-switch v-model="form.listVisible" /></el-form-item>
      <el-form-item label="表单显示"><el-switch v-model="form.formVisible" /></el-form-item>
      <el-form-item label="必填"><el-switch v-model="form.required" /></el-form-item>
      <el-form-item label="只读"><el-switch v-model="form.readOnly" /></el-form-item>
      <el-divider>高级</el-divider>
      <el-form-item label="默认值">
        <el-input v-model="form.defaultValue" placeholder="留空则无默认值" />
      </el-form-item>
      <el-form-item label="依赖字段">
        <el-input v-model="form.dependsOn" placeholder="如: status=DRAFT" />
      </el-form-item>
      <el-form-item label="排序">
        <el-input-number v-model="form.sortOrder" :min="0" />
      </el-form-item>
      <el-form-item v-if="form.type === 'select'" label="选项列表">
        <el-input v-model="optionsText" type="textarea" :rows="3" placeholder="每行一个选项" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="save">保存</el-button>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { EffectiveField } from '@/types/config'
import { ElMessage } from 'element-plus'

const props = defineProps<{ field: EffectiveField | null }>()
const emit = defineEmits<{ save: [field: EffectiveField]; close: [] }>()

const visible = ref(false)
const fieldTypes = ['string', 'textarea', 'decimal', 'integer', 'boolean', 'date', 'datetime', 'select', 'reference', 'json_array', 'line_items']
const form = ref<any>({})
const optionsText = ref('')

watch(() => props.field, (f) => {
  if (f) {
    visible.value = true
    form.value = { ...f }
    optionsText.value = (f.options || []).join('\n')
  }
})

function save() {
  if (form.value.type === 'select') {
    form.value.options = optionsText.value.split('\n').filter(Boolean)
  }
  emit('save', { ...props.field, ...form.value })
  visible.value = false
  ElMessage.success('字段属性已更新')
}
</script>
