<template>
  <el-alert
    v-if="visible"
    title="AI 分析服务暂时不可用"
    description="Python SmartBI 服务无法连接，智能图表推荐和 AI 洞察功能暂时禁用。已上传的数据仍可正常查看。"
    type="warning"
    :closable="true"
    show-icon
    style="margin-bottom: 12px;"
  />
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean;
}>();
</script>
