const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    userInfo: {},
    currentChild: null,
    familyInfo: null,
    familyMembers: [],
    showFamilyManage: false,
    showCreateFamily: false,
    showJoinFamily: false,
    showInviteCode: false,
    familyName: '',
    inputInviteCode: '',
    inviteCode: '',
    showEditProfile: false,
    editUserInfo: {},
    showSettingsModal: false,
    showHelpModal: false,
    settings: {
      dailyReminder: true,
      darkMode: false
    }
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    this.loadUserInfo();
  },

  // 跳转到登录页面
  goToLogin() {
    wx.navigateTo({ 
      url: '/pages/login/login' 
    });
  },

  loadUserInfo() {
    if (!app.globalData.userInfo) {
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo) {
        app.globalData.userInfo = JSON.parse(userInfo);
      }
    }

    if (app.globalData.openid) {
      wx.cloud.callFunction({
        name: 'getUserInfo',
        success: (res) => {
          console.log('getUserInfo 返回:', res.result);
          if (res.result && res.result.success) {
            const userData = res.result.userInfo;
            console.log('用户数据:', userData);
            const currentChild = this.getCurrentChild(userData);
            this.setData({
              userInfo: userData,
              currentChild: currentChild
            });
            app.saveUserInfo(userData);
            app.globalData.isLoggedIn = true;
          }
        }
      });
    }
  },

  getCurrentChild(userInfo) {
    if (!userInfo.children || !userInfo.currentChildId) {
      return null;
    }
    return userInfo.children.find(c => c.id === userInfo.currentChildId);
  },

  checkLoginAndPrompt() {
    if (!app.globalData.isLoggedIn && !app.globalData.openid) {
      wx.showModal({
        title: '需要登录',
        content: '此功能需要登录后使用',
        confirmText: '去登录',
        cancelText: '继续浏览',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/login/login'
            });
          }
        }
      });
      return false;
    }
    return true;
  },

  goToHomework() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  goToRewards() {
    wx.switchTab({
      url: '/pages/rewards/rewards'
    });
  },

  navigateTo(page) {
    // 页面跳转属于浏览功能，无需登录
    wx.navigateTo({ url: page });
  },

  openFamilyManage() {
    if (!this.checkLoginAndPrompt()) return;
    if (this.data.userInfo.familyId) {
      this.loadFamilyInfo();
    } else {
      this.setData({ showFamilyManage: true });
    }
  },

  closeFamilyManage() {
    this.setData({
      showFamilyManage: false,
      showCreateFamily: false,
      showJoinFamily: false,
      showInviteCode: false,
      familyName: '',
      inputInviteCode: ''
    });
  },

  loadFamilyInfo() {
    wx.cloud.callFunction({
      name: 'manageFamily',
      data: { action: 'getFamilyInfo' },
      success: res => {
        if (res.result.success) {
          this.setData({
            familyInfo: res.result.family,
            familyMembers: res.result.family ? res.result.family.members : [],
            showFamilyManage: true
          });
        } else {
          this.setData({ showFamilyManage: true });
        }
      },
      fail: err => {
        console.error('获取家庭信息失败:', err);
        this.setData({ showFamilyManage: true });
      }
    });
  },

  showCreateFamilyModal() {
    if (!this.checkLoginAndPrompt()) return;
    this.setData({
      showCreateFamily: true,
      showFamilyManage: false,
      familyName: ''
    });
  },

  onFamilyNameInput(e) {
    this.setData({ familyName: e.detail.value });
  },

  createFamily() {
    if (!this.checkLoginAndPrompt()) return;
    if (!this.data.familyName || !this.data.familyName.trim()) {
      wx.showToast({ title: '请输入家庭名称', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '创建中...' });

    wx.cloud.callFunction({
      name: 'manageFamily',
      data: {
        action: 'createFamily',
        data: { familyName: this.data.familyName }
      },
      success: res => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({ title: '家庭创建成功', icon: 'success' });
          this.closeFamilyManage();
          setTimeout(() => {
            this.loadUserInfo();
          }, 1000);
        } else {
          wx.showToast({ title: res.result && res.result.errMsg || '创建失败', icon: 'none' });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('创建家庭云函数调用失败:', err);
        wx.showToast({ title: '云函数调用失败', icon: 'none' });
      }
    });
  },

  showJoinFamilyModal() {
    if (!this.checkLoginAndPrompt()) return;
    this.setData({
      showJoinFamily: true,
      showFamilyManage: false
    });
  },

  onInviteCodeInput(e) {
    this.setData({ inputInviteCode: e.detail.value });
  },

  verifyInviteCode() {
    if (!this.checkLoginAndPrompt()) return;
    if (!this.data.inputInviteCode.trim()) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '验证中...' });

    wx.cloud.callFunction({
      name: 'manageFamily',
      data: {
        action: 'verifyInvitationCode',
        data: { code: this.data.inputInviteCode.trim() }
      },
      success: res => {
        if (res.result.success) {
          this.joinFamily(res.result.familyId);
        } else {
          wx.hideLoading();
          wx.showToast({ title: res.result.errMsg || '邀请码无效或已过期', icon: 'none' });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('验证邀请码失败:', err);
        wx.showToast({ title: '验证失败', icon: 'none' });
      }
    });
  },

  joinFamily(familyId) {
    wx.cloud.callFunction({
      name: 'manageFamily',
      data: {
        action: 'joinFamily',
        data: { familyId: familyId }
      },
      success: res => {
        wx.hideLoading();
        if (res.result.success) {
          wx.showToast({ title: '加入家庭成功', icon: 'success' });
          this.closeFamilyManage();
          this.loadUserInfo();
        } else {
          wx.showToast({ title: res.result.errMsg || '加入失败', icon: 'none' });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('加入家庭失败:', err);
        wx.showToast({ title: '加入失败', icon: 'none' });
      }
    });
  },

  generateInviteCode() {
    if (!this.checkLoginAndPrompt()) return;
    wx.showLoading({ title: '生成中...' });

    wx.cloud.callFunction({
      name: 'manageFamily',
      data: { action: 'generateInvitationCode' },
      success: res => {
        wx.hideLoading();
        if (res.result.success) {
          this.setData({
            inviteCode: res.result.code,
            showInviteCode: true
          });
        } else {
          wx.showToast({ title: res.result.errMsg || '生成失败', icon: 'none' });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('生成邀请码失败:', err);
        wx.showToast({ title: '生成失败', icon: 'none' });
      }
    });
  },

  copyInviteCode() {
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' });
      }
    });
  },

  leaveFamily() {
    if (!this.checkLoginAndPrompt()) return;
    wx.showModal({
      title: '确认退出',
      content: '退出家庭后，您将不再能查看和管理家庭数据',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '退出中...' });
          
          wx.cloud.callFunction({
            name: 'manageFamily',
            data: { action: 'leaveFamily' },
            success: res => {
              wx.hideLoading();
              if (res.result.success) {
                wx.showToast({ title: '已退出家庭', icon: 'success' });
                this.closeFamilyManage();
                this.loadUserInfo();
              } else {
                wx.showToast({ title: res.result.errMsg || '退出失败', icon: 'none' });
              }
            },
            fail: err => {
              wx.hideLoading();
              console.error('退出家庭失败:', err);
              wx.showToast({ title: '退出失败', icon: 'none' });
            }
          });
        }
      }
    });
  },

  openEditProfile() {
    if (!this.checkLoginAndPrompt()) return;
    this.setData({
      showEditProfile: true,
      editUserInfo: {
        nickName: this.data.userInfo.nickName || '',
        avatarUrl: this.data.userInfo.avatarUrl || ''
      }
    });
  },

  closeEditProfile() {
    this.setData({
      showEditProfile: false,
      editUserInfo: {}
    });
  },

  onNickNameInput(e) {
    this.setData({
      'editUserInfo.nickName': e.detail.value
    });
  },

  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        
        wx.showLoading({ title: '上传中...' });
        
        const cloudPath = 'avatars/' + Date.now() + '-' + Math.random().toString(36).substr(2, 9) + '.jpg';
        
        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: tempFilePath,
          success: uploadRes => {
            wx.cloud.getTempFileURL({
              fileList: [uploadRes.fileID],
              success: fileRes => {
                wx.hideLoading();
                const tempFileURL = fileRes.fileList[0].tempFileURL;
                this.setData({
                  'editUserInfo.avatarUrl': tempFileURL,
                  'editUserInfo.avatarFileID': uploadRes.fileID
                });
              },
              fail: () => {
                wx.hideLoading();
                this.setData({
                  'editUserInfo.avatarUrl': uploadRes.fileID,
                  'editUserInfo.avatarFileID': uploadRes.fileID
                });
              }
            });
          },
          fail: err => {
            wx.hideLoading();
            console.error('上传头像失败:', err);
            wx.showToast({ title: '上传失败', icon: 'none' });
          }
        });
      }
    });
  },

  saveProfile() {
    if (!this.checkLoginAndPrompt()) return;
    const { editUserInfo } = this.data;
    
    if (!editUserInfo.nickName || !editUserInfo.nickName.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    wx.cloud.callFunction({
      name: 'getUserInfo',
      data: {
        action: 'updateProfile',
        nickName: editUserInfo.nickName,
        avatarUrl: editUserInfo.avatarFileID || editUserInfo.avatarUrl
      },
      success: res => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({ title: '保存成功', icon: 'success' });
          this.closeEditProfile();
          this.loadUserInfo();
        } else {
          wx.showToast({ title: res.result && res.result.errMsg || '保存失败', icon: 'none' });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('保存资料失败:', err);
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    });
  },

  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.globalData.userInfo = null;
          app.globalData.openid = null;
          app.globalData.isLoggedIn = false;
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('openid');
          
          wx.reLaunch({
            url: '/pages/login/login'
          });
        }
      }
    });
  },

  deleteAccount() {
    wx.showModal({
      title: '确认注销',
      content: '注销账号将永久删除您的所有数据，此操作不可恢复！确定要注销吗？',
      confirmText: '确认注销',
      confirmColor: '#FF5252',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.doDeleteAccount();
        }
      }
    });
  },

  async doDeleteAccount() {
    wx.showLoading({ title: '注销中...' });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'deleteAccount'
      });
      
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        wx.showToast({
          title: '注销成功',
          icon: 'success'
        });
        
        app.globalData.userInfo = null;
        app.globalData.openid = null;
        app.globalData.isLoggedIn = false;
        wx.removeStorageSync('userInfo');
        wx.removeStorageSync('openid');
        
        setTimeout(() => {
          wx.reLaunch({
            url: '/pages/login/login'
          });
        }, 1500);
      } else {
        wx.showToast({
          title: res.result?.errMsg || '注销失败',
          icon: 'none'
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('注销失败:', err);
      wx.showToast({
        title: '注销失败',
        icon: 'none'
      });
    }
  },

  showSettings() {
    this.setData({ showSettingsModal: true });
  },

  closeSettings() {
    this.setData({ showSettingsModal: false });
  },

  showHelp() {
    this.setData({ showHelpModal: true });
  },

  closeHelp() {
    this.setData({ showHelpModal: false });
  },

  toggleReminder() {
    this.setData({
      'settings.dailyReminder': !this.data.settings.dailyReminder
    });
  },

  toggleDarkMode() {
    this.setData({
      'settings.darkMode': !this.data.settings.darkMode
    });
  },

  viewServiceAgreement() {
    wx.navigateTo({
      url: '/pages/service-agreement/service-agreement'
    });
  },

  viewPrivacyPolicy() {
    wx.navigateTo({
      url: '/pages/privacy-policy/privacy-policy'
    });
  }
});