const app = getApp();

Page({
  data: {
    accounts: [],
    currentAccountId: '',
    showEditProfile: false,
    editUserInfo: {},
    isCreator: false,
    isOriginalCreatorGlobal: false,
    hasFamily: false,
    familyId: ''
  },

  onLoad() {
    const userInfo = app.globalData.userInfo;
    
    if (app.globalData.originalCreatorAccount === '' || app.globalData.isOriginalCreator === false) {
      app.globalData.isOriginalCreator = userInfo && userInfo.familyRole === 'creator';
      app.globalData.originalCreatorAccount = userInfo && userInfo.familyRole === 'creator' ? (userInfo.account || '') : '';
    }
    
    this.setData({
      isOriginalCreatorGlobal: app.globalData.isOriginalCreator,
      currentAccountId: app.globalData.userId || ''
    });
    
    if (userInfo) {
      this.setData({
        accounts: [userInfo]
      });
    }
    
    this.loadAccounts();
  },

  onShow() {
    this.loadAccounts();
  },

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

    const isCreatorLocal = userInfo.familyRole === 'creator';
    console.log('本地familyRole:', userInfo.familyRole, 'isCreatorLocal:', isCreatorLocal);
    
    this.setData({
      hasFamily: true,
      familyId: userInfo.familyId,
      isCreator: isCreatorLocal
    });

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
      return isCreatorLocal;
    }).catch(err => {
      console.error('检查创建者身份失败:', err);
      return isCreatorLocal;
    });
  },

  loadAccounts() {
    console.log('加载账号列表');
    wx.showLoading({ title: '加载中...' });
    
    this.checkIsCreator().then(() => {
      const userInfo = app.globalData.userInfo;
      const hasFamily = userInfo && userInfo.familyId;
      
      if (hasFamily) {
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
                  readOnly: member.readOnly || false,
                  inFamily: true
                };
              }
              return {
                ...account,
                inFamily: false
              };
            });
          } else {
            allAccounts = allAccounts.map(account => ({
              ...account,
              inFamily: false
            }));
          }
          
          let displayAccounts = allAccounts;
          if (!app.globalData.isOriginalCreator && this.data.hasFamily) {
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
            currentAccountId: app.globalData.userId,
            isOriginalCreatorGlobal: app.globalData.isOriginalCreator
          }, () => {
            console.log('setData 完成，当前数据:', this.data);
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('加载账号失败:', err);
        if (app.globalData.userInfo) {
          this.setData({
            accounts: [app.globalData.userInfo],
            currentAccountId: app.globalData.userId,
            isOriginalCreatorGlobal: app.globalData.isOriginalCreator
          });
        }
      }
    });
  },

  switchAccount(e) {
    console.log('切换账号被点击');
    const account = e.currentTarget.dataset.account;
    console.log('目标账号:', account);
    
    if (account._id === this.data.currentAccountId) {
      console.log('已经是当前账号，不切换');
      return;
    }

    if (!app.globalData.isOriginalCreator && this.data.hasFamily) {
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
          app.saveUserInfo(userInfo);
          
          this.setData({
            currentAccountId: userInfo._id
          });
          
          this.checkIsCreator();
          this.loadAccounts();
          
          wx.showToast({
            title: '切换成功',
            icon: 'success'
          });
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

  goToAddAccount() {
    if (!app.globalData.isOriginalCreator && this.data.hasFamily) {
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

  openEditProfile() {
    this.setData({
      showEditProfile: true,
      editUserInfo: {
        nickName: app.globalData.userInfo?.nickName || '',
        avatarUrl: app.globalData.userInfo?.avatarUrl || ''
      }
    });
  },

  closeEditProfile() {
    this.setData({
      showEditProfile: false,
      editUserInfo: {}
    });
  },

  stopPropagation() {
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
  },

  toggleAccountReadOnly(e) {
    const memberAccount = e.currentTarget.dataset.account;
    const readOnly = e.currentTarget.dataset.readonly;

    wx.showModal({
      title: '确认操作',
      content: readOnly ? '确定要设置该账号为只读权限吗？' : '确定要取消该账号的只读权限吗？',
      success: async (modalRes) => {
        if (modalRes.confirm) {
          wx.showLoading({ title: '设置中...' });

          try {
            const res = await wx.cloud.callFunction({
              name: 'manageFamily',
              data: {
                action: 'setMemberReadOnly',
                data: {
                  memberOpenid: app.globalData.openid,
                  memberAccount: memberAccount,
                  readOnly: readOnly,
                  account: app.globalData.originalCreatorAccount || ''
                }
              }
            });

            wx.hideLoading();

            if (res.result && res.result.success) {
              wx.showToast({ title: '设置成功', icon: 'success' });
              this.loadAccounts();
            } else {
              wx.showToast({ title: res.result?.errMsg || '设置失败', icon: 'none' });
            }
          } catch (err) {
            wx.hideLoading();
            console.error('设置权限失败:', err);
            wx.showToast({ title: '设置失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 处理账号列表头像加载失败
  onAccountAvatarError(e) {
    const index = e.currentTarget.dataset.index;
    const key = `accounts[${index}].avatarUrl`;
    this.setData({
      [key]: ''
    });
  },

  // 处理编辑头像加载失败
  onEditAvatarError() {
    this.setData({
      'editUserInfo.avatarUrl': ''
    });
  }
});
