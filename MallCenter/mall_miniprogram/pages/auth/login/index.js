/**
 * 登录页面 - 整合微信一键登录和手机号验证码登录
 */
const app = getApp()

Page({
  data: {
    agreed: false,
    showAuthModal: false,
    isDevTools: false,  // 是否在开发者工具中
    loginType: 'wechat', // 'wechat' | 'phone' - 当前登录方式
    // 手机号登录相关
    phone: '',
    code: '',
    loading: false,
    countdown: 0,
    canSendCode: false,
    canLogin: false
  },

  onLoad(options) {
    // 检测是否在开发者工具中
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      isDevTools: systemInfo.platform === 'devtools'
    })

    // 检查是否已登录
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo && userInfo.id) {
      // 已登录，跳转到首页
      wx.switchTab({
        url: '/pages/home/index'
      })
    }
  },

  // 切换登录方式
  switchLoginType(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ loginType: type })
  },

  // 勾选用户协议
  onAgreementChange(e) {
    const agreed = e.detail.value.length > 0
    this.setData({
      agreed,
      // 更新手机号登录按钮状态
      canLogin: this.isValidPhone(this.data.phone) && this.data.code.length === 6 && agreed
    })
  },

  // ==================== 微信一键登录 ====================

  // 获取手机号（微信一键登录）
  onGetPhoneNumber(e) {
    console.log('[Login] getPhoneNumber event:', e)
    console.log('[Login] agreed:', this.data.agreed)
    console.log('[Login] isDevTools:', this.data.isDevTools)
    console.log('[Login] e.detail:', e.detail)

    if (!this.data.agreed) {
      console.log('[Login] 用户协议未勾选')
      wx.showToast({
        title: '请先同意用户协议',
        icon: 'none'
      })
      return
    }

    // 开发者工具中提示
    if (this.data.isDevTools && (!e.detail || !e.detail.code)) {
      console.log('[Login] 开发者工具环境，显示提示')
      wx.showModal({
        title: '开发环境提示',
        content: '微信一键登录需要在真机预览中测试，请切换到"手机号登录"或使用真机预览',
        showCancel: false
      })
      return
    }

    if (e.detail.errMsg === 'getPhoneNumber:ok') {
      console.log('[Login] 获取手机号成功，code:', e.detail.code)
      const code = e.detail.code
      this.loginWithWechatPhone(code)
    } else {
      console.log('[Login] 用户拒绝授权或获取失败:', e.detail.errMsg)
      wx.showToast({
        title: '需要授权手机号才能登录',
        icon: 'none'
      })
    }
  },

  // 使用微信手机号登录
  async loginWithWechatPhone(phoneCode) {
    wx.showLoading({ title: '登录中...' })

    try {
      // Step 1: 先获取 wx.login 的 jsCode
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject
        })
      })

      if (!loginRes.code) {
        throw new Error('微信登录失败')
      }

      // Step 2: 同时传递 jsCode 和手机号 code
      const res = await app.api.wechatPhoneLogin({
        jsCode: loginRes.code,  // wx.login 的 code
        code: phoneCode         // 手机号授权的 code
      })

      if (res.code === 200 && res.data) {
        this.handleLoginSuccess(res.data)
      } else {
        throw new Error(res.msg || '登录失败')
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

  // ==================== 手机号验证码登录 ====================

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

    this.countdownTimer = setInterval(() => {
      if (this.data.countdown <= 1) {
        clearInterval(this.countdownTimer)
        this.setData({ countdown: 0 })
      } else {
        this.setData({ countdown: this.data.countdown - 1 })
      }
    }, 1000)
  },

  // 手机号验证码登录
  async doPhoneLogin() {
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
        this.handleLoginSuccess(res.data)
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

  // ==================== 通用方法 ====================

  // 统一处理登录成功
  handleLoginSuccess(userData) {
    // 保存 thirdSession 到全局数据（如果有）
    if (userData.thirdSession) {
      app.globalData.thirdSession = userData.thirdSession
    }
    app.globalData.wxUser = userData.user

    // 保存用户信息到本地存储
    wx.setStorageSync('userInfo', userData.user)
    if (userData.accessToken) {
      wx.setStorageSync('accessToken', userData.accessToken)
    }
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
      url: '/pages/base/webview/index?url=' + encodeURIComponent('https://www.cretas.com/user-agreement') + '&title=' + encodeURIComponent('用户协议')
    })
  },

  // 查看隐私政策
  showPrivacyPolicy() {
    wx.navigateTo({
      url: '/pages/base/webview/index?url=' + encodeURIComponent('https://www.cretas.com/privacy-policy') + '&title=' + encodeURIComponent('隐私政策')
    })
  },

  // 跳过登录
  skipLogin() {
    wx.switchTab({
      url: '/pages/home/index'
    })
  },

  onUnload() {
    // 清除倒计时
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer)
    }
  }
})
