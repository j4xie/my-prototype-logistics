/**
 * 订单确认页面 - 增强版（已废弃，重定向到新版checkout页）
 * 包含优惠券选择功能
 * 
 * 注意：此页面已被 /pages/orders/checkout/index 替代
 * 保留此页面是为了向后兼容，新功能请使用新版结算页
 */
const app = getApp()

Page({
  data: {
    orderConfirmData: [],
    salesPrice: 0,
    paymentPrice: 0,
    freightPrice: 0,
    userAddress: null,
    orderSubParm: {
      paymentType: '1',
      deliveryWay: '1'
    },
    loading: false,
    userInfo: null,
    spuIds: [],
    // 优惠券相关
    showCouponModal: false,
    availableCoupons: [],
    unavailableCoupons: [],
    selectedCoupon: null,
    couponDiscount: 0,
    loadingCoupons: false
  },

  onShow() {
    // 检查登录状态 - 订单确认页需要登录才能访问
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
    // 检查是否选择了新地址
    const selectedAddress = wx.getStorageSync('selectedAddress')
    if (selectedAddress) {
      this.setData({ userAddress: selectedAddress })
      wx.removeStorageSync('selectedAddress')
    }
  },

  onLoad: function (options) {
    // 如果有缓存数据，重定向到新版结算页
    const cachedGoods = wx.getStorageSync('param-orderConfirm')
    if (cachedGoods && cachedGoods.length > 0) {
      console.log('[order-confirm] 重定向到新版结算页')
      wx.redirectTo({
        url: '/pages/orders/checkout/index'
      })
      return
    }

    // 兼容旧逻辑：如果通过URL参数传入spuId等，则继续使用本页面
    this.userAddressPage()
    this.userInfoGet()
    this.orderConfirmDo()
  },

  deliveryWayChange(e) {
    this.setData({
      [`orderSubParm.deliveryWay`]: e.detail.value,
      freightMap: null
    })
    this.orderConfirmDo()
  },

  orderConfirmDo() {
    let that = this
    wx.getStorage({
      key: 'param-orderConfirm',
      success: function (res) {
        let orderConfirmData = res.data
        let salesPrice = 0
        let freightPrice = 0
        let spuIds = null

        orderConfirmData.forEach((orderConfirm, index) => {
          if (spuIds) {
            spuIds = spuIds + ',' + orderConfirm.spuId
          } else {
            spuIds = orderConfirm.spuId
          }
          salesPrice = (Number(salesPrice) + orderConfirm.salesPrice * orderConfirm.quantity).toFixed(2)
          orderConfirm.paymentPrice = (orderConfirm.salesPrice * orderConfirm.quantity).toFixed(2)
          orderConfirm.freightPrice = 0
          freightPrice = (Number(freightPrice) + Number(orderConfirm.freightPrice)).toFixed(2)
        })

        that.setData({
          orderConfirmData: orderConfirmData,
          salesPrice: salesPrice,
          freightPrice: freightPrice,
          paymentPrice: salesPrice,
          spuIds: spuIds
        })

        // 加载可用优惠券
        that.loadAvailableCoupons(salesPrice, spuIds)
      }
    })
  },

  // 加载可用优惠券
  async loadAvailableCoupons(orderAmount, spuIds) {
    this.setData({ loadingCoupons: true })
    try {
      const res = await app.api.getAvailableCoupons({
        orderAmount: orderAmount,
        spuIds: spuIds
      })

      if (res.code === 200 && res.data) {
        // 分离可用和不可用的优惠券
        const available = res.data.filter(c => c.canUse)
        const unavailable = res.data.filter(c => !c.canUse)

        this.setData({
          availableCoupons: available,
          unavailableCoupons: unavailable
        })

        // 自动选择最优优惠券
        if (available.length > 0) {
          this.selectBestCoupon(available)
        }
      }
    } catch (error) {
      console.error('加载优惠券失败:', error)
    } finally {
      this.setData({ loadingCoupons: false })
    }
  },

  // 自动选择最优优惠券
  selectBestCoupon(coupons) {
    if (!coupons || coupons.length === 0) return

    // 按优惠金额排序，选择最大优惠
    const sorted = [...coupons].sort((a, b) => {
      const discountA = this.calculateCouponDiscount(a)
      const discountB = this.calculateCouponDiscount(b)
      return discountB - discountA
    })

    const bestCoupon = sorted[0]
    this.applyCoupon(bestCoupon)
  },

  // 计算优惠券折扣金额
  calculateCouponDiscount(coupon) {
    if (!coupon) return 0

    const orderAmount = parseFloat(this.data.salesPrice)

    switch (coupon.type) {
      case 'FIXED': // 满减券
        return coupon.discountAmount || 0
      case 'PERCENT': // 折扣券
        const discount = orderAmount * (coupon.discountPercent / 100)
        return Math.min(discount, coupon.maxDiscount || discount)
      case 'AMOUNT': // 现金券
        return coupon.discountAmount || 0
      default:
        return 0
    }
  },

  // 显示优惠券选择弹窗
  showCouponSelector() {
    this.setData({ showCouponModal: true })
  },

  // 关闭优惠券弹窗
  closeCouponModal() {
    this.setData({ showCouponModal: false })
  },

  // 选择优惠券
  onCouponSelect(e) {
    const couponId = e.currentTarget.dataset.id
    const coupon = this.data.availableCoupons.find(c => c.id === couponId)

    if (coupon) {
      this.applyCoupon(coupon)
    }

    this.closeCouponModal()
  },

  // 不使用优惠券
  clearCoupon() {
    this.setData({
      selectedCoupon: null,
      couponDiscount: 0
    })
    this.recalculatePayment()
    this.closeCouponModal()
  },

  // 应用优惠券
  applyCoupon(coupon) {
    const discount = this.calculateCouponDiscount(coupon)

    this.setData({
      selectedCoupon: coupon,
      couponDiscount: discount.toFixed(2)
    })

    this.recalculatePayment()
  },

  // 重新计算支付金额
  recalculatePayment() {
    const salesPrice = parseFloat(this.data.salesPrice)
    const freightPrice = parseFloat(this.data.freightPrice)
    const couponDiscount = parseFloat(this.data.couponDiscount)

    let paymentPrice = salesPrice + freightPrice - couponDiscount
    paymentPrice = Math.max(paymentPrice, 0) // 确保不为负数

    this.setData({
      paymentPrice: paymentPrice.toFixed(2)
    })
  },

  // 获取优惠券类型文字
  getCouponTypeText(coupon) {
    switch (coupon.type) {
      case 'FIXED': return '满减券'
      case 'PERCENT': return '折扣券'
      case 'AMOUNT': return '现金券'
      default: return '优惠券'
    }
  },

  // 获取优惠券描述
  getCouponDescription(coupon) {
    switch (coupon.type) {
      case 'FIXED':
        return `满${coupon.minAmount}减${coupon.discountAmount}`
      case 'PERCENT':
        return `${coupon.discountPercent}折${coupon.maxDiscount ? '，最高减' + coupon.maxDiscount : ''}`
      case 'AMOUNT':
        return `减${coupon.discountAmount}元`
      default:
        return coupon.name
    }
  },

  countFreight(orderConfirm, freightTemplat, quantity) {
    // 运费计算逻辑
  },

  userAddressPage() {
    app.api.userAddressPage({
      searchCount: false,
      current: 1,
      size: 1,
      isDefault: '1'
    }).then(res => {
      let records = res.data.records
      if (records && records.length > 0) {
        this.setData({
          userAddress: records[0]
        })
      }
    })
  },

  userInfoGet() {
    app.api.wxUserGet().then(res => {
      this.setData({
        userInfo: res.data
      })
    })
  },

  userMessageInput(e) {
    this.setData({
      [`orderSubParm.userMessage`]: e.detail.value
    })
  },

  orderSub() {
    let that = this
    let userAddress = that.data.userAddress

    if (that.data.orderSubParm.deliveryWay == '1' && userAddress == null) {
      wx.showToast({
        title: '请选择收货地址',
        icon: 'none',
        duration: 2000
      })
      return
    }

    that.setData({ loading: true })

    let orderSubParm = that.data.orderSubParm
    orderSubParm.skus = that.data.orderConfirmData

    // 添加优惠券信息
    if (that.data.selectedCoupon) {
      orderSubParm.couponId = that.data.selectedCoupon.id
      orderSubParm.couponDiscount = that.data.couponDiscount
    }

    app.api.orderSub(Object.assign(
      {},
      { userAddressId: that.data.orderSubParm.deliveryWay == '1' ? userAddress.id : null },
      orderSubParm
    )).then(res => {
      // 标记优惠券已使用
      if (that.data.selectedCoupon) {
        app.api.useCoupon(that.data.selectedCoupon.id).catch(() => {})
      }

      wx.redirectTo({
        url: '/pages/order/order-detail/index?callPay=true&id=' + res.data.id
      })
    }).catch(() => {
      that.setData({ loading: false })
    })
  }
})
