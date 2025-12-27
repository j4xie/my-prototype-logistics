/**
 * Copyright (C) 2024-2025
 * 食品商城小程序
 * 注意：
 * 基于 JooLun 框架二次开发
 */
const util = require('../../../utils/util.js')
const app = getApp()
const tracker = require('../../../utils/tracker')

Page({
  data: {
    page: {
      searchCount: false,
      current: 1,
      size: 10,
      ascs: '',//升序字段
      descs: ''
    },
    parameter: {},
    loadmore: true,
    goodsList: [],
    viewType: true,
    price: '',
    sales: '',
    createTime: '',
    title: '',
    // 无结果处理相关
    noResult: false,
    searchKeyword: '',
    keywordRecorded: false,
    showAiTip: false,
    // 推荐追踪相关
    source: '',           // 来源标记 (recommend/category/search/hot/new)
    exposureTracked: false // 是否已追踪曝光
  },
  onShow() {
    // 检查登录状态 - 商品列表页需要登录才能访问
    const wxUser = app.globalData.wxUser
    if (!wxUser || !wxUser.id) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 1500
      })
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/home/index'
        })
      }, 500)
      return
    }
  },
  onLoad(options) {
    let title = options.title ? decodeURI(options.title) : '默认'
    this.setData({
      title: title
    })
    if (options.categorySecond){
      this.setData({
        ['parameter.categorySecond']: options.categorySecond
      })
    }
    if (options.name) {
      this.setData({
        ['parameter.name']: options.name,
        searchKeyword: options.name
      })
    }
    if (options.type) {
      if (options.type == '1'){
        this.setData({
          title: '新品首发',
          ['page.descs']: 'create_time'
        })
      }
      if (options.type == '2') {
        this.setData({
          title: '热销单品',
          ['page.descs']: 'sale_num'
        })
      }
    }
    if (options.couponUserId) {
      this.setData({
        ['parameter.couponUserId']: options.couponUserId
      })
    }
    // 处理来源标记（用于推荐追踪）
    if (options.source) {
      this.setData({
        source: options.source
      })
    } else {
      // 根据参数推断来源
      let inferredSource = 'direct'
      if (options.name) {
        inferredSource = 'search'
      } else if (options.categorySecond) {
        inferredSource = 'category'
      } else if (options.type == '1') {
        inferredSource = 'new'
      } else if (options.type == '2') {
        inferredSource = 'hot'
      }
      this.setData({
        source: inferredSource
      })
    }
    app.initPage()
      .then(res => {
        this.goodsPage()
      })
  },
  goodsPage() {
    app.api.goodsPage(Object.assign(
      {},
      this.data.page,
      util.filterForm(this.data.parameter)
    ))
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
        // 检测无结果情况
        if (this.data.goodsList.length === 0 && this.data.searchKeyword && this.data.page.current === 1) {
          this.handleNoResult()
        } else {
          this.setData({
            noResult: false
          })
        }
        // 追踪商品曝光（首次加载时）
        if (goodsList.length > 0 && this.data.page.current === 1) {
          this.trackProductExposure(goodsList)
        }
      })
  },
  // 追踪商品曝光
  trackProductExposure(products) {
    const wxUser = app.globalData.wxUser
    if (!wxUser || !wxUser.id) return

    const productIds = products.map(p => p.id).filter(Boolean)
    if (productIds.length > 0) {
      tracker.trackExposure(productIds)
    }
  },
  // 处理无搜索结果
  handleNoResult() {
    this.setData({
      noResult: true
    })
    // 记录无结果搜索关键词
    if (this.data.searchKeyword && !this.data.keywordRecorded) {
      app.api.recordSearchKeyword({
        keyword: this.data.searchKeyword,
        resultCount: 0
      }).then(res => {
        if (res.code === 200) {
          this.setData({
            keywordRecorded: true,
            showAiTip: true
          })
          // 3秒后隐藏提示
          setTimeout(() => {
            this.setData({
              showAiTip: false
            })
          }, 3000)
        }
      }).catch(err => {
        console.log('记录搜索关键词失败', err)
      })
    }
  },
  // 跳转到AI助手
  goToAiChat() {
    wx.navigateTo({
      url: '/pages/ai-rag/chat/index?keyword=' + encodeURIComponent(this.data.searchKeyword)
    })
  },
  viewTypeEdit(){
    this.setData({
      viewType: !this.data.viewType
    })
  },
  onReachBottom() {
    if (this.data.loadmore) {
      this.setData({
        ['page.current']: this.data.page.current + 1
      })
      this.goodsPage()
    }
  },
  sortHandle(e){
    let type = e.target.dataset.type
    switch (type) {
      case 'price':
        if (this.data.price == ''){
          this.setData({
            price: 'asc',
            ['page.descs']: '',
            ['page.ascs']: 'sales_price'
          })
        } else if (this.data.price == 'asc'){
          this.setData({
            price: 'desc',
            ['page.descs']: 'sales_price',
            ['page.ascs']: ''
          })
        } else if (this.data.price == 'desc'){
          this.setData({
            price: '',
            ['page.ascs']: '',
            ['page.descs']: ''
          })
        }
        this.setData({
          sales: '',
          createTime: ''
        })
        break
      case 'sales':
        if (this.data.sales == ''){
          this.setData({
            sales: 'desc',
            ['page.descs']: 'sale_num',
            ['page.ascs']: ''
          })
        }else if (this.data.sales == 'desc'){
          this.setData({
            sales: 'asc',
            ['page.descs']: '',
            ['page.ascs']: 'sale_num'
          })
        }else if (this.data.sales == 'asc'){
          this.setData({
            sales: '',
            ['page.ascs']: '',
            ['page.descs']: ''
          })
        }
        this.setData({
          price: '',
          createTime: ''
        })
        break
      case 'createTime':
        if (this.data.createTime == ''){
          this.setData({
            createTime: 'desc',
            ['page.descs']: 'create_time',
            ['page.ascs']: ''
          })
        }else if (this.data.createTime == 'desc'){
          this.setData({
            createTime: '',
            ['page.ascs']: '',
            ['page.descs']: ''
          })
        }
        this.setData({
          price: '',
          sales: ''
        })
        break
    }
    this.relod()
  },
  relod(){
    this.setData({
      loadmore: true,
      goodsList: [],
      ['page.current']: 1
    })
    this.goodsPage()
  }
})
