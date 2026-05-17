const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { account } = event;

  try {
    const usersRes = await db.collection('users').where({
      _openid: openid
    }).get();

    if (!usersRes.data || usersRes.data.length === 0) {
      return {
        success: false,
        errMsg: '用户不存在'
      };
    }

    // 找到对应账号的用户
    let user;
    if (account) {
      user = usersRes.data.find(u => (u.account || '') === account);
    }
    if (!user) {
      user = usersRes.data[0];
    }
    
    // 检查是否是只读权限（使用 openid + account 联合判断）
    if (user.familyId) {
      const familyRes = await db.collection('families').doc(user.familyId).get();
      
      if (familyRes.data) {
        const family = familyRes.data;
        const members = family.members || [];
        const currentMember = members.find(m => m.openid === openid && m.account === (user.account || ''));
        
        if (currentMember && currentMember.readOnly) {
          return { success: false, errMsg: '您只有只读权限，无法注销账号' };
        }
      }
    }

    const userId = user._id;

    await db.collection('users').doc(userId).remove();

    await db.collection('homework').where({
      _openid: openid
    }).remove();

    await db.collection('checkins').where({
      _openid: openid
    }).remove();

    await db.collection('point_records').where({
      _openid: openid
    }).remove();

    const familyRes = await db.collection('families').where({
      'members.openid': openid
    }).get();

    for (const family of familyRes.data) {
      // 使用 openid + account 联合判断来过滤成员
      const updatedMembers = family.members.filter(m => !(m.openid === openid && m.account === (user.account || '')));
      
      if (updatedMembers.length === 0) {
        await db.collection('families').doc(family._id).remove();
      } else {
        await db.collection('families').doc(family._id).update({
          data: {
            members: updatedMembers,
            updateTime: db.serverDate()
          }
        });
      }
    }

    return {
      success: true,
      message: '账号已注销'
    };
  } catch (err) {
    console.error('注销失败:', err);
    return {
      success: false,
      errMsg: '注销失败'
    };
  }
};