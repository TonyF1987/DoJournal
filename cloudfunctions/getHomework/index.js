const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { homeworkId } = event;

  if (!homeworkId) {
    return {
      success: false,
      errMsg: '缺少作业ID'
    };
  }

  try {
    const res = await db.collection('homework').doc(homeworkId).get();
    
    if (!res.data) {
      return {
        success: false,
        errMsg: '作业不存在'
      };
    }

    return {
      success: true,
      data: res.data
    };
  } catch (err) {
    console.error('获取作业失败:', err);
    return {
      success: false,
      errMsg: err.message || '获取失败'
    };
  }
};
