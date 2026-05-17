<script setup lang="ts">
// P1 #21 S-CRM-1 — tracking record new/edit dialog.
//
// Single dialog used for both 新建 + 编辑 modes (mode prop).
// 防呆 R2: header always shows 客户名 + ID (resolved by parent + passed in).
// 防呆 R3: recordTime defaults to "now" when blank.
import { ref, watch, computed } from 'vue';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import {
  createTrackingRecord,
  updateTrackingRecord,
  type CustomerTrackingRecord,
  type CreateTrackingRecordRequest,
  type UpdateTrackingRecordRequest,
} from '@/api/customerTracking';

interface CustomerOption {
  id: string;
  name: string;
}

const props = defineProps<{
  modelValue: boolean;
  factoryId: string;
  /** 'create' = new record; 'edit' = update existing (uses record.id). */
  mode: 'create' | 'edit';
  /** Customer dropdown options (resolved by parent from /customers endpoint). */
  customers: CustomerOption[];
  /** Preselected customerId (table filter or row context). */
  initialCustomerId?: string;
  /** Existing record for edit mode. Ignored when mode='create'. */
  record?: CustomerTrackingRecord | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', open: boolean): void;
  (e: 'saved'): void;
}>();

interface FormShape {
  customerId: string;
  recordTime: string;
  recorderName: string;
  content: string;
  contactPerson: string;
  contactPhone: string;
  address: string;
  remark: string;
}

const empty = (): FormShape => ({
  customerId: '',
  recordTime: '',
  recorderName: '',
  content: '',
  contactPerson: '',
  contactPhone: '',
  address: '',
  remark: '',
});

const formRef = ref<FormInstance>();
const form = ref<FormShape>(empty());
const submitting = ref(false);

const rules: FormRules = {
  customerId: [{ required: true, message: '请选择客户', trigger: 'change' }],
  content: [{ required: true, message: '请填写跟踪内容', trigger: 'blur' }],
};

// 防呆 R2 — dialog header content
const customerName = computed((): string => {
  const id = form.value.customerId;
  if (!id) return '';
  const found = props.customers.find((c) => c.id === id);
  return found?.name || '';
});

const dialogTitle = computed((): string => {
  const action = props.mode === 'edit' ? '编辑跟踪记录' : '新建跟踪记录';
  if (!customerName.value) return action;
  return `${action} — ${customerName.value}`;
});

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    if (props.mode === 'edit' && props.record) {
      form.value = {
        customerId: props.record.customerId,
        recordTime: props.record.recordTime || '',
        recorderName: props.record.recorderName || '',
        content: props.record.content || '',
        contactPerson: props.record.contactPerson || '',
        contactPhone: props.record.contactPhone || '',
        address: props.record.address || '',
        remark: props.record.remark || '',
      };
    } else {
      form.value = {
        ...empty(),
        customerId: props.initialCustomerId || '',
      };
    }
  }
);

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    submitting.value = true;
    try {
      if (props.mode === 'edit' && props.record) {
        const body: UpdateTrackingRecordRequest = {
          content: form.value.content,
          contactPerson: form.value.contactPerson || undefined,
          contactPhone: form.value.contactPhone || undefined,
          address: form.value.address || undefined,
          remark: form.value.remark || undefined,
        };
        await updateTrackingRecord(props.factoryId, props.record.id, body);
        ElMessage.success('已更新跟踪记录');
      } else {
        const body: CreateTrackingRecordRequest = {
          customerId: form.value.customerId,
          recordTime: form.value.recordTime || undefined,
          recorderName: form.value.recorderName || undefined,
          content: form.value.content,
          contactPerson: form.value.contactPerson || undefined,
          contactPhone: form.value.contactPhone || undefined,
          address: form.value.address || undefined,
          remark: form.value.remark || undefined,
        };
        await createTrackingRecord(props.factoryId, body);
        ElMessage.success('已创建跟踪记录');
      }
      emit('saved');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '保存失败';
      ElMessage.error(msg);
    } finally {
      submitting.value = false;
    }
  });
}

function close(): void {
  if (submitting.value) return;
  emit('update:modelValue', false);
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="600px"
    :close-on-click-modal="false"
    @update:model-value="close"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="客户" prop="customerId">
        <el-select
          v-model="form.customerId"
          placeholder="请选择客户"
          filterable
          :disabled="mode === 'edit'"
          style="width: 100%"
        >
          <el-option
            v-for="c in customers"
            :key="c.id"
            :value="c.id"
            :label="c.name"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="跟踪时间">
        <el-date-picker
          v-model="form.recordTime"
          type="datetime"
          placeholder="留空 = 当前时间"
          value-format="YYYY-MM-DDTHH:mm:ss"
          :disabled="mode === 'edit'"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item v-if="mode === 'create'" label="记录人">
        <el-input v-model="form.recorderName" placeholder="记录人姓名 (可选)" />
      </el-form-item>

      <el-form-item label="联系人">
        <el-input v-model="form.contactPerson" placeholder="本次接洽联系人" />
      </el-form-item>

      <el-form-item label="联系电话">
        <el-input v-model="form.contactPhone" placeholder="联系电话" />
      </el-form-item>

      <el-form-item label="地址">
        <el-input v-model="form.address" placeholder="拜访地址 (可选)" />
      </el-form-item>

      <el-form-item label="跟踪内容" prop="content">
        <el-input
          v-model="form.content"
          type="textarea"
          :rows="4"
          placeholder="拜访 / 电话 / 沟通内容..."
        />
      </el-form-item>

      <el-form-item label="备注">
        <el-input
          v-model="form.remark"
          type="textarea"
          :rows="2"
          placeholder="补充备注 (可选)"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button :disabled="submitting" @click="close">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ mode === 'edit' ? '保存' : '创建' }}
      </el-button>
    </template>
  </el-dialog>
</template>
