/**
 * 店铺设置页面
 */
const app = getApp()

Page({
  data: {
    loading: false,
    shopInfo: {
      name: '我的店铺',
      logo: '',
      description: '',
      phone: '',
      address: '',
      businessHours: '09:00 - 21:00',
      isOpen: true
    },
    settingItems: [
      { key: 'notification', title: '消息通知', icon: 'cuIcon-notification', desc: '订单提醒、系统消息' },
      { key: 'delivery', title: '配送设置', icon: 'cuIcon-deliver', desc: '配送范围、运费模板' },
      { key: 'payment', title: '收款设置', icon: 'cuIcon-pay', desc: '收款方式、提现账户' },
      { key: 'print', title: '打印设置', icon: 'cuIcon-print', desc: '小票打印、标签打印' }
    ]
  },

  onShow() {
    // 检查登录状态 - 店铺设置页需要登录才能访问
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

  onLoad() {
    this.loadShopInfo()
  },

  onPullDownRefresh() {
    this.loadShopInfo().then(() => wx.stopPullDownRefresh())
  },

  // 加载店铺信息
  async loadShopInfo() {
    this.setData({ loading: true })
    try {
      // 模拟数据
      this.setData({
        shopInfo: {
          name: '白垩纪优选',
          logo: '/public/img/no_pic.png',
          description: '专注高品质食材供应，新鲜直达',
          phone: '400-888-8888',
          address: '上海市浦东新区张江高科技园区',
          businessHours: '09:00 - 21:00',
          isOpen: true
        }
      })
    } catch (error) {
      console.error('加载店铺信息失败:', error)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 切换营业状态
  toggleOpen(e) {
    const isOpen = e.detail.value
    wx.showModal({
      title: '确认操作',
      content: isOpen ? '确定要开始营业吗？' : '确定要暂停营业吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ 'shopInfo.isOpen': isOpen })
          wx.showToast({ 
            title: isOpen ? '已开始营业' : '已暂停营业', 
            icon: 'success' 
          })
        }
      }
    })
  },

  // 编辑店铺信息
  editShopInfo() {
    wx.showToast({ title: '编辑功能开发中', icon: 'none' })
  },

  // 更换Logo
  changeLogo() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: (res) => {
        this.setData({
          'shopInfo.logo': res.tempFiles[0].tempFilePath
        })
        wx.showToast({ title: 'Logo已更新', icon: 'success' })
      }
    })
  },

  // 进入设置项
  goToSetting(e) {
    const key = e.currentTarget.dataset.key
    wx.showToast({ title: `${key}设置开发中`, icon: 'none' })
  },

  // 联系客服
  contactService() {
    wx.makePhoneCall({ phoneNumber: '400-888-8888' })
  },

  // 查看帮助
  viewHelp() {
    wx.navigateTo({ url: '/pages/base/webview/index?url=https://help.example.com' })
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '退出后需要重新登录',
      confirmColor: '#FF4D4F',
      success: (res) => {
        if (res.confirm) {
          app.globalData.merchantId = null
          wx.reLaunch({ url: '/pages/home/index' })
        }
      }
    })
  }
})

























