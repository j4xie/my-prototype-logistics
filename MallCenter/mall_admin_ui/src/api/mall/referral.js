/**
 * 推荐系统 API
 */
import request from '@/utils/request'

// ========== 推荐记录管理 ==========

// 分页查询推荐记录
export function getPage(query) {
  return request({
    url: '/referral/page',
    method: 'get',
    params: query
  })
}

// 获取推荐记录详情
export function getObj(id) {
  return request({
    url: '/referral/' + id,
    method: 'get'
  })
}

// 查询推荐人的推荐记录
export function listByReferrer(referrerId) {
  return request({
    url: '/referral/referrer/' + referrerId,
    method: 'get'
  })
}

// 获取推荐人统计数据
export function getReferrerStats(referrerId) {
  return request({
    url: '/referral/statistics/' + referrerId,
    method: 'get'
  })
}

// 创建推荐记录
export function addObj(data) {
  return request({
    url: '/referral',
    method: 'post',
    data: data
  })
}

// 确认推荐有效
export function confirmReferral(id) {
  return request({
    url: '/referral/' + id + '/confirm',
    method: 'put'
  })
}

// 发放奖励
export function grantReward(id, rewardAmount, rewardType) {
  return request({
    url: '/referral/' + id + '/reward',
    method: 'put',
    params: { rewardAmount, rewardType }
  })
}

// 生成用户推荐码
export function generateCode(userId) {
  return request({
    url: '/referral/code/generate/' + userId,
    method: 'get'
  })
}

// ========== 奖励配置管理 ==========

// 获取有效的奖励配置
export function getActiveConfigs() {
  return request({
    url: '/referral/config/active',
    method: 'get'
  })
}

// 根据推荐类型获取配置
export function getConfigByType(referralType) {
  return request({
    url: '/referral/config/type/' + referralType,
    method: 'get'
  })
}

// 处理待发放奖励
export function processPending() {
  return request({
    url: '/referral/process-pending',
    method: 'post'
  })
}

















