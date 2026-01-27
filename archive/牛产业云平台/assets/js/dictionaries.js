/**
 * 字典表数据 - 中国牛产业数智云平台
 * 包含：地区、品种、类型、状态等所有枚举数据
 */

const Dictionaries = {
  /**
   * ==================== 地区字典 ====================
   * 精简到牛产业主要省份
   */
  REGIONS: {
    "内蒙古": ["呼和浩特市", "包头市", "通辽市", "赤峰市", "锡林郭勒盟", "鄂尔多斯市", "巴彦淖尔市"],
    "山东": ["济南市", "青岛市", "菏泽市", "聊城市", "德州市", "滨州市", "临沂市"],
    "河北": ["石家庄市", "张家口市", "承德市", "唐山市", "邯郸市", "邢台市"],
    "吉林": ["长春市", "松原市", "白城市", "四平市", "通化市"],
    "黑龙江": ["哈尔滨市", "齐齐哈尔市", "大庆市", "牡丹江市", "绥化市"],
    "山西": ["太原市", "大同市", "朔州市", "晋中市", "忻州市"],
    "陕西": ["西安市", "榆林市", "延安市", "宝鸡市", "咸阳市"],
    "甘肃": ["兰州市", "张掖市", "武威市", "平凉市", "庆阳市"],
    "新疆": ["乌鲁木齐市", "伊犁州", "阿勒泰地区", "昌吉州", "巴音郭楞州"],
    "宁夏": ["银川市", "吴忠市", "固原市", "中卫市", "石嘴山市"],
    "四川": ["成都市", "绵阳市", "南充市", "达州市", "广元市"],
    "河南": ["郑州市", "洛阳市", "南阳市", "驻马店市", "周口市"],
    "安徽": ["合肥市", "阜阳市", "宿州市", "亳州市", "蚌埠市"],
    "江苏": ["南京市", "徐州市", "盐城市", "连云港市", "宿迁市"],
    "云南": ["昆明市", "曲靖市", "昭通市", "大理州", "红河州"],
    "贵州": ["贵阳市", "遵义市", "毕节市", "六盘水市", "黔东南州"],
    "广西": ["南宁市", "柳州市", "桂林市", "百色市", "河池市"],
    "青海": ["西宁市", "海东市", "海北州", "海南州", "黄南州"],
    "西藏": ["拉萨市", "日喀则市", "昌都市", "林芝市", "山南市"]
  },

  /**
   * ==================== 牛品种字典 ====================
   */
  CATTLE_BREEDS: [
    { code: "SIMMENTAL", name: "西门塔尔", origin: "瑞士", feature: "肉乳兼用，体型大" },
    { code: "LIMOUSIN", name: "利木赞", origin: "法国", feature: "肉用，瘦肉率高" },
    { code: "CHAROLAIS", name: "夏洛莱", origin: "法国", feature: "肉用，生长快" },
    { code: "ANGUS", name: "安格斯", origin: "英国", feature: "肉用，无角，肉质好" },
    { code: "HEREFORD", name: "海福特", origin: "英国", feature: "肉用，耐粗饲" },
    { code: "LUXI", name: "鲁西黄牛", origin: "中国山东", feature: "役肉兼用，肉质细嫩" },
    { code: "QINCHUAN", name: "秦川牛", origin: "中国陕西", feature: "役用，体型高大" },
    { code: "NANYANG", name: "南阳牛", origin: "中国河南", feature: "役肉兼用，体格强健" },
    { code: "YANBIAN", name: "延边牛", origin: "中国吉林", feature: "役用，耐寒" },
    { code: "JINNAN", name: "晋南牛", origin: "中国山西", feature: "役用，体型高大" },
    { code: "WAGYU", name: "和牛", origin: "日本", feature: "肉用，雪花肉" },
    { code: "MIXED", name: "杂交牛", origin: "-", feature: "杂交改良品种" },
    { code: "OTHER", name: "其他", origin: "-", feature: "-" }
  ],

  /**
   * ==================== 牛类型字典 ====================
   */
  CATTLE_TYPES: [
    { code: "COW", name: "母牛", icon: "cow", desc: "繁殖用母牛" },
    { code: "BULL", name: "公牛", icon: "bull", desc: "育肥公牛/种公牛" },
    { code: "CALF", name: "犊牛", icon: "calf", desc: "6月龄以内小牛" },
    { code: "HEIFER", name: "青年母牛", icon: "heifer", desc: "未生产的青年母牛" },
    { code: "STEER", name: "阉牛", icon: "steer", desc: "去势公牛，用于育肥" },
    { code: "BREEDING_BULL", name: "种公牛", icon: "breeding", desc: "用于配种的优质公牛" }
  ],

  /**
   * ==================== 企业类型字典 ====================
   */
  ENTERPRISE_TYPES: [
    { code: "FARM", name: "养殖场", icon: "farm", desc: "从事肉牛养殖的企业" },
    { code: "SLAUGHTER", name: "屠宰场", icon: "slaughter", desc: "从事肉牛屠宰加工的企业" },
    { code: "DEALER", name: "经销商", icon: "dealer", desc: "从事活牛/牛肉批发的企业" },
    { code: "FEED", name: "饲料商", icon: "feed", desc: "生产或销售饲料的企业" },
    { code: "EQUIPMENT", name: "设备商", icon: "equipment", desc: "销售养殖/屠宰设备的企业" },
    { code: "TRANSPORT", name: "运输商", icon: "transport", desc: "提供活牛/冷链运输服务的企业" },
    { code: "VET", name: "兽医服务", icon: "vet", desc: "提供兽医/防疫服务的企业" },
    { code: "FINANCE", name: "金融机构", icon: "finance", desc: "提供供应链金融服务的机构" }
  ],

  /**
   * ==================== 饲料类型字典 ====================
   */
  FEED_TYPES: [
    { code: "CORN", name: "玉米", category: "能量饲料" },
    { code: "SOYBEAN_MEAL", name: "豆粕", category: "蛋白饲料" },
    { code: "WHEAT_BRAN", name: "麦麸", category: "能量饲料" },
    { code: "SILAGE", name: "青贮饲料", category: "粗饲料" },
    { code: "HAY", name: "干草", category: "粗饲料" },
    { code: "HIGHLAND_BARLEY", name: "青稞", category: "能量饲料" },
    { code: "CONCENTRATE", name: "精饲料", category: "配合饲料" },
    { code: "PREMIX", name: "预混料", category: "添加剂" },
    { code: "MINERAL", name: "矿物质", category: "添加剂" },
    { code: "OTHER", name: "其他", category: "-" }
  ],

  /**
   * ==================== 牛肉产品类型字典 ====================
   */
  BEEF_TYPES: [
    { code: "FRESH", name: "鲜牛肉", storage: "冷藏" },
    { code: "FROZEN", name: "冻牛肉", storage: "冷冻" },
    { code: "OFFAL", name: "牛副产品", storage: "冷藏/冷冻", desc: "内脏、牛尾等" },
    { code: "TALLOW", name: "牛油", storage: "冷藏" },
    { code: "PREPARED", name: "预制品", storage: "冷冻", desc: "牛肉干、牛肉酱等" }
  ],

  /**
   * ==================== 牛肉部位字典 ====================
   */
  BEEF_CUTS: [
    { code: "TENDERLOIN", name: "牛里脊", grade: "高档" },
    { code: "RIBEYE", name: "眼肉", grade: "高档" },
    { code: "SIRLOIN", name: "西冷", grade: "高档" },
    { code: "CHUCK", name: "肩肉", grade: "中档" },
    { code: "BRISKET", name: "牛腩", grade: "中档" },
    { code: "SHANK", name: "牛腱", grade: "中档" },
    { code: "FLANK", name: "牛腹肉", grade: "普通" },
    { code: "SHORT_RIB", name: "牛仔骨", grade: "高档" },
    { code: "OXTAIL", name: "牛尾", grade: "特色" },
    { code: "MIXED", name: "混合部位", grade: "-" }
  ],

  /**
   * ==================== 设备类型字典 ====================
   */
  EQUIPMENT_TYPES: [
    { code: "FEEDING", name: "养殖设备", category: "养殖", examples: "饮水器、料槽、牛床" },
    { code: "SLAUGHTER", name: "屠宰设备", category: "屠宰", examples: "屠宰线、分割设备" },
    { code: "FEED_PROCESSING", name: "饲料加工设备", category: "饲料", examples: "粉碎机、搅拌机" },
    { code: "COLD_CHAIN", name: "冷链设备", category: "仓储", examples: "冷库、冷藏车" },
    { code: "TRANSPORT", name: "运输设备", category: "运输", examples: "活畜运输车" },
    { code: "WASTE", name: "环保设备", category: "环保", examples: "粪污处理设备" },
    { code: "MONITORING", name: "监控设备", category: "智能", examples: "摄像头、温湿度传感器" },
    { code: "OTHER", name: "其他", category: "-", examples: "-" }
  ],

  /**
   * ==================== 状态枚举 ====================
   */
  STATUS: {
    // 发布信息状态
    PUBLISH: [
      { code: "DRAFT", name: "草稿", color: "gray" },
      { code: "PENDING", name: "待审核", color: "warning" },
      { code: "ACTIVE", name: "在售", color: "success" },
      { code: "RESERVED", name: "已预订", color: "info" },
      { code: "SOLD", name: "已售", color: "default" },
      { code: "OFFLINE", name: "已下架", color: "default" },
      { code: "REJECTED", name: "已拒绝", color: "error" }
    ],
    // 企业状态
    ENTERPRISE: [
      { code: "PENDING", name: "待审核", color: "warning" },
      { code: "VERIFIED", name: "已认证", color: "success" },
      { code: "REJECTED", name: "已拒绝", color: "error" },
      { code: "DISABLED", name: "已禁用", color: "default" }
    ],
    // 检疫状态
    QUARANTINE: [
      { code: "HAS_CERT", name: "有检疫证", color: "success" },
      { code: "NO_CERT", name: "无检疫证", color: "warning" },
      { code: "PENDING", name: "待补办", color: "info" }
    ],
    // 交易方式
    DELIVERY: [
      { code: "PICKUP", name: "买家自提", desc: "买家自行到场提货" },
      { code: "DELIVERY", name: "卖家送达", desc: "卖家负责运输到指定地点" },
      { code: "NEGOTIABLE", name: "可协商", desc: "运输方式双方协商" }
    ]
  },

  /**
   * ==================== 价格类型 ====================
   */
  PRICE_TYPES: [
    { code: "UNIT", name: "元/头", desc: "按头计价" },
    { code: "WEIGHT", name: "元/斤", desc: "按活重计价" },
    { code: "TOTAL", name: "总价", desc: "整批总价" },
    { code: "NEGOTIABLE", name: "面议", desc: "价格面议" }
  ],

  /**
   * ==================== 一级分类（首页入口）====================
   */
  CATEGORIES: [
    { code: "CATTLE", name: "活牛交易", icon: "cattle", color: "#2E7D32", enabled: true },
    { code: "FEED", name: "饲料", icon: "feed", color: "#FF8F00", enabled: true },
    { code: "BEEF", name: "牛肉销售", icon: "beef", color: "#D32F2F", enabled: true },
    { code: "EQUIPMENT", name: "设备", icon: "equipment", color: "#1976D2", enabled: true },
    { code: "FARM", name: "养殖场", icon: "farm", color: "#388E3C", enabled: true },
    { code: "SLAUGHTER", name: "屠宰场", icon: "slaughter", color: "#5D4037", enabled: true },
    { code: "LAND", name: "土地", icon: "land", color: "#795548", enabled: false },
    { code: "FINANCE", name: "供应链金融", icon: "finance", color: "#FFA000", enabled: false },
    { code: "DESIGN", name: "工程设计", icon: "design", color: "#0288D1", enabled: false },
    { code: "JOB", name: "人才招聘", icon: "job", color: "#7B1FA2", enabled: false }
  ],

  /**
   * ==================== 工具方法 ====================
   */

  // 获取省份列表
  getProvinces() {
    return Object.keys(this.REGIONS);
  },

  // 根据省份获取城市列表
  getCitiesByProvince(province) {
    return this.REGIONS[province] || [];
  },

  // 根据code获取品种信息
  getBreedByCode(code) {
    return this.CATTLE_BREEDS.find(b => b.code === code);
  },

  // 根据code获取牛类型信息
  getCattleTypeByCode(code) {
    return this.CATTLE_TYPES.find(t => t.code === code);
  },

  // 根据code获取企业类型信息
  getEnterpriseTypeByCode(code) {
    return this.ENTERPRISE_TYPES.find(t => t.code === code);
  },

  // 根据code获取状态信息
  getStatusByCode(category, code) {
    const statuses = this.STATUS[category];
    return statuses ? statuses.find(s => s.code === code) : null;
  },

  // 获取启用的首页分类
  getEnabledCategories() {
    return this.CATEGORIES.filter(c => c.enabled);
  }
};

// 导出（支持ES6模块和CommonJS）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Dictionaries;
}
