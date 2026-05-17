const app = getApp();

Page({
  data: {
    accounts: [],
    currentAccountId: '',
    showEditProfile: false,
    editUserInfo: {},
    isCreator: false, // 当前账号是否是家庭创建者
    hasFamily: false, // 是否有家庭
    familyId: '' // 当前家庭ID
  },

  onLoad() {
    this.loadAccounts();
  },

  onShow() {
    this.loadAccounts();
  },

  // 检查当前账号是否是家庭创建者
  checkIsCreator() {
    const userInfo = app.globalData.userInfo;
    console.log('检查创建者身份，userInfo:', userInfo);
    
    if (!userInfo || !userInfo.familyId) {
      console.log('没有家庭信息');
      this.setData({
        isCreator: false,
        hasFamily: false,
        familyId: ''
      });
      return Promise.resolve(false);
    }

    // 先检查本地存储的角色信息
    const isCreatorLocal = userInfo.familyRole === 'creator';
    console.log('本地familyRole:', userInfo.familyRole, 'isCreatorLocal:', isCreatorLocal);
    
    this.setData({
      hasFamily: true,
      familyId: userInfo.familyId,
      isCreator: isCreatorLocal // 先用本地信息
    });

    // 同时获取家庭信息确认角色
    return wx.cloud.callFunction({
      name: 'manageFamily',
      data: {
        action: 'getFamilyInfo',
        data: { account: userInfo.account || '' }
      }
    }).then(res => {
      console.log('getFamilyInfo 返回:', res);
      if (res.result && res.result.success && res.result.family) {
        const family = res.result.family;
        const currentMember = family.members.find(m => 
          m.openid === app.globalData.openid && 
          (m.account || '') === (userInfo.account || '')
        );
        const isCreator = currentMember && currentMember.role === 'creator';
        console.log('从家庭信息确认角色，isCreator:', isCreator);
        this.setData({ isCreator });
        return isCreator;
      }
      // 如果云函数失败，保留本地信息
      return isCreatorLocal;
    }).catch(err => {
      console.error('检查创建者身份失败:', err);
      // 如果云函数失败，保留本地信息
      return isCreatorLocal;
    });
  },

  // 加载账号列表
  loadAccounts() {
    console.log('加载账号列表');
    wx.showLoading({ title: '加载中...' });
    
    // 先检查当前账号是否是创建者
    this.checkIsCreator().then(isCreator => {
      console.log('checkIsCreator 完成，isCreator:', isCreator);
      
      // 如果有家庭，先获取家庭信息
      const userInfo = app.globalData.userInfo;
      const hasFamily = userInfo && userInfo.familyId;
      
      if (hasFamily) {
        // 获取家庭信息，以便显示角色标签
        wx.cloud.callFunction({
          name: 'manageFamily',
          data: {
            action: 'getFamilyInfo',
            data: { account: userInfo.account || '' }
          }
        }).then(familyRes => {
          console.log('getFamilyInfo 返回:', familyRes);
          this.loadAccountList(familyRes.result && familyRes.result.family);
        }).catch(err => {
          console.error('获取家庭信息失败:', err);
          this.loadAccountList(null);
        });
      } else {
        this.loadAccountList(null);
      }
    });
  },

  // 加载账号列表
  loadAccountList(familyInfo) {
    wx.cloud.callFunction({
      name: 'login',
      data: {
        account: app.globalData.userInfo?.account || ''
      },
      success: (res) => {
        wx.hideLoading();
        console.log('login 云函数返回:', res);
        
        if (res.result && res.result.success !== false) {
          let allAccounts = res.result.allAccounts || [];
          console.log('所有账号:', allAccounts);
          
          // 如果有家庭信息，补充角色和只读信息
          if (familyInfo && familyInfo.members) {
            allAccounts = allAccounts.map(account => {
              const member = familyInfo.members.find(m => 
                m.openid === app.globalData.openid && 
                (m.account || '') === (account.account || '')
              );
              if (member) {
                return {
                  ...account,
                  familyRole: member.role,
                  readOnly: member.readOnly || false
                };
              }
              return account;
            });
          }
          
          // 如果是创建者，显示所有账号；否则只显示当前账号
          let displayAccounts = allAccounts;
          if (!this.data.isCreator && this.data.hasFamily) {
            // 非创建者且有家庭，只显示当前账号
            displayAccounts = allAccounts.filter(account => 
              account._id === app.globalData.userId
            );
            console.log('非创建者，只显示当前账号:', displayAccounts);
          } else {
            console.log('创建者或无家庭，显示所有账号:', displayAccounts);
          }
          
          console.log('显示的账号:', displayAccounts);
          console.log('当前用户ID:', app.globalData.userId);
          
          this.setData({
            accounts: displayAccounts,
            currentAccountId: app.globalData.userId
          }, () => {
            console.log('setData 完成，当前数据:', this.data);
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('加载账号失败:', err);
        // 如果失败，至少显示当前账号
        if (app.globalData.userInfo) {
          this.setData({
            accounts: [app.globalData.userInfo],
            currentAccountId: app.globalData.userId
          });
        }
      }
    });
  },

  // 切换账号
  switchAccount(e) {
    console.log('切换账号被点击');
    const account = e.currentTarget.dataset.account;
    console.log('目标账号:', account);
    console.log('当前状态:', {
      isCreator: this.data.isCreator,
      hasFamily: this.data.hasFamily,
      currentAccountId: this.data.currentAccountId
    });
    
    if (account._id === this.data.currentAccountId) {
      console.log('已经是当前账号，不切换');
      return;
    }

    // 检查是否有权限切换账号
    if (!this.data.isCreator && this.data.hasFamily) {
      wx.showModal({
        title: '提示',
        content: '只有家庭创建者才能切换账号',
        showCancel: false
      });
      return;
    }

    console.log('开始切换账号...');

    wx.showLoading({ title: '切换中...' });

    wx.cloud.callFunction({
      name: 'login',
      data: {
        account: account.account || ''
      },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.success !== false) {
          const userInfo = res.result.userInfo;
          
          // 更新 app 全局数据
          app.saveUserInfo(userInfo);
          
          // 更新当前页面的数据
          this.setData({
            currentAccountId: userInfo._id
          });
          
          // 重新加载账号列表（可能角色信息有变化）
          this.checkIsCreator();
          
          wx.showToast({
            title: '切换成功',
            icon: 'success'
          });

          // 延迟返回，让用户看到提示
          setTimeout(() => {
            wx.navigateBack();
          }, 800);
        } else {
          wx.showToast({
            title: '切换失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('切换账号失败:', err);
        wx.showToast({
          title: '切换失败',
          icon: 'none'
        });
      }
    });
  },

  // 跳转到添加账号页面
  goToAddAccount() {
    // 如果不是创建者且有家庭，禁止添加
    if (!this.data.isCreator && this.data.hasFamily) {
      wx.showModal({
        title: '提示',
        content: '只有家庭创建者才能添加和管理其他账号',
        showCancel: false
      });
      return;
    }
    
    wx.navigateTo({
      url: '/pages/login/login'
    });
  },

  // 打开编辑资料弹窗
  openEditProfile() {
    // 每个账号都可以编辑自己的资料
    this.setData({
      showEditProfile: true,
      editUserInfo: {
        nickName: app.globalData.userInfo?.nickName || '',
        avatarUrl: app.globalData.userInfo?.avatarUrl || ''
      }
    });
  },

  // 关闭编辑资料弹窗
  closeEditProfile() {
    this.setData({
      showEditProfile: false,
      editUserInfo: {}
    });
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 阻止事件冒泡
  },

  // 昵称输入
  onNickNameInput(e) {
    this.setData({
      'editUserInfo.nickName': e.detail.value
    });
  },

  // 选择头像
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

  // 保存资料
  saveProfile() {
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
        account: app.globalData.userInfo?.account || '',
        nickName: editUserInfo.nickName,
        avatarUrl: editUserInfo.avatarFileID || editUserInfo.avatarUrl
      },
      success: res => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({ title: '保存成功', icon: 'success' });
          this.closeEditProfile();
          this.loadAccounts();
          
          // 更新 app 全局数据
          app.saveUserInfo(res.result.userInfo);
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
  }
});
