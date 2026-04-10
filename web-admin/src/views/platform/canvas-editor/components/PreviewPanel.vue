<template>
  <div class="preview-panel">
    <div class="preview-toolbar">
      <span>实时预览</span>
      <el-radio-group v-model="previewMode" size="small">
        <el-radio-button value="desktop">桌面</el-radio-button>
        <el-radio-button value="mobile">移动端</el-radio-button>
      </el-radio-group>
      <el-select v-model="previewRole" size="small" style="width: 140px" placeholder="预览角色">
        <el-option label="超级管理员" value="factory_super_admin" />
        <el-option label="工厂管理员" value="factory_admin" />
        <el-option label="仓库管理员" value="warehouse_manager" />
        <el-option label="销售" value="sales" />
      </el-select>
    </div>
    <div class="preview-frame" :class="previewMode">
      <SchemaFormRenderer
        v-if="config"
        :module-code="moduleCode"
        mode="create"
        :factory-id="factoryId"
      />
      <el-empty v-else description="选择模块后预览" />
    </div>
  </div>
</template>

<script setup lang="ts">
import SchemaFormRenderer from '@/views/modules/components/SchemaFormRenderer.vue'
import { usePageEditor } from '../composables/usePageEditor'

defineProps<{
  moduleCode: string
  factoryId: string
  config: unknown
}>()

const { previewMode, previewRole } = usePageEditor()
</script>

<style scoped>
.preview-panel { display: flex; flex-direction: column; height: 100%; }
.preview-toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid #ebeef5; font-size: 13px; font-weight: 600; }
.preview-frame { flex: 1; padding: 16px; overflow-y: auto; }
.preview-frame.mobile { max-width: 375px; margin: 0 auto; border: 1px solid #ebeef5; border-radius: 8px; }
</style>
