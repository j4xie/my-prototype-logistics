/**
 * 广告管理 API
 */
import request from '@/utils/request'

// ========== 广告 CRUD ==========

// 分页查询广告
export function getPage(query) {
  return request({
    url: '/advertisement/page',
    method: 'get',
    params: query
  })
}

// 获取广告详情
export function getObj(id) {
  return request({
    url: '/advertisement/' + id,
    method: 'get'
  })
}

// 新增广告
export function addObj(data) {
  return request({
    url: '/advertisement',
    method: 'post',
    data: data
  })
}

// 修改广告
export function putObj(data) {
  return request({
    url: '/advertisement',
    method: 'put',
    data: data
  })
}

// 更新广告状态（上下线）
export function updateStatus(id, status) {
  return request({
    url: '/advertisement/' + id + '/status',
    method: 'put',
    params: { status }
  })
}

// 删除广告
export function delObj(id) {
  return request({
    url: '/advertisement/' + id,
    method: 'delete'
  })
}

// ========== 公开接口 ==========

// 按类型获取有效广告
export function listActiveByType(type) {
  return request({
    url: '/advertisement/active/' + type,
    method: 'get'
  })
}

// 获取启动广告
export function getSplashAd() {
  return request({
    url: '/advertisement/splash',
    method: 'get'
  })
}

// 获取首页Banner
export function getHomeBanners() {
  return request({
    url: '/advertisement/banners',
    method: 'get'
  })
}

// ========== 统计相关 ==========

// 记录广告点击
export function recordClick(id) {
  return request({
    url: '/advertisement/' + id + '/click',
    method: 'post'
  })
}

// 记录广告展示
export function recordView(id) {
  return request({
    url: '/advertisement/' + id + '/view',
    method: 'post'
  })
}

// 获取广告统计数据
export function getStats(id) {
  return request({
    url: '/advertisement/' + id + '/stats',
    method: 'get'
  })
}
