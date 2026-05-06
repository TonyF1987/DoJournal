const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    avatarUrl: '', // 默认头像
    nickName: '', // 昵称
    phoneNumber: '', // 手机号
    userInfo: null, // 用户信息
    isLoggedIn: false, // 是否已登录
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
    const isLoggedIn = app.globalData.isLoggedIn;
    if (userInfo && isLoggedIn) {
      this.setData({ 
        userInfo,
        isLoggedIn: true,
        avatarUrl: userInfo.avatarUrl || '/images/default-avatar.png',
        nickName: userInfo.nickName || '',
        phoneNumber: userInfo.phoneNumber || ''
      });
    }
  },

  // 选择头像
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({ avatarUrl });
    // 上传头像到云存储
    this.uploadAvatar(avatarUrl);
  },

  // 上传头像到云存储
  uploadAvatar(filePath) {
    wx.showLoading({ title: '上传头像中...' });
    const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
    
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath,
      success: (res) => {
        console.log('头像上传成功:', res);
        this.setData({ avatarUrl: res.fileID });
        wx.hideLoading();
      },
      fail: (err) => {
        console.error('头像上传失败:', err);
        wx.hideLoading();
        wx.showToast({
          title: '头像上传失败',
          icon: 'none'
        });
      }
    });
  },

  // 输入昵称
  onNicknameInput(e) {
    this.setData({ nickName: e.detail.value });
  },

  // 获取手机号
  onGetPhoneNumber(e) {
    console.log('手机号授权:', e);
    if (e.detail.code) {
      // 调用云函数获取手机号
      this.getPhoneNumber(e.detail.code);
    } else {
      wx.showToast({
        title: '授权失败',
        icon: 'none'
      });
    }
  },

  // 调用云函数获取手机号
  getPhoneNumber(code) {
    wx.showLoading({ title: '获取手机号中...' });
    
    wx.cloud.callFunction({
      name: 'getPhoneNumber',
      data: { code },
      success: (res) => {
        wx.hideLoading();
        console.log('获取手机号成功:', res);
        if (res.result.success && res.result.phoneNumber) {
          this.setData({ phoneNumber: res.result.phoneNumber });
          wx.showToast({
            title: '手机号绑定成功',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: '获取手机号失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('获取手机号失败:', err);
        wx.showToast({
          title: '获取手机号失败',
          icon: 'none'
        });
      }
    });
  },

  // 清除手机号
  clearPhoneNumber() {
    this.setData({ phoneNumber: '' });
  },

  // 登录处理
  handleLogin() {
    const { avatarUrl, nickName, phoneNumber } = this.data;
    
    if (!nickName.trim()) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }

    this.setData({ isLoading: true });

    const userInfo = {
      avatarUrl,
      nickName,
      phoneNumber
    };

    // 调用云函数登录
    this.callLoginFunction(userInfo);
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
        
        const { openid, userId, isNewUser, userInfo: savedUserInfo } = res.result;
        
        // 更新全局数据
        app.globalData.openid = openid;
        app.globalData.userId = userId;
        app.globalData.isLoggedIn = true;
        app.globalData.userInfo = savedUserInfo || userInfo;
        
        // 保存用户信息到本地存储
        app.saveUserInfo(savedUserInfo || userInfo);
        
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
        
        that.setData({ 
          isLoading: false,
          isLoggedIn: true,
          userInfo: savedUserInfo || userInfo
        });
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
          app.globalData.isLoggedIn = false;
          
          this.setData({ 
            userInfo: null,
            isLoggedIn: false,
            avatarUrl: '/images/default-avatar.png',
            nickName: '',
            phoneNumber: ''
          });
          
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