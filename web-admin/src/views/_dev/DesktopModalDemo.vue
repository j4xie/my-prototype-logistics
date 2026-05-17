<script setup lang="ts">
import { ref } from 'vue';
import { DesktopModal, ModalDock } from '@/components/dialog';
import { ElButton, ElInput, ElForm, ElFormItem, ElDivider } from 'element-plus';

/**
 * U-DESKTOP-MODAL-1 followup demo — el-dialog wrapper variant.
 * Route (when dev routes enabled): /_dev/desktop-modal
 *
 * Demonstrates:
 *   - Single modal with action+contextLabel (防呆 R2)
 *   - Two modals open simultaneously — both minimize independently into the
 *     global ModalDock chip taskbar (multi-modal stacking)
 *   - Restore via dock chip OR via the modal's own minimize toggle
 */
const editOpen = ref(false);
const reviewOpen = ref(false);

const form = ref({
  name: '叮咚好食光卤猪蹄 200g',
  spec: '200g/袋 × 24 袋/箱',
});
</script>

<template>
  <div class="demo-wrapper">
    <h2>U-DESKTOP-MODAL-1 — DesktopModal (el-dialog wrapper) Demo</h2>
    <p>4 操作: 最小化（→ dock）/ 最大化 / 拖拽 header / 关闭</p>
    <p>防呆 R2 标题: <code>{{ "action" }} — {{ "contextLabel" }}</code> 永远显身份</p>
    <p>防呆 R5: 最小化后底部 dock 始终可还原（不会卡死）</p>

    <ElDivider />

    <div style="display: flex; gap: 12px">
      <ElButton type="primary" @click="editOpen = true">
        打开编辑对话框
      </ElButton>
      <ElButton type="success" @click="reviewOpen = true">
        打开审核对话框（同时开）
      </ElButton>
    </div>

    <p style="margin-top: 16px; color: var(--el-text-color-secondary)">
      提示: 同时打开两个 → 都最小化 → 右下角 dock 显示两个 chip → 点 chip 各自还原
    </p>

    <!-- Modal 1: edit -->
    <DesktopModal
      v-model="editOpen"
      action="编辑产品"
      context-label="叮咚好食光卤猪蹄 200g (SKU-20260516-0123)"
      width="640px"
    >
      <ElForm :model="form" label-width="80px">
        <ElFormItem label="品名">
          <ElInput v-model="form.name" />
        </ElFormItem>
        <ElFormItem label="规格">
          <ElInput v-model="form.spec" />
        </ElFormItem>
        <ElFormItem label="备注">
          <ElInput
            type="textarea"
            :rows="4"
            placeholder="对话框可拖拽 / 最大化 / 最小化"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="editOpen = false">取消</ElButton>
        <ElButton type="primary" @click="editOpen = false">保存</ElButton>
      </template>
    </DesktopModal>

    <!-- Modal 2: review -->
    <DesktopModal
      v-model="reviewOpen"
      action="审核采购单"
      context-label="PO-20260516-0042 (六腾门)"
      width="560px"
    >
      <p>审核流程示例 — 关键字段：</p>
      <ul>
        <li>采购金额: ¥48,000</li>
        <li>供应商: 上海六腾门食品有限公司</li>
        <li>申请人: warehouse_mgr1</li>
      </ul>
      <p>当前节点: 待 finance_manager 审核</p>
      <template #footer>
        <ElButton @click="reviewOpen = false">驳回</ElButton>
        <ElButton type="primary" @click="reviewOpen = false">通过</ElButton>
      </template>
    </DesktopModal>

    <!-- Global dock — mount once near app root in prod; here in demo for clarity. -->
    <ModalDock />
  </div>
</template>

<style scoped>
.demo-wrapper {
  padding: 24px;
  max-width: 800px;
}
code {
  background: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 13px;
}
</style>
