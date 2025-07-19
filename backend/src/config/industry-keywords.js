/**
 * 行业关键词映射配置
 * 基于 GB/T 4754-2017 国家标准
 * 支持中文和英文关键词匹配
 */

export const INDUSTRY_KEYWORDS = {
  // C13 农副食品加工业
  '131': {
    name: '谷物磨制',
    keywords: ['面粉', '麦粉', '大米', '稻米', '粮食加工', '碾米', '米业', '谷物'],
    englishKeywords: ['flour', 'rice', 'mill', 'grain', 'wheat'],
    confidence: 0.9
  },
  '132': {
    name: '饲料加工',
    keywords: ['饲料', '配合饲料', '宠物粮', '动物营养', '畜牧饲料'],
    englishKeywords: ['feed', 'animal feed', 'pet food', 'livestock'],
    confidence: 0.95
  },
  '133': {
    name: '植物油加工',
    keywords: ['菜籽油', '花生油', '大豆油', '玉米油', '油脂', '油厂', '植物油', '食用油'],
    englishKeywords: ['oil', 'edible oil', 'vegetable oil', 'soybean oil'],
    confidence: 0.9
  },
  '134': {
    name: '制糖业',
    keywords: ['白糖', '红糖', '蔗糖', '糖厂', '甜菊糖', '糖业', '制糖'],
    englishKeywords: ['sugar', 'sucrose', 'sweetener'],
    confidence: 0.95
  },
  '135': {
    name: '屠宰及肉类加工',
    keywords: ['肉类', '屠宰', '香肠', '火腿', '腌肉', '培根', '肉制品', '牛肉', '猪肉', '鸡肉'],
    englishKeywords: ['meat', 'sausage', 'ham', 'bacon', 'beef', 'pork', 'chicken'],
    confidence: 0.95
  },
  '136': {
    name: '水产品加工',
    keywords: ['水产', '海鲜', '鱼肉', '虾', '蟹', '鱿鱼', '鱼糜', '海产品', '渔业'],
    englishKeywords: ['seafood', 'fish', 'shrimp', 'crab', 'fishery', 'aquatic'],
    confidence: 0.9
  },
  '137': {
    name: '蔬菜、水果和坚果加工',
    keywords: ['果脯', '脱水蔬菜', '罐装水果', '坚果加工', '蔬果干', '水果', '蔬菜', '坚果'],
    englishKeywords: ['fruit', 'vegetable', 'nut', 'dried fruit', 'dehydrated'],
    confidence: 0.85
  },

  // C14 食品制造业
  '141': {
    name: '焙烤食品制造',
    keywords: ['面包', '蛋糕', '饼干', '月饼', '烘焙', '糕点', '西点'],
    englishKeywords: ['bread', 'cake', 'cookie', 'biscuit', 'bakery', 'baking'],
    confidence: 0.95
  },
  '142': {
    name: '糖果、巧克力及蜜饯制造',
    keywords: ['糖果', '巧克力', '软糖', '硬糖', '麦芽糖', '蜜饯', '果脯'],
    englishKeywords: ['candy', 'chocolate', 'confection', 'sweet'],
    confidence: 0.95
  },
  '143': {
    name: '方便食品制造',
    keywords: ['方便面', '自热米饭', '速食', '快餐包', '方便食品', '即食'],
    englishKeywords: ['instant', 'convenience', 'ready meal', 'instant noodle'],
    confidence: 0.95
  },
  '144': {
    name: '乳制品制造',
    keywords: ['牛奶', '酸奶', '奶酪', '乳业', '奶粉', '乳制品', '奶制品', '牛乳'],
    englishKeywords: ['milk', 'dairy', 'yogurt', 'cheese', 'cream'],
    confidence: 0.95
  },
  '145': {
    name: '罐头食品制造',
    keywords: ['罐头', '罐装', '罐藏', '密封食品'],
    englishKeywords: ['canned', 'canning', 'preserved'],
    confidence: 0.9
  },
  '146': {
    name: '调味品、发酵制品制造',
    keywords: ['酱油', '醋', '味精', '酱料', '调料', '调味品', '发酵', '豆瓣酱'],
    englishKeywords: ['sauce', 'vinegar', 'seasoning', 'condiment', 'fermented'],
    confidence: 0.9
  },

  // C15 酒、饮料和精制茶制造业
  '151': {
    name: '酒的制造',
    keywords: ['白酒', '啤酒', '葡萄酒', '米酒', '威士忌', '酒厂', '酒业', '酿酒'],
    englishKeywords: ['wine', 'beer', 'alcohol', 'brewery', 'distillery', 'liquor'],
    confidence: 0.95
  },
  '152': {
    name: '饮料制造',
    keywords: ['饮料', '果汁', '汽水', '苏打水', '功能饮料', '茶饮', '咖啡饮料'],
    englishKeywords: ['beverage', 'juice', 'soda', 'drink', 'soft drink'],
    confidence: 0.9
  },
  '153': {
    name: '精制茶加工',
    keywords: ['茶叶', '红茶', '绿茶', '乌龙茶', '精制茶', '茶业', '茶厂'],
    englishKeywords: ['tea', 'green tea', 'black tea', 'oolong'],
    confidence: 0.95
  },

  // 默认分类
  '140': {
    name: '食品制造业（未细分）',
    keywords: ['食品', '食品加工', '食品制造', '食品厂'],
    englishKeywords: ['food', 'food processing', 'food manufacturing'],
    confidence: 0.7
  }
};

/**
 * 行业关键词匹配函数
 * @param {string} text - 待匹配的文本（工厂名称、行业描述等）
 * @returns {Object} 匹配结果 {industryCode, confidence, matchedKeywords}
 */
export function matchIndustryKeywords(text) {
  if (!text || typeof text !== 'string') {
    return {
      industryCode: '140',
      confidence: 0.5,
      matchedKeywords: [],
      industryName: '食品制造业（未细分）'
    };
  }

  const normalizedText = text.toLowerCase().trim();
  let bestMatch = {
    industryCode: '140',
    confidence: 0.5,
    matchedKeywords: [],
    industryName: '食品制造业（未细分）'
  };

  // 遍历所有行业代码
  for (const [code, config] of Object.entries(INDUSTRY_KEYWORDS)) {
    if (code === '140') continue; // 默认分类最后处理

    const matchedKeywords = [];
    let totalConfidence = 0;
    let keywordCount = 0;

    // 匹配中文关键词
    config.keywords.forEach(keyword => {
      if (normalizedText.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
        totalConfidence += config.confidence;
        keywordCount++;
      }
    });

    // 匹配英文关键词
    config.englishKeywords.forEach(keyword => {
      if (normalizedText.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
        totalConfidence += config.confidence * 0.8; // 英文关键词权重稍低
        keywordCount++;
      }
    });

    // 计算平均置信度
    if (keywordCount > 0) {
      const avgConfidence = totalConfidence / keywordCount;
      
      // 如果当前匹配更好，更新最佳匹配
      if (avgConfidence > bestMatch.confidence) {
        bestMatch = {
          industryCode: code,
          confidence: avgConfidence,
          matchedKeywords,
          industryName: config.name
        };
      }
    }
  }

  return bestMatch;
}

/**
 * 获取行业名称
 * @param {string} industryCode - 行业代码
 * @returns {string} 行业名称
 */
export function getIndustryName(industryCode) {
  return INDUSTRY_KEYWORDS[industryCode]?.name || '未知行业';
}

/**
 * 获取所有行业代码列表
 * @returns {Array} 行业代码列表
 */
export function getAllIndustryCodes() {
  return Object.keys(INDUSTRY_KEYWORDS).map(code => ({
    code,
    name: INDUSTRY_KEYWORDS[code].name
  }));
}