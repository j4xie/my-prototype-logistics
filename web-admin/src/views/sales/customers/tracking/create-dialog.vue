<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { createTrackingRecord, type CreateTrackingRecordRequest } from '@/api/customerTracking';

const props = defineProps<{
  modelValue: boolean;
  factoryId: string;
  initialCustomerId?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', open: boolean): void;
  (e: 'created'): void;
}>();

const formRef = ref<FormInstance>();
const form = ref<CreateTrackingRecordRequest>({
  customerId: '',
  recordTime: undefined,
  recorderName: '',
  recorderId: undefined,
  content: '',
  contactPerson: '',
  contactPhone: '',
  address: '',
  remark: '',
});
const submitting = ref(false);

const rules: FormRules = {
  customerId: [{ required: true, message: '请输入客户 ID', trigger: 'blur' }],
  content: [{ required: true, message: '请填写跟踪内容', trigger: 'blur' }],
};

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      form.value = {
        customerId: props.initialCustomerId || '',
        recordTime: undefined,
        recorderName: '',
        recorderId: undefined,
        content: '',
        contactPerson: '',
        contactPhone: '',
        address: '',
        remark: '',
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
      await createTrackingRecord(props.factoryId, form.value);
      ElMessage.success('已创建跟踪记录');
      emit('created');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '创建失败';
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
    title="新建客户跟踪记录"
    width="560px"
    :close-on-click-modal="false"
    @update:model-value="close"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="客户 ID" prop="customerId">
        <el-input v-model="form.customerId" placeholder="客户唯一 ID" />
      </el-form-item>
      <el-form-item label="跟踪时间">
        <el-date-picker
          v-model="form.recordTime"
          type="datetime"
          placeholder="默认当前时间"
          value-format="YYYY-MM-DDTHH:mm:ss"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="记录人">
        <el-input v-model="form.recorderName" placeholder="记录人姓名" />
      </el-form-item>
      <el-form-item label="联系人">
        <el-input v-model="form.contactPerson" />
      </el-form-item>
      <el-form-item label="联系电话">
        <el-input v-model="form.contactPhone" />
      </el-form-item>
      <el-form-item label="地址">
        <el-input v-model="form.address" />
      </el-form-item>
      <el-form-item label="跟踪内容" prop="content">
        <el-input v-model="form.content" type="textarea" :rows="4" placeholder="拜访 / 电话 / 沟通内容..." />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="2" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="submitting" @click="close">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        创建
      </el-button>
    </template>
  </el-dialog>
</template>
