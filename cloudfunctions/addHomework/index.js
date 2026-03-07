const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { title, content, type, recurring, recurringDays, images, points } = event;

  // 添加作业
  const res = await db.collection('homework').add({
    data: {
      _openid: wxContext.OPENID,
      title: title,
      content: content,
      type: type, // 'manual' 或 'import'
      recurring: recurring || false,
      recurringDays: recurringDays || [],
      images: images || [],
      status: 'pending', // pending, completed
      points: points || 10, // 默认10分
      checkInTime: null,
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  });

  return {
    success: true,
    homeworkId: res._id
  };
};
