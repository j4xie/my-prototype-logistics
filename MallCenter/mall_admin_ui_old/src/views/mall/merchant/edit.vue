<!--
  商户编辑页
-->
<template>
  <div class="app-container merchant-edit">
    <!-- 页面头部 -->
    <div class="page-header">
      <el-page-header @back="goBack" title="返回">
        <template #content>
          <span class="page-title">编辑商户</span>
        </template>
      </el-page-header>
    </div>

    <el-card v-loading="loading">
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="120px"
        label-position="right"
      >
        <!-- 基本信息 -->
        <el-divider content-position="left">基本信息</el-divider>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="商户名称" prop="merchantName">
              <el-input v-model="form.merchantName" placeholder="请输入商户名称" maxlength="100" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="商户简称" prop="shortName">
              <el-input v-model="form.shortName" placeholder="请输入商户简称" maxlength="50" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="商户编号" prop="merchantNo">
              <el-input v-model="form.merchantNo" placeholder="系统自动生成" disabled />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="商户Logo" prop="logoUrl">
              <ImageUpload :limit="1" v-model="form.logoUrl" />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 法人信息 -->
        <el-divider content-position="left">法人信息</el-divider>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="法人姓名" prop="legalPerson">
              <el-input v-model="form.legalPerson" placeholder="请输入法人姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="法人身份证" prop="legalIdCard">
              <el-input v-model="form.legalIdCard" placeholder="请输入法人身份证号" maxlength="18" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="营业执照号" prop="licenseNo">
              <el-input v-model="form.licenseNo" placeholder="请输入营业执照号" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="营业执照" prop="licenseImage">
              <ImageUpload :limit="1" v-model="form.licenseImage" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="身份证正面" prop="legalIdFront">
              <ImageUpload :limit="1" v-model="form.legalIdFront" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="身份证反面" prop="legalIdBack">
              <ImageUpload :limit="1" v-model="form.legalIdBack" />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 联系信息 -->
        <el-divider content-position="left">联系信息</el-divider>

        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="联系人" prop="contactName">
              <el-input v-model="form.contactName" placeholder="请输入联系人姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="联系电话" prop="contactPhone">
              <el-input v-model="form.contactPhone" placeholder="请输入联系电话" maxlength="11" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="联系邮箱" prop="contactEmail">
              <el-input v-model="form.contactEmail" placeholder="请输入联系邮箱" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="经营地址" prop="address">
          <el-input v-model="form.address" placeholder="请输入详细经营地址" />
        </el-form-item>

        <!-- 银行信息 -->
        <el-divider content-position="left">银行信息</el-divider>

        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="开户银行" prop="bankName">
              <el-input v-model="form.bankName" placeholder="请输入开户银行" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="支行名称" prop="bankBranch">
              <el-input v-model="form.bankBranch" placeholder="请输入支行名称" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="银行账户" prop="bankAccount">
              <el-input v-model="form.bankAccount" placeholder="请输入银行账户" />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 其他信息 -->
        <el-divider content-position="left">其他信息</el-divider>

        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="经营年限" prop="operatingYears">
              <el-input-number
                v-model="form.operatingYears"
                :min="0"
                :max="100"
                controls-position="right"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="商户状态" prop="status">
              <el-select v-model="form.status" placeholder="请选择状态" style="width: 100%">
                <el-option label="待审核" :value="0" />
                <el-option label="已认证" :value="1" />
                <el-option label="已封禁" :value="2" />
                <el-option label="已注销" :value="3" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </el-card>

    <!-- 底部操作栏 -->
    <div class="footer-actions">
      <el-button @click="goBack">取消</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="submitting">
        保存修改
      </el-button>
    </div>
  </div>
</template>

<script setup name="MerchantEdit">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getObj, putObj } from '@/api/mall/merchant'

const router = useRouter()
const route = useRoute()

// 商户ID
const merchantId = ref(null)

// 加载状态
const loading = ref(false)
const submitting = ref(false)

// 表单引用
const formRef = ref(null)

// 表单数据
const form = reactive({
  id: null,
  merchantName: '',
  shortName: '',
  merchantNo: '',
  logoUrl: '',
  legalPerson: '',
  legalIdCard: '',
  licenseNo: '',
  licenseImage: '',
  legalIdFront: '',
  legalIdBack: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  address: '',
  bankName: '',
  bankBranch: '',
  bankAccount: '',
  operatingYears: 0,
  status: 0
})

// 表单验证规则
const rules = {
  merchantName: [
    { required: true, message: '请输入商户名称', trigger: 'blur' },
    { max: 100, message: '商户名称不能超过100个字符', trigger: 'blur' }
  ],
  legalPerson: [
    { required: true, message: '请输入法人姓名', trigger: 'blur' }
  ],
  contactPhone: [
    { required: true, message: '请输入联系电话', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ],
  contactEmail: [
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ]
}

// 加载商户数据
const loadMerchant = async () => {
  if (!merchantId.value) return

  loading.value = true
  try {
    const res = await getObj(merchantId.value)
    const data = res.data || res || {}

    Object.keys(form).forEach(key => {
      if (data[key] !== undefined) {
        form[key] = data[key]
      }
    })
  } catch (error) {
    console.error('获取商户详情失败:', error)
    ElMessage.error('获取商户详情失败')
  } finally {
    loading.value = false
  }
}

// 返回列表
const goBack = () => {
  router.push('/mall/merchant')
}

// 提交表单
const handleSubmit = async () => {
  try {
    await formRef.value.validate()
  } catch (error) {
    ElMessage.warning('请完善必填信息')
    return
  }

  submitting.value = true
  try {
    await putObj(form)
    ElMessage.success('保存成功')
    goBack()
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败，请重试')
  } finally {
    submitting.value = false
  }
}

// 初始化
onMounted(() => {
  merchantId.value = route.params.id || route.query.id

  if (!merchantId.value) {
    ElMessage.error('缺少商户ID参数')
    goBack()
    return
  }

  loadMerchant()
})
</script>

<style lang="scss" scoped>
.merchant-edit {
  .page-header {
    margin-bottom: 20px;
    .page-title {
      font-size: 18px;
      font-weight: 600;
    }
  }

  .el-card {
    margin-bottom: 80px;
  }

  .footer-actions {
    position: fixed;
    bottom: 0;
    left: 210px;
    right: 0;
    padding: 12px 20px;
    background: #fff;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    z-index: 100;
  }
}

.hideSidebar .merchant-edit .footer-actions {
  left: 54px;
}
</style>
