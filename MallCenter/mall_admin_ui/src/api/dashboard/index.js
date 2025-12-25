/**
 * Dashboard API
 * 仪表盘数据接口
 */
import request from '@/utils/request'

// 获取仪表盘概览数据
export function getOverview() {
  return request({
    url: '/dashboard/overview',
    method: 'get'
  })
}

// 获取订单统计数据
export function getOrderStats(query) {
  return request({
    url: '/dashboard/order-stats',
    method: 'get',
    params: query
  })
}

// 获取销售趋势数据
export function getSalesTrend(query) {
  return request({
    url: '/dashboard/sales-trend',
    method: 'get',
    params: query
  })
}

// 获取热门商品数据
export function getHotProducts(query) {
  return request({
    url: '/dashboard/hot-products',
    method: 'get',
    params: query
  })
}

// 获取待办事项
export function getTodoList() {
  return request({
    url: '/dashboard/todo',
    method: 'get'
  })
}

// 获取最近订单
export function getRecentOrders(query) {
  return request({
    url: '/dashboard/recent-orders',
    method: 'get',
    params: query
  })
}

// 获取商户统计
export function getMerchantStats() {
  return request({
    url: '/dashboard/merchant-stats',
    method: 'get'
  })
}

// 获取溯源统计
export function getTraceabilityStats() {
  return request({
    url: '/dashboard/traceability-stats',
    method: 'get'
  })
}
