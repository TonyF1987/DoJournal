const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { rewardId } = event;

  // 获取奖励信息
  const rewardRes = await db.collection('rewards').doc(rewardId).get();
  const reward = rewardRes.data;

  // 获取用户信息
  const userRes = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get();
  const user = userRes.data[0];

  // 检查积分是否足够
  if (user.points < reward.points) {
    return {
      success: false,
      message: '积分不足'
    };
  }

  // 创建兑换记录
  await db.collection('exchange_records').add({
    data: {
      _openid: wxContext.OPENID,
      userId: user._id,
      rewardId: rewardId,
      rewardName: reward.name,
      rewardImage: reward.image,
      pointsUsed: reward.points,
      createTime: db.serverDate()
    }
  });

  // 扣除用户积分
  await db.collection('users').doc(user._id).update({
    data: {
      points: _.inc(-reward.points),
      updateTime: db.serverDate()
    }
  });

  return {
    success: true,
    remainingPoints: user.points - reward.points
  };
};
