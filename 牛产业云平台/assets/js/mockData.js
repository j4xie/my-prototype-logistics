/**
 * 模拟数据 - 中国牛产业数智云平台
 * 包含：企业、活牛发布、溯源记录、用户等完整业务数据
 */

const MockData = {
  /**
   * ==================== 企业数据 ====================
   */
  ENTERPRISES: [
    {
      id: "ENT001",
      name: "草原牧业有限公司",
      shortName: "草原牧业",
      types: ["FARM"],
      license: {
        number: "91150100MA0N2XYZ01",
        images: ["license_001.jpg"],
        verifiedAt: "2024-01-15"
      },
      location: {
        province: "内蒙古",
        city: "通辽市",
        district: "科尔沁左翼中旗",
        address: "草原镇牧场路88号"
      },
      contacts: [
        {
          name: "张建国",
          role: "负责人",
          phone: "13800138001",
          wechat: "zhangjianguo88",
          isPrimary: true
        },
        {
          name: "李秀梅",
          role: "销售",
          phone: "13800138002",
          wechat: "lixiumei_sales",
          isPrimary: false
        }
      ],
      scale: {
        养殖场: { capacity: "5000头", area: "200亩" }
      },
      status: "VERIFIED",
      verifiedLevel: "实地认证",
      stats: {
        publishCount: 45,
        dealCount: 28,
        rating: 4.9
      },
      description: "专业从事西门塔尔牛繁育和育肥的大型养殖企业，拥有20年养殖经验",
      createdAt: "2023-06-15",
      updatedAt: "2024-06-01"
    },
    {
      id: "ENT002",
      name: "鲁西黄牛养殖专业合作社",
      shortName: "鲁西合作社",
      types: ["FARM", "DEALER"],
      license: {
        number: "93370100MA3N8ABC12",
        images: ["license_002.jpg"],
        verifiedAt: "2024-02-20"
      },
      location: {
        province: "山东",
        city: "菏泽市",
        district: "郓城县",
        address: "黄安镇牛市街168号"
      },
      contacts: [
        {
          name: "王大明",
          role: "负责人",
          phone: "13900139001",
          wechat: "wangdaming_cattle",
          isPrimary: true
        }
      ],
      scale: {
        养殖场: { capacity: "3000头", area: "150亩" }
      },
      status: "VERIFIED",
      verifiedLevel: "基础认证",
      stats: {
        publishCount: 32,
        dealCount: 18,
        rating: 4.7
      },
      description: "山东省鲁西黄牛保种养殖基地，提供纯种鲁西黄牛及改良品种",
      createdAt: "2023-08-10",
      updatedAt: "2024-05-15"
    },
    {
      id: "ENT003",
      name: "北方肉牛屠宰加工有限公司",
      shortName: "北方屠宰",
      types: ["SLAUGHTER"],
      license: {
        number: "91150200MA0P3DEF34",
        images: ["license_003.jpg"],
        verifiedAt: "2024-03-10"
      },
      location: {
        province: "内蒙古",
        city: "包头市",
        district: "九原区",
        address: "工业园区屠宰路1号"
      },
      contacts: [
        {
          name: "刘志强",
          role: "采购经理",
          phone: "13700137001",
          wechat: "liuzhiqiang_buy",
          isPrimary: true
        }
      ],
      scale: {
        屠宰场: { dailyCapacity: "800头" }
      },
      status: "VERIFIED",
      verifiedLevel: "深度认证",
      stats: {
        publishCount: 0,
        dealCount: 156,
        rating: 4.8
      },
      description: "日屠宰能力800头，具备完整冷链加工能力，产品销往全国",
      createdAt: "2023-05-20",
      updatedAt: "2024-06-10"
    },
    {
      id: "ENT004",
      name: "金丰饲料科技有限公司",
      shortName: "金丰饲料",
      types: ["FEED"],
      license: {
        number: "91410100MA4X5GHI56",
        images: ["license_004.jpg"],
        verifiedAt: "2024-01-25"
      },
      location: {
        province: "河南",
        city: "郑州市",
        district: "中牟县",
        address: "食品工业园饲料路66号"
      },
      contacts: [
        {
          name: "赵明辉",
          role: "销售总监",
          phone: "13600136001",
          wechat: "zhaominghui_feed",
          isPrimary: true
        }
      ],
      scale: {},
      status: "VERIFIED",
      verifiedLevel: "基础认证",
      stats: {
        publishCount: 28,
        dealCount: 89,
        rating: 4.6
      },
      description: "专业牛用饲料研发生产企业，产品包括精饲料、预混料、青贮添加剂等",
      createdAt: "2023-09-05",
      updatedAt: "2024-04-20"
    },
    {
      id: "ENT005",
      name: "牧康畜牧设备有限公司",
      shortName: "牧康设备",
      types: ["EQUIPMENT"],
      license: {
        number: "91370200MA3R6JKL78",
        images: ["license_005.jpg"],
        verifiedAt: "2024-02-15"
      },
      location: {
        province: "山东",
        city: "青岛市",
        district: "即墨区",
        address: "蓝村镇设备产业园18号"
      },
      contacts: [
        {
          name: "孙建华",
          role: "负责人",
          phone: "13500135001",
          wechat: "sunjianhz_equip",
          isPrimary: true
        }
      ],
      scale: {},
      status: "VERIFIED",
      verifiedLevel: "基础认证",
      stats: {
        publishCount: 56,
        dealCount: 42,
        rating: 4.5
      },
      description: "专业畜牧养殖设备制造商，产品包括牛床、饮水器、TMR搅拌车等",
      createdAt: "2023-07-12",
      updatedAt: "2024-05-25"
    },
    // 新增屠宰场企业（含带教工服务）
    {
      id: "ENT006",
      name: "西北清真肉业屠宰有限公司",
      shortName: "西北清真",
      types: ["SLAUGHTER"],
      license: {
        number: "91620100MA7N5MNO90",
        images: ["license_006.jpg"],
        verifiedAt: "2024-03-20"
      },
      location: {
        province: "甘肃",
        city: "兰州市",
        district: "红古区",
        address: "肉类加工园区清真路18号"
      },
      contacts: [
        {
          name: "马建军",
          role: "总经理",
          phone: "13893180001",
          wechat: "majj_halal",
          isPrimary: true
        }
      ],
      scale: {
        屠宰场: { dailyCapacity: "500头", coldStorage: "3000吨" }
      },
      services: ["代宰服务", "分割加工", "冷链仓储", "清真认证", "带教工培训"],
      hasTraining: true,
      trainingInfo: {
        programs: ["分割技术", "检验检疫", "清真规范"],
        capacity: "每期20人",
        duration: "20天",
        fee: 4500,
        graduates: 320
      },
      status: "VERIFIED",
      verifiedLevel: "深度认证",
      stats: {
        publishCount: 0,
        dealCount: 98,
        rating: 4.9,
        trainingCount: 320
      },
      description: "西北最大清真肉牛屠宰加工企业，拥有完整清真认证资质，提供专业带教工培训服务",
      createdAt: "2023-04-10",
      updatedAt: "2024-06-15"
    },
    {
      id: "ENT007",
      name: "东北黑土地肉业加工厂",
      shortName: "黑土地肉业",
      types: ["SLAUGHTER"],
      license: {
        number: "91220100MA1P6QRS12",
        images: ["license_007.jpg"],
        verifiedAt: "2024-01-18"
      },
      location: {
        province: "吉林",
        city: "长春市",
        district: "农安县",
        address: "畜牧产业园屠宰一路1号"
      },
      contacts: [
        {
          name: "李德福",
          role: "负责人",
          phone: "13843180002",
          wechat: "lidf_meat",
          isPrimary: true
        }
      ],
      scale: {
        屠宰场: { dailyCapacity: "600头", coldStorage: "4000吨" }
      },
      services: ["代宰服务", "精细分割", "冷链仓储", "冷链配送", "技能培训"],
      hasTraining: true,
      trainingInfo: {
        programs: ["屠宰操作", "分割技术", "冷链管理"],
        capacity: "每期15人",
        duration: "15天",
        fee: 3500,
        graduates: 180
      },
      status: "VERIFIED",
      verifiedLevel: "实地认证",
      stats: {
        publishCount: 0,
        dealCount: 124,
        rating: 4.7,
        trainingCount: 180
      },
      description: "东北地区现代化肉牛加工企业，与多家大型养殖场建立长期合作，同时开展带教工培训",
      createdAt: "2023-03-22",
      updatedAt: "2024-06-08"
    },
    {
      id: "ENT008",
      name: "中原牛都屠宰加工中心",
      shortName: "中原牛都",
      types: ["SLAUGHTER"],
      license: {
        number: "91410700MA4X7TUV34",
        images: ["license_008.jpg"],
        verifiedAt: "2024-02-28"
      },
      location: {
        province: "河南",
        city: "南阳市",
        district: "邓州市",
        address: "食品工业园牛都大道88号"
      },
      contacts: [
        {
          name: "周大伟",
          role: "采购总监",
          phone: "13837780003",
          wechat: "zhoudw_cow",
          isPrimary: true
        }
      ],
      scale: {
        屠宰场: { dailyCapacity: "1000头", coldStorage: "8000吨" }
      },
      services: ["代宰服务", "分割加工", "定制包装", "冷链仓储", "全国配送"],
      hasTraining: false,
      status: "VERIFIED",
      verifiedLevel: "深度认证",
      stats: {
        publishCount: 0,
        dealCount: 256,
        rating: 4.8
      },
      description: "华中地区最大肉牛屠宰加工企业，日处理能力达1000头，产品销往全国各地",
      createdAt: "2023-02-15",
      updatedAt: "2024-06-12"
    },
    {
      id: "ENT009",
      name: "草原明珠屠宰培训基地",
      shortName: "草原明珠",
      types: ["SLAUGHTER"],
      license: {
        number: "91150400MA0Q8WXY56",
        images: ["license_009.jpg"],
        verifiedAt: "2024-04-05"
      },
      location: {
        province: "内蒙古",
        city: "赤峰市",
        district: "松山区",
        address: "农畜产品加工园区培训路6号"
      },
      contacts: [
        {
          name: "白玉龙",
          role: "培训主管",
          phone: "13847680004",
          wechat: "baiyl_train",
          isPrimary: true
        }
      ],
      scale: {
        屠宰场: { dailyCapacity: "400头", coldStorage: "2000吨" }
      },
      services: ["代宰服务", "分割加工", "带教工培训", "就业推荐", "技能认证"],
      hasTraining: true,
      trainingInfo: {
        programs: ["屠宰基础", "分割技术", "食品安全", "设备操作"],
        capacity: "每期25人",
        duration: "12天",
        fee: 2800,
        graduates: 680,
        employmentRate: 98
      },
      status: "VERIFIED",
      verifiedLevel: "深度认证",
      stats: {
        publishCount: 0,
        dealCount: 78,
        rating: 4.9,
        trainingCount: 680
      },
      description: "专注带教工培训的屠宰企业，被评为自治区技能培训示范基地，累计培养技术人才680人",
      createdAt: "2023-06-01",
      updatedAt: "2024-06-18"
    },
    // 新增设备企业
    {
      id: "ENT010",
      name: "河北冷链设备科技有限公司",
      shortName: "河北冷链",
      types: ["EQUIPMENT"],
      license: {
        number: "91130100MA0D9ZAB78",
        images: ["license_010.jpg"],
        verifiedAt: "2024-03-12"
      },
      location: {
        province: "河北",
        city: "石家庄市",
        district: "正定县",
        address: "装备制造产业园冷链路22号"
      },
      contacts: [
        {
          name: "陈国栋",
          role: "销售经理",
          phone: "13132180005",
          wechat: "chengd_cold",
          isPrimary: true
        }
      ],
      scale: {},
      status: "VERIFIED",
      verifiedLevel: "基础认证",
      stats: {
        publishCount: 38,
        dealCount: 56,
        rating: 4.6
      },
      description: "专业冷链设备制造商，产品包括冷库、冷藏车、制冷机组等，为屠宰场提供整体冷链解决方案",
      createdAt: "2023-08-20",
      updatedAt: "2024-05-30"
    },
    {
      id: "ENT011",
      name: "智慧牧业物联科技公司",
      shortName: "智慧牧业",
      types: ["EQUIPMENT"],
      license: {
        number: "91320500MA1WBCDE90",
        images: ["license_011.jpg"],
        verifiedAt: "2024-04-18"
      },
      location: {
        province: "江苏",
        city: "苏州市",
        district: "昆山市",
        address: "高新技术园区智慧路168号"
      },
      contacts: [
        {
          name: "王科技",
          role: "技术总监",
          phone: "13962580006",
          wechat: "wangkj_iot",
          isPrimary: true
        }
      ],
      scale: {},
      status: "VERIFIED",
      verifiedLevel: "实地认证",
      stats: {
        publishCount: 24,
        dealCount: 18,
        rating: 4.8
      },
      description: "专注智慧养殖设备研发，产品包括智能耳标、环境监控系统、AI称重系统、溯源管理平台等",
      createdAt: "2024-01-10",
      updatedAt: "2024-06-20"
    }
  ],

  /**
   * ==================== 活牛发布信息 ====================
   */
  CATTLE_LISTINGS: [
    {
      id: "CAT001",
      enterpriseId: "ENT001",
      enterpriseName: "草原牧业有限公司",
      title: "西门塔尔育肥公牛 600-700斤 50头",
      cattleType: "BULL",
      breed: "SIMMENTAL",
      ageMonths: 14,
      weightRange: { min: 300, max: 350 },
      quantity: 50,
      price: 18500,
      priceType: "UNIT",
      location: {
        province: "内蒙古",
        city: "通辽市"
      },
      contactName: "张建国",
      contactPhone: "13800138001",
      images: ["cattle_001_1.jpg", "cattle_001_2.jpg", "cattle_001_3.jpg"],
      video: null,
      quarantine: "HAS_CERT",
      deliveryType: "NEGOTIABLE",
      availableDate: "2024-06-20",
      feedingMethod: "圈养",
      immuneInfo: "已完成口蹄疫、布病等常规免疫",
      canInvoice: true,
      description: "自家繁育西门塔尔牛，膘情好，骨架大，适合继续育肥或屠宰。",
      status: "ACTIVE",
      viewCount: 328,
      favoriteCount: 45,
      inquiryCount: 12,
      createdAt: "2024-06-15 09:30:00",
      updatedAt: "2024-06-15 09:30:00"
    },
    {
      id: "CAT002",
      enterpriseId: "ENT001",
      enterpriseName: "草原牧业有限公司",
      title: "西门塔尔怀孕母牛 8-9月龄孕 20头",
      cattleType: "COW",
      breed: "SIMMENTAL",
      ageMonths: 36,
      weightRange: { min: 400, max: 500 },
      quantity: 20,
      price: 25000,
      priceType: "UNIT",
      location: {
        province: "内蒙古",
        city: "通辽市"
      },
      contactName: "张建国",
      contactPhone: "13800138001",
      images: ["cattle_002_1.jpg", "cattle_002_2.jpg"],
      video: "cattle_002.mp4",
      quarantine: "HAS_CERT",
      deliveryType: "DELIVERY",
      availableDate: "2024-06-25",
      feedingMethod: "圈养",
      immuneInfo: "孕期免疫已完成，B超确认孕龄",
      canInvoice: true,
      description: "优质西门塔尔怀孕母牛，8-9月孕龄，预计7-8月产犊，适合扩群。",
      status: "ACTIVE",
      viewCount: 256,
      favoriteCount: 38,
      inquiryCount: 8,
      createdAt: "2024-06-14 14:20:00",
      updatedAt: "2024-06-14 14:20:00"
    },
    {
      id: "CAT003",
      enterpriseId: "ENT002",
      enterpriseName: "鲁西黄牛养殖专业合作社",
      title: "纯种鲁西黄牛犊 3-4月龄 30头",
      cattleType: "CALF",
      breed: "LUXI",
      ageMonths: 4,
      weightRange: { min: 100, max: 150 },
      quantity: 30,
      price: 8500,
      priceType: "UNIT",
      location: {
        province: "山东",
        city: "菏泽市"
      },
      contactName: "王大明",
      contactPhone: "13900139001",
      images: ["cattle_003_1.jpg", "cattle_003_2.jpg", "cattle_003_3.jpg"],
      video: null,
      quarantine: "HAS_CERT",
      deliveryType: "PICKUP",
      availableDate: "2024-06-18",
      feedingMethod: "散养",
      immuneInfo: "已完成首次免疫",
      canInvoice: false,
      description: "纯种鲁西黄牛犊，父本为保种公牛，血统纯正，适合繁育或育肥。",
      status: "ACTIVE",
      viewCount: 412,
      favoriteCount: 67,
      inquiryCount: 15,
      createdAt: "2024-06-13 10:15:00",
      updatedAt: "2024-06-13 10:15:00"
    },
    {
      id: "CAT004",
      enterpriseId: "ENT002",
      enterpriseName: "鲁西黄牛养殖专业合作社",
      title: "利木赞杂交牛 1000斤左右 80头",
      cattleType: "STEER",
      breed: "LIMOUSIN",
      ageMonths: 18,
      weightRange: { min: 480, max: 520 },
      quantity: 80,
      price: 15,
      priceType: "WEIGHT",
      location: {
        province: "山东",
        city: "菏泽市"
      },
      contactName: "王大明",
      contactPhone: "13900139001",
      images: ["cattle_004_1.jpg", "cattle_004_2.jpg"],
      video: "cattle_004.mp4",
      quarantine: "HAS_CERT",
      deliveryType: "NEGOTIABLE",
      availableDate: "2024-06-20",
      feedingMethod: "圈养",
      immuneInfo: "常规免疫已完成",
      canInvoice: true,
      description: "利木赞改良牛，瘦肉率高，出肉率60%以上，适合屠宰场采购。",
      status: "ACTIVE",
      viewCount: 523,
      favoriteCount: 89,
      inquiryCount: 22,
      createdAt: "2024-06-12 16:40:00",
      updatedAt: "2024-06-12 16:40:00"
    },
    {
      id: "CAT005",
      enterpriseId: "ENT001",
      enterpriseName: "草原牧业有限公司",
      title: "安格斯种公牛 2岁 3头",
      cattleType: "BREEDING_BULL",
      breed: "ANGUS",
      ageMonths: 24,
      weightRange: { min: 600, max: 700 },
      quantity: 3,
      price: 45000,
      priceType: "UNIT",
      location: {
        province: "内蒙古",
        city: "通辽市"
      },
      contactName: "张建国",
      contactPhone: "13800138001",
      images: ["cattle_005_1.jpg", "cattle_005_2.jpg", "cattle_005_3.jpg"],
      video: "cattle_005.mp4",
      quarantine: "HAS_CERT",
      deliveryType: "DELIVERY",
      availableDate: "2024-06-22",
      feedingMethod: "圈养",
      immuneInfo: "全套免疫，布病检测阴性",
      canInvoice: true,
      description: "进口纯种安格斯种公牛，具备繁殖资质，精液品质优良，可提供系谱证明。",
      status: "ACTIVE",
      viewCount: 189,
      favoriteCount: 28,
      inquiryCount: 6,
      createdAt: "2024-06-11 11:00:00",
      updatedAt: "2024-06-11 11:00:00"
    },
    {
      id: "CAT006",
      enterpriseId: "ENT002",
      enterpriseName: "鲁西黄牛养殖专业合作社",
      title: "青年母牛 夏洛莱杂交 15头",
      cattleType: "HEIFER",
      breed: "CHAROLAIS",
      ageMonths: 16,
      weightRange: { min: 350, max: 400 },
      quantity: 15,
      price: 16000,
      priceType: "UNIT",
      location: {
        province: "山东",
        city: "菏泽市"
      },
      contactName: "王大明",
      contactPhone: "13900139001",
      images: ["cattle_006_1.jpg", "cattle_006_2.jpg"],
      video: null,
      quarantine: "HAS_CERT",
      deliveryType: "PICKUP",
      availableDate: "2024-06-19",
      feedingMethod: "混合",
      immuneInfo: "已完成配种前免疫",
      canInvoice: false,
      description: "夏洛莱杂交青年母牛，即将达到配种年龄，体型好，适合繁殖场。",
      status: "RESERVED",
      viewCount: 178,
      favoriteCount: 22,
      inquiryCount: 5,
      createdAt: "2024-06-10 09:20:00",
      updatedAt: "2024-06-16 14:30:00"
    }
  ],

  /**
   * ==================== 饲料发布信息 ====================
   */
  FEED_LISTINGS: [
    {
      id: "FEED001",
      enterpriseId: "ENT004",
      enterpriseName: "金丰饲料科技有限公司",
      title: "肉牛育肥专用精饲料 42%蛋白",
      feedType: "CONCENTRATE",
      category: "配合饲料",
      specification: "40kg/袋",
      protein: 42,
      price: 3200,
      priceUnit: "元/吨",
      minOrder: 5,
      minOrderUnit: "吨",
      shelfLife: "6个月",
      location: {
        province: "河南",
        city: "郑州市"
      },
      contactName: "赵明辉",
      contactPhone: "13600136001",
      images: ["feed_001_1.jpg", "feed_001_2.jpg"],
      description: "科学配方育肥料，促进增重，提高饲料转化率",
      status: "ACTIVE",
      viewCount: 245,
      inquiryCount: 18,
      createdAt: "2024-06-10 08:00:00",
      updatedAt: "2024-06-10 08:00:00"
    },
    {
      id: "FEED002",
      enterpriseId: "ENT004",
      enterpriseName: "金丰饲料科技有限公司",
      title: "繁殖母牛预混料 4%",
      feedType: "PREMIX",
      category: "添加剂",
      specification: "25kg/袋",
      protein: 0,
      price: 8500,
      priceUnit: "元/吨",
      minOrder: 1,
      minOrderUnit: "吨",
      shelfLife: "12个月",
      location: {
        province: "河南",
        city: "郑州市"
      },
      contactName: "赵明辉",
      contactPhone: "13600136001",
      images: ["feed_002_1.jpg"],
      description: "富含繁殖期所需维生素和微量元素，提高受胎率",
      status: "ACTIVE",
      viewCount: 156,
      inquiryCount: 8,
      createdAt: "2024-06-08 10:30:00",
      updatedAt: "2024-06-08 10:30:00"
    }
  ],

  /**
   * ==================== 设备发布信息 ====================
   */
  EQUIPMENT_LISTINGS: [
    {
      id: "EQUIP001",
      enterpriseId: "ENT005",
      enterpriseName: "牧康畜牧设备有限公司",
      title: "全自动TMR饲料搅拌车 12立方",
      equipmentType: "FEED_PROCESSING",
      brand: "牧康",
      model: "MK-TMR-12",
      condition: "全新",
      price: 185000,
      priceUnit: "元/台",
      warranty: "整机保修1年",
      location: {
        province: "山东",
        city: "青岛市"
      },
      contactName: "孙建华",
      contactPhone: "13500135001",
      images: ["equip_001_1.jpg", "equip_001_2.jpg", "equip_001_3.jpg"],
      video: "equip_001.mp4",
      description: "全自动TMR搅拌车，配备称重系统，可设定配方，适合500头以上规模牛场",
      status: "ACTIVE",
      viewCount: 312,
      inquiryCount: 25,
      createdAt: "2024-06-05 14:00:00",
      updatedAt: "2024-06-05 14:00:00"
    },
    {
      id: "EQUIP002",
      enterpriseId: "ENT005",
      enterpriseName: "牧康畜牧设备有限公司",
      title: "不锈钢自动饮水器 批发",
      equipmentType: "FEEDING",
      brand: "牧康",
      model: "MK-DW-01",
      condition: "全新",
      price: 85,
      priceUnit: "元/个",
      warranty: "质保2年",
      location: {
        province: "山东",
        city: "青岛市"
      },
      contactName: "孙建华",
      contactPhone: "13500135001",
      images: ["equip_002_1.jpg", "equip_002_2.jpg"],
      video: null,
      description: "304不锈钢材质，耐腐蚀，水位自动控制，安装简便",
      status: "ACTIVE",
      viewCount: 567,
      inquiryCount: 42,
      createdAt: "2024-06-03 09:15:00",
      updatedAt: "2024-06-03 09:15:00"
    },
    // 新增设备发布
    {
      id: "EQUIP003",
      enterpriseId: "ENT010",
      enterpriseName: "河北冷链设备科技有限公司",
      title: "组合式冷库 100吨级 定制安装",
      equipmentType: "COLD_CHAIN",
      brand: "冷链星",
      model: "LLX-100T",
      condition: "全新",
      price: 380000,
      priceUnit: "元/套",
      warranty: "压缩机保修3年，整体保修1年",
      location: {
        province: "河北",
        city: "石家庄市"
      },
      contactName: "陈国栋",
      contactPhone: "13132180005",
      images: ["equip_003_1.jpg", "equip_003_2.jpg", "equip_003_3.jpg"],
      video: "equip_003.mp4",
      description: "100吨级组合式冷库，适合中型屠宰场，温度可调-18°C至5°C，含安装调试",
      status: "ACTIVE",
      viewCount: 234,
      inquiryCount: 18,
      createdAt: "2024-06-08 10:30:00",
      updatedAt: "2024-06-08 10:30:00"
    },
    {
      id: "EQUIP004",
      enterpriseId: "ENT010",
      enterpriseName: "河北冷链设备科技有限公司",
      title: "冷藏运输车 5吨 厢式",
      equipmentType: "TRANSPORT",
      brand: "冷链星",
      model: "LLX-TC-5T",
      condition: "全新",
      price: 168000,
      priceUnit: "元/辆",
      warranty: "厢体保修2年",
      location: {
        province: "河北",
        city: "石家庄市"
      },
      contactName: "陈国栋",
      contactPhone: "13132180005",
      images: ["equip_004_1.jpg", "equip_004_2.jpg"],
      video: null,
      description: "5吨级冷藏运输车，保温效果好，适合牛肉中短途配送，支持GPS定位",
      status: "ACTIVE",
      viewCount: 189,
      inquiryCount: 12,
      createdAt: "2024-06-06 14:20:00",
      updatedAt: "2024-06-06 14:20:00"
    },
    {
      id: "EQUIP005",
      enterpriseId: "ENT011",
      enterpriseName: "智慧牧业物联科技公司",
      title: "智能电子耳标 RFID芯片",
      equipmentType: "MONITORING",
      brand: "智牧云",
      model: "ZMY-ET-01",
      condition: "全新",
      price: 25,
      priceUnit: "元/个",
      warranty: "质保3年",
      location: {
        province: "江苏",
        city: "苏州市"
      },
      contactName: "王科技",
      contactPhone: "13962580006",
      images: ["equip_005_1.jpg", "equip_005_2.jpg"],
      video: null,
      description: "RFID智能耳标，支持手持读取和自动识别，配合溯源系统使用，最小订购量1000个",
      status: "ACTIVE",
      viewCount: 456,
      inquiryCount: 35,
      createdAt: "2024-06-10 09:00:00",
      updatedAt: "2024-06-10 09:00:00"
    },
    {
      id: "EQUIP006",
      enterpriseId: "ENT011",
      enterpriseName: "智慧牧业物联科技公司",
      title: "AI智能称重系统 无感过磅",
      equipmentType: "MONITORING",
      brand: "智牧云",
      model: "ZMY-AW-500",
      condition: "全新",
      price: 58000,
      priceUnit: "元/套",
      warranty: "整机保修2年",
      location: {
        province: "江苏",
        city: "苏州市"
      },
      contactName: "王科技",
      contactPhone: "13962580006",
      images: ["equip_006_1.jpg", "equip_006_2.jpg", "equip_006_3.jpg"],
      video: "equip_006.mp4",
      description: "AI视觉+地磅联动称重系统，牛只通过自动识别体重，数据实时上传云平台",
      status: "ACTIVE",
      viewCount: 287,
      inquiryCount: 22,
      createdAt: "2024-06-12 11:15:00",
      updatedAt: "2024-06-12 11:15:00"
    },
    {
      id: "EQUIP007",
      enterpriseId: "ENT005",
      enterpriseName: "牧康畜牧设备有限公司",
      title: "牛床橡胶垫 防滑耐磨 厂家直销",
      equipmentType: "FEEDING",
      brand: "牧康",
      model: "MK-RM-01",
      condition: "全新",
      price: 280,
      priceUnit: "元/平方米",
      warranty: "质保5年",
      location: {
        province: "山东",
        city: "青岛市"
      },
      contactName: "孙建华",
      contactPhone: "13500135001",
      images: ["equip_007_1.jpg", "equip_007_2.jpg"],
      video: null,
      description: "优质橡胶材质，防滑抗菌，厚度20mm，适合各类牛舍，改善牛只卧床舒适度",
      status: "ACTIVE",
      viewCount: 412,
      inquiryCount: 38,
      createdAt: "2024-06-01 08:45:00",
      updatedAt: "2024-06-01 08:45:00"
    },
    {
      id: "EQUIP008",
      enterpriseId: "ENT005",
      enterpriseName: "牧康畜牧设备有限公司",
      title: "粪污分离机 日处理50吨",
      equipmentType: "WASTE",
      brand: "牧康",
      model: "MK-FW-50",
      condition: "全新",
      price: 45000,
      priceUnit: "元/台",
      warranty: "整机保修1年",
      location: {
        province: "山东",
        city: "青岛市"
      },
      contactName: "孙建华",
      contactPhone: "13500135001",
      images: ["equip_008_1.jpg", "equip_008_2.jpg"],
      video: "equip_008.mp4",
      description: "固液分离效率高，日处理粪污50吨，干物质分离后可做有机肥原料",
      status: "ACTIVE",
      viewCount: 198,
      inquiryCount: 15,
      createdAt: "2024-05-28 15:30:00",
      updatedAt: "2024-05-28 15:30:00"
    }
  ],

  /**
   * ==================== 溯源记录 ====================
   */
  TRACE_RECORDS: [
    {
      traceId: "TRACE20240615001",
      cattleId: "CAT001-01",
      earTag: "CN156150100001",
      breed: "西门塔尔",
      timeline: [
        {
          stage: "出生",
          date: "2023-04-15",
          location: "内蒙古通辽市科尔沁左翼中旗",
          data: {
            birthWeight: "38kg",
            mother: "COW-2021-088",
            father: "BULL-2020-012"
          },
          operator: "张建国",
          images: ["trace_001_birth.jpg"]
        },
        {
          stage: "免疫",
          date: "2023-05-20",
          location: "内蒙古通辽市科尔沁左翼中旗",
          data: {
            vaccines: ["口蹄疫", "布病"],
            batchNo: "V20230520-001",
            vet: "李卫东"
          },
          operator: "李卫东",
          images: ["trace_001_vaccine.jpg"]
        },
        {
          stage: "养殖",
          date: "2023-04-15~2024-06-15",
          location: "内蒙古通辽市科尔沁左翼中旗",
          data: {
            farm: "草原牧业养殖基地",
            feedType: "玉米青贮+精饲料",
            avgDailyGain: "1.2kg/天",
            currentWeight: "650斤"
          },
          operator: "张建国",
          images: ["trace_001_farm1.jpg", "trace_001_farm2.jpg"]
        },
        {
          stage: "检疫",
          date: "2024-06-10",
          location: "通辽市动物卫生监督所",
          data: {
            certNo: "JY2024061000123",
            inspector: "王志明",
            result: "合格",
            validUntil: "2024-06-25"
          },
          operator: "王志明",
          images: ["trace_001_cert.jpg"]
        }
      ],
      certifications: [
        { type: "动物耳标", tagNo: "CN156150100001", registeredAt: "2023-04-16" },
        { type: "检疫证明", certNo: "JY2024061000123", validUntil: "2024-06-25" }
      ],
      qualityReport: null,
      currentStage: "待销售",
      createdAt: "2023-04-16",
      updatedAt: "2024-06-15"
    },
    {
      traceId: "TRACE20240610002",
      cattleId: "CAT004-15",
      earTag: "CN156370300015",
      breed: "利木赞杂交",
      timeline: [
        {
          stage: "出生",
          date: "2022-12-08",
          location: "山东省菏泽市郓城县",
          data: {
            birthWeight: "35kg",
            mother: "COW-2019-056",
            father: "BULL-LM-003"
          },
          operator: "王大明",
          images: ["trace_002_birth.jpg"]
        },
        {
          stage: "免疫",
          date: "2023-01-15",
          location: "山东省菏泽市郓城县",
          data: {
            vaccines: ["口蹄疫", "布病", "炭疽"],
            batchNo: "V20230115-088",
            vet: "陈国强"
          },
          operator: "陈国强",
          images: ["trace_002_vaccine.jpg"]
        },
        {
          stage: "养殖",
          date: "2022-12-08~2024-06-12",
          location: "山东省菏泽市郓城县黄安镇",
          data: {
            farm: "鲁西黄牛养殖基地",
            feedType: "玉米+豆粕+青贮",
            avgDailyGain: "1.4kg/天",
            currentWeight: "1000斤"
          },
          operator: "王大明",
          images: ["trace_002_farm.jpg"]
        },
        {
          stage: "检疫",
          date: "2024-06-12",
          location: "菏泽市动物卫生监督所",
          data: {
            certNo: "JY2024061200456",
            inspector: "张伟",
            result: "合格",
            validUntil: "2024-06-27"
          },
          operator: "张伟",
          images: ["trace_002_cert.jpg"]
        },
        {
          stage: "运输",
          date: "2024-06-18",
          from: "山东菏泽",
          to: "内蒙古包头",
          data: {
            vehicle: "鲁R88888",
            driver: "赵师傅",
            distance: "890公里",
            duration: "12小时"
          },
          operator: "赵师傅",
          images: ["trace_002_transport.jpg"]
        },
        {
          stage: "屠宰",
          date: "2024-06-19",
          location: "内蒙古包头市九原区",
          data: {
            plant: "北方肉牛屠宰加工有限公司",
            slaughterCert: "TZ2024061900089",
            batchNo: "B20240619-003",
            hotWeight: "285kg"
          },
          operator: "刘志强",
          images: ["trace_002_slaughter.jpg"]
        }
      ],
      certifications: [
        { type: "动物耳标", tagNo: "CN156370300015", registeredAt: "2022-12-10" },
        { type: "检疫证明", certNo: "JY2024061200456", validUntil: "2024-06-27" },
        { type: "屠宰合格证", certNo: "TZ2024061900089", issuedAt: "2024-06-19" }
      ],
      qualityReport: {
        grade: "优质",
        marbling: 4,
        meatColor: "鲜红",
        fatColor: "乳白",
        pH: 5.6,
        testDate: "2024-06-19"
      },
      currentStage: "已屠宰",
      createdAt: "2022-12-10",
      updatedAt: "2024-06-19"
    }
  ],

  /**
   * ==================== 用户数据 ====================
   */
  USERS: [
    {
      id: "USER001",
      phone: "13800138001",
      name: "张建国",
      avatar: "avatar_001.jpg",
      enterpriseId: "ENT001",
      enterpriseName: "草原牧业有限公司",
      role: "admin",
      level: "VIP3",
      createdAt: "2023-06-15"
    },
    {
      id: "USER002",
      phone: "13900139001",
      name: "王大明",
      avatar: "avatar_002.jpg",
      enterpriseId: "ENT002",
      enterpriseName: "鲁西黄牛养殖专业合作社",
      role: "admin",
      level: "VIP2",
      createdAt: "2023-08-10"
    },
    {
      id: "USER003",
      phone: "13700137001",
      name: "刘志强",
      avatar: "avatar_003.jpg",
      enterpriseId: "ENT003",
      enterpriseName: "北方肉牛屠宰加工有限公司",
      role: "buyer",
      level: "VIP3",
      createdAt: "2023-05-20"
    },
    {
      id: "ADMIN001",
      phone: "18888888888",
      name: "平台管理员",
      avatar: null,
      enterpriseId: null,
      enterpriseName: null,
      role: "platform_admin",
      level: null,
      createdAt: "2023-01-01"
    }
  ],

  /**
   * ==================== 审核队列 ====================
   */
  REVIEW_QUEUE: [
    {
      id: "REV001",
      type: "cattle",
      targetId: "CAT_PENDING_001",
      title: "秦川牛 500斤 100头",
      enterpriseName: "陕西某养殖场",
      submittedAt: "2024-06-15 08:30:00",
      status: "PENDING",
      priority: "normal"
    },
    {
      id: "REV002",
      type: "enterprise",
      targetId: "ENT_PENDING_001",
      title: "新疆天山牧业有限公司",
      enterpriseName: "-",
      submittedAt: "2024-06-15 10:20:00",
      status: "PENDING",
      priority: "high"
    },
    {
      id: "REV003",
      type: "cattle",
      targetId: "CAT_PENDING_002",
      title: "海福特牛犊 2月龄 20头",
      enterpriseName: "河北承德某合作社",
      submittedAt: "2024-06-14 16:45:00",
      status: "PENDING",
      priority: "normal"
    }
  ],

  /**
   * ==================== 统计数据（仪表板用）====================
   */
  DASHBOARD_STATS: {
    overview: {
      totalEnterprises: 1256,
      verifiedEnterprises: 892,
      totalListings: 3456,
      activeListings: 2134,
      todayNewListings: 28,
      todayInquiries: 156
    },
    categoryStats: [
      { category: "活牛交易", count: 1823, percentage: 52.7 },
      { category: "饲料", count: 645, percentage: 18.7 },
      { category: "牛肉销售", count: 423, percentage: 12.2 },
      { category: "设备", count: 312, percentage: 9.0 },
      { category: "养殖场", count: 156, percentage: 4.5 },
      { category: "屠宰场", count: 97, percentage: 2.9 }
    ],
    regionStats: [
      { province: "内蒙古", count: 456, percentage: 21.4 },
      { province: "山东", count: 389, percentage: 18.2 },
      { province: "河北", count: 287, percentage: 13.4 },
      { province: "河南", count: 245, percentage: 11.5 },
      { province: "吉林", count: 198, percentage: 9.3 },
      { province: "其他", count: 559, percentage: 26.2 }
    ],
    trendData: {
      dates: ["06-10", "06-11", "06-12", "06-13", "06-14", "06-15", "06-16"],
      newListings: [24, 31, 28, 35, 29, 33, 28],
      inquiries: [142, 158, 135, 167, 149, 172, 156]
    }
  },

  /**
   * ==================== 工具方法 ====================
   */

  // 根据ID获取企业
  getEnterpriseById(id) {
    return this.ENTERPRISES.find(e => e.id === id);
  },

  // 根据ID获取活牛发布
  getCattleListingById(id) {
    return this.CATTLE_LISTINGS.find(c => c.id === id);
  },

  // 根据溯源码获取记录
  getTraceByCode(traceId) {
    return this.TRACE_RECORDS.find(t => t.traceId === traceId);
  },

  // 根据耳标号获取溯源记录
  getTraceByEarTag(earTag) {
    return this.TRACE_RECORDS.find(t => t.earTag === earTag);
  },

  // 筛选活牛列表
  filterCattleListings(filters = {}) {
    let result = [...this.CATTLE_LISTINGS];

    if (filters.status) {
      result = result.filter(c => c.status === filters.status);
    }
    if (filters.cattleType) {
      result = result.filter(c => c.cattleType === filters.cattleType);
    }
    if (filters.breed) {
      result = result.filter(c => c.breed === filters.breed);
    }
    if (filters.province) {
      result = result.filter(c => c.location.province === filters.province);
    }
    if (filters.minPrice) {
      result = result.filter(c => c.price >= filters.minPrice);
    }
    if (filters.maxPrice) {
      result = result.filter(c => c.price <= filters.maxPrice);
    }

    // 排序
    if (filters.sortBy === 'price_asc') {
      result.sort((a, b) => a.price - b.price);
    } else if (filters.sortBy === 'price_desc') {
      result.sort((a, b) => b.price - a.price);
    } else if (filters.sortBy === 'quantity_desc') {
      result.sort((a, b) => b.quantity - a.quantity);
    } else {
      // 默认按时间降序
      result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return result;
  },

  // 搜索活牛
  searchCattleListings(keyword) {
    if (!keyword) return this.CATTLE_LISTINGS;
    const lowerKeyword = keyword.toLowerCase();
    return this.CATTLE_LISTINGS.filter(c =>
      c.title.toLowerCase().includes(lowerKeyword) ||
      c.description.toLowerCase().includes(lowerKeyword) ||
      c.location.province.includes(keyword) ||
      c.location.city.includes(keyword)
    );
  },

  // 获取热门发布
  getHotListings(limit = 6) {
    return [...this.CATTLE_LISTINGS]
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, limit);
  },

  // 获取最新发布
  getLatestListings(limit = 6) {
    return [...this.CATTLE_LISTINGS]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  },

  // ==================== 设备相关方法 ====================

  // 根据ID获取设备发布
  getEquipmentListingById(id) {
    return this.EQUIPMENT_LISTINGS.find(e => e.id === id);
  },

  // 筛选设备列表
  filterEquipmentListings(filters = {}) {
    let result = [...this.EQUIPMENT_LISTINGS];

    if (filters.status) {
      result = result.filter(e => e.status === filters.status);
    }
    if (filters.equipmentType) {
      result = result.filter(e => e.equipmentType === filters.equipmentType);
    }
    if (filters.condition) {
      result = result.filter(e => e.condition === filters.condition);
    }
    if (filters.province) {
      result = result.filter(e => e.location.province === filters.province);
    }
    if (filters.minPrice) {
      result = result.filter(e => e.price >= filters.minPrice);
    }
    if (filters.maxPrice) {
      result = result.filter(e => e.price <= filters.maxPrice);
    }
    if (filters.brand) {
      result = result.filter(e => e.brand === filters.brand);
    }

    // 排序
    if (filters.sortBy === 'price_asc') {
      result.sort((a, b) => a.price - b.price);
    } else if (filters.sortBy === 'price_desc') {
      result.sort((a, b) => b.price - a.price);
    } else if (filters.sortBy === 'views') {
      result.sort((a, b) => b.viewCount - a.viewCount);
    } else {
      // 默认按时间降序
      result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return result;
  },

  // 搜索设备
  searchEquipmentListings(keyword) {
    if (!keyword) return this.EQUIPMENT_LISTINGS;
    const lowerKeyword = keyword.toLowerCase();
    return this.EQUIPMENT_LISTINGS.filter(e =>
      e.title.toLowerCase().includes(lowerKeyword) ||
      e.description.toLowerCase().includes(lowerKeyword) ||
      e.brand.toLowerCase().includes(lowerKeyword) ||
      e.location.province.includes(keyword) ||
      e.location.city.includes(keyword)
    );
  },

  // 获取热门设备
  getHotEquipmentListings(limit = 6) {
    return [...this.EQUIPMENT_LISTINGS]
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, limit);
  },

  // 按设备类型统计
  getEquipmentTypeStats() {
    const stats = {};
    this.EQUIPMENT_LISTINGS.forEach(e => {
      stats[e.equipmentType] = (stats[e.equipmentType] || 0) + 1;
    });
    return stats;
  },

  // ==================== 企业相关方法 ====================

  // 按类型获取企业列表
  getEnterprisesByType(type) {
    return this.ENTERPRISES.filter(e => e.types.includes(type));
  },

  // 获取所有养殖场
  getFarmEnterprises() {
    return this.getEnterprisesByType('FARM');
  },

  // 获取所有屠宰场
  getSlaughterEnterprises() {
    return this.getEnterprisesByType('SLAUGHTER');
  },

  // 获取提供培训服务的屠宰场
  getTrainingSlaughterEnterprises() {
    return this.ENTERPRISES.filter(e =>
      e.types.includes('SLAUGHTER') && e.hasTraining === true
    );
  },

  // 获取所有设备商
  getEquipmentEnterprises() {
    return this.getEnterprisesByType('EQUIPMENT');
  },

  // 筛选企业
  filterEnterprises(filters = {}) {
    let result = [...this.ENTERPRISES];

    if (filters.type) {
      result = result.filter(e => e.types.includes(filters.type));
    }
    if (filters.status) {
      result = result.filter(e => e.status === filters.status);
    }
    if (filters.province) {
      result = result.filter(e => e.location.province === filters.province);
    }
    if (filters.hasTraining !== undefined) {
      result = result.filter(e => e.hasTraining === filters.hasTraining);
    }
    if (filters.minRating) {
      result = result.filter(e => e.stats.rating >= filters.minRating);
    }

    // 排序
    if (filters.sortBy === 'rating') {
      result.sort((a, b) => b.stats.rating - a.stats.rating);
    } else if (filters.sortBy === 'deals') {
      result.sort((a, b) => b.stats.dealCount - a.stats.dealCount);
    } else if (filters.sortBy === 'training') {
      result.sort((a, b) => (b.stats.trainingCount || 0) - (a.stats.trainingCount || 0));
    }

    return result;
  },

  // 搜索企业
  searchEnterprises(keyword) {
    if (!keyword) return this.ENTERPRISES;
    const lowerKeyword = keyword.toLowerCase();
    return this.ENTERPRISES.filter(e =>
      e.name.toLowerCase().includes(lowerKeyword) ||
      e.description.toLowerCase().includes(lowerKeyword) ||
      e.services.some(s => s.includes(keyword)) ||
      e.location.province.includes(keyword) ||
      e.location.city.includes(keyword)
    );
  },

  // 获取高评分企业
  getTopRatedEnterprises(limit = 10) {
    return [...this.ENTERPRISES]
      .sort((a, b) => b.stats.rating - a.stats.rating)
      .slice(0, limit);
  }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MockData;
}
