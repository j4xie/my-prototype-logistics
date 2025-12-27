/**
 * 登录页面
 */
const app = getApp()

Page({
  data: {
    agreed: false,
    showAuthModal: false
  },

  onLoad(options) {
    // 检查是否已登录
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo && userInfo.id) {
      // 已登录，跳转到首页
      wx.switchTab({
        url: '/pages/home/index'
      })
    }
  },

  // 勾选用户协议
  onAgreementChange(e) {
    this.setData({
      agreed: e.detail.value.length > 0
    })
  },

  // 获取手机号（微信一键登录）
  onGetPhoneNumber(e) {
    if (!this.data.agreed) {
      wx.showToast({
        title: '请先同意用户协议',
        icon: 'none'
      })
      return
    }

    if (e.detail.errMsg === 'getPhoneNumber:ok') {
      // 获取手机号成功
      const code = e.detail.code
      this.loginWithPhone(code)
    } else {
      // 用户拒绝授权
      wx.showToast({
        title: '需要授权手机号才能登录',
        icon: 'none'
      })
    }
  },

  // 使用手机号登录
  async loginWithPhone(code) {
    wx.showLoading({ title: '登录中...' })

    try {
      // 调用后端API获取手机号并登录
      const res = await app.api.wechatPhoneLogin({ code: code })

      if (res.code === 0 && res.data) {
        // 登录成功
        const userData = res.data

        // 保存用户信息
        wx.setStorageSync('userInfo', userData.user)
        wx.setStorageSync('accessToken', userData.accessToken)
        if (userData.refreshToken) {
          wx.setStorageSync('refreshToken', userData.refreshToken)
        }

        wx.hideLoading()
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        })

        // 检查是否需要绑定商家
        if (!userData.user.merchantId) {
          // 未绑定商家，询问是否绑定
          wx.showModal({
            title: '绑定商家',
            content: '绑定商家账号可享受更多服务，是否立即绑定？',
            confirmText: '立即绑定',
            cancelText: '稍后',
            success: (result) => {
              if (result.confirm) {
                wx.navigateTo({
                  url: '/pages/auth/bind-merchant/index'
                })
              } else {
                wx.switchTab({
                  url: '/pages/home/index'
                })
              }
            }
          })
        } else {
          // 已绑定，跳转首页
          setTimeout(() => {
            wx.switchTab({
              url: '/pages/home/index'
            })
          }, 1500)
        }
      } else {
        throw new Error(res.message || '登录失败')
      }
    } catch (error) {
      wx.hideLoading()
      console.error('登录失败:', error)
      wx.showToast({
        title: error.message || '登录失败，请重试',
        icon: 'none'
      })
    }
  },

  // 手机号登录（跳转手机验证码登录页）
  goPhoneLogin() {
    if (!this.data.agreed) {
      wx.showToast({
        title: '请先同意用户协议',
        icon: 'none'
      })
      return
    }

    // 跳转到手机号验证码登录页
    wx.navigateTo({
      url: '/pages/auth/phone-login/index'
    })
  },

  // 显示授权弹窗
  showAuthModal() {
    this.setData({ showAuthModal: true })
  },

  // 隐藏授权弹窗
  hideAuthModal() {
    this.setData({ showAuthModal: false })
  },

  // 确认授权
  confirmAuth() {
    this.hideAuthModal()
    // 获取用户信息
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        console.log('用户信息:', res.userInfo)
        // 可以在这里保存用户昵称头像等
      },
      fail: (err) => {
        console.log('获取用户信息失败:', err)
      }
    })
  },

  // 查看用户协议
  showUserAgreement() {
    wx.navigateTo({
      url: '/pages/base/webview/index?url=' + encodeURIComponent('https://example.com/user-agreement') + '&title=' + encodeURIComponent('用户协议')
    })
  },

  // 查看隐私政策
  showPrivacyPolicy() {
    wx.navigateTo({
      url: '/pages/base/webview/index?url=' + encodeURIComponent('https://example.com/privacy-policy') + '&title=' + encodeURIComponent('隐私政策')
    })
  },

  // 跳过登录
  skipLogin() {
    wx.switchTab({
      url: '/pages/home/index'
    })
  }
})
