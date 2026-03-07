const db = wx.cloud.database();

Page({
  data: {
    homeworkId: '',
    homework: null,
    proofImage: '',
    comment: '',
    rating: 0,
    ratingPercent: 0,
    actualPoints: 0
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ homeworkId: options.id });
      this.loadHomework();
    }
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
            ratingPercent: this.data.ratingPercent
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
