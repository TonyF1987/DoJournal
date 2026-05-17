const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    currentTab: 0,
    userInfo: {},
    currentChild: null,
    children: [],
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
    rewards: [],
    violations: [],
    pointRecords: [],
    checkinRecords: [],
    showAddModal: false,
    showDetailModal: false,
    currentModalType: 'reward',
    editingItem: null,
    detailItem: null,
    currentItem: {
      name: '',
      points: '',
      description: '',
      icon: ''
    },
    rewardIcons: ['🎁', '📺', '🍬', '🎮', '🎡', '🎨', '⚽', '🚀', '🎪', '🎯', '🎭', '🏆'],
    violationIcons: ['⚠️', '🚫', '❌', '😢', '📝', '⏰', '💢', '😠'],
    showIconPicker: false,
    stats: {
      todayPoints: 0,
      weekPoints: 0,
      monthPoints: 0,
      totalPoints: 0,
      todayConsume: 0,
      weekConsume: 0,
      monthConsume: 0,
      totalConsume: 0
    },
    // 分页相关
    pageSize: 10,
    currentPage: 0,
    hasMore: true,
    isLoading: false,
    showDemoBanner: false
  },

  onLoad() {
    // 检查是否显示演示数据提示
    const shouldShowDemo = !app.globalData.isLoggedIn && !app.globalData.openid;
    this.setData({ showDemoBanner: shouldShowDemo });

    // 如果未登录，设置演示数据
    if (shouldShowDemo) {
      this.setDemoData();
      return;
    }
    this.loadUserInfo();
    this.loadRewards();
    this.loadViolations();
    this.loadPointRecords();
  },

  onShow() {
    // 检查是否显示演示数据提示
    const shouldShowDemo = !app.globalData.isLoggedIn && !app.globalData.openid;
    this.setData({ showDemoBanner: shouldShowDemo });

    // 如果未登录，设置演示数据
    if (shouldShowDemo) {
      this.setDemoData();
      return;
    }
    this.loadUserInfo();
    this.loadPointRecords();
  },

  setDemoData() {
    // 演示小朋友
    const demoChildren = [
      {
        id: 'demo-child-1',
        name: '小宝贝',
        avatarUrl: '',
        gender: 'male',
        birthDate: '2019-01-01',
        schoolStage: '幼儿园',
        points: 128,
        rewards: [
          { id: 'demo-reward-1', name: '看30分钟电视', points: 20, icon: '📺', description: '获得看电视的权限' },
          { id: 'demo-reward-2', name: '吃一颗糖', points: 5, icon: '🍬', description: '获得一颗糖' },
          { id: 'demo-reward-3', name: '玩15分钟游戏', points: 15, icon: '🎮', description: '获得玩游戏的时间' }
        ],
        violations: [
          { id: 'demo-violation-1', name: '作业错误太多', points: 5, icon: '⚠️', description: '扣除5积分' },
          { id: 'demo-violation-2', name: '看电视超时', points: 10, icon: '🚫', description: '扣除10积分' }
        ]
      }
    ];

    this.setData({
      children: demoChildren,
      currentChild: demoChildren[0],
      rewards: demoChildren[0].rewards,
      violations: demoChildren[0].violations
    });
  },

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

  loadUserInfo() {
    if (!app.globalData.userInfo) {
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo) {
        app.globalData.userInfo = JSON.parse(userInfo);
      }
    }

    if (app.globalData.openid) {
      const currentAccount = app.globalData.userInfo?.account || '';
      wx.cloud.callFunction({
        name: 'getUserInfo',
        data: {
          account: currentAccount
        },
        success: (res) => {
          if (res.result && res.result.success) {
            const userData = res.result.userInfo;
          
            // 获取当前小朋友
            const currentChild = this.getCurrentChild(userData);
            this.setData({ 
              userInfo: userData,
              currentChild: currentChild,
              children: userData.children || []
            });
            app.saveUserInfo(userData);
            app.globalData.isLoggedIn = true;
            // 加载奖励和惩罚
            this.loadRewards();
            this.loadViolations();
          }
        },
        fail: (err) => {
          console.error('获取用户信息失败:', err);
        }
      });
    }
  },

  getCurrentChild(userData) {
    if (!userData.children || !userData.currentChildId) {
      return null;
    }
    return userData.children.find(c => c.id === userData.currentChildId);
  },

  loadRewards() {
    console.log('开始加载奖励列表');
    const currentChild = this.data.currentChild;
    if (!currentChild) {
      console.log('没有选择小朋友，不加载奖励');
      this.setData({ rewards: [] });
      return;
    }
    const rewards = currentChild.rewards || [];
    rewards.sort((a, b) => (a.points || 0) - (b.points || 0));
    this.setData({ rewards: rewards });
  },

  loadViolations() {
    console.log('开始加载惩罚列表');
    const currentChild = this.data.currentChild;
    if (!currentChild) {
      console.log('没有选择小朋友，不加载惩罚');
      this.setData({ violations: [] });
      return;
    }
    const violations = currentChild.violations || [];
    violations.sort((a, b) => (a.points || 0) - (b.points || 0));
    this.setData({ violations: violations });
  },

  loadPointRecords(loadMore = false) {
    console.log('开始加载积分记录, loadMore:', loadMore);
    const currentChild = this.data.currentChild;
    if (!currentChild) {
      console.log('没有选择小朋友，不加载积分记录');
      this.setData({ pointRecords: [] });
      this.calculateStats([]);
      return;
    }

    if (this.data.isLoading) {
      console.log('正在加载中，跳过');
      return;
    }

    const currentPage = loadMore ? this.data.currentPage + 1 : 0;
    const pageSize = this.data.pageSize;
    const offset = currentPage * pageSize;

    this.setData({ isLoading: true });

    // 先加载所有记录用于统计（只在首次加载时）
    if (!loadMore) {
      wx.cloud.callFunction({
        name: 'getPointRecords',
        data: {
          childId: currentChild.id
        },
        success: (res) => {
          if (res.result && res.result.success) {
            const allRecords = res.result.data.map(item => ({
              ...item,
              createTime: this.formatDateTime(item.createTime),
              homeworkDate: item.homeworkDate || this.formatDateOnly(item.createTime)
            }));
            this.calculateStats(allRecords);
          } else {
            this.calculateStats([]);
          }
        },
        fail: (err) => {
          console.error('加载所有记录失败:', err);
          this.calculateStats([]);
        }
      });
    }

    // 分页加载兑换记录（奖励和惩罚）
    wx.cloud.callFunction({
      name: 'getPointRecords',
      data: {
        childId: currentChild.id,
        types: ['reward', 'violation'],
        limit: pageSize,
        skip: loadMore ? offset : 0
      },
      success: (res) => {
        if (res.result && res.result.success) {
          console.log('分页积分记录加载成功，数量:', res.result.data.length);
          const newRecords = res.result.data.map(item => ({
            ...item,
            createTime: this.formatDateTime(item.createTime),
            homeworkDate: item.homeworkDate || this.formatDateOnly(item.createTime)
          }));

          const pointRecords = loadMore ? [...this.data.pointRecords, ...newRecords] : newRecords;
          const hasMore = newRecords.length === pageSize;

          this.setData({
            pointRecords: pointRecords,
            currentPage: currentPage,
            hasMore: hasMore,
            isLoading: false
          });
        } else {
          this.setData({ isLoading: false });
        }
      },
      fail: (err) => {
        console.error('加载记录失败:', err);
        wx.showToast({
          title: '加载记录失败',
          icon: 'none',
          duration: 2000
        });
        this.setData({ isLoading: false });
      }
    });
  },

  calculateStats(records) {
    // 获取今天的本地日期字符串
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // 本周开始日期（周日）
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
    
    // 本月开始日期
    const monthStartStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    
    let todayPoints = 0;
    let weekPoints = 0;
    let monthPoints = 0;
    let totalPoints = 0;
    
    let todayConsume = 0;
    let weekConsume = 0;
    let monthConsume = 0;
    let totalConsume = 0;
    
    // 过滤出只和打卡相关的记录用于列表显示
    const checkinRecords = records.filter(record => 
      record.type === 'checkin' || record.type === 'cancel'
    );
    
    // 计算积分获取：checkin - cancel（因为cancel是负数）
    checkinRecords.forEach(record => {
      const isCheckin = record.type === 'checkin';
      const isCancel = record.type === 'cancel';
      
      const points = record.points || 0;
      
      // 使用 homeworkDate 来判断时间范围
      let recordDateStr;
      if (record.homeworkDate) {
        // homeworkDate 已经是字符串格式，直接使用
        recordDateStr = record.homeworkDate;
      } else if (record.createTime) {
        // 如果没有 homeworkDate，使用 createTime
        const createDate = new Date(record.createTime);
        recordDateStr = `${createDate.getFullYear()}-${String(createDate.getMonth() + 1).padStart(2, '0')}-${String(createDate.getDate()).padStart(2, '0')}`;
      } else {
        return; // 没有日期信息，跳过
      }
      
      // 积分获取：打卡增加，取消打卡减少
      if (isCheckin) {
        totalPoints += points;
        if (recordDateStr >= todayStr) todayPoints += points;
        if (recordDateStr >= weekStartStr) weekPoints += points;
        if (recordDateStr >= monthStartStr) monthPoints += points;
      } else if (isCancel) {
        totalPoints -= points;
        if (recordDateStr >= todayStr) todayPoints -= points;
        if (recordDateStr >= weekStartStr) weekPoints -= points;
        if (recordDateStr >= monthStartStr) monthPoints -= points;
      }
    });
    
    // 计算积分消耗：reward + violation
    records.forEach(record => {
      const isReward = record.type === 'reward';
      const isViolation = record.type === 'violation';
      
      if (!isReward && !isViolation) {
        return;
      }
      
      const points = record.points || 0;
      
      // 使用 createTime 来判断时间范围
      let recordDateStr;
      if (record.createTime) {
        const createDate = new Date(record.createTime);
        recordDateStr = `${createDate.getFullYear()}-${String(createDate.getMonth() + 1).padStart(2, '0')}-${String(createDate.getDate()).padStart(2, '0')}`;
      } else {
        return; // 没有日期信息，跳过
      }
      
      totalConsume += points;
      if (recordDateStr >= todayStr) todayConsume += points;
      if (recordDateStr >= weekStartStr) weekConsume += points;
      if (recordDateStr >= monthStartStr) monthConsume += points;
    });
    
    this.setData({
      stats: {
        todayPoints,
        weekPoints,
        monthPoints,
        totalPoints,
        todayConsume,
        weekConsume,
        monthConsume,
        totalConsume
      },
      checkinRecords: checkinRecords
    });
  },

  switchTab(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    console.log('切换Tab到', index);
    this.setData({ currentTab: index });
    
    if (index === 0) {
      this.loadRewards();
    } else if (index === 1) {
      this.loadViolations();
    } else if (index === 2) {
      this.loadPointRecords();
    } else if (index === 3) {
      this.loadPointRecords();
    }
  },

  showAddModal(e) {
    if (!this.checkLoginAndPrompt()) return;
    const type = e.currentTarget.dataset.type;
    this.setData({
      showAddModal: true,
      currentModalType: type,
      editingItem: null,
      showIconPicker: false,
      currentItem: { name: '', points: '', description: '', icon: type === 'reward' ? '🎁' : '⚠️' }
    });
  },

  editReward(e) {
    if (!this.checkLoginAndPrompt()) return;
    const item = e.currentTarget.dataset.item;
    const type = e.currentTarget.dataset.type;
    this.setData({
      showAddModal: true,
      currentModalType: type,
      editingItem: item,
      showIconPicker: false,
      currentItem: { name: item.name, points: item.points, description: item.description, icon: item.icon }
    });
  },

  deleteReward(e) {
    if (!this.checkLoginAndPrompt()) return;
    const item = e.currentTarget.dataset.item;
    const type = e.currentTarget.dataset.type;
    const currentChild = this.data.currentChild;
    
    if (!currentChild) {
      wx.showToast({ title: '请先选择小朋友', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: `确定要删除「${item.name}」吗？`,
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          
          wx.cloud.callFunction({
            name: 'manageRewards',
            data: {
              action: 'delete',
              data: {
                childId: currentChild.id,
                type: type,
                item: item
              },
              account: app.globalData.userInfo?.account || ''
            },
            success: (res) => {
              wx.hideLoading();
              if (res.result && res.result.success) {
                wx.showToast({ title: '删除成功', icon: 'success' });
                this.loadUserInfo();
                if (type === 'reward') {
                  this.loadRewards();
                } else {
                  this.loadViolations();
                }
              } else {
                wx.showToast({ title: res.result.errMsg || '删除失败', icon: 'none' });
              }
            },
            fail: (err) => {
              wx.hideLoading();
              console.error('删除失败:', err);
              wx.showToast({ title: '删除失败', icon: 'none' });
            }
          });
        }
      }
    });
  },

  showIconPicker() {
    this.setData({ showIconPicker: true });
  },

  selectIcon(e) {
    const icon = e.currentTarget.dataset.icon;
    this.setData({
      'currentItem.icon': icon,
      showIconPicker: false
    });
  },

  closeAddModal() {
    this.setData({ showAddModal: false, showIconPicker: false });
  },

  showDetailModal(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      showDetailModal: true,
      detailItem: item
    });
  },

  closeDetailModal() {
    this.setData({ showDetailModal: false });
  },

  onNameInput(e) {
    this.setData({ 'currentItem.name': e.detail.value });
  },

  onPointsInput(e) {
    this.setData({ 'currentItem.points': e.detail.value });
  },

  onDescInput(e) {
    this.setData({ 'currentItem.description': e.detail.value });
  },

  saveItem() {
    if (!this.checkLoginAndPrompt()) return;
    const { currentModalType, currentItem, editingItem, currentChild } = this.data;

    if (!currentChild) {
      wx.showToast({ title: '请先选择小朋友', icon: 'none' });
      return;
    }

    if (!currentItem.name.trim()) {
      wx.showToast({ title: '请输入名称', icon: 'none' });
      return;
    }

    if (!currentItem.points || Number(currentItem.points) <= 0) {
      wx.showToast({ title: '请输入有效积分', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });
    const data = {
      id: editingItem ? editingItem.id : Date.now().toString(),
      name: currentItem.name.trim(),
      points: Number(currentItem.points),
      description: currentItem.description || '',
      icon: currentItem.icon || (currentModalType === 'reward' ? '🎁' : '⚠️'),
      isCustom: true
    };

    const action = editingItem ? 'edit' : 'add';
    
    wx.cloud.callFunction({
      name: 'manageRewards',
      data: {
        action: action,
        data: {
          childId: currentChild.id,
          type: currentModalType,
          item: data
        },
        account: app.globalData.userInfo?.account || ''
      },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({ title: '保存成功', icon: 'success' });
          this.closeAddModal();
          this.loadUserInfo();
          if (currentModalType === 'reward') {
            this.loadRewards();
          } else {
            this.loadViolations();
          }
        } else {
          wx.showToast({ title: res.result.errMsg || '保存失败', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('保存失败:', err);
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    });
  },

  exchangeReward(e) {
    if (!this.checkLoginAndPrompt()) return;
    const rewardId = e.currentTarget.dataset.id;
    const points = Number(e.currentTarget.dataset.points);
    const currentChild = this.data.currentChild;
    const currentPoints = Number(currentChild?.points || 0);
    
    console.log('兑换奖励检查:', { rewardId, points, currentPoints, currentChild });

    if (!currentChild || currentPoints < points) {
      wx.showToast({ title: '积分不足', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认兑换',
      content: `确定花费${points}积分兑换此奖励吗？`,
      success: (res) => {
        if (res.confirm) {
          this.doExchange(rewardId, points);
        }
      }
    });
  },

  doExchange(rewardId, points) {
    wx.showLoading({ title: '处理中...' });
    const currentChild = this.data.currentChild;
    if (!currentChild) {
      wx.hideLoading();
      wx.showToast({ title: '请先选择小朋友', icon: 'none' });
      return;
    }
    
    wx.cloud.callFunction({
      name: 'exchangeReward',
      data: {
        childId: currentChild.id,
        rewardId: rewardId,
        points: points,
        account: app.globalData.userInfo?.account || ''
      },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({ title: '兑换成功', icon: 'success' });
          this.loadUserInfo();
          this.loadPointRecords();
        } else {
          wx.showToast({ title: res.result.errMsg || '兑换失败', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('兑换失败:', err);
        wx.showToast({ title: '兑换失败', icon: 'none' });
      }
    });
  },

  executePunishment(e) {
    if (!this.checkLoginAndPrompt()) return;
    const violation = e.currentTarget.dataset.item;

    wx.showModal({
      title: '确认惩罚',
      content: `确定执行「${violation.name}」吗？将扣除${violation.points}积分`,
      success: (res) => {
        if (res.confirm) {
          this.doPunishment(violation);
        }
      }
    });
  },

  doPunishment(violation) {
    wx.showLoading({ title: '处理中...' });
    const currentChild = this.data.currentChild;
    if (!currentChild) {
      wx.hideLoading();
      wx.showToast({ title: '请先选择小朋友', icon: 'none' });
      return;
    }
    
    wx.cloud.callFunction({
      name: 'manageRewards',
      data: {
        action: 'executeViolation',
        data: {
          childId: currentChild.id,
          violation: violation
        },
        account: app.globalData.userInfo?.account || ''
      },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({ title: '惩罚已记录', icon: 'success' });
          this.loadUserInfo();
          this.loadPointRecords();
        } else {
          wx.showToast({ title: res.result.errMsg || '执行失败', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('执行失败:', err);
        wx.showToast({ title: '执行失败', icon: 'none' });
      }
    });
  },

  formatDateTime(date) {
    if (!date) return '';
    let d;
    if (typeof date === 'object' && date.getFullYear) {
      d = date;
    } else if (typeof date === 'string') {
      d = new Date(date);
    } else if (date._seconds) {
      d = new Date(date._seconds * 1000);
    } else {
      d = new Date(date);
    }
    if (isNaN(d.getTime())) return '';
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const weekday = weekdays[d.getDay()];
    return `${weekday} ${month}-${day} ${year}`;
  },

  formatDateOnly(date) {
    if (!date) return '';
    let d;
    if (typeof date === 'object' && date.getFullYear) {
      d = date;
    } else if (typeof date === 'string') {
      d = new Date(date);
    } else if (date._seconds) {
      d = new Date(date._seconds * 1000);
    } else {
      d = new Date(date);
    }
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  goToProfile() {
    wx.showToast({ title: '个人中心功能开发中', icon: 'none' });
  },

  correctPoints() {
    wx.showToast({ title: '积分矫正功能开发中', icon: 'none' });
  },

  // 打开小朋友选择弹窗
  openChildModal() {
    if (!this.checkLoginAndPrompt()) return;
    this.setData({ showChildModal: true });
  },

  // 关闭小朋友选择弹窗
  closeChildModal() {
    this.setData({ showChildModal: false });
  },

  // 切换小朋友
  switchChild(e) {
    if (!this.checkLoginAndPrompt()) return;
    const childId = e.currentTarget.dataset.id;
    wx.showLoading({ title: '切换中...' });
    
    wx.cloud.callFunction({
      name: 'manageChildren',
      data: {
        action: 'switch',
        child: { id: childId },
        account: app.globalData.userInfo?.account || ''
      },
      success: async res => {
        wx.hideLoading();
        if (res.result.success) {
          // 调用 loadUserInfo 来重新加载用户数据
          await this.loadUserInfo();
          
          this.setData({
            showChildModal: false,
            currentPage: 0,
            hasMore: true,
            pointRecords: []
          });
          
          // 重新加载数据
          this.loadRewards();
          this.loadViolations();
          this.loadPointRecords(false);
          
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
    const child = e.currentTarget.dataset.child;
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
    if (!this.checkLoginAndPrompt()) return;
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
        child: newChild,
        account: app.globalData.userInfo?.account || ''
      },
      success: async res => {
        wx.hideLoading();
        if (res.result.success) {
          // 调用 loadUserInfo 来重新加载用户数据
          await this.loadUserInfo();
          
          this.setData({
            showAddChildModal: false
          });
          
          // 重新加载数据
          this.loadRewards();
          this.loadViolations();
          
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
    wx.showModal({
      title: '确认删除',
      content: `确定要删除「${child.name}」吗？`,
      success: async res => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          wx.cloud.callFunction({
            name: 'manageChildren',
            data: {
              action: 'delete',
              child: { id: child.id },
              account: app.globalData.userInfo?.account || ''
            },
            success: async res => {
              wx.hideLoading();
              if (res.result.success) {
                // 调用 loadUserInfo 来重新加载用户数据
                await this.loadUserInfo();
                
                // 重新加载数据
                this.loadRewards();
                this.loadViolations();
                
                wx.showToast({ title: '删除成功', icon: 'success' });
              }
            },
            fail: err => {
              wx.hideLoading();
              console.error('删除小朋友失败:', err);
              wx.showToast({ title: '删除失败', icon: 'none' });
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

  // 触底加载更多
  onReachBottom() {
    if (this.data.currentTab === 2 && this.data.hasMore && !this.data.isLoading) {
      console.log('触底加载更多记录');
      this.loadPointRecords(true);
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({
      currentPage: 0,
      hasMore: true
    });
    this.loadPointRecords(false);
    wx.stopPullDownRefresh();
  }
});
