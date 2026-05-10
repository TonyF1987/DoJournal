const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    const userRes = await db.collection('users').where({
      _openid: openid
    }).get();

    if (!userRes.data || userRes.data.length === 0) {
      return {
        success: false,
        errMsg: '用户不存在'
      };
    }

    const userId = userRes.data[0]._id;

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
      const updatedMembers = family.members.filter(m => m.openid !== openid);
      
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