const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    userInfo: null, // 用户信息
    isLoading: false // 加载状态
  },

  onLoad() {
    // 检查是否已登录
    this.checkLoginStatus();
  },

  onShow() {
    this.checkLoginStatus();
  },

  // 检查登录状态
  checkLoginStatus() {
    // 检查本地存储的用户信息
    const userInfo = app.globalData.userInfo;
    if (userInfo) {
      this.setData({ userInfo });
    }
  },

  // 登录处理
  handleLogin() {
    const that = this;
    
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        console.log('获取用户信息成功:', res);
        that.setData({
          userInfo: res.userInfo,
          isLoading: true
        });
        
        app.globalData.userInfo = res.userInfo;
        
        // 调用云函数登录
        that.callLoginFunction(res.userInfo);
      },
      fail: (err) => {
        console.error('获取用户信息失败:', err);
        wx.showToast({
          title: '登录失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 调用登录云函数
  callLoginFunction(userInfo) {
    const that = this;
    
    wx.cloud.callFunction({
      name: 'login',
      data: {
        userInfo: userInfo
      },
      success: (res) => {
        console.log('登录成功:', res);
        
        if (res.result && res.result.success) {
          // 更新全局数据
          app.globalData.openid = res.result.openid;
          app.globalData.userId = res.result.userId;
          
          // 显示成功提示
          wx.showToast({
            title: '登录成功',
            icon: 'success',
            duration: 1500
          });
          
          // 延迟跳转到首页
          setTimeout(() => {
            wx.switchTab({
              url: '/pages/index/index'
            });
          }, 1500);
        } else {
          wx.showToast({
            title: '登录失败',
            icon: 'none',
            duration: 2000
          });
        }
        
        that.setData({ isLoading: false });
      },
      fail: (err) => {
        console.error('登录失败:', err);
        wx.showToast({
          title: '登录失败',
          icon: 'none',
          duration: 2000
        });
        that.setData({ isLoading: false });
      }
    });
  },

  // 获取用户信息回调（已废弃，保留兼容性）
  handleGetUserInfo(e) {
    if (e.detail.userInfo) {
      console.log('用户信息:', e.detail.userInfo);
      this.setData({ userInfo: e.detail.userInfo });
      app.globalData.userInfo = e.detail.userInfo;
    } else {
      console.log('用户拒绝授权');
    }
  },

  // 登出处理
  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要登出吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除本地数据
          app.globalData.userInfo = null;
          app.globalData.openid = null;
          app.globalData.userId = null;
          
          this.setData({ userInfo: null });
          
          wx.showToast({
            title: '已登出',
            icon: 'success',
            duration: 1500
          });
        }
      }
    });
  },

  // 跳转到首页（预览功能）
  gotoHomePage() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  // 页面分享
  onShareAppMessage() {
    return {
      title: '作业打卡 - 让学习更有趣',
      path: '/pages/login/login',
      imageUrl: '/images/share-cover.png'
    };
  }
});