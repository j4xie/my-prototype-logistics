/**
 * 下单结算页面
 */
const app = getApp()
const api = require('../../../utils/api')

Page({
  data: {
    loading: false,
    submitting: false,
    // 地址
    address: null,
    showAddressPicker: false,
    addressList: [],
    // 商品
    goods: [],
    // 优惠券
    selectedCoupon: null,
    availableCoupons: [],
    showCouponPicker: false,
    // 金额
    goodsAmount: 0,
    discountAmount: 0,
    freightAmount: 0,
    totalAmount: 0,
    // 备注
    remark: '',
    // 支付方式
    paymentMethod: 'wechat'
  },

  onShow() {
    // 检查登录状态 - 结算页需要登录才能访问
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
    this.loadData(options)
  },

  // 加载数据
  async loadData(options) {
    this.setData({ loading: true })
    try {
      // 加载默认地址
      await this.loadDefaultAddress()
      // 加载商品信息
      await this.loadGoods(options)
      // 加载可用优惠券
      await this.loadCoupons()
      // 计算金额
      this.calculateAmount()
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加载默认地址
  async loadDefaultAddress() {
    try {
      const res = await api.userAddressPage({ current: 1, size: 10 })
      const addressList = res.data?.records || []
      const defaultAddress = addressList.find(a => a.isDefault) || addressList[0]
      this.setData({
        addressList: addressList,
        address: defaultAddress
      })
    } catch (error) {
      console.error('加载地址失败:', error)
    }
  },

  // 加载商品信息
  async loadGoods(options) {
    // 从缓存读取商品数据（由商品详情页或购物车页传入）
    const cachedGoods = wx.getStorageSync('param-orderConfirm')
    if (cachedGoods && cachedGoods.length > 0) {
      // 转换缓存数据格式为本页格式
      const goods = cachedGoods.map(item => ({
        id: item.spuId,
        name: item.spuName,
        spec: item.specInfo || '',
        image: item.picUrl || '/public/img/no_pic.png',
        price: parseFloat(item.salesPrice) || 0,
        quantity: item.quantity || 1
      }))
      this.setData({ goods })
      // 使用后清除缓存
      wx.removeStorageSync('param-orderConfirm')
    } else {
      // 无商品数据，提示返回
      wx.showModal({
        title: '提示',
        content: '没有选中的商品，请返回选择商品',
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
    }
  },

  // 加载优惠券
  async loadCoupons() {
    try {
      // 模拟优惠券数据
      const coupons = [
        { id: 1, name: '满200减20', type: 'discount', value: 20, minAmount: 200, expireDate: '2025-02-28' },
        { id: 2, name: '满100减10', type: 'discount', value: 10, minAmount: 100, expireDate: '2025-03-15' }
      ]
      this.setData({ availableCoupons: coupons })
    } catch (error) {
      console.error('加载优惠券失败:', error)
    }
  },

  // 计算金额
  calculateAmount() {
    const { goods, selectedCoupon } = this.data
    
    // 商品金额
    let goodsAmount = 0
    goods.forEach(item => {
      goodsAmount += item.price * item.quantity
    })
    
    // 折扣金额
    let discountAmount = 0
    if (selectedCoupon) {
      if (goodsAmount >= selectedCoupon.minAmount) {
        discountAmount = selectedCoupon.value
      }
    }
    
    // 运费（模拟）
    let freightAmount = goodsAmount >= 99 ? 0 : 10
    
    // 总金额
    let totalAmount = goodsAmount - discountAmount + freightAmount
    
    this.setData({
      goodsAmount: goodsAmount.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      freightAmount: freightAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2)
    })
  },

  // 选择地址
  selectAddress() {
    wx.navigateTo({
      url: '/pages/user/user-address/list/index?select=true',
      events: {
        onAddressSelected: (address) => {
          this.setData({ address })
        }
      }
    })
  },

  // 添加新地址
  addAddress() {
    wx.navigateTo({
      url: '/pages/user/user-address/form/index'
    })
  },

  // 选择优惠券
  selectCoupon() {
    this.setData({ showCouponPicker: true })
  },

  // 确认选择优惠券
  confirmCoupon(e) {
    const couponId = e.currentTarget.dataset.id
    const coupon = this.data.availableCoupons.find(c => c.id === couponId)
    this.setData({
      selectedCoupon: coupon,
      showCouponPicker: false
    })
    this.calculateAmount()
  },

  // 不使用优惠券
  clearCoupon() {
    this.setData({
      selectedCoupon: null,
      showCouponPicker: false
    })
    this.calculateAmount()
  },

  // 关闭优惠券选择器
  closeCouponPicker() {
    this.setData({ showCouponPicker: false })
  },

  // 输入备注
  onRemarkInput(e) {
    this.setData({ remark: e.detail.value })
  },

  // 提交订单
  async submitOrder() {
    if (!this.data.address) {
      wx.showToast({ title: '请选择收货地址', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    try {
      // 构建订单数据
      const orderData = {
        addressId: this.data.address.id,
        goods: this.data.goods.map(g => ({
          goodsId: g.id,
          quantity: g.quantity
        })),
        couponId: this.data.selectedCoupon?.id,
        remark: this.data.remark,
        paymentMethod: this.data.paymentMethod
      }

      // 模拟提交订单
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 调用支付
      wx.showModal({
        title: '订单提交成功',
        content: '是否立即支付？',
        confirmText: '去支付',
        cancelText: '稍后支付',
        success: (res) => {
          if (res.confirm) {
            this.handlePayment()
          } else {
            wx.redirectTo({ url: '/pages/order/order-list/index' })
          }
        }
      })
    } catch (error) {
      console.error('提交订单失败:', error)
      wx.showToast({ title: '提交失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  // 处理支付
  handlePayment() {
    wx.showLoading({ title: '支付中...' })
    setTimeout(() => {
      wx.hideLoading()
      wx.showToast({ title: '支付成功', icon: 'success' })
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/order/order-list/index?status=2' })
      }, 1500)
    }, 1500)
  }
})

