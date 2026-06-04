const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const { canPerform, getPermissionError, getCurrentFamilyMember } = require('./permissions');

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeHomeworkDate(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const s = value.split('T')[0].substring(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return formatDate(d);
}

// 与 addHomework 保持一致
function getRecurringDates(recurringDays, endType, endDate, endTimes, startDateStr) {
  const dates = [];

  let startDate;
  if (startDateStr) {
    startDate = new Date(startDateStr);
  } else {
    startDate = new Date();
  }
  startDate.setHours(0, 0, 0, 0);

  if (endType === 'date') {
    const endDay = new Date(endDate);
    endDay.setHours(0, 0, 0, 0);
    let currentDate = new Date(startDate);
    while (currentDate <= endDay) {
      const dayOfWeek = currentDate.getDay();
      if (recurringDays.includes(dayOfWeek)) {
        dates.push(formatDate(currentDate));
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  } else {
    let targetCount;
    if (endType === 'times') {
      targetCount = endTimes;
    } else {
      targetCount = 180;
    }

    let currentDate = new Date(startDate);
    while (dates.length < targetCount) {
      const dayOfWeek = currentDate.getDay();
      if (recurringDays.includes(dayOfWeek)) {
        dates.push(formatDate(currentDate));
      }
      currentDate.setDate(currentDate.getDate() + 1);
      if (dates.length === 0 && currentDate.getTime() - startDate.getTime() > 1000 * 60 * 60 * 24 * 1000) {
        break;
      }
    }
  }

  return dates;
}

async function findBatchHomework(db, homework, openid) {
  if (homework.recurringBatchId) {
    const res = await db.collection('homework').where({
      _openid: openid,
      recurringBatchId: homework.recurringBatchId
    }).get();
    return res.data || [];
  }

  if (homework.recurring) {
    const query = {
      _openid: openid,
      childId: homework.childId || '',
      title: homework.title,
      subject: homework.subject || '',
      content: homework.content,
      recurringDays: homework.recurringDays || []
    };

    if (homework.recurringEndType) {
      query.recurringEndType = homework.recurringEndType;
    }
    if (homework.recurringEndDate) {
      query.recurringEndDate = homework.recurringEndDate;
    }
    if (homework.recurringEndTimes) {
      query.recurringEndTimes = homework.recurringEndTimes;
    }

    const res = await db.collection('homework').where(query).get();
    return res.data || [];
  }

  return [homework];
}

async function homeworkHasCheckin(db, hw, openid) {
  const dateStr = normalizeHomeworkDate(hw.homeworkDate);
  if (dateStr) {
    const checkinRes = await db.collection('checkins').where({
      homeworkId: hw._id,
      checkinDate: dateStr,
      _openid: openid
    }).limit(1).get();
    if (checkinRes.data.length > 0) {
      return true;
    }
  }
  return hw.status === 'completed';
}

function getBatchStartDate(batchHomework) {
  const dates = batchHomework
    .map(hw => normalizeHomeworkDate(hw.homeworkDate))
    .filter(Boolean)
    .sort();
  return dates[0] || formatDate(new Date());
}

async function syncRecurringBatch({
  collection,
  batchHomework,
  homework,
  openid,
  updateData,
  recurringDays,
  recurringEndType,
  recurringEndDate,
  recurringEndTimes
}) {
  const batchId = homework.recurringBatchId
    || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startDateStr = getBatchStartDate(batchHomework);
  const targetDates = getRecurringDates(
    recurringDays,
    recurringEndType,
    recurringEndDate,
    recurringEndTimes,
    startDateStr
  );

  if (targetDates.length === 0) {
    return {
      success: false,
      errMsg: '没有有效的周期日期'
    };
  }

  const targetSet = new Set(targetDates);
  const byDate = new Map();

  for (const hw of batchHomework) {
    const key = normalizeHomeworkDate(hw.homeworkDate);
    if (key && !byDate.has(key)) {
      byDate.set(key, hw);
    }
  }

  for (const hw of batchHomework) {
    const key = normalizeHomeworkDate(hw.homeworkDate);
    if (key && !targetSet.has(key)) {
      const hasCheckin = await homeworkHasCheckin(db, hw, openid);
      if (hasCheckin) {
        return {
          success: false,
          errMsg: `${key} 的作业已打卡，无法因周期调整删除，请先取消打卡`
        };
      }
    }
  }

  const syncFields = {
    ...updateData,
    recurring: true,
    recurringBatchId: batchId
  };

  let updated = 0;
  let created = 0;
  let removed = 0;

  for (const dateStr of targetDates) {
    const existing = byDate.get(dateStr);
    if (existing) {
      await collection.doc(existing._id).update({
        data: {
          ...syncFields,
          homeworkDate: dateStr
        }
      });
      updated += 1;
    } else {
      await collection.add({
        data: {
          _openid: openid,
          childId: homework.childId || '',
          title: syncFields.title,
          content: syncFields.content,
          type: syncFields.type,
          recurring: true,
          recurringDays: syncFields.recurringDays,
          recurringEndType: syncFields.recurringEndType,
          recurringEndDate: syncFields.recurringEndDate,
          recurringEndTimes: syncFields.recurringEndTimes,
          recurringBatchId: batchId,
          images: syncFields.images,
          subject: syncFields.subject,
          points: syncFields.points,
          homeworkDate: dateStr,
          status: 'pending',
          checkInTime: null,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      });
      created += 1;
    }
  }

  for (const hw of batchHomework) {
    const key = normalizeHomeworkDate(hw.homeworkDate);
    if (key && !targetSet.has(key)) {
      await collection.doc(hw._id).remove();
      removed += 1;
    }
  }

  return {
    success: true,
    updated: updated + created,
    created,
    removed,
    updateMode: 'all',
    synced: true
  };
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const {
    homeworkId,
    title,
    content,
    type,
    recurring,
    recurringDays,
    recurringEndType,
    recurringEndDate,
    recurringEndTimes,
    images,
    points,
    subject,
    account,
    updateMode = 'single'
  } = event;

  const usersRes = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get();

  let user;
  if (usersRes.data.length > 0) {
    if (account) {
      user = usersRes.data.find(u => (u.account || '') === account);
    }
    if (!user) {
      user = usersRes.data[0];
    }
  }

  const currentMember = await getCurrentFamilyMember(db, user, wxContext.OPENID);
  if (!canPerform(currentMember, 'homework')) {
    return {
      success: false,
      errMsg: getPermissionError(currentMember, 'homework', '您只有只读权限，无法修改作业')
    };
  }

  if (!homeworkId) {
    return {
      success: false,
      errMsg: '缺少作业ID'
    };
  }

  try {
    const collection = db.collection('homework');
    const checkRes = await collection.doc(homeworkId).get();

    if (!checkRes.data) {
      return {
        success: false,
        errMsg: '作业不存在'
      };
    }

    const homework = checkRes.data;

    if (homework._openid !== openid) {
      return {
        success: false,
        errMsg: '无权限修改此作业'
      };
    }

    const updateData = {
      title: title,
      content: content,
      type: type || 'manual',
      recurring: recurring || false,
      recurringDays: recurringDays || [],
      recurringEndType: recurring ? (recurringEndType || 'never') : '',
      recurringEndDate: recurring && recurringEndType === 'date' ? (recurringEndDate || '') : '',
      recurringEndTimes: recurring && recurringEndType === 'times' ? (recurringEndTimes || 0) : 0,
      images: images || [],
      subject: subject || '',
      points: points || 10,
      updateTime: db.serverDate()
    };

    if (updateMode === 'all' && (homework.recurring || homework.recurringBatchId)) {
      const batchHomework = await findBatchHomework(db, homework, openid);

      if (recurring && (recurringDays || []).length > 0) {
        return await syncRecurringBatch({
          collection,
          batchHomework,
          homework,
          openid,
          updateData,
          recurringDays: recurringDays || [],
          recurringEndType: recurringEndType || 'never',
          recurringEndDate: recurringEndDate || '',
          recurringEndTimes: recurringEndTimes || 0
        });
      }

      const updatePromises = batchHomework.map(hw =>
        collection.doc(hw._id).update({ data: updateData })
      );
      await Promise.all(updatePromises);

      return {
        success: true,
        updated: batchHomework.length,
        updateMode: 'all'
      };
    }

    const res = await collection.doc(homeworkId).update({
      data: updateData
    });

    return {
      success: true,
      updated: res.stats.updated,
      updateMode: 'single'
    };
  } catch (err) {
    console.error('更新作业失败:', err);
    return {
      success: false,
      errMsg: err.message || '更新失败',
      errCode: err.code
    };
  }
};
