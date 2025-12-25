/**
 * 商户管理 API
 */
import request from '@/utils/request'

// 分页查询商户列表
export function getPage(query) {
  return request({
    url: '/merchant/page',
    method: 'get',
    params: query
  })
}

// 获取商户详情
export function getObj(id) {
  return request({
    url: '/merchant/' + id,
    method: 'get'
  })
}

// 新增商户（入驻申请）
export function addObj(data) {
  return request({
    url: '/merchant',
    method: 'post',
    data: data
  })
}

// 修改商户信息
export function putObj(data) {
  return request({
    url: '/merchant',
    method: 'put',
    data: data
  })
}

// 删除商户
export function delObj(id) {
  return request({
    url: '/merchant/' + id,
    method: 'delete'
  })
}

// 审核商户
export function reviewMerchant(id, action, remark) {
  return request({
    url: '/merchant/' + id + '/review',
    method: 'put',
    params: { action, remark }
  })
}

// 更新商户状态
export function updateStatus(id, status) {
  return request({
    url: '/merchant/' + id + '/status',
    method: 'put',
    params: { status }
  })
}

// 获取商户统计数据
export function getStats(id) {
  return request({
    url: '/merchant/' + id + '/stats',
    method: 'get'
  })
}

// 获取商户审核历史
export function getReviewHistory(id) {
  return request({
    url: '/merchant/' + id + '/review-history',
    method: 'get'
  })
}

// 获取待审核商户数量
export function getPendingCount() {
  return request({
    url: '/merchant/pending-count',
    method: 'get'
  })
}
