const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    userInfo: {
      points: 0
    },
    rewards: [],
    exchangeRecords: [],
    showHistory: false,
    showAddCustomModal: false,
    customGift: {
      name: '',
      points: '',
      description: '',
      image: ''
    }
  },

  onLoad() {
    // 检查登录状态
    if (!app.globalData.isLoggedIn && !app.globalData.openid) {
      console.log('用户未登录，跳转到登录页面');
      wx.navigateTo({
        url: '/pages/login/login'
      });
      return;
    }

    this.loadUserInfo();
    this.loadRewards();
    this.loadExchangeRecords();
  },

  onShow() {
    this.loadUserInfo();
  },

  // 加载用户信息
  loadUserInfo() {
    // 如果没有用户信息，尝试获取
    if (!app.globalData.userInfo) {
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo) {
        app.globalData.userInfo = JSON.parse(userInfo);
      }
    }

    if (app.globalData.userInfo) {
      this.setData({
        userInfo: {
          ...app.globalData.userInfo,
          points: 0
        }
      });
    }

    // 如果已登录，加载用户数据
    if (app.globalData.openid) {
      db.collection('users').get().then(res => {
        if (res.data.length > 0) {
          this.setData({
            userInfo: res.data[0]
          });
          app.globalData.userInfo = res.data[0];
          
          // 保存用户信息到本地存储
          wx.setStorageSync('userInfo', JSON.stringify(res.data[0]));
          
          // 标记为已登录
          app.globalData.isLoggedIn = true;
        } else {
          // 如果没有用户记录，可能需要重新登录
          console.error('未找到用户记录');
          app.clearUserInfo();
          wx.navigateTo({
            url: '/pages/login/login'
          });
        }
      }).catch(err => {
        console.error('获取用户信息失败:', err);
        wx.showToast({
          title: '获取用户信息失败',
          icon: 'none'
        });
      });
    } else {
      // 如果未登录，跳转到登录页面
      console.log('用户未登录，跳转到登录页面');
      wx.navigateTo({
        url: '/pages/login/login'
      });
    }
  },

  // 加载奖励列表
  loadRewards() {
    wx.showLoading({
      title: '加载中...'
    });

    db.collection('rewards')
      .orderBy('points', 'asc')
      .get()
      .then(res => {
        wx.hideLoading();
        this.setData({
          rewards: res.data
        });
      })
      .catch(err => {
        wx.hideLoading();
        console.error(err);
      });
  },

  // 加载兑换记录
  loadExchangeRecords() {
    db.collection('exchange_records')
      .orderBy('createTime', 'desc')
      .limit(10)
      .get()
      .then(res => {
        this.setData({
          exchangeRecords: res.data.map(item => ({
            ...item,
            createTime: this.formatDateTime(item.createTime)
          }))
        });
      });
  },

  // 兑换奖励
  exchangeReward(e) {
    const rewardId = e.currentTarget.dataset.id;
    const points = e.currentTarget.dataset.points;

    if (this.data.userInfo.points < points) {
      wx.showToast({
        title: '积分不足',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认兑换',
      content: `确定消耗${points}积分兑换此奖励吗？`,
      success: (res) => {
        if (res.confirm) {
          this.doExchange(rewardId);
        }
      }
    });
  },

  // 执行兑换
  doExchange(rewardId) {
    wx.showLoading({
      title: '兑换中...'
    });

    wx.cloud.callFunction({
      name: 'exchangeReward',
      data: {
        rewardId: rewardId
      },
      success: (res) => {
        wx.hideLoading();
        if (res.result.success) {
          wx.showToast({
            title: '兑换成功',
            icon: 'success'
          });

          // 刷新数据
          this.loadUserInfo();
          this.loadExchangeRecords();

          setTimeout(() => {
            wx.showModal({
              title: '兑换成功',
              content: `剩余积分：${res.result.remainingPoints}`,
              showCancel: false
            });
          }, 1500);
        } else {
          wx.showToast({
            title: res.result.message || '兑换失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({
          title: '兑换失败',
          icon: 'none'
        });
        console.error(err);
      }
    });
  },

  // 显示兑换记录
  goToHistory() {
    this.setData({
      showHistory: true
    });
  },

  // 关闭兑换记录
  closeHistory() {
    this.setData({
      showHistory: false
    });
  },

  // 格式化日期时间
  formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  showAddCustom() {
    this.setData({
      showAddCustomModal: true,
      customGift: {
        name: '',
        points: '',
        description: '',
        image: ''
      }
    });
  },

  closeAddCustom() {
    this.setData({
      showAddCustomModal: false
    });
  },

  onCustomNameInput(e) {
    this.setData({
      'customGift.name': e.detail.value
    });
  },

  onCustomPointsInput(e) {
    this.setData({
      'customGift.points': e.detail.value
    });
  },

  onCustomDescInput(e) {
    this.setData({
      'customGift.description': e.detail.value
    });
  },

  chooseCustomImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        this.uploadCustomImage(tempFilePath);
      }
    });
  },

  uploadCustomImage(filePath) {
    wx.showLoading({ title: '上传中...' });
    const cloudPath = `rewards/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
    
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath,
      success: (res) => {
        wx.hideLoading();
        this.setData({
          'customGift.image': res.fileID
        });
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        });
        console.error(err);
      }
    });
  },

  saveCustomGift() {
    const { name, points, description, image } = this.data.customGift;
    
    if (!name || !name.trim()) {
      wx.showToast({
        title: '请输入礼物名称',
        icon: 'none'
      });
      return;
    }
    
    if (!points || parseInt(points) <= 0) {
      wx.showToast({
        title: '请输入有效积分',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    db.collection('rewards').add({
      data: {
        name: name.trim(),
        points: parseInt(points),
        description: description || '',
        image: image || 'custom',
        stock: 999,
        isCustom: true,
        createTime: db.serverDate()
      }
    }).then(res => {
      wx.hideLoading();
      wx.showToast({
        title: '添加成功',
        icon: 'success'
      });
      this.setData({
        showAddCustomModal: false,
        customGift: {
          name: '',
          points: '',
          description: '',
          image: ''
        }
      });
      this.loadRewards();
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
      console.error(err);
    });
  }
});
