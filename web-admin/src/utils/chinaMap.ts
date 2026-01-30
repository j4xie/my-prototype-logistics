/**
 * 中国地图 GeoJSON 工具
 * 用于 ECharts 地图可视化
 */
import * as echarts from 'echarts';

// 中国省份简化 GeoJSON 数据
// 包含34个省级行政区的边界数据
const CHINA_GEO_JSON = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: '北京', cp: [116.4, 39.9] }, geometry: { type: 'Polygon', coordinates: [[[116.0,39.5],[117.0,39.5],[117.0,40.5],[116.0,40.5],[116.0,39.5]]] } },
    { type: 'Feature', properties: { name: '天津', cp: [117.2, 39.1] }, geometry: { type: 'Polygon', coordinates: [[[116.8,38.8],[117.8,38.8],[117.8,39.8],[116.8,39.8],[116.8,38.8]]] } },
    { type: 'Feature', properties: { name: '河北', cp: [114.5, 38.0] }, geometry: { type: 'Polygon', coordinates: [[[113.5,36.0],[119.0,36.0],[119.0,42.5],[113.5,42.5],[113.5,36.0]]] } },
    { type: 'Feature', properties: { name: '山西', cp: [112.5, 37.9] }, geometry: { type: 'Polygon', coordinates: [[[110.0,34.5],[114.5,34.5],[114.5,40.5],[110.0,40.5],[110.0,34.5]]] } },
    { type: 'Feature', properties: { name: '内蒙古', cp: [111.7, 41.8] }, geometry: { type: 'Polygon', coordinates: [[[97.0,37.0],[126.0,37.0],[126.0,53.0],[97.0,53.0],[97.0,37.0]]] } },
    { type: 'Feature', properties: { name: '辽宁', cp: [123.4, 41.8] }, geometry: { type: 'Polygon', coordinates: [[[119.0,38.5],[125.5,38.5],[125.5,43.5],[119.0,43.5],[119.0,38.5]]] } },
    { type: 'Feature', properties: { name: '吉林', cp: [126.5, 43.8] }, geometry: { type: 'Polygon', coordinates: [[[121.5,40.5],[131.0,40.5],[131.0,46.0],[121.5,46.0],[121.5,40.5]]] } },
    { type: 'Feature', properties: { name: '黑龙江', cp: [126.6, 45.8] }, geometry: { type: 'Polygon', coordinates: [[[121.0,43.0],[135.0,43.0],[135.0,53.5],[121.0,53.5],[121.0,43.0]]] } },
    { type: 'Feature', properties: { name: '上海', cp: [121.5, 31.2] }, geometry: { type: 'Polygon', coordinates: [[[120.8,30.7],[122.0,30.7],[122.0,31.8],[120.8,31.8],[120.8,30.7]]] } },
    { type: 'Feature', properties: { name: '江苏', cp: [120.3, 33.0] }, geometry: { type: 'Polygon', coordinates: [[[116.0,30.5],[122.0,30.5],[122.0,35.0],[116.0,35.0],[116.0,30.5]]] } },
    { type: 'Feature', properties: { name: '浙江', cp: [120.2, 29.3] }, geometry: { type: 'Polygon', coordinates: [[[118.0,27.0],[123.0,27.0],[123.0,31.5],[118.0,31.5],[118.0,27.0]]] } },
    { type: 'Feature', properties: { name: '安徽', cp: [117.3, 31.8] }, geometry: { type: 'Polygon', coordinates: [[[114.5,29.5],[119.5,29.5],[119.5,34.5],[114.5,34.5],[114.5,29.5]]] } },
    { type: 'Feature', properties: { name: '福建', cp: [119.3, 26.1] }, geometry: { type: 'Polygon', coordinates: [[[116.0,23.5],[120.5,23.5],[120.5,28.5],[116.0,28.5],[116.0,23.5]]] } },
    { type: 'Feature', properties: { name: '江西', cp: [115.9, 27.6] }, geometry: { type: 'Polygon', coordinates: [[[113.5,24.5],[118.5,24.5],[118.5,30.0],[113.5,30.0],[113.5,24.5]]] } },
    { type: 'Feature', properties: { name: '山东', cp: [117.0, 36.7] }, geometry: { type: 'Polygon', coordinates: [[[114.5,34.0],[122.5,34.0],[122.5,38.5],[114.5,38.5],[114.5,34.0]]] } },
    { type: 'Feature', properties: { name: '河南', cp: [113.7, 34.0] }, geometry: { type: 'Polygon', coordinates: [[[110.0,31.5],[116.5,31.5],[116.5,36.5],[110.0,36.5],[110.0,31.5]]] } },
    { type: 'Feature', properties: { name: '湖北', cp: [114.3, 30.6] }, geometry: { type: 'Polygon', coordinates: [[[108.5,29.0],[116.0,29.0],[116.0,33.0],[108.5,33.0],[108.5,29.0]]] } },
    { type: 'Feature', properties: { name: '湖南', cp: [112.9, 28.2] }, geometry: { type: 'Polygon', coordinates: [[[108.5,24.5],[114.5,24.5],[114.5,30.0],[108.5,30.0],[108.5,24.5]]] } },
    { type: 'Feature', properties: { name: '广东', cp: [113.3, 23.1] }, geometry: { type: 'Polygon', coordinates: [[[109.5,20.0],[117.5,20.0],[117.5,25.5],[109.5,25.5],[109.5,20.0]]] } },
    { type: 'Feature', properties: { name: '广西', cp: [108.3, 22.8] }, geometry: { type: 'Polygon', coordinates: [[[104.5,20.5],[112.0,20.5],[112.0,26.5],[104.5,26.5],[104.5,20.5]]] } },
    { type: 'Feature', properties: { name: '海南', cp: [110.3, 19.0] }, geometry: { type: 'Polygon', coordinates: [[[108.5,18.0],[111.5,18.0],[111.5,20.5],[108.5,20.5],[108.5,18.0]]] } },
    { type: 'Feature', properties: { name: '重庆', cp: [106.5, 29.6] }, geometry: { type: 'Polygon', coordinates: [[[105.0,28.0],[110.0,28.0],[110.0,32.5],[105.0,32.5],[105.0,28.0]]] } },
    { type: 'Feature', properties: { name: '四川', cp: [104.1, 30.7] }, geometry: { type: 'Polygon', coordinates: [[[97.0,26.0],[108.5,26.0],[108.5,34.0],[97.0,34.0],[97.0,26.0]]] } },
    { type: 'Feature', properties: { name: '贵州', cp: [106.7, 26.6] }, geometry: { type: 'Polygon', coordinates: [[[103.5,24.5],[109.5,24.5],[109.5,29.0],[103.5,29.0],[103.5,24.5]]] } },
    { type: 'Feature', properties: { name: '云南', cp: [102.7, 25.0] }, geometry: { type: 'Polygon', coordinates: [[[97.5,21.0],[106.0,21.0],[106.0,29.0],[97.5,29.0],[97.5,21.0]]] } },
    { type: 'Feature', properties: { name: '西藏', cp: [91.1, 29.7] }, geometry: { type: 'Polygon', coordinates: [[[78.0,26.5],[99.0,26.5],[99.0,36.5],[78.0,36.5],[78.0,26.5]]] } },
    { type: 'Feature', properties: { name: '陕西', cp: [108.9, 34.3] }, geometry: { type: 'Polygon', coordinates: [[[105.5,31.5],[111.0,31.5],[111.0,39.5],[105.5,39.5],[105.5,31.5]]] } },
    { type: 'Feature', properties: { name: '甘肃', cp: [103.8, 36.1] }, geometry: { type: 'Polygon', coordinates: [[[92.5,32.5],[108.5,32.5],[108.5,42.5],[92.5,42.5],[92.5,32.5]]] } },
    { type: 'Feature', properties: { name: '青海', cp: [101.8, 36.6] }, geometry: { type: 'Polygon', coordinates: [[[89.5,31.5],[103.0,31.5],[103.0,39.5],[89.5,39.5],[89.5,31.5]]] } },
    { type: 'Feature', properties: { name: '宁夏', cp: [106.3, 38.5] }, geometry: { type: 'Polygon', coordinates: [[[104.0,35.0],[107.5,35.0],[107.5,39.5],[104.0,39.5],[104.0,35.0]]] } },
    { type: 'Feature', properties: { name: '新疆', cp: [87.6, 41.8] }, geometry: { type: 'Polygon', coordinates: [[[73.0,34.5],[96.5,34.5],[96.5,49.0],[73.0,49.0],[73.0,34.5]]] } },
    { type: 'Feature', properties: { name: '台湾', cp: [121.0, 23.7] }, geometry: { type: 'Polygon', coordinates: [[[119.5,21.5],[122.0,21.5],[122.0,25.5],[119.5,25.5],[119.5,21.5]]] } },
    { type: 'Feature', properties: { name: '香港', cp: [114.2, 22.3] }, geometry: { type: 'Polygon', coordinates: [[[113.8,22.1],[114.5,22.1],[114.5,22.6],[113.8,22.6],[113.8,22.1]]] } },
    { type: 'Feature', properties: { name: '澳门', cp: [113.5, 22.2] }, geometry: { type: 'Polygon', coordinates: [[[113.4,22.1],[113.6,22.1],[113.6,22.3],[113.4,22.3],[113.4,22.1]]] } },
  ],
};

// 省份名称映射（处理简称和全称）
const PROVINCE_NAME_MAP: Record<string, string> = {
  // 简称到全称
  '京': '北京', '津': '天津', '冀': '河北', '晋': '山西', '蒙': '内蒙古',
  '辽': '辽宁', '吉': '吉林', '黑': '黑龙江', '沪': '上海', '苏': '江苏',
  '浙': '浙江', '皖': '安徽', '闽': '福建', '赣': '江西', '鲁': '山东',
  '豫': '河南', '鄂': '湖北', '湘': '湖南', '粤': '广东', '桂': '广西',
  '琼': '海南', '渝': '重庆', '川': '四川', '蜀': '四川', '黔': '贵州',
  '贵': '贵州', '滇': '云南', '云': '云南', '藏': '西藏', '陕': '陕西',
  '秦': '陕西', '甘': '甘肃', '陇': '甘肃', '青': '青海', '宁': '宁夏',
  '新': '新疆', '台': '台湾', '港': '香港', '澳': '澳门',
  // 带省/市/区后缀
  '北京市': '北京', '天津市': '天津', '上海市': '上海', '重庆市': '重庆',
  '河北省': '河北', '山西省': '山西', '辽宁省': '辽宁', '吉林省': '吉林',
  '黑龙江省': '黑龙江', '江苏省': '江苏', '浙江省': '浙江', '安徽省': '安徽',
  '福建省': '福建', '江西省': '江西', '山东省': '山东', '河南省': '河南',
  '湖北省': '湖北', '湖南省': '湖南', '广东省': '广东', '海南省': '海南',
  '四川省': '四川', '贵州省': '贵州', '云南省': '云南', '陕西省': '陕西',
  '甘肃省': '甘肃', '青海省': '青海', '台湾省': '台湾',
  '内蒙古自治区': '内蒙古', '广西壮族自治区': '广西', '西藏自治区': '西藏',
  '宁夏回族自治区': '宁夏', '新疆维吾尔自治区': '新疆',
  '香港特别行政区': '香港', '澳门特别行政区': '澳门',
};

let isMapRegistered = false;

/**
 * 注册中国地图到 ECharts
 */
export function registerChinaMap(): void {
  if (isMapRegistered) return;

  echarts.registerMap('china', CHINA_GEO_JSON as unknown as GeoJSON.GeoJSON);
  isMapRegistered = true;
}

/**
 * 标准化省份名称
 */
export function normalizeProvinceName(name: string): string {
  if (!name) return name;
  return PROVINCE_NAME_MAP[name] || name;
}

/**
 * 获取所有省份列表
 */
export function getProvinceList(): string[] {
  return CHINA_GEO_JSON.features.map(f => f.properties.name);
}

export { CHINA_GEO_JSON };
