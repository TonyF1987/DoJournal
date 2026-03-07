const db = wx.cloud.database();

Page({
  data: {
    homeworkId: '',
    points: 0,
    streak: 0,
    homework: null,
    posterImage: '',
    canvasWidth: 0,
    canvasHeight: 0
  },

  onLoad(options) {
    if (options.homeworkId) {
      this.setData({
        homeworkId: options.homeworkId,
        points: parseInt(options.points) || 0,
        streak: parseInt(options.streak) || 0
      });
      this.loadHomework();
    }

    // 生成海报
    setTimeout(() => {
      this.generatePoster();
    }, 500);
  },

  // 加载作业信息
  loadHomework() {
    db.collection('homework')
      .doc(this.data.homeworkId)
      .get()
      .then(res => {
        this.setData({
          homework: res.data
        });
      });
  },

  // 生成海报
  generatePoster() {
    wx.showLoading({
      title: '生成中...'
    });

    const query = wx.createSelectorQuery();
    query.select('#posterCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0]) {
          wx.hideLoading();
          return;
        }

        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');

        // 设置画布尺寸
        const dpr = wx.getSystemInfoSync().pixelRatio;
        const width = 600 * dpr;
        const height = 900 * dpr;

        canvas.width = width;
        canvas.height = height;
        ctx.scale(dpr, dpr);

        this.setData({
          canvasWidth: 600,
          canvasHeight: 900
        });

        // 绘制背景
        const gradient = ctx.createLinearGradient(0, 0, 0, 900);
        gradient.addColorStop(0, '#4CAF50');
        gradient.addColorStop(1, '#45a049');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 600, 900);

        // 绘制白色卡片
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 10;
        this.roundRect(ctx, 40, 100, 520, 700, 20);
        ctx.fill();
        ctx.shadowColor = 'transparent';

        // 绘制标题
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('作业打卡成功！', 300, 180);

        // 绘制作业信息
        if (this.data.homework) {
          ctx.fillStyle = '#666666';
          ctx.font = '32px sans-serif';
          ctx.fillText(this.data.homework.title, 300, 260);

          if (this.data.homework.content) {
            ctx.font = '28px sans-serif';
            ctx.fillText(this.data.homework.content.substring(0, 30) + '...', 300, 310);
          }
        }

        // 绘制积分
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 80px sans-serif';
        ctx.fillText(`+${this.data.points}积分`, 300, 450);

        // 绘制连续打卡
        if (this.data.streak > 0) {
          ctx.fillStyle = '#FF5252';
          ctx.font = 'bold 40px sans-serif';
          ctx.fillText(`🔥 连续打卡${this.data.streak}天`, 300, 520);

          if (this.data.streak >= 3) {
            ctx.font = '28px sans-serif';
            ctx.fillStyle = '#FFA500';
            ctx.fillText('连续奖励已激活！', 300, 570);
          }
        }

        // 绘制时间
        const now = new Date();
        const dateStr = `${now.getMonth() + 1}月${now.getDate()}日`;
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        ctx.fillStyle = '#999999';
        ctx.font = '24px sans-serif';
        ctx.fillText(`${dateStr} ${timeStr}`, 300, 640);

        // 绘制底部装饰
        ctx.fillStyle = '#4CAF50';
        ctx.font = '24px sans-serif';
        ctx.fillText('快来加入作业打卡吧！', 300, 720);

        // 导出图片
        setTimeout(() => {
          wx.canvasToTempFilePath({
            canvas: canvas,
            success: (res) => {
              wx.hideLoading();
              this.setData({
                posterImage: res.tempFilePath
              });
            },
            fail: (err) => {
              wx.hideLoading();
              console.error('导出图片失败', err);
              wx.showToast({
                title: '生成失败',
                icon: 'none'
              });
            }
          });
        }, 100);
      });
  },

  // 绘制圆角矩形
  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
  },

  // 保存海报到相册
  savePoster() {
    if (!this.data.posterImage) {
      return;
    }

    wx.saveImageToPhotosAlbum({
      filePath: this.data.posterImage,
      success: () => {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
      },
      fail: (err) => {
        if (err.errMsg.includes('auth')) {
          wx.showModal({
            title: '需要相册权限',
            content: '请前往设置开启相册权限',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting();
              }
            }
          });
        } else {
          wx.showToast({
            title: '保存失败',
            icon: 'none'
          });
        }
      }
    });
  },

  // 分享到朋友圈
  shareToMoments() {
    wx.showModal({
      title: '分享提示',
      content: '请先保存海报到相册，然后在朋友圈发布时选择保存的图片',
      confirmText: '保存海报',
      success: (res) => {
        if (res.confirm) {
          this.savePoster();
        }
      }
    });
  },

  // 返回
  goBack() {
    wx.navigateBack();
  },

  // 分享给好友
  onShareAppMessage() {
    return {
      title: '我完成了作业打卡，获得了积分奖励！',
      path: '/pages/index/index',
      imageUrl: this.data.posterImage
    };
  }
});
