<script setup lang="ts">
import { ref } from 'vue';
import { EnhancedDialog } from '@/components/dialog';

/**
 * U-DESKTOP-MODAL-1 demo (Sprint 4 Wave 2 Chat L).
 * Route: /_dev/enhanced-dialog (if dev routes enabled).
 */
const open = ref(false);
</script>

<template>
  <div style="padding: 24px">
    <h2>U-DESKTOP-MODAL-1 EnhancedDialog Demo</h2>
    <p>4 操作: 最小化 / 最大化 / 拉伸右下角 / 关闭. 拖拽 header 移动.</p>
    <el-button type="primary" @click="open = true">打开增强对话框</el-button>

    <EnhancedDialog v-model="open" title="增强对话框 — demo" width="640px">
      <div>
        <p>这是一个桌面级对话框，支持：</p>
        <ul>
          <li>拖拽 header 移动位置</li>
          <li>右上角按钮：最小化（底部 dock）/ 最大化（全屏）/ 关闭</li>
          <li>右下角小角标拖拽：自由拉伸</li>
        </ul>
        <p>试着拖拽 header 移动，或点击最大化按钮全屏。</p>
        <el-input placeholder="测试输入框 — 拉伸后仍正常工作" />
      </div>
      <template #footer>
        <el-button @click="open = false">取消</el-button>
        <el-button type="primary" @click="open = false">确定</el-button>
      </template>
    </EnhancedDialog>
  </div>
</template>
