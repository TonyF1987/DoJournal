const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    greeting: '',
    userInfo: {
      nickName: '小宝贝',
      avatarUrl: ''
    },
    currentChild: null,
    showChildModal: false,
    showAddChildModal: false,
    editingChild: null,
    newChild: {
      name: '',
      avatarUrl: '',
      gender: '',
      birthDate: '',
      schoolStage: ''
    },
    showDemoBanner: false,
    // 家庭管理相关
    showFamilyManageModal: false,
    familyInfo: null,
    showJoinFamilyModal: false,
    showCreateFamilyModal: false,
    showInviteCodeModal: false,
    inviteCode: '',
    familyName: '', // 新建家庭名称
    inputInviteCode: '', // 输入的邀请码
    familyMembers: [],
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
    this.initDate();
    // 将 app 对象同步到 data 中，以便 wxml 访问
    this.setData({
      app: app
    });
    this.checkLoginAndLoad();
  },

  onShow() {
    // 返回时保持之前选中的日期，只刷新数据
    // 不调用 initDate()，以保持选中的日期
    this.checkLoginAndLoad();
  },

  initDate() {
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

  checkLoginAndLoad() {
    console.log('checkLoginAndLoad - app.globalData:', app.globalData);
    
    // 检查是否显示演示数据提示
    const shouldShowDemo = !app.globalData.isLoggedIn && !app.globalData.openid;
    this.setData({ showDemoBanner: shouldShowDemo });

    // 如果用户未登录，不强制跳转，允许先浏览
    // 只有在需要使用功能时再提示登录
    if (shouldShowDemo) {
      console.log('用户未登录，允许浏览模式');
      this.setGreeting();
      // 设置一些演示数据让用户可以体验
      this.setDemoData();
      return;
    }

    console.log('用户已登录，加载真实数据');
    // 清理演示数据
    this.clearDemoData();
    this.setGreeting();
    this.loadUserInfo();
    this.loadSubjects();
    this.loadHomework();
  },

  // 设置演示数据
  setDemoData() {
    const today = new Date();
    const selectedDate = this.data.selectedDate || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // 根据当前选择的小孩生成对应的演示数据
    const currentChild = this.data.currentChild;
    let demoChildren;

    if (!currentChild) {
      // 首次初始化
      demoChildren = [
        {
          id: 'demo-child-1',
          name: '小宝贝',
          avatarUrl: '',
          gender: 'male',
          birthDate: '2019-01-01',
          schoolStage: '幼儿园',
          isDemo: true
        },
        {
          id: 'demo-child-2',
          name: '小乖乖',
          avatarUrl: '',
          gender: 'female',
          birthDate: '2020-06-15',
          schoolStage: '幼儿园',
          isDemo: true
        }
      ];
    } else {
      // 已选择小孩
      demoChildren = this.data.children;
    }

    const activeChild = this.data.currentChild || demoChildren[0];

    // 根据小孩生成不同的演示作业
    const isFirstChild = activeChild.id === 'demo-child-1';
    const now = new Date();
    const demoHomework = isFirstChild ? [
      {
        _id: 'demo-hw-1',
        title: '朗读课文30分钟',
        content: '阅读语文课本第5-10页',
        subject: '语文',
        status: 'completed',
        homeworkDate: selectedDate,
        createTime: now.toISOString(),
        checkInTime: now.toISOString(),
        points: 5,
        actualPoints: 5
      },
      {
        _id: 'demo-hw-2',
        title: '口算练习20道',
        content: '练习加减法运算',
        subject: '数学',
        status: 'pending',
        homeworkDate: selectedDate,
        createTime: now.toISOString(),
        points: 3
      },
      {
        _id: 'demo-hw-3',
        title: '背诵单词10个',
        content: '学习新单词并背诵',
        subject: '英语',
        status: 'pending',
        homeworkDate: selectedDate,
        createTime: now.toISOString(),
        points: 4
      },
      {
        _id: 'demo-hw-4',
        title: '课外阅读',
        content: '阅读绘本故事书',
        subject: '阅读',
        status: 'completed',
        homeworkDate: selectedDate,
        createTime: now.toISOString(),
        checkInTime: now.toISOString(),
        points: 3,
        actualPoints: 3
      }
    ] : [
      {
        _id: 'demo-hw-5',
        title: '数学应用题',
        content: '完成练习册的应用题',
        subject: '数学',
        status: 'pending',
        homeworkDate: selectedDate,
        createTime: now.toISOString(),
        points: 4
      },
      {
        _id: 'demo-hw-6',
        title: '背古诗一首',
        content: '背诵唐诗一首',
        subject: '语文',
        status: 'completed',
        homeworkDate: selectedDate,
        createTime: now.toISOString(),
        checkInTime: now.toISOString(),
        points: 2,
        actualPoints: 2
      },
      {
        _id: 'demo-hw-7',
        title: '英语听力练习',
        content: '听英语录音20分钟',
        subject: '英语',
        status: 'completed',
        homeworkDate: selectedDate,
        createTime: now.toISOString(),
        checkInTime: now.toISOString(),
        points: 3,
        actualPoints: 3
      }
    ];

    // 演示科目
    const demoSubjects = [
      { id: 'demo-1', name: '语文', color: '#FF6B6B', sort: 1 },
      { id: 'demo-2', name: '数学', color: '#4ECDC4', sort: 2 },
      { id: 'demo-3', name: '英语', color: '#45B7D1', sort: 3 },
      { id: 'demo-4', name: '阅读', color: '#FFA07A', sort: 4 }
    ];

    // 演示日历数据
    const demoCalendarData = this.generateDemoCalendarForDate(demoHomework, selectedDate);

    this.setData({
      children: demoChildren,
      currentChild: activeChild,
      subjects: demoSubjects,
      selectedSubject: demoSubjects.length > 0 ? demoSubjects[0].name : '',
      pendingHomework: demoHomework.filter(h => h.status === 'pending'),
      completedHomework: demoHomework.filter(h => h.status === 'completed'),
      subjectHomework: demoHomework.filter(h => h.subject === demoSubjects[0].name),
      selectedDateHomework: demoHomework,
      calendarData: demoCalendarData,
      completedToday: demoHomework.filter(h => h.status === 'completed').length
    });
  },

  // 生成演示日历数据（基于作业）
  generateDemoCalendarForDate(demoHomework, referenceDate) {
    const today = new Date();
    const year = this.data.currentYear || today.getFullYear();
    const month = this.data.currentMonth !== undefined ? this.data.currentMonth : today.getMonth();
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

    // 添加上月的占位
    for (let i = 0; i < firstDayOfWeek; i++) {
      calendarData.push({ day: '', isCurrentMonth: false, hasHomework: false });
    }

    // 添加当月的日期
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = isCurrentMonth && day === today.getDate();
      const isSelected = this.data.selectedDate === dateStr;

      // 基于作业数据计算当天的状态
      const dateHomework = demoHomework.filter(h => h.homeworkDate === dateStr);
      const totalCount = dateHomework.length;
      const pendingCount = dateHomework.filter(h => h.status === 'pending').length;
      const completedCount = dateHomework.filter(h => h.status === 'completed').length;
      const allCompleted = totalCount > 0 && pendingCount === 0;

      // 如果不是当前选择日期，随机生成一些演示数据
      let hasHomework = totalCount > 0;
      let hasPending = pendingCount > 0;
      let hasCompleted = completedCount > 0;
      let homeworkCount = totalCount;

      if (dateStr !== referenceDate && totalCount === 0) {
        hasHomework = day % 3 === 0 || day % 5 === 0;
        hasPending = hasHomework && day % 5 !== 0;
        hasCompleted = hasHomework && day % 5 === 0;
        homeworkCount = hasHomework ? 2 : 0;
      }

      calendarData.push({
        day: day,
        dateStr: dateStr,
        isCurrentMonth: true,
        hasHomework: hasHomework,
        hasPendingHomework: hasPending,
        hasCompletedHomework: hasCompleted,
        allCompleted: allCompleted || (hasHomework && hasCompleted && !hasPending),
        homeworkCount: homeworkCount,
        isToday: isToday,
        isSelected: isSelected
      });
    }

    return calendarData;
  },

  // 生成演示日历数据（原有方法保持兼容）
  generateDemoCalendar() {
    const today = new Date();
    const selectedDate = this.data.selectedDate || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // 生成一个临时的演示作业用于日历
    const tempHomework = [
      {
        _id: 'temp-1',
        title: '临时作业1',
        subject: '语文',
        status: 'completed',
        homeworkDate: selectedDate
      },
      {
        _id: 'temp-2',
        title: '临时作业2',
        subject: '数学',
        status: 'pending',
        homeworkDate: selectedDate
      }
    ];

    return this.generateDemoCalendarForDate(tempHomework, selectedDate);
  },

  // 清理演示数据
  clearDemoData() {
    this.setData({
      children: [],
      currentChild: null,
      subjects: [],
      selectedSubject: '',
      pendingHomework: [],
      completedHomework: [],
      subjectHomework: [],
      selectedDateHomework: [],
      calendarData: [],
      completedToday: 0
    });
  },

  // 加载科目列表
  loadSubjects() {
    const currentChild = this.data.currentChild;
    if (!currentChild) {
      console.log('没有选择小朋友，不加载科目');
      this.setData({ 
        subjects: [],
        selectedSubject: ''
      });
      return;
    }
    
    let subjects = currentChild.subjects || [];
    // 按 sort 排序
    subjects.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    this.setData({
      subjects: subjects,
      selectedSubject: subjects.length > 0 ? subjects[0].name : ''
    });
    this.updateSelectedDateHomework();
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
        try {
          const parsedUserInfo = JSON.parse(userInfo);
          app.globalData.userInfo = parsedUserInfo;
        } catch (e) {
          console.error('解析用户信息失败', e);
        }
      }
    }

    if (app.globalData.userInfo) {
      const currentChild = this.getCurrentChild(app.globalData.userInfo);
      this.setData({
        userInfo: app.globalData.userInfo,
        currentChild: currentChild || null
      });
    }

    // 如果已登录，通过云函数加载用户数据
    if (app.globalData.openid) {
      wx.cloud.callFunction({
        name: 'getUserInfo',
        success: (res) => {
          if (res.result && res.result.success) {
            const userInfo = res.result.userInfo;
            const currentChild = this.getCurrentChild(userInfo);
            this.setData({
              userInfo: userInfo,
              currentChild: currentChild || null
            });
            app.saveUserInfo(userInfo);

            // 检查用户状态并给出引导
            this.checkUserStatusAndGuide(userInfo);
          } else {
            // 如果没有用户记录，可能需要重新登录
            console.error('未找到用户记录');
            app.clearUserInfo();
          }
        },
        fail: (err) => {
          console.error('获取用户信息失败:', err);
          // 只显示提示，不强制跳转
          wx.showToast({
            title: '获取用户信息失败',
            icon: 'none',
            duration: 2000
          });
        }
      });
    } else if (app.globalData.isLoggedIn) {
      // 如果标记为已登录但没有 openid，尝试从本地存储获取
      const openid = wx.getStorageSync('openid');
      if (openid) {
        app.globalData.openid = openid;
        // 重新加载用户信息
        this.loadUserInfo();
      }
    }
  },

  // 检查前置条件，按顺序引导：家庭→小朋友→科目
  checkPreconditions(callback) {
    const userInfo = this.data.userInfo;
    
    // 检查是否有家庭
    if (!userInfo.familyId) {
      wx.showModal({
        title: '第一步：创建家庭',
        content: '需要创建或加入家庭才能继续操作，是否现在创建？',
        confirmText: '创建家庭',
        confirmColor: '#FF6B35',
        cancelText: '稍后',
        success: (modalRes) => {
          if (modalRes.confirm) {
            wx.switchTab({ 
              url: '/pages/me/me',
              success: () => {
                setTimeout(() => {
                  const pages = getCurrentPages();
                  const currentPage = pages[pages.length - 1];
                  if (currentPage && currentPage.showCreateFamilyModal) {
                    currentPage.showCreateFamilyModal();
                  }
                }, 500);
              }
            });
          }
        }
      });
      return false;
    }
    
    // 检查是否有小朋友
    if (!userInfo.children || userInfo.children.length === 0) {
      wx.showModal({
        title: '第二步：添加小朋友',
        content: '需要添加小朋友才能继续操作，是否现在添加？',
        confirmText: '添加',
        confirmColor: '#FF6B35',
        cancelText: '稍后',
        success: (modalRes) => {
          if (modalRes.confirm) {
            this.openAddChildModal();
          }
        }
      });
      return false;
    }
    
    // 检查当前选中的小朋友是否有科目
    const currentChild = this.data.currentChild;
    if (!currentChild || (!currentChild.subjects || currentChild.subjects.length === 0)) {
      wx.showModal({
        title: '第三步：添加科目',
        content: '需要添加科目才能继续操作，是否现在添加？',
        confirmText: '添加',
        confirmColor: '#FF6B35',
        cancelText: '稍后',
        success: (modalRes) => {
          if (modalRes.confirm) {
            this.goToAddSubject();
          }
        }
      });
      return false;
    }
    
    // 所有前置条件都满足
    if (callback) {
      callback();
    }
    return true;
  },

  // 检查用户状态并给出引导
  checkUserStatusAndGuide(userInfo) {
    console.log('checkUserStatusAndGuide - userInfo:', userInfo);
    console.log('checkUserStatusAndGuide - familyId:', userInfo.familyId);
    console.log('checkUserStatusAndGuide - children:', userInfo.children);
    console.log('checkUserStatusAndGuide - currentChild:', this.data.currentChild);
    
    // 等待页面加载完成后再显示引导
    setTimeout(() => {
      // 检测是否有家庭
      if (!userInfo.familyId) {
        console.log('显示第一步：创建家庭');
        wx.showModal({
          title: '第一步：创建家庭',
          content: '需要创建或加入家庭才能管理小朋友，是否现在创建？',
          confirmText: '创建家庭',
          confirmColor: '#FF6B35',
          cancelText: '稍后',
          success: (modalRes) => {
            if (modalRes.confirm) {
              wx.switchTab({ 
                url: '/pages/me/me',
                success: () => {
                  // 延迟触发家庭创建，让用户先看到"我的"页面
                  setTimeout(() => {
                    const pages = getCurrentPages();
                    const currentPage = pages[pages.length - 1];
                    if (currentPage && currentPage.showCreateFamilyModal) {
                      currentPage.showCreateFamilyModal();
                    }
                  }, 500);
                }
              });
            }
          }
        });
      } else if (!userInfo.children || userInfo.children.length === 0) {
        // 有家庭但没有小朋友
        console.log('显示第二步：添加小朋友');
        wx.showModal({
          title: '第二步：添加小朋友',
          content: '需要添加小朋友才能记录作业，是否现在添加？',
          confirmText: '添加',
          confirmColor: '#FF6B35',
          cancelText: '稍后',
          success: (modalRes) => {
            if (modalRes.confirm) {
              this.openAddChildModal();
            }
          }
        });
      } else {
        // 检查当前选中的小朋友是否有科目
        const currentChild = this.getCurrentChild(userInfo);
        console.log('checkUserStatusAndGuide - currentChild subjects:', currentChild?.subjects);
        if (currentChild && (!currentChild.subjects || currentChild.subjects.length === 0)) {
          console.log('显示第三步：添加科目');
          wx.showModal({
            title: '第三步：添加科目',
            content: '需要添加科目才能记录作业，是否现在添加？',
            confirmText: '添加',
            confirmColor: '#FF6B35',
            cancelText: '稍后',
            success: (modalRes) => {
              if (modalRes.confirm) {
                this.goToAddSubject();
              }
            }
          });
        }
      }
    }, 800);
  },

  getCurrentChild(userInfo) {
    if (!userInfo) {
      return null;
    }
    if (!userInfo.children || !userInfo.currentChildId) {
      return null;
    }
    return userInfo.children.find(c => c.id === userInfo.currentChildId) || null;
  },

  loadHomework() {
    const currentChild = this.data.currentChild;
    if (!currentChild) {
      console.log('没有选择小朋友，不加载作业');
      this.setData({
        pendingHomework: [],
        completedHomework: []
      });
      this.loadMonthCheckins();
      this.updateSelectedDateHomework();
      return;
    }

    // 通过云函数加载当前小朋友的作业（包括已完成和未完成）
    wx.cloud.callFunction({
      name: 'getHomeworks',
      data: {
        childId: currentChild.id
      },
      success: (res) => {
        if (res.result && res.result.success) {
          const allHomework = res.result.data.map(item => ({
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
          
          // 同时刷新用户信息（特别是连续打卡数据）
          this.loadUserInfo();
          
          // 加载打卡记录并计算今日完成数量
          this.loadMonthCheckins(() => {
            this.calculateCompletedToday();
          });
          
          // 重新更新选中日期的作业列表，因为 pendingHomework 已更新
          this.updateSelectedDateHomework();
        }
      },
      fail: (err) => {
        console.error('加载作业失败:', err);
      }
    });
  },

  loadMonthCheckins(callback) {
    const year = this.data.currentYear;
    const month = this.data.currentMonth;
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-31`;
    
    const currentChild = this.data.currentChild;
    if (!currentChild) {
      this.setData({ monthCheckins: [] });
      this.generateCalendarData([]);
      if (callback) callback();
      return;
    }
    
    const allHomework = [...(this.data.pendingHomework || []), ...(this.data.completedHomework || [])];
    const allHomeworkIds = allHomework.map(item => item._id);
    
    if (allHomeworkIds.length === 0) {
      this.setData({ monthCheckins: [] });
      this.generateCalendarData([]);
      if (callback) callback();
      return;
    }
    
    // 通过云函数获取打卡记录
    wx.cloud.callFunction({
      name: 'getCheckins',
      data: {
        childId: currentChild.id,
        homeworkIds: allHomeworkIds,
        startDate: startDate,
        endDate: endDate
      },
      success: (res) => {
        const checkins = res.result && res.result.success ? res.result.data : [];
        this.setData({ monthCheckins: checkins });
        this.generateCalendarData(checkins);
        if (callback) callback();
      },
      fail: (err) => {
        console.error('加载打卡记录失败:', err);
        this.setData({ monthCheckins: [] });
        this.generateCalendarData([]);
        if (callback) callback();
      }
    });
  },

  calculateCompletedToday() {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const pendingHomework = this.data.pendingHomework || [];
    const completedHomework = this.data.completedHomework || [];
    const allHomework = [...pendingHomework, ...completedHomework];
    const checkins = this.data.monthCheckins || [];
    
    // 创建打卡记录的映射表
    const checkinMap = {};
    checkins.forEach(checkin => {
      const key = `${checkin.homeworkId}_${checkin.date}`;
      checkinMap[key] = true;
    });
    
    // 计算今日完成数量
    let completedTodayCount = 0;
    allHomework.forEach(item => {
      if (item.homeworkDate === todayStr) {
        const checkinKey = `${item._id}_${todayStr}`;
        const hasCheckin = !!checkinMap[checkinKey];
        if (hasCheckin || item.status === 'completed') {
          completedTodayCount++;
        }
      }
    });
    
    this.setData({
      completedToday: completedTodayCount
    });
  },

  // 检查是否已登录，未登录则提示
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

  // 跳转到登录页面
  goToLoginPage() {
    wx.navigateTo({
      url: '/pages/login/login'
    });
  },

  // 跳转到我的页面
  goToMyPage() {
    wx.switchTab({
      url: '/pages/me/me'
    });
  },

  // 跳转到添加科目
  goToAddSubject() {
    this.showAddSubjectModal();
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
    if (!this.checkLoginAndPrompt()) return;
    const homeworkId = e.currentTarget.dataset.id;
    const selectedDate = this.data.selectedDate;
    wx.navigateTo({
      url: `/pages/checkin/checkin?id=${homeworkId}&date=${selectedDate}`
    });
  },

  toggleCheckIn(e) {
    if (!this.checkLoginAndPrompt()) return;
    
    // 检查前置条件
    if (!this.checkPreconditions(() => {
      // 前置条件满足后才执行打卡
      const homeworkId = e.currentTarget.dataset.id;
      const status = e.currentTarget.dataset.status;
      const selectedDate = this.data.selectedDate;
      const currentChild = this.data.currentChild;
      
      if (!currentChild) {
        wx.showToast({ title: '请先选择小朋友', icon: 'none' });
        return;
      }
    
      if (status === 'completed') {
        wx.showLoading({ title: '取消中...' });
        wx.cloud.callFunction({
          name: 'cancelCheckin',
          data: {
            homeworkId: homeworkId,
            date: selectedDate,
            childId: currentChild.id
          },
          success: (res) => {
            wx.hideLoading();
            if (res.result && res.result.success) {
              wx.showToast({ title: '已取消', icon: 'success' });
              this.loadUserInfo();
              this.loadHomework();
              this.loadMonthCheckins();
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
    })) {
      // checkPreconditions 返回 false 时说明缺少前置条件，已经显示了引导
      return;
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
    wx.showLoading({ title: '打卡中...' });
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
          
          // 立即更新当前小朋友的 streak
          const currentChild = this.data.currentChild;
          if (currentChild && res.result.streak !== undefined) {
            currentChild.streak = res.result.streak;
            this.setData({
              currentChild: currentChild
            });
          }
          
          // 刷新作业和用户信息
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
    if (!this.checkLoginAndPrompt()) return;
    const homeworkId = e.currentTarget.dataset.id;
    const selectedDate = this.data.selectedDate;
    console.log('编辑作业，ID:', homeworkId);
    let url = `/pages/add/add?id=${homeworkId}`;
    if (selectedDate) {
      url += `&date=${selectedDate}`;
    }
    console.log('跳转路径:', url);
    wx.navigateTo({
      url: url,
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
    if (!this.checkLoginAndPrompt()) return;
    
    // 检查前置条件
    if (!this.checkPreconditions(() => {
      // 前置条件满足后才执行跳转
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
    })) {
      // checkPreconditions 返回 false 时说明缺少前置条件，已经显示了引导
      return;
    }
  },

  // 复制当天作业
  copyHomework() {
    if (!this.checkLoginAndPrompt()) return;
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
    const currentChild = this.data.currentChild;

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

    if (!currentChild) {
      wx.showToast({ title: '请先选择小朋友', icon: 'none' });
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
            subject: subject,
            childId: currentChild.id
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
    const currentChild = this.data.currentChild;
    
    if (!currentChild) {
      wx.showToast({ title: '请先选择小朋友', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '复制中...' });
    
    wx.cloud.callFunction({
      name: 'copyHomework',
      data: {
        sourceDate: sourceDate,
        targetDate: targetDate,
        subject: subject,
        childId: currentChild.id
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
    let d;
    if (typeof date === 'object' && date.getFullYear) {
      // 已经是 Date 对象
      d = date;
    } else if (typeof date === 'string') {
      d = new Date(date);
    } else if (date._seconds) {
      // 云数据库时间戳格式
      d = new Date(date._seconds * 1000);
    } else {
      d = new Date(date);
    }
    if (isNaN(d.getTime())) return '';
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  // 生成日历数据
  generateCalendarData(checkins = []) {
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
    const dateHomeworkStats = this.generateDateHomeworkStats(checkins);
    
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

    // 检查是否登录
    if (!app.globalData.isLoggedIn && !app.globalData.openid) {
      // 未登录，更新演示日历数据
      const demoCalendarData = this.generateDemoCalendar();
      this.setData({ calendarData: demoCalendarData });
    } else {
      // 已登录，加载打卡记录
      this.loadMonthCheckins();
    }
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

    // 检查是否登录
    if (!app.globalData.isLoggedIn && !app.globalData.openid) {
      // 未登录，更新演示日历数据
      const demoCalendarData = this.generateDemoCalendar();
      this.setData({ calendarData: demoCalendarData });
    } else {
      // 已登录，加载打卡记录
      this.loadMonthCheckins();
    }
  },

  // 切换日历展开/收起
  toggleCalendarExpand() {
    this.setData({
      calendarExpanded: !this.data.calendarExpanded
    });
    this.generateCalendarData(this.data.monthCheckins);
  },

  // 日期点击事件
  onDateTap(e) {
    const dateItem = e.currentTarget.dataset.date;
    if (!dateItem.isCurrentMonth) return;
    
    // 解析选中日期
    const dateObj = new Date(dateItem.dateStr);
    const formattedDate = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
    
    // 检查是否需要调整月份
    const selectedYear = dateObj.getFullYear();
    const selectedMonth = dateObj.getMonth();
    const needMonthChange = (selectedYear !== this.data.currentYear || selectedMonth !== this.data.currentMonth);
    
    if (needMonthChange) {
      // 需要调整月份，更新年月
      this.setData({
        selectedDate: dateItem.dateStr,
        formattedSelectedDate: formattedDate,
        currentYear: selectedYear,
        currentMonth: selectedMonth
      });
      
      // 检查是否登录
      if (!app.globalData.isLoggedIn && !app.globalData.openid) {
        // 未登录，更新演示数据
        const demoCalendarData = this.generateDemoCalendar();
        this.setData({ calendarData: demoCalendarData });
        // 更新选中日期的作业
        this.updateDemoSelectedDateHomework(dateItem.dateStr);
      } else {
        // 已登录，加载打卡记录
        this.loadMonthCheckins();
      }
    } else {
      // 月份相同，只更新选中日期
      this.setData({
        selectedDate: dateItem.dateStr,
        formattedSelectedDate: formattedDate
      });
      
      // 检查是否登录
      if (!app.globalData.isLoggedIn && !app.globalData.openid) {
        // 未登录，更新演示日历数据
        const demoCalendarData = this.generateDemoCalendar();
        this.setData({ calendarData: demoCalendarData });
        // 更新选中日期的作业
        this.updateDemoSelectedDateHomework(dateItem.dateStr);
      } else {
        this.generateCalendarData(this.data.monthCheckins);
      }
    }
  },

  // 更新演示数据中选中日期的作业
  updateDemoSelectedDateHomework(selectedDate) {
    const now = new Date();
    const currentChild = this.data.currentChild;
    const isFirstChild = !currentChild || currentChild.id === 'demo-child-1';

    // 生成与选中日期相关的演示作业
    const demoHomework = isFirstChild ? [
      {
        _id: 'demo-hw-1',
        title: '朗读课文30分钟',
        content: '阅读语文课本第5-10页',
        subject: '语文',
        status: 'completed',
        homeworkDate: selectedDate,
        createTime: now.toISOString(),
        checkInTime: now.toISOString(),
        points: 5,
        actualPoints: 5
      },
      {
        _id: 'demo-hw-2',
        title: '口算练习20道',
        content: '练习加减法运算',
        subject: '数学',
        status: 'pending',
        homeworkDate: selectedDate,
        createTime: now.toISOString(),
        points: 3
      },
      {
        _id: 'demo-hw-3',
        title: '背诵单词10个',
        content: '学习新单词并背诵',
        subject: '英语',
        status: 'pending',
        homeworkDate: selectedDate,
        createTime: now.toISOString(),
        points: 4
      },
      {
        _id: 'demo-hw-4',
        title: '课外阅读',
        content: '阅读绘本故事书',
        subject: '阅读',
        status: 'completed',
        homeworkDate: selectedDate,
        createTime: now.toISOString(),
        checkInTime: now.toISOString(),
        points: 3,
        actualPoints: 3
      }
    ] : [
      {
        _id: 'demo-hw-5',
        title: '数学应用题',
        content: '完成练习册的应用题',
        subject: '数学',
        status: 'pending',
        homeworkDate: selectedDate,
        createTime: now.toISOString(),
        points: 4
      },
      {
        _id: 'demo-hw-6',
        title: '背古诗一首',
        content: '背诵唐诗一首',
        subject: '语文',
        status: 'completed',
        homeworkDate: selectedDate,
        createTime: now.toISOString(),
        checkInTime: now.toISOString(),
        points: 2,
        actualPoints: 2
      },
      {
        _id: 'demo-hw-7',
        title: '英语听力练习',
        content: '听英语录音20分钟',
        subject: '英语',
        status: 'completed',
        homeworkDate: selectedDate,
        createTime: now.toISOString(),
        checkInTime: now.toISOString(),
        points: 3,
        actualPoints: 3
      }
    ];

    // 根据选中科目筛选作业
    let subjectHomework = demoHomework;
    if (this.data.selectedSubject) {
      subjectHomework = demoHomework.filter(h => h.subject === this.data.selectedSubject);
    }

    // 生成基于新日期的日历数据
    const demoCalendarData = this.generateDemoCalendarForDate(demoHomework, selectedDate);

    this.setData({
      pendingHomework: demoHomework.filter(h => h.status === 'pending'),
      completedHomework: demoHomework.filter(h => h.status === 'completed'),
      subjectHomework: subjectHomework,
      selectedDateHomework: demoHomework,
      calendarData: demoCalendarData,
      completedToday: demoHomework.filter(h => h.status === 'completed').length
    });
  },

  // 生成每天作业统计
  generateDateHomeworkStats(checkins = []) {
    const stats = {};
    const pendingHomework = this.data.pendingHomework || [];
    const completedHomework = this.data.completedHomework || [];
    const allHomework = [...pendingHomework, ...completedHomework];
    const year = this.data.currentYear;
    const month = this.data.currentMonth;

    console.log('generateDateHomeworkStats:', {
      pendingCount: pendingHomework.length,
      completedCount: completedHomework.length,
      allHomeworkCount: allHomework.length,
      checkinCount: checkins.length,
      year,
      month,
      sampleDates: allHomework.slice(0, 3).map(h => ({ date: h.homeworkDate, status: h.status }))
    });

    // 创建打卡记录的映射表，key 为 homeworkId_date
    const checkinMap = {};
    checkins.forEach(checkin => {
      const key = `${checkin.homeworkId}_${checkin.date}`;
      checkinMap[key] = true;
    });

    for (let day = 1; day <= 31; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const targetDate = new Date(dateStr);
      if (targetDate.getMonth() !== month) break;

      let total = 0;
      let pending = 0;
      let completed = 0;

      allHomework.forEach(item => {
        if (item.homeworkDate === dateStr) {
          total++;
          
          // 检查是否有对应的打卡记录
          const checkinKey = `${item._id}_${dateStr}`;
          const hasCheckin = !!checkinMap[checkinKey];
          
          // 判断是否完成：
          // 1. 如果有打卡记录，就算完成
          // 2. 否则看 status 字段
          if (hasCheckin || item.status === 'completed') {
            completed++;
          } else {
            pending++;
          }
        }
      });

      if (total > 0) {
        console.log('Date has homework:', dateStr, { total, pending, completed });
        stats[dateStr] = { total, pending, completed };
      }
    }

    return stats;
  },

  // 检查日期是否有作业
  checkDateHasHomework(dateStr) {
    const today = new Date();
    const targetDate = new Date(dateStr);
    
    // 检查是否是今天或未来的日期
    if (targetDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      return false;
    }
    
    // 检查是否有作业
    const pendingHomework = this.data.pendingHomework || [];
    const completedHomework = this.data.completedHomework || [];
    const allHomework = [...pendingHomework, ...completedHomework];
    
    return allHomework.some(item => item.homeworkDate === dateStr);
  },

  // 更新选中日期的作业列表
  async updateSelectedDateHomework() {
    const selectedDate = this.data.selectedDate;
    if (!selectedDate) return;
    
    console.log('updateSelectedDateHomework - selectedDate:', selectedDate);
    
    // 合并已完成和未完成的作业
    const pendingHomework = this.data.pendingHomework || [];
    const completedHomework = this.data.completedHomework || [];
    const allHomework = [...pendingHomework, ...completedHomework];
    
    console.log('updateSelectedDateHomework - total homework count:', allHomework.length, {
      pendingCount: pendingHomework.length,
      completedCount: completedHomework.length
    });
    
    const selectedHomework = allHomework.filter(item => {
      return item.homeworkDate === selectedDate;
    });
    
    console.log('updateSelectedDateHomework - filtered homework count:', selectedHomework.length, {
      selectedHomework: selectedHomework.map(h => ({ id: h._id, title: h.title, date: h.homeworkDate, status: h.status, recurring: h.recurring }))
    });
    
    // 获取所有选中作业的打卡记录（不仅限于周期作业）
    const homeworkIds = selectedHomework.map(item => item._id);
    let dateCheckins = [];
    
    if (homeworkIds.length > 0) {
      const currentChild = this.data.currentChild;
      try {
        const res = await wx.cloud.callFunction({
          name: 'getCheckins',
          data: {
            childId: currentChild.id,
            homeworkIds: homeworkIds,
            startDate: selectedDate,
            endDate: selectedDate
          }
        });
        if (res.result && res.result.success) {
          dateCheckins = res.result.data;
        }
      } catch (err) {
        console.error('获取打卡记录失败:', err);
      }
    }
    
    const checkedInMap = {};
    dateCheckins.forEach(c => {
      checkedInMap[c.homeworkId] = c;
    });
    
    const processedHomework = selectedHomework.map(item => {
      // 检查是否有打卡记录（不管是不是周期作业）
      if (checkedInMap[item._id]) {
        const checkin = checkedInMap[item._id];
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
      // 没有打卡记录，使用数据库中的 status 字段
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

    // 检查是否登录
    if (!app.globalData.isLoggedIn && !app.globalData.openid) {
      // 未登录，更新演示数据
      this.updateDemoSelectedDateHomework(this.data.selectedDate);
    } else {
      // 已登录，正常更新
      this.updateSubjectHomework();
    }
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

  // 跳转到违规行为管理页面
  goToDeduction() {
    if (!this.checkLoginAndPrompt()) return;
    wx.navigateTo({
      url: '/pages/violations/violations'
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
    if (!this.checkLoginAndPrompt()) return;
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
    if (!this.checkLoginAndPrompt()) return;
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
    const currentChild = this.data.currentChild;
    if (!currentChild) {
      wx.showToast({
        title: '请先选择小朋友',
        icon: 'none'
      });
      return;
    }
    
    const name = this.data.newSubjectName.trim();
    if (!name) {
      wx.showToast({
        title: '请输入科目名称',
        icon: 'none'
      });
      return;
    }

    const subjects = currentChild.subjects || [];
    const maxSort = subjects.reduce((max, s) => Math.max(max, s.sort || 0), 0);
    
    const newSubject = {
      id: Date.now().toString(),
      name: name,
      color: this.getRandomColor(),
      sort: maxSort + 1
    };
    
    subjects.push(newSubject);
    this.updateChildSubjects(subjects, '添加成功');
  },

  // 更新科目
  updateSubject() {
    const currentChild = this.data.currentChild;
    if (!currentChild) {
      wx.showToast({
        title: '请先选择小朋友',
        icon: 'none'
      });
      return;
    }
    
    const name = this.data.editingSubjectName.trim();
    const subject = this.data.editingSubject;
    
    if (!name) {
      wx.showToast({
        title: '请输入科目名称',
        icon: 'none'
      });
      return;
    }

    const subjects = currentChild.subjects || [];
    const index = subjects.findIndex(s => s.id === subject.id);
    if (index !== -1) {
      subjects[index] = { ...subjects[index], name: name };
    }
    
    this.updateChildSubjects(subjects, '修改成功');
  },

  // 删除科目
  deleteSubject(e) {
    const currentChild = this.data.currentChild;
    if (!currentChild) {
      wx.showToast({
        title: '请先选择小朋友',
        icon: 'none'
      });
      return;
    }
    
    const subject = e.currentTarget.dataset.subject;
    
    wx.showModal({
      title: '删除科目',
      content: `确定要删除"${subject.name}"吗？该科目下的所有作业不会被删除，但会归为"其他"类别。`,
      confirmText: '确定删除',
      confirmColor: '#FF5252',
      success: (res) => {
        if (res.confirm) {
          const subjects = currentChild.subjects || [];
          const newSubjects = subjects.filter(s => s.id !== subject.id);
          this.updateChildSubjects(newSubjects, '删除成功');
        }
      }
    });
  },

  // 上移科目
  moveSubjectUp(e) {
    const currentChild = this.data.currentChild;
    if (!currentChild) {
      wx.showToast({
        title: '请先选择小朋友',
        icon: 'none'
      });
      return;
    }
    
    const subject = e.currentTarget.dataset.subject;
    const index = e.currentTarget.dataset.index;
    const subjects = [...currentChild.subjects || []];
    
    if (index === 0) {
      wx.showToast({
        title: '已经是第一个了',
        icon: 'none'
      });
      return;
    }

    // 交换位置
    [subjects[index], subjects[index - 1]] = [subjects[index - 1], subjects[index]];
    
    // 重新分配 sort
    subjects.forEach((s, i) => s.sort = i + 1);
    
    this.updateChildSubjects(subjects, '移动成功');
  },

  // 下移科目
  moveSubjectDown(e) {
    const currentChild = this.data.currentChild;
    if (!currentChild) {
      wx.showToast({
        title: '请先选择小朋友',
        icon: 'none'
      });
      return;
    }
    
    const subject = e.currentTarget.dataset.subject;
    const index = e.currentTarget.dataset.index;
    const subjects = [...currentChild.subjects || []];
    
    if (index === subjects.length - 1) {
      wx.showToast({
        title: '已经是最后一个了',
        icon: 'none'
      });
      return;
    }

    // 交换位置
    [subjects[index], subjects[index + 1]] = [subjects[index + 1], subjects[index]];
    
    // 重新分配 sort
    subjects.forEach((s, i) => s.sort = i + 1);
    
    this.updateChildSubjects(subjects, '移动成功');
  },

  // 更新当前小朋友的科目
  updateChildSubjects(subjects, successMsg) {
    const currentChild = this.data.currentChild;
    const userInfo = this.data.userInfo;
    
    wx.showLoading({ title: '保存中...' });
    
    wx.cloud.callFunction({
      name: 'manageSubjects',
      data: {
        action: 'updateSubjects',
        data: {
          childId: currentChild.id,
          subjects: subjects
        }
      },
      success: async res => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({
            title: successMsg,
            icon: 'success'
          });
          
          // 重新加载用户信息
          await this.loadUserInfo();
          
          this.setData({
            showAddSubjectModal: false,
            showEditSubjectModal: false,
            editingSubject: null
          });
          
          this.loadSubjects();
        } else {
          wx.showToast({
            title: res.result.errMsg || '保存失败，请重试',
            icon: 'none'
          });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('更新科目失败:', err);
        wx.showToast({
          title: '保存失败，请重试',
          icon: 'none'
        });
      }
    });
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
  },

  // 打开小朋友选择弹窗
  openChildModal() {
    // 未登录时直接打开，无需检查
    this.setData({ showChildModal: true });
  },

  // 关闭小朋友选择弹窗
  closeChildModal() {
    this.setData({ showChildModal: false });
  },

  // 切换小朋友
  switchChild(e) {
    const childId = e.currentTarget.dataset.id;

    // 检查是否登录
    if (!app.globalData.isLoggedIn && !app.globalData.openid) {
      // 未登录，切换演示小孩
      const selectedChild = this.data.children.find(c => c.id === childId);
      if (selectedChild) {
        this.setData({
          currentChild: selectedChild,
          showChildModal: false
        });
        // 更新演示数据
        this.setDemoData();
      }
      return;
    }

    // 已登录，正常切换
    if (!this.checkLoginAndPrompt()) return;
    
    wx.showLoading({ title: '切换中...' });
    
    wx.cloud.callFunction({
      name: 'manageChildren',
      data: {
        action: 'switch',
        child: { id: childId }
      },
      success: async res => {
        wx.hideLoading();
        if (res.result.success) {
          let userInfo = {
            ...this.data.userInfo,
            currentChildId: res.result.currentChildId
          };
          
          // 判断数据源：如果是家庭模式，需要重新加载家庭数据
          if (res.result.dataSource === 'family' || this.data.userInfo.familyId) {
            try {
              const familyRes = await db.collection('families').doc(this.data.userInfo.familyId).get();
              if (familyRes.data) {
                userInfo = {
                  ...userInfo,
                  children: familyRes.data.children || []
                };
              }
            } catch (err) {
              console.error('加载家庭数据失败:', err);
            }
          } else {
            userInfo = {
              ...userInfo,
              children: res.result.children
            };
          }
          
          // 找出当前选中的小朋友
          const currentChild = userInfo.children.find(c => c.id === childId);
          
          this.setData({ 
            userInfo: userInfo,
            currentChild: currentChild,
            showChildModal: false
          });
          
          app.saveUserInfo(userInfo);
          
          // 重新加载数据
          this.loadSubjects();
          this.loadHomework();
          
          wx.showToast({ title: '切换成功', icon: 'success' });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('切换小朋友失败:', err);
        wx.showToast({ title: '切换失败', icon: 'none' });
      }
    });
  },

  // 打开添加/编辑小朋友弹窗
  openAddChildModal(e) {
    if (!this.checkLoginAndPrompt()) return;

    // 检查是否有家庭
    if (!this.data.userInfo || !this.data.userInfo.familyId) {
      wx.showModal({
        title: '提示',
        content: '需要先创建或加入家庭才能添加小朋友，是否现在创建？',
        confirmText: '创建家庭',
        cancelText: '稍后',
        success: (res) => {
          if (res.confirm) {
            this.openFamilyManage();
          }
        }
      });
      return;
    }

    const child = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.child : null;
    this.setData({
      showAddChildModal: true,
      editingChild: child || null,
      newChild: child ? { ...child } : {
        name: '',
        avatarUrl: '',
        gender: '',
        birthDate: '',
        schoolStage: ''
      }
    });
  },

  // 关闭添加/编辑小朋友弹窗
  closeAddChildModal() {
    this.setData({ 
      showAddChildModal: false,
      editingChild: null,
      newChild: {
        name: '',
        avatarUrl: '',
        gender: '',
        birthDate: '',
        schoolStage: ''
      }
    });
  },

  // 选择头像
  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: res => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        // 上传头像到云存储
        const filename = `avatar_${Date.now()}.jpg`;
        wx.cloud.uploadFile({
          cloudPath: filename,
          filePath: tempFilePath,
          success: uploadRes => {
            this.setData({
              'newChild.avatarUrl': uploadRes.fileID
            });
          },
          fail: err => {
            console.error('上传头像失败:', err);
          }
        });
      }
    });
  },

  // 保存小朋友
  saveChild() {
    const newChild = this.data.newChild;
    if (!newChild.name.trim()) {
      wx.showToast({ title: '请输入名字', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });
    const action = this.data.editingChild ? 'update' : 'add';

    wx.cloud.callFunction({
      name: 'manageChildren',
      data: {
        action: action,
        child: newChild
      },
      success: async res => {
        wx.hideLoading();
        if (res.result.success) {
          // 重新加载用户信息
          await this.loadUserInfo();
          
          this.setData({ 
            showAddChildModal: false
          });
          
          // 重新加载数据
          this.loadSubjects();
          this.loadHomework();
          
          wx.showToast({ title: '保存成功', icon: 'success' });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('保存小朋友失败:', err);
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    });
  },

  // 删除小朋友
  deleteChild(e) {
    if (!this.checkLoginAndPrompt()) return;
    const child = e.currentTarget.dataset.child;
    console.log('删除小朋友，child:', child);
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除"${child.name}"吗？`,
      success: res => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          wx.cloud.callFunction({
            name: 'manageChildren',
            data: {
              action: 'delete',
              child: { id: child.id }
            },
            success: async res => {
              wx.hideLoading();
              console.log('删除小朋友云函数返回:', res);
              
              if (res.result.success) {
                // 重新加载用户信息
                await this.loadUserInfo();
                
                // 重新加载数据
                this.loadSubjects();
                this.loadHomework();
                
                wx.showToast({ title: '删除成功', icon: 'success' });
              } else {
                console.log('删除失败，错误信息:', res.result.errMsg);
                wx.showToast({ title: res.result.errMsg || '删除失败', icon: 'none', duration: 2000 });
              }
            },
            fail: err => {
              wx.hideLoading();
              console.error('删除小朋友云函数调用失败:', err);
              wx.showToast({ title: '删除失败', icon: 'none', duration: 2000 });
            }
          });
        }
      }
    });
  },

  // 设置小朋友姓名
  onChildNameInput(e) {
    this.setData({ 'newChild.name': e.detail.value });
  },

  // 设置小朋友性别
  selectChildGender(e) {
    const gender = e.currentTarget.dataset.gender;
    this.setData({ 'newChild.gender': gender });
  },

  // 设置小朋友出生日期
  onChildBirthDateChange(e) {
    this.setData({ 'newChild.birthDate': e.detail.value });
  },

  // 设置小朋友学龄阶段
  onChildSchoolStageChange(e) {
    const schoolStages = ['幼儿园', '小学一年级', '小学二年级', '小学三年级', '小学四年级', '小学五年级', '小学六年级', '初中', '高中'];
    this.setData({ 'newChild.schoolStage': schoolStages[e.detail.value] });
  },

  // ==================== 家庭管理相关函数 ====================

  // 打开家庭管理
  openFamilyManage() {
    if (!this.checkLoginAndPrompt()) return;
    if (this.data.userInfo.familyId) {
      // 已在家庭中，加载家庭信息
      this.loadFamilyInfo();
    } else {
      // 不在家庭中，显示选择界面
      this.setData({
        showFamilyManageModal: true
      });
    }
  },

  // 关闭家庭管理
  closeFamilyManage() {
    this.setData({
      showFamilyManageModal: false,
      showJoinFamilyModal: false,
      showCreateFamilyModal: false,
      showInviteCodeModal: false,
      familyName: '',
      inputInviteCode: ''
    });
  },

  // 加载家庭信息
  loadFamilyInfo() {
    wx.cloud.callFunction({
      name: 'manageFamily',
      data: {
        action: 'getFamilyInfo'
      },
      success: res => {
        if (res.result.success) {
          this.setData({
            familyInfo: res.result.family,
            familyMembers: res.result.family ? res.result.family.members : [],
            showFamilyManageModal: true
          });
        } else {
          this.setData({
            showFamilyManageModal: true
          });
        }
      },
      fail: err => {
        console.error('获取家庭信息失败:', err);
        this.setData({
          showFamilyManageModal: true
        });
      }
    });
  },

  // 显示创建家庭弹窗
  showCreateFamily() {
    this.setData({
      showCreateFamilyModal: true,
      showFamilyManageModal: false,
      familyName: ''
    });
  },

  // 家庭名称输入
  onFamilyNameInput(e) {
    this.setData({ familyName: e.detail.value });
  },

  // 创建家庭
  createFamily() {
    console.log('开始创建家庭，familyName:', this.data.familyName);
    
    if (!this.data.familyName || !this.data.familyName.trim()) {
      console.log('家庭名称为空');
      wx.showToast({ title: '请输入家庭名称', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '创建中...' });

    wx.cloud.callFunction({
      name: 'manageFamily',
      data: {
        action: 'createFamily',
        data: {
          familyName: this.data.familyName
        }
      },
      success: res => {
        wx.hideLoading();
        console.log('创建家庭云函数返回:', res);
        
        if (res.result && res.result.success) {
          wx.showToast({ title: '家庭创建成功', icon: 'success' });
          this.closeFamilyManage();
          setTimeout(() => {
            this.loadUserInfo();
          }, 1000);
        } else {
          console.log('创建失败，错误信息:', res.result && res.result.errMsg);
          wx.showToast({ title: res.result && res.result.errMsg || '创建失败', icon: 'none', duration: 2000 });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('创建家庭云函数调用失败:', err);
        wx.showToast({ title: '云函数调用失败', icon: 'none', duration: 2000 });
      }
    });
  },

  // 显示加入家庭弹窗
  showJoinFamily() {
    this.setData({
      showJoinFamilyModal: true,
      showFamilyManageModal: false
    });
  },

  // 输入邀请码
  onInviteCodeInput(e) {
    this.setData({
      inputInviteCode: e.detail.value
    });
  },

  // 验证邀请码并加入家庭
  verifyInviteCode() {
    if (!this.data.inputInviteCode.trim()) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '验证中...' });

    wx.cloud.callFunction({
      name: 'manageFamily',
      data: {
        action: 'verifyInvitationCode',
        data: {
          code: this.data.inputInviteCode.trim()
        }
      },
      success: res => {
        if (res.result.success) {
          // 验证成功，直接加入家庭
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

  // 加入家庭
  joinFamily(familyId) {
    wx.cloud.callFunction({
      name: 'manageFamily',
      data: {
        action: 'joinFamily',
        data: {
          familyId: familyId
        }
      },
      success: res => {
        wx.hideLoading();
        if (res.result.success) {
          wx.showToast({ title: '加入家庭成功', icon: 'success' });
          this.closeFamilyManage();
          // 重新加载用户信息
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

  // 生成邀请码
  generateInviteCode() {
    wx.showLoading({ title: '生成中...' });

    wx.cloud.callFunction({
      name: 'manageFamily',
      data: {
        action: 'generateInvitationCode'
      },
      success: res => {
        wx.hideLoading();
        if (res.result.success) {
          this.setData({
            inviteCode: res.result.code,
            showInviteCodeModal: true
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

  // 复制邀请码
  copyInviteCode() {
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' });
      }
    });
  },

  // 退出家庭
  leaveFamily() {
    wx.showModal({
      title: '确认退出',
      content: '退出家庭后，您将不再能查看和管理家庭数据',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '退出中...' });
          
          wx.cloud.callFunction({
            name: 'manageFamily',
            data: {
              action: 'leaveFamily'
            },
            success: res => {
              wx.hideLoading();
              if (res.result.success) {
                wx.showToast({ title: '已退出家庭', icon: 'success' });
                this.closeFamilyManage();
                // 重新加载用户信息
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
  }
});
