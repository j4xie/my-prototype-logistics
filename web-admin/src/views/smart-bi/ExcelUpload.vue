<script setup lang="ts">
/**
 * SmartBI Excel 上传页面
 * 支持 Excel 文件上传、数据类型选择、字段映射和导入确认
 */
import { ref, computed, reactive } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { post } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { UploadFile, UploadUserFile } from 'element-plus';
import {
  Upload,
  Document,
  Check,
  Close,
  Refresh,
  Download,
  ArrowRight
} from '@element-plus/icons-vue';

const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);

// 上传步骤
const currentStep = ref(0);
const steps = [
  { title: '上传文件', description: '选择 Excel 文件' },
  { title: '选择类型', description: '选择数据类型' },
  { title: '字段映射', description: '确认字段对应关系' },
  { title: '导入确认', description: '预览并确认导入' }
];

// 上传状态
const uploading = ref(false);
const uploadProgress = ref(0);
const fileList = ref<UploadUserFile[]>([]);

// 数据类型
interface DataType {
  value: string;
  label: string;
  description: string;
  requiredFields: string[];
}

const dataTypes: DataType[] = [
  {
    value: 'sales',
    label: '销售数据',
    description: '包含订单、客户、销售额等销售相关数据',
    requiredFields: ['日期', '客户名称', '产品名称', '数量', '金额']
  },
  {
    value: 'finance',
    label: '财务数据',
    description: '包含收入、成本、利润等财务相关数据',
    requiredFields: ['日期', '科目', '金额', '类型']
  },
  {
    value: 'inventory',
    label: '库存数据',
    description: '包含库存数量、进出库记录等仓储数据',
    requiredFields: ['日期', '产品名称', '数量', '操作类型']
  },
  {
    value: 'customer',
    label: '客户数据',
    description: '包含客户信息、联系方式等基础数据',
    requiredFields: ['客户名称', '联系人', '电话', '地址']
  },
  {
    value: 'product',
    label: '产品数据',
    description: '包含产品信息、价格、规格等基础数据',
    requiredFields: ['产品名称', '类别', '规格', '单价']
  }
];

const selectedDataType = ref<string>('');

// 字段映射
interface FieldMapping {
  sourceField: string;
  targetField: string;
  matched: boolean;
  sample: string;
}

const fieldMappings = ref<FieldMapping[]>([]);

// 解析结果
interface ParseResult {
  totalRows: number;
  validRows: number;
  errorRows: number;
  headers: string[];
  sampleData: Record<string, string>[];
  errors: string[];
}

const parseResult = ref<ParseResult>({
  totalRows: 0,
  validRows: 0,
  errorRows: 0,
  headers: [],
  sampleData: [],
  errors: []
});

// 导入结果
interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
}

const importResult = ref<ImportResult | null>(null);
const importing = ref(false);

// 目标字段选项
const targetFieldOptions = computed(() => {
  const selectedType = dataTypes.find(t => t.value === selectedDataType.value);
  if (!selectedType) return [];
  return selectedType.requiredFields.map(field => ({
    value: field,
    label: field
  }));
});

// 处理文件上传
async function handleUpload(file: UploadFile) {
  if (!file.raw) return;

  const validTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];

  if (!validTypes.includes(file.raw.type)) {
    ElMessage.error('请上传 Excel 文件 (.xlsx 或 .xls)');
    return false;
  }

  if (file.raw.size > 10 * 1024 * 1024) {
    ElMessage.error('文件大小不能超过 10MB');
    return false;
  }

  fileList.value = [file];
  uploading.value = true;
  uploadProgress.value = 0;

  try {
    // 模拟上传进度
    const progressInterval = setInterval(() => {
      if (uploadProgress.value < 90) {
        uploadProgress.value += 10;
      }
    }, 100);

    // 解析 Excel 文件
    const formData = new FormData();
    formData.append('file', file.raw);

    // 这里应该调用后端 API 解析文件
    // const response = await post(`/${factoryId.value}/smart-bi/excel/parse`, formData);

    // 模拟解析结果
    await new Promise(resolve => setTimeout(resolve, 1500));
    clearInterval(progressInterval);
    uploadProgress.value = 100;

    parseResult.value = {
      totalRows: 156,
      validRows: 152,
      errorRows: 4,
      headers: ['日期', '客户名称', '产品名称', '数量', '单价', '金额', '备注'],
      sampleData: [
        { '日期': '2026-01-15', '客户名称': '上海食品公司', '产品名称': '冷冻牛肉', '数量': '100', '单价': '85', '金额': '8500', '备注': '' },
        { '日期': '2026-01-15', '客户名称': '北京餐饮集团', '产品名称': '冷冻猪肉', '数量': '200', '单价': '45', '金额': '9000', '备注': '加急' },
        { '日期': '2026-01-16', '客户名称': '广州生鲜超市', '产品名称': '冷冻鸡肉', '数量': '150', '单价': '32', '金额': '4800', '备注': '' }
      ],
      errors: [
        '第 45 行: 金额格式错误',
        '第 78 行: 客户名称为空',
        '第 102 行: 日期格式错误',
        '第 134 行: 数量为负数'
      ]
    };

    currentStep.value = 1;
    ElMessage.success('文件解析成功');
  } catch (error) {
    console.error('文件上传失败:', error);
    ElMessage.error('文件上传失败');
  } finally {
    uploading.value = false;
  }

  return false;
}

// 选择数据类型
function handleSelectDataType(type: string) {
  selectedDataType.value = type;

  // 自动匹配字段
  const selectedType = dataTypes.find(t => t.value === type);
  if (!selectedType) return;

  fieldMappings.value = parseResult.value.headers.map(header => {
    const matchedField = selectedType.requiredFields.find(
      field => field === header || header.includes(field) || field.includes(header)
    );
    return {
      sourceField: header,
      targetField: matchedField || '',
      matched: !!matchedField,
      sample: parseResult.value.sampleData[0]?.[header] || ''
    };
  });
}

// 进入下一步
function nextStep() {
  if (currentStep.value === 1 && !selectedDataType.value) {
    ElMessage.warning('请选择数据类型');
    return;
  }

  if (currentStep.value === 2) {
    const requiredFields = dataTypes.find(t => t.value === selectedDataType.value)?.requiredFields || [];
    const mappedFields = fieldMappings.value.filter(m => m.targetField).map(m => m.targetField);
    const missingFields = requiredFields.filter(f => !mappedFields.includes(f));

    if (missingFields.length > 0) {
      ElMessage.warning(`缺少必填字段映射: ${missingFields.join(', ')}`);
      return;
    }
  }

  currentStep.value++;
}

// 返回上一步
function prevStep() {
  if (currentStep.value > 0) {
    currentStep.value--;
  }
}

// 确认导入
async function handleImport() {
  try {
    await ElMessageBox.confirm(
      `即将导入 ${parseResult.value.validRows} 条数据，是否继续？`,
      '确认导入',
      { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' }
    );

    importing.value = true;

    // 调用后端 API 导入数据
    // const response = await post(`/${factoryId.value}/smart-bi/excel/import`, {
    //   dataType: selectedDataType.value,
    //   mappings: fieldMappings.value,
    //   fileId: 'xxx'
    // });

    // 模拟导入过程
    await new Promise(resolve => setTimeout(resolve, 2000));

    importResult.value = {
      success: true,
      imported: parseResult.value.validRows,
      failed: parseResult.value.errorRows,
      errors: parseResult.value.errors
    };

    ElMessage.success('数据导入成功');
  } catch (error) {
    if (error !== 'cancel') {
      console.error('导入失败:', error);
      ElMessage.error('导入失败');
    }
  } finally {
    importing.value = false;
  }
}

// 重新开始
function handleReset() {
  currentStep.value = 0;
  fileList.value = [];
  selectedDataType.value = '';
  fieldMappings.value = [];
  parseResult.value = {
    totalRows: 0,
    validRows: 0,
    errorRows: 0,
    headers: [],
    sampleData: [],
    errors: []
  };
  importResult.value = null;
}

// 下载模板
function handleDownloadTemplate() {
  if (!selectedDataType.value) {
    ElMessage.warning('请先选择数据类型');
    return;
  }
  ElMessage.info('模板下载功能开发中...');
}
</script>

<template>
  <div class="excel-upload-page">
    <div class="page-header">
      <div class="header-left">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/smart-bi' }">Smart BI</el-breadcrumb-item>
          <el-breadcrumb-item>数据导入</el-breadcrumb-item>
        </el-breadcrumb>
        <h1>Excel 数据导入</h1>
      </div>
      <div class="header-right">
        <el-button :icon="Download" @click="handleDownloadTemplate">下载模板</el-button>
        <el-button :icon="Refresh" @click="handleReset">重新开始</el-button>
      </div>
    </div>

    <!-- 步骤条 -->
    <el-card class="steps-card">
      <el-steps :active="currentStep" finish-status="success" align-center>
        <el-step
          v-for="(step, index) in steps"
          :key="index"
          :title="step.title"
          :description="step.description"
        />
      </el-steps>
    </el-card>

    <!-- 步骤内容 -->
    <el-card class="content-card">
      <!-- 步骤 1: 上传文件 -->
      <div v-show="currentStep === 0" class="step-content">
        <el-upload
          class="upload-area"
          drag
          action=""
          :auto-upload="false"
          :file-list="fileList"
          :on-change="handleUpload"
          :limit="1"
          accept=".xlsx,.xls"
        >
          <el-icon class="upload-icon" v-if="!uploading"><Upload /></el-icon>
          <el-progress
            v-else
            type="circle"
            :percentage="uploadProgress"
            :width="80"
          />
          <div class="upload-text">
            <template v-if="!uploading">
              <p class="main-text">将文件拖到此处，或<em>点击上传</em></p>
              <p class="sub-text">支持 .xlsx 和 .xls 格式，文件大小不超过 10MB</p>
            </template>
            <template v-else>
              <p class="main-text">正在解析文件...</p>
            </template>
          </div>
        </el-upload>

        <div class="upload-tips">
          <h4>上传说明</h4>
          <ul>
            <li>支持 Excel 2007+ 格式 (.xlsx) 和 Excel 97-2003 格式 (.xls)</li>
            <li>第一行应为列标题，从第二行开始为数据</li>
            <li>建议使用系统提供的模板上传数据</li>
            <li>日期格式推荐使用 YYYY-MM-DD (如 2026-01-15)</li>
          </ul>
        </div>
      </div>

      <!-- 步骤 2: 选择数据类型 -->
      <div v-show="currentStep === 1" class="step-content">
        <div class="data-type-grid">
          <div
            v-for="type in dataTypes"
            :key="type.value"
            class="data-type-card"
            :class="{ selected: selectedDataType === type.value }"
            @click="handleSelectDataType(type.value)"
          >
            <el-icon><Document /></el-icon>
            <div class="type-info">
              <div class="type-label">{{ type.label }}</div>
              <div class="type-desc">{{ type.description }}</div>
            </div>
            <el-icon v-if="selectedDataType === type.value" class="check-icon"><Check /></el-icon>
          </div>
        </div>

        <div v-if="selectedDataType" class="required-fields">
          <h4>必需字段</h4>
          <div class="field-tags">
            <el-tag
              v-for="field in dataTypes.find(t => t.value === selectedDataType)?.requiredFields"
              :key="field"
              type="info"
            >
              {{ field }}
            </el-tag>
          </div>
        </div>

        <div class="step-actions">
          <el-button @click="prevStep">上一步</el-button>
          <el-button type="primary" @click="nextStep" :disabled="!selectedDataType">
            下一步
            <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>
      </div>

      <!-- 步骤 3: 字段映射 -->
      <div v-show="currentStep === 2" class="step-content">
        <div class="mapping-header">
          <div class="mapping-info">
            <span>共识别到 {{ parseResult.headers.length }} 个字段</span>
            <span class="matched">
              已匹配 {{ fieldMappings.filter(m => m.matched).length }} 个
            </span>
          </div>
        </div>

        <el-table :data="fieldMappings" stripe border>
          <el-table-column label="Excel 列名" prop="sourceField" width="150" />
          <el-table-column label="示例数据" prop="sample" min-width="150">
            <template #default="{ row }">
              <span class="sample-data">{{ row.sample || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="映射到" width="180">
            <template #default="{ row }">
              <el-select
                v-model="row.targetField"
                placeholder="选择目标字段"
                clearable
                @change="row.matched = !!row.targetField"
              >
                <el-option
                  v-for="opt in targetFieldOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                  :disabled="fieldMappings.some(m => m.targetField === opt.value && m.sourceField !== row.sourceField)"
                />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.matched" type="success" size="small">已匹配</el-tag>
              <el-tag v-else type="info" size="small">未匹配</el-tag>
            </template>
          </el-table-column>
        </el-table>

        <div class="step-actions">
          <el-button @click="prevStep">上一步</el-button>
          <el-button type="primary" @click="nextStep">
            下一步
            <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>
      </div>

      <!-- 步骤 4: 导入确认 -->
      <div v-show="currentStep === 3" class="step-content">
        <div v-if="!importResult" class="import-preview">
          <div class="preview-stats">
            <div class="stat-item">
              <div class="stat-value">{{ parseResult.totalRows }}</div>
              <div class="stat-label">总行数</div>
            </div>
            <div class="stat-item success">
              <div class="stat-value">{{ parseResult.validRows }}</div>
              <div class="stat-label">有效数据</div>
            </div>
            <div class="stat-item error">
              <div class="stat-value">{{ parseResult.errorRows }}</div>
              <div class="stat-label">错误数据</div>
            </div>
          </div>

          <div v-if="parseResult.errors.length > 0" class="error-list">
            <h4>
              <el-icon><Warning /></el-icon>
              数据错误 ({{ parseResult.errors.length }} 条)
            </h4>
            <ul>
              <li v-for="(error, index) in parseResult.errors" :key="index">{{ error }}</li>
            </ul>
          </div>

          <div class="preview-table">
            <h4>数据预览 (前 3 条)</h4>
            <el-table :data="parseResult.sampleData" stripe border size="small">
              <el-table-column
                v-for="header in parseResult.headers"
                :key="header"
                :label="header"
                :prop="header"
                min-width="100"
              />
            </el-table>
          </div>

          <div class="step-actions">
            <el-button @click="prevStep">上一步</el-button>
            <el-button
              type="primary"
              :loading="importing"
              @click="handleImport"
            >
              确认导入 {{ parseResult.validRows }} 条数据
            </el-button>
          </div>
        </div>

        <div v-else class="import-result">
          <el-result
            :icon="importResult.success ? 'success' : 'error'"
            :title="importResult.success ? '导入成功' : '导入失败'"
          >
            <template #sub-title>
              <p v-if="importResult.success">
                成功导入 {{ importResult.imported }} 条数据，
                失败 {{ importResult.failed }} 条
              </p>
              <p v-else>导入过程中发生错误</p>
            </template>
            <template #extra>
              <el-button type="primary" @click="handleReset">继续导入</el-button>
              <el-button @click="$router.push('/smart-bi')">返回驾驶舱</el-button>
            </template>
          </el-result>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.excel-upload-page {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;

  .header-left {
    h1 {
      margin: 12px 0 0;
      font-size: 20px;
      font-weight: 600;
    }
  }

  .header-right {
    display: flex;
    gap: 12px;
  }
}

.steps-card {
  margin-bottom: 16px;
  border-radius: 8px;
}

.content-card {
  border-radius: 8px;
  min-height: 500px;
}

.step-content {
  padding: 20px;
}

// 上传区域
.upload-area {
  width: 100%;

  :deep(.el-upload-dragger) {
    width: 100%;
    height: 200px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .upload-icon {
    font-size: 48px;
    color: #909399;
    margin-bottom: 16px;
  }

  .upload-text {
    .main-text {
      font-size: 16px;
      color: #606266;
      margin: 0 0 8px;

      em {
        color: #409EFF;
        font-style: normal;
      }
    }

    .sub-text {
      font-size: 13px;
      color: #909399;
      margin: 0;
    }
  }
}

.upload-tips {
  margin-top: 24px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;

  h4 {
    margin: 0 0 12px;
    font-size: 14px;
    color: #303133;
  }

  ul {
    margin: 0;
    padding-left: 20px;

    li {
      font-size: 13px;
      color: #606266;
      line-height: 2;
    }
  }
}

// 数据类型选择
.data-type-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.data-type-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border: 2px solid #ebeef5;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    border-color: #409EFF;
  }

  &.selected {
    border-color: #409EFF;
    background: #ecf5ff;
  }

  > .el-icon {
    font-size: 32px;
    color: #409EFF;
  }

  .type-info {
    flex: 1;

    .type-label {
      font-size: 16px;
      font-weight: 500;
      color: #303133;
      margin-bottom: 4px;
    }

    .type-desc {
      font-size: 13px;
      color: #909399;
    }
  }

  .check-icon {
    font-size: 24px;
    color: #67C23A;
  }
}

.required-fields {
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
  margin-bottom: 24px;

  h4 {
    margin: 0 0 12px;
    font-size: 14px;
    color: #303133;
  }

  .field-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
}

// 字段映射
.mapping-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  .mapping-info {
    font-size: 14px;
    color: #606266;

    .matched {
      color: #67C23A;
      margin-left: 16px;
    }
  }
}

.sample-data {
  color: #909399;
  font-size: 13px;
}

// 导入预览
.import-preview {
  .preview-stats {
    display: flex;
    gap: 24px;
    margin-bottom: 24px;

    .stat-item {
      flex: 1;
      text-align: center;
      padding: 20px;
      background: #f5f7fa;
      border-radius: 8px;

      .stat-value {
        font-size: 32px;
        font-weight: 600;
        color: #303133;
      }

      .stat-label {
        font-size: 14px;
        color: #909399;
        margin-top: 8px;
      }

      &.success .stat-value {
        color: #67C23A;
      }

      &.error .stat-value {
        color: #F56C6C;
      }
    }
  }

  .error-list {
    margin-bottom: 24px;
    padding: 16px;
    background: #fef0f0;
    border-radius: 8px;

    h4 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 12px;
      font-size: 14px;
      color: #F56C6C;
    }

    ul {
      margin: 0;
      padding-left: 20px;

      li {
        font-size: 13px;
        color: #606266;
        line-height: 1.8;
      }
    }
  }

  .preview-table {
    margin-bottom: 24px;

    h4 {
      margin: 0 0 12px;
      font-size: 14px;
      color: #303133;
    }
  }
}

.import-result {
  padding: 40px 0;
}

// 步骤操作
.step-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #ebeef5;
}

// 响应式
@media (max-width: 768px) {
  .data-type-grid {
    grid-template-columns: 1fr;
  }

  .preview-stats {
    flex-direction: column;
  }
}
</style>
