const app = getApp();
const db = wx.cloud.database();

function getNthRecurringDate(recurringDays, nth, startDateStr) {
  let currentDate = startDateStr ? new Date(startDateStr) : new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  let count = 0;
  
  while (count < nth) {
    const dayOfWeek = currentDate.getDay();
    if (recurringDays.includes(dayOfWeek)) {
      count++;
      if (count === nth) {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return null;
}

Page({
  data: {
    isEdit: false,
    homeworkId: '',
    title: '',
    content: '',
    type: 'manual',
    importedContent: [],
    recurring: false,
    recurringDays: [],
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],
    points: 10,
    canSubmit: false,
    subjects: [],
    selectedSubject: '',
    showSubjectSelector: false,
    newSubjectName: '',
    showAddSubjectModal: false,
    isSubjectMode: false,
    subjectHomeworkList: [],
    showAddForm: false,
    editingHomework: null,
    recurringEndType: 'times', // 结束类型: date(截止日期), times(重复次数)
    recurringEndDate: '', // 截止日期
    recurringEndTimes: 8, // 重复次数(默认8次)
    showDatePicker: false
  },

  onLoad(options) {
    // 设置今天的日期
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    this.setData({ today: todayStr });
    
    // 检查登录状态
    if (!app.globalData.isLoggedIn && !app.globalData.openid) {
      console.log('用户未登录，跳转到登录页面');
      wx.navigateTo({
        url: '/pages/login/login'
      });
      return;
    }

    if (options.id) {
      const selectedDate = options.date || '';
      this.setData({ 
        isEdit: true, 
        homeworkId: options.id,
        selectedDate: selectedDate
      });
      this.loadHomework(options.id);
      wx.setNavigationBarTitle({ title: '编辑任务' + (selectedDate ? ' (' + selectedDate + ')' : '') });
    } else if (options.subject) {
      const subject = decodeURIComponent(options.subject);
      const selectedDate = options.date || '';
      this.setData({ 
        isSubjectMode: true, 
        selectedSubject: subject,
        selectedDate: selectedDate,
        showAddForm: false 
      });
      wx.setNavigationBarTitle({ title: subject + ' 作业' + (selectedDate ? ' (' + selectedDate + ')' : '') });
      this.loadSubjectHomework(subject);
    } else {
      const selectedDate = options.date || '';
      this.setData({ selectedDate: selectedDate });
      wx.setNavigationBarTitle({ title: '添加任务' + (selectedDate ? ' (' + selectedDate + ')' : '') });
    }

    if (options.scene === 1044 && options.shareTicket) {
      wx.getShareInfo({
        shareTicket: options.shareTicket,
        success: (res) => {
          console.log('分享信息:', res);
        }
      });
    }

    if (app.globalData && app.globalData.sharedMessage) {
      this.handleSharedMessage(app.globalData.sharedMessage);
      app.globalData.sharedMessage = null;
    }
  },

  loadHomework(homeworkId) {
    wx.showLoading({ title: '加载中...' });
    wx.cloud.callFunction({
      name: 'getHomework',
      data: { homeworkId },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          const data = res.result.data;
          this.setData({
            title: data.title || '',
            content: data.content || '',
            type: data.type || 'manual',
            recurring: data.recurring || false,
            recurringDays: data.recurringDays || [],
            recurringEndType: data.recurringEndType || 'never',
            recurringEndDate: data.recurringEndDate || '',
            recurringEndTimes: data.recurringEndTimes || 4,
            points: data.points || 10,
            subject: data.subject || '',
            selectedSubject: data.subject || '',
            importedContent: (data.images || []).map(url => ({ type: 'image', url }))
          });
          this.updateCanSubmit();
        } else {
          wx.showToast({ title: (res.result && res.result.errMsg) || '加载失败', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({ title: '加载失败', icon: 'none' });
        console.error(err);
      }
    });
  },

  handleSharedMessage(message) {
    console.log('转发的消息:', message);

    let content = '';
    let images = [];

    if (message.type === 'text') {
      content = message.content;
    } else if (message.type === 'image') {
      images.push({
        type: 'image',
        url: message.path
      });
      content = '从聊天导入的作业图片';
    } else if (message.type === 'file') {
      images.push({
        type: 'image',
        url: message.path
      });
      content = message.name || '从聊天导入的文件';
    }

    if (images.length > 0) {
      wx.showModal({
        title: '识别作业内容',
        content: '是否使用AI识别图片中的作业文字?',
        success: (res) => {
          if (res.confirm) {
            this.recognizeImageContent(images[0].url);
          } else {
            this.setData({
              title: '作业',
              content: content,
              importedContent: images,
              type: 'import'
            });
            this.updateCanSubmit();
          }
        }
      });
    } else if (content) {
      this.setData({
        title: '作业',
        content: content,
        type: 'import'
      });
      this.updateCanSubmit();
    }
  },

  onShareAppMessage() {
    return {
      title: this.data.isEdit ? '编辑作业' : '添加作业',
      path: '/pages/add/add'
    };
  },

  onShow() {
    const app = getApp();
    if (app.globalData && app.globalData.sharedMessage && !this.data.hasHandledShare) {
      this.handleSharedMessage(app.globalData.sharedMessage);
      app.globalData.sharedMessage = null;
      this.setData({ hasHandledShare: true });
    }
    
    if (this.data.isSubjectMode) {
      this.loadSubjectHomework(this.data.selectedSubject);
    }
  },

  loadSubjectHomework(subject) {
    wx.showLoading({ title: '加载中...' });
    const selectedDate = this.data.selectedDate;
    
    // 获取当前小朋友ID
    const currentChild = app.getCurrentChild ? app.getCurrentChild() : null;
    const childId = currentChild ? currentChild.id : (app.globalData.currentChildId || '');
    
    if (!childId) {
      wx.hideLoading();
      this.setData({ subjectHomeworkList: [] });
      return;
    }
    
    // 通过云函数获取该科目当前小朋友的所有未完成作业
    wx.cloud.callFunction({
      name: 'getHomeworks',
      data: {
        childId: childId,
        subject: subject,
        status: 'pending'
      },
      success: (res) => {
        wx.hideLoading();
        
        if (res.result && res.result.success) {
          let homeworkList = res.result.data || [];
          
          // 如果有选中的日期，只显示该日期的作业
          if (selectedDate) {
            homeworkList = homeworkList.filter(item => {
              return item.homeworkDate === selectedDate;
            });
          } else {
            // 没有选中日期时，正常去重显示
            const seenBatchIds = new Set();
            const filteredHomework = [];
            homeworkList.forEach(item => {
              if (item.recurringBatchId) {
                // 同一批里只保留一条
                if (!seenBatchIds.has(item.recurringBatchId)) {
                  seenBatchIds.add(item.recurringBatchId);
                  filteredHomework.push(item);
                }
              } else {
                // 没有批次ID的都保留
                filteredHomework.push(item);
              }
            });
            homeworkList = filteredHomework;
          }
          
          this.setData({
            subjectHomeworkList: homeworkList.map(item => ({
              ...item,
              createTimeText: this.formatDate(item.createTime),
              recurringDaysText: item.recurring ? this.formatRecurringDays(item.recurringDays) : ''
            }))
          });
        } else {
          this.setData({ subjectHomeworkList: [] });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('加载科目作业失败:', err);
        wx.showToast({ title: '加载失败，请重试', icon: 'none' });
        this.setData({ subjectHomeworkList: [] });
      }
    });
  },

  formatDate(date) {
    if (!date) return '';
    // 处理云数据库返回的日期格式
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
    return `创建于${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  },

  formatRecurringDays(days) {
    if (!days || days.length === 0) return '';
    const weekDayNames = ['日', '一', '二', '三', '四', '五', '六'];
    const sortedDays = [...days].sort((a, b) => a - b);
    return '每' + sortedDays.map(d => '周' + weekDayNames[d]).join('、');
  },

  toggleAddForm() {
    if (this.data.showAddForm) {
      this.setData({ showAddForm: false });
    } else {
      this.resetForm();
      this.setData({ showAddForm: true });
    }
  },

  resetForm() {
    this.setData({
      content: '',
      type: 'manual',
      importedContent: [],
      recurring: false,
      recurringDays: [],
      recurringEndType: 'times',
      recurringEndDate: '',
      recurringEndTimes: 8,
      points: 10,
      editingHomework: null
    });
  },

  editHomework(e) {
    const homework = e.currentTarget.dataset.homework;
    this.setData({
      editingHomework: homework,
      content: homework.content,
      type: homework.type || 'manual',
      recurring: homework.recurring || false,
      recurringDays: homework.recurringDays || [],
      recurringEndType: homework.recurringEndType || 'never',
      recurringEndDate: homework.recurringEndDate || '',
      recurringEndTimes: homework.recurringEndTimes || 4,
      points: homework.points || 10,
      showAddForm: true
    });
  },

  deleteHomeworkFromList(e) {
    const homework = e.currentTarget.dataset.homework;
    const that = this;
    
    if (homework.recurring || homework.recurringBatchId) {
      // 这是周期作业（主作业或其中一天）
      wx.showActionSheet({
        itemList: ['仅删除当天作业', '删除所有周期作业'],
        itemColor: '#FF5252',
        success(res) {
          if (res.tapIndex === 0) {
            wx.showModal({
              title: '确认删除',
              content: '这是周期作业，删除将清除周期设置，并删除当前作业，是否继续？',
              confirmText: '继续',
              confirmColor: '#FF5252',
              success(modalRes) {
                if (modalRes.confirm) {
                  that.doDeleteHomeworkFromList(homework, 'single-convert');
                }
              }
            });
          } else if (res.tapIndex === 1) {
            wx.showModal({
              title: '确认删除所有',
              content: '确定要删除所有周期作业吗？此操作不可恢复。',
              confirmText: '确定删除',
              confirmColor: '#FF5252',
              success(modalRes) {
                if (modalRes.confirm) {
                  that.doDeleteHomeworkFromList(homework, 'all');
                }
              }
            });
          }
        }
      });
    } else {
      wx.showModal({
        title: '删除作业',
        content: '确定要删除这个作业吗？',
        confirmText: '确定删除',
        confirmColor: '#FF5252',
        success(res) {
          if (res.confirm) {
            that.doDeleteHomeworkFromList(homework, 'single');
          }
        }
      });
    }
  },

  doDeleteHomeworkFromList(homework, deleteMode = 'single') {
    wx.showLoading({ title: '删除中...' });
    
    wx.cloud.callFunction({
      name: 'deleteHomework',
      data: {
        homeworkId: homework._id,
        deleteMode: deleteMode
      },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          const count = res.result.count || 1;
          const msg = deleteMode === 'all' ? `成功删除${count}个作业` : '删除成功';
          wx.showToast({ title: msg, icon: 'success' });
          this.loadSubjectHomework(this.data.selectedSubject);
          
          const pages = getCurrentPages();
          if (pages.length > 1) {
            const prevPage = pages[pages.length - 2];
            if (prevPage && prevPage.loadHomework) {
              prevPage.loadHomework();
            }
          }
        } else {
          wx.showToast({ title: (res.result && res.result.errMsg) || '删除失败', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('删除作业失败:', err);
        wx.showToast({ title: '删除失败', icon: 'none' });
      }
    });
  },

  onTitleInput(e) {
    this.setData({
      title: e.detail.value
    });
    this.updateCanSubmit();
  },

  onContentInput(e) {
    this.setData({
      content: e.detail.value
    });
    this.updateCanSubmit();
  },

  selectType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ type });

    if (type === 'import' && this.data.importedContent.length === 0) {
      this.selectChatMaterial();
    }
  },

  selectChatMaterial() {
    wx.showActionSheet({
      itemList: ['从聊天选择图片', '拍照识别作业', '我知道如何转发'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.selectFromAlbum();
        } else if (res.tapIndex === 1) {
          this.takePhoto();
        } else if (res.tapIndex === 2) {
          this.showForwardGuide();
        }
      }
    });
  },

  previewImage(e) {
    const current = e.currentTarget.dataset.src;
    const urls = this.data.importedContent.filter(item => item.type === 'image').map(item => item.url);
    
    wx.previewImage({
      current,
      urls
    });
  },

  removeImage(e) {
    const index = e.currentTarget.dataset.index;
    const importedContent = [...this.data.importedContent];
    importedContent.splice(index, 1);
    
    this.setData({
      importedContent
    });
    
    this.updateCanSubmit();
  },

  recognizeAllImages() {
    const images = this.data.importedContent.filter(item => item.type === 'image');
    
    if (images.length === 0) {
      wx.showToast({
        title: '请先添加图片',
        icon: 'none'
      });
      return;
    }
    
    const hasExistingContent = this.data.content && this.data.content.trim().length > 0;
    
    if (images.length === 1) {
      this.recognizeImageContent(images[0].url, hasExistingContent);
    } else {
      this.recognizeMultipleImages(images);
    }
  },

  recognizeMultipleImages(images) {
    wx.showLoading({ title: '图片识别中...' });
    
    let totalContent = [];
    const existingContent = this.data.content || '';
    
    const recognizeNext = (index) => {
      if (index >= images.length) {
        wx.hideLoading();
        if (totalContent.length > 0) {
          let finalContent = totalContent.join('\n---\n');
          if (existingContent) {
            finalContent = existingContent + '\n---\n' + finalContent;
          }
          this.setData({
            content: finalContent
          });
          this.updateCanSubmit();
          
          wx.showToast({
            title: '识别完成',
            icon: 'success'
          });
        }
        return;
      }
      
      this.uploadAndRecognize(images[index].url).then(result => {
        if (result) {
          totalContent.push(result);
        }
        recognizeNext(index + 1);
      }).catch(error => {
        console.error(`识别第${index + 1}张图片失败:`, error);
        recognizeNext(index + 1);
      });
    };
    
    recognizeNext(0);
  },

  selectFromAlbum() {
    wx.chooseImage({
      count: 9,
      sizeType: ['original', 'compressed'],
      sourceType: ['album'],
      success: (res) => {
        const newImages = res.tempFilePaths.map(path => ({
          type: 'image',
          url: path
        }));

        if (!this.data.title) {
          this.setData({ title: '作业' });
        }

        if (newImages.length > 0) {
          const existingImages = this.data.importedContent || [];
          const allImages = [...existingImages, ...newImages];
          
          this.setData({ importedContent: allImages });

          const hasExistingContent = this.data.content && this.data.content.trim().length > 0;
          
          wx.showModal({
            title: '识别作业内容',
            content: hasExistingContent ? '是否使用AI识别新图片中的作业文字？（将追加到现有内容后）' : '是否使用AI识别图片中的作业文字?',
            success: (modalRes) => {
              if (modalRes.confirm) {
                this.recognizeImageContent(newImages[0].url, hasExistingContent);
              } else {
                if (!hasExistingContent) {
                  this.setData({
                    title: '作业',
                    content: `包含${allImages.length}张作业图片`,
                    importedContent: allImages,
                    type: 'import'
                  });
                }
                this.updateCanSubmit();
              }
            }
          });
        }
      }
    });
  },

  takePhoto() {
    wx.chooseImage({
      count: 1,
      sizeType: ['original'],
      sourceType: ['camera'],
      success: (res) => {
        const image = {
          type: 'image',
          url: res.tempFilePaths[0]
        };

        if (!this.data.title) {
          this.setData({ title: '作业' });
        }

        this.setData({ importedContent: [image] });
        this.recognizeImageContent(image.url);
      }
    });
  },

  showForwardGuide() {
    wx.showModal({
      title: '如何从聊天导入',
      content: '1. 在微信聊天中长按作业消息\n2. 点击"转发"\n3. 选择本小程序\n4. 系统自动识别并填充',
      confirmText: '我知道了',
      showCancel: false
    });
  },

  recognizeImageContent(imagePath, appendMode = false) {
    this.showOCRModeSelector(imagePath, appendMode);
  },

  showOCRModeSelector(imagePath, appendMode = false) {
    wx.showActionSheet({
      itemList: ['🔥 AI智能识别（推荐）', '✏️ 手动输入'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.recognizeWithAI(imagePath, appendMode);
        } else {
          let newContent = `已导入图片，请手动输入作业内容`;
          if (appendMode && this.data.content) {
            newContent = this.data.content + '\n---\n' + newContent;
          }
          this.setData({
            content: newContent
          });
          this.updateCanSubmit();
        }
      }
    });
  },

  // 使用AI识别
  recognizeWithAI(imagePath, appendMode = false) {
    this.uploadAndRecognize(imagePath, appendMode);
  },

  uploadAndRecognize(imagePath, appendMode = false) {
    const that = this;

    return new Promise((resolve, reject) => {
      wx.showLoading({ title: '上传图片中...' });

      const cloudPath = `homework-ocr/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;

      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: imagePath,
        success: (uploadRes) => {
          const fileID = uploadRes.fileID;

          wx.showLoading({ title: 'AI识别中...' });

          wx.cloud.callFunction({
            name: 'ocrBaidu',
            data: {
              imgUrl: fileID,
              mode: 'auto'
            },
            success: (res) => {
              wx.hideLoading();

              if (res.result && res.result.errCode === 0) {
                if (res.result.isMock) {
                  wx.showModal({
                    title: 'OCR服务未开通',
                    content: res.result.notice || 'OCR服务暂不可用,请手动输入作业内容',
                    confirmText: '手动输入',
                    showCancel: false,
                    success: () => {
                      that.setData({
                        content: ''
                      });
                      that.updateCanSubmit();
                    }
                  });
                  resolve('');
                  return;
                }

                const text = res.result.items
                  .map(item => item.text)
                  .join('\n');

                if (text.trim()) {
                  let finalContent = text.trim();
                  if (appendMode && that.data.content) {
                    finalContent = that.data.content + '\n---\n' + text.trim();
                  }
                  that.setData({
                    content: finalContent
                  });
                  that.updateCanSubmit();

                  wx.showToast({
                    title: '识别成功',
                    icon: 'success'
                  });
                  resolve(text.trim());
                } else {
                  wx.showToast({
                    title: '未识别到文字',
                    icon: 'none'
                  });
                  resolve('');
                }
              } else if (res.result && res.result.errMsg) {
                console.error('OCR识别失败:', res.result.errMsg);
                
                let title = '服务错误';
                let content = res.result.notice || 'OCR服务暂时不可用，您可以手动输入作业内容';
                
                if (res.result.errCode === -3) {
                  title = 'OCR服务未开通';
                  content = res.result.notice || '请先开通阿里云OCR服务，或使用手动输入方式添加作业';
                }
                
                wx.showModal({
                  title: title,
                  content: content,
                  confirmText: '手动输入',
                  showCancel: false,
                  success: () => {
                    that.setData({
                      content: ''
                    });
                    that.updateCanSubmit();
                  }
                });
                resolve('');
              } else {
                console.error('OCR识别失败:', res.result);

                let errorMsg = res.result?.errMsg || '无法识别图片中的文字';
                if (res.result?.errorDetail) {
                  errorMsg += `\n错误代码: ${res.result.errorDetail.errCode}`;
                  errorMsg += `\n详细信息: ${res.result.errorDetail.errMsg}`;
                }
                if (res.result?.notice) {
                  errorMsg += `\n\n提示: ${res.result.notice}`;
                }

                wx.showModal({
                  title: 'OCR识别失败',
                  content: errorMsg,
                  confirmText: '手动输入',
                  showCancel: false,
                  success: () => {
                    that.setData({
                      content: ''
                    });
                    that.updateCanSubmit();
                  }
                });
                resolve('');
              }
            },
            fail: (err) => {
              wx.hideLoading();
              console.error('OCR识别失败:', err);
              wx.showModal({
                title: '识别失败',
                content: err.errMsg || '云函数调用失败,请检查云函数是否已部署',
                showCancel: false
              });
              reject(err);
            }
          });
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('上传图片失败:', err);
          wx.showToast({
            title: '上传失败',
            icon: 'none'
          });
          reject(err);
        }
      });
    });
  },

  onRecurringChange(e) {
    this.setData({
      recurring: e.detail.value,
      recurringDays: []
    });
    this.updateCanSubmit();
  },

  toggleDay(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    let recurringDays = [...this.data.recurringDays];
    const idx = recurringDays.indexOf(index);

    if (idx === -1) {
      recurringDays.push(index);
    } else {
      recurringDays.splice(idx, 1);
    }

    this.setData({ recurringDays });
    this.updateCanSubmit();
  },

  selectEndType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ 
      recurringEndType: type,
      showDatePicker: false
    });
  },

  onDateChange(e) {
    this.setData({ 
      recurringEndDate: e.detail.value,
      showDatePicker: false
    });
  },

  onTimesChange(e) {
    this.setData({ 
      recurringEndTimes: parseInt(e.detail.value)
    });
  },

  getTotalDays() {
    return this.data.recurringEndTimes;
  },

  showDatePicker() {
    this.setData({ showDatePicker: true });
  },

  selectPoints(e) {
    const points = parseInt(e.currentTarget.dataset.points);
    this.setData({ points: points });
  },

  increasePoints() {
    let points = this.data.points + 5;
    if (points > 1000) points = 1000;
    this.setData({ points: points });
  },

  decreasePoints() {
    let points = this.data.points - 5;
    if (points < 1) points = 1;
    this.setData({ points: points });
  },

  onCustomPointsInput(e) {
    let value = parseInt(e.detail.value) || 1;
    if (value < 1) value = 1;
    if (value > 1000) value = 1000;
    this.setData({ points: value });
  },

  submitHomework(e) {
    if (!this.canSubmit()) {
      return;
    }

    wx.showLoading({
      title: this.data.editingHomework ? '保存中...' : (this.data.isEdit ? '保存中...' : '添加中...')
    });

    const images = this.data.importedContent
      .filter(item => item.type === 'image')
      .map(item => item.url);

    if (this.data.editingHomework) {
      this.updateHomeworkFromList(images);
    } else if (this.data.isEdit) {
      this.updateHomework(images);
    } else {
      this.addHomework(images);
    }
  },

  updateHomeworkFromList(images) {
    const homework = this.data.editingHomework;
    
    wx.cloud.callFunction({
      name: 'updateHomework',
      data: {
        homeworkId: homework._id,
        title: this.data.selectedSubject || '作业',
        content: this.data.content,
        type: this.data.type,
        recurring: this.data.recurring,
        recurringDays: this.data.recurringDays,
        recurringEndType: this.data.recurring ? this.data.recurringEndType : '',
        recurringEndDate: this.data.recurring && this.data.recurringEndType === 'date' ? this.data.recurringEndDate : '',
        recurringEndTimes: this.data.recurring && this.data.recurringEndType === 'times' ? this.data.recurringEndTimes : 0,
        images: images,
        points: this.data.points,
        subject: this.data.selectedSubject
      },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          });
          this.setData({
            showAddForm: false,
            editingHomework: null
          });
          this.loadSubjectHomework(this.data.selectedSubject);
        } else {
          wx.showToast({
            title: (res.result && res.result.errMsg) || '保存失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('保存失败:', err);
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    });
  },

  addHomework(images) {
    const date = this.data.selectedDate || '';
    const currentChild = app.getCurrentChild ? app.getCurrentChild() : null;
    const childId = currentChild ? currentChild.id : (app.globalData.currentChildId || '');
    
    wx.cloud.callFunction({
      name: 'addHomework',
      data: {
        title: this.data.selectedSubject || '作业',
        content: this.data.content,
        type: this.data.type,
        recurring: this.data.recurring,
        recurringDays: this.data.recurringDays,
        recurringEndType: this.data.recurring ? this.data.recurringEndType : '',
        recurringEndDate: this.data.recurring && this.data.recurringEndType === 'date' ? this.data.recurringEndDate : '',
        recurringEndTimes: this.data.recurring && this.data.recurringEndType === 'times' ? this.data.recurringEndTimes : 0,
        images: images,
        points: this.data.points,
        subject: this.data.selectedSubject,
        date: date,
        childId: childId
      },
      success: (res) => {
        wx.hideLoading();
        const count = res.result.count || 1;
        wx.showToast({
          title: `添加成功，共${count}个作业`,
          icon: 'success',
          duration: 2000
        });

        if (this.data.isSubjectMode) {
          this.setData({
            showAddForm: false
          });
          this.loadSubjectHomework(this.data.selectedSubject);
        } else {
          setTimeout(() => {
            wx.navigateBack();
          }, 2000);
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({
          title: '添加失败',
          icon: 'none'
        });
        console.error(err);
      }
    });
  },

  updateHomework(images) {
    console.log('更新作业，ID:', this.data.homeworkId);
    console.log('更新数据:', {
      title: this.data.selectedSubject || '作业',
      content: this.data.content,
      points: this.data.points
    });
    
    wx.cloud.callFunction({
      name: 'updateHomework',
      data: {
        homeworkId: this.data.homeworkId,
        title: this.data.selectedSubject || '作业',
        content: this.data.content,
        type: this.data.type,
        recurring: this.data.recurring,
        recurringDays: this.data.recurringDays,
        recurringEndType: this.data.recurring ? this.data.recurringEndType : '',
        recurringEndDate: this.data.recurring && this.data.recurringEndType === 'date' ? this.data.recurringEndDate : '',
        recurringEndTimes: this.data.recurring && this.data.recurringEndType === 'times' ? this.data.recurringEndTimes : 0,
        images: images,
        points: this.data.points,
        subject: this.data.selectedSubject
      },
      success: (res) => {
        wx.hideLoading();
        console.log('云函数返回:', res);
        if (res.result && res.result.success) {
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          });

          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          wx.showToast({
            title: (res.result && res.result.errMsg) || '保存失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('云函数调用失败:', err);
        wx.showToast({
          title: '保存失败: ' + (err.errMsg || '未知错误'),
          icon: 'none',
          duration: 3000
        });
      }
    });
  },

  canSubmit() {
    const { content, recurring, recurringDays, selectedSubject } = this.data;
    if (!selectedSubject || !content) {
      return false;
    }
    if (recurring && recurringDays.length === 0) {
      return false;
    }
    return true;
  },

  updateCanSubmit() {
    this.setData({
      canSubmit: this.canSubmit()
    });
  },

  // 加载科目列表
  loadSubjects() {
    const currentChild = app.getCurrentChild ? app.getCurrentChild() : null;
    if (!currentChild) {
      // 尝试从全局数据中获取
      if (app.globalData.currentChildId && app.globalData.children) {
        const child = app.globalData.children.find(c => c.id === app.globalData.currentChildId);
        if (child && child.subjects) {
          const subjects = [...child.subjects];
          subjects.sort((a, b) => (a.sort || 0) - (b.sort || 0));
          this.setData({ subjects: subjects });
        } else {
          this.setData({ subjects: [] });
        }
      } else {
        this.setData({ subjects: [] });
      }
      return;
    }
    
    const subjects = currentChild.subjects || [];
    subjects.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    this.setData({ subjects: subjects });
  },

  // 显示科目选择器
  showSubjectSelector() {
    this.loadSubjects();
    this.setData({
      showSubjectSelector: true
    });
  },

  // 关闭科目选择器
  closeSubjectSelector() {
    this.setData({
      showSubjectSelector: false
    });
  },

  // 选择科目
  selectSubject(e) {
    const subject = e.currentTarget.dataset.subject;
    this.setData({
      selectedSubject: subject,
      showSubjectSelector: false
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

  // 输入新科目名称
  onNewSubjectInput(e) {
    this.setData({
      newSubjectName: e.detail.value
    });
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

    const currentChild = app.getCurrentChild ? app.getCurrentChild() : null;
    if (!currentChild) {
      wx.showToast({
        title: '请先选择小朋友',
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

    wx.cloud.callFunction({
      name: 'manageSubjects',
      data: {
        action: 'updateSubjects',
        data: {
          childId: currentChild.id,
          subjects: subjects
        }
      },
      success: (res) => {
        if (res.result && res.result.success) {
          wx.showToast({
            title: '添加成功',
            icon: 'success'
          });
          this.setData({
            showAddSubjectModal: false,
            selectedSubject: name,
            showSubjectSelector: false,
            newSubjectName: ''
          });
          this.updateCanSubmit();
        } else {
          wx.showToast({
            title: res.result.errMsg || '添加失败，请重试',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('添加科目失败:', err);
        wx.showToast({
          title: '添加失败，请重试',
          icon: 'none'
        });
      }
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

  deleteHomework() {
    const that = this;
    
    if (this.data.recurring) {
      // 使用 actionSheet 让用户选择
      wx.showActionSheet({
        itemList: ['仅删除当天作业', '删除所有周期作业'],
        itemColor: '#FF5252',
        success(res) {
          if (res.tapIndex === 0) {
            // 仅删除当天
            that.doDeleteHomework('single');
          } else if (res.tapIndex === 1) {
            // 删除所有周期作业，再次确认
            wx.showModal({
              title: '确认删除所有',
              content: '确定要删除所有周期作业吗？此操作不可恢复。',
              confirmText: '确定删除',
              confirmColor: '#FF5252',
              success(modalRes) {
                if (modalRes.confirm) {
                  that.doDeleteHomework('all');
                }
              }
            });
          }
        }
      });
    } else {
      wx.showModal({
        title: '删除作业',
        content: '确定要删除这个作业吗？删除后无法恢复。',
        confirmText: '确定删除',
        confirmColor: '#FF5252',
        success(res) {
          if (res.confirm) {
            that.doDeleteHomework('single');
          }
        }
      });
    }
  },

  doDeleteHomework(deleteMode = 'single') {
    wx.showLoading({
      title: '删除中...'
    });

    wx.cloud.callFunction({
      name: 'deleteHomework',
      data: {
        homeworkId: this.data.homeworkId,
        deleteMode: deleteMode
      },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          const count = res.result.count || 1;
          const msg = deleteMode === 'all' ? `成功删除${count}个作业` : '删除成功';
          wx.showToast({
            title: msg,
            icon: 'success'
          });
          
          const pages = getCurrentPages();
          if (pages.length > 1) {
            const prevPage = pages[pages.length - 2];
            if (prevPage && prevPage.loadHomework) {
              prevPage.loadHomework();
            }
          }
          
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          wx.showToast({
            title: (res.result && res.result.errMsg) || '删除失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({
          title: '删除失败',
          icon: 'none'
        });
        console.error('删除作业失败:', err);
      }
    });
  }
});
