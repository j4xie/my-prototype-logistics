/**
 * 地理位置关键词映射配置
 * 基于全国省级行政区划代码
 * 支持省份、城市、区县关键词匹配
 */

export const REGION_KEYWORDS = {
  // 直辖市
  'BJ': {
    name: '北京市',
    keywords: ['北京', '京', '朝阳', '海淀', '丰台', '通州', '石景山', '西城', '东城', '大兴', '顺义', '昌平', '房山', '门头沟', '平谷', '怀柔', '密云', '延庆'],
    confidence: 0.95
  },
  'SH': {
    name: '上海市',
    keywords: ['上海', '沪', '浦东', '徐汇', '嘉定', '闵行', '静安', '普陀', '虹口', '杨浦', '宝山', '长宁', '黄浦', '奉贤', '松江', '青浦', '金山', '崇明'],
    confidence: 0.95
  },
  'TJ': {
    name: '天津市',
    keywords: ['天津', '津', '滨海', '和平', '河东', '河西', '南开', '河北', '红桥', '塘沽', '汉沽', '大港', '东丽', '西青', '津南', '北辰', '武清', '宝坻', '静海', '宁河', '蓟州'],
    confidence: 0.95
  },
  'CQ': {
    name: '重庆市',
    keywords: ['重庆', '渝', '两江', '万州', '涪陵', '渝中', '大渡口', '江北', '沙坪坝', '九龙坡', '南岸', '北碚', '綦江', '大足', '渝北', '巴南', '黔江', '长寿', '江津', '合川', '永川'],
    confidence: 0.95
  },

  // 省份
  'HE': {
    name: '河北省',
    keywords: ['河北', '石家庄', '保定', '唐山', '邯郸', '邢台', '沧州', '衡水', '廊坊', '承德', '张家口', '秦皇岛'],
    confidence: 0.9
  },
  'SX': {
    name: '山西省',
    keywords: ['山西', '太原', '大同', '运城', '临汾', '长治', '晋中', '阳泉', '朔州', '晋城', '忻州', '吕梁'],
    confidence: 0.9
  },
  'NM': {
    name: '内蒙古自治区',
    keywords: ['内蒙古', '呼和浩特', '包头', '鄂尔多斯', '赤峰', '通辽', '呼伦贝尔', '巴彦淖尔', '乌兰察布', '锡林郭勒', '兴安盟', '阿拉善'],
    confidence: 0.9
  },
  'LN': {
    name: '辽宁省',
    keywords: ['辽宁', '沈阳', '大连', '鞍山', '抚顺', '本溪', '丹东', '锦州', '营口', '阜新', '辽阳', '盘锦', '铁岭', '朝阳', '葫芦岛'],
    confidence: 0.9
  },
  'JL': {
    name: '吉林省',
    keywords: ['吉林', '长春', '延吉', '四平', '通化', '白山', '松原', '白城', '延边', '辽源'],
    confidence: 0.9
  },
  'HL': {
    name: '黑龙江省',
    keywords: ['黑龙江', '哈尔滨', '齐齐哈尔', '佳木斯', '牡丹江', '大庆', '鸡西', '双鸭山', '伊春', '七台河', '鹤岗', '黑河', '绥化', '大兴安岭'],
    confidence: 0.9
  },
  'JS': {
    name: '江苏省',
    keywords: ['江苏', '南京', '苏州', '无锡', '南通', '常州', '徐州', '盐城', '淮安', '连云港', '泰州', '宿迁', '镇江', '扬州'],
    confidence: 0.9
  },
  'ZJ': {
    name: '浙江省',
    keywords: ['浙江', '杭州', '宁波', '温州', '嘉兴', '义乌', '金华', '绍兴', '湖州', '衢州', '舟山', '台州', '丽水'],
    confidence: 0.9
  },
  'AH': {
    name: '安徽省',
    keywords: ['安徽', '合肥', '芜湖', '蚌埠', '滁州', '马鞍山', '淮南', '铜陵', '安庆', '黄山', '阜阳', '宿州', '六安', '亳州', '池州', '宣城', '淮北'],
    confidence: 0.9
  },
  'FJ': {
    name: '福建省',
    keywords: ['福建', '福州', '厦门', '泉州', '莆田', '三明', '南平', '龙岩', '宁德', '漳州'],
    confidence: 0.9
  },
  'JX': {
    name: '江西省',
    keywords: ['江西', '南昌', '赣州', '九江', '景德镇', '萍乡', '新余', '鹰潭', '吉安', '宜春', '抚州', '上饶'],
    confidence: 0.9
  },
  'SD': {
    name: '山东省',
    keywords: ['山东', '济南', '青岛', '烟台', '潍坊', '淄博', '威海', '临沂', '德州', '聊城', '滨州', '菏泽', '东营', '济宁', '泰安', '日照', '枣庄', '莱芜'],
    confidence: 0.9
  },
  'HA': {
    name: '河南省',
    keywords: ['河南', '郑州', '洛阳', '开封', '南阳', '安阳', '商丘', '新乡', '平顶山', '许昌', '焦作', '周口', '信阳', '驻马店', '漯河', '三门峡', '鹤壁', '濮阳', '济源'],
    confidence: 0.9
  },
  'HB': {
    name: '湖北省',
    keywords: ['湖北', '武汉', '襄阳', '宜昌', '黄石', '荆州', '黄冈', '十堰', '孝感', '荆门', '鄂州', '随州', '咸宁', '恩施', '仙桃', '天门', '潜江', '神农架'],
    confidence: 0.9
  },
  'HN': {
    name: '湖南省',
    keywords: ['湖南', '长沙', '株洲', '湘潭', '衡阳', '邵阳', '岳阳', '常德', '张家界', '益阳', '郴州', '永州', '怀化', '娄底', '湘西'],
    confidence: 0.9
  },
  'GD': {
    name: '广东省',
    keywords: ['广东', '广州', '深圳', '佛山', '东莞', '汕头', '惠州', '江门', '湛江', '茂名', '肇庆', '梅州', '汕尾', '河源', '阳江', '清远', '韶关', '揭阳', '云浮', '潮州', '中山', '珠海'],
    confidence: 0.9
  },
  'GX': {
    name: '广西壮族自治区',
    keywords: ['广西', '南宁', '桂林', '柳州', '梧州', '北海', '防城港', '钦州', '贵港', '玉林', '百色', '贺州', '河池', '来宾', '崇左'],
    confidence: 0.9
  },
  'HI': {
    name: '海南省',
    keywords: ['海南', '海口', '三亚', '三沙', '儋州', '五指山', '琼海', '文昌', '万宁', '东方', '定安', '屯昌', '澄迈', '临高', '白沙', '昌江', '乐东', '陵水', '保亭', '琼中'],
    confidence: 0.9
  },
  'SC': {
    name: '四川省',
    keywords: ['四川', '成都', '绵阳', '德阳', '乐山', '南充', '宜宾', '自贡', '泸州', '达州', '内江', '遂宁', '广元', '眉山', '广安', '资阳', '攀枝花', '巴中', '雅安', '甘孜', '阿坝', '凉山'],
    confidence: 0.9
  },
  'GZ': {
    name: '贵州省',
    keywords: ['贵州', '贵阳', '遵义', '六盘水', '安顺', '毕节', '铜仁', '黔西南', '黔东南', '黔南'],
    confidence: 0.9
  },
  'YN': {
    name: '云南省',
    keywords: ['云南', '昆明', '大理', '丽江', '曲靖', '玉溪', '保山', '昭通', '临沧', '普洱', '红河', '文山', '西双版纳', '楚雄', '德宏', '怒江', '迪庆'],
    confidence: 0.9
  },
  'XZ': {
    name: '西藏自治区',
    keywords: ['西藏', '拉萨', '昌都', '山南', '日喀则', '那曲', '阿里', '林芝'],
    confidence: 0.9
  },
  'SN': {
    name: '陕西省',
    keywords: ['陕西', '西安', '咸阳', '宝鸡', '渭南', '汉中', '安康', '商洛', '延安', '榆林', '铜川'],
    confidence: 0.9
  },
  'GS': {
    name: '甘肃省',
    keywords: ['甘肃', '兰州', '天水', '白银', '金昌', '嘉峪关', '酒泉', '张掖', '武威', '定西', '陇南', '平凉', '庆阳', '临夏', '甘南'],
    confidence: 0.9
  },
  'QH': {
    name: '青海省',
    keywords: ['青海', '西宁', '海东', '海北', '黄南', '海南', '果洛', '玉树', '海西'],
    confidence: 0.9
  },
  'NX': {
    name: '宁夏回族自治区',
    keywords: ['宁夏', '银川', '石嘴山', '吴忠', '固原', '中卫'],
    confidence: 0.9
  },
  'XJ': {
    name: '新疆维吾尔自治区',
    keywords: ['新疆', '乌鲁木齐', '喀什', '和田', '阿克苏', '库尔勒', '昌吉', '伊犁', '塔城', '阿勒泰', '博尔塔拉', '巴音郭楞', '克孜勒苏', '哈密', '吐鲁番'],
    confidence: 0.9
  }
};

/**
 * 地理位置关键词匹配函数
 * @param {string} text - 待匹配的文本（地址、公司名称等）
 * @returns {Object} 匹配结果 {regionCode, confidence, matchedKeywords}
 */
export function matchRegionKeywords(text) {
  if (!text || typeof text !== 'string') {
    return {
      regionCode: 'BJ', // 默认北京
      confidence: 0.3,
      matchedKeywords: [],
      regionName: '北京市'
    };
  }

  const normalizedText = text.toLowerCase().trim();
  let bestMatch = {
    regionCode: 'BJ',
    confidence: 0.3,
    matchedKeywords: [],
    regionName: '北京市'
  };

  // 遍历所有地区代码
  for (const [code, config] of Object.entries(REGION_KEYWORDS)) {
    const matchedKeywords = [];
    let maxConfidence = 0;

    // 匹配关键词
    config.keywords.forEach(keyword => {
      if (normalizedText.includes(keyword)) {
        matchedKeywords.push(keyword);
        // 省份名称匹配获得更高权重
        if (keyword === config.name.replace(/省|市|自治区|特别行政区/g, '')) {
          maxConfidence = Math.max(maxConfidence, config.confidence);
        } else {
          maxConfidence = Math.max(maxConfidence, config.confidence * 0.8);
        }
      }
    });

    // 如果当前匹配更好，更新最佳匹配
    if (maxConfidence > bestMatch.confidence) {
      bestMatch = {
        regionCode: code,
        confidence: maxConfidence,
        matchedKeywords,
        regionName: config.name
      };
    }
  }

  return bestMatch;
}

/**
 * 获取地区名称
 * @param {string} regionCode - 地区代码
 * @returns {string} 地区名称
 */
export function getRegionName(regionCode) {
  return REGION_KEYWORDS[regionCode]?.name || '未知地区';
}

/**
 * 获取所有地区代码列表
 * @returns {Array} 地区代码列表
 */
export function getAllRegionCodes() {
  return Object.keys(REGION_KEYWORDS).map(code => ({
    code,
    name: REGION_KEYWORDS[code].name
  }));
}

/**
 * 根据优先级对地区进行排序
 * 直辖市 > 省会城市 > 经济发达城市 > 其他
 * @param {Array} regions - 地区列表
 * @returns {Array} 排序后的地区列表
 */
export function sortRegionsByPriority(regions) {
  const priorityOrder = {
    // 直辖市
    'BJ': 1, 'SH': 1, 'TJ': 1, 'CQ': 1,
    // 重要省份
    'GD': 2, 'JS': 2, 'ZJ': 2, 'SD': 2,
    // 其他省份
    'HB': 3, 'HN': 3, 'SC': 3, 'HA': 3,
    'HE': 4, 'SX': 4, 'AH': 4, 'FJ': 4,
    'JX': 4, 'LN': 4, 'JL': 4, 'HL': 4,
    // 自治区
    'NM': 5, 'GX': 5, 'XZ': 5, 'XJ': 5,
    'NX': 5, 'HI': 5, 'GZ': 5, 'YN': 5,
    'GS': 5, 'QH': 5, 'SN': 5
  };

  return regions.sort((a, b) => {
    return (priorityOrder[a.regionCode] || 6) - (priorityOrder[b.regionCode] || 6);
  });
}