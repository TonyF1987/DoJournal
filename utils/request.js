/**
 * 封装云函数调用
 */
function callFunction(name, data = {}) {
  return new Promise((resolve, reject) => {
    wx.showLoading({
      title: '加载中...',
      mask: true
    });

    wx.cloud.callFunction({
      name: name,
      data: data,
      success: (res) => {
        wx.hideLoading();
        if (res.result.success !== false) {
          resolve(res.result);
        } else {
          wx.showToast({
            title: res.result.message || '操作失败',
            icon: 'none'
          });
          reject(res.result);
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        });
        reject(err);
      }
    });
  });
}

/**
 * 封装数据库查询
 */
function query(collection, options = {}) {
  const db = wx.cloud.database();
  let query = db.collection(collection);

  if (options.where) {
    query = query.where(options.where);
  }

  if (options.orderBy) {
    query = query.orderBy(options.orderBy.field, options.orderBy.order || 'desc');
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  if (options.skip) {
    query = query.skip(options.skip);
  }

  return new Promise((resolve, reject) => {
    query.get({
      success: (res) => {
        resolve(res.data);
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
}

/**
 * 上传图片到云存储
 */
function uploadImage(filePath, cloudPath) {
  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath,
      success: (res) => {
        resolve(res.fileID);
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
}

module.exports = {
  callFunction,
  query,
  uploadImage
};
