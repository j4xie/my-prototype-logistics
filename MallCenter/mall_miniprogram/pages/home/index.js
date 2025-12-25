/**
 * Copyright (C) 2018-2019
 * All rights reserved, Designed By www.joolun.com
 * 注意：
 * 本软件为www.joolun.com开发研制，项目使用请保留此说明
 */
const app = getApp()

Page({
  data: {
    config: app.globalData.config,
    page: {
      searchCount: false,
      current: 1,
      size: 10
    },
    loadmore: true,
    goodsList: [],
    goodsListNew: [],
    goodsListHot: [],
    swiperData: [],
    bannerList: [], // 存储完整的banner信息用于点击跳转
    cardCur: 0,
    noticeData: [],
    // 溯源扫码入口
    showTraceEntry: true,
    // 启动广告弹窗
    showSplashAd: false,
    splashAdData: null,
    splashAdCountdown: 5
  },

  // 启动广告定时器
  splashAdTimer: null,
  onLoad() {
    app.initPage()
      .then(res => {
        this.loadData()
        this.loadBanners()
        // 延迟显示启动广告
        setTimeout(() => {
          this.loadSplashAd()
        }, 800)
      })
  },
  onShow(){
    //更新tabbar购物车数量
    wx.setTabBarBadge({
      index: 2,
      text: app.globalData.shoppingCartCount + ''
    })
  },
  loadData(){
    this.goodsNew()
    this.goodsHot()
    this.goodsPage()
  },
  onShareAppMessage: function () {
    let title = '白垩纪食品溯源商城 - 源头可追溯'
    let path = 'pages/home/index'
    return {
      title: title,
      path: path,
      success: function (res) {
        if (res.errMsg == 'shareAppMessage:ok') {
          console.log(res.errMsg)
        }
      },
      fail: function (res) {
        // 转发失败
      }
    }
  },
  //新品首发
  goodsNew() {
    app.api.goodsPage({
      searchCount: false,
      current: 1,
      size: 5,
      descs: 'create_time'
    })
      .then(res => {
        let goodsListNew = res.data.records
        this.setData({
          goodsListNew: goodsListNew
        })
      })
  },
  //热销单品
  goodsHot() {
    app.api.goodsPage({
      searchCount: false,
      current: 1,
      size: 5,
      descs: 'sale_num'
    })
      .then(res => {
        let goodsListHot = res.data.records
        this.setData({
          goodsListHot: goodsListHot
        })
      })
  },
  goodsPage(e) {
    app.api.goodsPage(this.data.page)
      .then(res => {
        let goodsList = res.data.records
        this.setData({
          goodsList: [...this.data.goodsList, ...goodsList]
        })
        if (goodsList.length < this.data.page.size) {
          this.setData({
            loadmore: false
          })
        }
      })
  },
  refresh(){
    this.setData({
      loadmore: true,
      ['page.current']: 1,
      goodsList: [],
      goodsListNew: [],
      goodsListHot: []
    })
    this.loadData()
  },
  onPullDownRefresh(){
    // 显示顶部刷新图标
    wx.showNavigationBarLoading()
    this.refresh()
    // 隐藏导航栏加载框
    wx.hideNavigationBarLoading()
    // 停止下拉动作
    wx.stopPullDownRefresh()
  },
  onReachBottom() {
    if (this.data.loadmore) {
      this.setData({
        ['page.current']: this.data.page.current + 1
      })
      this.goodsPage()
    }
  },
  jumpPage(e){
    let page = e.currentTarget.dataset.page
    if (page){
      wx.navigateTo({
        url: page
      })
    }
  },
  // 加载首页Banner
  loadBanners() {
    app.api.getHomeBanners()
      .then(res => {
        if (res.data && res.data.length > 0) {
          let bannerList = res.data
          let swiperData = bannerList.map(item => item.imageUrl)
          this.setData({
            bannerList: bannerList,
            swiperData: swiperData
          })
          // 记录第一个banner的展示
          if (bannerList[0] && bannerList[0].id) {
            app.api.recordAdView(bannerList[0].id)
          }
        }
      })
      .catch(err => {
        console.log('加载Banner失败，使用默认图片')
        // 使用默认banner
        this.setData({
          swiperData: [
            'https://joolun-base-test.oss-cn-zhangjiakou.aliyuncs.com/1/material/c888e1d3-f542-4b4e-aa43-be9d50cc0696.jpg'
          ]
        })
      })
  },
  // Banner轮播切换
  onBannerChange(e) {
    let current = e.detail.current
    let bannerList = this.data.bannerList
    if (bannerList[current] && bannerList[current].id) {
      app.api.recordAdView(bannerList[current].id)
    }
  },
  // Banner点击
  onBannerClick(e) {
    let index = e.currentTarget.dataset.index
    let banner = this.data.bannerList[index]
    if (banner) {
      // 记录点击
      if (banner.id) {
        app.api.recordAdClick(banner.id)
      }
      // 根据linkType跳转
      // linkType: product(商品) / url(外链) / miniprogram(小程序) / none(无跳转)
      // linkValue: 对应的跳转目标值
      if (banner.linkType === 'product' && banner.linkValue) {
        wx.navigateTo({
          url: '/pages/goods/goods-detail/index?id=' + banner.linkValue
        })
      } else if (banner.linkType === 'miniprogram' && banner.linkValue) {
        // 小程序内页面跳转
        wx.navigateTo({
          url: banner.linkValue
        })
      } else if (banner.linkType === 'url' && banner.linkValue) {
        // 外部链接跳转到webview
        wx.navigateTo({
          url: '/pages/base/webview/index?url=' + encodeURIComponent(banner.linkValue)
        })
      }
    }
  },
  // 扫码溯源 - 统一跳转到扫码页
  scanTrace() {
    wx.navigateTo({
      url: '/pages/traceability/scan/index'
    })
  },
  // 跳转搜索页
  goSearch() {
    wx.navigateTo({
      url: '/pages/base/search/index'
    })
  },

  // ========== 启动广告弹窗相关 ==========
  // 加载启动广告
  loadSplashAd() {
    // 检查今日是否已关闭过
    const today = new Date().toDateString()
    const closedToday = wx.getStorageSync('splashAdClosed_' + today)
    if (closedToday) {
      return // 今日已关闭，不再显示
    }

    // 调用API获取启动广告
    app.api.getSplashAd()
      .then(res => {
        if (res.data && res.data.imageUrl) {
          this.setData({
            splashAdData: res.data,
            showSplashAd: true,
            splashAdCountdown: 5
          })
          this.startSplashAdCountdown()
        }
      })
      .catch(err => {
        console.log('加载启动广告失败', err)
        // 使用默认广告图片
        this.setData({
          splashAdData: {
            imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600',
            productId: null
          },
          showSplashAd: true,
          splashAdCountdown: 5
        })
        this.startSplashAdCountdown()
      })
  },

  // 开始倒计时
  startSplashAdCountdown() {
    this.splashAdTimer = setInterval(() => {
      let countdown = this.data.splashAdCountdown - 1
      if (countdown <= 0) {
        this.closeSplashAd()
      } else {
        this.setData({
          splashAdCountdown: countdown
        })
      }
    }, 1000)
  },

  // 关闭启动广告
  closeSplashAd() {
    if (this.splashAdTimer) {
      clearInterval(this.splashAdTimer)
      this.splashAdTimer = null
    }
    this.setData({
      showSplashAd: false
    })
    // 记录今日已关闭（可选）
    // const today = new Date().toDateString()
    // wx.setStorageSync('splashAdClosed_' + today, true)
  },

  // 点击启动广告
  onSplashAdClick() {
    const ad = this.data.splashAdData
    if (ad && ad.productId) {
      // 记录点击
      if (ad.id) {
        app.api.recordAdClick(ad.id)
      }
      this.closeSplashAd()
      wx.navigateTo({
        url: '/pages/goods/goods-detail/index?id=' + ad.productId
      })
    }
  },

  // 阻止冒泡
  preventClose() {
    // 空函数，阻止点击内容区域关闭弹窗
  }
})
