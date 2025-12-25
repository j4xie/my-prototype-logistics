/**
 * 溯源管理 API
 */
import request from '@/utils/request'

// ========== 批次管理 ==========

// 分页查询批次
export function getPage(query) {
  return request({
    url: '/traceability/batch/page',
    method: 'get',
    params: query
  })
}

// 获取批次详情
export function getObj(id) {
  return request({
    url: '/traceability/batch/' + id,
    method: 'get'
  })
}

// 根据批次号查询（公开）
export function getByBatchNo(batchNo) {
  return request({
    url: '/traceability/batch/no/' + batchNo,
    method: 'get'
  })
}

// 新增批次
export function addObj(data) {
  return request({
    url: '/traceability/batch',
    method: 'post',
    data: data
  })
}

// 修改批次
export function putObj(data) {
  return request({
    url: '/traceability/batch',
    method: 'put',
    data: data
  })
}

// 更新批次状态
export function updateStatus(id, status) {
  return request({
    url: '/traceability/batch/' + id + '/status',
    method: 'put',
    params: { status }
  })
}

// 删除批次
export function delObj(id) {
  return request({
    url: '/traceability/batch/' + id,
    method: 'delete'
  })
}

// ========== 时间线管理 ==========

// 获取批次时间线
export function getTimeline(batchId) {
  return request({
    url: '/traceability/batch/' + batchId + '/timeline',
    method: 'get'
  })
}

// 添加时间线节点
export function addTimelineNode(data) {
  return request({
    url: '/traceability/timeline',
    method: 'post',
    data: data
  })
}

// 更新时间线节点
export function updateTimelineNode(data) {
  return request({
    url: '/traceability/timeline',
    method: 'put',
    data: data
  })
}

// 删除时间线节点
export function deleteTimelineNode(nodeId) {
  return request({
    url: '/traceability/timeline/' + nodeId,
    method: 'delete'
  })
}

// 批量保存时间线
export function saveTimeline(batchId, nodes) {
  return request({
    url: '/traceability/batch/' + batchId + '/timeline/batch',
    method: 'post',
    data: nodes
  })
}

// ========== 原料管理 ==========

// 获取批次原料列表
export function getRawMaterials(batchId) {
  return request({
    url: '/traceability/batch/' + batchId + '/materials',
    method: 'get'
  })
}

// 添加原料
export function addRawMaterial(data) {
  return request({
    url: '/traceability/material',
    method: 'post',
    data: data
  })
}

// ========== 质检报告管理 ==========

// 获取批次质检报告
export function getQualityReports(batchId) {
  return request({
    url: '/traceability/batch/' + batchId + '/quality-reports',
    method: 'get'
  })
}

// 添加质检报告
export function addQualityReport(data) {
  return request({
    url: '/traceability/quality-report',
    method: 'post',
    data: data
  })
}

// ========== 证据管理 ==========

// 获取批次证据
export function getEvidences(batchId) {
  return request({
    url: '/traceability/batch/' + batchId + '/evidences',
    method: 'get'
  })
}

// 添加证据
export function addEvidence(data) {
  return request({
    url: '/traceability/evidence',
    method: 'post',
    data: data
  })
}
