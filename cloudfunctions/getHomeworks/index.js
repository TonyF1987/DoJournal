const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

const PAGE_SIZE = 100;
const MAX_PAGES = 20;

async function fetchAllHomework(query, orderField) {
  let allData = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await db.collection('homework')
      .where(query)
      .orderBy(orderField, 'desc')
      .skip(page * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .get();

    allData = allData.concat(res.data);
    if (res.data.length < PAGE_SIZE) {
      break;
    }
  }

  return allData;
}

exports.main = async (event, context) => {
  const { childId, subject, status, startDate, endDate } = event;

  if (!childId) {
    return {
      success: false,
      errMsg: '缺少小朋友ID'
    };
  }

  try {
    const query = {
      childId: childId
    };

    if (subject) {
      query.subject = subject;
    }

    if (status) {
      query.status = status;
    }

    if (startDate && endDate) {
      query.homeworkDate = _.gte(startDate).and(_.lte(endDate));
    }

    const orderField = startDate && endDate ? 'homeworkDate' : 'createTime';
    const data = await fetchAllHomework(query, orderField);

    return {
      success: true,
      data
    };
  } catch (err) {
    console.error('获取作业失败:', err);
    return {
      success: false,
      errMsg: err.message || '获取作业失败'
    };
  }
};
