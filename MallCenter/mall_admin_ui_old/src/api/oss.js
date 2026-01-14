/**
 * OSS 上传服务 API
 * 用于管理后台直传图片到阿里云OSS
 */
import request from '@/utils/request'

/**
 * 获取OSS上传签名
 * @param {string} type 文件类型 (product/avatar/feedback/merchant)
 * @param {string} filename 原始文件名 (可选)
 * @returns {Promise} 签名信息
 */
export function getOssSignature(type = 'product', filename = '') {
  return request({
    url: '/weixin/api/ma/oss/signature',
    method: 'get',
    params: { type, filename }
  })
}

/**
 * 获取OSS配置信息
 * @returns {Promise} OSS配置
 */
export function getOssConfig() {
  return request({
    url: '/weixin/api/ma/oss/config',
    method: 'get'
  })
}

/**
 * 批量获取上传签名
 * @param {string} type 文件类型
 * @param {number} count 签名数量 (最多10个)
 * @returns {Promise} 签名数组
 */
export function getBatchSignatures(type = 'product', count = 1) {
  return request({
    url: '/weixin/api/ma/oss/signatures',
    method: 'get',
    params: { type, count }
  })
}
