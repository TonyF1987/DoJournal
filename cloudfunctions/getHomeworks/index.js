const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { childId, subject, status } = event;

  if (!childId) {
    return {
      success: false,
      errMsg: '缺少小朋友ID'
    };
  }

  try {
    let query = {
      childId: childId
    };

    if (subject) {
      query.subject = subject;
    }

    if (status) {
      query.status = status;
    }

    // 加载作业
    const res = await db.collection('homework')
      .where(query)
      .orderBy('createTime', 'desc')
      .limit(100)
      .get();

    return {
      success: true,
      data: res.data
    };
  } catch (err) {
    console.error('获取作业失败:', err);
    return {
      success: false,
      errMsg: err.message || '获取作业失败'
    };
  }
};
