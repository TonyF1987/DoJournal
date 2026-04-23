const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { homeworkId } = event;

  if (!homeworkId) {
    return {
      success: false,
      errMsg: '作业ID不能为空'
    };
  }

  try {
    const homeworkRes = await db.collection('homework').doc(homeworkId).get();
    const homework = homeworkRes.data;

    if (!homework) {
      return {
        success: false,
        errMsg: '作业不存在'
      };
    }

    if (homework._openid !== wxContext.OPENID) {
      return {
        success: false,
        errMsg: '无权限删除此作业'
      };
    }

    await db.collection('homework').doc(homeworkId).remove();

    return {
      success: true
    };
  } catch (err) {
    console.error('删除作业失败:', err);
    return {
      success: false,
      errMsg: err.message || '删除失败'
    };
  }
};
