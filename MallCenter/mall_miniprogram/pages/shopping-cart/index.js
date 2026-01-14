/**
 * Copyright (C) 2024-2025
 * 食品商城小程序
 * 注意：
 * 基于 JooLun 框架二次开发
 */
const app = getApp()
const util = require('../../utils/util')
const tracker = require('../../utils/tracker')

Page({
  data: {
    config: app.globalData.config,
    page: {
      current: 1,
      size: 50,
      ascs: '',//升序字段
      descs: 'create_time'
    },
    parameter: {},
    loadmore: true,
    operation: true,
    shoppingCartData: [],
    shoppingCartDataInvalid: [],
    isAllSelect: false,//全选
    selectValue: [],
    settlePrice: 0, //结算金额
    goodsSpu: [],
    shoppingCartSelect: [],
    // 推荐商品相关
    goodsListRecom: [],
    cartRecommendLoaded: false  // 标记是否使用购物车个性化推荐
  },
  onShow() {
    // 检查登录状态 - 购物车页需要登录才能访问
    const wxUser = app.globalData.wxUser
    if (!wxUser || !wxUser.id) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 1500
      })
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/auth/login/index'
        })
      }, 500)
      return
    }

    //更新tabbar购物车数量
    wx.setTabBarBadge({
      index: 2,
      text: app.globalData.shoppingCartCount + ''
    })
    app.initPage()
      .then(res => {
        this.shoppingCartPage()
      })
  },
  onLoad: function () {
    app.initPage()
      .then(res => {
        this.goodsRecom()
      })
  },
  //管理按键事件
  operation() {
    this.setData({
      operation: !this.data.operation
    })
    this.checkboxHandle(this.data.selectValue)
  },
  //加载数据
  shoppingCartPage(){
    app.api.shoppingCartPage(this.data.page)
      .then(res => {
        //更新购物车数量
        app.globalData.shoppingCartCount = res.data.total + ''
        wx.setTabBarBadge({
          index: 2,
          text: app.globalData.shoppingCartCount + ''
        })

        let shoppingCartData = []
        //过滤出失效商品
        let shoppingCartDataInvalid = []
        res.data.records.forEach(function (shoppingCart, index) {
          // 处理商品图片URL格式
          if (shoppingCart.goodsSpu) {
            shoppingCart.goodsSpu = util.processGoodsItem(shoppingCart.goodsSpu)
          }
          if (!shoppingCart.goodsSpu || shoppingCart.goodsSpu.shelf == '0'){//下架或删除了
            shoppingCartDataInvalid.push(shoppingCart)
          }else{
            shoppingCartData.push(shoppingCart)
          }
        })
        this.setData({
          shoppingCartData: shoppingCartData,
          shoppingCartDataInvalid: shoppingCartDataInvalid,
          loadmore: false
        })
        let selectValue = this.data.selectValue
        if (selectValue.length > 0) {
          this.checkboxHandle(selectValue)
        }
        // 购物车数据加载后，刷新个性化推荐
        this.goodsRecom()
      })
  },
  //推荐商品（基于购物车的个性化推荐）
  goodsRecom() {
    const wxUser = app.globalData.wxUser
    const wxUserId = wxUser ? wxUser.id : null

    // 获取购物车中的商品ID列表
    const cartProductIds = this.data.shoppingCartData
      .filter(item => item.goodsSpu && item.goodsSpu.id)
      .map(item => item.goodsSpu.id)

    if (wxUserId && cartProductIds.length > 0) {
      // 有登录且购物车有商品时，使用购物车推荐API
      // P1修复: API期望对象参数，不是3个独立参数
      app.api.getCartRecommend({ wxUserId, cartProductIds, limit: 6 })
        .then(res => {
          const products = util.processGoodsList(res.data || res || [])
          this.setData({
            goodsListRecom: products,
            cartRecommendLoaded: true
          })

          // 追踪推荐商品曝光
          if (products.length > 0) {
            const productIds = products.map(p => p.id)
            tracker.trackExposure(productIds)
          }
        })
        .catch(err => {
          console.error('加载购物车推荐失败:', err)
          // 降级到普通推荐
          this.loadDefaultRecommendations()
        })
    } else {
      // 未登录或购物车为空时，使用默认推荐
      this.loadDefaultRecommendations()
    }
  },

  // 加载默认推荐商品（降级方案）
  loadDefaultRecommendations() {
    app.api.goodsPage({
      searchCount: false,
      current: 1,
      size: 6,
      descs: 'sale_num'  // 按销量排序
    })
      .then(res => {
        let goodsListRecom = util.processGoodsList(res.data.records || [])
        this.setData({
          goodsListRecom: goodsListRecom
        })
      })
      .catch(err => {
        console.error('加载默认推荐失败:', err)
        this.setData({ goodsListRecom: [] })
      })
  },

  // 推荐商品点击事件（用于推荐反馈）
  onRecommendClick(e) {
    const product = e.currentTarget.dataset.product
    if (!product) return

    const wxUser = app.globalData.wxUser
    if (wxUser && wxUser.id && product.id) {
      tracker.trackView({
        productId: product.id,
        productName: product.name,
        source: 'cart_recommend',
        duration: 0
      })
    }

    // 跳转到商品详情
    wx.navigateTo({
      url: '/pages/goods/goods-detail/index?id=' + product.id
    })
  },
  //数量变化
  cartNumChang(e) {
    let index = e.target.dataset.index
    let shoppingCart = this.data.shoppingCartData[index]
    let quantity = Number(e.detail)
    this.setData({
      [`shoppingCartData[${index}].quantity`]: quantity
    })
    this.shoppingCartEdit({
      id: shoppingCart.id,
      quantity: quantity
    })
    this.countSelect()
  },
  shoppingCartEdit(parm){
    app.api.shoppingCartEdit(parm)
  },
  //收藏 - 将选中的商品移入收藏夹
  userCollectAdd() {
    let selectValue = this.data.selectValue
    let shoppingCartData = this.data.shoppingCartData

    if (selectValue.length <= 0) {
      wx.showToast({
        title: '请先选择商品',
        icon: 'none'
      })
      return
    }

    // 获取已收藏的商品
    let collections = wx.getStorageSync('userCollections') || []
    let addCount = 0

    // 将选中商品添加到收藏
    shoppingCartData.forEach((shoppingCart) => {
      if (selectValue.indexOf(shoppingCart.id) > -1 && shoppingCart.goodsSpu) {
        const goods = shoppingCart.goodsSpu
        // 检查是否已收藏
        const existIndex = collections.findIndex(item => item.spuId === goods.id)
        if (existIndex === -1) {
          // 添加到收藏
          collections.unshift({
            spuId: goods.id,
            spuName: goods.name,
            picUrl: goods.picUrls ? goods.picUrls[0] : '',
            salesPrice: goods.salesPrice,
            collectTime: new Date().getTime()
          })
          addCount++
        }
      }
    })

    // 限制收藏数量最多100个
    if (collections.length > 100) {
      collections = collections.slice(0, 100)
    }

    // 保存到本地存储
    wx.setStorageSync('userCollections', collections)

    if (addCount > 0) {
      let that = this
      wx.showModal({
        title: '收藏成功',
        content: `已将${addCount}件商品移入收藏夹，是否从购物车删除？`,
        confirmText: '删除',
        cancelText: '保留',
        success: (res) => {
          if (res.confirm) {
            // 删除购物车中的选中商品
            app.api.shoppingCartDel(selectValue)
              .then(() => {
                that.setData({
                  selectValue: [],
                  isAllSelect: false,
                  settlePrice: 0
                })
                that.shoppingCartPage()
              })
          } else {
            that.setData({
              selectValue: [],
              isAllSelect: false
            })
            that.checkboxHandle([])
          }
        }
      })
    } else {
      wx.showToast({
        title: '已在收藏夹中',
        icon: 'none'
      })
    }
  },
  shoppingCartDel(){
    let selectValue = this.data.selectValue
    let that = this
    if (selectValue.length > 0){
      wx.showModal({
        content: '确认将这' + selectValue.length+'个宝贝删除',
        cancelText: '我再想想',
        confirmColor: '#ff0000',
        success(res) {
          if (res.confirm) {
            app.api.shoppingCartDel(selectValue)
              .then(res => {
                that.setData({
                  selectValue: [],
                  isAllSelect: false,
                  settlePrice: 0
                })
                that.shoppingCartPage()
              })
          }
        }
      })
    }
  },
  clearInvalid(){
    let selectValue = []
    let that = this
    this.data.shoppingCartDataInvalid.forEach(function (shoppingCart, index) {
      selectValue.push(shoppingCart.id)
    })
    wx.showModal({
      content: '确认清空失效的宝贝吗',
      cancelText: '我再想想',
      confirmColor: '#ff0000',
      success(res) {
        if (res.confirm) {
          app.api.shoppingCartDel(selectValue)
            .then(res => {
              that.setData({
                shoppingCartDataInvalid: []
              })
            })
        }
      }
    })
  },
  checkboxHandle(selectValue){
    let that = this
    let shoppingCartData = this.data.shoppingCartData
    let isAllSelect = false
    if (shoppingCartData.length == selectValue.length) { isAllSelect = true }
    if (selectValue.length > 0) {
      let shoppingCartIds = []
      shoppingCartData.forEach(function (shoppingCart, index) {
        shoppingCartIds.push(shoppingCart.id)
        let selectValueIndex = selectValue.indexOf(shoppingCart.id)
        if (selectValueIndex > -1) {
          if (!that.data.operation){
            shoppingCart.checked = true
          }else{//如果是购买操作，需过滤不符商品
            if (shoppingCart.goodsSpu && shoppingCart.quantity <= shoppingCart.goodsSpu.stock) {
              shoppingCart.checked = true
            } else {
              shoppingCart.checked = false
              selectValue.splice(selectValueIndex, 1)
            }
          }
        } else {
          shoppingCart.checked = false
        }
      })
      selectValue.forEach(function (obj, index) {
        if (shoppingCartIds.indexOf(obj) <= -1) {
          selectValue.splice(index, 1)
        }
      })
    }else{
      shoppingCartData.forEach(function (shoppingCart, index) {
        shoppingCart.checked = false
      })
    }
    this.setData({
      shoppingCartData: shoppingCartData,
      isAllSelect: isAllSelect,
      selectValue: selectValue
    })
    this.countSelect()
  },
  checkboxChange: function (e) {
    this.checkboxHandle(e.detail.value)
  },
  checkboxAllChange(e) {
    var value = e.detail.value;
    if (value.length > 0) { 
      this.setAllSelectValue(true) 
    }else { 
      this.setAllSelectValue(false) 
    }
  },
  setAllSelectValue(status) {
    let shoppingCartData = this.data.shoppingCartData
    let selectValue = []
    let that = this
    if (shoppingCartData.length > 0) {
      if (status) {
        shoppingCartData.forEach(function (shoppingCart, index) {
          if (!that.data.operation) {
            selectValue.push(shoppingCart.id)
          } else {//如果是购买操作，需过滤不符商品
            if (shoppingCart.goodsSpu
              && shoppingCart.quantity <= shoppingCart.goodsSpu.stock) {
              selectValue.push(shoppingCart.id)
            }
          } 
        })
      }
      this.checkboxHandle(selectValue)
    }
  },
  //计算结算值
  countSelect() {
    let selectValue = this.data.selectValue
    let settlePrice = 0
    if (selectValue.length <= 0) { 
      this.setData({ 
        settlePrice: settlePrice
      }) 
    }else {
      this.data.shoppingCartData.forEach(function (shoppingCart, index) {
        if (selectValue.indexOf(shoppingCart.id) > -1 
            && shoppingCart.goodsSpu 
          && shoppingCart.quantity <= shoppingCart.goodsSpu.stock) {
          settlePrice = Number(settlePrice) + Number(shoppingCart.quantity) * Number(shoppingCart.goodsSpu.salesPrice)
        }
      })
      this.setData({ 
        settlePrice: settlePrice.toFixed(2) 
      })
    }
  },
  //更换规格
  changeSpecs(e){
   
  },
  goodsGet(id) {
    app.api.goodsGet(id)
      .then(res => {
        let goodsSpu = res.data
        this.setData({
          goodsSpu: goodsSpu
        })
      })
  },
  operateCartEvent() {
    this.shoppingCartPage()
  },
  //结算
  orderConfirm(){
    let params = []
    let shoppingCartData = this.data.shoppingCartData
    shoppingCartData.forEach(function (shoppingCart, index) {
      if (shoppingCart.checked && shoppingCart.goodsSpu 
        && shoppingCart.goodsSpu && shoppingCart.goodsSpu.shelf == '1'
        && shoppingCart.quantity <= shoppingCart.goodsSpu.stock){
        let param = {
          spuId: shoppingCart.spuId,
          quantity: shoppingCart.quantity,
          salesPrice: shoppingCart.goodsSpu.salesPrice,
          spuName: shoppingCart.goodsSpu.name,
          picUrl: shoppingCart.goodsSpu.picUrls?shoppingCart.goodsSpu.picUrls[0]:''
        }
        params.push(param)
      }
    })
    /* 把参数信息异步存储到缓存当中 */
    wx.setStorage({
      key: 'param-orderConfirm',
      data: params
    })
    wx.navigateTo({
      url: '/pages/orders/checkout/index'
    })
  }
})
