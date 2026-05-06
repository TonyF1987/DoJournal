const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  try {
    // 如果是更新用户资料的操作
    if (event.action === 'updateProfile') {
      const updateData = {};
      if (event.nickName) {
        updateData.nickName = event.nickName;
      }
      if (event.avatarUrl) {
        updateData.avatarUrl = event.avatarUrl;
      }
      
      // 更新用户记录
      await db.collection('users').where({
        _openid: wxContext.OPENID
      }).update({
        data: updateData
      });

      // 返回更新后的用户信息
      const updatedUser = await db.collection('users').where({
        _openid: wxContext.OPENID
      }).get();

      let userInfo = updatedUser.data[0];
      
      // 如果用户有家庭，加载家庭数据
      if (userInfo.familyId) {
        try {
          const familyRes = await db.collection('families').doc(userInfo.familyId).get();
          if (familyRes.data) {
            userInfo = {
              ...userInfo,
              children: familyRes.data.children || []
            };
          }
        } catch (err) {
          console.error('加载家庭数据失败:', err);
        }
      }

      return {
        success: true,
        userInfo: userInfo
      };
    }

    // 查找用户记录
    const userRes = await db.collection('users').where({
      _openid: wxContext.OPENID
    }).get();

    if (userRes.data.length === 0) {
      return {
        success: false,
        errMsg: '用户不存在'
      };
    }

    let userInfo = userRes.data[0];

    // 如果用户有家庭，加载家庭数据
    if (userInfo.familyId) {
      try {
        const familyRes = await db.collection('families').doc(userInfo.familyId).get();
        if (familyRes.data) {
          // 将家庭的小朋友数据合并到用户信息中
          userInfo = {
            ...userInfo,
            children: familyRes.data.children || []
          };
        }
      } catch (err) {
        console.error('加载家庭数据失败:', err);
      }
    }

    return {
      success: true,
      userInfo: userInfo
    };
  } catch (err) {
    console.error('获取用户信息失败:', err);
    return {
      success: false,
      errMsg: err.message || '获取用户信息失败'
    };
  }
};
