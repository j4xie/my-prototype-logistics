<template>
  <div class="phase-ii-placeholder">
    <el-card shadow="never" class="placeholder-card">
      <div class="icon-row">
        <el-icon :size="64" color="#5470c6"><Promotion /></el-icon>
      </div>
      <h2 class="title">{{ title }}</h2>
      <p class="subtitle">餐饮版本（Phase II）正在建设中</p>
      <p class="body">
        系统已识别您所在工厂为<strong>餐饮租户</strong>。本页面（{{ pageName }}）当前仅支持工厂租户的数据形态。
        餐饮版本将基于 Silver POS 数据 + Bronze 供应商/成本 提供更贴合的指标体系，预计 Phase II 上线。
      </p>
      <p class="hint">
        现阶段您可以使用：
      </p>
      <div class="actions">
        <el-button
          type="primary"
          :icon="DataAnalysis"
          size="large"
          @click="goto('/smart-bi/revenue-report')"
        >
          收入管理报表（已上线）
        </el-button>
        <el-button
          :icon="ChatDotRound"
          size="large"
          @click="goto('/smart-bi/query')"
        >
          AI 智能问答
        </el-button>
      </div>
      <p class="footnote">
        如有具体报表诉求，请联系产品/技术团队反馈，纳入 Phase II 优先级评估。
      </p>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { Promotion, DataAnalysis, ChatDotRound } from '@element-plus/icons-vue';

defineProps<{
  /** 模块名: "财务数据分析" / "销售数据分析" */
  pageName: string;
  /** 大标题 (默认与 pageName 一致) */
  title?: string;
}>();

const router = useRouter();

function goto(path: string) {
  router.push(path);
}
</script>

<style scoped>
.phase-ii-placeholder {
  display: flex;
  justify-content: center;
  padding: 48px 16px;
}
.placeholder-card {
  max-width: 720px;
  width: 100%;
  text-align: center;
  border: 1px solid #ebeef5;
}
.icon-row {
  margin-bottom: 16px;
}
.title {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 8px;
}
.subtitle {
  font-size: 16px;
  color: #909399;
  margin: 0 0 24px;
}
.body {
  font-size: 14px;
  line-height: 1.7;
  color: #606266;
  margin: 0 0 24px;
  text-align: left;
  padding: 0 24px;
}
.hint {
  font-size: 14px;
  color: #606266;
  margin: 0 0 16px;
}
.actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 24px;
}
.footnote {
  font-size: 12px;
  color: #909399;
  margin: 0;
  font-style: italic;
}
</style>
