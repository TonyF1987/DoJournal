const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    greeting: '',
    userInfo: {
      nickName: '小宝贝',
      avatarUrl: '',
      points: 0,
      streak: 0
    },
    pendingHomework: [],
    completedHomework: [],
    completedToday: 0
  },

  onLoad() {
    this.setGreeting();
    this.loadUserInfo();
    this.loadHomework();
  },

  onShow() {
    this.loadUserInfo();
    this.loadHomework();
  },

  setGreeting() {
    const hour = new Date().getHours();
    let greeting = '';
    if (hour < 6) {
      greeting = '夜深了';
    } else if (hour < 9) {
      greeting = '早上好';
    } else if (hour < 12) {
      greeting = '上午好';
    } else if (hour < 14) {
      greeting = '中午好';
    } else if (hour < 18) {
      greeting = '下午好';
    } else if (hour < 22) {
      greeting = '晚上好';
    } else {
      greeting = '夜深了';
    }
    this.setData({ greeting });
  },

  loadUserInfo() {
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: {
          ...app.globalData.userInfo,
          points: 0,
          streak: 0
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

  loadHomework() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = new Date().getDay();
    const todayStr = today.toISOString().split('T')[0];
    const weekDayNames = ['日', '一', '二', '三', '四', '五', '六'];

    db.collection('homework')
      .where({
        status: 'pending'
      })
      .orderBy('createTime', 'desc')
      .limit(20)
      .get()
      .then(async (res) => {
        const allHomework = res.data.map(item => ({
          ...item,
          createTime: this.formatDate(item.createTime),
          checkInTime: this.formatDateTime(item.checkInTime),
          recurringDaysText: item.recurring ? this.formatRecurringDays(item.recurringDays) : ''
        }));

        const pendingList = allHomework.filter(item => {
          if (!item.recurring) return true;
          return item.recurringDays && item.recurringDays.includes(dayOfWeek);
        });

        const recurringIds = pendingList.filter(item => item.recurring).map(item => item._id);

        let todayCheckins = [];
        if (recurringIds.length > 0) {
          const checkinRes = await db.collection('checkins')
            .where({
              homeworkId: db.command.in(recurringIds),
              date: todayStr
            })
            .get();
          todayCheckins = checkinRes.data;
        }

        const checkedInIds = todayCheckins.map(c => c.homeworkId);

        const finalPendingList = pendingList.filter(item => {
          if (item.recurring) {
            return !checkedInIds.includes(item._id);
          }
          return true;
        });

        const todayCompletedList = pendingList.filter(item => {
          return item.recurring && checkedInIds.includes(item._id);
        }).map(item => {
          const checkin = todayCheckins.find(c => c.homeworkId === item._id);
          return {
            ...item,
            checkInTime: this.formatDateTime(checkin ? checkin.createTime : new Date()),
            points: checkin ? Math.round(item.points * (checkin.ratingPercent || 100) / 100) : item.points
          };
        });

        this.setData({
          pendingHomework: finalPendingList
        });

        db.collection('homework')
          .where({
            status: 'completed'
          })
          .orderBy('checkInTime', 'desc')
          .limit(5)
          .get()
          .then(res => {
            const completedList = res.data.map(item => ({
              ...item,
              createTime: this.formatDate(item.createTime),
              checkInTime: this.formatDateTime(item.checkInTime)
            }));

            const allCompleted = [...todayCompletedList, ...completedList];
            
            this.setData({
              completedHomework: allCompleted,
              completedToday: todayCompletedList.length
            });
          });
      });
  },

  formatRecurringDays(days) {
    if (!days || days.length === 0) return '';
    const weekDayNames = ['日', '一', '二', '三', '四', '五', '六'];
    const sortedDays = [...days].sort((a, b) => a - b);
    return '每' + sortedDays.map(d => '周' + weekDayNames[d]).join('、');
  },

  goToCheckIn(e) {
    const homeworkId = e.currentTarget.dataset.id;
    console.log('去打卡，ID:', homeworkId);
    wx.navigateTo({
      url: `/pages/checkin/checkin?id=${homeworkId}`
    });
  },

  goToEdit(e) {
    const homeworkId = e.currentTarget.dataset.id;
    console.log('编辑作业，ID:', homeworkId);
    console.log('跳转路径:', `/pages/add/add?id=${homeworkId}`);
    wx.navigateTo({
      url: `/pages/add/add?id=${homeworkId}`,
      success: () => {
        console.log('跳转成功');
      },
      fail: (err) => {
        console.error('跳转失败:', err);
        wx.showToast({
          title: '跳转失败: ' + err.errMsg,
          icon: 'none',
          duration: 3000
        });
      }
    });
  },

  goToAdd() {
    wx.navigateTo({
      url: '/pages/add/add'
    });
  },

  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  },

  formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
});
