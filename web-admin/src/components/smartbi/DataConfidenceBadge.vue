<script setup lang="ts">
/**
 * DataConfidenceBadge - 数据可信度徽章
 * 圆形百分比徽章，根据分数显示高/中/低可信度
 */
import { computed } from 'vue'

interface Props {
  score: number
  dimension?: string
  missingFields?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  dimension: undefined,
  missingFields: () => []
})

const levelClass = computed(() => {
  if (props.score >= 75) return 'level-high'
  if (props.score >= 50) return 'level-medium'
  return 'level-low'
})

const tooltipContent = computed(() => {
  const label = props.score >= 75 ? '数据充足' : props.score >= 50 ? '部分缺失' : '数据不足'
  let text = `数据可信度: ${props.score}% (${label})`
  if (props.dimension) {
    text += `\n维度: ${props.dimension}`
  }
  if (props.missingFields && props.missingFields.length > 0) {
    text += `\n缺失字段: ${props.missingFields.slice(0, 5).join(', ')}`
    if (props.missingFields.length > 5) {
      text += ` 等${props.missingFields.length}项`
    }
  }
  return text
})
</script>

<template>
  <el-tooltip :content="tooltipContent" placement="top" :raw-content="false">
    <span class="confidence-badge" :class="levelClass">
      <span class="badge-score">{{ score }}%</span>
    </span>
  </el-tooltip>
</template>

<style scoped>
.confidence-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  font-size: 10px;
  font-weight: 700;
  cursor: help;
  margin-left: 8px;
  transition: transform 0.2s;
}

.confidence-badge:hover {
  transform: scale(1.1);
}

.level-high {
  background: #dcfce7;
  color: #166534;
  border: 2px solid #86efac;
}

.level-medium {
  background: #fef9c3;
  color: #854d0e;
  border: 2px solid #fde047;
}

.level-low {
  background: #fee2e2;
  color: #991b1b;
  border: 2px solid #fca5a5;
}

.badge-score {
  line-height: 1;
}
</style>
