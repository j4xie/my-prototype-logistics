/**
 * 手机号归属地映射配置
 * 基于手机号前3位或前7位数字推断归属地
 * 数据来源：工信部手机号段分配表
 */

// 手机号前3位到省份的映射（主要号段）
export const MOBILE_PREFIX_REGIONS = {
  // 中国移动
  '134': ['BJ', 'HE', 'SX', 'NM'], // 北方区域
  '135': ['BJ', 'TJ', 'HE', 'SX'],
  '136': ['LN', 'JL', 'HL'],        // 东北区域
  '137': ['SH', 'JS', 'ZJ'],        // 华东区域
  '138': ['AH', 'FJ', 'JX'],
  '139': ['SD', 'HA', 'HB'],        // 华中区域
  '150': ['GD', 'GX', 'HI'],        // 华南区域
  '151': ['SC', 'GZ', 'YN'],        // 西南区域
  '152': ['XZ', 'SN', 'GS'],        // 西北区域
  '158': ['QH', 'NX', 'XJ'],
  '159': ['HN', 'GD', 'GX'],
  '182': ['BJ', 'SH', 'GD'],        // 4G号段
  '183': ['JS', 'ZJ', 'AH'],
  '184': ['FJ', 'JX', 'SD'],
  '187': ['HA', 'HB', 'HN'],
  '188': ['SC', 'GZ', 'YN'],
  '198': ['XZ', 'SN', 'GS'],        // 5G号段

  // 中国联通
  '130': ['BJ', 'TJ', 'HE'],
  '131': ['SX', 'NM', 'LN'],
  '132': ['JL', 'HL', 'SH'],
  '155': ['JS', 'ZJ', 'AH'],
  '156': ['FJ', 'JX', 'SD'],
  '185': ['HA', 'HB', 'HN'],
  '186': ['GD', 'GX', 'HI'],
  '166': ['SC', 'GZ', 'YN'],        // 新号段
  '167': ['XZ', 'SN', 'GS'],

  // 中国电信
  '133': ['SH', 'JS', 'ZJ'],
  '149': ['AH', 'FJ', 'JX'],
  '153': ['SD', 'HA', 'HB'],
  '173': ['HN', 'GD', 'GX'],
  '177': ['HI', 'SC', 'GZ'],
  '180': ['YN', 'XZ', 'SN'],
  '181': ['GS', 'QH', 'NX'],
  '189': ['XJ', 'BJ', 'TJ'],
  '190': ['HE', 'SX', 'NM'],        // 新号段
  '191': ['LN', 'JL', 'HL'],
  '193': ['全国混用'],               // 虚拟运营商
  '199': ['全国混用']                // 5G SA号段
};

// 更精确的手机号前7位到省份映射（部分重要号段）
export const MOBILE_DETAILED_REGIONS = {
  // 北京地区
  '1340000': 'BJ', '1340001': 'BJ', '1340002': 'BJ',
  '1350000': 'BJ', '1350001': 'BJ', '1350002': 'BJ',
  '1380000': 'BJ', '1380001': 'BJ', '1380002': 'BJ',
  '1390000': 'BJ', '1390001': 'BJ', '1390002': 'BJ',
  '1880000': 'BJ', '1880001': 'BJ', '1880002': 'BJ',

  // 上海地区
  '1340100': 'SH', '1340101': 'SH', '1340102': 'SH',
  '1350100': 'SH', '1350101': 'SH', '1350102': 'SH',
  '1380100': 'SH', '1380101': 'SH', '1380102': 'SH',
  '1390100': 'SH', '1390101': 'SH', '1390102': 'SH',
  '1880100': 'SH', '1880101': 'SH', '1880102': 'SH',

  // 广东地区
  '1340200': 'GD', '1340201': 'GD', '1340202': 'GD',
  '1350200': 'GD', '1350201': 'GD', '1350202': 'GD',
  '1380200': 'GD', '1380201': 'GD', '1380202': 'GD',
  '1390200': 'GD', '1390201': 'GD', '1390202': 'GD',
  '1880200': 'GD', '1880201': 'GD', '1880202': 'GD',

  // 江苏地区
  '1340300': 'JS', '1340301': 'JS', '1340302': 'JS',
  '1350300': 'JS', '1350301': 'JS', '1350302': 'JS',
  '1380300': 'JS', '1380301': 'JS', '1380302': 'JS',
  '1390300': 'JS', '1390301': 'JS', '1390302': 'JS',
  '1880300': 'JS', '1880301': 'JS', '1880302': 'JS',

  // 浙江地区
  '1340400': 'ZJ', '1340401': 'ZJ', '1340402': 'ZJ',
  '1350400': 'ZJ', '1350401': 'ZJ', '1350402': 'ZJ',
  '1380400': 'ZJ', '1380401': 'ZJ', '1380402': 'ZJ',
  '1390400': 'ZJ', '1390401': 'ZJ', '1390402': 'ZJ',
  '1880400': 'ZJ', '1880401': 'ZJ', '1880402': 'ZJ',

  // 山东地区
  '1340500': 'SD', '1340501': 'SD', '1340502': 'SD',
  '1350500': 'SD', '1350501': 'SD', '1350502': 'SD',
  '1380500': 'SD', '1380501': 'SD', '1380502': 'SD',
  '1390500': 'SD', '1390501': 'SD', '1390502': 'SD',
  '1880500': 'SD', '1880501': 'SD', '1880502': 'SD'
};

/**
 * 通过手机号推断归属地
 * @param {string} phoneNumber - 手机号码
 * @returns {Object} 推断结果 {regionCode, confidence, method}
 */
export function inferRegionFromPhone(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return {
      regionCode: 'BJ',
      confidence: 0.2,
      method: 'default',
      regionName: '北京市'
    };
  }

  // 清理手机号格式
  const cleanedPhone = phoneNumber.replace(/\D/g, '');
  
  // 验证手机号格式
  if (cleanedPhone.length !== 11 || !cleanedPhone.startsWith('1')) {
    return {
      regionCode: 'BJ',
      confidence: 0.2,
      method: 'invalid',
      regionName: '北京市'
    };
  }

  // 方法1: 优先使用7位精确匹配
  const prefix7 = cleanedPhone.substring(0, 7);
  if (MOBILE_DETAILED_REGIONS[prefix7]) {
    return {
      regionCode: MOBILE_DETAILED_REGIONS[prefix7],
      confidence: 0.9,
      method: 'detailed',
      regionName: getRegionNameFromCode(MOBILE_DETAILED_REGIONS[prefix7])
    };
  }

  // 方法2: 使用3位号段匹配
  const prefix3 = cleanedPhone.substring(0, 3);
  if (MOBILE_PREFIX_REGIONS[prefix3]) {
    const possibleRegions = MOBILE_PREFIX_REGIONS[prefix3];
    
    // 如果只有一个可能的区域，直接返回
    if (possibleRegions.length === 1) {
      return {
        regionCode: possibleRegions[0],
        confidence: 0.8,
        method: 'prefix3_single',
        regionName: getRegionNameFromCode(possibleRegions[0])
      };
    }
    
    // 如果有多个可能的区域，选择优先级最高的
    const prioritizedRegions = sortRegionsByPriority(
      possibleRegions.map(code => ({ regionCode: code }))
    );
    
    return {
      regionCode: prioritizedRegions[0].regionCode,
      confidence: 0.6,
      method: 'prefix3_multiple',
      regionName: getRegionNameFromCode(prioritizedRegions[0].regionCode),
      alternatives: prioritizedRegions.slice(1).map(r => r.regionCode)
    };
  }

  // 方法3: 根据手机号第4位数字进行区域划分（经验规则）
  const fourthDigit = parseInt(cleanedPhone.charAt(3));
  let estimatedRegion = 'BJ';
  
  if (fourthDigit >= 0 && fourthDigit <= 2) {
    estimatedRegion = 'BJ'; // 北方区域
  } else if (fourthDigit >= 3 && fourthDigit <= 4) {
    estimatedRegion = 'SH'; // 华东区域
  } else if (fourthDigit >= 5 && fourthDigit <= 6) {
    estimatedRegion = 'GD'; // 华南区域
  } else if (fourthDigit >= 7 && fourthDigit <= 8) {
    estimatedRegion = 'SC'; // 西南区域
  } else {
    estimatedRegion = 'SD'; // 华中区域
  }

  return {
    regionCode: estimatedRegion,
    confidence: 0.4,
    method: 'digit_estimation',
    regionName: getRegionNameFromCode(estimatedRegion)
  };
}

/**
 * 获取地区名称（从region-keywords.js导入）
 * @param {string} regionCode - 地区代码
 * @returns {string} 地区名称
 */
function getRegionNameFromCode(regionCode) {
  const regionMap = {
    'BJ': '北京市', 'SH': '上海市', 'TJ': '天津市', 'CQ': '重庆市',
    'HE': '河北省', 'SX': '山西省', 'NM': '内蒙古自治区',
    'LN': '辽宁省', 'JL': '吉林省', 'HL': '黑龙江省',
    'JS': '江苏省', 'ZJ': '浙江省', 'AH': '安徽省',
    'FJ': '福建省', 'JX': '江西省', 'SD': '山东省',
    'HA': '河南省', 'HB': '湖北省', 'HN': '湖南省',
    'GD': '广东省', 'GX': '广西壮族自治区', 'HI': '海南省',
    'SC': '四川省', 'GZ': '贵州省', 'YN': '云南省',
    'XZ': '西藏自治区', 'SN': '陕西省', 'GS': '甘肃省',
    'QH': '青海省', 'NX': '宁夏回族自治区', 'XJ': '新疆维吾尔自治区'
  };
  return regionMap[regionCode] || '未知地区';
}

/**
 * 地区优先级排序（从region-keywords.js复制）
 * @param {Array} regions - 地区列表
 * @returns {Array} 排序后的地区列表
 */
function sortRegionsByPriority(regions) {
  const priorityOrder = {
    'BJ': 1, 'SH': 1, 'TJ': 1, 'CQ': 1,
    'GD': 2, 'JS': 2, 'ZJ': 2, 'SD': 2,
    'HB': 3, 'HN': 3, 'SC': 3, 'HA': 3,
    'HE': 4, 'SX': 4, 'AH': 4, 'FJ': 4,
    'JX': 4, 'LN': 4, 'JL': 4, 'HL': 4,
    'NM': 5, 'GX': 5, 'XZ': 5, 'XJ': 5,
    'NX': 5, 'HI': 5, 'GZ': 5, 'YN': 5,
    'GS': 5, 'QH': 5, 'SN': 5
  };

  return regions.sort((a, b) => {
    return (priorityOrder[a.regionCode] || 6) - (priorityOrder[b.regionCode] || 6);
  });
}

/**
 * 验证手机号格式
 * @param {string} phoneNumber - 手机号码
 * @returns {boolean} 是否为有效手机号
 */
export function isValidMobileNumber(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return false;
  }

  const cleanedPhone = phoneNumber.replace(/\D/g, '');
  
  // 检查长度和开头
  if (cleanedPhone.length !== 11 || !cleanedPhone.startsWith('1')) {
    return false;
  }

  // 检查第二位数字（中国手机号第二位有效范围）
  const secondDigit = cleanedPhone.charAt(1);
  const validSecondDigits = ['3', '4', '5', '6', '7', '8', '9'];
  
  return validSecondDigits.includes(secondDigit);
}

/**
 * 获取所有支持的手机号前缀
 * @returns {Array} 手机号前缀列表
 */
export function getSupportedMobilePrefixes() {
  return Object.keys(MOBILE_PREFIX_REGIONS);
}

/**
 * 批量推断手机号归属地
 * @param {Array} phoneNumbers - 手机号数组
 * @returns {Array} 推断结果数组
 */
export function batchInferRegionFromPhones(phoneNumbers) {
  return phoneNumbers.map(phone => ({
    phoneNumber: phone,
    ...inferRegionFromPhone(phone)
  }));
}