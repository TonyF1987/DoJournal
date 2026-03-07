const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // 获取所有周期作业
  const recurringRes = await db.collection('homework').where({
    recurring: true
  }).get();

  const recurringTasks = recurringRes.data;
  const newTasks = [];

  for (const task of recurringTasks) {
    const weekDay = now.getDay(); // 0-6, 0=周日
    if (task.recurringDays.includes(weekDay)) {
      // 检查今天是否已经生成
      const existsRes = await db.collection('homework').where({
        title: task.title,
        createTime: _.gte(new Date(todayStr + 'T00:00:00'))
      }).get();

      if (existsRes.data.length === 0) {
        // 生成新任务
        newTasks.push({
          _openid: task._openid,
          title: task.title,
          content: task.content,
          type: 'recurring',
          recurring: false, // 生成的任务不再周期
          recurringDays: [],
          images: task.images,
          status: 'pending',
          points: task.points,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        });
      }
    }
  }

  // 批量添加新任务
  if (newTasks.length > 0) {
    for (const task of newTasks) {
      await db.collection('homework').add({ data: task });
    }
  }

  return {
    success: true,
    generatedCount: newTasks.length
  };
};
