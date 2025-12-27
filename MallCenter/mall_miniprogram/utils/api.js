/**
 * Copyright (C) 2024-2025
 * 食品商城小程序
 * 注意：
 * 基于 JooLun 框架二次开发
 */
import __config from '../config/env'

const request = (url, method, data, showLoading) => {
  let _url = __config.basePath + url
  return new Promise((resolve, reject) => {
    if (showLoading){
      wx.showLoading({
        title: '加载中',
      })
    }
    wx.request({
      url: _url,
      method: method,
      data: data,
      header: {
        'app-id': wx.getAccountInfoSync().miniProgram.appId,
        'third-session': getApp().globalData.thirdSession != null ? getApp().globalData.thirdSession : ''
      },
      success(res) {
        if (res.statusCode == 200) {
          if (res.data.code != 200) {
            console.log(res.data)
            wx.showModal({
              title: '提示',
              content: res.data.msg ? res.data.msg : '没有数据' + '',
              success() {
                
              },
              complete(){
                if(res.data.code == 60001){
                  //session过期，则清除过期session，并重新加载当前页
                  getApp().globalData.thirdSession = null
                  wx.reLaunch({
                    url: getApp().getCurrentPageUrlWithArgs()
                  })
                }
              }
            })
            reject(res.data.msg)
          }
          resolve(res.data)
        } else if (res.statusCode == 404) {
          wx.showModal({
            title: '提示',
            content: '接口请求出错，请检查手机网络',
            success(res) {

            }
          })
          reject()
        } else {
          console.log(res)
          wx.showModal({
            title: '提示',
            content: res.errMsg + ':' + res.data.message + ':' + res.data.msg,
            success(res) {

            }
          })
          reject()
        }
      },
      fail(error) {
        console.log(error)
        wx.showModal({
          title: '提示',
          content: '接口请求出错：' + error.errMsg,
          success(res) {

          }
        })
        reject(error)
      },
      complete(res) {
        wx.hideLoading()
      }
    })
  })
}

module.exports = {
  request,
  login: (data) => {//小程序登录接口
    return request('/weixin/api/ma/wxuser/login', 'post', data, false)
  },
  wxUserGet: (data) => {//微信用户查询
    return request('/weixin/api/ma/wxuser', 'get', null, false)
  },
  wxUserSave: (data) => {//微信用户新增
    return request('/weixin/api/ma/wxuser', 'post', data, true)
  },
  goodsCategoryGet: (data) => {//商品分类查询
    return request('/weixin/api/ma/goodscategory/tree' , 'get', data, true)
  },
  goodsPage: (data) => {//商品列表
    return request('/weixin/api/ma/goodsspu/page', 'get', data, false)
  },
  goodsGet: (id) => {//商品查询
    return request('/weixin/api/ma/goodsspu/' + id, 'get', null, false)
  },
  goodsAdd: (data) => {//商品新增
    return request('/weixin/api/ma/goodsspu', 'post', data, true)
  },
  goodsEdit: (data) => {//商品修改
    return request('/weixin/api/ma/goodsspu', 'put', data, true)
  },
  goodsDel: (id) => {//商品删除
    return request('/weixin/api/ma/goodsspu/' + id, 'delete', null, true)
  },
  merchantGoodsPage: (data) => {//商户商品列表
    return request('/weixin/api/ma/goodsspu/merchant/page', 'get', data, false)
  },
  shoppingCartPage: (data) => {//购物车列表
    return request('/weixin/api/ma/shoppingcart/page', 'get', data, false)
  },
  shoppingCartAdd: (data) => {//购物车新增
    return request('/weixin/api/ma/shoppingcart', 'post', data, true)
  },
  shoppingCartEdit: (data) => {//购物车修改
    return request('/weixin/api/ma/shoppingcart', 'put', data, true)
  },
  shoppingCartDel: (data) => {//购物车删除
    return request('/weixin/api/ma/shoppingcart/del', 'post', data, false)
  },
  shoppingCartCount: (data) => {//购物车数量
    return request('/weixin/api/ma/shoppingcart/count', 'get', data, false)
  },
  orderSub: (data) => {//订单提交
    return request('/weixin/api/ma/orderinfo', 'post', data, true)
  },
  orderPage: (data) => {//订单列表
    return request('/weixin/api/ma/orderinfo/page', 'get', data, false)
  },
  orderGet: (id) => {//订单详情查询
    return request('/weixin/api/ma/orderinfo/' + id, 'get', null, false)
  },
  orderCancel: (id) => {//订单确认取消
    return request('/weixin/api/ma/orderinfo/cancel/' + id, 'put', null, true)
  },
  orderRefunds: (data) => {//订单申请退款
    return request('/weixin/api/ma/orderinfo/refunds', 'post', data, true)
  },
  orderReceive: (id) => {//订单确认收货
    return request('/weixin/api/ma/orderinfo/receive/' + id, 'put', null, true)
  },
  orderDel: (id) => {//订单删除
    return request('/weixin/api/ma/orderinfo/' + id, 'delete', null, false)
  },
  orderCountAll: (data) => {//订单计数
    return request('/weixin/api/ma/orderinfo/countAll', 'get', data, false)
  },
  unifiedOrder: (data) => {//下单接口
    return request('/weixin/api/ma/orderinfo/unifiedOrder', 'post', data, true)
  },
  userAddressPage: (data) => {//用户收货地址列表
    return request('/weixin/api/ma/useraddress/page', 'get', data, false)
  },
  userAddressSave: (data) => {//用户收货地址新增
    return request('/weixin/api/ma/useraddress', 'post', data, true)
  },
  userAddressDel: (id) => {//用户收货地址删除
    return request('/weixin/api/ma/useraddress/' + id, 'delete', null, false)
  },
  // ========== 广告相关 ==========
  getSplashAd: () => {//获取启动广告
    return request('/advertisement/splash', 'get', null, false)
  },
  getHomeBanners: () => {//获取首页Banner
    return request('/advertisement/banners', 'get', null, false)
  },
  recordAdView: (id) => {//记录广告展示
    return request('/advertisement/' + id + '/view', 'post', null, false)
  },
  recordAdClick: (id) => {//记录广告点击
    return request('/advertisement/' + id + '/click', 'post', null, false)
  },
  // ========== 溯源相关 ==========
  getTraceabilityByBatchNo: (batchNo) => {//根据批次号查询溯源信息
    return request('/weixin/api/ma/traceability/batch/no/' + batchNo, 'get', null, true)
  },
  // ========== 阶梯定价相关 ==========
  getPriceTiers: (spuId) => {//获取商品阶梯定价
    return request('/weixin/api/ma/goods-price-tier/spu/' + spuId, 'get', null, false)
  },
  calculatePrice: (spuId, quantity) => {//计算阶梯价格
    return request('/weixin/api/ma/goods-price-tier/calculate?spuId=' + spuId + '&quantity=' + quantity, 'get', null, false)
  },
  // ========== 商户相关 ==========
  getMerchantInfo: (id) => {//获取商户信息
    return request('/weixin/api/ma/merchant/' + id, 'get', null, false)
  },
  bindMerchant: (data) => {//绑定商户
    return request('/weixin/api/ma/merchant/bind', 'post', data, true)
  },
  registerMerchant: (data) => {//注册商户
    return request('/weixin/api/ma/merchant/register', 'post', data, true)
  },
  // ========== 搜索关键词相关 ==========
  recordSearchKeyword: (data) => {//记录搜索关键词
    return request('/weixin/api/ma/search-keyword/record', 'post', data, false)
  },
  getHotKeywords: (limit = 10) => {//获取热门搜索词
    return request('/weixin/api/ma/search-keyword/hot?limit=' + limit, 'get', null, false)
  },
  getSearchSuggestions: (prefix, limit = 5) => {//获取搜索建议
    return request('/weixin/api/ma/search-keyword/suggest?prefix=' + encodeURIComponent(prefix) + '&limit=' + limit, 'get', null, false)
  },
  // ========== AI聊天相关 ==========
  aiChat: (data) => {//AI对话
    return request('/weixin/api/ma/ai/chat', 'post', data, true)
  },
  aiSemanticSearch: (query, limit = 10) => {//AI语义搜索
    return request('/weixin/api/ma/ai/semantic-search?query=' + encodeURIComponent(query) + '&limit=' + limit, 'get', null, false)
  },
  getAiSessionHistory: (sessionId) => {//获取AI会话历史
    return request('/weixin/api/ma/ai/session/' + sessionId + '/history', 'get', null, false)
  },
  submitAiFeedback: (id, feedback) => {//提交AI反馈
    return request('/weixin/api/ma/ai/demand/' + id + '/feedback', 'put', { feedback }, false)
  },
  // ========== 通知相关 ==========
  getNotificationList: (data) => {//获取通知列表
    return request('/weixin/api/ma/notification/list', 'get', data, false)
  },
  getUnreadNotificationCount: () => {//获取未读通知数量
    return request('/weixin/api/ma/notification/unread-count', 'get', null, false)
  },
  markNotificationRead: (ids) => {//标记通知已读
    return request('/weixin/api/ma/notification/read', 'put', { ids }, false)
  },
  markAllNotificationsRead: () => {//标记所有通知已读
    return request('/weixin/api/ma/notification/read-all', 'put', null, false)
  },
  // ========== 手机号验证码登录相关 ==========
  sendSmsCode: (data) => {//发送短信验证码
    return request('/weixin/api/ma/auth/sms/send', 'post', data, true)
  },
  phoneLogin: (data) => {//手机号验证码登录
    return request('/weixin/api/ma/auth/phone-login', 'post', data, true)
  },
  wechatPhoneLogin: (data) => {//微信一键登录（获取手机号）
    return request('/weixin/api/ma/wxuser/phone-login', 'post', data, true)
  },
  // ========== 优惠券相关 ==========
  getMyCoupons: (data) => {//获取我的优惠券列表
    return request('/weixin/api/ma/coupon/my', 'get', data, false)
  },
  getAvailableCoupons: (data) => {//获取可用优惠券（订单结算时）
    return request('/weixin/api/ma/coupon/available', 'get', data, false)
  },
  useCoupon: (id) => {//使用优惠券
    return request('/weixin/api/ma/coupon/' + id + '/use', 'put', null, false)
  },
  receiveCoupon: (id) => {//领取优惠券
    return request('/weixin/api/ma/coupon/' + id + '/receive', 'post', null, true)
  },
  getCouponDetail: (id) => {//获取优惠券详情
    return request('/weixin/api/ma/coupon/' + id, 'get', null, false)
  },
  // ========== 推荐系统相关 ==========
  getReferralInfo: () => {//获取推荐信息（推荐码、二维码等）
    return request('/weixin/api/ma/referral/info', 'get', null, false)
  },
  getReferralStats: () => {//获取推荐统计数据
    return request('/weixin/api/ma/referral/stats', 'get', null, false)
  },
  getReferralRecords: (data) => {//分页获取推荐记录
    return request('/weixin/api/ma/referral/records', 'get', data, false)
  },
  generateReferralCode: () => {//生成推荐码
    return request('/weixin/api/ma/referral/code/generate', 'get', null, false)
  },
  // ========== AI分析相关 ==========
  getIndustryAnalysis: (forceRefresh = false) => {//获取行业分析报告
    return request('/weixin/api/ma/ai/industry-analysis?forceRefresh=' + forceRefresh, 'get', null, true)
  },
  getProductAnalysis: (productId) => {//获取产品分析报告
    return request('/weixin/api/ma/ai/product-analysis/' + productId, 'get', null, true)
  },
  getFactoryAnalysis: (factoryId) => {//获取工厂分析报告
    return request('/weixin/api/ma/ai/factory-analysis/' + factoryId, 'get', null, true)
  },
  // ========== 商家员工管理相关 ==========
  getMerchantStaffList: (merchantId) => {//获取商户员工列表
    return request('/weixin/api/ma/merchant/' + merchantId + '/staff', 'get', null, false)
  },
  addMerchantStaff: (merchantId, data) => {//添加商户员工
    return request('/weixin/api/ma/merchant/' + merchantId + '/staff', 'post', data, true)
  },
  updateMerchantStaff: (merchantId, staffId, data) => {//更新商户员工
    return request('/weixin/api/ma/merchant/' + merchantId + '/staff/' + staffId, 'put', data, true)
  },
  removeMerchantStaff: (merchantId, staffId) => {//移除商户员工
    return request('/weixin/api/ma/merchant/' + merchantId + '/staff/' + staffId, 'delete', null, true)
  },
  getMerchantStats: (merchantId) => {//获取商户统计数据
    return request('/weixin/api/ma/merchant/' + merchantId + '/stats', 'get', null, false)
  },
  // ========== 文件上传相关 ==========
  uploadFile: (filePath) => {//统一文件上传
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: __config.basePath + '/weixin/api/ma/upload',
        filePath: filePath,
        name: 'file',
        header: {
          'app-id': wx.getAccountInfoSync().miniProgram.appId,
          'third-session': getApp().globalData.thirdSession || ''
        },
        success: (res) => {
          try {
            const data = JSON.parse(res.data)
            if (data.code === 200 || data.code === 0) {
              resolve(data)
            } else {
              reject(new Error(data.msg || '上传失败'))
            }
          } catch (e) {
            reject(new Error('上传失败'))
          }
        },
        fail: (err) => {
          reject(err)
        }
      })
    })
  },
  // ========== 用户行为追踪相关 ==========
  trackBehavior: (data) => {//上报单个行为事件
    return request('/weixin/ma/behavior/track', 'post', data, false)
  },
  trackBehaviorBatch: (data) => {//批量上报行为事件
    return request('/weixin/ma/behavior/trackBatch', 'post', data, false)
  },
  trackProductView: (data) => {//上报商品浏览事件
    return request('/weixin/ma/behavior/view/product', 'post', data, false)
  },
  trackSearch: (data) => {//上报搜索事件
    return request('/weixin/ma/behavior/search', 'post', data, false)
  },
  trackCartAdd: (data) => {//上报加购事件
    return request('/weixin/ma/behavior/cart/add', 'post', data, false)
  },
  getUserInterests: (wxUserId, limit = 20) => {//获取用户兴趣标签
    return request('/weixin/ma/behavior/interests/' + wxUserId + '?limit=' + limit, 'get', null, false)
  },
  getUserProfile: (wxUserId) => {//获取用户画像
    return request('/weixin/ma/behavior/profile/' + wxUserId, 'get', null, false)
  },
  getSearchHistory: (wxUserId, limit = 10) => {//获取用户搜索历史
    return request('/weixin/ma/behavior/searchHistory/' + wxUserId + '?limit=' + limit, 'get', null, false)
  },
  getRecentViewed: (wxUserId, limit = 20) => {//获取最近浏览的商品
    return request('/weixin/ma/behavior/recentViewed/' + wxUserId + '?limit=' + limit, 'get', null, false)
  },
  analyzeUserInterests: (wxUserId) => {//手动触发兴趣分析
    return request('/weixin/ma/behavior/analyze/' + wxUserId, 'post', null, false)
  },
  // ========== 冷启动偏好设置 ==========
  checkColdStart: (wxUserId) => {//检查是否需要显示冷启动弹窗
    return request('/weixin/ma/behavior/cold-start/check/' + wxUserId, 'get', null, false)
  },
  completeColdStart: (data) => {//完成冷启动偏好设置
    // data: { wxUserId, preferences: { categories: [], priceRange: {}, brands: [] } }
    return request('/weixin/ma/behavior/cold-start/complete', 'post', data, false)
  },
  // ========== 个性化推荐相关 ==========
  getHomeRecommend: (wxUserId, limit = 20) => {//获取首页推荐商品
    return request('/weixin/ma/recommend/home/' + wxUserId + '?limit=' + limit, 'get', null, false)
  },
  getYouMayLike: (wxUserId, page = 0, size = 10) => {//获取猜你喜欢推荐(分页)
    return request('/weixin/ma/recommend/youMayLike/' + wxUserId + '?page=' + page + '&size=' + size, 'get', null, false)
  },
  getSimilarProducts: (productId, wxUserId, limit = 6) => {//获取相似商品推荐
    let url = '/weixin/ma/recommend/similar/' + productId + '?limit=' + limit
    if (wxUserId) {
      url += '&wxUserId=' + wxUserId
    }
    return request(url, 'get', null, false)
  },
  getCartRecommend: (data) => {//获取购物车推荐
    return request('/weixin/ma/recommend/cart', 'post', data, false)
  },
  getPopularProducts: (category, limit = 10) => {//获取热门商品(无需登录)
    let url = '/weixin/ma/recommend/popular?limit=' + limit
    if (category) {
      url += '&category=' + encodeURIComponent(category)
    }
    return request(url, 'get', null, false)
  },
  refreshRecommendCache: (wxUserId) => {//刷新推荐缓存
    return request('/weixin/ma/recommend/refresh/' + wxUserId, 'post', null, false)
  }
}