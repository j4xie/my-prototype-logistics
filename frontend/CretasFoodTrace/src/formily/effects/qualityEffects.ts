/**
 * 质检表单联动效果
 *
 * 提供表单级别的联动逻辑，配合 Schema 中的 x-reactions 使用
 */

import { Form, onFieldValueChange, onFormInit } from '@formily/core';

/**
 * 质检表单联动效果
 *
 * 注册以下联动:
 * 1. 检测结果变化时，清空不合格原因（如果从FAIL切换到其他）
 * 2. 温度异常时，自动建议不合格
 * 3. 表单初始化时的默认值设置
 */
export const createQualityCheckEffects = (form: Form) => {
  // 1. 检测结果变化时的联动
  onFieldValueChange('result', (field) => {
    const result = field.value;

    // 如果从不合格切换到其他状态，清空不合格原因
    if (result !== 'FAIL') {
      form.setFieldState('failReason', (state) => {
        state.value = '';
      });
    }
  });

  // 2. 温度异常时的联动建议
  onFieldValueChange('temperature', (field) => {
    const temp = field.value as number;

    // 冷链产品温度异常判断 (示例：-18°C 以下为正常)
    if (temp !== undefined && temp > -15) {
      // 温度偏高，可以在这里添加提示逻辑
      // 注意：不自动改变result值，只是提示
      console.log('温度偏高警告:', temp);
    }
  });

  // 3. 表单初始化
  onFormInit(() => {
    // 可以在这里设置默认值或执行初始化逻辑
    console.log('质检表单初始化');
  });
};

/**
 * 温度范围检查效果
 *
 * 根据产品类型动态调整温度验证规则
 */
export const createTemperatureRangeEffect = (
  form: Form,
  productType: 'frozen' | 'chilled' | 'ambient'
) => {
  const temperatureRanges = {
    frozen: { min: -25, max: -15, label: '冷冻产品' },
    chilled: { min: 0, max: 8, label: '冷藏产品' },
    ambient: { min: 15, max: 30, label: '常温产品' },
  };

  const range = temperatureRanges[productType];

  onFieldValueChange('temperature', (field) => {
    const temp = field.value as number;

    if (temp !== undefined) {
      if (temp < range.min || temp > range.max) {
        // 温度超出范围，添加警告
        field.setFeedback({
          type: 'warning',
          code: 'temperature_warning',
          messages: [
            `${range.label}温度应在 ${range.min}°C ~ ${range.max}°C 之间`,
          ],
        });
      } else {
        // 清除警告
        field.setFeedback({
          type: 'warning',
          code: 'temperature_warning',
          messages: [],
        });
      }
    }
  });
};

/**
 * 自动填充效果
 *
 * 当扫描批次号时，自动填充相关信息
 */
export const createAutoFillEffect = (
  form: Form,
  fetchBatchInfo: (batchNumber: string) => Promise<{
    productType?: string;
    expectedTemp?: number;
  } | null>
) => {
  onFieldValueChange('batchNumber', async (field) => {
    const batchNumber = field.value as string;

    // 批次号格式验证 (至少8位)
    if (batchNumber && batchNumber.length >= 8) {
      try {
        const batchInfo = await fetchBatchInfo(batchNumber);
        if (batchInfo) {
          // 可以在这里自动填充产品类型等信息
          console.log('批次信息:', batchInfo);
        }
      } catch (error) {
        console.error('获取批次信息失败:', error);
      }
    }
  });
};

export default createQualityCheckEffects;
