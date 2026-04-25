<template>
  <div class="chart-section-header">
    <span class="section-icon">{{ icon }}</span>
    <span class="section-label">{{ label }}</span>
    <span class="section-count">{{ count }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon: string;
  label: string;
  count: number;
}>();
</script>
