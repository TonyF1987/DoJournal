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
      try {
        const parsedUserInfo = JSON.parse(userInfo);
        this.globalData.userInfo = parsedUserInfo;
        this.globalData.currentChildId = parsedUserInfo.currentChildId;
        this.globalData.children = parsedUserInfo.children || [];
      } catch (e) {
        console.error('解析用户信息失败', e);
      }
    }

    // 检查是否已经登录
    const openid = wx.getStorageSync('openid');
    const userId = wx.getStorageSync('userId');
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    if (openid && userId && isLoggedIn) {
      this.globalData.openid = openid;
      this.globalData.userId = userId;
      this.globalData.isLoggedIn = true;
    }
  },

  // 登录并获取openid
  login(callback) {
    // 使用当前账号的 account 参数来获取正确的用户信息
    const currentAccount = this.globalData.userInfo?.account || '';
    wx.cloud.callFunction({
      name: 'login',
      data: {
        account: currentAccount
      },
      success: res => {
        const { openid, userId, isNewUser, userInfo } = res.result;
        this.globalData.openid = openid;
        this.globalData.userId = userId;
        this.globalData.isLoggedIn = true;
        
        // 保存到本地存储
        wx.setStorageSync('openid', openid);
        wx.setStorageSync('userId', userId);
        wx.setStorageSync('isLoggedIn', true);
        
        // 保存用户信息
        if (userInfo) {
          this.saveUserInfo(userInfo);
        }
        
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
    isLoggedIn: false, // 登录状态标记
    currentChildId: null, // 当前选中的小朋友ID
    children: [] // 所有小朋友列表
  },

  // 保存用户信息到本地存储
  saveUserInfo(userInfo) {
    this.globalData.userInfo = userInfo;
    this.globalData.currentChildId = userInfo.currentChildId;
    this.globalData.children = userInfo.children || [];
    this.globalData.isLoggedIn = true;
    this.globalData.openid = userInfo._openid;
    this.globalData.userId = userInfo._id;
    
    wx.setStorageSync('userInfo', JSON.stringify(userInfo));
    wx.setStorageSync('openid', userInfo._openid);
    wx.setStorageSync('userId', userInfo._id);
    wx.setStorageSync('isLoggedIn', true);
  },

  // 从数据库重新加载用户信息
  loadUserInfo(callback) {
    // 使用当前账号的 account 参数来获取正确的用户信息
    const currentAccount = this.globalData.userInfo?.account || '';
    wx.cloud.callFunction({
      name: 'getUserInfo',
      data: {
        account: currentAccount
      },
      success: (res) => {
        if (res.result && res.result.success) {
          const userInfo = res.result.userInfo;
          this.saveUserInfo(userInfo);
          if (callback) {
            callback(userInfo);
          }
        }
      },
      fail: (err) => {
        console.error('加载用户信息失败', err);
      }
    });
  },

  // 获取当前选中的小朋友
  getCurrentChild() {
    if (!this.globalData.children || !this.globalData.currentChildId) {
      return null;
    }
    return this.globalData.children.find(c => c.id === this.globalData.currentChildId);
  },

  // 切换小朋友
  switchChild(childId) {
    this.globalData.currentChildId = childId;
    // 更新用户信息
    if (this.globalData.userInfo) {
      this.globalData.userInfo.currentChildId = childId;
      this.saveUserInfo(this.globalData.userInfo);
    }
  },

  // 清除用户信息（退出登录）
  clearUserInfo() {
    this.globalData.userInfo = null;
    this.globalData.openid = null;
    this.globalData.userId = null;
    this.globalData.isLoggedIn = false;
    this.globalData.currentChildId = null;
    this.globalData.children = [];
    
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('openid');
    wx.removeStorageSync('userId');
    wx.removeStorageSync('isLoggedIn');
  },
});
