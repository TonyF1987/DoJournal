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

    // 获取用户信息
    this.getUserInfo();
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

  // 获取用户信息
  getUserInfo() {
    const that = this;
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.userInfo']) {
          wx.getUserInfo({
            success: (res) => {
              that.globalData.userInfo = res.userInfo;
              that.login();
            }
          });
        }
      }
    });
  },

  // 登录并获取openid
  login() {
    wx.cloud.callFunction({
      name: 'login',
      data: {},
      success: res => {
        this.globalData.openid = res.result.openid;
        this.globalData.userId = res.result.userId;
      }
    });
  },

  globalData: {
    userInfo: null,
    openid: null,
    userId: null,
    sharedMessage: null // 存储从聊天转发的消息
  }
});
