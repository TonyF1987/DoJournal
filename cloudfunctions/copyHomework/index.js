const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { sourceDate, targetDate, subject, childId, account } = event;

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
    return { success: false, errMsg: '您只有只读权限，无法复制作业' };
  }

  if (!sourceDate || !targetDate || !childId) {
    return {
      success: false,
      errMsg: '缺少必要参数'
    };
  }

  try {
    // 查询源日期下的所有作业
    const query = {
      _openid: wxContext.OPENID,
      childId: childId,
      homeworkDate: sourceDate,
      recurring: false // 只复制非周期作业
    };
    if (subject) {
      query.subject = subject;
    }

    const sourceHomework = await db.collection('homework').where(query).get();
    
    if (sourceHomework.data.length === 0) {
      return {
        success: false,
        errMsg: '源日期没有可复制的作业'
      };
    }

    // 批量插入到目标日期
    const tasks = sourceHomework.data.map(homework => {
      return db.collection('homework').add({
        data: {
          _openid: wxContext.OPENID,
          childId: childId,
          title: homework.title,
          content: homework.content,
          type: homework.type || 'manual',
          recurring: false,
          recurringDays: [],
          images: homework.images || [],
          subject: homework.subject || '',
          status: 'pending',
          points: homework.points || 10,
          homeworkDate: targetDate,
          checkInTime: null,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      });
    });

    await Promise.all(tasks);

    return {
      success: true,
      count: tasks.length,
      message: `成功复制${tasks.length}条作业到目标日期`
    };

  } catch (err) {
    console.error('复制作业失败:', err);
    return {
      success: false,
      errMsg: '复制失败: ' + err.message
    };
  }
};