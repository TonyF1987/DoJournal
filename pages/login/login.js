const app = getApp();

Page({
  data: {
    nickName: '',
    avatarUrl: '',
    phoneNumber: '',
    password: '',
    showPassword: false,
    isLoading: false,
    canSubmitValue: false,
    nicknameFocus: false
  },

  onLoad(options) {
    this.checkLoginStatus();
  },

  checkLoginStatus() {
    if (app.globalData.isLoggedIn && app.globalData.openid) {
      wx.switchTab({
        url: '/pages/index/index'
      });
    }
  },

  updateCanSubmit() {
    const { phoneNumber, password } = this.data;
    
    let canSubmit = false;
    
    if (phoneNumber && phoneNumber.length >= 4 && password && password.length >= 6) {
      canSubmit = true;
    }
    
    this.setData({ canSubmitValue: canSubmit });
  },

  onNicknameInput(e) {
    this.setData({
      nickName: e.detail.value
    });
  },

  async onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    
    // 上传头像到云存储
    try {
      const cloudPath = `avatars/${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: avatarUrl
      });
      
      this.setData({
        avatarUrl: uploadRes.fileID
      });
    } catch (err) {
      console.error('头像上传失败:', err);
      // 如果上传失败，使用临时URL
      this.setData({
        avatarUrl: avatarUrl
      });
    }
    
    // 头像选择完成后，让昵称输入框自动聚焦
    setTimeout(() => {
      this.setData({
        nicknameFocus: true
      });
    }, 300);
  },

  onPhoneInput(e) {
    this.setData({
      phoneNumber: e.detail.value
    }, () => {
      this.updateCanSubmit();
    });
  },

  onPasswordInput(e) {
    this.setData({
      password: e.detail.value
    }, () => {
      this.updateCanSubmit();
    });
  },

  togglePassword() {
    this.setData({
      showPassword: !this.data.showPassword
    });
  },

  async handleSubmit() {
    if (!this.data.canSubmitValue) {
      return;
    }

    this.setData({ isLoading: true });

    try {
      // 先检查用户是否已注册
      const checkRes = await wx.cloud.callFunction({
        name: 'handleAuth',
        data: {
          action: 'checkUser',
          phoneNumber: this.data.phoneNumber
        }
      });

      if (checkRes.result.success) {
        if (checkRes.result.isRegistered) {
          // 已注册，直接登录
          await this.doLogin();
        } else {
          // 未注册，先注册再登录
          await this.handleRegister();
        }
      }
    } catch (err) {
      console.error('操作失败:', err);
      wx.showToast({
        title: err.message || '操作失败',
        icon: 'none'
      });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  async handleRegister() {
    const res = await wx.cloud.callFunction({
      name: 'handleAuth',
      data: {
        action: 'register',
        phoneNumber: this.data.phoneNumber,
        password: this.data.password,
        nickName: this.data.nickName || '微信用户',
        avatarUrl: this.data.avatarUrl || ''
      }
    });

    if (res.result.success) {
      wx.showToast({
        title: '注册成功',
        icon: 'success'
      });
      
      const userInfo = res.result.userInfo;
      app.globalData.isLoggedIn = true;
      app.globalData.openid = userInfo._openid;
      app.globalData.userInfo = userInfo;
      app.saveUserInfo(userInfo);
      
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/index/index'
        });
      }, 1000);
    } else {
      throw new Error(res.result.errMsg);
    }
  },

  async doLogin() {
    console.log('登录时传递的用户信息:', {
      nickName: this.data.nickName,
      avatarUrl: this.data.avatarUrl
    });
    
    const res = await wx.cloud.callFunction({
      name: 'handleAuth',
      data: {
        action: 'loginByPassword',
        phoneNumber: this.data.phoneNumber,
        password: this.data.password,
        nickName: this.data.nickName,
        avatarUrl: this.data.avatarUrl
      }
    });

    console.log('登录返回的用户信息:', res.result);

    if (res.result.success) {
      const userInfo = res.result.userInfo;
      console.log('保存的用户信息:', userInfo);
      app.globalData.isLoggedIn = true;
      app.globalData.openid = userInfo._openid;
      app.globalData.userInfo = userInfo;
      app.saveUserInfo(userInfo);
      
      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1000
      });

      setTimeout(() => {
        wx.switchTab({
          url: '/pages/index/index'
        });
      }, 1000);
    } else {
      throw new Error(res.result.errMsg);
    }
  },

  goToHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  goToServiceAgreement() {
    wx.navigateTo({
      url: '/pages/service-agreement/service-agreement'
    });
  },

  goToPrivacyPolicy() {
    wx.navigateTo({
      url: '/pages/privacy-policy/privacy-policy'
    });
  }
});
