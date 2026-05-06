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
  const { homeworkId, date, childId } = event;

  const today = new Date();
  const todayStr = getLocalDateStr(today);
  const targetDateStr = date || todayStr;

  const homeworkRes = await db.collection('homework').doc(homeworkId).get();
  const homework = homeworkRes.data;

  if (!homework) {
    return { success: false, errMsg: '作业不存在' };
  }

  // 获取作业日期
  let homeworkDate;
  if (homework.recurring) {
    homeworkDate = targetDateStr;
  } else {
    homeworkDate = homework.homeworkDate || homework.date || todayStr;
  }

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
    const checkinRes = await db.collection('checkins').where({
      homeworkId: homeworkId,
      _openid: wxContext.OPENID,
      childId: selectedChildId,
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

    currentChild.points = (currentChild.points || 0) - actualPoints;
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

    // 记录取消打卡明细
    await db.collection('point_records').add({
      data: {
        type: 'cancel',
        name: homework.title,
        description: homework.content || '',
        points: actualPoints,
        icon: '❌',
        homeworkId: homeworkId,
        homeworkDate: homeworkDate,
        createTime: db.serverDate(),
        _openid: wxContext.OPENID,
        childId: selectedChildId
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

    currentChild.points = (currentChild.points || 0) - actualPoints;
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

    // 记录取消打卡明细
    await db.collection('point_records').add({
      data: {
        type: 'cancel',
        name: homework.title,
        description: homework.content || '',
        points: actualPoints,
        icon: '❌',
        homeworkId: homeworkId,
        homeworkDate: homeworkDate,
        createTime: db.serverDate(),
        _openid: wxContext.OPENID,
        childId: selectedChildId
      }
    });

    return {
      success: true,
      isRecurring: false,
      deductedPoints: actualPoints
    };
  }
};
