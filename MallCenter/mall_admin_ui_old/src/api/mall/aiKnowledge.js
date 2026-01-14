/**
 * AI知识库 API
 */
import request from '@/utils/request'

// ========== 文档管理 ==========

// 获取文档列表
export function getDocuments(query) {
  return request({
    url: '/ai-knowledge/documents',
    method: 'get',
    params: query
  })
}

// 获取文档详情
export function getDocument(id) {
  return request({
    url: '/ai-knowledge/documents/' + id,
    method: 'get'
  })
}

// 上传文档
export function uploadDocument(data) {
  return request({
    url: '/ai-knowledge/documents/upload',
    method: 'post',
    headers: { 'Content-Type': 'multipart/form-data' },
    data: data
  })
}

// 更新文档
export function updateDocument(id, data) {
  return request({
    url: '/ai-knowledge/documents/' + id,
    method: 'put',
    data: data
  })
}

// 删除文档
export function deleteDocument(id) {
  return request({
    url: '/ai-knowledge/documents/' + id,
    method: 'delete'
  })
}

// 批量删除文档
export function batchDeleteDocuments(ids) {
  return request({
    url: '/ai-knowledge/documents/batch',
    method: 'delete',
    data: { ids }
  })
}

// 重新解析文档
export function reprocessDocument(id) {
  return request({
    url: '/ai-knowledge/documents/' + id + '/reprocess',
    method: 'post'
  })
}

// ========== 分类管理 ==========

// 获取分类树
export function getCategoryTree() {
  return request({
    url: '/ai-knowledge/categories/tree',
    method: 'get'
  })
}

// 获取分类列表
export function getCategories(query) {
  return request({
    url: '/ai-knowledge/categories',
    method: 'get',
    params: query
  })
}

// 添加分类
export function addCategory(data) {
  return request({
    url: '/ai-knowledge/categories',
    method: 'post',
    data: data
  })
}

// 更新分类
export function updateCategory(id, data) {
  return request({
    url: '/ai-knowledge/categories/' + id,
    method: 'put',
    data: data
  })
}

// 删除分类
export function deleteCategory(id) {
  return request({
    url: '/ai-knowledge/categories/' + id,
    method: 'delete'
  })
}

// ========== QA配对管理 ==========

// 获取QA列表
export function getQAPairs(query) {
  return request({
    url: '/ai-knowledge/qa-pairs',
    method: 'get',
    params: query
  })
}

// 获取QA详情
export function getQAPair(id) {
  return request({
    url: '/ai-knowledge/qa-pairs/' + id,
    method: 'get'
  })
}

// 添加QA
export function addQAPair(data) {
  return request({
    url: '/ai-knowledge/qa-pairs',
    method: 'post',
    data: data
  })
}

// 更新QA
export function updateQAPair(id, data) {
  return request({
    url: '/ai-knowledge/qa-pairs/' + id,
    method: 'put',
    data: data
  })
}

// 删除QA
export function deleteQAPair(id) {
  return request({
    url: '/ai-knowledge/qa-pairs/' + id,
    method: 'delete'
  })
}

// 批量导入QA
export function importQAPairs(data) {
  return request({
    url: '/ai-knowledge/qa-pairs/import',
    method: 'post',
    data: data
  })
}

// ========== 知识库统计 ==========

// 获取知识库统计
export function getKnowledgeStats() {
  return request({
    url: '/ai-knowledge/stats',
    method: 'get'
  })
}

// 获取向量化状态
export function getVectorizationStatus() {
  return request({
    url: '/ai-knowledge/vectorization/status',
    method: 'get'
  })
}

// 触发向量化
export function triggerVectorization(documentIds) {
  return request({
    url: '/ai-knowledge/vectorization/trigger',
    method: 'post',
    data: { documentIds }
  })
}
