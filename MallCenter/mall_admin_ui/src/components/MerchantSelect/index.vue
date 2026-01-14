<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { getMerchantList } from "@/api/mall/merchant";
import type { MerchantSimple } from "@/api/mall/types/merchant";

defineOptions({
  name: "MerchantSelect"
});

// Props 定义
interface Props {
  /** v-model 绑定值 */
  modelValue?: number | string | null;
  /** 占位符 */
  placeholder?: string;
  /** 是否可清空 */
  clearable?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否显示"全部"选项 */
  showAll?: boolean;
  /** "全部"选项的标签文本 */
  allLabel?: string;
  /** "全部"选项的值 */
  allValue?: number | string | null;
  /** 选择框宽度 */
  width?: string | number;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  placeholder: "请选择商户",
  clearable: true,
  disabled: false,
  showAll: false,
  allLabel: "全部",
  allValue: null,
  width: "200px"
});

// Emits 定义
const emit = defineEmits<{
  (e: "update:modelValue", value: number | string | null): void;
  (e: "change", value: number | string | null, merchant: MerchantSimple | null): void;
}>();

// 内部状态
const loading = ref(false);
const merchantList = ref<MerchantSimple[]>([]);
const selectedValue = ref<number | string | null>(props.modelValue);

// 计算样式宽度
const selectStyle = {
  width: typeof props.width === "number" ? `${props.width}px` : props.width
};

// 获取商户列表
const fetchMerchantList = async () => {
  loading.value = true;
  try {
    const res = await getMerchantList();
    if (res.code === 200) {
      merchantList.value = res.data || [];
    } else {
      console.error("获取商户列表失败:", res.msg);
      merchantList.value = [];
    }
  } catch (error) {
    console.error("获取商户列表失败:", error);
    merchantList.value = [];
  } finally {
    loading.value = false;
  }
};

// 选择变更处理
const handleChange = (value: number | string | null) => {
  emit("update:modelValue", value);

  // 查找选中的商户信息
  const merchant = value !== null && value !== props.allValue
    ? merchantList.value.find(m => m.id === value) || null
    : null;

  emit("change", value, merchant);
};

// 监听外部 modelValue 变化
watch(
  () => props.modelValue,
  (newVal) => {
    selectedValue.value = newVal;
  }
);

// 组件挂载时加载数据
onMounted(() => {
  fetchMerchantList();
});

// 暴露刷新方法
defineExpose({
  refresh: fetchMerchantList
});
</script>

<template>
  <el-select
    v-model="selectedValue"
    :placeholder="placeholder"
    :clearable="clearable"
    :disabled="disabled"
    :loading="loading"
    :style="selectStyle"
    @change="handleChange"
  >
    <!-- 全部选项 -->
    <el-option
      v-if="showAll"
      :label="allLabel"
      :value="allValue"
    />
    <!-- 商户选项 -->
    <el-option
      v-for="merchant in merchantList"
      :key="merchant.id"
      :label="merchant.merchantName"
      :value="merchant.id"
    />
  </el-select>
</template>
