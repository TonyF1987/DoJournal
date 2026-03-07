const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  // 获取用户信息
  let userRes = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get();

  let userId;
  let isNewUser = false;

  if (userRes.data.length === 0) {
    // 新用户，创建用户记录
    let addRes = await db.collection('users').add({
      data: {
        _openid: wxContext.OPENID,
        nickName: '小宝贝',
        avatarUrl: '',
        points: 0,
        streak: 0,
        lastCheckInDate: '',
        createTime: db.serverDate()
      }
    });
    userId = addRes._id;
    isNewUser = true;
  } else {
    userId = userRes.data[0]._id;
  }

  return {
    openid: wxContext.OPENID,
    userId: userId,
    isNewUser: isNewUser
  };
};
