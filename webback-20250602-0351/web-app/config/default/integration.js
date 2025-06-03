/**
 * @module config/default/integration
 * @description 第三方集成配置
 */

/**
 * 第三方集成配置
 * @typedef {Object} IntegrationConfig
 * @property {Object} analytics - 数据分析集成
 * @property {Object} payment - 支付集成
 * @property {Object} social - 社交媒体集成
 * @property {Object} blockchain - 区块链集成
 * @property {Object} map - 地图集成
 * @property {Object} scanner - 扫描功能集成
 */

/**
 * 第三方集成配置
 * @type {IntegrationConfig}
 */
module.exports = {
  // 数据分析
  analytics: {
    enabled: false,
    provider: "none", // none, google, baidu, custom
    trackingId: ""
  },
  
  // 支付集成
  payment: {
    enabled: false,
    providers: []
  },
  
  // 社交媒体
  social: {
    enabled: false,
    platforms: []
  },
  
  // 区块链集成
  blockchain: {
    enabled: true,
    provider: "ethereum", // ethereum, hyperledger, custom
    networkUrl: "",
    contractAddress: "",
    apiKey: ""
  },
  
  // 地图服务
  map: {
    provider: "amap", // amap, google, baidu
    apiKey: "",
    defaultCenter: [116.397428, 39.90923], // 经度, 纬度
    defaultZoom: 12,
    clustersEnabled: true
  },
  
  // 扫描功能
  scanner: {
    enabled: true,
    supportedFormats: ["qr", "barcode", "datamatrix"],
    preferFrontCamera: false,
    scanInterval: 500, // 毫秒
    highlightScanResult: true
  }
}; 