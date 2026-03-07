/**
 * Copyright (C) 2024-2025
 * 食品商城小程序
 * 注意：
 * 基于 JooLun 框架二次开发
 */
const app = getApp()
const tracker = require('../../utils/tracker')
const util = require('../../utils/util')

Page({
  data: {
    config: app.globalData.config,
    // ========== 动态装修配置 ==========
    pageConfig: null,           // 页面装修配置
    cssVariablesStyle: '',      // CSS变量样式字符串
    renderModules: [],          // 动态模块渲染列表(排序后)
    moduleData: {},             // 各模块的数据(categoryList, swiperData等)
    configLoaded: false,        // 配置是否已加载
    logoUrl: '',                // 店铺Logo
    shopName: '',               // 店铺名称
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
    // ========== 功能开关 (通过后端配置控制) ==========
    showAiAssistant: false,      // 是否显示AI助手入口
    showCategories: true,        // 是否显示首页分类网格
    showProducts: true,          // 是否显示首页商品列表
    showCategoryTab: true,       // 是否显示底部分类Tab
    // ========== 首页分类 ==========
    categoryList: [],            // 动态分类列表（从后端获取）
    // ========== 新模块数据 ==========
    countdownData: { hours: '00', minutes: '00', seconds: '00' }
  },

  // 启动广告定时器
  splashAdTimer: null,
  // 倒计时定时器
  countdownTimer: null,
  onLoad() {
    // 加载页面装修配置
    this.loadPageConfig()

    app.initPage()
      .then(res => {
        // 检查登录状态
        this.checkLoginStatus()
        // 加载数据
        this.loadData()
        this.loadBanners()
        // 加载功能配置（控制AI、分类、商品显示）
        this.loadFeatureConfig()
        // 加载首页分类
        this.loadCategories()
        // 加载个性化推荐
        this.loadRecommendations()
        // 延迟显示启动广告
        setTimeout(() => {
          this.loadSplashAd()
        }, 800)
      })
  },
  // onShow is defined below onHide with countdown resume logic
  loadData(){
    this.goodsNew()
    this.goodsHot()
    this.goodsPage()
  },
  onShareAppMessage: function () {
    let title = (this.data.shopName || '商城') + ' - 欢迎光临'
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
        let goodsListNew = util.processGoodsList(res.data.records)
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
        let goodsListHot = util.processGoodsList(res.data.records)
        this.setData({
          goodsListHot: goodsListHot,
          'moduleData.goodsListHot': goodsListHot
        })
      })
  },
  goodsPage(e) {
    app.api.goodsPage(this.data.page)
      .then(res => {
        let goodsList = util.processGoodsList(res.data.records)
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
  // 加载更多商品（触底加载，追加到当前显示列表）
  loadMoreProducts() {
    app.api.goodsPage(this.data.page)
      .then(res => {
        let products = util.processGoodsList(res.data.records)
        if (this.data.recommendList.length > 0) {
          // recommendList 正在显示，追加到 recommendList
          this.setData({
            recommendList: [...this.data.recommendList, ...products]
          })
        } else {
          // 普通模式，追加到 goodsList
          this.setData({
            goodsList: [...this.data.goodsList, ...products]
          })
        }
        if (products.length < this.data.page.size) {
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
      // 加载更多普通商品
      this.setData({
        ['page.current']: this.data.page.current + 1
      })
      this.loadMoreProducts()
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
  // 加载首页分类（从后端动态获取）
  loadCategories() {
    app.api.goodsCategoryGet()
      .then(res => {
        if (res.data && res.data.length > 0) {
          let categories = res.data.filter(item => item.enable === '1' || item.enable === 1)
          if (categories.length > 9) {
            categories = categories.slice(0, 9)
          }
          this.setData({
            categoryList: categories,
            'moduleData.categoryList': categories
          })
          console.log('首页分类加载完成:', categories.length)
        }
      })
      .catch(err => {
        console.error('加载首页分类失败:', err)
      })
  },

  /**
   * 加载页面装修配置
   * 解析 modulesConfig 驱动动态首页渲染
   */
  async loadPageConfig() {
    try {
      const res = await app.api.getDecorationConfig('home')

      if (res.data && res.data.theme) {
        const config = res.data
        const cssVars = this.generateCssVariables(config.theme)

        // 解析模块配置：后端返回 modules 数组，为空则使用默认布局
        let modules = config.modules && config.modules.length > 0
          ? config.modules
          : this.getDefaultModules()

        // 按 order 排序
        modules = modules.sort((a, b) => (a.order || 0) - (b.order || 0))

        // 通知栏文字：优先 modules 里的 props.texts，其次 config.noticeTexts
        const noticeTexts = config.noticeTexts
          ? (typeof config.noticeTexts === 'string' ? JSON.parse(config.noticeTexts) : config.noticeTexts)
          : null

        this.setData({
          pageConfig: config,
          cssVariablesStyle: cssVars,
          renderModules: modules,
          moduleData: {
            noticeTexts: noticeTexts || ['欢迎光临', '优质好物，尽在商城'],
            couponList: [],
            newArrivalsList: [],
            countdownData: { hours: '00', minutes: '00', seconds: '00' }
          },
          configLoaded: true,
          logoUrl: config.logoUrl || '',
          shopName: config.shopName || ''
        })

        // 按需加载新模块数据
        this.loadModuleData(modules)

        console.log('页面装修配置加载完成:', {
          theme: 'loaded',
          modulesCount: modules.length,
          fromDb: config.modules && config.modules.length > 0
        })
        return
      }
    } catch (err) {
      console.warn('页面装修配置加载失败，使用默认:', err)
    }

    // 降级：使用默认模块布局
    const defaultModules = this.getDefaultModules()
    this.setData({
      renderModules: defaultModules,
      moduleData: {
        noticeTexts: ['欢迎光临', '优质好物，尽在商城'],
        couponList: [],
        newArrivalsList: [],
        countdownData: { hours: '00', minutes: '00', seconds: '00' }
      },
      configLoaded: true
    })
    console.log('使用默认装修配置')
  },

  /**
   * 默认模块列表 — 与当前硬编码布局完全一致
   */
  getDefaultModules() {
    return [
      { id: 'def_1', type: 'header', visible: true, order: 0, props: { showSearch: true, showLogo: true } },
      { id: 'def_2', type: 'notice_bar', visible: true, order: 1, props: { texts: ['欢迎光临', '优质好物，尽在商城'], interval: 4000 } },
      { id: 'def_3', type: 'banner', visible: true, order: 2, props: { autoplay: true, interval: 5000 } },
      { id: 'def_4', type: 'category_grid', visible: true, order: 3, props: { columns: 4 } },
      { id: 'def_5', type: 'quick_actions', visible: true, order: 4, props: {} },
      { id: 'def_6', type: 'product_scroll', visible: true, order: 5, props: { title: '热销单品' } },
      { id: 'def_7', type: 'product_grid', visible: true, order: 6, props: { title: '猜你喜欢', columns: 2 } },
      { id: 'def_8', type: 'ai_float', visible: true, order: 99, props: {} }
    ]
  },

  /**
   * 生成CSS变量样式字符串
   * @param {Object} theme - 主题配置对象
   * @returns {string} CSS变量样式字符串
   */
  generateCssVariables(theme) {
    if (!theme) return ''

    const vars = []

    // 主色调
    if (theme.primaryColor) {
      vars.push(`--primary-gold: ${theme.primaryColor}`)
      vars.push(`--primary-color: ${theme.primaryColor}`)
    }

    // 次要色调/深色背景
    if (theme.secondaryColor) {
      vars.push(`--dark-bg: ${theme.secondaryColor}`)
      vars.push(`--secondary-color: ${theme.secondaryColor}`)
    }

    // 背景色
    if (theme.backgroundColor) {
      vars.push(`--background: ${theme.backgroundColor}`)
      vars.push(`--page-bg: ${theme.backgroundColor}`)
    }

    // 文字颜色
    if (theme.textColor) {
      vars.push(`--text-color: ${theme.textColor}`)
    }

    // 次要文字颜色
    if (theme.textSecondaryColor) {
      vars.push(`--text-secondary: ${theme.textSecondaryColor}`)
    }

    // 边框颜色
    if (theme.borderColor) {
      vars.push(`--border-color: ${theme.borderColor}`)
      vars.push(`--border-gold: ${theme.borderColor}`)
    }

    // 强调色
    if (theme.accentColor) {
      vars.push(`--accent-color: ${theme.accentColor}`)
    }

    // 卡片背景色
    if (theme.cardBackground) {
      vars.push(`--card-bg: ${theme.cardBackground}`)
    }

    // 主色深色变体 (用于渐变)
    if (theme.headerGradientEnd || theme.secondaryColor) {
      vars.push(`--primary-dark: ${theme.headerGradientEnd || theme.secondaryColor}`)
    }

    // 通知栏颜色
    if (theme.backgroundColor) {
      vars.push(`--notice-bg: ${theme.backgroundColor}`)
    }
    if (theme.textColor) {
      vars.push(`--notice-text: ${theme.textColor}`)
    }

    return vars.join('; ')
  },

  // 从全局读取功能配置（app.js 已在 onLaunch 加载）
  loadFeatureConfig() {
    var self = this
    var applyFlags = function (flags) {
      self.setData({
        showAiAssistant: flags.showAI === true,
        showCategories: flags.showCategories !== false,
        showProducts: flags.showProducts !== false,
        showCategoryTab: flags.showCategoryTab !== false
      })
      if (flags.showCategoryTab === false) {
        wx.hideTabBarItem({ index: 1 })
      }
      // 根据功能开关过滤装修模块
      var hideTypes = []
      if (flags.showCategories === false) {
        hideTypes.push('category_grid')
      }
      if (flags.showProducts === false) {
        hideTypes.push('product_scroll', 'product_grid', 'new_arrivals')
      }
      if (hideTypes.length > 0) {
        var modules = self.data.renderModules || []
        var filtered = modules.filter(function (m) {
          return hideTypes.indexOf(m.type) === -1
        })
        self.setData({ renderModules: filtered })
      }
    }
    app.onFeatureReady(applyFlags)
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
            swiperData: swiperData,
            'moduleData.swiperData': swiperData
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
        const fallback = ['/public/img/banner_1.jpg', '/public/img/banner_2.jpg', '/public/img/banner_3.jpg']
        this.setData({
          swiperData: fallback,
          'moduleData.swiperData': fallback
        })
      })
  },
  // Banner轮播切换
  onBannerChange(e) {
    let current = e.detail.current
    let bannerList = this.data.bannerList
    if (bannerList[current] && bannerList[current].id) {
      //app.api.recordAdView(bannerList[current].id)
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
  // 广告图片点击
  onImageAdClick(e) {
    const link = e.currentTarget.dataset.link
    if (link) {
      wx.navigateTo({ url: link })
    }
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

  // ========== 新模块数据加载 ==========

  /**
   * 按需加载模块数据（倒计时、优惠券、新品）
   */
  loadModuleData(modules) {
    if (!modules || modules.length === 0) return

    const types = modules.filter(m => m.visible !== false).map(m => m.type)

    // 倒计时模块
    if (types.includes('countdown')) {
      const cdModule = modules.find(m => m.type === 'countdown' && m.visible !== false)
      const endTime = cdModule && cdModule.props && cdModule.props.endTime
      if (endTime) {
        this.startCountdown(endTime)
      } else {
        // 默认2小时后结束
        const defaultEnd = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        this.startCountdown(defaultEnd)
      }
    }

    // 优惠券模块
    if (types.includes('coupon')) {
      this.loadCouponList()
    }

    // 分销裂变入口
    if (types.includes('referral_banner')) {
      this.loadReferralData()
    }

    // 新品推荐模块
    if (types.includes('new_arrivals')) {
      this.loadNewArrivals()
    }
  },

  /**
   * 倒计时
   */
  startCountdown(endTime) {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer)
    }

    const target = new Date(endTime).getTime()

    const update = () => {
      const diff = Math.max(0, target - Date.now())
      const hours = String(Math.floor(diff / 3600000)).padStart(2, '0')
      const minutes = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0')
      const seconds = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0')

      this.setData({
        'moduleData.countdownData': { hours, minutes, seconds }
      })

      if (diff <= 0 && this.countdownTimer) {
        clearInterval(this.countdownTimer)
        this.countdownTimer = null
      }
    }

    update()
    this.countdownTimer = setInterval(update, 1000)
  },

  /**
   * 加载优惠券列表
   */
  loadCouponList() {
    const config = app.globalData.config
    // 使用公开接口，不需要登录即可展示
    wx.request({
      url: config.basePath + '/weixin/api/ma/coupon/public/list',
      method: 'GET',
      data: { limit: 10 },
      header: {
        'app-id': wx.getAccountInfoSync().miniProgram.appId
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.code === 200 && res.data.data) {
          const coupons = res.data.data.map(c => {
            const item = { ...c }
            // 过期倒计时
            if (c.endTime || c.expireTime) {
              const end = new Date(c.endTime || c.expireTime).getTime()
              const diff = end - Date.now()
              if (diff > 0 && diff < 3 * 24 * 60 * 60 * 1000) {
                const hours = Math.floor(diff / (60 * 60 * 1000))
                item.expiryText = hours < 24 ? `${hours}小时后过期` : `${Math.ceil(hours / 24)}天后过期`
              }
            }
            // 已领取状态
            if (c.received || c.claimed) {
              item.claimed = true
            }
            // 新人券标记
            if (c.isNewUser || c.couponType === 'NEW_USER') {
              item.isNewUser = true
            }
            return item
          })
          this.setData({ 'moduleData.couponList': coupons })
        } else {
          this.setData({ 'moduleData.couponList': [] })
        }
      },
      fail: () => {
        this.setData({ 'moduleData.couponList': [] })
      }
    })
  },

  /**
   * 领取优惠券
   */
  claimCoupon(e) {
    const couponId = e.currentTarget.dataset.id
    if (!couponId) return

    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    const config = app.globalData.config
    wx.request({
      url: config.basePath + '/weixin/api/ma/coupon/' + couponId + '/receive',
      method: 'POST',
      header: {
        'app-id': wx.getAccountInfoSync().miniProgram.appId,
        'third-session': app.globalData.thirdSession || ''
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.code === 200) {
          wx.showToast({ title: '领取成功', icon: 'success' })
          // 立即标记已领取，再刷新列表
          const list = this.data.moduleData.couponList || []
          const idx = list.findIndex(c => c.id === couponId)
          if (idx >= 0) {
            this.setData({ [`moduleData.couponList[${idx}].claimed`]: true })
          }
          this.loadCouponList()
        } else {
          wx.showToast({ title: res.data.msg || '领取失败', icon: 'none' })
        }
      },
      fail: () => {
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
    })
  },

  /**
   * 加载分销数据
   */
  loadReferralData() {
    if (!this.data.isLoggedIn) {
      this.setData({ 'moduleData.referralData': { totalInvites: 0, totalReward: '0.00' } })
      return
    }
    const config = app.globalData.config
    wx.request({
      url: config.basePath + '/weixin/api/ma/referral/my-stats',
      method: 'GET',
      header: {
        'app-id': wx.getAccountInfoSync().miniProgram.appId,
        'third-session': app.globalData.thirdSession || ''
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.code === 200 && res.data.data) {
          this.setData({ 'moduleData.referralData': res.data.data })
        } else {
          this.setData({ 'moduleData.referralData': { totalInvites: 0, totalReward: '0.00' } })
        }
      },
      fail: () => {
        this.setData({ 'moduleData.referralData': { totalInvites: 0, totalReward: '0.00' } })
      }
    })
  },

  /**
   * 分享裂变
   */
  onShareReferral() {
    // 触发微信分享由 open-type="share" 处理，这里可做埋点
  },

  /**
   * 加载新品推荐
   */
  loadNewArrivals() {
    const util = require('../../utils/util')
    app.api.goodsPage({
      searchCount: false,
      current: 1,
      size: 8,
      descs: 'create_time'
    })
      .then(res => {
        const list = util.processGoodsList(res.data.records)
        this.setData({
          'moduleData.newArrivalsList': list
        })
      })
      .catch(err => {
        console.error('加载新品失败:', err)
        this.setData({ 'moduleData.newArrivalsList': [] })
      })
  },

  onHide() {
    // 暂停倒计时和广告定时器，避免后台空转
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer)
      this._countdownPaused = true
    }
    if (this.splashAdTimer) {
      clearInterval(this.splashAdTimer)
      this._splashAdPaused = true
    }
  },

  onShow(){
    //更新tabbar购物车数量
    wx.setTabBarBadge({
      index: 2,
      text: app.globalData.shoppingCartCount + ''
    })
    // 重新检查登录状态（用户可能在其他页面登录）
    this.checkLoginStatus()

    // 恢复倒计时定时器
    if (this._countdownPaused) {
      this._countdownPaused = false
      const modules = this.data.renderModules || []
      const cdModule = modules.find(m => m.type === 'countdown' && m.visible !== false)
      const endTime = cdModule && cdModule.props && cdModule.props.endTime
      if (endTime) {
        this.startCountdown(endTime)
      }
    }
  },

  onUnload() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer)
      this.countdownTimer = null
    }
    if (this.splashAdTimer) {
      clearInterval(this.splashAdTimer)
      this.splashAdTimer = null
    }
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
        const products = util.processGoodsList(data.recommendations || data || [])
        // 添加默认值容错：后端可能未返回 coldStartState
        const coldStartState = (data.coldStartState != null) ? data.coldStartState : 'cold_start'

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
        const products = util.processGoodsList(res.data || res || [])
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
        const products = util.processGoodsList(data.content || data.recommendations || data || [])

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
