/**
 * 阶梯定价计算器页面
 */
const app = getApp()

Page({
  data: {
    loading: true,
    productId: '',

    // 产品信息
    product: {
      id: '',
      name: '',
      image: '',
      basePrice: 0
    },

    // 阶梯价格
    tiers: [],

    // 当前选择
    quantity: 1,
    unitPrice: 0,
    totalPrice: 0,
    savedAmount: 0,

    // 当前阶梯索引
    activeTierIndex: 0
  },

  onShow() {
    // 检查登录状态 - 阶梯价格计算器需要登录才能访问
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
    if (options.id) {
      this.setData({ productId: options.id })
    }
    this.loadProductData()
  },

  /**
   * 加载产品数据
   */
  async loadProductData() {
    this.setData({ loading: true })

    try {
      const res = await this.fetchProduct()

      if (res.code === 200 && res.data) {
        const product = res.data

        // 构建阶梯数据
        const basePrice = product.price || product.basePrice
        const baseTier = { minQty: 1, price: basePrice, label: '基础价', isBase: true, savePercent: 0 }
        const priceTiers = (product.priceTiers || []).map((tier, index) => ({
          minQty: tier.minQuantity || tier.minQty,
          price: tier.price,
          label: `批量优惠`,
          isBase: false,
          savePercent: Math.round((basePrice - tier.price) * 100 / basePrice)
        }))

        const tiers = [baseTier, ...priceTiers].sort((a, b) => a.minQty - b.minQty)

        this.setData({
          product: {
            id: product.id,
            name: product.name,
            image: product.picUrl || product.image || '',
            basePrice: product.price || product.basePrice
          },
          tiers: tiers,
          unitPrice: product.price || product.basePrice,
          totalPrice: product.price || product.basePrice,
          loading: false
        })

        this.updateActiveTier()
      } else {
        throw new Error(res.msg || '加载产品失败')
      }
    } catch (error) {
      console.error('加载产品失败:', error)

      // 使用演示数据
      this.setData({
        product: {
          id: this.data.productId || '1',
          name: '速冻鱼排',
          image: '/public/img/food_seafood.jpg',
          basePrice: 28.00
        },
        tiers: [
          { minQty: 1, price: 28.00, label: '基础价', isBase: true, savePercent: 0 },
          { minQty: 10, price: 25.00, label: '批量优惠', isBase: false, savePercent: 11 },
          { minQty: 50, price: 22.00, label: '批量优惠', isBase: false, savePercent: 21 },
          { minQty: 100, price: 20.00, label: '批量优惠', isBase: false, savePercent: 29 }
        ],
        unitPrice: 28.00,
        totalPrice: 28.00,
        loading: false
      })

      this.updateActiveTier()
    }
  },

  /**
   * 获取产品API
   */
  fetchProduct() {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.baseUrl}/weixin/api/ma/goods/spu/${this.data.productId}`,
        method: 'GET',
        header: {
          'Authorization': `Bearer ${app.globalData.token || ''}`
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data)
          } else {
            reject(new Error(`请求失败: ${res.statusCode}`))
          }
        },
        fail: (err) => {
          reject(new Error(err.errMsg || '网络请求失败'))
        }
      })
    })
  },

  /**
   * 增加数量
   */
  increaseQty() {
    const newQty = this.data.quantity + 1
    this.setData({ quantity: newQty })
    this.calculatePrice()
  },

  /**
   * 减少数量
   */
  decreaseQty() {
    if (this.data.quantity > 1) {
      const newQty = this.data.quantity - 1
      this.setData({ quantity: newQty })
      this.calculatePrice()
    }
  },

  /**
   * 输入数量变化
   */
  onQtyInput(e) {
    let qty = parseInt(e.detail.value) || 1
    if (qty < 1) qty = 1
    this.setData({ quantity: qty })
    this.calculatePrice()
  },

  /**
   * 计算价格
   */
  calculatePrice() {
    const { quantity, tiers, product } = this.data

    // 找到适用的阶梯
    let unitPrice = product.basePrice
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (quantity >= tiers[i].minQty) {
        unitPrice = tiers[i].price
        break
      }
    }

    const totalPrice = unitPrice * quantity
    const originalPrice = product.basePrice * quantity
    const savedAmount = originalPrice - totalPrice

    this.setData({
      unitPrice: unitPrice,
      totalPrice: totalPrice,
      savedAmount: savedAmount
    })

    this.updateActiveTier()
  },

  /**
   * 更新当前激活的阶梯
   */
  updateActiveTier() {
    const { quantity, tiers } = this.data
    let activeTierIndex = 0

    for (let i = tiers.length - 1; i >= 0; i--) {
      if (quantity >= tiers[i].minQty) {
        activeTierIndex = i
        break
      }
    }

    this.setData({ activeTierIndex })
  },

  /**
   * 获取阶梯数量范围文本
   */
  getTierRange(tier, index) {
    const { tiers } = this.data
    const nextTier = tiers[index + 1]
    if (nextTier) {
      return `${tier.minQty} - ${nextTier.minQty - 1} 件`
    }
    return `${tier.minQty}+ 件`
  },

  /**
   * 获取阶梯节省百分比
   */
  getTierSavings(tier) {
    const { product } = this.data
    if (tier.isBase) return 0
    const savings = ((product.basePrice - tier.price) * 100 / product.basePrice).toFixed(0)
    return savings
  },

  /**
   * 加入购物车
   */
  addToCart() {
    const { product, quantity, unitPrice, totalPrice } = this.data

    wx.showToast({
      title: `已添加 ${quantity} 件到购物车`,
      icon: 'success'
    })

    // 实际应调用加入购物车API
  },

  /**
   * 立即购买
   */
  buyNow() {
    const { product, quantity, unitPrice, totalPrice } = this.data

    // 将商品数据存入缓存，供结算页读取
    wx.setStorage({
      key: 'param-orderConfirm',
      data: [{
        spuId: product.id,
        quantity: quantity,
        salesPrice: unitPrice,
        spuName: product.name,
        picUrl: product.image || ''
      }]
    })

    // 跳转到新版结算页
    wx.navigateTo({
      url: '/pages/orders/checkout/index'
    })
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: `${this.data.product.name} - 阶梯优惠价格`,
      path: `/pages/goods/price-calculator/index?id=${this.data.productId}`
    }
  }
})
