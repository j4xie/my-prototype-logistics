/**
 * Excel模板生成和下载工具
 * 用于白名单批量上传功能
 */

/**
 * 生成员工白名单Excel模板
 * 包含Phone Number列和示例数据
 */
export const generateWhitelistTemplate = () => {
  // 创建模板数据
  const templateData = [
    ['Phone Number'], // 表头
    ['13800138001'],   // 示例数据1
    ['13800138002'],   // 示例数据2
    ['13800138003'],   // 示例数据3
    [''],             // 空行用于用户填写
    [''],             // 空行用于用户填写
    [''],             // 空行用于用户填写
    [''],             // 空行用于用户填写
    [''],             // 空行用于用户填写
    [''],             // 空行用于用户填写
    [''],             // 空行用于用户填写
  ];

  // 转换为CSV格式
  const csvContent = templateData.map(row => row.join(',')).join('\n');

  return csvContent;
};

/**
 * 下载Excel模板文件
 * @param factoryName 工厂名称，用于文件命名
 */
export const downloadWhitelistTemplate = (factoryName: string) => {
  const csvContent = generateWhitelistTemplate();
  const fileName = `员工白名单模板_${factoryName}_${new Date().toISOString().split('T')[0]}.csv`;

  // 创建Blob对象
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });

  // 创建下载链接
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // 清理URL对象
  URL.revokeObjectURL(url);
};

/**
 * 解析上传的CSV/Excel文件
 * @param file 上传的文件
 * @returns Promise<string[]> 电话号码列表
 */
export const parseWhitelistFile = (file: File): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');

        // 过滤掉表头和空行，提取电话号码
        const phoneNumbers: string[] = [];

        for (let i = 1; i < lines.length; i++) { // 跳过表头
          const line = lines[i].trim();
          if (line && line !== 'Phone Number') {
            // 处理CSV格式，提取第一列
            const phoneNumber = line.split(',')[0].trim();
            if (phoneNumber && isValidPhoneNumber(phoneNumber)) {
              phoneNumbers.push(phoneNumber);
            }
          }
        }

        resolve(phoneNumbers);
      } catch (error) {
        reject(new Error('文件解析失败，请检查文件格式'));
      }
    };

    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };

    reader.readAsText(file, 'UTF-8');
  });
};

/**
 * 验证电话号码格式
 * @param phoneNumber 电话号码
 * @returns boolean 是否为有效格式
 */
export const isValidPhoneNumber = (phoneNumber: string): boolean => {
  // 中国手机号码正则表达式
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phoneNumber);
};

/**
 * 批量验证电话号码
 * @param phoneNumbers 电话号码列表
 * @returns { valid: string[], invalid: string[] } 分类结果
 */
export const validatePhoneNumbers = (phoneNumbers: string[]) => {
  const valid: string[] = [];
  const invalid: string[] = [];

  phoneNumbers.forEach(phone => {
    if (isValidPhoneNumber(phone)) {
      valid.push(phone);
    } else {
      invalid.push(phone);
    }
  });

  return { valid, invalid };
};
