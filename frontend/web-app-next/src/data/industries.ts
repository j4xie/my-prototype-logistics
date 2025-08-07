/**
 * 工厂所属行业分类数据
 * 基于国家统计局行业分类标准
 */

export interface Industry {
  code: string;
  name: string;
  description?: string;
}

export interface IndustryCategory {
  code: string;
  name: string;
  industries: Industry[];
}

// 主要制造业行业分类
export const industryCategories: IndustryCategory[] = [
  {
    code: "C13-C14",
    name: "农副食品加工业",
    industries: [
      { code: "C1310", name: "谷物磨制", description: "稻谷、小麦、玉米等谷物加工" },
      { code: "C1320", name: "饲料加工", description: "动物饲料、宠物食品加工" },
      { code: "C1330", name: "植物油加工", description: "食用植物油、调和油生产" },
      { code: "C1340", name: "制糖业", description: "食糖、糖浆、代糖产品生产" },
      { code: "C1350", name: "屠宰及肉类加工", description: "畜禽屠宰、肉制品加工" },
      { code: "C1360", name: "水产品加工", description: "鱼类、虾类、贝类等水产品加工" },
      { code: "C1370", name: "蔬菜、水果和坚果加工", description: "果蔬罐头、果汁、坚果制品" },
      { code: "C1390", name: "其他农副食品加工", description: "茶叶、咖啡、香料等加工" }
    ]
  },
  {
    code: "C15",
    name: "食品制造业",
    industries: [
      { code: "C1510", name: "焙烤食品制造", description: "面包、糕点、饼干等烘焙食品" },
      { code: "C1520", name: "糖果、巧克力制造", description: "各类糖果、巧克力制品" },
      { code: "C1530", name: "方便食品制造", description: "方便面、速冻食品、罐头食品" },
      { code: "C1540", name: "乳制品制造", description: "液态奶、奶粉、酸奶、奶酪" },
      { code: "C1550", name: "罐头食品制造", description: "水果罐头、蔬菜罐头、肉类罐头" },
      { code: "C1560", name: "调味品、发酵制品制造", description: "酱油、醋、味精、酵母等" },
      { code: "C1590", name: "营养食品制造", description: "保健食品、婴幼儿食品、功能食品" }
    ]
  },
  {
    code: "C17",
    name: "纺织业",
    industries: [
      { code: "C1710", name: "棉纺织", description: "棉花纺纱、织布、印染" },
      { code: "C1720", name: "毛纺织", description: "羊毛、化纤纺织品生产" },
      { code: "C1730", name: "麻纺织", description: "亚麻、黄麻、苎麻纺织" },
      { code: "C1740", name: "丝绢纺织", description: "桑蚕丝、柞蚕丝纺织品" },
      { code: "C1750", name: "化纤织造", description: "化学纤维长丝、短纤维织造" },
      { code: "C1760", name: "针织或钩针编织物", description: "针织面料、编织制品" },
      { code: "C1770", name: "家用纺织制成品制造", description: "床上用品、窗帘、地毯" }
    ]
  },
  {
    code: "C18",
    name: "纺织服装业",
    industries: [
      { code: "C1810", name: "机织服装制造", description: "男装、女装、童装等机织服装" },
      { code: "C1820", name: "针织或钩针编织服装制造", description: "针织内衣、T恤、毛衣等" },
      { code: "C1830", name: "服饰制造", description: "帽子、围巾、手套、领带等" },
      { code: "C1890", name: "其他服装制造", description: "特殊功能服装、制服等" }
    ]
  },
  {
    code: "C19",
    name: "皮革、毛皮制品业",
    industries: [
      { code: "C1910", name: "皮革鞣制加工", description: "生皮、毛皮鞣制、整理" },
      { code: "C1920", name: "皮革制品制造", description: "皮鞋、皮具、皮衣制造" },
      { code: "C1930", name: "毛皮制品加工", description: "毛皮服装、毛皮饰品" }
    ]
  },
  {
    code: "C26",
    name: "化学原料和化学制品制造业",
    industries: [
      { code: "C2610", name: "基础化学原料制造", description: "无机酸、碱、盐等基础化工原料" },
      { code: "C2620", name: "肥料制造", description: "氮肥、磷肥、钾肥、复合肥" },
      { code: "C2630", name: "农药制造", description: "杀虫剂、除草剂、杀菌剂" },
      { code: "C2640", name: "涂料、油墨制造", description: "建筑涂料、工业涂料、印刷油墨" },
      { code: "C2650", name: "合成材料制造", description: "塑料、合成橡胶、合成纤维" },
      { code: "C2660", name: "专用化学产品制造", description: "催化剂、试剂、胶粘剂" },
      { code: "C2670", name: "炸药、火工及焰火产品制造", description: "工业炸药、烟花爆竹" },
      { code: "C2680", name: "日用化学产品制造", description: "洗涤用品、化妆品、香料" }
    ]
  },
  {
    code: "C27",
    name: "医药制造业",
    industries: [
      { code: "C2710", name: "化学药品原料药制造", description: "抗生素、维生素、激素等原料药" },
      { code: "C2720", name: "化学药品制剂制造", description: "片剂、胶囊、注射剂等制剂" },
      { code: "C2730", name: "中药饮片加工", description: "中药材切制、炮制、提取" },
      { code: "C2740", name: "中成药生产", description: "中成药制剂、保健品" },
      { code: "C2750", name: "兽用药品制造", description: "兽用疫苗、兽用化学药品" },
      { code: "C2760", name: "生物药品制品制造", description: "疫苗、血液制品、基因工程药物" },
      { code: "C2770", name: "卫生材料及医药用品制造", description: "医用敷料、一次性医疗用品" }
    ]
  },
  {
    code: "C30",
    name: "非金属矿物制品业",
    industries: [
      { code: "C3010", name: "水泥制造", description: "硅酸盐水泥、特种水泥生产" },
      { code: "C3020", name: "石灰和石膏制造", description: "建筑石灰、工业石膏制品" },
      { code: "C3030", name: "墙体材料制造", description: "砖瓦、砌块、板材等墙体材料" },
      { code: "C3040", name: "建筑陶瓷制品制造", description: "瓷砖、卫生陶瓷、建筑陶瓷" },
      { code: "C3050", name: "建筑用石加工", description: "大理石、花岗岩、石材制品" },
      { code: "C3060", name: "耐火材料制品制造", description: "耐火砖、耐火纤维、不定形耐火材料" },
      { code: "C3070", name: "石墨及其他非金属矿物制品制造", description: "石墨制品、云母制品、石棉制品" }
    ]
  },
  {
    code: "C31",
    name: "黑色金属冶炼和压延加工业",
    industries: [
      { code: "C3110", name: "炼铁", description: "生铁、铸造生铁生产" },
      { code: "C3120", name: "炼钢", description: "粗钢、钢锭、连铸坯生产" },
      { code: "C3130", name: "钢压延加工", description: "热轧、冷轧钢材生产" },
      { code: "C3140", name: "铁合金冶炼", description: "硅铁、锰铁、铬铁等铁合金" }
    ]
  },
  {
    code: "C32",
    name: "有色金属冶炼和压延加工业",
    industries: [
      { code: "C3210", name: "常用有色金属冶炼", description: "铜、铝、铅、锌冶炼" },
      { code: "C3220", name: "贵金属冶炼", description: "金、银、铂族金属冶炼" },
      { code: "C3230", name: "稀有稀土金属冶炼", description: "钨、钼、钛、稀土金属冶炼" },
      { code: "C3240", name: "有色金属压延加工", description: "有色金属板材、管材、型材加工" }
    ]
  },
  {
    code: "C33",
    name: "金属制品业",
    industries: [
      { code: "C3310", name: "结构性金属制品制造", description: "金属门窗、建筑金属结构件" },
      { code: "C3320", name: "金属工具制造", description: "切削工具、手工工具、量具" },
      { code: "C3330", name: "集装箱制造", description: "货运集装箱、特种集装箱" },
      { code: "C3340", name: "金属包装容器制造", description: "金属罐、桶、箱等包装容器" },
      { code: "C3350", name: "不锈钢及类似日用金属制品制造", description: "不锈钢厨具、餐具等日用品" },
      { code: "C3360", name: "金属丝绳及其制品制造", description: "钢丝、钢丝绳、金属网" },
      { code: "C3390", name: "其他金属制品制造", description: "金属紧固件、弹簧、链条等" }
    ]
  },
  {
    code: "C34",
    name: "通用设备制造业",
    industries: [
      { code: "C3410", name: "锅炉及原动设备制造", description: "工业锅炉、汽轮机、内燃机" },
      { code: "C3420", name: "金属加工机械制造", description: "机床、锻压设备、铸造设备" },
      { code: "C3430", name: "物料搬运设备制造", description: "起重机械、输送机械、工业车辆" },
      { code: "C3440", name: "泵、阀门、压缩机制造", description: "各类泵、阀门、空气压缩机" },
      { code: "C3450", name: "轴承、齿轮和传动部件制造", description: "滚动轴承、齿轮箱、联轴器" },
      { code: "C3460", name: "烘炉、风机、包装等设备制造", description: "工业炉、风机、包装机械" },
      { code: "C3470", name: "文化、办公用机械制造", description: "印刷机械、办公设备" },
      { code: "C3480", name: "通用零部件制造", description: "紧固件、弹簧、链传动件" },
      { code: "C3490", name: "其他通用设备制造", description: "分离机械、清洗设备等" }
    ]
  },
  {
    code: "C35",
    name: "专用设备制造业",
    industries: [
      { code: "C3510", name: "采矿、冶金、建筑专用设备制造", description: "挖掘机、冶炼设备、建筑机械" },
      { code: "C3520", name: "化工、木材、非金属加工专用设备制造", description: "化工设备、木工机械、陶瓷机械" },
      { code: "C3530", name: "食品、饮料、烟草工业专用设备制造", description: "食品加工设备、饮料生产线" },
      { code: "C3540", name: "印刷、制药、日化专用设备制造", description: "印刷机械、制药设备、化妆品设备" },
      { code: "C3550", name: "纺织、服装和皮革工业专用设备制造", description: "纺织机械、服装设备、制鞋机械" },
      { code: "C3560", name: "电子和电工机械专用设备制造", description: "半导体设备、电子设备制造装备" },
      { code: "C3570", name: "农、林、牧、渔专用机械制造", description: "拖拉机、收割机、农机具" },
      { code: "C3580", name: "医疗仪器设备及器械制造", description: "医疗诊断设备、手术器械、康复设备" },
      { code: "C3590", name: "环保、社会公共服务及其他专用设备制造", description: "污水处理设备、垃圾处理设备" }
    ]
  },
  {
    code: "C36",
    name: "汽车制造业",
    industries: [
      { code: "C3610", name: "汽车整车制造", description: "乘用车、商用车、专用汽车" },
      { code: "C3620", name: "汽车用发动机制造", description: "汽油机、柴油机、新能源动力" },
      { code: "C3630", name: "汽车零部件及配件制造", description: "变速器、制动系统、电子系统" },
      { code: "C3640", name: "汽车车身、挂车制造", description: "客车车身、货车车身、各类挂车" }
    ]
  },
  {
    code: "C37",
    name: "铁路、船舶、航空航天制造业",
    industries: [
      { code: "C3710", name: "铁路运输设备制造", description: "机车、车辆、铁路专用设备" },
      { code: "C3720", name: "城市轨道交通设备制造", description: "地铁车辆、轻轨设备、有轨电车" },
      { code: "C3730", name: "船舶及相关装置制造", description: "船舶建造、海洋工程装备" },
      { code: "C3740", name: "航空、航天器及设备制造", description: "飞机、航天器、航空发动机" },
      { code: "C3750", name: "摩托车制造", description: "摩托车整车、零部件制造" },
      { code: "C3760", name: "自行车和残疾人座车制造", description: "自行车、电动自行车、轮椅" },
      { code: "C3790", name: "其他交通运输设备制造", description: "索道设备、潜水装备等" }
    ]
  },
  {
    code: "C38",
    name: "电气机械和器材制造业",
    industries: [
      { code: "C3810", name: "电机制造", description: "交流电机、直流电机、特种电机" },
      { code: "C3820", name: "输配电及控制设备制造", description: "变压器、开关设备、配电装置" },
      { code: "C3830", name: "电线、电缆、光缆制造", description: "电力电缆、通信电缆、光纤光缆" },
      { code: "C3840", name: "电池制造", description: "原电池、蓄电池、锂电池" },
      { code: "C3850", name: "家用电力器具制造", description: "空调、冰箱、洗衣机、小家电" },
      { code: "C3860", name: "非电力家用器具制造", description: "燃气具、太阳能热水器" },
      { code: "C3870", name: "照明器具制造", description: "电光源、灯具、LED照明" },
      { code: "C3890", name: "其他电气机械及器材制造", description: "绝缘制品、电炭制品等" }
    ]
  },
  {
    code: "C39",
    name: "计算机、通信设备制造业",
    industries: [
      { code: "C3910", name: "计算机制造", description: "微型计算机、服务器、工作站" },
      { code: "C3920", name: "通信设备制造", description: "移动通信设备、固定通信设备" },
      { code: "C3930", name: "广播电视设备制造", description: "广播设备、电视设备、音响设备" },
      { code: "C3940", name: "雷达及配套设备制造", description: "雷达设备、导航设备、气象设备" },
      { code: "C3950", name: "非专业视听设备制造", description: "家用视听设备、录音录像设备" },
      { code: "C3960", name: "智能消费设备制造", description: "智能手机、平板电脑、可穿戴设备" },
      { code: "C3970", name: "电子器件制造", description: "半导体器件、集成电路、显示器件" },
      { code: "C3980", name: "电子元件及电子专用材料制造", description: "电容器、电阻器、电子专用材料" },
      { code: "C3990", name: "其他电子设备制造", description: "电子测量仪器、电子专用设备" }
    ]
  },
  {
    code: "OTHER",
    name: "其他制造业",
    industries: [
      { code: "C4110", name: "体育用品制造", description: "球类、健身器材、运动防护用具" },
      { code: "C4120", name: "娱乐用品制造", description: "玩具、游戏用品、节庆用品" },
      { code: "C4130", name: "工艺美术品制造", description: "雕塑工艺品、金属工艺品、首饰" },
      { code: "C4140", name: "乐器制造", description: "键盘乐器、弦乐器、管乐器" },
      { code: "C4190", name: "其他文教、工美、体育和娱乐用品制造", description: "文具、美术用品等" },
      { code: "C9999", name: "其他未分类制造业", description: "其他制造业活动" }
    ]
  }
];

/**
 * 获取所有行业的扁平化列表
 */
export const getAllIndustries = (): Industry[] => {
  return industryCategories.reduce((all, category) => {
    return all.concat(category.industries);
  }, [] as Industry[]);
};

/**
 * 根据行业代码获取行业信息
 */
export const getIndustryByCode = (code: string): Industry | null => {
  const allIndustries = getAllIndustries();
  return allIndustries.find(industry => industry.code === code) || null;
};

/**
 * 根据关键词搜索行业
 */
export const searchIndustries = (keyword: string): Industry[] => {
  if (!keyword.trim()) return getAllIndustries();

  const lowercaseKeyword = keyword.toLowerCase();
  return getAllIndustries().filter(industry =>
    industry.name.toLowerCase().includes(lowercaseKeyword) ||
    (industry.description && industry.description.toLowerCase().includes(lowercaseKeyword))
  );
};
