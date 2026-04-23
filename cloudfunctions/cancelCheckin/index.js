const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

function getLocalDateStr(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { homeworkId, date } = event;

  const today = new Date();
  const todayStr = getLocalDateStr(today);
  const targetDateStr = date || todayStr;

  const homeworkRes = await db.collection('homework').doc(homeworkId).get();
  const homework = homeworkRes.data;

  if (!homework) {
    return { success: false, errMsg: '作业不存在' };
  }

  const userRes = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get();
  const user = userRes.data[0];

  if (!user) {
    return { success: false, errMsg: '用户不存在' };
  }

  if (homework.recurring) {
    const checkinRes = await db.collection('checkins').where({
      homeworkId: homeworkId,
      _openid: wxContext.OPENID,
      date: targetDateStr
    }).get();

    if (checkinRes.data.length === 0) {
      return { success: false, errMsg: '未找到该日期的打卡记录' };
    }

    const checkin = checkinRes.data[0];
    const checkinId = checkin._id;

    const basePoints = homework.points || 10;
    const actualPercent = checkin.ratingPercent || 100;
    const actualPoints = Math.round(basePoints * actualPercent / 100);

    await db.collection('checkins').doc(checkinId).remove();

    await db.collection('users').doc(user._id).update({
      data: {
        points: _.inc(-actualPoints),
        updateTime: db.serverDate()
      }
    });

    return {
      success: true,
      isRecurring: true,
      deductedPoints: actualPoints
    };
  } else {
    if (homework.status !== 'completed') {
      return { success: false, errMsg: '该作业未完成' };
    }

    const basePoints = homework.points || 10;
    const actualPercent = homework.ratingPercent || 100;
    const actualPoints = Math.round(basePoints * actualPercent / 100);

    await db.collection('homework').doc(homeworkId).update({
      data: {
        status: 'pending',
        checkInTime: null,
        rating: null,
        ratingPercent: null,
        actualPoints: null,
        basePoints: null,
        updateTime: db.serverDate()
      }
    });

    await db.collection('users').doc(user._id).update({
      data: {
        points: _.inc(-actualPoints),
        updateTime: db.serverDate()
      }
    });

    return {
      success: true,
      isRecurring: false,
      deductedPoints: actualPoints
    };
  }
};
