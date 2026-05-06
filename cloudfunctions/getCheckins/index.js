const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { childId, homeworkIds, startDate, endDate } = event;

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

    if (homeworkIds && homeworkIds.length > 0) {
      query.homeworkId = _.in(homeworkIds);
    }

    if (startDate && endDate) {
      query.date = _.gte(startDate).and(_.lte(endDate));
    }

    const res = await db.collection('checkins')
      .where(query)
      .get();

    return {
      success: true,
      data: res.data
    };
  } catch (err) {
    console.error('获取打卡记录失败:', err);
    return {
      success: false,
      errMsg: err.message || '获取打卡记录失败'
    };
  }
};
