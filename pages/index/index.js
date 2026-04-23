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
    completedToday: 0,
    subjects: [],
    subjectStatusMap: {}, // 科目状态映射 {科目名: 'pending'|'completed'|'none'}
    groupedHomework: {},
    calendarData: [],
    selectedDate: '', // 当前选中的日期
    formattedSelectedDate: '', // 格式化后的选中日期
    dateHomeworkStats: {}, // 每天作业统计
    selectedDateHomework: [], // 选中日期的作业列表
    currentYear: 0, // 当前显示的年份
    currentMonth: 0, // 当前显示的月份
    calendarExpanded: false, // 日历是否展开
    selectedSubject: '', // 当前选中的科目
    subjectHomework: [], // 当前科目下的作业
    monthCheckins: [], // 当月打卡记录
    showSubjectManageModal: false,
    showAddSubjectModal: false,
    showEditSubjectModal: false,
    newSubjectName: '',
    editingSubject: null,
    editingSubjectName: '',
    showCheckinModal: false,
    checkinHomework: null,
    checkinProofImage: '',
    checkinComment: '',
    checkinRating: 3,
    checkinRatingPercent: 100,
    showCopyDatePicker: false,
    copySourceDate: '',
    copySubject: '',
    showCopyModal: false,
    copySelectedDate: '',
    copySelectedSubjects: [],
    showCopyCalendar: false, // 复制用的日历弹窗
    tempSelectedDate: '', // 临时选择的日期，确认后才生效[]
    copyCalendarYear: 0, // 复制作业日历的年份
    copyCalendarMonth: 0, // 复制作业日历的月份
    copyCalendarData: [] // 复制作业日历的数据
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

    this.setGreeting();
    this.loadUserInfo();
    this.loadSubjects();
    this.loadHomework();
    
    // 默认选中今天
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const formattedToday = `${today.getMonth() + 1}月${today.getDate()}日`;
    this.setData({
      selectedDate: todayStr,
      formattedSelectedDate: formattedToday,
      currentYear: today.getFullYear(),
      currentMonth: today.getMonth()
    });
  },

  onShow() {
    this.loadUserInfo();
    this.loadSubjects();
    this.loadHomework();
  },

  // 加载科目列表
  loadSubjects() {
    db.collection('subjects')
      .orderBy('sort', 'asc')
      .orderBy('createTime', 'desc')
      .get()
      .then(async res => {
        let subjects = res.data || [];
        
        // 检查是否有科目没有sort值，有的话初始化
        const needInit = subjects.some(item => item.sort === undefined);
        if (needInit) {
          // 为每个科目分配sort值
          const updatePromises = subjects.map((item, index) => {
            if (item.sort === undefined) {
              return db.collection('subjects').doc(item._id).update({
                data: { sort: index + 1 }
              });
            }
            return Promise.resolve();
          });
          
          await Promise.all(updatePromises);
          
          // 重新加载科目
          const newRes = await db.collection('subjects')
            .orderBy('sort', 'asc')
            .orderBy('createTime', 'desc')
            .get();
          subjects = newRes.data || [];
        }
        
        this.setData({
          subjects: subjects,
          selectedSubject: subjects.length > 0 ? subjects[0].name : ''
        });
        this.updateSelectedDateHomework();
      });
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
          points: 0,
          streak: 0
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

  loadHomework() {
    // 加载所有作业（包括已完成和未完成）
    db.collection('homework')
      .orderBy('createTime', 'desc')
      .limit(100)
      .get()
      .then(res => {
        const allHomework = res.data.map(item => ({
          ...item,
          createTimeRaw: item.createTime,
          createTime: this.formatDate(item.createTime),
          checkInTime: this.formatDateTime(item.checkInTime),
          recurringDaysText: item.recurring ? this.formatRecurringDays(item.recurringDays) : ''
        }));
        
        // 分离已完成和未完成的作业
        const pendingHomework = allHomework.filter(item => item.status === 'pending');
        const completedHomework = allHomework.filter(item => item.status === 'completed');
        
        this.setData({
          pendingHomework: pendingHomework,
          completedHomework: completedHomework
        });
        
        this.loadMonthCheckins();
        
        // 重新更新选中日期的作业列表，因为 pendingHomework 已更新
        this.updateSelectedDateHomework();
      });
  },

  loadMonthCheckins() {
    const year = this.data.currentYear;
    const month = this.data.currentMonth;
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-31`;
    
    const recurringHomework = this.data.pendingHomework.filter(item => item.recurring);
    const recurringIds = recurringHomework.map(item => item._id);
    
    if (recurringIds.length === 0) {
      this.setData({ monthCheckins: [] });
      this.generateCalendarData();
      return;
    }
    
    db.collection('checkins')
      .where({
        homeworkId: db.command.in(recurringIds),
        date: db.command.gte(startDate).and(db.command.lte(endDate))
      })
      .get()
      .then(res => {
        this.setData({ monthCheckins: res.data });
        this.generateCalendarData();
      })
      .catch(err => {
        console.error('加载打卡记录失败:', err);
        this.setData({ monthCheckins: [] });
        this.generateCalendarData();
      });
  },

  // 按科目分组作业
  groupHomeworkBySubject(homeworkList) {
    const grouped = {};
    
    homeworkList.forEach(item => {
      const subject = item.subject || '其他';
      if (!grouped[subject]) {
        grouped[subject] = [];
      }
      grouped[subject].push(item);
    });
    
    return grouped;
  },

  formatRecurringDays(days) {
    if (!days || days.length === 0) return '';
    const weekDayNames = ['日', '一', '二', '三', '四', '五', '六'];
    const sortedDays = [...days].sort((a, b) => a - b);
    return '每' + sortedDays.map(d => '周' + weekDayNames[d]).join('、');
  },

  goToCheckIn(e) {
    const homeworkId = e.currentTarget.dataset.id;
    const selectedDate = this.data.selectedDate;
    wx.navigateTo({
      url: `/pages/checkin/checkin?id=${homeworkId}&date=${selectedDate}`
    });
  },

  toggleCheckIn(e) {
    const homeworkId = e.currentTarget.dataset.id;
    const status = e.currentTarget.dataset.status;
    const selectedDate = this.data.selectedDate;
    
    if (status === 'completed') {
      wx.showLoading({ title: '取消中...' });
      wx.cloud.callFunction({
        name: 'cancelCheckin',
        data: {
          homeworkId: homeworkId,
          date: selectedDate
        },
        success: (res) => {
          wx.hideLoading();
          if (res.result && res.result.success) {
            wx.showToast({ title: '已取消', icon: 'success' });
            this.loadUserInfo();
            this.loadHomework();
          } else {
            wx.showToast({ title: res.result.errMsg || '取消失败', icon: 'none' });
          }
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('取消打卡失败:', err);
          wx.showToast({ title: '取消失败', icon: 'none' });
        }
      });
    } else {
      const homework = this.data.subjectHomework.find(h => h._id === homeworkId);
      this.setData({
        showCheckinModal: true,
        checkinHomework: homework,
        checkinProofImage: '',
        checkinComment: '',
        checkinRating: 3,
        checkinRatingPercent: 100
      });
    }
  },

  closeCheckinModal() {
    this.setData({
      showCheckinModal: false,
      checkinHomework: null,
      checkinProofImage: '',
      checkinComment: ''
    });
  },

  chooseCheckinImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({
          checkinProofImage: res.tempFilePaths[0]
        });
      }
    });
  },

  deleteCheckinImage() {
    this.setData({
      checkinProofImage: ''
    });
  },

  onCheckinCommentInput(e) {
    this.setData({
      checkinComment: e.detail.value
    });
  },

  selectCheckinRating(e) {
    const rating = parseInt(e.currentTarget.dataset.rating);
    const ratingPercents = { 1: 60, 2: 80, 3: 100 };
    this.setData({
      checkinRating: rating,
      checkinRatingPercent: ratingPercents[rating]
    });
  },

  quickCheckin() {
    this.submitCheckin(true);
  },

  submitCheckinWithProof() {
    this.submitCheckin(false);
  },

  submitCheckin(isQuick) {
    const { checkinHomework, checkinProofImage, checkinComment, checkinRatingPercent } = this.data;
    const selectedDate = this.data.selectedDate;

    if (!isQuick && checkinProofImage) {
      wx.showLoading({ title: '上传中...' });
      const cloudPath = `checkin/${Date.now()}.jpg`;
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: checkinProofImage,
        success: (res) => {
          this.doCheckin(checkinHomework._id, selectedDate, checkinRatingPercent, res.fileID, checkinComment);
        },
        fail: (err) => {
          wx.hideLoading();
          wx.showToast({ title: '上传失败', icon: 'none' });
        }
      });
    } else {
      wx.showLoading({ title: '打卡中...' });
      this.doCheckin(checkinHomework._id, selectedDate, checkinRatingPercent, '', checkinComment);
    }
  },

  doCheckin(homeworkId, date, ratingPercent, proofImage, comment) {
    wx.cloud.callFunction({
      name: 'completeHomework',
      data: {
        homeworkId: homeworkId,
        checkinDate: date,
        ratingPercent: ratingPercent,
        proofImage: proofImage,
        comment: comment,
        rating: ratingPercent === 100 ? 3 : (ratingPercent === 80 ? 2 : 1)
      },
      success: (res) => {
          wx.hideLoading();
          if (res.result && res.result.success) {
            this.closeCheckinModal();
            wx.showToast({ title: '打卡成功', icon: 'success' });
            this.loadUserInfo();
            this.loadHomework();
          } else {
            wx.showToast({ title: res.result.errMsg || '打卡失败', icon: 'none' });
          }
        },
      fail: (err) => {
        wx.hideLoading();
        console.error('打卡失败:', err);
        wx.showToast({ title: '打卡失败', icon: 'none' });
      }
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
    const selectedSubject = this.data.selectedSubject;
    const selectedDate = this.data.selectedDate;
    let url = '/pages/add/add';
    const params = [];
    if (selectedSubject) {
      params.push(`subject=${encodeURIComponent(selectedSubject)}`);
    }
    if (selectedDate) {
      params.push(`date=${selectedDate}`);
    }
    if (params.length > 0) {
      url += '?' + params.join('&');
    }
    wx.navigateTo({
      url: url
    });
  },

  // 复制当天作业
  copyHomework() {
    const selectedDate = this.data.selectedDate;
    const allSubjects = this.data.subjects || [];
    
    // 更稳妥的方式：获取所有有作业的科目
    const availableSubjects = allSubjects.filter(subject => {
      // 1. 当前选中的科目，直接看subjectHomework有没有内容
      if (subject.name === this.data.selectedSubject) {
        return this.data.subjectHomework.length > 0;
      }
      // 2. 其他科目，通过subjectStatusMap判断，只要不是none就说明有作业
      const status = this.data.subjectStatusMap[subject.name];
      return status && status !== 'none';
    });

    if (availableSubjects.length === 0) {
      // 兜底：如果上面的判断都没找到，至少把当前科目标识为有作业
      if (this.data.subjectHomework.length > 0) {
        const currentSubject = allSubjects.find(s => s.name === this.data.selectedSubject);
        if (currentSubject) {
          availableSubjects.push(currentSubject);
        }
      } else {
        wx.showToast({ title: '没有作业可复制', icon: 'none' });
        return;
      }
    }

    // 预处理每个科目的选中状态，默认全部不选中，需要用户手动选
    const defaultSelected = [];
    const processedSubjects = availableSubjects.map(item => {
      return {
        ...item,
        checked: defaultSelected.includes(item.name)
      };
    });

    this.setData({
      showCopyModal: true,
      copySourceDate: selectedDate,
      copySelectedDate: '',
      copySelectedSubjects: defaultSelected,
      copyAvailableSubjects: processedSubjects
    });
  },

  // 关闭复制弹窗
  closeCopyModal() {
    this.setData({
      showCopyModal: false
    });
  },

  // 临时选择日期
  selectTempDate(e) {
    const date = e.currentTarget.dataset.date;
    console.log('点击日期：', date); // 调试日志
    if (!date) return;
    
    // 匹配日期，兼容所有格式
    let formattedDate = '';
    if (date.fullDate) {
      formattedDate = date.fullDate;
    } else if (date.date) {
      formattedDate = date.date;
    } else {
      const year = date.year || this.data.currentYear;
      const month = date.month != undefined ? date.month : this.data.currentMonth;
      formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
    }
    
    console.log('选中日期：', formattedDate); // 调试日志
    this.setData({
      tempSelectedDate: formattedDate
    });
  },

  // 确认选择的日期
  confirmSelectedDate() {
    if (!this.data.tempSelectedDate) {
      wx.showToast({ title: '请选择日期', icon: 'none' });
      return;
    }
    this.setData({
      copySelectedDate: this.data.tempSelectedDate,
      tempSelectedDate: ''
    });
    this.toggleCopyCalendar();
  },

  // 切换复制用日历弹窗
  toggleCopyCalendar() {
    if (this.data.showCopyCalendar) {
      // 关闭日历，回到复制弹窗
      this.setData({
        showCopyCalendar: false,
        showCopyModal: true,
        tempSelectedDate: ''
      });
    } else {
      // 打开日历，强制生成完整的日历数据（6周），不依赖首页展开状态
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();
      const fullCalendar = this.generateFullCalendar(year, month);
      this.setData({
        showCopyModal: false,
        showCopyCalendar: true,
        tempSelectedDate: this.data.copySelectedDate,
        copyCalendarYear: year,
        copyCalendarMonth: month,
        copyCalendarData: fullCalendar // 使用独立的日历数据
      });
    }
  },

  // 生成完整的6周日历数据（独立方法，不依赖首页状态）
  generateFullCalendar(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const firstDayOfWeek = firstDay.getDay(); // 0是周日
    
    const calendar = [];
    let date = 1;
    
    // 添加上个月的尾部日期
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = 0; i < firstDayOfWeek; i++) {
      const day = prevMonthLastDay - (firstDayOfWeek - 1 - i);
      let itemMonth = month - 1;
      let itemYear = year;
      if (itemMonth < 0) {
        itemMonth = 11;
        itemYear = year - 1;
      }
      calendar.push({
        day: day,
        isCurrentMonth: false,
        month: itemMonth,
        year: itemYear,
        fullDate: `${itemYear}-${String(itemMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      });
    }
    
    // 添加当月日期
    for (let i = 1; i <= daysInMonth; i++) {
      calendar.push({
        day: i,
        isCurrentMonth: true,
        month: month,
        year: year,
        fullDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        // 保留原有的作业状态
        hasPendingHomework: this.data.calendarData?.find(item => item.day == i && item.isCurrentMonth)?.hasPendingHomework || false
      });
    }
    
    // 添加下个月的头部日期，补满6周共42天
    const nextMonthDays = 42 - calendar.length;
    for (let i = 1; i <= nextMonthDays; i++) {
      let itemMonth = month + 1;
      let itemYear = year;
      if (itemMonth > 11) {
        itemMonth = 0;
        itemYear = year + 1;
      }
      calendar.push({
        day: i,
        isCurrentMonth: false,
        month: itemMonth,
        year: itemYear,
        fullDate: `${itemYear}-${String(itemMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      });
    }
    
    return calendar;
  },

  // 复制作业日历：上一个月
  prevCopyMonth() {
    let year = this.data.copyCalendarYear;
    let month = this.data.copyCalendarMonth - 1;
    if (month < 0) {
      month = 11;
      year = year - 1;
    }
    const fullCalendar = this.generateFullCalendar(year, month);
    this.setData({
      copyCalendarYear: year,
      copyCalendarMonth: month,
      copyCalendarData: fullCalendar
    });
  },

  // 复制作业日历：下一个月
  nextCopyMonth() {
    let year = this.data.copyCalendarYear;
    let month = this.data.copyCalendarMonth + 1;
    if (month > 11) {
      month = 0;
      year = year + 1;
    }
    const fullCalendar = this.generateFullCalendar(year, month);
    this.setData({
      copyCalendarYear: year,
      copyCalendarMonth: month,
      copyCalendarData: fullCalendar
    });
  },

  // 切换科目选择
  toggleCopySubject(e) {
    const subject = String(e.currentTarget.dataset.subject || '').trim();
    if (!subject) return;

    let selected = [...(this.data.copySelectedSubjects || [])];
    // 统一转成字符串去空格，避免类型/空格导致的匹配失败
    selected = selected.map(s => String(s).trim());
    
    const index = selected.findIndex(s => s === subject);
    
    if (index > -1) {
      // 已经选中，取消选中（允许全部取消，点击确定时再校验）
      selected.splice(index, 1);
    } else {
      // 未选中，添加
      selected.push(subject);
    }

    // 更新科目列表的选中状态
    const processedSubjects = this.data.copyAvailableSubjects.map(item => {
      return {
        ...item,
        checked: selected.includes(item.name)
      };
    });
    
    this.setData({
      copySelectedSubjects: selected,
      copyAvailableSubjects: processedSubjects
    });
  },

  // 确认复制
  confirmCopy() {
    const sourceDate = this.data.copySourceDate;
    const targetDate = this.data.copySelectedDate;
    const selectedSubjects = this.data.copySelectedSubjects;

    if (!targetDate) {
      wx.showToast({ title: '请选择目标日期', icon: 'none' });
      return;
    }

    if (sourceDate === targetDate) {
      wx.showToast({ title: '不能复制到同一天', icon: 'none' });
      return;
    }

    if (selectedSubjects.length === 0) {
      wx.showToast({ title: '请至少选择一个科目', icon: 'none' });
      return;
    }

    // 逐个复制选中的科目
    wx.showLoading({ title: '复制中...' });
    
    const copyTasks = selectedSubjects.map(subject => {
      return new Promise((resolve, reject) => {
        wx.cloud.callFunction({
          name: 'copyHomework',
          data: {
            sourceDate: sourceDate,
            targetDate: targetDate,
            subject: subject
          },
          success: resolve,
          fail: reject
        });
      });
    });

    Promise.all(copyTasks)
      .then(results => {
        wx.hideLoading();
        let totalCount = 0;
        results.forEach(res => {
          if (res.result && res.result.success) {
            totalCount += res.result.count;
          }
        });

        wx.showToast({ 
          title: `成功复制${totalCount}条作业`, 
          icon: 'success' 
        });
        
        this.closeCopyModal();
        this.loadHomework();
      })
      .catch(err => {
        wx.hideLoading();
        console.error('复制失败:', err);
        wx.showToast({ title: '复制失败', icon: 'none' });
      });
  },

  // 获取指定科目和日期的作业
  getHomeworkBySubjectAndDate(subject, date) {
    const allHomework = this.data.dateHomeworkStats[date] || [];
    // 确保是数组类型，避免报错
    return Array.isArray(allHomework) ? allHomework.filter(item => item.subject === subject) : [];
  },

  // 处理复制
  handleCopyResult(sourceDate, targetDate, subject) {
    wx.showLoading({ title: '复制中...' });
    
    wx.cloud.callFunction({
      name: 'copyHomework',
      data: {
        sourceDate: sourceDate,
        targetDate: targetDate,
        subject: subject
      },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({ 
            title: res.result.message || `成功复制${res.result.count}条作业`, 
            icon: 'success' 
          });
          // 刷新数据
          this.loadHomework();
        } else {
          wx.showToast({ 
            title: res.result.errMsg || '复制失败', 
            icon: 'none' 
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('复制作业失败:', err);
        wx.showToast({ title: '复制失败', icon: 'none' });
      }
    });
  },

  // 编辑当天作业 - 跳转到添加页面
  editDayHomework() {
    const selectedSubject = this.data.selectedSubject;
    const selectedDate = this.data.selectedDate;
    
    // 如果有选中的科目，跳转到该科目的作业页面
    if (selectedSubject) {
      wx.navigateTo({
        url: `/pages/add/add?subject=${encodeURIComponent(selectedSubject)}&date=${selectedDate}`
      });
    } else {
      // 否则跳转到添加页面
      this.goToAdd();
    }
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
  },

  // 生成日历数据
  generateCalendarData() {
    const today = new Date();
    const year = this.data.currentYear;
    const month = this.data.currentMonth;
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
    
    // 获取当月第一天
    const firstDay = new Date(year, month, 1);
    // 获取当月最后一天
    const lastDay = new Date(year, month + 1, 0);
    // 获取当月第一天是星期几
    const firstDayOfWeek = firstDay.getDay();
    // 获取当月的天数
    const daysInMonth = lastDay.getDate();
    
    let calendarData = [];
    const dateHomeworkStats = this.generateDateHomeworkStats();
    
    // 添加上月的占位
    for (let i = 0; i < firstDayOfWeek; i++) {
      calendarData.push({ day: '', isCurrentMonth: false, hasHomework: false });
    }
    
    // 添加当月的日期
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const stats = dateHomeworkStats[dateStr] || { total: 0, pending: 0, completed: 0 };
        const isSelected = dateStr === this.data.selectedDate;
        // 只有今天没有被选中时才显示今天的高亮
        const isToday = isCurrentMonth && day === today.getDate() && !isSelected;
        const allCompleted = stats.total > 0 && stats.pending === 0;
        
        calendarData.push({
          day: day,
          dateStr: dateStr,
          isCurrentMonth: true,
          hasHomework: stats.total > 0,
          hasPendingHomework: stats.pending > 0,
          hasCompletedHomework: stats.completed > 0,
          allCompleted: allCompleted,
          homeworkCount: stats.total,
          isToday: isToday,
          isSelected: isSelected
        });
    }
    
    // 如果日历未展开，确保包含今天日期
    if (!this.data.calendarExpanded) {
      // 找到今天在数组中的位置
      let todayIndex = -1;
      if (isCurrentMonth) {
        todayIndex = firstDayOfWeek + today.getDate() - 1; // 减1因为day从1开始
      }
      
      if (todayIndex >= 0) {
        // 如果今天在前2周内，显示前2周
        if (todayIndex < firstDayOfWeek + 14) {
          const showDays = firstDayOfWeek + 14;
          calendarData = calendarData.slice(0, showDays);
        } else {
          // 如果今天在后半周，调整显示范围以包含今天
          // 计算需要显示多少天才能包含今天
          const showDays = todayIndex + 1;
          calendarData = calendarData.slice(0, showDays);
        }
      } else {
        // 如果不是当前月或找不到今天，默认显示前2周
        const showDays = firstDayOfWeek + 14;
        calendarData = calendarData.slice(0, showDays);
      }
    }
    
    this.setData({
      calendarData: calendarData,
      dateHomeworkStats: dateHomeworkStats
    });
    
    // 更新选中日期的作业列表
    this.updateSelectedDateHomework();
  },

  // 上一个月
  prevMonth() {
    let { currentYear, currentMonth } = this.data;
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    this.setData({
      currentYear,
      currentMonth
    });
    this.loadMonthCheckins();
  },

  // 下一个月
  nextMonth() {
    let { currentYear, currentMonth } = this.data;
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    this.setData({
      currentYear,
      currentMonth
    });
    this.loadMonthCheckins();
  },

  // 切换日历展开/收起
  toggleCalendarExpand() {
    this.setData({
      calendarExpanded: !this.data.calendarExpanded
    });
    this.generateCalendarData();
  },

  // 日期点击事件
  onDateTap(e) {
    const dateItem = e.currentTarget.dataset.date;
    if (!dateItem.isCurrentMonth) return;
    
    // 格式化选中日期
    const dateObj = new Date(dateItem.dateStr);
    const formattedDate = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
    
    this.setData({
      selectedDate: dateItem.dateStr,
      formattedSelectedDate: formattedDate
    });
    
    // 重新生成日历数据更新选中状态
    this.generateCalendarData();
  },

  // 生成每天作业统计
  generateDateHomeworkStats() {
    const stats = {};
    const allHomework = this.data.pendingHomework || [];
    const year = this.data.currentYear;
    const month = this.data.currentMonth;
    const monthCheckins = this.data.monthCheckins || [];
    
    const checkinMap = new Map();
    monthCheckins.forEach(c => {
      if (!checkinMap.has(c.date)) {
        checkinMap.set(c.date, new Map());
      }
      checkinMap.get(c.date).set(c.homeworkId, c);
    });
    
    for (let day = 1; day <= 31; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const targetDate = new Date(dateStr);
      if (targetDate.getMonth() !== month) break;
      
      const dayOfWeek = targetDate.getDay();
      let total = 0;
      let pending = 0;
      let completed = 0;
      
      const dayCheckins = checkinMap.get(dateStr) || new Map();
      
      allHomework.forEach(item => {
        let hasOnDate = false;
        if (item.recurring) {
          hasOnDate = item.recurringDays && item.recurringDays.includes(dayOfWeek);
        } else {
          // 优先使用 homeworkDate 字段
          if (item.homeworkDate) {
            hasOnDate = item.homeworkDate === dateStr;
          } else {
            // 回退到使用 createTime
            const createDate = new Date(item.createTimeRaw || item.createTime);
            const createDateStr = `${createDate.getFullYear()}-${String(createDate.getMonth() + 1).padStart(2, '0')}-${String(createDate.getDate()).padStart(2, '0')}`;
            hasOnDate = createDateStr === dateStr;
          }
        }
        
        if (hasOnDate) {
          total++;
          if (item.recurring) {
            if (dayCheckins.has(item._id)) {
              completed++;
            } else {
              pending++;
            }
          } else {
            if (item.status === 'pending') {
              pending++;
            } else {
              completed++;
            }
          }
        }
      });
      
      if (total > 0) {
        stats[dateStr] = { total, pending, completed };
      }
    }
    
    return stats;
  },

  // 检查日期是否有作业
  checkDateHasHomework(dateStr) {
    const today = new Date();
    const targetDate = new Date(dateStr);
    const dayOfWeek = targetDate.getDay();
    
    // 检查是否是今天或未来的日期
    if (targetDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      return false;
    }
    
    // 检查是否有作业
    const pendingHomework = this.data.pendingHomework || [];
    return pendingHomework.some(item => {
      if (item.recurring) {
        // 检查循环作业
        return item.recurringDays.includes(dayOfWeek);
      } else {
          // 检查非循环作业
          const createDate = new Date(item.createTimeRaw || item.createTime);
          const createDateStr = `${createDate.getFullYear()}-${String(createDate.getMonth() + 1).padStart(2, '0')}-${String(createDate.getDate()).padStart(2, '0')}`;
          return createDateStr === dateStr;
        }
    });
  },

  // 更新选中日期的作业列表
  async updateSelectedDateHomework() {
    const selectedDate = this.data.selectedDate;
    if (!selectedDate) return;
    
    const targetDate = new Date(selectedDate);
    const dayOfWeek = targetDate.getDay();
    // 合并已完成和未完成的作业
    const pendingHomework = this.data.pendingHomework || [];
    const completedHomework = this.data.completedHomework || [];
    const allHomework = [...pendingHomework, ...completedHomework];
    
    const selectedHomework = allHomework.filter(item => {
      if (item.recurring) {
        return item.recurringDays && item.recurringDays.includes(dayOfWeek);
      } else {
        // 优先使用 homeworkDate 字段
        if (item.homeworkDate) {
          return item.homeworkDate === selectedDate;
        }
        // 回退到使用 createTime
        const createDate = new Date(item.createTimeRaw || item.createTime);
        const createDateStr = `${createDate.getFullYear()}-${String(createDate.getMonth() + 1).padStart(2, '0')}-${String(createDate.getDate()).padStart(2, '0')}`;
        return createDateStr === selectedDate;
      }
    });
    
    const recurringIds = selectedHomework.filter(item => item.recurring).map(item => item._id);
    let dateCheckins = [];
    
    if (recurringIds.length > 0) {
      const checkinRes = await db.collection('checkins')
        .where({
          homeworkId: db.command.in(recurringIds),
          date: selectedDate
        })
        .get();
      dateCheckins = checkinRes.data;
    }
    
    const checkedInMap = new Map();
    dateCheckins.forEach(c => {
      checkedInMap.set(c.homeworkId, c);
    });
    
    const processedHomework = selectedHomework.map(item => {
      // 循环作业：检查是否有打卡记录
      if (item.recurring) {
        if (checkedInMap.has(item._id)) {
          const checkin = checkedInMap.get(item._id);
          const actualPoints = Math.round(item.points * (checkin.ratingPercent || 100) / 100);
          return {
            ...item,
            status: 'completed',
            checkInTime: this.formatDateTime(checkin.createTime),
            actualPoints: actualPoints, // 保存实际得分
            basePoints: item.points, // 保存总分
            ratingPercent: checkin.ratingPercent // 保存完成百分比
          };
        }
        return { ...item, status: 'pending' };
      }
      // 非循环作业：使用数据库中的 status 字段
      return { ...item, status: item.status || 'pending' };
    });
    
    // 计算每个科目的状态
    const subjectStatusMap = {};
    const subjects = this.data.subjects || [];
    
    subjects.forEach(subject => {
      const subjectName = subject.name;
      let hasHomework = false;
      let hasPending = false;
      
      processedHomework.forEach(item => {
        const itemSubject = (item.subject || '其他').trim();
        if (itemSubject === subjectName) {
          hasHomework = true;
          if (item.status === 'pending') {
            hasPending = true;
          }
        }
      });
      
      if (hasPending) {
        subjectStatusMap[subjectName] = 'pending';
      } else if (hasHomework) {
        subjectStatusMap[subjectName] = 'completed';
      } else {
        subjectStatusMap[subjectName] = 'none';
      }
    });
    
    this.setData({
      selectedDateHomework: processedHomework,
      subjectStatusMap: subjectStatusMap
    });
    
    this.updateSubjectHomework();
  },

  // 选择科目
  selectSubject(e) {
    const subject = e.currentTarget.dataset.subject;
    this.setData({
      selectedSubject: subject
    });
    this.updateSubjectHomework();
  },

  // 更新当前科目的作业列表
  updateSubjectHomework() {
    const selectedSubject = this.data.selectedSubject;
    const selectedHomework = this.data.selectedDateHomework || [];
    
    let subjectHomework = selectedHomework;
    if (selectedSubject) {
      subjectHomework = selectedHomework.filter(item => {
        return (item.subject || '其他') === selectedSubject;
      });
    }
    
    this.setData({
      subjectHomework: subjectHomework
    });
  },

  // 获取科目下的未完成作业数量
  getSubjectPendingCount(subject) {
    const selectedHomework = this.data.selectedDateHomework || [];
    let pendingCount = 0;
    
    selectedHomework.forEach(item => {
      if (item.status !== 'pending') return;
      
      if (subject === '全部') {
        pendingCount++;
      } else if ((item.subject || '其他') === subject) {
        pendingCount++;
      }
    });
    
    return pendingCount;
  },

  // 跳转到添加科目页面
  // 打开科目管理弹窗
  goToAddSubject() {
    this.setData({
      showSubjectManageModal: true
    });
  },

  // 关闭科目管理弹窗
  closeSubjectManageModal() {
    this.setData({
      showSubjectManageModal: false
    });
  },

  // 显示添加科目弹窗
  showAddSubjectModal() {
    this.setData({
      showAddSubjectModal: true,
      newSubjectName: ''
    });
  },

  // 关闭添加科目弹窗
  closeAddSubjectModal() {
    this.setData({
      showAddSubjectModal: false
    });
  },

  // 显示编辑科目弹窗
  showEditSubjectModal(e) {
    const subject = e.currentTarget.dataset.subject;
    this.setData({
      showEditSubjectModal: true,
      editingSubject: subject,
      editingSubjectName: subject.name
    });
  },

  // 关闭编辑科目弹窗
  closeEditSubjectModal() {
    this.setData({
      showEditSubjectModal: false,
      editingSubject: null
    });
  },

  // 输入新科目名称
  onNewSubjectInput(e) {
    this.setData({
      newSubjectName: e.detail.value
    });
  },

  // 输入编辑科目名称
  onEditSubjectInput(e) {
    this.setData({
      editingSubjectName: e.detail.value
    });
  },

  // 生成随机颜色
  getRandomColor() {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
      '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9FF3'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  },

  // 添加新科目
  addSubject() {
    const name = this.data.newSubjectName.trim();
    if (!name) {
      wx.showToast({
        title: '请输入科目名称',
        icon: 'none'
      });
      return;
    }

    // 先获取当前最大的sort值
    db.collection('subjects')
      .orderBy('sort', 'desc')
      .limit(1)
      .get()
      .then(res => {
        let maxSort = 0;
        if (res.data && res.data.length > 0) {
          maxSort = res.data[0].sort || 0;
        }

        db.collection('subjects').add({
          data: {
            name: name,
            color: this.getRandomColor(),
            sort: maxSort + 1,
            createTime: db.serverDate()
          },
          success: (res) => {
            wx.showToast({
              title: '添加成功',
              icon: 'success'
            });
            this.setData({
              showAddSubjectModal: false
            });
            this.loadSubjects();
          },
          fail: (err) => {
            console.error('添加科目失败:', err);
            wx.showToast({
              title: '添加失败，请重试',
              icon: 'none'
            });
          }
        });
      })
      .catch(err => {
        // 如果查询失败，默认sort=1
        db.collection('subjects').add({
          data: {
            name: name,
            color: this.getRandomColor(),
            sort: 1,
            createTime: db.serverDate()
          },
          success: (res) => {
            wx.showToast({
              title: '添加成功',
              icon: 'success'
            });
            this.setData({
              showAddSubjectModal: false
            });
            this.loadSubjects();
          },
          fail: (err) => {
            console.error('添加科目失败:', err);
            wx.showToast({
              title: '添加失败，请重试',
              icon: 'none'
            });
          }
        });
      });
  },

  // 更新科目
  updateSubject() {
    const name = this.data.editingSubjectName.trim();
    const subject = this.data.editingSubject;
    
    if (!name) {
      wx.showToast({
        title: '请输入科目名称',
        icon: 'none'
      });
      return;
    }

    db.collection('subjects').doc(subject._id).update({
      data: {
        name: name
      },
      success: (res) => {
        wx.showToast({
          title: '修改成功',
          icon: 'success'
        });
        this.setData({
          showEditSubjectModal: false
        });
        this.loadSubjects();
      },
      fail: (err) => {
        console.error('修改科目失败:', err);
        wx.showToast({
          title: '修改失败，请重试',
          icon: 'none'
        });
      }
    });
  },

  // 删除科目
  deleteSubject(e) {
    const subject = e.currentTarget.dataset.subject;
    
    wx.showModal({
      title: '删除科目',
      content: `确定要删除"${subject.name}"吗？该科目下的所有作业不会被删除，但会归为"其他"类别。`,
      confirmText: '确定删除',
      confirmColor: '#FF5252',
      success: (res) => {
        if (res.confirm) {
          db.collection('subjects').doc(subject._id).remove({
            success: () => {
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              });
              this.loadSubjects();
            },
            fail: (err) => {
              console.error('删除科目失败:', err);
              wx.showToast({
                title: '删除失败，请重试',
                icon: 'none'
              });
            }
          });
        }
      }
    });
  },

  // 上移科目
  async moveSubjectUp(e) {
    const subject = e.currentTarget.dataset.subject;
    const index = e.currentTarget.dataset.index;
    const subjects = this.data.subjects;
    
    if (index === 0) {
      wx.showToast({
        title: '已经是第一个了',
        icon: 'none'
      });
      return;
    }

    const prevSubject = subjects[index - 1];
    
    // 确保两个科目都有sort值，没有的话先初始化
    let currentSort = subject.sort !== undefined ? subject.sort : index;
    let prevSort = prevSubject.sort !== undefined ? prevSubject.sort : (index - 1);

    try {
      // 交换两个科目的sort值
      await Promise.all([
        db.collection('subjects').doc(subject._id).update({
          data: { sort: prevSort }
        }),
        db.collection('subjects').doc(prevSubject._id).update({
          data: { sort: currentSort }
        })
      ]);
      
      wx.showToast({
        title: '移动成功',
        icon: 'success'
      });
      this.loadSubjects();
    } catch (err) {
      console.error('移动科目失败:', err);
      wx.showToast({
        title: '移动失败，请重试',
        icon: 'none'
      });
    }
  },

  // 下移科目
  async moveSubjectDown(e) {
    const subject = e.currentTarget.dataset.subject;
    const index = e.currentTarget.dataset.index;
    const subjects = this.data.subjects;
    
    if (index === subjects.length - 1) {
      wx.showToast({
        title: '已经是最后一个了',
        icon: 'none'
      });
      return;
    }

    const nextSubject = subjects[index + 1];
    
    // 确保两个科目都有sort值，没有的话先初始化
    let currentSort = subject.sort !== undefined ? subject.sort : index;
    let nextSort = nextSubject.sort !== undefined ? nextSubject.sort : (index + 1);

    try {
      // 交换两个科目的sort值
      await Promise.all([
        db.collection('subjects').doc(subject._id).update({
          data: { sort: nextSort }
        }),
        db.collection('subjects').doc(nextSubject._id).update({
          data: { sort: currentSort }
        })
      ]);
      
      wx.showToast({
        title: '移动成功',
        icon: 'success'
      });
      this.loadSubjects();
    } catch (err) {
      console.error('移动科目失败:', err);
      wx.showToast({
        title: '移动失败，请重试',
        icon: 'none'
      });
    }
  },

  // 判断科目是否全部完成
  isSubjectAllCompleted(subject) {
    const selectedHomework = this.data.selectedDateHomework || [];
    let hasPending = false;
    
    selectedHomework.forEach(item => {
      const itemSubject = (item.subject || '其他').trim();
      const targetSubject = (subject || '').trim();
      
      if (item.status !== 'pending') return;
      
      if (itemSubject === targetSubject) {
        hasPending = true;
      }
    });
    
    return !hasPending && this.allHomeworkCompleted(subject);
  },

  // 判断科目是否有未完成作业
  hasPendingHomework(subject) {
    const selectedHomework = this.data.selectedDateHomework || [];
    
    // 调试信息
    console.log(`检查科目【${subject}】是否有未完成作业`);
    console.log('当前作业列表:', selectedHomework.map(item => ({ subject: item.subject, status: item.status })));
    
    for (let item of selectedHomework) {
      const itemSubject = (item.subject || '其他').trim();
      const targetSubject = (subject || '').trim();
      
      console.log(`对比: 作业科目【${itemSubject}】 vs 当前科目【${targetSubject}】, 状态: ${item.status}`);
      
      if (itemSubject === targetSubject && item.status === 'pending') {
        console.log(`匹配成功，科目【${subject}】有未完成作业`);
        return true;
      }
    }
    
    console.log(`科目【${subject}】没有未完成作业`);
    return false;
  },

  // 判断科目所有作业是否已完成
  allHomeworkCompleted(subject) {
    const selectedHomework = this.data.selectedDateHomework || [];
    let hasHomework = false;
    let hasPending = false;
    
    for (let item of selectedHomework) {
      const itemSubject = (item.subject || '其他').trim();
      const targetSubject = (subject || '').trim();
      
      if (itemSubject === targetSubject) {
        hasHomework = true;
        if (item.status === 'pending') {
          hasPending = true;
        }
      }
    }
    
    return hasHomework && !hasPending;
  }
});
