const app = getApp();
const db = wx.cloud.database();
const theme = require('../../utils/theme.js');
const permissionsUtil = require('../../utils/permissions.js');

Page({
  data: {
    homeworkId: '',
    checkinDate: '',
    homework: null,
    proofImage: '',
    comment: '',
    rating: 0,
    ratingPercent: 0,
    actualPoints: 0,
    isReadOnly: false,
    canCheckin: true
  },

  onLoad(options) {
    theme.syncDarkMode(this);
    // 检查登录状态
    if (!app.globalData.isLoggedIn && !app.globalData.openid) {
      console.log('用户未登录，跳转到登录页面');
      wx.navigateTo({
        url: '/pages/login/login'
      });
      return;
    }

    if (options.id) {
      this.setData({ 
        homeworkId: options.id,
        checkinDate: options.date || ''
      });
      this.loadPermissions();
      this.loadHomework();
    }
  },

  loadPermissions() {
    if (!app.globalData.openid) {
      return;
    }

    const currentAccount = app.globalData.userInfo?.account || '';
    wx.cloud.callFunction({
      name: 'getUserInfo',
      data: { account: currentAccount },
      success: (res) => {
        if (res.result && res.result.success) {
          const userInfo = res.result.userInfo;
          const currentMember = userInfo.familyMembers
            ? permissionsUtil.findFamilyMember(userInfo.familyMembers, app.globalData.openid, currentAccount)
            : null;
          const perms = userInfo.familyPermissions || permissionsUtil.getMemberPermissions(currentMember);
          this.setData({
            isReadOnly: permissionsUtil.hasReadOnly(currentMember),
            canCheckin: !!perms.checkin
          });
        }
      }
    });
  },

  onShow() {
    theme.syncDarkMode(this);
  },

  // 加载作业详情
  loadHomework() {
    wx.showLoading({
      title: '加载中...'
    });

    db.collection('homework')
      .doc(this.data.homeworkId)
      .get()
      .then(res => {
        wx.hideLoading();
        this.setData({
          homework: {
            ...res.data,
            createTime: this.formatDateTime(res.data.createTime)
          }
        });
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
      });
  },

  // 选择凭证图片
  chooseProofImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({
          proofImage: res.tempFilePaths[0]
        });
      }
    });
  },

  // 删除凭证图片
  deleteProofImage() {
    this.setData({
      proofImage: ''
    });
  },

  // 输入评语
  onCommentInput(e) {
    this.setData({
      comment: e.detail.value
    });
  },

  // 选择等级评价
  selectRating(e) {
    const rating = parseInt(e.currentTarget.dataset.rating);
    const ratingPercents = { 1: 60, 2: 80, 3: 100 };
    const ratingPercent = ratingPercents[rating];
    
    let actualPoints = 0;
    if (this.data.homework) {
      actualPoints = Math.round(this.data.homework.points * ratingPercent / 100);
    }

    this.setData({
      rating: rating,
      ratingPercent: ratingPercent,
      actualPoints: actualPoints
    });
  },

  // 预览图片
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    const urls = e.currentTarget.dataset.urls;
    wx.previewImage({
      current: url,
      urls: urls
    });
  },

  // 提交打卡
  submitCheckIn() {
    if (this.data.isReadOnly || !this.data.canCheckin) {
      wx.showToast({
        title: this.data.isReadOnly ? '您只有只读权限，无法打卡' : '您没有打卡权限',
        icon: 'none'
      });
      return;
    }

    if (!this.data.proofImage) {
      wx.showToast({
        title: '请上传完成凭证',
        icon: 'none'
      });
      return;
    }

    if (this.data.rating === 0) {
      wx.showToast({
        title: '请选择完成质量评价',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '上传中...'
    });

    // 上传图片到云存储
    const cloudPath = `checkin/${Date.now()}.jpg`;
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: this.data.proofImage,
      success: (res) => {
        // 调用云函数完成打卡
        wx.cloud.callFunction({
          name: 'completeHomework',
          data: {
            homeworkId: this.data.homeworkId,
            proofImage: res.fileID,
            comment: this.data.comment,
            rating: this.data.rating,
            ratingPercent: this.data.ratingPercent,
            checkinDate: this.data.checkinDate,
            account: app.globalData.userInfo?.account || ''
          },
          success: (cloudRes) => {
            wx.hideLoading();
            const { points, streak, streakBonus } = cloudRes.result;

            wx.showModal({
              title: '打卡成功！',
              content: `获得${points}积分\n连续打卡${streak}天${streakBonus > 0 ? '\n连续奖励+' + streakBonus + '分' : ''}`,
              confirmText: '去分享',
              cancelText: '返回',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  wx.navigateTo({
                    url: `/pages/share/share?homeworkId=${this.data.homeworkId}&points=${points}&streak=${streak}`
                  });
                } else {
                  wx.navigateBack();
                }
              }
            });
          },
          fail: (err) => {
            wx.hideLoading();
            wx.showToast({
              title: '打卡失败',
              icon: 'none'
            });
            console.error(err);
          }
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

  // 格式化日期时间
  formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
});
