const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { childId, types, limit, skip } = event;

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

    if (types && types.length > 0) {
      query.type = _.in(types);
    }

    let dbQuery = db.collection('point_records')
      .where(query)
      .orderBy('createTime', 'desc');

    if (skip) {
      dbQuery = dbQuery.skip(skip);
    }

    if (limit) {
      dbQuery = dbQuery.limit(limit);
    }

    const res = await dbQuery.get();

    return {
      success: true,
      data: res.data
    };
  } catch (err) {
    console.error('获取积分记录失败:', err);
    return {
      success: false,
      errMsg: err.message || '获取积分记录失败'
    };
  }
};
