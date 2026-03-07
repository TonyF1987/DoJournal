const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { homeworkId, title, content, type, recurring, recurringDays, images, points } = event;

  console.log('收到更新请求:', {
    homeworkId,
    openid,
    title,
    content,
    points
  });

  if (!homeworkId) {
    return {
      success: false,
      errMsg: '缺少作业ID'
    };
  }

  try {
    const collection = db.collection('homework');
    
    const checkRes = await collection.doc(homeworkId).get();
    console.log('查询结果:', checkRes);
    
    if (!checkRes.data) {
      return {
        success: false,
        errMsg: '作业不存在'
      };
    }

    const updateData = {
      title: title,
      content: content,
      type: type || 'manual',
      recurring: recurring || false,
      recurringDays: recurringDays || [],
      images: images || [],
      points: points || 10,
      updateTime: db.serverDate()
    };

    console.log('准备更新数据:', updateData);

    const res = await collection.doc(homeworkId).update({
      data: updateData
    });

    console.log('更新结果:', res);

    return {
      success: true,
      updated: res.stats.updated
    };
  } catch (err) {
    console.error('更新作业失败:', err);
    return {
      success: false,
      errMsg: err.message || '更新失败',
      errCode: err.code
    };
  }
};
