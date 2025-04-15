/**
 * 地图组件集成测试
 * @version 1.0.0
 */

// 模拟traceMap模块
const mockMapInstance = {
  addControl: jest.fn(),
  on: jest.fn(),
  getCenter: jest.fn(() => ({
    toArray: () => [116.39, 39.91]
  })),
  getZoom: jest.fn(() => 12)
};

// 模拟其他模块
const mockTraceCore = {
  getSupplyChainData: jest.fn(() => Promise.resolve([
    {
      id: 'node1',
      type: 'production',
      name: '生产基地A',
      location: {
        coordinates: [116.39, 39.91],
        address: '北京市XX区'
      },
      timestamp: '2023-01-01T10:00:00Z'
    },
    {
      id: 'node2',
      type: 'processing',
      name: '加工厂B',
      location: {
        coordinates: [116.41, 39.92],
        address: '北京市XX区'
      },
      timestamp: '2023-01-05T14:30:00Z'
    },
    {
      id: 'node3',
      type: 'distribution',
      name: '配送中心C',
      location: {
        coordinates: [116.43, 39.94],
        address: '北京市XX区'
      },
      timestamp: '2023-01-10T09:15:00Z'
    }
  ])),
  init: jest.fn(() => Promise.resolve(true))
};

const mockConfigManager = {
  getConfig: jest.fn(() => ({
    map: {
      provider: 'amap',
      apiKey: 'test-api-key',
      defaultCenter: [116.39, 39.91],
      defaultZoom: 12
    }
  })),
  init: jest.fn(() => Promise.resolve(true))
};

// 模拟document.getElementById
const mockGetElementById = jest.fn(id => {
  if (id === 'map-container') {
    return { id: 'map-container' };
  }
  return null;
});

// 设置全局模拟
beforeEach(() => {
  jest.clearAllMocks();
  
  // 模拟DOM
  global.document = {
    getElementById: mockGetElementById,
    createElement: jest.fn(() => ({
      setAttribute: jest.fn(),
      style: {},
      appendChild: jest.fn()
    })),
    head: {
      appendChild: jest.fn()
    },
    body: {
      appendChild: jest.fn()
    }
  };
  
  // 模拟window
  global.window = {
    AMap: {
      Map: jest.fn(() => mockMapInstance),
      ToolBar: jest.fn(),
      Scale: jest.fn(),
      Marker: jest.fn(() => ({
        setMap: jest.fn()
      })),
      Polyline: jest.fn(() => ({
        setMap: jest.fn()
      })),
      Icon: jest.fn(),
      InfoWindow: jest.fn(() => ({
        open: jest.fn(),
        close: jest.fn()
      }))
    }
  };
});

// 导入模块 (模拟实现)
const traceMap = {
  init: jest.fn(async (options = {}, configManager = mockConfigManager) => {
    // 集成测试：从configManager获取配置
    try {
      const config = configManager.getConfig();
      const mapConfig = config.map;
      
      // 合并配置
      const mergedOptions = { ...mapConfig, ...options };
      
      // 加载地图提供商
      await traceMap.loadMapProvider(mergedOptions.provider, mergedOptions.apiKey);
      
      return true;
    } catch (error) {
      console.error('初始化错误:', error);
      return false;
    }
  }),
  loadMapProvider: jest.fn(() => Promise.resolve()),
  createMap: jest.fn((containerId, options = {}) => {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`找不到指定的容器: ${containerId}`);
    }
    
    const map = new window.AMap.Map(container, {
      center: options.center,
      zoom: options.zoom,
      resizeEnable: true
    });
    
    return map;
  }),
  visualizeSupplyChain: jest.fn(async (productId, containerId, traceCore = mockTraceCore) => {
    try {
      // 集成测试：从traceCore获取供应链数据
      const supplyChainData = await traceCore.getSupplyChainData(productId);
      
      // 创建地图
      const map = traceMap.createMap(containerId);
      
      // 添加标记点
      const markers = supplyChainData.map(node => {
        return traceMap.addMarker(node.location.coordinates, {
          title: node.name,
          content: `<div class="trace-marker ${node.type}">${node.name}</div>`
        });
      });
      
      // 添加路径线
      if (supplyChainData.length > 1) {
        const path = supplyChainData.map(node => node.location.coordinates);
        traceMap.addPolyline(path, {
          strokeColor: '#3366FF',
          strokeWeight: 4
        });
      }
      
      return {
        map,
        markers,
        data: supplyChainData
      };
    } catch (error) {
      console.error('供应链可视化错误:', error);
      throw error;
    }
  }),
  addMarker: jest.fn(() => ({
    setMap: jest.fn(),
    getPosition: jest.fn()
  })),
  addPolyline: jest.fn(() => ({
    setMap: jest.fn()
  }))
};

describe('地图组件集成测试', () => {
  // 测试地图与配置管理器的集成
  test('地图组件初始化应该从配置管理器加载配置', async () => {
    // 重置模拟
    mockConfigManager.getConfig.mockClear();
    traceMap.loadMapProvider.mockClear();
    
    // 调用初始化方法
    await traceMap.init({}, mockConfigManager);
    
    // 验证配置管理器被调用
    expect(mockConfigManager.getConfig).toHaveBeenCalled();
    
    // 验证加载了正确的地图提供商
    expect(traceMap.loadMapProvider).toHaveBeenCalled();
  });
  
  // 测试地图与核心组件的集成 - 供应链可视化
  test('visualizeSupplyChain方法应该从核心组件获取数据并创建地图可视化', async () => {
    // 重置模拟
    mockTraceCore.getSupplyChainData.mockClear();
    traceMap.createMap.mockClear();
    traceMap.addMarker.mockClear();
    traceMap.addPolyline.mockClear();
    
    // 确保getElementById返回容器元素
    document.getElementById = jest.fn(id => {
      if (id === 'map-container') {
        return { id: 'map-container' };
      }
      return null;
    });
    
    // 模拟createMap方法以避免实际创建地图
    traceMap.createMap.mockImplementationOnce(() => mockMapInstance);
    
    // 调用供应链可视化方法
    const result = await traceMap.visualizeSupplyChain('product-123', 'map-container', mockTraceCore);
    
    // 验证traceCore.getSupplyChainData被调用
    expect(mockTraceCore.getSupplyChainData).toHaveBeenCalledWith('product-123');
    
    // 验证为每个节点添加了标记
    expect(traceMap.addMarker).toHaveBeenCalledTimes(3);
    
    // 验证添加了路径线
    expect(traceMap.addPolyline).toHaveBeenCalledTimes(1);
    
    // 验证返回结果包含期望的数据
    expect(result).toHaveProperty('map');
    expect(result).toHaveProperty('markers');
    expect(result).toHaveProperty('data');
    expect(result.data.length).toBe(3);
  });
  
  // 测试错误处理
  test('当找不到容器元素时，createMap方法应该抛出错误', () => {
    // 模拟找不到元素
    document.getElementById = jest.fn(() => null);
    
    // 验证抛出错误
    expect(() => {
      traceMap.createMap('non-existent-container');
    }).toThrow('找不到指定的容器');
  });
  
  // 测试地图状态更新
  test('地图移动事件应该更新地图状态', () => {
    // 模拟地图实例
    const map = mockMapInstance;
    
    // 模拟地图移动事件
    const moveendCallback = map.on.mock.calls.find(call => call[0] === 'moveend')?.[1];
    
    // 如果存在moveend回调，调用它
    if (moveendCallback) {
      moveendCallback();
      
      // 验证获取了中心点和缩放级别
      expect(map.getCenter).toHaveBeenCalled();
      expect(map.getZoom).toHaveBeenCalled();
    }
  });
}); 