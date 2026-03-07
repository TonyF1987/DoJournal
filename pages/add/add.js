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
    canSubmit: false
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ isEdit: true, homeworkId: options.id });
      this.loadHomework(options.id);
      wx.setNavigationBarTitle({ title: '编辑任务' });
    } else {
      wx.setNavigationBarTitle({ title: '添加任务' });
    }

    if (options.scene === 1044 && options.shareTicket) {
      wx.getShareInfo({
        shareTicket: options.shareTicket,
        success: (res) => {
          console.log('分享信息:', res);
        }
      });
    }

    const app = getApp();
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
            points: data.points || 10,
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
    
    if (images.length === 1) {
      this.recognizeImageContent(images[0].url);
    } else {
      wx.showModal({
        title: '识别多张图片',
        content: `是否识别${images.length}张图片的内容并合并？`,
        success: (res) => {
          if (res.confirm) {
            this.recognizeMultipleImages(images);
          }
        }
      });
    }
  },

  recognizeMultipleImages(images) {
    wx.showLoading({ title: '正在识别第1张图片...' });
    
    let totalContent = [];
    
    const recognizeNext = (index) => {
      if (index >= images.length) {
        wx.hideLoading();
        if (totalContent.length > 0) {
          const content = totalContent.join('\n---\n');
          this.setData({
            content: content
          });
          this.updateCanSubmit();
          
          wx.showToast({
            title: '识别完成',
            icon: 'success'
          });
        }
        return;
      }
      
      wx.showLoading({ title: `正在识别第${index + 1}张图片...` });
      
      this.recognizeSingleImage(images[index].url).then(result => {
        if (result) {
          totalContent.push(result);
        }
        recognizeNext(index + 1);
      }).catch(error => {
        console.error(`识别第${index + 1}张图片失败:`, error);
        wx.showToast({
          title: `第${index + 1}张图片识别失败`,
          icon: 'none'
        });
        recognizeNext(index + 1);
      });
    };
    
    recognizeNext(0);
  },

  recognizeSingleImage(imagePath) {
    return new Promise((resolve, reject) => {
      const cloudPath = `homework-ocr/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
      
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: imagePath,
        success: (uploadRes) => {
          const fileID = uploadRes.fileID;
          
          wx.cloud.callFunction({
            name: 'ocrGeneral',
            data: {
              imgUrl: fileID
            },
            success: (res) => {
              if (res.result && res.result.errCode === 0) {
                if (res.result.isMock) {
                  resolve('');
                  return;
                }
                
                const text = res.result.items
                  .map(item => item.text)
                  .join('\n');
                
                if (text.trim()) {
                  resolve(text.trim());
                } else {
                  resolve('');
                }
              } else {
                console.error('OCR识别失败:', res.result);
                resolve('');
              }
            },
            fail: (err) => {
              console.error('云函数调用失败:', err);
              resolve('');
            }
          });
        },
        fail: (err) => {
          console.error('上传图片失败:', err);
          reject(err);
        }
      });
    });
  },

  selectFromAlbum() {
    wx.chooseImage({
      count: 9,
      sizeType: ['original', 'compressed'],
      sourceType: ['album'],
      success: (res) => {
        const images = res.tempFilePaths.map(path => ({
          type: 'image',
          url: path
        }));

        if (!this.data.title) {
          this.setData({ title: '作业' });
        }

        if (images.length > 0) {
          this.setData({ importedContent: images });

          wx.showModal({
            title: '识别作业内容',
            content: '是否使用AI识别图片中的作业文字?',
            success: (modalRes) => {
              if (modalRes.confirm) {
                this.recognizeImageContent(images[0].url);
              } else {
                this.setData({
                  content: `包含${images.length}张作业图片`
                });
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

  recognizeImageContent(imagePath) {
    wx.showLoading({ title: '上传图片中...' });

    const cloudPath = `homework-ocr/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;

    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: imagePath,
      success: (uploadRes) => {
        const fileID = uploadRes.fileID;

        wx.showLoading({ title: '识别中...' });

        wx.cloud.callFunction({
          name: 'ocrGeneral',
          data: {
            imgUrl: fileID
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
                    this.setData({
                      content: ''
                    });
                    this.updateCanSubmit();
                  }
                });
                return;
              }

              const text = res.result.items
                .map(item => item.text)
                .join('\n');

              if (text.trim()) {
                this.setData({
                  content: text.trim()
                });
                this.updateCanSubmit();

                wx.showToast({
                  title: '识别成功',
                  icon: 'success'
                });
              } else {
                wx.showToast({
                  title: '未识别到文字',
                  icon: 'none'
                });
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
                  this.setData({
                    content: ''
                  });
                  this.updateCanSubmit();
                }
              });
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
                  this.setData({
                    content: ''
                  });
                  this.updateCanSubmit();
                }
              });
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
      }
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
      title: this.data.isEdit ? '保存中...' : '添加中...'
    });

    const images = this.data.importedContent
      .filter(item => item.type === 'image')
      .map(item => item.url);

    if (this.data.isEdit) {
      this.updateHomework(images);
    } else {
      this.addHomework(images);
    }
  },

  addHomework(images) {
    wx.cloud.callFunction({
      name: 'addHomework',
      data: {
        title: this.data.title,
        content: this.data.content,
        type: this.data.type,
        recurring: this.data.recurring,
        recurringDays: this.data.recurringDays,
        images: images,
        points: this.data.points
      },
      success: (res) => {
        wx.hideLoading();
        wx.showToast({
          title: '添加成功',
          icon: 'success'
        });

        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
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
      title: this.data.title,
      content: this.data.content,
      points: this.data.points
    });
    
    wx.cloud.callFunction({
      name: 'updateHomework',
      data: {
        homeworkId: this.data.homeworkId,
        title: this.data.title,
        content: this.data.content,
        type: this.data.type,
        recurring: this.data.recurring,
        recurringDays: this.data.recurringDays,
        images: images,
        points: this.data.points
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
    const { title, content, recurring, recurringDays } = this.data;
    if (!title || !content) {
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
  }
});
