const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();

const PAGE_SIZE = 100;
const MAX_PAGES = 20;

function normalizeHomeworkDate(dateVal) {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') {
    const match = dateVal.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (match) {
      return `${match[1]}-${String(parseInt(match[2], 10)).padStart(2, '0')}-${String(parseInt(match[3], 10)).padStart(2, '0')}`;
    }
    return dateVal.trim();
  }
  if (typeof dateVal === 'object' && dateVal.getFullYear) {
    const d = dateVal;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return String(dateVal);
}

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

    // 不在数据库层做日期范围比较（格式不一致会导致漏查），改为内存中规范化后过滤
    const orderField = startDate && endDate ? 'homeworkDate' : 'createTime';
    let data = await fetchAllHomework(query, orderField);

    if (startDate && endDate) {
      data = data.filter(item => {
        const dateStr = normalizeHomeworkDate(item.homeworkDate);
        return dateStr >= startDate && dateStr <= endDate;
      });
    }

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
