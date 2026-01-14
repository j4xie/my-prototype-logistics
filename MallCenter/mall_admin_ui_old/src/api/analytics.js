/**
 * 数据分析 API
 */
import request from '@/utils/request'

// ========== 流量统计 ==========

// 获取流量概览
export function getTrafficOverview(params) {
  return request({
    url: '/analytics/traffic/overview',
    method: 'get',
    params
  })
}

// 获取流量趋势
export function getTrafficTrend(params) {
  return request({
    url: '/analytics/traffic/trend',
    method: 'get',
    params
  })
}

// 获取来源分布
export function getSourceDistribution(params) {
  return request({
    url: '/analytics/traffic/source',
    method: 'get',
    params
  })
}

// 获取页面排行
export function getPageRanking(params) {
  return request({
    url: '/analytics/traffic/pages',
    method: 'get',
    params
  })
}

// 获取地域分布
export function getRegionDistribution(params) {
  return request({
    url: '/analytics/traffic/region',
    method: 'get',
    params
  })
}

// 获取设备分布
export function getDeviceDistribution(params) {
  return request({
    url: '/analytics/traffic/device',
    method: 'get',
    params
  })
}

// ========== 转化分析 ==========

// 获取转化漏斗
export function getConversionFunnel(params) {
  return request({
    url: '/analytics/conversion/funnel',
    method: 'get',
    params
  })
}

// 获取转化率趋势
export function getConversionTrend(params) {
  return request({
    url: '/analytics/conversion/trend',
    method: 'get',
    params
  })
}

// 获取购物车分析
export function getCartAnalysis(params) {
  return request({
    url: '/analytics/conversion/cart',
    method: 'get',
    params
  })
}

// 获取订单分析
export function getOrderAnalysis(params) {
  return request({
    url: '/analytics/conversion/order',
    method: 'get',
    params
  })
}

// 获取复购分析
export function getRepurchaseAnalysis(params) {
  return request({
    url: '/analytics/conversion/repurchase',
    method: 'get',
    params
  })
}

// ========== 用户分析 ==========

// 获取用户概览
export function getUserOverview(params) {
  return request({
    url: '/analytics/user/overview',
    method: 'get',
    params
  })
}

// 获取用户增长趋势
export function getUserGrowthTrend(params) {
  return request({
    url: '/analytics/user/growth',
    method: 'get',
    params
  })
}

// 获取用户留存
export function getUserRetention(params) {
  return request({
    url: '/analytics/user/retention',
    method: 'get',
    params
  })
}

// 获取用户画像
export function getUserProfile(params) {
  return request({
    url: '/analytics/user/profile',
    method: 'get',
    params
  })
}

// ========== 商品分析 ==========

// 获取商品排行
export function getProductRanking(params) {
  return request({
    url: '/analytics/product/ranking',
    method: 'get',
    params
  })
}

// 获取分类销售
export function getCategorySales(params) {
  return request({
    url: '/analytics/product/category',
    method: 'get',
    params
  })
}

// ========== 导出 ==========

// 导出报表
export function exportReport(params) {
  return request({
    url: '/analytics/export',
    method: 'get',
    params,
    responseType: 'blob'
  })
}
