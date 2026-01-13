/**
 * Copyright (C) 2024-2025
 * 食品商城小程序
 * 注意：
 * 基于 JooLun 框架二次开发
 */
const app = getApp()
const tracker = require('../../utils/tracker')

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
    splashAdCountdown: 5,
    // ========== 个性化推荐相关 ==========
    recommendList: [],           // 个性化推荐商品列表
    isLoggedIn: false,           // 登录状态
    recommendPage: 0,            // 推荐分页页码
    hasMoreRecommend: true,      // 是否有更多推荐
    recommendLoading: false,     // 推荐加载中状态
    usePersonalized: false,      // 是否使用个性化推荐(需5+行为)
    // ========== 冷启动弹窗相关 ==========
    showColdStartPopup: false,   // 是否显示冷启动弹窗
    coldStartChecked: false,     // 是否已检查过冷启动状态
    // ========== AI助手开关 ==========
    showAiAssistant: false       // 是否显示AI助手入口（通过接口控制）
  },

  // 启动广告定时器
  splashAdTimer: null,
  onLoad() {
    app.initPage()
      .then(res => {
        // 检查登录状态
        this.checkLoginStatus()
        // 加载数据
        this.loadData()
        this.loadBanners()
        // 加载个性化推荐
        this.loadRecommendations()
        // 加载AI配置
        this.loadAiConfig()
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
    // 重新检查登录状态（用户可能在其他页面登录）
    this.checkLoginStatus()
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
    // P1修复: 刷新时清除曝光记录，确保统计正确
    tracker.clearExposures()

    this.setData({
      loadmore: true,
      ['page.current']: 1,
      goodsList: [],
      goodsListNew: [],
      goodsListHot: [],
      // 重置推荐状态
      recommendList: [],
      recommendPage: 0,
      hasMoreRecommend: true
    })
    this.loadData()
    // 刷新个性化推荐
    this.loadRecommendations()
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
    // 如果使用个性化推荐，加载更多推荐
    if (this.data.usePersonalized && this.data.hasMoreRecommend && !this.data.recommendLoading) {
      this.loadMoreRecommendations()
    } else if (this.data.loadmore) {
      // 否则加载更多普通商品
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
  // 加载AI配置
  loadAiConfig() {
    app.api.getAiConfig()
      .then(res => {
        if (res.code === 200 && res.data) {
          this.setData({
            showAiAssistant: res.data.enabled === true
          })
        }
      })
      .catch(err => {
        console.log('加载AI配置失败:', err)
        // 默认不显示
        this.setData({ showAiAssistant: false })
      })
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
        console.log('加载Banner失败，使用本地默认图片')
        // 使用本地默认banner图片
        this.setData({
          swiperData: [
            '/public/img/banner_1.jpg',
            '/public/img/banner_2.jpg',
            '/public/img/banner_3.jpg'
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
  // Banner图片加载失败时使用本地备用图片
  onBannerImageError(e) {
    const index = e.currentTarget.dataset.index
    const fallbackImages = [
      '/public/img/banner_1.jpg',
      '/public/img/banner_2.jpg',
      '/public/img/banner_3.jpg'
    ]
    // 使用对应索引的本地图片，超出范围则循环使用
    const fallbackImage = fallbackImages[index % fallbackImages.length]
    console.log(`Banner图片加载失败 (index: ${index}), 使用本地备用图片: ${fallbackImage}`)

    // 更新对应索引的图片URL
    const swiperData = this.data.swiperData
    if (swiperData && swiperData[index]) {
      swiperData[index] = fallbackImage
      this.setData({ swiperData })
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

  // 跳转登录页（未登录用户点击价格时触发）
  goToLogin() {
    wx.showToast({
      title: '请先登录查看价格',
      icon: 'none',
      duration: 1500
    })
    setTimeout(() => {
      wx.navigateTo({
        url: '/pages/auth/login/index'
      })
    }, 500)
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
        console.log('加载启动广告失败，不显示默认广告', err)
        // 不显示启动广告，避免加载外部图片失败
        this.setData({
          showSplashAd: false
        })
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
  },

  // ========== 个性化推荐相关方法 ==========

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const wxUser = app.globalData.wxUser
    const isLoggedIn = wxUser && wxUser.id
    this.setData({ isLoggedIn: isLoggedIn })
    console.log('登录状态:', isLoggedIn ? '已登录' : '未登录', wxUser ? wxUser.id : 'null')
  },

  /**
   * 获取用户ID
   */
  getWxUserId() {
    const wxUser = app.globalData.wxUser
    return wxUser ? wxUser.id : null
  },

  /**
   * 加载个性化推荐
   * - 已登录用户: 调用个性化推荐API
   * - 未登录用户: 调用热门商品API
   */
  loadRecommendations() {
    const wxUserId = this.getWxUserId()

    if (wxUserId) {
      // 已登录，尝试加载个性化推荐
      this.loadPersonalizedRecommendations(wxUserId)
    } else {
      // 未登录，加载热门商品
      this.loadPopularProducts()
    }
  },

  /**
   * 加载个性化推荐
   */
  loadPersonalizedRecommendations(wxUserId) {
    this.setData({ recommendLoading: true })

    // 只有已授权个人信息的用户才检查冷启动弹窗
    // 匿名用户（没有 nickName）不显示冷启动弹窗
    const wxUser = app.globalData.wxUser
    if (wxUser && wxUser.nickName) {
      this.checkColdStart(wxUserId)
    }

    // 先调用首页推荐API（获取初始推荐）
    app.api.getHomeRecommend(wxUserId, 10)
      .then(res => {
        const data = res.data || res
        const products = data.recommendations || data || []
        // 添加默认值容错：后端可能未返回 coldStartState
        const coldStartState = data.coldStartState ?? 'cold_start'

        // 判断是否启用个性化推荐
        // 只有在明确返回非cold_start状态时才启用个性化
        const usePersonalized = products.length > 0 && coldStartState !== 'cold_start'

        this.setData({
          recommendList: products,
          recommendPage: 0,
          usePersonalized: usePersonalized,
          hasMoreRecommend: products.length >= 10,
          recommendLoading: false
        })

        console.log('个性化推荐加载完成:', {
          count: products.length,
          coldStartState: coldStartState,
          usePersonalized: usePersonalized
        })

        // 追踪推荐商品曝光
        if (products.length > 0) {
          const productIds = products.map(p => p.id)
          tracker.trackExposure(productIds)
        }
      })
      .catch(err => {
        console.error('加载个性化推荐失败:', err)
        // 降级到热门商品
        this.loadPopularProducts()
      })
  },

  /**
   * 加载热门商品（未登录或冷启动时使用）
   */
  loadPopularProducts() {
    this.setData({ recommendLoading: true })

    app.api.getPopularProducts(null, 10)
      .then(res => {
        const products = res.data || res || []
        this.setData({
          recommendList: products,
          usePersonalized: false,
          hasMoreRecommend: products.length >= 10,
          recommendLoading: false
        })
        console.log('热门商品加载完成:', products.length)
      })
      .catch(err => {
        console.error('加载热门商品失败:', err)
        this.setData({
          recommendList: [],
          recommendLoading: false
        })
      })
  },

  /**
   * 加载更多推荐（触底加载）
   */
  loadMoreRecommendations() {
    if (this.data.recommendLoading || !this.data.hasMoreRecommend) {
      return
    }

    const wxUserId = this.getWxUserId()
    if (!wxUserId) {
      return
    }

    const nextPage = this.data.recommendPage + 1
    this.setData({ recommendLoading: true })

    app.api.getYouMayLike(wxUserId, nextPage, 10)
      .then(res => {
        const data = res.data || res
        const products = data.content || data.recommendations || data || []

        // 追踪新加载商品的曝光
        if (products.length > 0) {
          const productIds = products.map(p => p.id)
          tracker.trackExposure(productIds)
        }

        this.setData({
          recommendList: [...this.data.recommendList, ...products],
          recommendPage: nextPage,
          hasMoreRecommend: products.length >= 10,
          recommendLoading: false
        })

        console.log('加载更多推荐:', {
          page: nextPage,
          newCount: products.length,
          totalCount: this.data.recommendList.length + products.length
        })
      })
      .catch(err => {
        console.error('加载更多推荐失败:', err)
        this.setData({
          recommendLoading: false,
          hasMoreRecommend: false
        })
      })
  },

  /**
   * 推荐商品点击事件
   * 记录点击行为用于强化学习反馈
   */
  onRecommendClick(e) {
    const product = e.currentTarget.dataset.product
    if (!product) return

    const wxUserId = this.getWxUserId()
    if (wxUserId && product.id) {
      // 记录推荐点击（用于Thompson Sampling强化学习）
      tracker.trackView({
        productId: product.id,
        productName: product.name,
        source: 'recommend_home',
        duration: 0  // 点击时还未浏览，时长为0
      })

      console.log('推荐商品点击:', product.id, product.name)
    }

    // 跳转到商品详情，携带来源参数
    wx.navigateTo({
      url: '/pages/goods/goods-detail/index?id=' + product.id + '&source=recommend_home'
    })
  },

  // ========== 冷启动弹窗相关方法 ==========

  /**
   * 检查是否需要显示冷启动弹窗
   * 只有首次使用的用户才会看到弹窗
   */
  checkColdStart(wxUserId) {
    if (this.data.coldStartChecked) {
      return // 已检查过，不重复检查
    }

    app.api.checkColdStart(wxUserId)
      .then(res => {
        const needsShow = res.data && res.data.needsShow
        console.log('冷启动检查结果:', needsShow)

        this.setData({
          coldStartChecked: true,
          showColdStartPopup: needsShow
        })
      })
      .catch(err => {
        console.error('检查冷启动状态失败:', err)
        this.setData({ coldStartChecked: true })
      })
  },

  /**
   * 冷启动弹窗完成/跳过回调
   */
  onColdStartComplete(e) {
    const { skipped, preferences } = e.detail

    console.log('冷启动完成:', skipped ? '已跳过' : '已设置偏好', preferences)

    // 关闭弹窗
    this.setData({ showColdStartPopup: false })

    // 如果用户设置了偏好，刷新推荐列表
    if (!skipped && preferences) {
      // 触发兴趣分析，让后端更新用户标签
      const wxUserId = this.getWxUserId()
      if (wxUserId) {
        app.api.analyzeUserInterests(wxUserId)
          .then(() => {
            console.log('已触发兴趣分析')
            // 重新加载推荐
            this.loadRecommendations()
          })
          .catch(err => {
            console.error('触发兴趣分析失败:', err)
          })
      }
    }
  }
})
