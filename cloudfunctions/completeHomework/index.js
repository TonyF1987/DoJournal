const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { homeworkId, proofImage, comment, rating, ratingPercent } = event;

  // 获取作业信息
  const homeworkRes = await db.collection('homework').doc(homeworkId).get();
  const homework = homeworkRes.data;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // 获取用户信息
  const userRes = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get();
  const user = userRes.data[0];

  if (homework.recurring) {
    // 周期作业：检查今天是否已打卡
    const existingCheckin = await db.collection('checkins').where({
      homeworkId: homeworkId,
      _openid: wxContext.OPENID,
      date: todayStr
    }).get();

    if (existingCheckin.data.length > 0) {
      return {
        success: false,
        errMsg: '今天已经打过卡了'
      };
    }

    // 创建打卡记录
    await db.collection('checkins').add({
      data: {
        homeworkId: homeworkId,
        homeworkTitle: homework.title,
        proofImage: proofImage,
        comment: comment || '',
        rating: rating || 3,
        ratingPercent: ratingPercent || 100,
        date: todayStr,
        createTime: db.serverDate(),
        _openid: wxContext.OPENID
      }
    });

    // 计算积分
    const basePoints = homework.points || 10;
    const actualPercent = ratingPercent || 100;
    const actualPoints = Math.round(basePoints * actualPercent / 100);

    // 计算连续打卡
    let streak = user.streak;
    let streakBonus = 0;

    if (user.lastCheckInDate !== todayStr) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (user.lastCheckInDate === yesterdayStr) {
        streak += 1;
        streakBonus = Math.floor(streak / 3) * 5;
      } else {
        streak = 1;
      }
    }

    const totalPoints = actualPoints + streakBonus;

    // 更新用户积分
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
      isRecurring: true,
      points: totalPoints,
      basePoints: basePoints,
      actualPoints: actualPoints,
      rating: rating || 3,
      ratingPercent: actualPercent,
      streak: streak,
      streakBonus: streakBonus
    };
  } else {
    // 非周期作业：原有逻辑
    await db.collection('homework').doc(homeworkId).update({
      data: {
        status: 'completed',
        checkInTime: db.serverDate(),
        proofImage: proofImage,
        comment: comment || '',
        rating: rating || 3,
        ratingPercent: ratingPercent || 100,
        updateTime: db.serverDate()
      }
    });

    // 计算连续打卡天数
    let streak = user.streak;
    let streakBonus = 0;

    if (user.lastCheckInDate === todayStr) {
      // 今天已经打过卡，不增加连续天数
    } else {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (user.lastCheckInDate === yesterdayStr) {
        streak += 1;
        streakBonus = Math.floor(streak / 3) * 5;
      } else {
        streak = 1;
      }
    }

    // 计算总分（根据等级评价）
    const basePoints = homework.points || 10;
    const actualPercent = ratingPercent || 100;
    const actualPoints = Math.round(basePoints * actualPercent / 100);
    const totalPoints = actualPoints + streakBonus;

    // 更新用户积分
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
      points: totalPoints,
      basePoints: basePoints,
      actualPoints: actualPoints,
      rating: rating || 3,
      ratingPercent: actualPercent,
      streak: streak,
      streakBonus: streakBonus
    };
  }
};
