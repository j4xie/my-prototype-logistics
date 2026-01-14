/**
 * 内容审核 API
 */
import request from '@/utils/request'

// ========== 审核队列 ==========

// 获取待审核列表
export function getPendingList(query) {
  return request({
    url: '/content-review/pending',
    method: 'get',
    params: query
  })
}

// 获取审核历史
export function getReviewHistory(query) {
  return request({
    url: '/content-review/history',
    method: 'get',
    params: query
  })
}

// 获取审核详情
export function getReviewDetail(id) {
  return request({
    url: '/content-review/' + id,
    method: 'get'
  })
}

// 审核通过
export function approveContent(id, data) {
  return request({
    url: '/content-review/' + id + '/approve',
    method: 'post',
    data: data
  })
}

// 审核拒绝
export function rejectContent(id, data) {
  return request({
    url: '/content-review/' + id + '/reject',
    method: 'post',
    data: data
  })
}

// 批量审核
export function batchReview(data) {
  return request({
    url: '/content-review/batch',
    method: 'post',
    data: data
  })
}

// ========== 敏感词管理 ==========

// 获取敏感词列表
export function getSensitiveWords(query) {
  return request({
    url: '/content-review/sensitive-words',
    method: 'get',
    params: query
  })
}

// 添加敏感词
export function addSensitiveWord(data) {
  return request({
    url: '/content-review/sensitive-words',
    method: 'post',
    data: data
  })
}

// 删除敏感词
export function deleteSensitiveWord(id) {
  return request({
    url: '/content-review/sensitive-words/' + id,
    method: 'delete'
  })
}

// 批量导入敏感词
export function importSensitiveWords(data) {
  return request({
    url: '/content-review/sensitive-words/import',
    method: 'post',
    data: data
  })
}

// ========== 审核策略 ==========

// 获取审核策略
export function getReviewStrategy() {
  return request({
    url: '/content-review/strategy',
    method: 'get'
  })
}

// 更新审核策略
export function updateReviewStrategy(data) {
  return request({
    url: '/content-review/strategy',
    method: 'put',
    data: data
  })
}

// ========== 统计 ==========

// 获取审核统计
export function getReviewStats() {
  return request({
    url: '/content-review/stats',
    method: 'get'
  })
}
