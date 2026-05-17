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
  const { homeworkId, date, ratingPercent, childId, account } = event;

  // 获取用户信息（支持同一个 openid 的多个账号）
  const usersRes = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get();

  // 找到对应账号的用户
  let user;
  if (usersRes.data.length > 0) {
    if (account) {
      user = usersRes.data.find(u => (u.account || '') === account);
    }
    if (!user) {
      user = usersRes.data[0];
    }
  }

  // 检查是否是只读权限（使用 openid + account 联合判断）
  let isReadOnly = false;
  try {
    if (user) {
      // 如果用户有家庭，检查是否是只读
      if (user.familyId) {
        const familyRes = await db.collection('families').doc(user.familyId).get();
        
        if (familyRes.data) {
          const family = familyRes.data;
          const members = family.members || [];
          const currentMember = members.find(m => m.openid === wxContext.OPENID && m.account === (user.account || ''));
          
          if (currentMember && currentMember.readOnly) {
            isReadOnly = true;
          }
        }
      }
    }
  } catch (err) {
    console.error('检查权限失败:', err);
  }
  
  if (isReadOnly) {
    return { success: false, errMsg: '您只有只读权限，无法打卡' };
  }

  // 1. 验证用户身份
  if (!user) {
    return { success: false, errMsg: '用户不存在或未登录' };
  }
  
  // 2. 确定小朋友ID
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

  // 3. 验证小朋友是否存在
  const childIndex = children.findIndex(c => c.id === selectedChildId);
  if (childIndex === -1) {
    return { success: false, errMsg: '小朋友不存在' };
  }

  currentChild = children[childIndex];

  // 4. 获取作业并验证所有权
  const homeworkRes = await db.collection('homework').doc(homeworkId).get();
  const homework = homeworkRes.data;

  if (!homework) {
    return { success: false, errMsg: '作业不存在' };
  }

  // 5. 验证作业是否属于当前用户和小朋友
  if (homework._openid !== wxContext.OPENID) {
    return { success: false, errMsg: '无权操作该作业' };
  }

  if (homework.childId && homework.childId !== selectedChildId) {
    return { success: false, errMsg: '作业不属于当前小朋友' };
  }

  const today = new Date();
  const todayStr = getLocalDateStr(today);
  const targetDateStr = date || todayStr;

  // 获取作业日期
  let homeworkDate;
  if (homework.recurring) {
    homeworkDate = targetDateStr;
  } else {
    homeworkDate = homework.homeworkDate || homework.date || todayStr;
  }

  if (homework.recurring) {
    const existingCheckin = await db.collection('checkins').where({
      homeworkId: homeworkId,
      _openid: wxContext.OPENID,
      childId: selectedChildId,
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
        _openid: wxContext.OPENID,
        childId: selectedChildId
      }
    });

    const basePoints = homework.points || 10;
    const actualPercent = ratingPercent || 100;
    const actualPoints = Math.round(basePoints * actualPercent / 100);

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

    // 记录积分获得明细
    await db.collection('point_records').add({
      data: {
        type: 'checkin',
        name: homework.title,
        description: homework.content || '',
        comment: '',
        rating: 3,
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
      rating: 3,
      ratingPercent: actualPercent,
      streak: streak,
      streakBonus: streakBonus
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

    let streak = currentChild.streak || 0;
    let streakBonus = 0;

    if (currentChild.lastCheckInDate !== todayStr) {
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

    const basePoints = homework.points || 10;
    const actualPercent = ratingPercent || 100;
    const actualPoints = Math.round(basePoints * actualPercent / 100);
    const totalPoints = actualPoints + streakBonus;

    // 记录积分获得明细
    await db.collection('point_records').add({
      data: {
        type: 'checkin',
        name: homework.title,
        description: homework.content || '',
        comment: '',
        rating: 3,
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
      rating: 3,
      ratingPercent: actualPercent,
      streak: streak,
      streakBonus: streakBonus
    };
  }
};
