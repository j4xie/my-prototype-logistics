<template>
  <div class="not-found-wrap">
    <el-empty :image-size="200" :description="description || '记录不存在或已被删除'">
      <!-- default slot replaces description's bottom area in current Element Plus -->
      <el-button type="primary" @click="goBack">{{ returnLabel }}</el-button>
    </el-empty>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const props = withDefaults(defineProps<{
  description?: string;
  returnLabel?: string;
  returnPath?: string;
}>(), {
  description: '记录不存在或已被删除',
  returnLabel: '返回列表',
  returnPath: '',
});

const router = useRouter();
function goBack() {
  if (props.returnPath) router.push(props.returnPath);
  else router.back();
}
</script>

<style scoped>
.not-found-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}
</style>
