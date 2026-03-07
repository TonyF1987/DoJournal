const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    userInfo: {
      points: 0
    },
    rewards: [],
    exchangeRecords: [],
    showHistory: false
  },

  onLoad() {
    this.loadUserInfo();
    this.loadRewards();
    this.loadExchangeRecords();
  },

  onShow() {
    this.loadUserInfo();
  },

  // 加载用户信息
  loadUserInfo() {
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: {
          ...app.globalData.userInfo,
          points: 0
        }
      });
    }

    db.collection('users').get().then(res => {
      if (res.data.length > 0) {
        this.setData({
          userInfo: res.data[0]
        });
      }
    });
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
  }
});
