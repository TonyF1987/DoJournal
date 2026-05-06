const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { title, content, type, recurring, recurringDays, images, points, subject, date, childId } = event;

  // 获取用户信息，获取当前小朋友ID
  let currentChildId = childId;
  if (!currentChildId) {
    const userRes = await db.collection('users').where({
      _openid: wxContext.OPENID
    }).get();
    if (userRes.data.length > 0) {
      currentChildId = userRes.data[0].currentChildId;
    }
  }

  // 解析日期
  let homeworkDate;
  if (date) {
    homeworkDate = new Date(date);
    // 设置为 UTC+8
    homeworkDate = new Date(homeworkDate.getTime() + 8 * 60 * 60 * 1000);
  } else {
    homeworkDate = new Date();
    homeworkDate.setHours(0, 0, 0, 0);
  }

  // 添加作业
  const res = await db.collection('homework').add({
    data: {
      _openid: wxContext.OPENID,
      childId: currentChildId || '', // 小朋友ID
      title: title,
      content: content,
      type: type, // 'manual' 或 'import'
      recurring: recurring || false,
      recurringDays: recurringDays || [],
      images: images || [],
      subject: subject || '',
      status: 'pending', // pending, completed
      points: points || 10, // 默认10分
      homeworkDate: date || '', // 作业日期
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
