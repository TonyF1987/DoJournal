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
  const { homeworkId, date, ratingPercent } = event;

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
    const existingCheckin = await db.collection('checkins').where({
      homeworkId: homeworkId,
      _openid: wxContext.OPENID,
      date: targetDateStr
    }).get();

    if (existingCheckin.data.length > 0) {
      return { success: false, errMsg: '该日期已经打过卡了' };
    }

    await db.collection('checkins').add({
      data: {
        homeworkId: homeworkId,
        homeworkTitle: homework.title,
        proofImage: '',
        comment: '',
        rating: 3,
        ratingPercent: ratingPercent || 100,
        date: targetDateStr,
        createTime: db.serverDate(),
        _openid: wxContext.OPENID
      }
    });

    const basePoints = homework.points || 10;
    const actualPercent = ratingPercent || 100;
    const actualPoints = Math.round(basePoints * actualPercent / 100);

    let streak = user.streak || 0;
    let streakBonus = 0;

    if (targetDateStr === todayStr && user.lastCheckInDate !== todayStr) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = getLocalDateStr(yesterday);

      if (user.lastCheckInDate === yesterdayStr) {
        streak += 1;
        streakBonus = Math.floor(streak / 3) * 5;
      } else {
        streak = 1;
      }
    }

    const totalPoints = actualPoints + streakBonus;

    const updateData = {
      points: _.inc(totalPoints),
      updateTime: db.serverDate()
    };
    if (targetDateStr === todayStr) {
      updateData.streak = streak;
      updateData.lastCheckInDate = todayStr;
    }

    await db.collection('users').doc(user._id).update({
      data: updateData
    });

    return {
      success: true,
      isRecurring: true,
      points: totalPoints
    };
  } else {
    if (homework.status === 'completed') {
      return { success: false, errMsg: '该作业已完成' };
    }

    await db.collection('homework').doc(homeworkId).update({
      data: {
        status: 'completed',
        checkInTime: db.serverDate(),
        rating: 3,
        ratingPercent: ratingPercent || 100,
        updateTime: db.serverDate()
      }
    });

    let streak = user.streak || 0;
    let streakBonus = 0;

    if (user.lastCheckInDate !== todayStr) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = getLocalDateStr(yesterday);

      if (user.lastCheckInDate === yesterdayStr) {
        streak += 1;
        streakBonus = Math.floor(streak / 3) * 5;
      } else {
        streak = 1;
      }
    }

    const basePoints = homework.points || 10;
    const actualPercent = ratingPercent || 100;
    const actualPoints = Math.round(basePoints * actualPercent / 100);
    const totalPoints = actualPoints + streakBonus;

    await db.collection('users').doc(user._id).update({
      data: {
        points: _.inc(totalPoints),
        streak: streak,
        lastCheckInDate: todayStr,
        updateTime: db.serverDate()
      }
    });

    return {
      success: true,
      isRecurring: false,
      points: totalPoints
    };
  }
};
