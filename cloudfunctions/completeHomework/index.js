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
  const { homeworkId, proofImage, comment, rating, ratingPercent, checkinDate, childId } = event;

  // 获取作业信息
  const homeworkRes = await db.collection('homework').doc(homeworkId).get();
  const homework = homeworkRes.data;

  const today = new Date();
  const todayStr = getLocalDateStr(today);
  
  // 使用传递的打卡日期，如果没有则使用今天
  const targetDateStr = checkinDate || todayStr;
  
  // 获取作业日期
  let homeworkDate;
  if (homework.recurring) {
    // 周期作业：使用打卡日期
    homeworkDate = targetDateStr;
  } else {
    // 非周期作业：使用作业的 homeworkDate
    homeworkDate = homework.homeworkDate || homework.date || todayStr;
  }

  // 获取用户信息
  const userRes = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get();
  const user = userRes.data[0];

  if (!user) {
    return { success: false, errMsg: '用户不存在' };
  }

  let selectedChildId = childId || user.currentChildId;
  let children = [];
  let currentChild = null;

  if (user.familyId) {
    // 有家庭，从家庭数据获取小朋友信息
    const familyRes = await db.collection('families').doc(user.familyId).get();
    if (familyRes.data) {
      children = familyRes.data.children || [];
    }
  } else {
    // 没有家庭，从用户数据获取
    children = user.children || [];
  }

  if (!selectedChildId && children.length > 0) {
    selectedChildId = children[0].id;
  }

  if (!selectedChildId) {
    return { success: false, errMsg: '请先选择小朋友' };
  }

  const childIndex = children.findIndex(c => c.id === selectedChildId);
  if (childIndex === -1) {
    return { success: false, errMsg: '小朋友不存在' };
  }

  currentChild = children[childIndex];

  if (homework.recurring) {
    // 周期作业：检查该日期是否已打卡
    const existingCheckin = await db.collection('checkins').where({
      homeworkId: homeworkId,
      _openid: wxContext.OPENID,
      childId: selectedChildId,
      date: targetDateStr
    }).get();

    if (existingCheckin.data.length > 0) {
      return {
        success: false,
        errMsg: '该日期已经打过卡了'
      };
    }

    // 计算积分
    const basePoints = homework.points || 10;
    const actualPercent = ratingPercent || 100;
    const actualPoints = Math.round(basePoints * actualPercent / 100);

    // 计算连续打卡（只有打卡今天才算连续）
    let streak = currentChild.streak || 0;
    let streakBonus = 0;

    if (targetDateStr === todayStr && currentChild.lastCheckInDate !== todayStr) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = getLocalDateStr(yesterday);

      if (currentChild.lastCheckInDate === yesterdayStr) {
        streak += 1;
        streakBonus = Math.floor(streak / 3) * 5;
      } else {
        streak = 1;
      }
    }

    const totalPoints = actualPoints + streakBonus;

    // 创建打卡记录
    await db.collection('checkins').add({
      data: {
        homeworkId: homeworkId,
        homeworkTitle: homework.title,
        homeworkContent: homework.content || '',
        proofImage: proofImage,
        comment: comment || '',
        rating: rating || 3,
        ratingPercent: ratingPercent || 100,
        date: targetDateStr,
        createTime: db.serverDate(),
        _openid: wxContext.OPENID,
        childId: selectedChildId
      }
    });

    // 记录积分获得明细
    await db.collection('point_records').add({
      data: {
        type: 'checkin',
        name: homework.title,
        description: homework.content || '',
        comment: comment || '',
        rating: rating || 3,
        ratingPercent: ratingPercent || 100,
        basePoints: basePoints,
        points: actualPoints,
        streakBonus: streakBonus,
        icon: '✅',
        homeworkId: homeworkId,
        homeworkDate: homeworkDate,
        createTime: db.serverDate(),
        _openid: wxContext.OPENID,
        childId: selectedChildId
      }
    });

    // 更新小朋友积分
    currentChild.points = (currentChild.points || 0) + totalPoints;
    if (targetDateStr === todayStr) {
      currentChild.streak = streak;
      currentChild.lastCheckInDate = todayStr;
    }
    children[childIndex] = currentChild;

    if (user.familyId) {
      // 有家庭，更新家庭数据
      const familyRes = await db.collection('families').doc(user.familyId).get();
      if (familyRes.data) {
        const familyChildren = familyRes.data.children || [];
        const updatedFamilyChildren = familyChildren.map(c => {
          if (c.id === selectedChildId) {
            return { ...currentChild };
          }
          return c;
        });
        await db.collection('families').doc(user.familyId).update({
          data: {
            children: updatedFamilyChildren,
            updateTime: db.serverDate()
          }
        });
      }
    } else {
      // 没有家庭，更新用户数据
      await db.collection('users').doc(user._id).update({
        data: {
          children: children,
          updateTime: db.serverDate()
        }
      });
    }

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
    
    // 先计算得分
    const basePoints = homework.points || 10;
    const actualPercent = ratingPercent || 100;
    const actualPoints = Math.round(basePoints * actualPercent / 100);

    // 计算连续打卡天数
    let streak = currentChild.streak || 0;
    let streakBonus = 0;

    if (currentChild.lastCheckInDate === todayStr) {
      // 今天已经打过卡了，不增加连续天数
    } else {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = getLocalDateStr(yesterday);

      if (currentChild.lastCheckInDate === yesterdayStr) {
        streak += 1;
        streakBonus = Math.floor(streak / 3) * 5;
      } else {
        streak = 1;
      }
    }

    // 计算总分（根据等级评价）
    const totalPoints = actualPoints + streakBonus;

    await db.collection('homework').doc(homeworkId).update({
      data: {
        status: 'completed',
        checkInTime: db.serverDate(),
        proofImage: proofImage,
        comment: comment || '',
        rating: rating || 3,
        ratingPercent: ratingPercent || 100,
        actualPoints: actualPoints,
        basePoints: basePoints,
        updateTime: db.serverDate()
      }
    });

    // 记录积分获得明细
    await db.collection('point_records').add({
      data: {
        type: 'checkin',
        name: homework.title,
        description: homework.content || '',
        comment: comment || '',
        rating: rating || 3,
        ratingPercent: ratingPercent || 100,
        basePoints: basePoints,
        points: actualPoints,
        streakBonus: streakBonus,
        icon: '✅',
        homeworkId: homeworkId,
        homeworkDate: homeworkDate,
        createTime: db.serverDate(),
        _openid: wxContext.OPENID,
        childId: selectedChildId
      }
    });

    // 更新小朋友积分
    currentChild.points = (currentChild.points || 0) + totalPoints;
    currentChild.streak = streak;
    currentChild.lastCheckInDate = todayStr;
    children[childIndex] = currentChild;

    if (user.familyId) {
      // 有家庭，更新家庭数据
      const familyRes = await db.collection('families').doc(user.familyId).get();
      if (familyRes.data) {
        const familyChildren = familyRes.data.children || [];
        const updatedFamilyChildren = familyChildren.map(c => {
          if (c.id === selectedChildId) {
            return { ...currentChild };
          }
          return c;
        });
        await db.collection('families').doc(user.familyId).update({
          data: {
            children: updatedFamilyChildren,
            updateTime: db.serverDate()
          }
        });
      }
    } else {
      // 没有家庭，更新用户数据
      await db.collection('users').doc(user._id).update({
        data: {
          children: children,
          updateTime: db.serverDate()
        }
      });
    }

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
