/**
 * Copyright (C) 2024-2025
 * 食品商城小程序
 * 注意：
 * 基于 JooLun 框架二次开发
 */
const validate = require('./validate.js')

const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return [year, month, day].map(formatNumber).join('/') + ' ' + [hour, minute, second].map(formatNumber).join(':')
}

const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : '0' + n
}

//空值过滤器
const filterForm = (form) => {
  let obj = {};
  Object.keys(form).forEach(ele => {
    if (!validate.validatenull(form[ele])) {
      obj[ele] = form[ele]
    }
  });
  return obj;
}

/**
 * 解析图片URL数组
 * 后端可能返回 ["url1,url2,url3"] 格式（逗号分隔的字符串数组）
 * 需要转换为 ["url1", "url2", "url3"] 格式
 */
const parsePicUrls = (picUrls) => {
  if (!picUrls || !Array.isArray(picUrls) || picUrls.length === 0) {
    return []
  }
  const result = []
  for (const url of picUrls) {
    if (url && typeof url === 'string') {
      if (url.includes(',')) {
        // 逗号分隔的字符串，拆分为多个URL
        const urls = url.split(',').map(u => u.trim()).filter(u => u)
        result.push(...urls)
      } else {
        result.push(url)
      }
    }
  }
  return result
}

/**
 * 处理商品数据，修复图片URL格式
 * @param {Object} goods - 商品对象
 * @returns {Object} 处理后的商品对象
 */
const processGoodsItem = (goods) => {
  if (!goods) return goods
  return {
    ...goods,
    picUrls: parsePicUrls(goods.picUrls)
  }
}

/**
 * 批量处理商品列表数据
 * @param {Array} goodsList - 商品列表
 * @returns {Array} 处理后的商品列表
 */
const processGoodsList = (goodsList) => {
  if (!goodsList || !Array.isArray(goodsList)) return []
  return goodsList.map(item => processGoodsItem(item))
}

module.exports = {
  formatTime: formatTime,
  formatNumber: formatNumber,
  filterForm: filterForm,
  parsePicUrls: parsePicUrls,
  processGoodsItem: processGoodsItem,
  processGoodsList: processGoodsList
}
