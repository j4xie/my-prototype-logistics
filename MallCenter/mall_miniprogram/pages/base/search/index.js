/**
 * 搜索页面 - 增强版
 * 包含搜索历史、热门关键词、搜索建议、高级筛选
 */
const app = getApp()
const util = require('../../../utils/util')
const tracker = require('../../../utils/tracker')

Page({
  data: {
    searchValue: '',
    searchHistory: [],
    hotKeywords: [],
    suggestions: [],
    showSuggestions: false,
    showFilter: false,
    // 高级筛选选项
    filterOptions: {
      categories: [],
      selectedCategory: null,
      priceRange: {
        min: '',
        max: ''
      },
      sortBy: 'default' // default, price_asc, price_desc, sales, newest
    },
    sortOptions: [
      { value: 'default', label: '综合排序' },
      { value: 'price_asc', label: '价格升序' },
      { value: 'price_desc', label: '价格降序' },
      { value: 'sales', label: '销量优先' },
      { value: 'newest', label: '最新上架' }
    ],
    goodsList: [],
    loadingHot: false,
    loadingSuggestions: false
  },

  onShow() {
    // 检查登录状态 - 搜索页需要登录才能访问
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
    this.loadSearchHistory()
  },

  onLoad(options) {
    app.initPage()
      .then(res => {
        this.loadHotKeywords()
        this.loadCategories()
      })
  },

  // 加载搜索历史
  loadSearchHistory() {
    const history = wx.getStorageSync('searchHistory') || []
    this.setData({ searchHistory: history })
  },

  // 加载热门关键词
  async loadHotKeywords() {
    this.setData({ loadingHot: true })
    try {
      const res = await app.api.getHotKeywords(10)
      if (res.code === 200 && res.data) {
        this.setData({ hotKeywords: res.data })
      } else {
        // 降级：使用热销商品名称
        this.loadHotGoodsAsKeywords()
      }
    } catch (error) {
      console.error('加载热门关键词失败:', error)
      this.loadHotGoodsAsKeywords()
    } finally {
      this.setData({ loadingHot: false })
    }
  },

  // 降级方案：加载热销商品作为热门关键词
  loadHotGoodsAsKeywords() {
    app.api.goodsPage({
      searchCount: false,
      current: 1,
      size: 10,
      descs: 'sale_num'
    }).then(res => {
      const goodsList = util.processGoodsList(res.data.records || [])
      this.setData({
        goodsList: goodsList,
        hotKeywords: goodsList.map(g => ({ keyword: g.name, count: g.saleNum || 0 }))
      })
    }).catch(err => {
      console.error('加载热销商品失败:', err)
    })
  },

  // 加载分类
  async loadCategories() {
    try {
      const res = await app.api.goodsCategoryGet()
      if (res.code === 200 && res.data) {
        this.setData({
          'filterOptions.categories': res.data
        })
      }
    } catch (error) {
      console.error('加载分类失败:', error)
    }
  },

  // 搜索输入
  onSearchInput(e) {
    const value = e.detail.value.trim()
    this.setData({ searchValue: value })

    if (value.length >= 2) {
      this.loadSuggestions(value)
    } else {
      this.setData({
        suggestions: [],
        showSuggestions: false
      })
    }
  },

  // 加载搜索建议
  async loadSuggestions(prefix) {
    this.setData({ loadingSuggestions: true })
    try {
      const res = await app.api.getSearchSuggestions(prefix, 5)
      if (res.code === 200 && res.data) {
        this.setData({
          suggestions: res.data,
          showSuggestions: res.data.length > 0
        })
      }
    } catch (error) {
      console.error('加载搜索建议失败:', error)
    } finally {
      this.setData({ loadingSuggestions: false })
    }
  },

  // 选择搜索建议
  selectSuggestion(e) {
    const keyword = e.currentTarget.dataset.keyword
    this.setData({
      searchValue: keyword,
      showSuggestions: false
    })
    this.doSearch(keyword)
  },

  // 执行搜索
  searchHandle(e) {
    let value = e.detail?.value || e.currentTarget?.dataset?.name || this.data.searchValue
    if (!value) return
    this.doSearch(value)
  },

  doSearch(keyword) {
    // 记录搜索历史
    this.saveSearchHistory(keyword)

    // 记录到服务端统计（旧API）
    app.api.recordSearchKeyword({ keyword }).catch(() => {})

    // 上报搜索行为到推荐系统（用于个性化推荐）
    const wxUser = app.globalData.wxUser
    if (wxUser && wxUser.id) {
      tracker.trackSearch({
        keyword: keyword,
        resultCount: 0  // 实际结果数在商品列表页获取
      })
    }

    // 构建查询参数
    const { filterOptions } = this.data
    let queryParams = `name=${encodeURIComponent(keyword)}`

    if (filterOptions.selectedCategory) {
      queryParams += `&categoryId=${filterOptions.selectedCategory}`
    }
    if (filterOptions.priceRange.min) {
      queryParams += `&priceMin=${filterOptions.priceRange.min}`
    }
    if (filterOptions.priceRange.max) {
      queryParams += `&priceMax=${filterOptions.priceRange.max}`
    }
    if (filterOptions.sortBy !== 'default') {
      queryParams += `&sort=${filterOptions.sortBy}`
    }

    // 跳转到商品列表
    wx.navigateTo({
      url: `/pages/goods/goods-list/index?${queryParams}`
    })
  },

  // 保存搜索历史
  saveSearchHistory(keyword) {
    let searchHistory = [...this.data.searchHistory]

    // 移除重复项
    searchHistory = searchHistory.filter(item => item.name !== keyword)

    // 添加到开头
    searchHistory.unshift({ name: keyword, time: Date.now() })

    // 最多保留15条
    if (searchHistory.length > 15) {
      searchHistory = searchHistory.slice(0, 15)
    }

    wx.setStorageSync('searchHistory', searchHistory)
    this.setData({ searchHistory })
  },

  // 清除单条历史
  clearSingleHistory(e) {
    const index = e.currentTarget.dataset.index
    let searchHistory = [...this.data.searchHistory]
    searchHistory.splice(index, 1)
    wx.setStorageSync('searchHistory', searchHistory)
    this.setData({ searchHistory })
  },

  // 清除全部历史
  clearSearchHistory() {
    wx.showModal({
      content: '确认删除全部历史记录？',
      cancelText: '我再想想',
      confirmColor: '#ff0000',
      success: (res) => {
        if (res.confirm) {
          wx.setStorageSync('searchHistory', [])
          this.setData({ searchHistory: [] })
        }
      }
    })
  },

  // 切换高级筛选面板
  toggleFilter() {
    this.setData({
      showFilter: !this.data.showFilter
    })
  },

  // 选择分类
  selectCategory(e) {
    const categoryId = e.currentTarget.dataset.id
    const currentSelected = this.data.filterOptions.selectedCategory
    this.setData({
      'filterOptions.selectedCategory': currentSelected === categoryId ? null : categoryId
    })
  },

  // 设置价格区间
  onPriceMinInput(e) {
    this.setData({
      'filterOptions.priceRange.min': e.detail.value
    })
  },

  onPriceMaxInput(e) {
    this.setData({
      'filterOptions.priceRange.max': e.detail.value
    })
  },

  // 选择排序方式
  selectSort(e) {
    const sortBy = e.currentTarget.dataset.sort
    this.setData({
      'filterOptions.sortBy': sortBy
    })
  },

  // 重置筛选
  resetFilter() {
    this.setData({
      filterOptions: {
        categories: this.data.filterOptions.categories,
        selectedCategory: null,
        priceRange: { min: '', max: '' },
        sortBy: 'default'
      }
    })
  },

  // 应用筛选
  applyFilter() {
    this.setData({ showFilter: false })
    if (this.data.searchValue) {
      this.doSearch(this.data.searchValue)
    }
  },

  // 点击热门关键词
  onHotKeywordTap(e) {
    const keyword = e.currentTarget.dataset.keyword
    this.setData({ searchValue: keyword })
    this.doSearch(keyword)
  },

  // 隐藏搜索建议
  hideSuggestions() {
    setTimeout(() => {
      this.setData({ showSuggestions: false })
    }, 200)
  }
})
