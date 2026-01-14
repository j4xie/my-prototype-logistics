<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { ArrowLeft } from "@element-plus/icons-vue";
import { message } from "@/utils/message";
import type { FormInstance, FormRules } from "element-plus";
import {
  getGoodsSpuById,
  createGoodsSpu,
  updateGoodsSpu
} from "@/api/mall/goodsSpu";
import type { GoodsSpuForm } from "@/api/mall/types/goodsSpu";

defineOptions({
  name: "GoodsSpuForm"
});

const router = useRouter();
const route = useRoute();

// 表单引用
const formRef = ref<FormInstance>();

// 加载状态
const loading = ref(false);
const submitLoading = ref(false);

// 是否编辑模式
const isEdit = computed(() => !!route.params.id);

// 页面标题
const pageTitle = computed(() => (isEdit.value ? "编辑商品" : "新增商品"));

// 表单数据
const formData = reactive<GoodsSpuForm>({
  id: undefined,
  name: "",
  categoryId: "",
  picUrls: [],
  description: "",
  sellPoint: "",
  price: 0,
  marketPrice: undefined,
  stock: 0,
  status: "0",
  sort: 0
});

// 表单验证规则
const formRules: FormRules = {
  name: [
    { required: true, message: "请输入商品名称", trigger: "blur" },
    { min: 2, max: 100, message: "商品名称长度应在2-100个字符之间", trigger: "blur" }
  ],
  categoryId: [
    { required: true, message: "请选择商品分类", trigger: "change" }
  ],
  price: [
    { required: true, message: "请输入销售价格", trigger: "blur" },
    {
      validator: (_rule, value, callback) => {
        if (value <= 0) {
          callback(new Error("价格必须大于0"));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ],
  stock: [
    { required: true, message: "请输入库存数量", trigger: "blur" },
    {
      validator: (_rule, value, callback) => {
        if (value < 0) {
          callback(new Error("库存不能小于0"));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ],
  status: [
    { required: true, message: "请选择商品状态", trigger: "change" }
  ],
  sort: [
    { required: true, message: "请输入排序值", trigger: "blur" }
  ]
};

// 分类选项（实际项目中应从API获取）
const categoryOptions = ref([
  { id: "1", name: "食品饮料" },
  { id: "2", name: "生鲜果蔬" },
  { id: "3", name: "肉禽蛋奶" },
  { id: "4", name: "粮油调味" },
  { id: "5", name: "零食糖果" }
]);

// 获取商品详情
const fetchDetail = async () => {
  const id = route.params.id as string;
  if (!id) return;

  loading.value = true;
  try {
    const res = await getGoodsSpuById(id);
    if (res.code === 200) {
      const data = res.data;
      formData.id = data.id;
      formData.name = data.name;
      formData.categoryId = data.categoryId;
      formData.picUrls = data.picUrls || [];
      formData.description = data.description || "";
      formData.sellPoint = data.sellPoint || "";
      formData.price = data.price;
      formData.marketPrice = data.marketPrice;
      formData.stock = data.stock;
      formData.status = data.status;
      formData.sort = data.sort;
    } else {
      message(res.msg || "获取商品详情失败", { type: "error" });
    }
  } catch (error) {
    message("获取商品详情失败", { type: "error" });
  } finally {
    loading.value = false;
  }
};

// 提交表单
const handleSubmit = async () => {
  const valid = await formRef.value?.validate();
  if (!valid) return;

  submitLoading.value = true;
  try {
    const res = isEdit.value
      ? await updateGoodsSpu(formData)
      : await createGoodsSpu(formData);

    if (res.code === 200) {
      message(isEdit.value ? "修改成功" : "新增成功", { type: "success" });
      router.push("/mall/goodsSpu");
    } else {
      message(res.msg || (isEdit.value ? "修改失败" : "新增失败"), {
        type: "error"
      });
    }
  } catch (error) {
    message(isEdit.value ? "修改失败" : "新增失败", { type: "error" });
  } finally {
    submitLoading.value = false;
  }
};

// 取消
const handleCancel = () => {
  router.push("/mall/goodsSpu");
};

// 返回列表
const goBack = () => {
  router.push("/mall/goodsSpu");
};

// 图片上传成功处理
const handleImageSuccess = (response: { url: string }) => {
  if (!formData.picUrls) {
    formData.picUrls = [];
  }
  formData.picUrls.push(response.url);
};

// 删除图片
const handleImageRemove = (index: number) => {
  formData.picUrls?.splice(index, 1);
};

onMounted(() => {
  if (isEdit.value) {
    fetchDetail();
  }
});
</script>

<template>
  <div class="goods-spu-form">
    <!-- 页头 -->
    <el-card shadow="never" class="page-header">
      <div class="header-content">
        <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
        <span class="title">{{ pageTitle }}</span>
      </div>
    </el-card>

    <!-- 表单 -->
    <el-card shadow="never" class="form-card" v-loading="loading">
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
        style="max-width: 800px"
      >
        <el-form-item label="商品名称" prop="name">
          <el-input
            v-model="formData.name"
            placeholder="请输入商品名称"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="商品分类" prop="categoryId">
          <el-select
            v-model="formData.categoryId"
            placeholder="请选择商品分类"
            style="width: 100%"
          >
            <el-option
              v-for="item in categoryOptions"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="商品图片" prop="picUrls">
          <div class="image-list">
            <div
              v-for="(url, index) in formData.picUrls"
              :key="index"
              class="image-item"
            >
              <el-image :src="url" fit="cover" class="image" />
              <div class="image-actions">
                <el-button
                  type="danger"
                  size="small"
                  circle
                  @click="handleImageRemove(index)"
                >
                  X
                </el-button>
              </div>
            </div>
            <el-upload
              action="/api/upload"
              :show-file-list="false"
              accept="image/*"
              :on-success="handleImageSuccess"
              class="image-uploader"
            >
              <div class="upload-trigger">
                <el-icon size="24">
                  <Plus />
                </el-icon>
                <span>上传图片</span>
              </div>
            </el-upload>
          </div>
          <div class="form-tip">建议尺寸：800x800像素，支持jpg、png格式</div>
        </el-form-item>

        <el-form-item label="卖点" prop="sellPoint">
          <el-input
            v-model="formData.sellPoint"
            placeholder="请输入商品卖点"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="商品描述" prop="description">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="4"
            placeholder="请输入商品描述"
            maxlength="1000"
            show-word-limit
          />
        </el-form-item>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="销售价格" prop="price">
              <el-input-number
                v-model="formData.price"
                :min="0"
                :precision="0"
                :controls="false"
                placeholder="请输入价格（单位：分）"
                style="width: 100%"
              />
              <div class="form-tip">单位：分（1元=100分）</div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="市场价格" prop="marketPrice">
              <el-input-number
                v-model="formData.marketPrice"
                :min="0"
                :precision="0"
                :controls="false"
                placeholder="请输入市场价格（可选）"
                style="width: 100%"
              />
              <div class="form-tip">用于显示划线价</div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="库存数量" prop="stock">
              <el-input-number
                v-model="formData.stock"
                :min="0"
                :precision="0"
                placeholder="请输入库存数量"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="排序值" prop="sort">
              <el-input-number
                v-model="formData.sort"
                :min="0"
                :precision="0"
                placeholder="请输入排序值"
                style="width: 100%"
              />
              <div class="form-tip">数值越小排序越靠前</div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="商品状态" prop="status">
          <el-radio-group v-model="formData.status">
            <el-radio value="1">上架</el-radio>
            <el-radio value="0">下架</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            :loading="submitLoading"
            @click="handleSubmit"
          >
            {{ isEdit ? "保存修改" : "确认新增" }}
          </el-button>
          <el-button @click="handleCancel">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script lang="ts">
import { Plus } from "@element-plus/icons-vue";

export default {
  components: { Plus }
};
</script>

<style lang="scss" scoped>
.goods-spu-form {
  padding: 20px;

  .page-header {
    margin-bottom: 16px;

    .header-content {
      display: flex;
      align-items: center;
      gap: 16px;

      .title {
        font-size: 18px;
        font-weight: 600;
      }
    }
  }

  .form-card {
    .form-tip {
      font-size: 12px;
      color: #909399;
      margin-top: 4px;
    }
  }

  .image-list {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;

    .image-item {
      position: relative;
      width: 120px;
      height: 120px;

      .image {
        width: 100%;
        height: 100%;
        border-radius: 8px;
        border: 1px solid #dcdfe6;
      }

      .image-actions {
        position: absolute;
        top: 4px;
        right: 4px;
      }
    }

    .image-uploader {
      .upload-trigger {
        width: 120px;
        height: 120px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        border: 1px dashed #dcdfe6;
        border-radius: 8px;
        cursor: pointer;
        transition: border-color 0.3s;

        &:hover {
          border-color: #409eff;
        }

        span {
          font-size: 12px;
          color: #909399;
          margin-top: 8px;
        }
      }
    }
  }
}
</style>
