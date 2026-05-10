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
      
      // 如果用户有家庭，同时更新家庭中的成员信息
      if (userInfo && userInfo.familyId) {
        try {
          // 获取家庭信息
          const familyRes = await db.collection('families').doc(userInfo.familyId).get();
          
          if (familyRes.data) {
            // 更新家庭中的成员信息
            const updatedMembers = familyRes.data.members.map(member => {
              if (member.openid === wxContext.OPENID) {
                return {
                  ...member,
                  nickName: event.nickName || member.nickName,
                  avatarUrl: event.avatarUrl || member.avatarUrl
                };
              }
              return member;
            });
            
            // 更新家庭
            await db.collection('families').doc(userInfo.familyId).update({
              data: {
                members: updatedMembers,
                updateTime: db.serverDate()
              }
            });
            
            // 加载家庭数据
            userInfo = {
              ...userInfo,
              children: familyRes.data.children || []
            };
          }
        } catch (err) {
          console.error('更新家庭成员信息失败:', err);
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

    if (!userRes.data || userRes.data.length === 0) {
      return {
        success: false,
        errMsg: '用户不存在'
      };
    }

    let userInfo = userRes.data[0];

    // 如果用户有家庭，加载家庭数据
    if (userInfo && userInfo.familyId) {
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
