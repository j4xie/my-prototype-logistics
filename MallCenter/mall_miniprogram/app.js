/**
 * Copyright (C) 2024-2025
 * 食品商城小程序
 * 注意：
 * 基于 JooLun 框架二次开发
 */
/**
 * <version>3.3.2</version>
 */
const api = require('./utils/api')
const __config = require('./config/env')
const tracker = require('./utils/tracker')

App({
  api: api,
  tracker: tracker,  // 暴露给页面使用
  globalData: {
    thirdSession: null,
    wxUser: null,
    config: __config,
    // 功能开关 - 通过后端配置控制
    featureFlags: {
      showAI: false,           // AI助手功能
      showCategories: false,   // 首页分类网格
      showProducts: false,     // 首页商品列表(热销、推荐)
      showCategoryTab: false   // 底部分类Tab
    }
  },
  onLaunch: function () {
    // P0修复: 初始化行为追踪器
    tracker.init()

    //检测新版本
    this.updateManager()
    // 加载功能开关配置
    this.loadFeatureConfig()
    wx.getSystemInfo({
      success: e => {
        this.globalData.StatusBar = e.statusBarHeight;
        let custom = wx.getMenuButtonBoundingClientRect();
        this.globalData.Custom = custom;
        this.globalData.CustomBar = custom.bottom + custom.top - e.statusBarHeight;
      }
    })
  },
  // 全局功能开关加载（一次请求，各页面共享）
  loadFeatureConfig: function () {
    var self = this
    wx.request({
      url: __config.basePath + '/weixin/api/ma/ai/feature-config',
      method: 'GET',
      success: function (res) {
        if (res.statusCode === 200 && res.data.code === 200 && res.data.data) {
          var cfg = res.data.data
          self.globalData.featureFlags = {
            showAI: cfg.showAI === true,
            showCategories: cfg.showCategories !== false,
            showProducts: cfg.showProducts !== false,
            showCategoryTab: cfg.showCategoryTab !== false
          }
          self.globalData._featureLoaded = true
          // 通知已注册的监听页面
          if (self._featureCallbacks) {
            self._featureCallbacks.forEach(function (cb) { cb(self.globalData.featureFlags) })
            self._featureCallbacks = []
          }
        }
      },
      fail: function () {
        console.log('功能配置加载失败，使用默认值')
      }
    })
  },
  // 页面注册回调：如果配置已加载立即回调，否则等待
  onFeatureReady: function (callback) {
    if (this.globalData._featureLoaded) {
      callback(this.globalData.featureFlags)
    } else {
      if (!this._featureCallbacks) this._featureCallbacks = []
      this._featureCallbacks.push(callback)
    }
  },
  onShow: function () {
    // 恢复行为追踪
    tracker.resume()
  },
  onHide: function () {
    // 切后台时立即上报所有队列事件
    tracker.flush()
    tracker.pause()
  },
  updateManager(){
    const updateManager = wx.getUpdateManager()
    updateManager.onUpdateReady(function () {
      wx.showModal({
        title: '更新提示',
        content: '新版本已经准备好，是否重启应用？',
        success(res) {
          if (res.confirm) {
            updateManager.applyUpdate()
          }
        }
      })
    })
  },
  //获取购物车数量
  shoppingCartCount() {
    this.api.shoppingCartCount()
      .then(res => {
        let shoppingCartCount = res.data
        this.globalData.shoppingCartCount = shoppingCartCount + ''
        wx.setTabBarBadge({
          index: 2,
          text: this.globalData.shoppingCartCount + ''
        })
      })
  },
  //初始化，供每个页面调用 
  initPage: function () {
    let that = this
    return new Promise((resolve, reject) => {
      if (!that.globalData.thirdSession) {//无thirdSession，进行登录
        that.doLogin()
          .then(res => {
            resolve("success")
          })
      } else {//有thirdSession，说明已登录，返回初始化成功
        wx.checkSession({//检查登录态是否过期
          success () {
            //session_key 未过期，并且在本生命周期一直有效
            console.log('session_key 未过期')
            resolve("success")
          },
          fail () {
            // session_key 已经失效，需要重新执行登录流程
            console.log('session_key 已经失效')
            that.doLogin()
              .then(res => {
                resolve("success")
              })
          }
        })
       
      }
    })
  },
  doLogin(){
    wx.showLoading({
      title: '登录中',
    })
    let that = this
    return new Promise((resolve, reject) => {
      wx.login({
        success: function (res) {
          if (res.code) {
            api.login({
              jsCode: res.code
            })
              .then(res => {
                wx.hideLoading()
                let wxUser = res.data
                that.globalData.thirdSession = wxUser.sessionKey
                that.globalData.wxUser = wxUser
                resolve("success")
                //获取购物车数量
                that.shoppingCartCount()
              })
          }
        }
      })
    })
  },
  //获取当前页面带参数的url
  getCurrentPageUrlWithArgs(){
    const pages = getCurrentPages()
    const currentPage = pages[pages.length - 1]
    const url = currentPage.route
    const options = currentPage.options
    let urlWithArgs = `/${url}?`
    for (let key in options) {
      const value = options[key]
      urlWithArgs += `${key}=${value}&`
    }
    urlWithArgs = urlWithArgs.substring(0, urlWithArgs.length - 1)
    return urlWithArgs
  }
})