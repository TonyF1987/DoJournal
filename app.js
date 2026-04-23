App({
  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloudbase-6gdin2lj657adc8c', // 云开发环境ID
        traceUser: true,
      });
    }

    // 检查登录状态，但不自动获取用户信息（需用户主动登录）
    this.checkLoginStatus();
  },

  onShow(options) {
    // 处理从聊天转发的消息
    if (options.scene === 1044) {
      // 群聊转发
      console.log('从群聊转发进入');
    } else if (options.referrerInfo) {
      // 从其他小程序转发进入
      console.log('从其他小程序转发进入');
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    // 检查是否已经有用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.globalData.userInfo = JSON.parse(userInfo);
    }

    // 检查是否已经登录
    const openid = wx.getStorageSync('openid');
    const userId = wx.getStorageSync('userId');
    if (openid && userId) {
      this.globalData.openid = openid;
      this.globalData.userId = userId;
    }
  },

  // 登录并获取openid
  login(callback) {
    wx.cloud.callFunction({
      name: 'login',
      data: {},
      success: res => {
        const { openid, userId, isNewUser } = res.result;
        this.globalData.openid = openid;
        this.globalData.userId = userId;
        
        // 保存到本地存储
        wx.setStorageSync('openid', openid);
        wx.setStorageSync('userId', userId);
        
        console.log('登录成功:', res.result);
        
        if (callback) {
          callback(res.result);
        }
      },
      fail: err => {
        console.error('登录失败:', err);
        wx.showToast({
          title: '登录失败',
          icon: 'none'
        });
        
        if (callback) {
          callback(null, err);
        }
      }
    });
  },

  globalData: {
    userInfo: null,
    openid: null,
    userId: null,
    sharedMessage: null, // 存储从聊天转发的消息
    isLoggedIn: false // 登录状态标记
  },

  // 保存用户信息到本地存储
  saveUserInfo(userInfo) {
    this.globalData.userInfo = userInfo;
    wx.setStorageSync('userInfo', JSON.stringify(userInfo));
  },

  // 清除用户信息（退出登录）
  clearUserInfo() {
    this.globalData.userInfo = null;
    this.globalData.openid = null;
    this.globalData.userId = null;
    this.globalData.isLoggedIn = false;
    
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('openid');
    wx.removeStorageSync('userId');
  },
});
