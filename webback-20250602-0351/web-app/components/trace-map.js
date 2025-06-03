/**
 * @module traceMap
 * @description 食品溯源系统 - 地图组件
 * @version 1.0.0
 * @author 食品溯源系统开发团队
 */

// 地图配置
const mapConfig = {
  provider: 'amap', // 'amap', 'google', 'baidu'
  apiKey: '',
  defaultCenter: [116.397428, 39.90923], // 经度, 纬度
  defaultZoom: 12,
  clustersEnabled: true,
  maxZoom: 18,
  minZoom: 3,
  tilesUrl: '', // 自定义瓦片URL（如适用）
  mapTypes: ['normal', 'satellite'], // 地图类型选项
  style: 'light' // 'light', 'dark', 'normal'
};

// 地图实例
let mapInstance = null;

// 地图状态
let mapState = {
  initialized: false,
  provider: null,
  center: null,
  zoom: null,
  markers: [],
  polylines: [],
  bounds: null,
  errorMessage: null
};

/**
 * 地图模块
 */
const traceMap = {
  /**
   * 初始化地图组件
   * @param {Object} options - 配置选项
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async init(options = {}) {
    try {
      // 合并配置
      Object.assign(mapConfig, options);
      
      // 加载地图提供商
      await this.loadMapProvider();
      
      mapState.initialized = true;
      console.log('地图组件初始化成功');
      
      return true;
    } catch (error) {
      console.error('地图组件初始化失败:', error);
      mapState.errorMessage = error.message;
      return false;
    }
  },
  
  /**
   * 加载地图提供商
   * @returns {Promise<void>}
   */
  async loadMapProvider() {
    const provider = mapConfig.provider.toLowerCase();
    
    switch (provider) {
      case 'amap':
        await this.loadAMap();
        break;
      case 'google':
        await this.loadGoogleMap();
        break;
      case 'baidu':
        await this.loadBaiduMap();
        break;
      default:
        throw new Error(`不支持的地图提供商: ${provider}`);
    }
    
    mapState.provider = provider;
  },
  
  /**
   * 加载高德地图
   * @returns {Promise<void>}
   */
  async loadAMap() {
    if (window.AMap) {
      return;
    }
    
    return new Promise((resolve, reject) => {
      // 检查API密钥
      if (!mapConfig.apiKey) {
        reject(new Error('高德地图需要API密钥'));
        return;
      }
      
      const script = document.createElement('script');
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${mapConfig.apiKey}`;
      script.async = true;
      
      script.onload = () => {
        // 加载插件
        window.AMap.plugin([
          'AMap.ToolBar',
          'AMap.Scale',
          'AMap.MarkerClusterer'
        ], () => {
          console.log('高德地图及插件加载完成');
          resolve();
        });
      };
      
      script.onerror = () => {
        reject(new Error('加载高德地图失败'));
      };
      
      document.head.appendChild(script);
    });
  },
  
  /**
   * 加载谷歌地图
   * @returns {Promise<void>}
   */
  async loadGoogleMap() {
    if (window.google && window.google.maps) {
      return;
    }
    
    return new Promise((resolve, reject) => {
      // 检查API密钥
      if (!mapConfig.apiKey) {
        reject(new Error('谷歌地图需要API密钥'));
        return;
      }
      
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${mapConfig.apiKey}&libraries=places,geometry&callback=initGoogleMap`;
      script.async = true;
      
      window.initGoogleMap = function() {
        console.log('谷歌地图加载完成');
        resolve();
      };
      
      script.onerror = () => {
        reject(new Error('加载谷歌地图失败'));
      };
      
      document.head.appendChild(script);
    });
  },
  
  /**
   * 加载百度地图
   * @returns {Promise<void>}
   */
  async loadBaiduMap() {
    if (window.BMap) {
      return;
    }
    
    return new Promise((resolve, reject) => {
      // 检查API密钥
      if (!mapConfig.apiKey) {
        reject(new Error('百度地图需要API密钥'));
        return;
      }
      
      const script = document.createElement('script');
      script.src = `https://api.map.baidu.com/api?v=3.0&ak=${mapConfig.apiKey}&callback=initBaiduMap`;
      script.async = true;
      
      window.initBaiduMap = function() {
        console.log('百度地图加载完成');
        resolve();
      };
      
      script.onerror = () => {
        reject(new Error('加载百度地图失败'));
      };
      
      document.head.appendChild(script);
    });
  },
  
  /**
   * 创建地图
   * @param {string} containerId - 容器元素ID
   * @param {Object} options - 地图选项
   * @returns {Object} 地图实例
   */
  createMap(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`找不到指定的容器: ${containerId}`);
    }
    
    // 合并选项
    const mapOptions = {
      center: options.center || mapConfig.defaultCenter,
      zoom: options.zoom || mapConfig.defaultZoom,
      ...options
    };
    
    // 根据提供商创建地图
    switch (mapState.provider) {
      case 'amap':
        return this.createAMap(container, mapOptions);
      case 'google':
        return this.createGoogleMap(container, mapOptions);
      case 'baidu':
        return this.createBaiduMap(container, mapOptions);
      default:
        throw new Error(`不支持的地图提供商: ${mapState.provider}`);
    }
  },
  
  /**
   * 创建高德地图
   * @param {HTMLElement} container - 容器元素
   * @param {Object} options - 地图选项
   * @returns {Object} 地图实例
   */
  createAMap(container, options) {
    if (!window.AMap) {
      throw new Error('高德地图未加载');
    }
    
    // 创建地图实例
    const map = new window.AMap.Map(container, {
      center: options.center,
      zoom: options.zoom,
      resizeEnable: true
    });
    
    // 添加控件
    map.addControl(new window.AMap.ToolBar());
    map.addControl(new window.AMap.Scale());
    
    // 保存地图实例
    mapInstance = map;
    
    // 更新状态
    mapState.center = options.center;
    mapState.zoom = options.zoom;
    
    // 绑定事件
    map.on('moveend', () => {
      mapState.center = map.getCenter().toArray();
      mapState.zoom = map.getZoom();
    });
    
    return map;
  },
  
  /**
   * 创建谷歌地图
   * @param {HTMLElement} container - 容器元素
   * @param {Object} options - 地图选项
   * @returns {Object} 地图实例
   */
  createGoogleMap(container, options) {
    if (!window.google || !window.google.maps) {
      throw new Error('谷歌地图未加载');
    }
    
    // 创建地图实例
    const map = new window.google.maps.Map(container, {
      center: { lat: options.center[1], lng: options.center[0] },
      zoom: options.zoom
    });
    
    // 保存地图实例
    mapInstance = map;
    
    // 更新状态
    mapState.center = options.center;
    mapState.zoom = options.zoom;
    
    // 绑定事件
    map.addListener('idle', () => {
      const center = map.getCenter();
      mapState.center = [center.lng(), center.lat()];
      mapState.zoom = map.getZoom();
    });
    
    return map;
  },
  
  /**
   * 创建百度地图
   * @param {HTMLElement} container - 容器元素
   * @param {Object} options - 地图选项
   * @returns {Object} 地图实例
   */
  createBaiduMap(container, options) {
    if (!window.BMap) {
      throw new Error('百度地图未加载');
    }
    
    // 创建地图实例
    const map = new window.BMap.Map(container);
    const point = new window.BMap.Point(options.center[0], options.center[1]);
    map.centerAndZoom(point, options.zoom);
    map.enableScrollWheelZoom();
    
    // 添加控件
    map.addControl(new window.BMap.NavigationControl());
    map.addControl(new window.BMap.ScaleControl());
    
    // 保存地图实例
    mapInstance = map;
    
    // 更新状态
    mapState.center = options.center;
    mapState.zoom = options.zoom;
    
    // 绑定事件
    map.addEventListener('moveend', () => {
      const center = map.getCenter();
      mapState.center = [center.lng, center.lat];
      mapState.zoom = map.getZoom();
    });
    
    return map;
  },
  
  /**
   * 添加标记点
   * @param {Array} position - 位置 [lng, lat]
   * @param {Object} options - 标记选项
   * @returns {Object} 标记实例
   */
  addMarker(position, options = {}) {
    if (!mapInstance) {
      throw new Error('地图未创建');
    }
    
    let marker;
    
    switch (mapState.provider) {
      case 'amap':
        marker = this.addAMapMarker(position, options);
        break;
      case 'google':
        marker = this.addGoogleMarker(position, options);
        break;
      case 'baidu':
        marker = this.addBaiduMarker(position, options);
        break;
      default:
        throw new Error(`不支持的地图提供商: ${mapState.provider}`);
    }
    
    // 添加到标记数组
    mapState.markers.push({
      position,
      options,
      instance: marker
    });
    
    return marker;
  },
  
  /**
   * 添加高德地图标记点
   * @param {Array} position - 位置 [lng, lat]
   * @param {Object} options - 标记选项
   * @returns {Object} 标记实例
   */
  addAMapMarker(position, options) {
    const marker = new window.AMap.Marker({
      position: position,
      title: options.title || '',
      icon: options.icon,
      label: options.label ? {
        content: options.label,
        direction: 'top'
      } : null
    });
    
    marker.setMap(mapInstance);
    
    // 添加点击事件
    if (options.onClick) {
      marker.on('click', event => {
        options.onClick({
          position,
          data: options.data || {},
          nativeEvent: event
        });
      });
    }
    
    // 信息窗体
    if (options.infoWindow) {
      const infoWindow = new window.AMap.InfoWindow({
        content: options.infoWindow.content,
        offset: new window.AMap.Pixel(0, -30)
      });
      
      if (options.infoWindow.autoOpen) {
        infoWindow.open(mapInstance, position);
      }
      
      marker.on('click', () => {
        infoWindow.open(mapInstance, position);
      });
    }
    
    return marker;
  },
  
  /**
   * 添加谷歌地图标记点
   * @param {Array} position - 位置 [lng, lat]
   * @param {Object} options - 标记选项
   * @returns {Object} 标记实例
   */
  addGoogleMarker(position, options) {
    const marker = new window.google.maps.Marker({
      position: { lat: position[1], lng: position[0] },
      map: mapInstance,
      title: options.title || '',
      icon: options.icon
    });
    
    // 添加点击事件
    if (options.onClick) {
      marker.addListener('click', event => {
        options.onClick({
          position,
          data: options.data || {},
          nativeEvent: event
        });
      });
    }
    
    // 信息窗体
    if (options.infoWindow) {
      const infoWindow = new window.google.maps.InfoWindow({
        content: options.infoWindow.content
      });
      
      if (options.infoWindow.autoOpen) {
        infoWindow.open(mapInstance, marker);
      }
      
      marker.addListener('click', () => {
        infoWindow.open(mapInstance, marker);
      });
    }
    
    return marker;
  },
  
  /**
   * 添加百度地图标记点
   * @param {Array} position - 位置 [lng, lat]
   * @param {Object} options - 标记选项
   * @returns {Object} 标记实例
   */
  addBaiduMarker(position, options) {
    const point = new window.BMap.Point(position[0], position[1]);
    const marker = new window.BMap.Marker(point, {
      title: options.title || ''
    });
    
    // 自定义图标
    if (options.icon) {
      const icon = new window.BMap.Icon(options.icon, new window.BMap.Size(25, 25));
      marker.setIcon(icon);
    }
    
    mapInstance.addOverlay(marker);
    
    // 添加点击事件
    if (options.onClick) {
      marker.addEventListener('click', event => {
        options.onClick({
          position,
          data: options.data || {},
          nativeEvent: event
        });
      });
    }
    
    // 信息窗体
    if (options.infoWindow) {
      const infoWindow = new window.BMap.InfoWindow(options.infoWindow.content);
      
      if (options.infoWindow.autoOpen) {
        marker.openInfoWindow(infoWindow);
      }
      
      marker.addEventListener('click', () => {
        marker.openInfoWindow(infoWindow);
      });
    }
    
    return marker;
  },
  
  /**
   * 添加轨迹线
   * @param {Array} path - 路径点数组 [[lng, lat], [lng, lat], ...]
   * @param {Object} options - 线条选项
   * @returns {Object} 线条实例
   */
  addPolyline(path, options = {}) {
    if (!mapInstance) {
      throw new Error('地图未创建');
    }
    
    let polyline;
    
    switch (mapState.provider) {
      case 'amap':
        polyline = this.addAMapPolyline(path, options);
        break;
      case 'google':
        polyline = this.addGooglePolyline(path, options);
        break;
      case 'baidu':
        polyline = this.addBaiduPolyline(path, options);
        break;
      default:
        throw new Error(`不支持的地图提供商: ${mapState.provider}`);
    }
    
    // 添加到线条数组
    mapState.polylines.push({
      path,
      options,
      instance: polyline
    });
    
    return polyline;
  },
  
  /**
   * 添加高德地图轨迹线
   * @param {Array} path - 路径点数组
   * @param {Object} options - 线条选项
   * @returns {Object} 线条实例
   */
  addAMapPolyline(path, options) {
    const polyline = new window.AMap.Polyline({
      path: path,
      strokeColor: options.color || '#3388FF',
      strokeWeight: options.weight || 5,
      strokeOpacity: options.opacity || 0.8,
      strokeStyle: options.dashed ? 'dashed' : 'solid'
    });
    
    polyline.setMap(mapInstance);
    
    return polyline;
  },
  
  /**
   * 添加谷歌地图轨迹线
   * @param {Array} path - 路径点数组
   * @param {Object} options - 线条选项
   * @returns {Object} 线条实例
   */
  addGooglePolyline(path, options) {
    const googlePath = path.map(point => ({
      lat: point[1],
      lng: point[0]
    }));
    
    const polyline = new window.google.maps.Polyline({
      path: googlePath,
      geodesic: true,
      strokeColor: options.color || '#3388FF',
      strokeWeight: options.weight || 5,
      strokeOpacity: options.opacity || 0.8,
      strokeStyle: options.dashed ? 'dashed' : 'solid'
    });
    
    polyline.setMap(mapInstance);
    
    return polyline;
  },
  
  /**
   * 添加百度地图轨迹线
   * @param {Array} path - 路径点数组
   * @param {Object} options - 线条选项
   * @returns {Object} 线条实例
   */
  addBaiduPolyline(path, options) {
    const baiduPath = path.map(point => new window.BMap.Point(point[0], point[1]));
    
    const polyline = new window.BMap.Polyline(baiduPath, {
      strokeColor: options.color || '#3388FF',
      strokeWeight: options.weight || 5,
      strokeOpacity: options.opacity || 0.8,
      strokeStyle: options.dashed ? 'dashed' : 'solid'
    });
    
    mapInstance.addOverlay(polyline);
    
    return polyline;
  },
  
  /**
   * 显示产品溯源路径
   * @param {Array} tracePoints - 追溯点数组
   */
  showTraceRoute(tracePoints) {
    if (!mapInstance || !tracePoints || tracePoints.length === 0) {
      return;
    }
    
    // 清除现有标记和路径
    this.clearMap();
    
    // 提取位置信息
    const locations = tracePoints.map(point => ({
      position: [point.longitude, point.latitude],
      title: point.name || point.location || '未命名位置',
      timestamp: point.timestamp,
      type: point.type || 'unknown',
      data: point
    }));
    
    // 按时间排序
    locations.sort((a, b) => a.timestamp - b.timestamp);
    
    // 添加标记点
    locations.forEach((location, index) => {
      // 根据节点类型设置不同图标
      const iconUrl = this.getTracePointIcon(location.type, index === 0, index === locations.length - 1);
      
      // 创建信息窗体内容
      const infoContent = this.createTracePointInfo(location.data, index);
      
      // 添加标记
      this.addMarker(location.position, {
        title: location.title,
        icon: iconUrl,
        label: `${index + 1}`,
        data: location.data,
        infoWindow: {
          content: infoContent,
          autoOpen: index === 0 // 第一个节点自动打开信息窗体
        }
      });
    });
    
    // 提取路径
    const path = locations.map(loc => loc.position);
    
    // 添加路径线
    if (path.length > 1) {
      this.addPolyline(path, {
        color: '#1890FF',
        weight: 5,
        opacity: 0.8
      });
    }
    
    // 调整视图以显示所有点
    this.fitBounds(path);
  },
  
  /**
   * 获取追溯点图标
   * @param {string} type - 节点类型
   * @param {boolean} isStart - 是否起点
   * @param {boolean} isEnd - 是否终点
   * @returns {string} 图标URL
   */
  getTracePointIcon(type, isStart, isEnd) {
    // 根据不同类型返回不同图标
    // 实际项目中，这里可以返回自定义图标的URL
    if (isStart) {
      return 'https://a.amap.com/jsapi_demos/static/demo-center/icons/poi-marker-start.png';
    }
    
    if (isEnd) {
      return 'https://a.amap.com/jsapi_demos/static/demo-center/icons/poi-marker-end.png';
    }
    
    switch (type) {
      case 'production':
        return 'https://a.amap.com/jsapi_demos/static/demo-center/icons/poi-marker-1.png';
      case 'processing':
        return 'https://a.amap.com/jsapi_demos/static/demo-center/icons/poi-marker-2.png';
      case 'storage':
        return 'https://a.amap.com/jsapi_demos/static/demo-center/icons/poi-marker-3.png';
      case 'transportation':
        return 'https://a.amap.com/jsapi_demos/static/demo-center/icons/poi-marker-4.png';
      case 'distribution':
        return 'https://a.amap.com/jsapi_demos/static/demo-center/icons/poi-marker-5.png';
      case 'retail':
        return 'https://a.amap.com/jsapi_demos/static/demo-center/icons/poi-marker-6.png';
      default:
        return 'https://a.amap.com/jsapi_demos/static/demo-center/icons/poi-marker-default.png';
    }
  },
  
  /**
   * 创建追溯点信息内容
   * @param {Object} data - 节点数据
   * @param {number} index - 节点索引
   * @returns {string} HTML内容
   */
  createTracePointInfo(data, index) {
    const time = data.timestamp ? new Date(data.timestamp).toLocaleString() : '未知时间';
    const operators = data.operators ? data.operators.join(', ') : '未知';
    
    return `
      <div class="trace-info-window">
        <h3>${data.name || data.location || '未命名位置'}</h3>
        <p><strong>类型:</strong> ${this.getTracePointTypeName(data.type)}</p>
        <p><strong>时间:</strong> ${time}</p>
        <p><strong>操作员:</strong> ${operators}</p>
        ${data.description ? `<p><strong>描述:</strong> ${data.description}</p>` : ''}
        ${data.imageUrl ? `<img src="${data.imageUrl}" alt="现场图片" style="max-width:200px;margin-top:10px;" />` : ''}
      </div>
    `;
  },
  
  /**
   * 获取追溯点类型名称
   * @param {string} type - 类型代码
   * @returns {string} 类型名称
   */
  getTracePointTypeName(type) {
    const typeMap = {
      'production': '生产',
      'processing': '加工',
      'storage': '仓储',
      'transportation': '运输',
      'distribution': '配送',
      'retail': '零售',
      'default': '未知'
    };
    
    return typeMap[type] || typeMap.default;
  },
  
  /**
   * 调整地图视图以显示所有点
   * @param {Array} points - 点位数组
   */
  fitBounds(points) {
    if (!mapInstance || !points || points.length === 0) {
      return;
    }
    
    switch (mapState.provider) {
      case 'amap':
        this.fitBoundsAMap(points);
        break;
      case 'google':
        this.fitBoundsGoogle(points);
        break;
      case 'baidu':
        this.fitBoundsBaidu(points);
        break;
    }
  },
  
  /**
   * 调整高德地图视图
   * @param {Array} points - 点位数组
   */
  fitBoundsAMap(points) {
    mapInstance.setFitView();
  },
  
  /**
   * 调整谷歌地图视图
   * @param {Array} points - 点位数组
   */
  fitBoundsGoogle(points) {
    const bounds = new window.google.maps.LatLngBounds();
    
    points.forEach(point => {
      bounds.extend({ lat: point[1], lng: point[0] });
    });
    
    mapInstance.fitBounds(bounds);
  },
  
  /**
   * 调整百度地图视图
   * @param {Array} points - 点位数组
   */
  fitBoundsBaidu(points) {
    const bounds = new window.BMap.Bounds();
    
    points.forEach(point => {
      bounds.extend(new window.BMap.Point(point[0], point[1]));
    });
    
    mapInstance.setViewport(points.map(point => new window.BMap.Point(point[0], point[1])));
  },
  
  /**
   * 清除地图上的所有覆盖物
   */
  clearMap() {
    if (!mapInstance) {
      return;
    }
    
    switch (mapState.provider) {
      case 'amap':
        mapInstance.clearMap();
        break;
      case 'google':
        mapState.markers.forEach(marker => {
          marker.instance.setMap(null);
        });
        mapState.polylines.forEach(polyline => {
          polyline.instance.setMap(null);
        });
        break;
      case 'baidu':
        mapInstance.clearOverlays();
        break;
    }
    
    mapState.markers = [];
    mapState.polylines = [];
  },
  
  /**
   * 获取地图状态
   * @returns {Object} 地图状态
   */
  getStatus() {
    return { ...mapState };
  }
};

// 导出模块
window.traceMap = traceMap;

// 如果定义了模块系统，也通过模块系统导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = traceMap;
} else if (typeof define === 'function' && define.amd) {
  define([], function() { return traceMap; });
} 