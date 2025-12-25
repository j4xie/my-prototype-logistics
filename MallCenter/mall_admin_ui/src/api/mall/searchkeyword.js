/**
 * 搜索关键词管理 API
 */
import request from '@/utils/request'

// 获取概览统计
export function getOverview() {
  return request({
    url: '/mall/search-keyword/stats/overview',
    method: 'get'
  })
}

// 分页查询关键词统计
export function getStatsPage(query) {
  return request({
    url: '/mall/search-keyword/stats/page',
    method: 'get',
    params: query
  })
}

// 获取单个关键词统计详情
export function getStatsById(id) {
  return request({
    url: '/mall/search-keyword/stats/' + id,
    method: 'get'
  })
}

// 获取关键词的商家记录
export function getMerchantRecords(keyword, query) {
  return request({
    url: '/mall/search-keyword/stats/' + encodeURIComponent(keyword) + '/merchants',
    method: 'get',
    params: query
  })
}

// 匹配商品
export function matchProducts(statsId, productIds) {
  return request({
    url: '/mall/search-keyword/stats/' + statsId + '/match-products',
    method: 'post',
    data: { productIds }
  })
}

// 发送通知
export function notifyMerchants(statsId, sendSms, templateCode) {
  return request({
    url: '/mall/search-keyword/stats/' + statsId + '/notify',
    method: 'post',
    data: { sendSms, templateCode }
  })
}

// 更新关键词统计状态
export function updateStats(id, data) {
  return request({
    url: '/mall/search-keyword/stats/' + id,
    method: 'put',
    data: data
  })
}

// 获取热门关键词
export function getHotKeywords(limit = 20) {
  return request({
    url: '/mall/search-keyword/stats/hot',
    method: 'get',
    params: { limit }
  })
}

// 商品搜索 (用于匹配商品弹窗)
export function searchProducts(query) {
  return request({
    url: '/goodsspu/page',
    method: 'get',
    params: query
  })
}
