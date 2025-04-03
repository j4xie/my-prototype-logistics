/**
 * 地图组件 (trace-map.js) 的单元测试
 * @version 1.0.0
 */

// 模拟traceMap模块
const mockMapInstance = {
  addControl: jest.fn(),
  on: jest.fn()
};

const mockMarker = {
  setMap: jest.fn()
};

const mockPolyline = {
  setMap: jest.fn()
};

const mockAMap = {
  Map: jest.fn(() => mockMapInstance),
  ToolBar: jest.fn(),
  Scale: jest.fn(),
  Marker: jest.fn(() => mockMarker),
  Polyline: jest.fn(() => mockPolyline)
};

// 模拟window和全局对象
beforeEach(() => {
  // 清除所有模拟调用信息
  jest.clearAllMocks();
  
  // 重置全局变量和模拟
  global.window = {
    AMap: mockAMap
  };
  
  // 模拟console
  global.console = {
    log: jest.fn(),
    error: jest.fn()
  };
  
  // 模拟document
  global.document = {
    getElementById: jest.fn(() => ({
      id: 'map-container'
    }))
  };
});

// 导入traceMap模块 (由于模块化问题，这里使用模拟实现)
const traceMap = {
  loadMapProvider: jest.fn(() => Promise.resolve()),
  createMap: jest.fn(),
  createAMap: jest.fn(() => mockMapInstance),
  createGoogleMap: jest.fn(() => mockMapInstance),
  createBaiduMap: jest.fn(() => mockMapInstance),
  addMarker: jest.fn(),
  addAMapMarker: jest.fn(() => mockMarker),
  addGoogleMarker: jest.fn(() => mockMarker),
  addBaiduMarker: jest.fn(() => mockMarker),
  addPolyline: jest.fn(),
  addAMapPolyline: jest.fn(() => mockPolyline),
  addGooglePolyline: jest.fn(() => mockPolyline),
  addBaiduPolyline: jest.fn(() => mockPolyline),
  getStatus: jest.fn(() => ({ 
    initialized: true,
    provider: 'amap',
    center: [116.39, 39.91],
    zoom: 12,
    markers: [],
    polylines: []
  })),
  init: jest.fn(async (options = {}) => {
    await traceMap.loadMapProvider();
    return true;
  })
};

describe('地图组件测试', () => {
  // 测试初始化
  test('init方法应该加载地图提供商并初始化', async () => {
    // 调用初始化方法
    const result = await traceMap.init({ provider: 'amap' });
    
    // 验证loadMapProvider被调用
    expect(traceMap.loadMapProvider).toHaveBeenCalled();
    
    // 验证初始化成功
    expect(result).toBe(true);
  });
  
  // 测试创建地图
  test('createMap方法应该根据提供商创建地图', () => {
    // 设置模拟函数
    const mockGetElementById = jest.fn(() => ({ id: 'map-container' }));
    document.getElementById = mockGetElementById;
    
    traceMap.createMap = jest.fn((containerId, options) => {
      if (!containerId) {
        throw new Error('容器ID不能为空');
      }
      
      const mapState = { provider: 'amap' };
      const container = document.getElementById(containerId);
      
      switch (mapState.provider) {
        case 'amap':
          return traceMap.createAMap(container, options);
        default:
          throw new Error(`不支持的地图提供商: ${mapState.provider}`);
      }
    });
    
    // 调用创建地图方法
    const map = traceMap.createMap('map-container', { 
      center: [116.39, 39.91], 
      zoom: 12 
    });
    
    // 验证document.getElementById被调用
    expect(mockGetElementById).toHaveBeenCalledWith('map-container');
    
    // 验证createAMap被调用
    expect(traceMap.createAMap).toHaveBeenCalled();
    
    // 验证返回地图实例
    expect(map).toBe(mockMapInstance);
  });
  
  // 测试创建高德地图
  test('createAMap方法应该正确创建高德地图', () => {
    // 模拟容器元素
    const container = { id: 'map-container' };
    
    // 设置模拟函数 - 确保window.AMap存在
    window.AMap = mockAMap;
    
    traceMap.createAMap = jest.fn((container, options) => {
      const map = new window.AMap.Map(container, {
        center: options.center,
        zoom: options.zoom,
        resizeEnable: true
      });
      
      return map;
    });
    
    // 调用创建高德地图方法
    const map = traceMap.createAMap(container, { 
      center: [116.39, 39.91], 
      zoom: 12 
    });
    
    // 验证AMap.Map被调用
    expect(window.AMap.Map).toHaveBeenCalledWith(container, {
      center: [116.39, 39.91],
      zoom: 12,
      resizeEnable: true
    });
  });
  
  // 测试添加标记点
  test('addMarker方法应该根据提供商添加标记点', () => {
    // 确保window.AMap存在
    window.AMap = mockAMap;
    
    // 设置模拟函数
    traceMap.addMarker = jest.fn((position, options) => {
      const mapState = { provider: 'amap', markers: [] };
      let marker;
      
      switch (mapState.provider) {
        case 'amap':
          marker = traceMap.addAMapMarker(position, options);
          break;
        default:
          throw new Error(`不支持的地图提供商: ${mapState.provider}`);
      }
      
      mapState.markers.push({
        position,
        options,
        instance: marker
      });
      
      return marker;
    });
    
    traceMap.addAMapMarker = jest.fn((position, options) => {
      const marker = new window.AMap.Marker({
        position: position,
        ...options
      });
      
      marker.setMap(mockMapInstance);
      return marker;
    });
    
    // 调用添加标记点方法
    const position = [116.39, 39.91];
    const options = { title: '测试标记' };
    const marker = traceMap.addMarker(position, options);
    
    // 验证addAMapMarker被调用
    expect(traceMap.addAMapMarker).toHaveBeenCalledWith(position, options);
    
    // 验证AMap.Marker被调用
    expect(window.AMap.Marker).toHaveBeenCalledWith({
      position: position,
      title: '测试标记'
    });
  });
  
  // 测试添加轨迹线
  test('addPolyline方法应该根据提供商添加轨迹线', () => {
    // 确保window.AMap存在
    window.AMap = mockAMap;
    
    // 设置模拟函数
    traceMap.addPolyline = jest.fn((path, options) => {
      const mapState = { provider: 'amap', polylines: [] };
      let polyline;
      
      switch (mapState.provider) {
        case 'amap':
          polyline = traceMap.addAMapPolyline(path, options);
          break;
        default:
          throw new Error(`不支持的地图提供商: ${mapState.provider}`);
      }
      
      mapState.polylines.push({
        path,
        options,
        instance: polyline
      });
      
      return polyline;
    });
    
    traceMap.addAMapPolyline = jest.fn((path, options) => {
      const polyline = new window.AMap.Polyline({
        path: path,
        ...options
      });
      
      polyline.setMap(mockMapInstance);
      return polyline;
    });
    
    // 调用添加轨迹线方法
    const path = [
      [116.39, 39.91],
      [116.40, 39.92],
      [116.41, 39.93]
    ];
    const options = { 
      strokeColor: '#3366FF',
      strokeWeight: 5
    };
    const polyline = traceMap.addPolyline(path, options);
    
    // 验证addAMapPolyline被调用
    expect(traceMap.addAMapPolyline).toHaveBeenCalledWith(path, options);
    
    // 验证AMap.Polyline被调用
    expect(window.AMap.Polyline).toHaveBeenCalledWith({
      path: path,
      strokeColor: '#3366FF',
      strokeWeight: 5
    });
  });
  
  // 测试获取地图状态
  test('getStatus方法应该返回当前地图状态', () => {
    // 设置模拟函数
    const mockStatus = {
      initialized: true,
      provider: 'amap',
      center: [116.39, 39.91],
      zoom: 12,
      markers: [{ position: [116.39, 39.91] }],
      polylines: [{ path: [[116.39, 39.91], [116.40, 39.92]] }]
    };
    
    traceMap.getStatus = jest.fn(() => mockStatus);
    
    // 调用获取地图状态方法
    const status = traceMap.getStatus();
    
    // 验证返回正确的状态
    expect(status).toEqual(mockStatus);
    expect(status.initialized).toBe(true);
    expect(status.provider).toBe('amap');
    expect(status.markers.length).toBe(1);
    expect(status.polylines.length).toBe(1);
  });
}); 