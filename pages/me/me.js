const app = getApp();
const db = wx.cloud.database();
const theme = require('../../utils/theme.js');
const permissionsUtil = require('../../utils/permissions.js');

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
    },
    showEditFamilyName: false,
    showDissolveFamily: false,
    editFamilyName: '',
    isFamilyCreator: false,
    currentUserOpenid: '',
    currentUserAccount: '',
    showAddAccountModal: false,
    availableAccounts: [],
    registrationEnabled: true, // 注册开关状态
    isAdmin: false, // 是否是管理员
    showRegistrationInvitationModal: false, // 注册邀请码弹窗
    registrationInvitationCode: '', // 注册邀请码
    showPermissionModal: false,
    editingPermissionMember: null,
    editingPermissions: {},
    permissionOptions: [
      { key: 'checkin', label: '打卡' },
      { key: 'homework', label: '作业管理' },
      { key: 'subjects', label: '科目管理' },
      { key: 'children', label: '孩子管理' },
      { key: 'rewards', label: '积分奖励' },
      { key: 'exchange', label: '积分兑换' },
      { key: 'ocr', label: 'OCR识别' }
    ]
  },

  onLoad() {
    // 恢复深色模式设置
    const savedDarkMode = wx.getStorageSync('darkMode');
    if (savedDarkMode !== undefined) {
      this.setData({
        'settings.darkMode': savedDarkMode
      });
      app.globalData.darkMode = savedDarkMode;
    }

    theme.syncDarkMode(this, {
      extraData: { 'settings.darkMode': app.globalData.darkMode }
    });
    
    this.loadUserInfo();
    this.loadRegistrationConfig();
  },

  onShow() {
    theme.syncDarkMode(this, {
      extraData: { 'settings.darkMode': app.globalData.darkMode }
    });
    this.loadUserInfo();
    // 如果用户有家庭，刷新家庭信息（不打开弹窗）
    if (app.globalData.userInfo && app.globalData.userInfo.familyId) {
      this.loadFamilyInfo(false);
    }
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
      const currentAccount = app.globalData.userInfo?.account || '';
      wx.cloud.callFunction({
        name: 'getUserInfo',
        data: {
          account: currentAccount
        },
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
            
            // 用户信息加载完成后，检查管理员状态
            this.checkAdminStatus();
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
      this.loadFamilyInfo(true);
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

  loadFamilyInfo(shouldOpenManage = false) {
    console.log('loadFamilyInfo 被调用，当前用户信息:', this.data.userInfo);
    
    wx.cloud.callFunction({
      name: 'manageFamily',
      data: { 
        action: 'getFamilyInfo',
        data: { account: this.data.userInfo.account || '' }
      },
      success: res => {
        console.log('loadFamilyInfo 云函数返回:', res);
        
        if (res.result && res.result.success) {
          const family = res.result.family;
          console.log('解析到家庭数据:', family);
          
          let isCreator = false;
          let currentOpenid = '';
          let currentAccount = '';
          
          if (family && family.members) {
            currentOpenid = app.globalData.openid;
            currentAccount = this.data.userInfo.account || '';
            const currentMember = family.members.find(m => m.openid === currentOpenid && m.account === currentAccount);
            isCreator = currentMember && currentMember.role === 'creator';
          }
          
          console.log('设置数据，familyInfo:', family, 'familyMembers:', family ? family.members : [], 'isFamilyCreator:', isCreator);
          
          this.setData({
            familyInfo: family,
            familyMembers: family ? family.members : [],
            showFamilyManage: shouldOpenManage,
            isFamilyCreator: isCreator,
            currentUserOpenid: currentOpenid,
            currentUserAccount: currentAccount
          }, () => {
            this.filterFamilyMembers();
          });
        } else {
          console.log('云函数返回失败，设置showFamilyManage为', shouldOpenManage);
          this.setData({ showFamilyManage: shouldOpenManage });
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
        data: { 
          familyName: this.data.familyName,
          account: this.data.userInfo.account || ''
        }
      },
      success: res => {
        wx.hideLoading();
        if (res.result && res.result.success) {
        wx.showToast({ title: '家庭创建成功', icon: 'success' });
        this.closeFamilyManage();
        setTimeout(() => {
          // 先加载用户信息
          this.loadUserInfo();
          // 再延迟加载家庭信息并打开家庭管理
          setTimeout(() => {
            this.setData({ showFamilyManage: true }, () => {
              this.loadFamilyInfo(false);
            });
          }, 500);
        }, 500);
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
        data: { 
          familyId: familyId,
          account: this.data.userInfo.account || ''
        }
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
      data: { 
        action: 'generateInvitationCode',
        data: { account: this.data.userInfo.account || '' }
      },
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
            data: { 
              action: 'leaveFamily',
              data: { account: this.data.userInfo.account || '' }
            },
            success: res => {
              wx.hideLoading();
              if (res.result.success) {
                wx.showToast({ title: '已退出家庭', icon: 'success' });
                // 清空家庭相关状态
                this.setData({
                  familyInfo: null,
                  familyMembers: [],
                  isFamilyCreator: false
                });
                // 更新用户信息并关闭家庭管理
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
    // 跳转到账号管理页面
    wx.navigateTo({
      url: '/pages/accounts/accounts'
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
        account: this.data.userInfo?.account || '',
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

  // 处理用户头像加载失败
  onAvatarError(e) {
    const context = e.currentTarget.dataset.context;
    if (context === 'user') {
      this.setData({
        'userInfo.avatarUrl': ''
      });
    } else if (context === 'edit') {
      this.setData({
        'editUserInfo.avatarUrl': ''
      });
    }
  },

  // 处理家庭成员头像加载失败
  onMemberAvatarError(e) {
    const index = e.currentTarget.dataset.index;
    const key = `familyMembers[${index}].avatarUrl`;
    this.setData({
      [key]: ''
    });
  },

  // 处理可选账号列表头像加载失败
  onAvailableAccountAvatarError(e) {
    const index = e.currentTarget.dataset.index;
    const key = `availableAccounts[${index}].avatarUrl`;
    this.setData({
      [key]: ''
    });
  },

  deleteAccount() {
    // 检查是否是只读账号
    if (this.data.userInfo.familyReadOnly) {
      wx.showModal({
        title: '提示',
        content: '您只有只读权限，无法注销账号',
        showCancel: false
      });
      return;
    }

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
        name: 'deleteAccount',
        data: { account: this.data.userInfo.account || '' }
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
    // 打开设置弹窗时重新检查管理员状态
    this.checkAdminStatus();
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

  stopPropagation() {
    // 阻止事件冒泡
  },

  toggleReminder() {
    this.setData({
      'settings.dailyReminder': !this.data.settings.dailyReminder
    });
  },

  toggleDarkMode() {
    const newDarkMode = !this.data.settings.darkMode;
    this.setData({
      'settings.darkMode': newDarkMode
    });

    theme.setGlobalDarkMode(newDarkMode);
    theme.syncDarkMode(this, {
      extraData: { 'settings.darkMode': newDarkMode }
    });
    theme.syncAllPages();

    wx.showToast({
      title: newDarkMode ? '已切换到深色模式' : '已切换到浅色模式',
      icon: 'success',
      duration: 1500
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
  },

  // 编辑家庭名称
  showEditFamilyName() {
    this.setData({
      showEditFamilyName: true,
      editFamilyName: this.data.familyInfo?.name || ''
    });
  },

  closeEditFamilyName() {
    this.setData({ showEditFamilyName: false });
  },

  onEditFamilyNameInput(e) {
    this.setData({ editFamilyName: e.detail.value });
  },

  async saveFamilyName() {
    if (!this.data.editFamilyName || !this.data.editFamilyName.trim()) {
      wx.showToast({ title: '请输入家庭名称', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'manageFamily',
        data: {
          action: 'updateFamilyName',
          data: {
            familyName: this.data.editFamilyName.trim(),
            account: this.data.userInfo.account || ''
          }
        }
      });

      wx.hideLoading();

      if (res.result && res.result.success) {
        wx.showToast({ title: '修改成功', icon: 'success' });
        this.closeEditFamilyName();
        this.loadFamilyInfo(false);
      } else {
        wx.showToast({ title: res.result?.errMsg || '修改失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('修改家庭名称失败:', err);
      wx.showToast({ title: '修改失败', icon: 'none' });
    }
  },



  // 移除家庭成员
  // 过滤家庭成员，非管理员看不到隐藏成员（除了自己）
  filterFamilyMembers() {
    const { familyMembers, isFamilyCreator, currentUserOpenid, currentUserAccount } = this.data;
    
    if (!familyMembers || familyMembers.length === 0) {
      this.setData({ displayFamilyMembers: [] });
      return;
    }
    
    // 确保所有成员都有 hidden 字段
    const normalizedMembers = familyMembers.map(member => ({
      ...member,
      hidden: member.hidden === true,
      isRestricted: permissionsUtil.isRestricted(member)
    }));
    
    // 如果是创建者，显示所有成员
    if (isFamilyCreator) {
      this.setData({ displayFamilyMembers: normalizedMembers });
    } else {
      // 非创建者，过滤掉隐藏的成员，但保留自己
      const displayMembers = normalizedMembers.filter(member => {
        const isMe = member.openid === currentUserOpenid && member.account === currentUserAccount;
        
        // 显示自己，或者显示未被隐藏的
        return isMe || !member.hidden;
      });
      
      this.setData({ displayFamilyMembers: displayMembers });
    }
  },

  // 切换成员隐藏状态
  async toggleMemberHidden(e) {
    const memberOpenid = e.currentTarget.dataset.openid;
    const memberAccount = e.currentTarget.dataset.account;
    const hidden = e.currentTarget.dataset.hidden;

    wx.showModal({
      title: '确认操作',
      content: hidden ? '确定要隐藏该成员吗？' : '确定要取消隐藏该成员吗？',
      success: async (modalRes) => {
        if (modalRes.confirm) {
          wx.showLoading({ title: '设置中...' });

          try {
            const res = await wx.cloud.callFunction({
              name: 'manageFamily',
              data: {
                action: 'setMemberHidden',
                data: { 
                  memberOpenid: memberOpenid,
                  memberAccount: memberAccount,
                  hidden: hidden,
                  account: this.data.userInfo.account || ''
                }
              }
            });

            wx.hideLoading();

            if (res.result && res.result.success) {
              wx.showToast({ title: '设置成功', icon: 'success' });
              this.loadFamilyInfo(false);
            } else {
              wx.showToast({ title: res.result?.errMsg || '设置失败', icon: 'none' });
            }
          } catch (err) {
            wx.hideLoading();
            console.error('设置失败:', err);
            wx.showToast({ title: '设置失败', icon: 'none' });
          }
        }
      }
    });
  },

  showMemberPermissionModal(e) {
    const memberOpenid = e.currentTarget.dataset.openid;
    const memberAccount = e.currentTarget.dataset.account || '';
    const member = (this.data.familyMembers || []).find(
      (item) => item.openid === memberOpenid && (item.account || '') === memberAccount
    );

    if (!member) {
      wx.showToast({ title: '成员不存在', icon: 'none' });
      return;
    }

    this.setData({
      showPermissionModal: true,
      editingPermissionMember: member,
      editingPermissions: permissionsUtil.normalizePermissions(member.permissions)
    });
  },

  closePermissionModal() {
    this.setData({
      showPermissionModal: false,
      editingPermissionMember: null,
      editingPermissions: {}
    });
  },

  onPermissionSwitchChange(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;
    this.setData({
      [`editingPermissions.${key}`]: value
    });
  },

  async saveMemberPermissions() {
    const member = this.data.editingPermissionMember;
    if (!member) {
      return;
    }

    if (member.readOnly) {
      wx.showToast({ title: '请先取消只读', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'manageFamily',
        data: {
          action: 'setMemberPermissions',
          data: {
            memberOpenid: member.openid,
            memberAccount: member.account || '',
            permissions: this.data.editingPermissions,
            account: this.data.userInfo.account || ''
          }
        }
      });

      wx.hideLoading();

      if (res.result && res.result.success) {
        wx.showToast({ title: '权限已更新', icon: 'success' });
        this.closePermissionModal();
        this.loadFamilyInfo(false);
      } else {
        wx.showToast({ title: res.result?.errMsg || '保存失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('保存权限失败:', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  // 切换成员只读状态
  async toggleMemberReadOnly(e) {
    const memberOpenid = e.currentTarget.dataset.openid;
    const memberAccount = e.currentTarget.dataset.account;
    const readOnly = e.currentTarget.dataset.readonly;

    wx.showModal({
      title: '确认操作',
      content: readOnly ? '确定要将该成员设为只读吗？' : '确定要取消该成员的只读状态吗？',
      success: async (modalRes) => {
        if (modalRes.confirm) {
          wx.showLoading({ title: '设置中...' });

          try {
            const res = await wx.cloud.callFunction({
              name: 'manageFamily',
              data: {
                action: 'setMemberReadOnly',
                data: { 
                  memberOpenid: memberOpenid,
                  memberAccount: memberAccount,
                  readOnly: readOnly,
                  account: this.data.userInfo.account || ''
                }
              }
            });

            wx.hideLoading();

            if (res.result && res.result.success) {
              wx.showToast({ title: '设置成功', icon: 'success' });
              this.loadFamilyInfo(false);
            } else {
              wx.showToast({ title: res.result?.errMsg || '设置失败', icon: 'none' });
            }
          } catch (err) {
            wx.hideLoading();
            console.error('设置失败:', err);
            wx.showToast({ title: '设置失败', icon: 'none' });
          }
        }
      }
    });
  },

  async removeFamilyMember(e) {
    const memberOpenid = e.currentTarget.dataset.openid;
    const memberAccount = e.currentTarget.dataset.account;

    wx.showModal({
      title: '确认移除',
      content: '确定要移除该成员吗？',
      confirmColor: '#FF5252',
      success: async (modalRes) => {
        if (modalRes.confirm) {
          wx.showLoading({ title: '移除中...' });

          try {
            const res = await wx.cloud.callFunction({
              name: 'manageFamily',
              data: {
                action: 'removeMember',
                data: { 
                  memberOpenid: memberOpenid,
                  memberAccount: memberAccount,
                  account: this.data.userInfo.account || ''
                }
              }
            });

            wx.hideLoading();

            if (res.result && res.result.success) {
              wx.showToast({ title: '移除成功', icon: 'success' });
              this.loadFamilyInfo(false);
            } else {
              wx.showToast({ title: res.result?.errMsg || '移除失败', icon: 'none' });
            }
          } catch (err) {
            wx.hideLoading();
            console.error('移除成员失败:', err);
            wx.showToast({ title: '移除失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 显示添加账号弹窗
  showAddAccountModal() {
    this.setData({ showAddAccountModal: true });
    this.loadAvailableAccounts();
  },

  // 关闭添加账号弹窗
  closeAddAccountModal() {
    this.setData({ showAddAccountModal: false, availableAccounts: [] });
  },

  // 加载可添加的账号
  async loadAvailableAccounts() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'manageFamily',
        data: {
          action: 'getAvailableAccounts',
          data: { account: this.data.userInfo.account || '' }
        }
      });

      if (res.result && res.result.success) {
        this.setData({ availableAccounts: res.result.accounts });
      } else {
        this.setData({ availableAccounts: [] });
      }
    } catch (err) {
      console.error('加载可添加账号失败:', err);
      this.setData({ availableAccounts: [] });
    }
  },

  // 添加账号到家庭
  async addAccountToFamily(e) {
    const targetAccount = e.currentTarget.dataset.account;
    
    wx.showModal({
      title: '确认添加',
      content: '确定要将该账号添加到家庭吗？',
      success: async (modalRes) => {
        if (modalRes.confirm) {
          wx.showLoading({ title: '添加中...' });

          try {
            const res = await wx.cloud.callFunction({
              name: 'manageFamily',
              data: {
                action: 'addSameOpenIdMember',
                data: {
                  targetAccount: targetAccount,
                  account: this.data.userInfo.account || ''
                }
              }
            });

            wx.hideLoading();

            if (res.result && res.result.success) {
              wx.showToast({ title: '添加成功', icon: 'success' });
              this.closeAddAccountModal();
              this.loadFamilyInfo(false);
            } else {
              wx.showToast({ title: res.result?.errMsg || '添加失败', icon: 'none' });
            }
          } catch (err) {
            wx.hideLoading();
            console.error('添加账号失败:', err);
            wx.showToast({ title: '添加失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 解散家庭
  showDissolveFamily() {
    this.setData({ showDissolveFamily: true });
  },

  closeDissolveFamily() {
    this.setData({ showDissolveFamily: false });
  },

  async confirmDissolveFamily() {
    wx.showLoading({ title: '解散中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'manageFamily',
        data: { 
          action: 'dissolveFamily',
          data: { account: this.data.userInfo.account || '' }
        }
      });

      wx.hideLoading();

      if (res.result && res.result.success) {
        wx.showToast({ title: '解散成功', icon: 'success' });
        this.closeDissolveFamily();
        this.closeFamilyManage();
        this.loadUserInfo();
      } else {
        wx.showToast({ title: res.result?.errMsg || '解散失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('解散家庭失败:', err);
      wx.showToast({ title: '解散失败', icon: 'none' });
    }
  },

  // 加载注册配置
  async loadRegistrationConfig() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'handleAuth',
        data: {
          action: 'getRegistrationConfig'
        }
      });

      if (res.result && res.result.success) {
        this.setData({
          registrationEnabled: res.result.registrationEnabled
        });
      }
    } catch (err) {
      console.error('获取注册配置失败:', err);
    }
  },

  // 检查管理员状态
  async checkAdminStatus() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'handleAuth',
        data: {
          action: 'checkAdminStatus',
          account: this.data.userInfo?.account || ''
        }
      });

      if (res.result && res.result.success) {
        this.setData({
          isAdmin: res.result.isAdmin
        });
      }
    } catch (err) {
      console.error('检查管理员状态失败:', err);
    }
  },

  // 生成注册邀请码
  async generateRegistrationInvitation() {
    wx.showLoading({ title: '生成中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'handleAuth',
        data: {
          action: 'generateRegistrationInvitation',
          account: this.data.userInfo?.account || ''
        }
      });

      wx.hideLoading();

      if (res.result && res.result.success) {
        this.setData({
          registrationInvitationCode: res.result.code,
          showRegistrationInvitationModal: true
        });
      } else {
        wx.showToast({ title: res.result?.errMsg || '生成失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('生成注册邀请码失败:', err);
      wx.showToast({ title: '生成失败', icon: 'none' });
    }
  },

  // 关闭注册邀请码弹窗
  closeRegistrationInvitationModal() {
    this.setData({
      showRegistrationInvitationModal: false,
      registrationInvitationCode: ''
    });
  },

  // 复制注册邀请码
  copyRegistrationInvitation() {
    wx.setClipboardData({
      data: this.data.registrationInvitationCode,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' });
      }
    });
  },

  // 切换注册开关
  async toggleRegistration() {
    const newStatus = !this.data.registrationEnabled;
    
    wx.showLoading({ title: '设置中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'handleAuth',
        data: {
          action: 'setRegistrationConfig',
          enabled: newStatus,
          account: this.data.userInfo?.account || ''
        }
      });

      wx.hideLoading();

      if (res.result && res.result.success) {
        this.setData({
          registrationEnabled: newStatus
        });
        wx.showToast({
          title: newStatus ? '注册已开启' : '注册已关闭',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: res.result?.errMsg || '设置失败',
          icon: 'none'
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('设置注册配置失败:', err);
      wx.showToast({
        title: '设置失败',
        icon: 'none'
      });
    }
  }
});