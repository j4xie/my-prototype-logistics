/**
 * 手机号验证码登录页面
 */
const app = getApp()

Page({
  data: {
    phone: '',
    code: '',
    agreed: false,
    loading: false,
    countdown: 0,
    canSendCode: false,
    canLogin: false
  },

  onLoad() {
    // 检查是否已登录
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo && userInfo.id) {
      wx.switchTab({ url: '/pages/home/index' })
    }
  },

  // 手机号输入
  onPhoneInput(e) {
    const phone = e.detail.value.trim()
    this.setData({
      phone,
      canSendCode: this.isValidPhone(phone),
      canLogin: this.isValidPhone(phone) && this.data.code.length === 6 && this.data.agreed
    })
  },

  // 清除手机号
  clearPhone() {
    this.setData({
      phone: '',
      canSendCode: false,
      canLogin: false
    })
  },

  // 验证码输入
  onCodeInput(e) {
    const code = e.detail.value.trim()
    this.setData({
      code,
      canLogin: this.isValidPhone(this.data.phone) && code.length === 6 && this.data.agreed
    })
  },

  // 验证手机号格式
  isValidPhone(phone) {
    return /^1[3-9]\d{9}$/.test(phone)
  },

  // 发送验证码
  async sendCode() {
    if (!this.data.canSendCode || this.data.countdown > 0) return

    const phone = this.data.phone

    if (!this.isValidPhone(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }

    wx.showLoading({ title: '发送中...' })

    try {
      const res = await app.api.sendSmsCode({ phone })

      if (res.code === 0 || res.code === 200) {
        wx.hideLoading()
        wx.showToast({ title: '验证码已发送', icon: 'success' })

        // 开始倒计时
        this.startCountdown()
      } else {
        throw new Error(res.message || '发送失败')
      }
    } catch (error) {
      wx.hideLoading()
      console.error('发送验证码失败:', error)
      wx.showToast({
        title: error.message || '发送失败，请稍后重试',
        icon: 'none'
      })
    }
  },

  // 开始倒计时
  startCountdown() {
    this.setData({ countdown: 60 })

    const timer = setInterval(() => {
      if (this.data.countdown <= 1) {
        clearInterval(timer)
        this.setData({ countdown: 0 })
      } else {
        this.setData({ countdown: this.data.countdown - 1 })
      }
    }, 1000)
  },

  // 勾选协议
  onAgreementChange(e) {
    const agreed = e.detail.value.includes('agreed')
    this.setData({
      agreed,
      canLogin: this.isValidPhone(this.data.phone) && this.data.code.length === 6 && agreed
    })
  },

  // 登录
  async doLogin() {
    if (!this.data.canLogin || this.data.loading) return

    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意用户协议', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    try {
      const res = await app.api.phoneLogin({
        phone: this.data.phone,
        code: this.data.code
      })

      if ((res.code === 0 || res.code === 200) && res.data) {
        const userData = res.data

        // 保存用户信息
        wx.setStorageSync('userInfo', userData.user)
        wx.setStorageSync('accessToken', userData.accessToken)
        if (userData.refreshToken) {
          wx.setStorageSync('refreshToken', userData.refreshToken)
        }

        wx.showToast({ title: '登录成功', icon: 'success' })

        // 检查是否需要绑定商家
        if (!userData.user.merchantId) {
          wx.showModal({
            title: '绑定商家',
            content: '绑定商家账号可享受更多服务，是否立即绑定？',
            confirmText: '立即绑定',
            cancelText: '稍后',
            success: (result) => {
              if (result.confirm) {
                wx.navigateTo({ url: '/pages/auth/bind-merchant/index' })
              } else {
                wx.switchTab({ url: '/pages/home/index' })
              }
            }
          })
        } else {
          setTimeout(() => {
            wx.switchTab({ url: '/pages/home/index' })
          }, 1500)
        }
      } else {
        throw new Error(res.message || '登录失败')
      }
    } catch (error) {
      console.error('登录失败:', error)
      wx.showToast({
        title: error.message || '登录失败，请重试',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 微信登录
  goWechatLogin() {
    wx.navigateBack()
  },

  // 查看用户协议
  showUserAgreement() {
    wx.navigateTo({
      url: '/pages/base/webview/index?url=' + encodeURIComponent('https://www.cretas.com/user-agreement') + '&title=' + encodeURIComponent('用户协议')
    })
  },

  // 查看隐私政策
  showPrivacyPolicy() {
    wx.navigateTo({
      url: '/pages/base/webview/index?url=' + encodeURIComponent('https://www.cretas.com/privacy-policy') + '&title=' + encodeURIComponent('隐私政策')
    })
  }
})
