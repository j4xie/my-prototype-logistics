<template>
  <div v-if="visible" class="industry-templates-bar">
    <span class="templates-label">食品行业模板:</span>
    <el-tag
      v-for="tpl in templates"
      :key="tpl.id"
      :type="activeTemplate === tpl.id ? 'primary' : 'success'"
      :effect="activeTemplate === tpl.id ? 'dark' : 'plain'"
      class="template-chip"
      @click="$emit('apply', tpl)"
    >
      {{ tpl.name }}
    </el-tag>
  </div>
</template>

<script setup lang="ts">
import type { FoodTemplate } from '@/api/smartbi';

defineProps<{
  visible: boolean;
  templates: readonly FoodTemplate[];
  activeTemplate: string | null;
}>();

defineEmits<{
  (e: 'apply', tpl: FoodTemplate): void;
}>();
</script>
