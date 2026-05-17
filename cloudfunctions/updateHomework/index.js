const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { homeworkId, title, content, type, recurring, recurringDays, recurringEndType, recurringEndDate, recurringEndTimes, images, points, subject, account } = event;

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
    return { success: false, errMsg: '您只有只读权限，无法修改作业' };
  }

  console.log('收到更新请求:', {
    homeworkId,
    openid,
    title,
    content,
    points
  });

  if (!homeworkId) {
    return {
      success: false,
      errMsg: '缺少作业ID'
    };
  }

  try {
    const collection = db.collection('homework');
    
    const checkRes = await collection.doc(homeworkId).get();
    console.log('查询结果:', checkRes);
    
    if (!checkRes.data) {
      return {
        success: false,
        errMsg: '作业不存在'
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

    console.log('准备更新数据:', updateData);

    const res = await collection.doc(homeworkId).update({
      data: updateData
    });

    console.log('更新结果:', res);

    return {
      success: true,
      updated: res.stats.updated
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
