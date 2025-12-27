/**
 * Copyright (C) 2024-2025
 * 食品商城小程序
 * 注意：
 * 基于 JooLun 框架二次开发
 */
const WxParse = require('../../../public/wxParse/wxParse.js')
import Poster from '../../../components/wxa-plugin-canvas/poster/poster'
const { base64src } = require('../../../utils/base64src.js')
const app = getApp()
const tracker = require('../../../utils/tracker')

Page({
  data: {
    config: app.globalData.config,
    goodsSpu: null,
    currents: 1,
    cartNum: 1,
    goodsSpecData: [],
    shoppingCartCount: 0,
    shareShow: '',
    modalService: '',
    // 阶梯定价
    priceTiers: [],
    hasTiers: false,
    currentPrice: null,
    currentTier: null,
    nextTier: null,
    quantityToNextTier: 0,
    // 溯源信息
    traceInfo: null,
    hasTrace: false,
    // 数量选择弹窗
    showQtyModal: false,
    // ========== 相似商品推荐 ==========
    similarProducts: [],           // 相似商品列表
    similarLoading: false,         // 加载状态
    scrollDepth: 0,                // 页面滚动深度（用于行为分析）
    // ========== 来源追踪 ==========
    entrySource: ''                // 进入详情页的来源 (recommend_home/similar_recommend/category/search等)
  },

  // 浏览开始时间（用于计算停留时长）
  viewStartTime: 0,
  onShow() {
    // 检查登录状态 - 商品详情页需要登录才能访问
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
    let id
    if (options.scene){//接受二维码中参数
      id = decodeURIComponent(options.scene)
    }else{
      id = options.id
    }
    this.setData({
      id: id,
      // 记录进入来源（用于行为追踪）
      entrySource: options.source || 'direct'
    })

    // 记录浏览开始时间
    this.viewStartTime = Date.now()

    app.initPage()
      .then(res => {
        this.goodsGet(id)
        this.shoppingCartCount()
        this.loadPriceTiers(id)
        // 加载相似商品
        this.loadSimilarProducts(id)
      })
  },

  // 页面隐藏/离开时上报浏览行为
  onHide() {
    this.trackViewBehavior()
  },

  onUnload() {
    this.trackViewBehavior()
  },

  // 监听页面滚动
  onPageScroll(e) {
    const scrollTop = e.scrollTop
    // 更新滚动深度（百分比）
    if (scrollTop > this.data.scrollDepth) {
      this.setData({ scrollDepth: scrollTop })
    }
  },

  /**
   * 上报浏览行为
   */
  trackViewBehavior() {
    const goodsSpu = this.data.goodsSpu
    if (!goodsSpu || !this.viewStartTime) return

    const duration = Date.now() - this.viewStartTime
    const wxUser = app.globalData.wxUser

    if (wxUser && wxUser.id) {
      // 使用进入来源，如未设置则默认为 direct
      const source = this.data.entrySource || 'direct'

      // 上报浏览行为
      tracker.trackView({
        productId: goodsSpu.id,
        productName: goodsSpu.name,
        category: goodsSpu.categoryFirst,
        duration: duration,
        scrollDepth: this.data.scrollDepth,
        source: source
      })

      console.log('上报浏览行为:', {
        productId: goodsSpu.id,
        duration: duration,
        scrollDepth: this.data.scrollDepth,
        source: source
      })
    }

    // 重置开始时间，避免重复上报
    this.viewStartTime = 0
  },
  onShareAppMessage: function () {
    let goodsSpu = this.data.goodsSpu
    let title = goodsSpu.name
    let imageUrl = goodsSpu.picUrls[0]
    let path = 'pages/goods/goods-detail/index?id=' + goodsSpu.id
    return {
      title: title,
      path: path,
      imageUrl: imageUrl,
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
  goodsGet(id) {
    app.api.goodsGet(id)
      .then(res => {
        let goodsSpu = res.data
        this.setData({
          goodsSpu: goodsSpu
        })
        //html转wxml
        WxParse.wxParse('description', 'html', goodsSpu.description, this, 0)
      })
  },
  
  change: function (e) {
    this.setData({
      currents: e.detail.current + 1
    })
  },
  // 购买或加入购物车
  toDo(e) {
    let canDo = true
    if (canDo) {
      let goodsSpu = this.data.goodsSpu
      if (e.currentTarget.dataset.type == '1') {//加购物车
        if (this.data.shoppingCartId) {
          app.api.shoppingCartEdit({
            id: this.data.shoppingCartId,
            spuId: goodsSpu.id,
            quantity: this.data.cartNum,
            addPrice: goodsSpu.salesPrice,
            spuName: goodsSpu.name,
            picUrl: goodsSpu.picUrls ? goodsSpu.picUrls[0]:''
          })
            .then(res => {
              wx.showToast({
                title: '修改成功',
                duration: 5000
              })
              this.shoppingCartCount();
            })
        } else {
          app.api.shoppingCartAdd({
            spuId: goodsSpu.id,
            quantity: this.data.cartNum,
            addPrice: goodsSpu.salesPrice,
            spuName: goodsSpu.name,
            picUrl: goodsSpu.picUrls ? goodsSpu.picUrls[0] : ''
          })
            .then(res => {
              wx.showToast({
                title: '添加成功',
                duration: 5000
              })
              this.setData({
                modalSku: false
              })
              this.shoppingCartCount()
            })
        }
      } else {//立即购买，前去确认订单
        if (this.data.goodsSpu.stock <= 0) {
          wx.showToast({
            title: '抱歉，库存不足暂时无法购买',
            icon: 'none',
            duration: 2000
          })
          return;
        }
        /* 把参数信息异步存储到缓存当中 */
        wx.setStorage({
          key: 'param-orderConfirm',
          data: [{
            spuId: goodsSpu.id,
            quantity: this.data.cartNum,
            salesPrice: goodsSpu.salesPrice,
            spuName: goodsSpu.name,
            picUrl: goodsSpu.picUrls ? goodsSpu.picUrls[0] : ''
          }]
        })
        wx.navigateTo({
          url: '/pages/orders/checkout/index'
        })
      }
    }
  },
  shoppingCartCount(){
    app.api.shoppingCartCount()
      .then(res => {
        let shoppingCartCount = res.data
        this.setData({
          shoppingCartCount: shoppingCartCount
        })
        //设置TabBar购物车数量
        app.globalData.shoppingCartCount = shoppingCartCount + ''
      })
  },
  operateCartEvent(){
    this.shoppingCartCount()
  },
  shareShow(){
    this.setData({
      shareShow: 'show'
    })
  },
  shareHide(){
    this.setData({
      shareShow: ''
    })
  },
  onPosterSuccess(e) {
    const { detail } = e
    this.setData({
      posterUrl: detail
    })
  },
  onPosterFail(err) {
    console.error(err);
  },
  hidePosterShow(){
    this.setData({
      posterShow: false,
      shareShow: ''
    })
  },
  /**
   * 异步生成海报
   */
  onCreatePoster() {
    const goodsSpu = this.data.goodsSpu
    if (!goodsSpu) {
      wx.showToast({
        title: '商品信息加载中',
        icon: 'none'
      })
      return
    }

    // 获取小程序码（这里使用商品图片作为替代，实际应从后端获取小程序码）
    const qrCodeUrl = goodsSpu.picUrls && goodsSpu.picUrls[0] ? goodsSpu.picUrls[0] : '/public/img/no_pic.png'

    // 构建海报配置
    const posterConfig = {
      width: 750,
      height: 1200,
      backgroundColor: '#ffffff',
      debug: false,
      blocks: [
        // 背景
        {
          width: 750,
          height: 1200,
          x: 0,
          y: 0,
          backgroundColor: '#ffffff'
        }
      ],
      images: [
        // 商品图片
        {
          url: goodsSpu.picUrls && goodsSpu.picUrls[0] ? goodsSpu.picUrls[0] : '/public/img/no_pic.png',
          width: 690,
          height: 690,
          x: 30,
          y: 30,
          borderRadius: 10
        },
        // 小程序码
        {
          url: qrCodeUrl,
          width: 150,
          height: 150,
          x: 570,
          y: 1020,
          borderRadius: 75
        }
      ],
      texts: [
        // 商品名称
        {
          text: goodsSpu.name || '',
          x: 30,
          y: 760,
          fontSize: 36,
          color: '#333333',
          width: 690,
          lineNum: 2,
          lineHeight: 50,
          fontWeight: 'bold'
        },
        // 商品卖点
        {
          text: goodsSpu.sellPoint || '',
          x: 30,
          y: 870,
          fontSize: 28,
          color: '#999999',
          width: 690,
          lineNum: 1
        },
        // 价格
        {
          text: '¥' + (this.data.hasTiers && this.data.currentPrice ? this.data.currentPrice : goodsSpu.salesPrice),
          x: 30,
          y: 940,
          fontSize: 48,
          color: '#ff4444',
          fontWeight: 'bold'
        },
        // 原价
        {
          text: goodsSpu.marketPrice ? '¥' + goodsSpu.marketPrice : '',
          x: 200,
          y: 960,
          fontSize: 28,
          color: '#999999',
          textDecoration: 'line-through'
        },
        // 扫码提示
        {
          text: '长按识别小程序码查看',
          x: 30,
          y: 1100,
          fontSize: 24,
          color: '#999999'
        }
      ]
    }

    this.setData({
      posterConfig: posterConfig
    })

    // 使用定时器确保配置已更新
    setTimeout(() => {
      Poster.create(false, this)
        .then(() => {
          this.setData({
            posterShow: true,
            shareShow: ''
          })
        })
        .catch(err => {
          console.error('生成海报失败:', err)
          wx.showToast({
            title: '生成海报失败',
            icon: 'none'
          })
        })
    }, 100)
  },

  //点击保存到相册
  savePoster: function () {
    const posterUrl = this.data.posterUrl
    if (!posterUrl) {
      wx.showToast({
        title: '请先生成海报',
        icon: 'none'
      })
      return
    }

    // 检查相册权限
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.writePhotosAlbum'] === false) {
          // 用户拒绝过权限，引导开启
          wx.showModal({
            title: '提示',
            content: '需要您授权保存相册权限',
            confirmText: '去设置',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.openSetting()
              }
            }
          })
        } else {
          // 保存到相册
          wx.saveImageToPhotosAlbum({
            filePath: posterUrl,
            success: () => {
              wx.showToast({
                title: '保存成功',
                icon: 'success'
              })
              this.setData({
                posterShow: false
              })
            },
            fail: (err) => {
              if (err.errMsg.indexOf('auth deny') !== -1 || err.errMsg.indexOf('authorize') !== -1) {
                wx.showModal({
                  title: '提示',
                  content: '需要您授权保存相册权限',
                  confirmText: '去设置',
                  success: (modalRes) => {
                    if (modalRes.confirm) {
                      wx.openSetting()
                    }
                  }
                })
              } else {
                wx.showToast({
                  title: '保存失败',
                  icon: 'none'
                })
              }
            }
          })
        }
      }
    })
  },

  handleContact(e) {
    console.log(e)
  },
  // 检查ID是否为数字类型
  isNumericId(id) {
    if (id === null || id === undefined) return false
    // 如果是纯数字或可以转换为有效数字
    return !isNaN(id) && !isNaN(parseFloat(id)) && !/[a-zA-Z_]/.test(String(id))
  },
  // 加载阶梯定价
  loadPriceTiers(spuId) {
    // 检查spuId是否为数字类型，后端API要求Long类型
    if (!this.isNumericId(spuId)) {
      console.log('跳过阶梯定价加载: spuId不是数字类型', spuId)
      return
    }
    app.api.getPriceTiers(spuId)
      .then(res => {
        if (res.data && res.data.length > 0) {
          this.setData({
            priceTiers: res.data,
            hasTiers: true
          })
          // 初始计算价格
          this.calculateCurrentPrice(this.data.cartNum)
        }
      })
      .catch(err => {
        console.log('加载阶梯定价失败:', err)
      })
  },
  // 计算当前价格
  calculateCurrentPrice(quantity) {
    if (!this.data.hasTiers) return
    // 检查ID是否为数字类型
    if (!this.isNumericId(this.data.id)) return

    app.api.calculatePrice(this.data.id, quantity)
      .then(res => {
        if (res.data && res.data.hasTier) {
          this.setData({
            currentPrice: res.data.price,
            currentTier: res.data.tier,
            nextTier: res.data.nextTier,
            quantityToNextTier: res.data.quantityToNextTier
          })
        }
      })
  },
  // 数量变化
  onQuantityChange(e) {
    const quantity = e.detail.value
    this.setData({ cartNum: quantity })
    if (this.data.hasTiers) {
      this.calculateCurrentPrice(quantity)
    }
  },
  // 增加数量
  addNum() {
    let cartNum = this.data.cartNum + 1
    this.setData({ cartNum: cartNum })
    if (this.data.hasTiers) {
      this.calculateCurrentPrice(cartNum)
    }
  },
  // 减少数量
  minusNum() {
    let cartNum = this.data.cartNum
    if (cartNum > 1) {
      cartNum = cartNum - 1
      this.setData({ cartNum: cartNum })
      if (this.data.hasTiers) {
        this.calculateCurrentPrice(cartNum)
      }
    }
  },
  // 跳转溯源页面
  goToTrace() {
    const goodsSpu = this.data.goodsSpu
    if (goodsSpu && goodsSpu.traceCode) {
      wx.navigateTo({
        url: '/pages/traceability/detail/index?batchNo=' + goodsSpu.traceCode
      })
    } else {
      // 没有溯源码，跳转到扫码页
      wx.showModal({
        title: '溯源信息',
        content: '该商品暂无溯源码，您可以扫描商品包装上的二维码查看溯源信息',
        confirmText: '扫码溯源',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/traceability/scan/index'
            })
          }
        }
      })
    }
  },
  // 跳转AI分析报告页面
  goToAiAnalysis(e) {
    const type = e.currentTarget.dataset.type || 'product'
    const goodsSpu = this.data.goodsSpu
    if (goodsSpu && goodsSpu.id) {
      wx.navigateTo({
        url: '/pages/ai-analysis/product/index?productId=' + goodsSpu.id + '&type=' + type
      })
    } else {
      wx.showToast({
        title: '商品信息加载中',
        icon: 'none'
      })
    }
  },
  // 跳转AI聊天
  goToAiChat() {
    const goodsSpu = this.data.goodsSpu
    let url = '/pages/ai-rag/chat/index'
    if (goodsSpu && goodsSpu.id) {
      url += '?productId=' + goodsSpu.id + '&productName=' + encodeURIComponent(goodsSpu.name || '')
    }
    wx.navigateTo({ url })
  },
  // 跳转商家页面
  goToMerchant() {
    // TODO: 实现商家详情页跳转
    wx.showToast({
      title: '商家详情即将上线',
      icon: 'none'
    })
  },
  // 联系供应商
  contactSupplier() {
    wx.showModal({
      title: '联系供应商',
      content: '供应商联系电话: 021-12345678\n工作时间: 周一至周五 9:00-18:00',
      showCancel: true,
      confirmText: '拨打电话',
      success: (res) => {
        if (res.confirm) {
          wx.makePhoneCall({
            phoneNumber: '02112345678',
            fail: () => {
              wx.showToast({
                title: '拨打失败',
                icon: 'none'
              })
            }
          })
        }
      }
    })
  },
  // 显示数量选择弹窗
  showQtyModal() {
    this.setData({ showQtyModal: true })
  },
  // 隐藏数量选择弹窗
  hideQtyModal() {
    this.setData({ showQtyModal: false })
  },
  // 阻止冒泡关闭
  preventClose() {
    // 空函数，阻止点击内容区域关闭弹窗
  },

  // ========== 相似商品推荐相关方法 ==========

  /**
   * 加载相似商品推荐
   * @param {string} productId 当前商品ID
   */
  loadSimilarProducts(productId) {
    if (!productId) return

    this.setData({ similarLoading: true })

    const wxUser = app.globalData.wxUser
    const wxUserId = wxUser ? wxUser.id : null

    app.api.getSimilarProducts(productId, wxUserId, 6)
      .then(res => {
        const products = res.data || res || []
        this.setData({
          similarProducts: products,
          similarLoading: false
        })
        console.log('相似商品加载完成:', products.length)

        // 追踪相似商品曝光
        if (products.length > 0 && wxUserId) {
          const productIds = products.map(p => p.id)
          tracker.trackExposure(productIds)
        }
      })
      .catch(err => {
        console.error('加载相似商品失败:', err)
        this.setData({
          similarProducts: [],
          similarLoading: false
        })
      })
  },

  /**
   * 相似商品点击事件
   * 记录点击行为用于推荐反馈
   */
  onSimilarProductClick(e) {
    const product = e.currentTarget.dataset.product
    if (!product) return

    const wxUser = app.globalData.wxUser
    if (wxUser && wxUser.id && product.id) {
      // 记录推荐点击（用于强化学习反馈）
      tracker.trackView({
        productId: product.id,
        productName: product.name,
        source: 'similar_recommend',
        duration: 0  // 点击时还未浏览，时长为0
      })

      console.log('相似商品点击:', product.id, product.name)
    }

    // 跳转到商品详情
    wx.navigateTo({
      url: '/pages/goods/goods-detail/index?id=' + product.id
    })
  }
})
