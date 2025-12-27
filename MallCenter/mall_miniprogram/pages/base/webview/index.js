/**
 * WebView 页面
 * 用于打开外部链接
 */
const app = getApp()

Page({
  data: {
    url: '',
    title: '加载中...'
  },

  onShow() {
    // WebView 页面不需要登录检查，允许查看用户协议、隐私政策等
  },

  onLoad(options) {
    // 支持传递 url 和 title 参数
    if (options.url) {
      // URL 需要 decode
      const url = decodeURIComponent(options.url)
      this.setData({
        url: url
      })
    }

    if (options.title) {
      const title = decodeURIComponent(options.title)
      this.setData({
        title: title
      })
      wx.setNavigationBarTitle({
        title: title
      })
    }
  },

  // 网页加载完成
  onWebViewLoad(e) {
    console.log('WebView loaded:', e.detail)
  },

  // 网页加载失败
  onWebViewError(e) {
    console.error('WebView error:', e.detail)
    wx.showToast({
      title: '页面加载失败',
      icon: 'none'
    })
  },

  // 网页消息
  onWebViewMessage(e) {
    console.log('WebView message:', e.detail)
  },

  // 分享
  onShareAppMessage() {
    return {
      title: this.data.title,
      path: '/pages/base/webview/index?url=' + encodeURIComponent(this.data.url) + '&title=' + encodeURIComponent(this.data.title)
    }
  }
})
