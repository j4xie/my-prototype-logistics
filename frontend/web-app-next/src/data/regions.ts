/**
 * 中国省市区三级联动数据
 * 包含省份、城市、区县信息
 */

export interface District {
  code: string;
  name: string;
}

export interface City extends District {
  districts: District[];
}

export interface Province extends District {
  cities: City[];
}

// 省份和主要城市数据（简化版，实际项目应使用完整的省市区数据库）
export const provinces: Province[] = [
  {
    code: "110000",
    name: "北京市",
    cities: [
      {
        code: "110100",
        name: "北京市",
        districts: [
          { code: "110101", name: "东城区" },
          { code: "110102", name: "西城区" },
          { code: "110105", name: "朝阳区" },
          { code: "110106", name: "丰台区" },
          { code: "110107", name: "石景山区" },
          { code: "110108", name: "海淀区" },
          { code: "110109", name: "门头沟区" },
          { code: "110111", name: "房山区" },
          { code: "110112", name: "通州区" },
          { code: "110113", name: "顺义区" },
          { code: "110114", name: "昌平区" },
          { code: "110115", name: "大兴区" },
          { code: "110116", name: "怀柔区" },
          { code: "110117", name: "平谷区" },
          { code: "110118", name: "密云区" },
          { code: "110119", name: "延庆区" }
        ]
      }
    ]
  },
  {
    code: "120000",
    name: "天津市",
    cities: [
      {
        code: "120100",
        name: "天津市",
        districts: [
          { code: "120101", name: "和平区" },
          { code: "120102", name: "河东区" },
          { code: "120103", name: "河西区" },
          { code: "120104", name: "南开区" },
          { code: "120105", name: "河北区" },
          { code: "120106", name: "红桥区" },
          { code: "120110", name: "东丽区" },
          { code: "120111", name: "西青区" },
          { code: "120112", name: "津南区" },
          { code: "120113", name: "北辰区" },
          { code: "120114", name: "武清区" },
          { code: "120115", name: "宝坻区" },
          { code: "120116", name: "滨海新区" },
          { code: "120117", name: "宁河区" },
          { code: "120118", name: "静海区" },
          { code: "120119", name: "蓟州区" }
        ]
      }
    ]
  },
  {
    code: "310000",
    name: "上海市",
    cities: [
      {
        code: "310100",
        name: "上海市",
        districts: [
          { code: "310101", name: "黄浦区" },
          { code: "310104", name: "徐汇区" },
          { code: "310105", name: "长宁区" },
          { code: "310106", name: "静安区" },
          { code: "310107", name: "普陀区" },
          { code: "310109", name: "虹口区" },
          { code: "310110", name: "杨浦区" },
          { code: "310112", name: "闵行区" },
          { code: "310113", name: "宝山区" },
          { code: "310114", name: "嘉定区" },
          { code: "310115", name: "浦东新区" },
          { code: "310116", name: "金山区" },
          { code: "310117", name: "松江区" },
          { code: "310118", name: "青浦区" },
          { code: "310120", name: "奉贤区" },
          { code: "310151", name: "崇明区" }
        ]
      }
    ]
  },
  {
    code: "500000",
    name: "重庆市",
    cities: [
      {
        code: "500100",
        name: "重庆市",
        districts: [
          { code: "500101", name: "万州区" },
          { code: "500102", name: "涪陵区" },
          { code: "500103", name: "渝中区" },
          { code: "500104", name: "大渡口区" },
          { code: "500105", name: "江北区" },
          { code: "500106", name: "沙坪坝区" },
          { code: "500107", name: "九龙坡区" },
          { code: "500108", name: "南岸区" },
          { code: "500109", name: "北碚区" },
          { code: "500110", name: "綦江区" },
          { code: "500111", name: "大足区" },
          { code: "500112", name: "渝北区" },
          { code: "500113", name: "巴南区" },
          { code: "500114", name: "黔江区" },
          { code: "500115", name: "长寿区" },
          { code: "500116", name: "江津区" },
          { code: "500117", name: "合川区" },
          { code: "500118", name: "永川区" },
          { code: "500119", name: "南川区" },
          { code: "500120", name: "璧山区" },
          { code: "500151", name: "铜梁区" },
          { code: "500152", name: "潼南区" },
          { code: "500153", name: "荣昌区" },
          { code: "500154", name: "开州区" },
          { code: "500155", name: "梁平区" },
          { code: "500156", name: "武隆区" }
        ]
      }
    ]
  },
  {
    code: "130000",
    name: "河北省",
    cities: [
      {
        code: "130100",
        name: "石家庄市",
        districts: [
          { code: "130102", name: "长安区" },
          { code: "130104", name: "桥西区" },
          { code: "130105", name: "新华区" },
          { code: "130107", name: "井陉矿区" },
          { code: "130108", name: "裕华区" },
          { code: "130109", name: "藁城区" },
          { code: "130110", name: "鹿泉区" },
          { code: "130111", name: "栾城区" },
          { code: "130121", name: "井陉县" },
          { code: "130123", name: "正定县" },
          { code: "130125", name: "行唐县" },
          { code: "130126", name: "灵寿县" },
          { code: "130127", name: "高邑县" },
          { code: "130128", name: "深泽县" },
          { code: "130129", name: "赞皇县" },
          { code: "130130", name: "无极县" },
          { code: "130131", name: "平山县" },
          { code: "130132", name: "元氏县" },
          { code: "130133", name: "赵县" }
        ]
      },
      {
        code: "130200",
        name: "唐山市",
        districts: [
          { code: "130202", name: "路南区" },
          { code: "130203", name: "路北区" },
          { code: "130204", name: "古冶区" },
          { code: "130205", name: "开平区" },
          { code: "130207", name: "丰南区" },
          { code: "130208", name: "丰润区" },
          { code: "130209", name: "曹妃甸区" },
          { code: "130223", name: "滦县" },
          { code: "130224", name: "滦南县" },
          { code: "130225", name: "乐亭县" },
          { code: "130227", name: "迁西县" },
          { code: "130229", name: "玉田县" }
        ]
      }
    ]
  },
  {
    code: "440000",
    name: "广东省",
    cities: [
      {
        code: "440100",
        name: "广州市",
        districts: [
          { code: "440103", name: "荔湾区" },
          { code: "440104", name: "越秀区" },
          { code: "440105", name: "海珠区" },
          { code: "440106", name: "天河区" },
          { code: "440111", name: "白云区" },
          { code: "440112", name: "黄埔区" },
          { code: "440113", name: "番禺区" },
          { code: "440114", name: "花都区" },
          { code: "440115", name: "南沙区" },
          { code: "440117", name: "从化区" },
          { code: "440118", name: "增城区" }
        ]
      },
      {
        code: "440300",
        name: "深圳市",
        districts: [
          { code: "440303", name: "罗湖区" },
          { code: "440304", name: "福田区" },
          { code: "440305", name: "南山区" },
          { code: "440306", name: "宝安区" },
          { code: "440307", name: "龙岗区" },
          { code: "440308", name: "盐田区" },
          { code: "440309", name: "龙华区" },
          { code: "440310", name: "坪山区" },
          { code: "440311", name: "光明区" },
          { code: "440312", name: "大鹏新区" }
        ]
      },
      {
        code: "440400",
        name: "珠海市",
        districts: [
          { code: "440402", name: "香洲区" },
          { code: "440403", name: "斗门区" },
          { code: "440404", name: "金湾区" }
        ]
      },
      {
        code: "440600",
        name: "佛山市",
        districts: [
          { code: "440604", name: "禅城区" },
          { code: "440605", name: "南海区" },
          { code: "440606", name: "顺德区" },
          { code: "440607", name: "三水区" },
          { code: "440608", name: "高明区" }
        ]
      },
      {
        code: "441900",
        name: "东莞市",
        districts: [
          { code: "441900001", name: "莞城街道" },
          { code: "441900002", name: "南城街道" },
          { code: "441900003", name: "东城街道" },
          { code: "441900004", name: "万江街道" },
          { code: "441900005", name: "石碣镇" },
          { code: "441900006", name: "石龙镇" },
          { code: "441900007", name: "茶山镇" },
          { code: "441900008", name: "石排镇" },
          { code: "441900009", name: "企石镇" },
          { code: "441900010", name: "横沥镇" }
        ]
      }
    ]
  },
  {
    code: "320000",
    name: "江苏省",
    cities: [
      {
        code: "320100",
        name: "南京市",
        districts: [
          { code: "320102", name: "玄武区" },
          { code: "320104", name: "秦淮区" },
          { code: "320105", name: "建邺区" },
          { code: "320106", name: "鼓楼区" },
          { code: "320111", name: "浦口区" },
          { code: "320113", name: "栖霞区" },
          { code: "320114", name: "雨花台区" },
          { code: "320115", name: "江宁区" },
          { code: "320116", name: "六合区" },
          { code: "320117", name: "溧水区" },
          { code: "320118", name: "高淳区" }
        ]
      },
      {
        code: "320200",
        name: "无锡市",
        districts: [
          { code: "320205", name: "锡山区" },
          { code: "320206", name: "惠山区" },
          { code: "320211", name: "滨湖区" },
          { code: "320213", name: "梁溪区" },
          { code: "320214", name: "新吴区" },
          { code: "320281", name: "江阴市" },
          { code: "320282", name: "宜兴市" }
        ]
      },
      {
        code: "320500",
        name: "苏州市",
        districts: [
          { code: "320505", name: "虎丘区" },
          { code: "320506", name: "吴中区" },
          { code: "320507", name: "相城区" },
          { code: "320508", name: "姑苏区" },
          { code: "320509", name: "吴江区" },
          { code: "320581", name: "常熟市" },
          { code: "320582", name: "张家港市" },
          { code: "320583", name: "昆山市" },
          { code: "320585", name: "太仓市" }
        ]
      }
    ]
  },
  {
    code: "330000",
    name: "浙江省",
    cities: [
      {
        code: "330100",
        name: "杭州市",
        districts: [
          { code: "330102", name: "上城区" },
          { code: "330103", name: "下城区" },
          { code: "330104", name: "江干区" },
          { code: "330105", name: "拱墅区" },
          { code: "330106", name: "西湖区" },
          { code: "330108", name: "滨江区" },
          { code: "330109", name: "萧山区" },
          { code: "330110", name: "余杭区" },
          { code: "330111", name: "富阳区" },
          { code: "330112", name: "临安区" },
          { code: "330122", name: "桐庐县" },
          { code: "330127", name: "淳安县" },
          { code: "330182", name: "建德市" }
        ]
      },
      {
        code: "330200",
        name: "宁波市",
        districts: [
          { code: "330203", name: "海曙区" },
          { code: "330204", name: "江东区" },
          { code: "330205", name: "江北区" },
          { code: "330206", name: "北仑区" },
          { code: "330211", name: "镇海区" },
          { code: "330212", name: "鄞州区" },
          { code: "330213", name: "奉化区" },
          { code: "330225", name: "象山县" },
          { code: "330226", name: "宁海县" },
          { code: "330281", name: "余姚市" },
          { code: "330282", name: "慈溪市" }
        ]
      }
    ]
  },
  {
    code: "370000",
    name: "山东省",
    cities: [
      {
        code: "370100",
        name: "济南市",
        districts: [
          { code: "370102", name: "历下区" },
          { code: "370103", name: "市中区" },
          { code: "370104", name: "槐荫区" },
          { code: "370105", name: "天桥区" },
          { code: "370112", name: "历城区" },
          { code: "370113", name: "长清区" },
          { code: "370114", name: "章丘区" },
          { code: "370115", name: "济阳区" },
          { code: "370116", name: "莱芜区" },
          { code: "370117", name: "钢城区" },
          { code: "370124", name: "平阴县" },
          { code: "370126", name: "商河县" }
        ]
      },
      {
        code: "370200",
        name: "青岛市",
        districts: [
          { code: "370202", name: "市南区" },
          { code: "370203", name: "市北区" },
          { code: "370211", name: "黄岛区" },
          { code: "370212", name: "崂山区" },
          { code: "370213", name: "李沧区" },
          { code: "370214", name: "城阳区" },
          { code: "370215", name: "即墨区" },
          { code: "370281", name: "胶州市" },
          { code: "370283", name: "平度市" },
          { code: "370285", name: "莱西市" }
        ]
      }
    ]
  }
];

/**
 * 根据省份代码获取城市列表
 */
export const getCitiesByProvince = (provinceCode: string): City[] => {
  const province = provinces.find(p => p.code === provinceCode);
  return province?.cities || [];
};

/**
 * 根据城市代码获取区县列表
 */
export const getDistrictsByCity = (cityCode: string): District[] => {
  for (const province of provinces) {
    const city = province.cities.find(c => c.code === cityCode);
    if (city) {
      return city.districts;
    }
  }
  return [];
};

/**
 * 根据代码获取完整地址信息
 */
export const getFullAddress = (provinceCode: string, cityCode: string, districtCode: string) => {
  const province = provinces.find(p => p.code === provinceCode);
  if (!province) return null;

  const city = province.cities.find(c => c.code === cityCode);
  if (!city) return null;

  const district = city.districts.find(d => d.code === districtCode);
  if (!district) return null;

  return {
    province: province.name,
    city: city.name,
    district: district.name,
    full: `${province.name} ${city.name} ${district.name}`
  };
};
