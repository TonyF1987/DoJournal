const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    violations: [],
    historyRecords: [],
    showHistory: false,
    showModal: false,
    editingViolation: null,
    currentViolation: {
      name: '',
      points: 10,
      icon: '⚠️',
      description: ''
    }
  },

  onLoad() {
    this.initViolations();
    this.loadViolations();
    this.loadHistoryRecords();
  },

  // 初始化违规行为数据
  initViolations() {
    // 检查是否已初始化
    db.collection('violations').count()
      .then(res => {
        if (res.total === 0) {
          // 添加默认违规行为
          this.addDefaultViolations();
        }
      })
      .catch(err => {
        console.error('检查违规行为失败:', err);
        // 如果集合不存在，直接尝试添加第一条记录来创建集合
        this.tryCreateFirstViolation();
      });
  },

  // 尝试创建第一条违规记录
  tryCreateFirstViolation() {
    const firstViolation = {
      name: '迟到',
      points: 5,
      icon: '⚠️',
      description: '上学迟到或不按时完成作业',
      isCustom: false,
      createTime: db.serverDate()
    };

    db.collection('violations').add({ data: firstViolation })
      .then(() => {
        console.log('第一条违规记录添加成功');
        // 添加剩余的违规记录
        this.addRemainingViolations();
      })
      .catch(err => {
        console.error('创建第一条违规记录失败', err);
        wx.showModal({
          title: '需要初始化',
          content: '请在云开发控制台中创建数据库集合 "violations" 和 "violationRecords"，然后再使用扣分功能。详细说明请查看项目 database/init.js 文件。',
          showCancel: false,
          confirmText: '我知道了'
        });
      });
  },

  // 添加剩余的违规行为
  addRemainingViolations() {
    const remainingViolations = [
      {
        name: '未完成作业',
        points: 10,
        icon: '⚠️',
        description: '未按时完成指定作业',
        isCustom: false,
        createTime: db.serverDate()
      },
      {
        name: '不认真听讲',
        points: 5,
        icon: '⚠️',
        description: '上课不认真听讲或注意力不集中',
        isCustom: false,
        createTime: db.serverDate()
      },
      {
        name: '忘记带物品',
        points: 5,
        icon: '⚠️',
        description: '忘记带课本、文具或其他必要物品',
        isCustom: false,
        createTime: db.serverDate()
      },
      {
        name: '表现差',
        points: 20,
        icon: '⚠️',
        description: '整体表现不佳或存在严重行为问题',
        isCustom: false,
        createTime: db.serverDate()
      }
    ];

    const addPromises = remainingViolations.map(violation => 
      db.collection('violations').add({ data: violation })
    );

    Promise.all(addPromises)
      .then(() => {
        console.log('剩余违规行为添加成功');
        this.loadViolations();
      })
      .catch(err => {
        console.error('添加剩余违规行为失败', err);
        // 即使有些失败，也尝试加载已有的
        this.loadViolations();
      });
  },

  onShow() {
    this.loadViolations();
    this.loadHistoryRecords();
  },

  // 加载违规行为列表
  loadViolations() {
    db.collection('violations')
      .orderBy('createTime', 'desc')
      .get()
      .then(res => {
        this.setData({ violations: res.data });
      })
      .catch(err => {
        console.error('加载违规行为失败:', err);
        // 如果集合不存在，尝试创建默认数据
        if (err.errCode === -502005) {
          this.tryCreateFirstViolation();
        } else {
          wx.showToast({
            title: '加载失败',
            icon: 'none'
          });
        }
      });
  },

  // 加载扣分记录
  loadHistoryRecords() {
    db.collection('violationRecords')
      .orderBy('createTime', 'desc')
      .limit(50)
      .get()
      .then(res => {
        const records = res.data.map(item => ({
          ...item,
          createTime: this.formatDate(item.createTime)
        }));
        this.setData({ historyRecords: records });
      })
      .catch(err => {
        console.error('加载扣分记录失败:', err);
      });
  },

  // 格式化日期
  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hour}:${minute}`;
  },

  // 显示添加弹窗
  showAddModal() {
    this.setData({
      showModal: true,
      editingViolation: null,
      currentViolation: {
        name: '',
        points: 10,
        icon: '⚠️',
        description: ''
      }
    });
  },

  // 显示编辑弹窗
  showEditModal(e) {
    e.stopPropagation();
    const violation = e.currentTarget.dataset.violation;
    this.setData({
      showModal: true,
      editingViolation: violation,
      currentViolation: { ...violation }
    });
  },

  // 关闭弹窗
  closeModal() {
    this.setData({ showModal: false });
  },

  // 选择违规行为并扣分
  selectViolation(e) {
    const violation = e.currentTarget.dataset.violation;
    wx.showModal({
      title: '确认扣分',
      content: `确定要为「${violation.name}」扣除 ${violation.points} 分吗？`,
      success: (res) => {
        if (res.confirm) {
          this.deductPoints(violation);
        }
      }
    });
  },

  // 扣除积分
  deductPoints(violation) {
    wx.showLoading({ title: '处理中...' });
    
    // 创建扣分记录
    db.collection('violationRecords').add({
      data: {
        violationId: violation._id,
        violationName: violation.name,
        points: violation.points,
        icon: violation.icon,
        createTime: db.serverDate()
      }
    })
    .then(() => {
      // 更新用户积分
      return this.updateUserPoints(-violation.points);
    })
    .then(() => {
      wx.hideLoading();
      wx.showToast({
        title: '扣分成功',
        icon: 'success'
      });
      this.loadHistoryRecords();
      app.loadUserInfo();
    })
    .catch(err => {
      wx.hideLoading();
      console.error('扣分失败:', err);
      wx.showToast({
        title: '扣分失败',
        icon: 'none'
      });
    });
  },

  // 更新用户积分
  updateUserPoints(delta) {
    return db.collection('users').get()
      .then(res => {
        if (res.data.length > 0) {
          const user = res.data[0];
          const newPoints = user.points + delta;
          return db.collection('users').doc(user._id).update({
            data: { points: newPoints }
          });
        }
        return Promise.resolve();
      });
  },

  // 提交违规行为
  submitViolation(e) {
    const { currentViolation, editingViolation } = this.data;
    const formData = e.detail.value;
    
    if (!currentViolation.name.trim()) {
      wx.showToast({ title: '请输入违规行为名称', icon: 'none' });
      return;
    }
    
    if (!currentViolation.points || currentViolation.points <= 0) {
      wx.showToast({ title: '请输入正确的分数', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });
    
    const violationData = {
      name: currentViolation.name.trim(),
      points: Number(currentViolation.points),
      icon: currentViolation.icon,
      description: currentViolation.description.trim(),
      isCustom: true
    };

    if (editingViolation) {
      // 编辑模式
      db.collection('violations').doc(editingViolation._id).update({
        data: violationData
      })
      .then(() => {
        this.handleSubmitSuccess();
      })
      .catch(err => {
        this.handleSubmitError(err);
      });
    } else {
      // 添加模式
      violationData.createTime = db.serverDate();
      db.collection('violations').add({
        data: violationData
      })
      .then(() => {
        this.handleSubmitSuccess();
      })
      .catch(err => {
        this.handleSubmitError(err);
      });
    }
  },

  // 处理提交成功
  handleSubmitSuccess() {
    wx.hideLoading();
    wx.showToast({
      title: '保存成功',
      icon: 'success'
    });
    this.closeModal();
    this.loadViolations();
  },

  // 处理提交错误
  handleSubmitError(err) {
    wx.hideLoading();
    console.error('保存失败:', err);
    wx.showToast({
      title: '保存失败',
      icon: 'none'
    });
  },

  // 删除违规行为
  deleteViolation(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个违规行为吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          db.collection('violations').doc(id).remove()
            .then(() => {
              wx.hideLoading();
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              });
              this.loadViolations();
            })
            .catch(err => {
              wx.hideLoading();
              console.error('删除失败:', err);
              wx.showToast({
                title: '删除失败',
                icon: 'none'
              });
            });
        }
      }
    });
  },

  // 删除扣分记录
  deleteHistoryRecord(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条扣分记录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          
          // 先获取记录
          db.collection('violationRecords').doc(id).get()
            .then(res => {
              const record = res.data;
              // 删除记录
              return db.collection('violationRecords').doc(id).remove()
                .then(() => {
                  // 恢复积分
                  if (record && record.points) {
                    return this.updateUserPoints(record.points);
                  }
                  return Promise.resolve();
                });
            })
            .then(() => {
              wx.hideLoading();
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              });
              this.loadHistoryRecords();
              app.loadUserInfo();
            })
            .catch(err => {
              wx.hideLoading();
              console.error('删除失败:', err);
              wx.showToast({
                title: '删除失败',
                icon: 'none'
              });
            });
        }
      }
    });
  },

  // 切换扣分记录显示
  toggleHistory() {
    this.setData({ showHistory: !this.data.showHistory });
  },

  // 输入违规行为名称
  onNameInput(e) {
    this.setData({ 'currentViolation.name': e.detail.value });
  },

  // 选择积分
  selectPoints(e) {
    const points = Number(e.currentTarget.dataset.points);
    this.setData({ 'currentViolation.points': points });
  },

  // 自定义积分输入
  onCustomPointsInput(e) {
    const points = Number(e.detail.value);
    this.setData({ 'currentViolation.points': points });
  },

  // 输入描述
  onDescriptionInput(e) {
    this.setData({ 'currentViolation.description': e.detail.value });
  }
});